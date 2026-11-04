// Run: npm run test:db
// Each test asserts a negative case alongside the happy path - a policy bug
// is a silent leak, not a crash (docs/ACCESS_CONTROL.md standing rules).

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, describe, test } from "node:test";
import {
  asService,
  asUser,
  createDb,
  createDraft,
  createUser,
  makeAdmin,
  publish,
} from "./harness.mjs";

let db;
let admin;

before(async () => {
  db = await createDb();
  admin = await createUser(db, { name: "Reviewer" });
  await makeAdmin(db, admin);
});

async function apply(applicantId, projectId) {
  const {
    rows: [row],
  } = await asUser(
    db,
    applicantId,
    `insert into public.applications (project_id, cover_note)
     values ($1, 'I have shipped three React Native apps to production.') returning id`,
    [projectId],
  );
  return row.id;
}

describe("profiles", () => {
  test("a user cannot update someone else's profile", async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    const { rows } = await asUser(
      db,
      b,
      `update public.profiles set headline = 'Hijacked' where id = $1 returning id`,
      [a],
    );
    assert.equal(rows.length, 0);
  });

  test("a profile needs at least one reason to be here", async () => {
    const id = await createUser(db, { profile: false });
    await assert.rejects(
      asUser(
        db,
        id,
        `insert into public.profiles (id, full_name, headline) values ($1, 'No Intent', 'x')`,
        [id],
      ),
      /profiles_intent_check/,
    );
  });

  test("hiring-only is a valid intent", async () => {
    const id = await createUser(db, { profile: false });
    await asUser(
      db,
      id,
      `insert into public.profiles (id, full_name, headline, wants_to_hire) values ($1, 'Owner', 'Founder', true)`,
      [id],
    );
  });
});

describe("listings", () => {
  test("drafts are invisible to other users", async () => {
    const owner = await createUser(db);
    const other = await createUser(db);
    const projectId = await createDraft(db, owner);
    const { rows } = await asUser(db, other, `select id from public.projects where id = $1`, [
      projectId,
    ]);
    assert.equal(rows.length, 0);
  });

  test("owners cannot publish directly or change protected columns", async () => {
    const owner = await createUser(db);
    const projectId = await createDraft(db, owner);
    await assert.rejects(
      asUser(db, owner, `update public.projects set status = 'published' where id = $1`, [
        projectId,
      ]),
      /permission denied/,
    );
    await assert.rejects(
      asUser(db, owner, `update public.projects set is_featured = true where id = $1`, [projectId]),
      /permission denied/,
    );
  });

  test("users cannot insert listings for someone else", async () => {
    const owner = await createUser(db);
    const attacker = await createUser(db);
    await assert.rejects(
      asUser(
        db,
        attacker,
        `insert into public.projects (owner_id, title, public_summary, opportunity_type)
         values ($1, 'Spoofed listing', 'This should never be created by the attacker.', 'paid')`,
        [owner],
      ),
      /permission denied/,
    );
  });

  test("submit -> review -> published makes it visible to everyone", async () => {
    const owner = await createUser(db);
    const other = await createUser(db);
    const projectId = await createDraft(db, owner);
    await publish(db, owner, admin, projectId);
    const { rows } = await asUser(db, other, `select status from public.projects where id = $1`, [
      projectId,
    ]);
    assert.equal(rows[0]?.status, "published");
  });

  test("published listings cannot be edited in place", async () => {
    const owner = await createUser(db);
    const projectId = await createDraft(db, owner);
    await publish(db, owner, admin, projectId);
    const { rows } = await asUser(
      db,
      owner,
      `update public.projects set title = 'Bait and switch' where id = $1 returning id`,
      [projectId],
    );
    assert.equal(rows.length, 0);
  });

  test("partner listings need admission criteria before review", async () => {
    const owner = await createUser(db);
    const {
      rows: [project],
    } = await asUser(
      db,
      owner,
      `insert into public.projects (title, public_summary, opportunity_type)
       values ('Co-founder wanted', 'Looking for a technical co-founder for a fintech idea.', 'partner')
       returning id`,
    );
    const {
      rows: [skill],
    } = await db.query(`insert into public.skills (name) values ('Fintech') returning id`);
    await asUser(
      db,
      owner,
      `insert into public.project_required_skills (project_id, skill_id) values ($1, $2)`,
      [project.id, skill.id],
    );
    await assert.rejects(
      asService(db, `select public.svc_submit_listing($1, $2)`, [owner, project.id]),
      /admission criteria/,
    );
  });

  test("only never-published drafts can be deleted", async () => {
    const owner = await createUser(db);
    const deleteAs = async (id) =>
      (await asUser(db, owner, `delete from public.projects where id = $1 returning id`, [id])).rows
        .length;

    const fresh = await createDraft(db, owner);
    assert.equal(await deleteAs(fresh), 1);

    // Published, then moved back to draft: applications, memberships and
    // other people's outcomes can hang off it now, so it must stay.
    const used = await createDraft(db, owner);
    await publish(db, owner, admin, used);
    await asService(db, `select public.svc_set_listing_status($1, $2, 'draft')`, [owner, used]);
    assert.equal(await deleteAs(used), 0);
    const { rows } = await db.query(`select id from public.projects where id = $1`, [used]);
    assert.equal(rows.length, 1);
  });

  test("free plan allows one live listing; pro allows more", async () => {
    const owner = await createUser(db);
    const first = await createDraft(db, owner);
    const second = await createDraft(db, owner);
    await publish(db, owner, admin, first);
    await assert.rejects(
      asService(db, `select public.svc_submit_listing($1, $2)`, [owner, second]),
      /LISTING_LIMIT/,
    );
    await asService(
      db,
      `select public.svc_apply_subscription($1, 'pro', 'active', 'cus_1', 'sub_1', now() + interval '30 days')`,
      [owner],
    );
    await asService(db, `select public.svc_submit_listing($1, $2)`, [owner, second]);
    const { rows } = await db.query(`select is_featured from public.projects where id = $1`, [
      first,
    ]);
    assert.equal(rows[0].is_featured, true, "upgrading features already-live listings");
  });

  test("only admins can review", async () => {
    const owner = await createUser(db);
    const projectId = await createDraft(db, owner);
    await asService(db, `select public.svc_submit_listing($1, $2)`, [owner, projectId]);
    await assert.rejects(
      asService(db, `select public.svc_review_listing($1, $2, true, null)`, [owner, projectId]),
      /Only reviewers/,
    );
  });

  test("rejecting a listing requires a note", async () => {
    const owner = await createUser(db);
    const projectId = await createDraft(db, owner);
    await asService(db, `select public.svc_submit_listing($1, $2)`, [owner, projectId]);
    await assert.rejects(
      asService(db, `select public.svc_review_listing($1, $2, false, '  ')`, [admin, projectId]),
      /what to change/,
    );
  });

  test("transition functions are not callable with a user JWT", async () => {
    const owner = await createUser(db);
    const projectId = await createDraft(db, owner);
    await assert.rejects(
      asUser(db, owner, `select public.svc_submit_listing($1, $2)`, [owner, projectId]),
      /permission denied/,
    );
    await assert.rejects(
      asUser(db, owner, `select private.submit_listing($1, $2)`, [owner, projectId]),
      /permission denied/,
    );
  });
});

describe("applications", () => {
  test("cannot apply to a draft or to your own listing", async () => {
    const owner = await createUser(db);
    const applicant = await createUser(db);
    const projectId = await createDraft(db, owner);
    await assert.rejects(apply(applicant, projectId), /not accepting/);
    await publish(db, owner, admin, projectId);
    await assert.rejects(apply(owner, projectId), /own listing/);
  });

  test("applicants cannot self-accept or spoof the applicant", async () => {
    const owner = await createUser(db);
    const applicant = await createUser(db);
    const victim = await createUser(db);
    const projectId = await createDraft(db, owner);
    await publish(db, owner, admin, projectId);
    const appId = await apply(applicant, projectId);
    await assert.rejects(
      asUser(db, applicant, `update public.applications set status = 'accepted' where id = $1`, [
        appId,
      ]),
      /permission denied/,
    );
    await assert.rejects(
      asUser(
        db,
        applicant,
        `insert into public.applications (project_id, applicant_id, cover_note)
         values ($1, $2, 'Applying on behalf of someone else entirely.')`,
        [projectId, victim],
      ),
      /permission denied/,
    );
  });

  test("third parties cannot see applications", async () => {
    const owner = await createUser(db);
    const applicant = await createUser(db);
    const snoop = await createUser(db);
    const projectId = await createDraft(db, owner);
    await publish(db, owner, admin, projectId);
    const appId = await apply(applicant, projectId);
    const { rows } = await asUser(db, snoop, `select id from public.applications where id = $1`, [
      appId,
    ]);
    assert.equal(rows.length, 0);
    const { rows: ownerRows } = await asUser(
      db,
      owner,
      `select id from public.applications where id = $1`,
      [appId],
    );
    assert.equal(ownerRows.length, 1);
  });

  test("only the owner can decide, and acceptance creates a membership + reveals contact", async () => {
    const owner = await createUser(db);
    const applicant = await createUser(db);
    const snoop = await createUser(db);
    const projectId = await createDraft(db, owner, { type: "partner" });
    await publish(db, owner, admin, projectId);
    const appId = await apply(applicant, projectId);

    const contactBefore = await asUser(
      db,
      applicant,
      `select * from public.get_application_contact($1)`,
      [appId],
    );
    assert.equal(contactBefore.rows.length, 0, "no contact before acceptance");

    await assert.rejects(
      asService(db, `select public.svc_decide_application($1, $2, true, null)`, [applicant, appId]),
      /not found/,
    );
    await asService(db, `select public.svc_decide_application($1, $2, true, 'Welcome')`, [
      owner,
      appId,
    ]);
    await assert.rejects(
      asService(db, `select public.svc_decide_application($1, $2, false, null)`, [owner, appId]),
      /already been decided/,
    );

    const { rows: memberships } = await db.query(
      `select role from public.project_memberships where application_id = $1`,
      [appId],
    );
    assert.equal(memberships[0]?.role, "partner");

    const contact = await asUser(
      db,
      applicant,
      `select * from public.get_application_contact($1)`,
      [appId],
    );
    assert.equal(contact.rows[0]?.email, `${owner}@example.com`);
    const snooped = await asUser(db, snoop, `select * from public.get_application_contact($1)`, [
      appId,
    ]);
    assert.equal(snooped.rows.length, 0, "contact is never revealed to third parties");

    const { rows: history } = await db.query(
      `select to_status from public.application_status_history where application_id = $1 order by id`,
      [appId],
    );
    assert.deepEqual(
      history.map((row) => row.to_status),
      ["submitted", "accepted"],
    );
  });

  test("withdraw only works on your own pending application", async () => {
    const owner = await createUser(db);
    const applicant = await createUser(db);
    const projectId = await createDraft(db, owner);
    await publish(db, owner, admin, projectId);
    const appId = await apply(applicant, projectId);
    await assert.rejects(
      asService(db, `select public.svc_withdraw_application($1, $2)`, [owner, appId]),
      /Only a pending application/,
    );
    await asService(db, `select public.svc_withdraw_application($1, $2)`, [applicant, appId]);
    await apply(applicant, projectId); // re-applying after withdrawal is allowed
  });

  test("closing a listing turns away pending applicants", async () => {
    const owner = await createUser(db);
    const applicant = await createUser(db);
    const projectId = await createDraft(db, owner);
    await publish(db, owner, admin, projectId);
    const appId = await apply(applicant, projectId);
    await asService(db, `select public.svc_set_listing_status($1, $2, 'abandoned')`, [
      owner,
      projectId,
    ]);
    const { rows } = await db.query(`select status from public.applications where id = $1`, [
      appId,
    ]);
    assert.equal(rows[0].status, "rejected");
    // The applicant can still see the listing they applied to.
    const { rows: visible } = await asUser(
      db,
      applicant,
      `select id from public.projects where id = $1`,
      [projectId],
    );
    assert.equal(visible.length, 1);
  });
});

describe("outcome ledger", () => {
  // Accepts member onto a fresh listing of owner's; by default the
  // collaboration started long enough ago to be marked completed.
  async function collaborate(owner, member, { daysAgo = 30 } = {}) {
    const projectId = await createDraft(db, owner);
    await publish(db, owner, admin, projectId);
    const appId = await apply(member, projectId);
    await asService(db, `select public.svc_decide_application($1, $2, true, null)`, [owner, appId]);
    const {
      rows: [membership],
    } = await db.query(
      `update public.project_memberships set joined_at = now() - make_interval(days => $2)
       where application_id = $1 returning id`,
      [appId, daysAgo],
    );
    return { projectId, membershipId: membership.id };
  }

  async function acceptedMembership(options) {
    const owner = await createUser(db);
    const member = await createUser(db);
    const { membershipId } = await collaborate(owner, member, options);
    return { owner, member, membershipId };
  }

  const record = (actor, membershipId, outcome) =>
    asService(db, `select public.svc_record_outcome($1, $2, $3, null)`, [
      actor,
      membershipId,
      outcome,
    ]);
  const trackRecord = async (userId) =>
    (await asUser(db, userId, `select * from public.get_track_record($1)`, [userId])).rows[0];

  test("an outcome counts only once both sides confirm the same thing", async () => {
    const { owner, member, membershipId } = await acceptedMembership();

    await record(owner, membershipId, "completed");
    assert.equal((await trackRecord(member)).completed, 0, "one-sided claims don't count");

    await record(member, membershipId, "abandoned"); // disagreement resets the owner's confirmation
    await record(owner, membershipId, "abandoned");
    const final = await trackRecord(member);
    assert.equal(final.total, 1);
    assert.equal(final.completed, 0);

    await assert.rejects(record(owner, membershipId, "completed"), /already confirmed/);
  });

  test("a collaboration can't be marked completed in its first week", async () => {
    const { owner, membershipId } = await acceptedMembership({ daysAgo: 2 });
    await assert.rejects(record(owner, membershipId, "completed"), /after a week/);
    await record(owner, membershipId, "abandoned"); // ending early is always allowed
  });

  test("repeat collaborations with the same person count once", async () => {
    const owner = await createUser(db);
    const member = await createUser(db);
    const first = await collaborate(owner, member);
    // Free plan: close the first listing before the second can go live.
    await asService(db, `select public.svc_set_listing_status($1, $2, 'completed')`, [
      owner,
      first.projectId,
    ]);
    const second = await collaborate(owner, member);
    for (const { membershipId } of [first, second]) {
      await record(owner, membershipId, "completed");
      await record(member, membershipId, "completed");
    }
    assert.deepEqual({ ...(await trackRecord(member)) }, { completed: 1, total: 1 });
    assert.deepEqual({ ...(await trackRecord(owner)) }, { completed: 1, total: 1 });
  });

  test("outsiders cannot record outcomes", async () => {
    const { membershipId } = await acceptedMembership();
    const outsider = await createUser(db);
    await assert.rejects(
      asService(db, `select public.svc_record_outcome($1, $2, 'completed', null)`, [
        outsider,
        membershipId,
      ]),
      /not found/,
    );
  });

  test("references: only after a confirmed completion, one each, about the other side", async () => {
    const { owner, member, membershipId } = await acceptedMembership();
    const write = (actor, body) =>
      asService(db, `select public.svc_write_reference($1, $2, $3)`, [actor, membershipId, body]);
    const body = "Shipped the booking flow two days early and documented everything.";

    await assert.rejects(write(owner, body), /once you've both confirmed/);
    await record(owner, membershipId, "completed");
    await assert.rejects(write(owner, body), /once you've both confirmed/, "one side isn't enough");
    await record(member, membershipId, "completed");

    await write(owner, body);
    await assert.rejects(write(owner, body), /already written/);
    await assert.rejects(write(member, "Too short"), /work_references_body_length/);
    await assert.rejects(
      write(member, "Great founder, reach them at founder@example.com any time."),
      /no_contact/,
    );
    const outsider = await createUser(db);
    await assert.rejects(write(outsider, body), /not found/);

    const { rows } = await asUser(
      db,
      outsider,
      `select author_id, subject_id, project_title from public.work_references where membership_id = $1`,
      [membershipId],
    );
    assert.equal(rows.length, 1, "references are public to signed-in users");
    assert.equal(rows[0].author_id, owner);
    assert.equal(rows[0].subject_id, member);
    await assert.rejects(
      asUser(
        db,
        member,
        `insert into public.work_references (membership_id, author_id, subject_id, project_title, body)
        values ($1, $2, $2, 'x', $3)`,
        [membershipId, member, body],
      ),
      /permission denied/,
    );
  });

  test("abandoned collaborations can't carry references", async () => {
    const { owner, member, membershipId } = await acceptedMembership();
    await record(owner, membershipId, "abandoned");
    await record(member, membershipId, "abandoned");
    await assert.rejects(
      asService(db, `select public.svc_write_reference($1, $2, $3)`, [
        owner,
        membershipId,
        "They did good work on the parts that got built before we stopped.",
      ]),
      /once you've both confirmed/,
    );
  });
});

describe("billing", () => {
  test("users cannot grant themselves a plan", async () => {
    const user = await createUser(db);
    await assert.rejects(
      asUser(
        db,
        user,
        `insert into public.subscriptions (user_id, plan, status) values ($1, 'pro', 'active')`,
        [user],
      ),
      /permission denied/,
    );
  });

  test("users can only read their own subscription", async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    await asService(
      db,
      `select public.svc_apply_subscription($1, 'pro', 'active', null, null, null)`,
      [a],
    );
    const { rows } = await asUser(db, b, `select * from public.subscriptions where user_id = $1`, [
      a,
    ]);
    assert.equal(rows.length, 0);
  });
});

describe("skills", () => {
  test("users cannot attribute skills to someone else", async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    await assert.rejects(
      asUser(db, a, `insert into public.skills (name, created_by) values ('Spoofed', $1)`, [b]),
      /permission denied/,
    );
  });

  test("new skills are capped per user per day", async () => {
    const user = await createUser(db);
    // Digit-free, so long id runs don't read as a phone number.
    const tag = user.replace(/[\d-]/g, "");
    for (let i = 0; i < 50; i++) {
      await asUser(db, user, `insert into public.skills (name) values ($1)`, [
        `Skill ${tag} ${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26)}`,
      ]);
    }
    await assert.rejects(
      asUser(db, user, `insert into public.skills (name) values ($1)`, [`Skill ${tag} overflow`]),
      /Too many new skills/,
    );
  });
});

describe("content rules", () => {
  test("contact details are rejected before mutual acceptance", async () => {
    const owner = await createUser(db);
    const insert = (summary) =>
      asUser(
        db,
        owner,
        `insert into public.projects (title, public_summary, opportunity_type)
         values ('Some real project', $1, 'paid')`,
        [summary],
      );
    for (const leak of [
      "Email me at founder@startup.io for details please",
      "Call me on +44 7700 900123 to discuss the project",
      "See https://example.com/brief for the full brief here",
      "Full brief at www.example.com before you apply",
    ]) {
      await assert.rejects(insert(leak), /no_contact/, leak);
    }
    // Ordinary numbers and tech names with dots are fine.
    await insert("We have 14 clinics, £1,800 MRR, built with Node.js in 2024-2025.");
  });

  test("cover notes can't carry contact details either", async () => {
    const owner = await createUser(db);
    const applicant = await createUser(db);
    const projectId = await createDraft(db, owner);
    await publish(db, owner, admin, projectId);
    await assert.rejects(
      asUser(
        db,
        applicant,
        `insert into public.applications (project_id, cover_note)
         values ($1, 'Keen! Reach me directly at me@example.com any time.')`,
        [projectId],
      ),
      /no_contact/,
    );
  });
});

describe("content rules beyond free text", () => {
  test("names, skills, profile details and decision notes reject contact details", async () => {
    const owner = await createUser(db);
    const applicant = await createUser(db);
    const updateProfile = (column, value) =>
      asUser(db, owner, `update public.profiles set ${column} = $2 where id = $1`, [owner, value]);
    await assert.rejects(
      asUser(db, owner, `insert into public.skills (name) values ('mail me at a@b.co')`),
      /no_contact/,
    );
    await assert.rejects(updateProfile("location", "Call +44 7700 900123"), /no_contact/);
    await assert.rejects(updateProfile("full_name", "Sam www.sam.dev"), /no_contact/);
    const projectId = await createDraft(db, owner);
    await assert.rejects(
      asUser(db, owner, `update public.projects set duration = $2 where id = $1`, [
        projectId,
        "See https://x.io/brief",
      ]),
      /no_contact/,
    );
    await publish(db, owner, admin, projectId);
    const appId = await apply(applicant, projectId);
    await assert.rejects(
      asService(db, `select public.svc_decide_application($1, $2, false, $3)`, [
        owner,
        appId,
        "Email me: o@x.com",
      ]),
      /no_contact/,
    );
    // Ordinary values still pass.
    await updateProfile("location", "London, UK");
  });
});

describe("images", () => {
  const file = () => `${randomUUID()}.jpg`;

  test("avatar must be a file in your own avatars folder", async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    await asUser(db, a, `update public.profiles set avatar_url = $2 where id = $1`, [
      a,
      `${a}/${file()}`,
    ]);
    await assert.rejects(
      asUser(db, a, `update public.profiles set avatar_url = $2 where id = $1`, [
        a,
        "https://tracker.example/pixel.gif",
      ]),
      /profiles_avatar_path/,
    );
    await assert.rejects(
      asUser(db, a, `update public.profiles set avatar_url = $2 where id = $1`, [
        a,
        `${b}/${file()}`,
      ]),
      /profiles_avatar_path/,
    );
  });

  test("storage: users can only write into their own folder", async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    await asUser(db, a, `insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [
      `${a}/${file()}`,
    ]);
    await assert.rejects(
      asUser(db, a, `insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [
        `${b}/${file()}`,
      ]),
      /row-level security/,
    );
  });

  test("listing images: only while editable, own path, max 4", async () => {
    const owner = await createUser(db);
    const other = await createUser(db);
    const projectId = await createDraft(db, owner);
    const add = (actor, path) =>
      asUser(
        db,
        actor,
        `insert into public.listing_images (project_id, storage_path) values ($1, $2)`,
        [projectId, path],
      );
    for (let i = 0; i < 4; i++) await add(owner, `${owner}/${projectId}/${file()}`);
    await assert.rejects(add(owner, `${owner}/${projectId}/${file()}`), /up to 4/);
    // The path trigger fires before RLS, so either rejection is a pass.
    await assert.rejects(
      add(other, `${other}/${projectId}/${file()}`),
      /row-level security|Invalid image path/,
    );

    const second = await createDraft(db, owner);
    await assert.rejects(
      asUser(
        db,
        owner,
        `insert into public.listing_images (project_id, storage_path) values ($1, $2)`,
        [second, `${owner}/${projectId}/${file()}`],
      ),
      /Invalid image path/,
    );
    await publish(db, owner, admin, second);
    await assert.rejects(
      asUser(
        db,
        owner,
        `insert into public.listing_images (project_id, storage_path) values ($1, $2)`,
        [second, `${owner}/${second}/${file()}`],
      ),
      /row-level security/,
    );
  });

  test("application attachments are private to the two parties", async () => {
    const owner = await createUser(db);
    const applicant = await createUser(db);
    const snoop = await createUser(db);
    const projectId = await createDraft(db, owner);
    await publish(db, owner, admin, projectId);
    const appId = await apply(applicant, projectId);
    const path = `${applicant}/${file()}`;
    await db.query(
      `insert into storage.objects (bucket_id, name) values ('application-attachments', $1)`,
      [path],
    );
    await asUser(
      db,
      applicant,
      `insert into public.application_attachments (application_id, storage_path) values ($1, $2)`,
      [appId, path],
    );
    const canSee = async (user) =>
      (
        await asUser(
          db,
          user,
          `select 1 from storage.objects where bucket_id = 'application-attachments' and name = $1`,
          [path],
        )
      ).rows.length === 1;
    assert.equal(await canSee(applicant), true);
    assert.equal(await canSee(owner), true);
    assert.equal(await canSee(snoop), false);
    await assert.rejects(
      asUser(
        db,
        snoop,
        `insert into public.application_attachments (application_id, storage_path) values ($1, $2)`,
        [appId, `${snoop}/${file()}`],
      ),
      /row-level security|Invalid attachment path/,
    );
  });

  test("portfolio is capped at 6 and captions follow the content rule", async () => {
    const user = await createUser(db);
    const add = (caption = null) =>
      asUser(
        db,
        user,
        `insert into public.portfolio_images (storage_path, caption) values ($1, $2)`,
        [`${user}/${file()}`, caption],
      );
    await assert.rejects(add("Hire me: me@example.com"), /no_contact/);
    for (let i = 0; i < 6; i++) await add("Booking flow redesign");
    await assert.rejects(add(), /up to 6/);
  });
});

// Structural checks over the whole schema, so a future migration can't
// quietly skip a standing rule (docs/ACCESS_CONTROL.md).
describe("schema guardrails", () => {
  test("every public table has row level security enabled", async () => {
    const { rows } = await db.query(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    );
    assert.deepEqual(rows, []);
  });

  test("every foreign key has a covering index", async () => {
    const { rows } = await db.query(
      `select c.conrelid::regclass::text as tbl, a.attname as col
       from pg_constraint c
       join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
       join pg_namespace n on n.oid = (select relnamespace from pg_class where oid = c.conrelid)
       where c.contype = 'f' and n.nspname in ('public', 'private')
         and not exists (
           select 1 from pg_index i
           where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1]
         )`,
    );
    assert.deepEqual(rows, []);
  });

  test("every security definer function pins search_path", async () => {
    const { rows } = await db.query(
      `select p.oid::regprocedure::text as fn from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       where n.nspname in ('public', 'private') and p.prosecdef
         and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`,
    );
    assert.deepEqual(rows, []);
  });

  test("nothing in private is executable by PUBLIC", async () => {
    const { rows } = await db.query(
      `select p.oid::regprocedure::text as fn from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'private' and has_function_privilege('public', p.oid, 'execute')`,
    );
    assert.deepEqual(rows, []);
  });

  test("client roles hold only the privileges the migrations grant", async () => {
    const has = async (role, table, privilege) =>
      (
        await db.query(`select has_table_privilege($1, $2, $3) as ok`, [
          role,
          `public.${table}`,
          privilege,
        ])
      ).rows[0].ok;
    const { rows: tables } = await db.query(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'`,
    );
    for (const { relname } of tables) {
      for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
        assert.equal(await has("anon", relname, privilege), false, `anon ${privilege} ${relname}`);
      }
    }
    // Writes to these go through column grants or Edge Functions only.
    for (const table of ["projects", "applications", "profiles", "skills", "subscriptions"]) {
      for (const privilege of ["INSERT", "UPDATE"]) {
        assert.equal(await has("authenticated", table, privilege), false, `${privilege} ${table}`);
      }
    }
    // The Edge Functions read subscriptions directly.
    assert.equal(await has("service_role", "subscriptions", "SELECT"), true);
  });

  test("service-only wrappers are not callable by signed-in users", async () => {
    const { rows } = await db.query(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and left(p.proname, 4) = 'svc_'
         and has_function_privilege('authenticated', p.oid, 'execute')`,
    );
    assert.deepEqual(rows, []);
  });
});

describe("rate limiting", () => {
  test("allows up to the limit within a window, then refuses", async () => {
    const key = `test:${randomUUID()}`;
    const hit = async () =>
      (await asService(db, `select public.svc_hit_rate_limit($1, 3, 60) as ok`, [key])).rows[0].ok;
    assert.deepEqual(
      [await hit(), await hit(), await hit(), await hit()],
      [true, true, true, false],
    );
  });

  test("users cannot reach the limiter or its table", async () => {
    const user = await createUser(db);
    await assert.rejects(
      asUser(db, user, `select public.svc_hit_rate_limit('x', 1000, 60)`),
      /permission denied/,
    );
    await assert.rejects(asUser(db, user, `delete from private.rate_limits`), /permission denied/);
  });
});

describe("batched skills", () => {
  test("ensure_skills reuses existing names case-insensitively in one call", async () => {
    const user = await createUser(db);
    const first = await asUser(db, user, `select * from public.ensure_skills($1)`, [
      ["Kotlin Multiplatform", " kotlin multiplatform ", "Rust"],
    ]);
    assert.equal(first.rows.length, 2);
    const again = await asUser(db, user, `select * from public.ensure_skills($1)`, [
      ["KOTLIN MULTIPLATFORM"],
    ]);
    assert.equal(again.rows[0].id, first.rows.find((r) => r.name === "Kotlin Multiplatform").id);
  });

  test("ensure_skills refuses oversized batches", async () => {
    const user = await createUser(db);
    const names = Array.from({ length: 21 }, (_, i) => `Batch ${user} ${i}`);
    await assert.rejects(
      asUser(db, user, `select * from public.ensure_skills($1)`, [names]),
      /Too many skills/,
    );
  });
});

describe("storage caps", () => {
  test("per-user file count is capped per bucket", async () => {
    const user = await createUser(db);
    const upload = () =>
      asUser(db, user, `insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [
        `${user}/${randomUUID()}.jpg`,
      ]);
    for (let i = 0; i < 5; i++) await upload();
    await assert.rejects(upload(), /row-level security/);
  });

  test("attachment uploads need a pending application", async () => {
    const user = await createUser(db);
    await assert.rejects(
      asUser(
        db,
        user,
        `insert into storage.objects (bucket_id, name) values ('application-attachments', $1)`,
        [`${user}/${randomUUID()}.jpg`],
      ),
      /row-level security/,
    );
  });
});

describe("owner reply record", () => {
  test("counts real replies, ignores withdrawals, grace-period waits and auto-closes", async () => {
    const owner = await createUser(db);
    const viewer = await createUser(db);
    const projectId = await createDraft(db, owner);
    await publish(db, owner, admin, projectId);

    const applicants = await Promise.all([1, 2, 3, 4, 5].map(() => createUser(db)));
    const appIds = [];
    for (const applicant of applicants) appIds.push(await apply(applicant, projectId));
    // Backdate so none are in the 7-day grace period.
    await db.query(
      `update public.applications set created_at = now() - interval '10 days' where project_id = $1`,
      [projectId],
    );
    await asService(db, `select public.svc_decide_application($1, $2, true, null)`, [
      owner,
      appIds[0],
    ]);
    await asService(db, `select public.svc_decide_application($1, $2, false, null)`, [
      owner,
      appIds[1],
    ]);
    await asService(db, `select public.svc_withdraw_application($1, $2)`, [
      applicants[2],
      appIds[2],
    ]);
    // appIds[3] and [4] are left waiting, then the listing is closed.
    await asService(db, `select public.svc_set_listing_status($1, $2, 'abandoned')`, [
      owner,
      projectId,
    ]);

    const {
      rows: [record],
    } = await asUser(db, viewer, `select * from public.get_owner_reply_record($1)`, [owner]);
    assert.equal(record.received, 4, "withdrawn doesn't count");
    assert.equal(record.replied, 2, "auto-rejected on close isn't a reply");
    assert.equal(record.median_hours, 240);
  });

  test("a brand-new wait isn't held against the owner yet", async () => {
    const owner = await createUser(db);
    const projectId = await createDraft(db, owner);
    await publish(db, owner, admin, projectId);
    await apply(await createUser(db), projectId);
    const {
      rows: [record],
    } = await asUser(db, owner, `select * from public.get_owner_reply_record($1)`, [owner]);
    assert.deepEqual(record, { received: 0, replied: 0, median_hours: null });
  });

  test("is not callable signed out", async () => {
    const owner = await createUser(db);
    await assert.rejects(
      db.transaction(async (tx) => {
        await tx.exec("set local role anon");
        return tx.query(`select * from public.get_owner_reply_record($1)`, [owner]);
      }),
      /permission denied/,
    );
  });
});

describe("platform pulse", () => {
  async function professional(skillNames, { paid = false, partner = false } = {}) {
    const id = await createUser(db, { profile: false });
    await db.query(
      `insert into public.profiles (id, full_name, headline, seeking_paid, seeking_partner)
       values ($1, 'Pro', 'Engineer', $2, $3)`,
      [id, paid, partner],
    );
    for (const name of skillNames) {
      const {
        rows: [skill],
      } = await db.query(
        `insert into public.skills (name) values ($1)
         on conflict (lower(name)) do update set name = public.skills.name returning id`,
        [name],
      );
      await db.query(`insert into public.profile_skills (profile_id, skill_id) values ($1, $2)`, [
        id,
        skill.id,
      ]);
    }
    return id;
  }

  test("counts professionals by skill and opportunity type, never the caller", async () => {
    const tag = randomUUID().slice(0, 6);
    const me = await professional([`Elixir ${tag}`], { paid: true, partner: true });
    await professional([`Elixir ${tag}`], { paid: true });
    await professional([`elixir ${tag}`, `Phoenix ${tag}`], { partner: true });
    await professional([`Phoenix ${tag}`], { paid: true });
    const count = async (skills, type) =>
      (await asUser(db, me, `select public.count_professionals_for($1, $2) as n`, [skills, type]))
        .rows[0].n;
    assert.equal(await count([`ELIXIR ${tag}`], "paid"), 1);
    assert.equal(await count([`Elixir ${tag}`], "partner"), 1);
    assert.equal(await count([`Elixir ${tag}`, `Phoenix ${tag}`], "paid"), 2);
    assert.equal(await count([], "paid"), 0);
    await assert.rejects(count([`x`], "cofounder"), /Unknown opportunity type/);
  });

  test("pulse returns totals only", async () => {
    const user = await createUser(db);
    const { rows } = await asUser(db, user, `select * from public.get_platform_pulse()`);
    assert.deepEqual(Object.keys(rows[0]).sort(), [
      "completed",
      "live_listings",
      "open_to_paid",
      "open_to_partner",
    ]);
  });
});

describe("activity inbox", () => {
  const inbox = async (userId) =>
    (
      await asUser(
        db,
        userId,
        `select kind, actor_id, read_at from public.activity order by created_at, kind`,
      )
    ).rows;

  test("the right person hears about each step, and only they can see it", async () => {
    const owner = await createUser(db);
    const applicant = await createUser(db);
    const projectId = await createDraft(db, owner);
    await publish(db, owner, admin, projectId);
    assert.deepEqual(
      (await inbox(owner)).map((row) => row.kind),
      ["listing_published"],
    );

    const appId = await apply(applicant, projectId);
    await asService(db, `select public.svc_ask_question($1, $2, $3)`, [
      owner,
      appId,
      "Which payment provider did you integrate?",
    ]);
    const {
      rows: [question],
    } = await db.query(`select id from public.application_questions where application_id = $1`, [
      appId,
    ]);
    await asService(db, `select public.svc_answer_question($1, $2, $3)`, [
      applicant,
      question.id,
      "Stripe, including webhooks and refunds.",
    ]);
    await asService(db, `select public.svc_decide_application($1, $2, true, null)`, [owner, appId]);

    assert.deepEqual(
      (await inbox(owner)).map((row) => row.kind),
      ["listing_published", "application_received", "question_answered"],
    );
    assert.deepEqual(
      (await inbox(applicant)).map((row) => row.kind),
      ["question_asked", "application_accepted"],
    );

    // Nobody else sees it; you can mark your own read, not other people's.
    const outsider = await createUser(db);
    assert.deepEqual(await inbox(outsider), []);
    const { rows: marked } = await asUser(
      db,
      outsider,
      `update public.activity set read_at = now() where read_at is null returning id`,
    );
    assert.equal(marked.length, 0);
    await asUser(db, applicant, `update public.activity set read_at = now() where read_at is null`);
    assert.ok((await inbox(applicant)).every((row) => row.read_at !== null));
    await assert.rejects(
      asUser(db, applicant, `update public.activity set kind = 'application_received'`),
      /permission denied/,
    );
    await assert.rejects(
      asUser(
        db,
        applicant,
        `insert into public.activity (user_id, kind) values ($1, 'listing_published')`,
        [applicant],
      ),
      /permission denied/,
    );
  });

  test("closing a listing tells waiting applicants it closed, not that they were declined", async () => {
    const owner = await createUser(db);
    const applicant = await createUser(db);
    const projectId = await createDraft(db, owner);
    await publish(db, owner, admin, projectId);
    await apply(applicant, projectId);
    await asService(db, `select public.svc_set_listing_status($1, $2, 'abandoned')`, [
      owner,
      projectId,
    ]);
    assert.deepEqual(
      (await inbox(applicant)).map((row) => row.kind),
      ["application_closed"],
    );
  });
});

describe("application questions", () => {
  async function pendingApplication() {
    const owner = await createUser(db);
    const applicant = await createUser(db);
    const projectId = await createDraft(db, owner);
    await publish(db, owner, admin, projectId);
    const appId = await apply(applicant, projectId);
    return { owner, applicant, appId };
  }
  const ask = (actor, appId, text = "What was your role on that project?") =>
    asService(db, `select public.svc_ask_question($1, $2, $3)`, [actor, appId, text]);
  const openQuestion = async (appId) =>
    (
      await db.query(
        `select id from public.application_questions where application_id = $1 and answer is null`,
        [appId],
      )
    ).rows[0].id;
  const answer = (actor, questionId, text = "I led the mobile side end to end.") =>
    asService(db, `select public.svc_answer_question($1, $2, $3)`, [actor, questionId, text]);

  test("only the owner asks, only the applicant answers, one at a time, three at most", async () => {
    const { owner, applicant, appId } = await pendingApplication();
    await assert.rejects(ask(applicant, appId), /not found/);
    await ask(owner, appId);
    await assert.rejects(ask(owner, appId), /Wait for an answer/);
    const first = await openQuestion(appId);
    await assert.rejects(answer(owner, first), /not found/);
    await answer(applicant, first);
    await assert.rejects(answer(applicant, first), /already answered/);
    for (let i = 0; i < 2; i++) {
      await ask(owner, appId);
      await answer(applicant, await openQuestion(appId));
    }
    await assert.rejects(ask(owner, appId), /up to 3 questions/);
  });

  test("questions are private to the two parties and carry no contact details", async () => {
    const { owner, applicant, appId } = await pendingApplication();
    await assert.rejects(
      ask(owner, appId, "Can you email me at boss@corp.com instead?"),
      /no_contact/,
    );
    await ask(owner, appId);
    const outsider = await createUser(db);
    const visible = async (userId) =>
      (
        await asUser(
          db,
          userId,
          `select id from public.application_questions where application_id = $1`,
          [appId],
        )
      ).rows.length;
    assert.equal(await visible(owner), 1);
    assert.equal(await visible(applicant), 1);
    assert.equal(await visible(outsider), 0);
  });

  test("no questions once the application is decided", async () => {
    const { owner, applicant, appId } = await pendingApplication();
    await ask(owner, appId);
    const questionId = await openQuestion(appId);
    await asService(db, `select public.svc_decide_application($1, $2, false, null)`, [
      owner,
      appId,
    ]);
    await assert.rejects(answer(applicant, questionId), /already been decided/);
    await assert.rejects(ask(owner, appId), /while an application is pending/);
  });
});

describe("blocking", () => {
  test("a block stops applications both ways without revealing itself", async () => {
    const owner = await createUser(db);
    const blocked = await createUser(db);
    const projectId = await createDraft(db, owner);
    await publish(db, owner, admin, projectId);
    await asUser(db, owner, `insert into public.blocks (blocked_id) values ($1)`, [blocked]);
    await assert.rejects(apply(blocked, projectId), /not accepting applications/);

    // The blocked person can't see the block.
    const { rows } = await asUser(db, blocked, `select * from public.blocks`);
    assert.equal(rows.length, 0);

    await asUser(db, owner, `delete from public.blocks where blocked_id = $1`, [blocked]);
    await apply(blocked, projectId);
  });

  test("you can only block as yourself, and not yourself", async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    await assert.rejects(
      asUser(db, a, `insert into public.blocks (blocker_id, blocked_id) values ($1, $2)`, [b, a]),
      /permission denied/,
    );
    await assert.rejects(
      asUser(db, a, `insert into public.blocks (blocked_id) values ($1)`, [a]),
      /blocks_not_self/,
    );
  });
});

describe("reports and moderation", () => {
  const report = (userId, target, reason = "scam") =>
    asUser(
      db,
      userId,
      `insert into public.reports (profile_id, project_id, reason, details)
       values ($1, $2, $3, 'Asked for a deposit up front') returning id`,
      [target.profileId ?? null, target.projectId ?? null, reason],
    );

  test("one open report per target, never yourself, private to the reporter", async () => {
    const owner = await createUser(db);
    const reporter = await createUser(db);
    const projectId = await createDraft(db, owner);
    await report(reporter, { projectId });
    await assert.rejects(report(reporter, { projectId }), /reports_one_open_per_target/);
    await assert.rejects(report(owner, { projectId }), /can't report yourself/);
    await assert.rejects(report(owner, { profileId: owner }), /can't report yourself/);
    await assert.rejects(report(reporter, { profileId: owner, projectId }), /reports_one_target/);
    await assert.rejects(
      asUser(
        db,
        reporter,
        `insert into public.reports (project_id, reason, status) values ($1, 'spam', 'dismissed')`,
        [projectId],
      ),
      /permission denied/,
    );
    const { rows } = await asUser(db, owner, `select id from public.reports`);
    assert.equal(rows.length, 0, "the reported person can't see reports");
  });

  test("only admins resolve; actioning a listing sends it back for changes", async () => {
    const owner = await createUser(db);
    const reporters = [await createUser(db), await createUser(db)];
    const projectId = await createDraft(db, owner);
    await publish(db, owner, admin, projectId);
    const {
      rows: [first],
    } = await report(reporters[0], { projectId });
    await report(reporters[1], { projectId }, "misleading");

    const resolve = (actor, action, note) =>
      asService(db, `select public.svc_resolve_report($1, $2, $3, $4)`, [
        actor,
        first.id,
        action,
        note,
      ]);
    await assert.rejects(resolve(owner, true, "nope"), /Only reviewers/);
    await assert.rejects(resolve(admin, true, ""), /what to change/);
    await resolve(admin, true, "Remove the request for an up-front deposit.");

    const {
      rows: [listing],
    } = await db.query(`select status, review_note from public.projects where id = $1`, [
      projectId,
    ]);
    assert.equal(listing.status, "changes_requested");
    const { rows: open } = await db.query(
      `select id from public.reports where project_id = $1 and status = 'open'`,
      [projectId],
    );
    assert.equal(open.length, 0, "every open report on the target is closed together");
    await assert.rejects(resolve(admin, false, null), /already been handled/);
    const kinds = (
      await asUser(db, owner, `select kind from public.activity where project_id = $1`, [projectId])
    ).rows.map((row) => row.kind);
    assert.ok(kinds.includes("listing_changes_requested"));
  });
});

describe("availability freshness", () => {
  test("stale profiles drop out of counts until confirmed; only real changes renew", async () => {
    const tag = randomUUID().replace(/[\d-]/g, "").slice(0, 8);
    const pro = await createUser(db);
    const {
      rows: [skill],
    } = await db.query(`insert into public.skills (name) values ($1) returning id`, [`Zig ${tag}`]);
    await db.query(`insert into public.profile_skills (profile_id, skill_id) values ($1, $2)`, [
      pro,
      skill.id,
    ]);
    const viewer = await createUser(db);
    const count = async () =>
      (
        await asUser(db, viewer, `select public.count_professionals_for($1, 'paid') as n`, [
          [`Zig ${tag}`],
        ])
      ).rows[0].n;
    assert.equal(await count(), 1);

    // Backdate past 30 days (the trigger would otherwise keep the old value).
    await db.query(`alter table public.profiles disable trigger profiles_refresh_availability`);
    await db.query(
      `update public.profiles set availability_confirmed_at = now() - interval '40 days' where id = $1`,
      [pro],
    );
    await db.query(`alter table public.profiles enable trigger profiles_refresh_availability`);
    assert.equal(await count(), 0, "stale");

    // Editing your headline doesn't count as confirming.
    await asUser(db, pro, `update public.profiles set headline = 'Still here' where id = $1`, [
      pro,
    ]);
    assert.equal(await count(), 0);
    // Nor can you write the timestamp yourself.
    await assert.rejects(
      asUser(
        db,
        pro,
        `update public.profiles set availability_confirmed_at = now() where id = $1`,
        [pro],
      ),
      /permission denied/,
    );

    await asUser(db, pro, `select public.confirm_availability()`);
    assert.equal(await count(), 1, "confirmed");
  });
});
