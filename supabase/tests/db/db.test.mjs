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

// Contact-rule violations: SQLSTATE 23514 with the user-facing message and
// HINT CONTACT_DETAILS (the Edge Function error mapper keys on these).
const CONTACT_RULE = {
  code: "23514",
  hint: "CONTACT_DETAILS",
  detail: /^no_contact: /,
  message:
    /^Leave out emails, phone numbers and links. Contact details are shared automatically once you both accept.$/,
};

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
    } = await db.query(
      `insert into public.skills (name) values ('Open banking APIs') returning id`,
    );
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
    await assert.rejects(write(member, "Too short"), {
      code: "22023",
      message: /at least 20 characters/,
    });
    // Invisible characters and Unicode spaces don't count (red team F13).
    await assert.rejects(write(member, "​".repeat(25)), /at least 20 characters/);
    await assert.rejects(write(member, "  　".repeat(10)), /at least 20 characters/);
    await assert.rejects(
      write(member, "Great founder, reach them at founder@example.com any time."),
      CONTACT_RULE,
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
      await assert.rejects(insert(leak), CONTACT_RULE, leak);
    }
    // Ordinary numbers and tech names with dots are fine.
    await insert("We have 14 clinics, £1,800 MRR, built with Node.js in 2024-2025.");
  });

  test("common workarounds are caught; ordinary text isn't (same cases as lib/validation)", async () => {
    const check = async (text) =>
      (await db.query(`select private.has_contact_details($1) as hit`, [text])).rows[0].hit;
    for (const leak of [
      "john @ gmail.com",
      "message john@gmail",
      "linkedin.com/in/johnsmith",
      "t.me/johnsmith",
      "calendly.com/john",
      "john (at) gmail (dot) com",
      "john at gmail dot com",
      "０７７００９００１２３",
    ]) {
      assert.equal(await check(leak), true, leak);
    }
    for (const fine of [
      "Next.js and Vue.js experience preferred",
      "Product lead @ Monzo, previously at Google",
      "ASP.NET/C# developer",
      "React + TypeScript (at least 3 years)",
      "12% equity, 4-year vest, 1-year cliff",
    ]) {
      assert.equal(await check(fine), false, fine);
    }
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
      CONTACT_RULE,
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
      CONTACT_RULE,
    );
    await assert.rejects(updateProfile("location", "Call +44 7700 900123"), CONTACT_RULE);
    await assert.rejects(updateProfile("full_name", "Sam www.sam.dev"), CONTACT_RULE);
    const projectId = await createDraft(db, owner);
    await assert.rejects(
      asUser(db, owner, `update public.projects set duration = $2 where id = $1`, [
        projectId,
        "See https://x.io/brief",
      ]),
      CONTACT_RULE,
    );
    await publish(db, owner, admin, projectId);
    const appId = await apply(applicant, projectId);
    await assert.rejects(
      asService(db, `select public.svc_decide_application($1, $2, false, $3)`, [
        owner,
        appId,
        "Email me: o@x.com",
      ]),
      CONTACT_RULE,
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
    await assert.rejects(add("Hire me: me@example.com"), CONTACT_RULE);
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
      for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE"]) {
        assert.equal(await has("anon", relname, privilege), false, `anon ${privilege} ${relname}`);
      }
      assert.equal(await has("authenticated", relname, "TRUNCATE"), false, `TRUNCATE ${relname}`);
    }
    // Writes to these go through column grants, triggers or Edge Functions only.
    for (const table of [
      "projects",
      "applications",
      "profiles",
      "skills",
      "subscriptions",
      "blocks",
      "reports",
      "application_questions",
      "work_references",
      "activity",
      "admins",
      "project_memberships",
      "project_outcomes",
      "application_status_history",
      "legal_acceptances",
      "deal_sheets",
      "payment_reports",
    ]) {
      for (const privilege of ["INSERT", "UPDATE"]) {
        assert.equal(await has("authenticated", table, privilege), false, `${privilege} ${table}`);
      }
    }
    // Nobody deletes these from the client: decisions, track records,
    // references and the moderation trail must outlive second thoughts.
    for (const table of [
      "applications",
      "profiles",
      "skills",
      "subscriptions",
      "reports",
      "application_questions",
      "work_references",
      "activity",
      "admins",
      "project_memberships",
      "project_outcomes",
      "application_status_history",
      "legal_acceptances",
      "deal_sheets",
      "payment_reports",
    ]) {
      assert.equal(await has("authenticated", table, "DELETE"), false, `DELETE ${table}`);
    }
    // The Edge Functions read subscriptions directly.
    assert.equal(await has("service_role", "subscriptions", "SELECT"), true);
  });

  test("column-level write grants on protected tables are exactly the intended ones", async () => {
    // has_table_privilege ignores column grants, so a migration adding e.g.
    // grant update (plan, status) on subscriptions would pass the test above.
    const expected = {
      "applications INSERT": ["cover_note", "project_id"],
      "blocks INSERT": ["blocked_id"],
      "reports INSERT": ["details", "profile_id", "project_id", "reason"],
      "activity UPDATE": ["read_at"],
      "skills INSERT": ["name"],
      "projects INSERT": [
        "commitment",
        "compensation_max",
        "compensation_min",
        "compensation_type",
        "currency",
        "duration",
        "location",
        "opportunity_type",
        "public_summary",
        "remote_pref",
        "title",
      ],
      "profiles INSERT": [
        "availability",
        "avatar_url",
        "bio",
        "current_title",
        "experience_level",
        "full_name",
        "headline",
        "id",
        "location",
        "portfolio_url",
        "remote_pref",
        "seeking_paid",
        "seeking_partner",
        "wants_to_hire",
      ],
      "profiles UPDATE": [
        "availability",
        "avatar_url",
        "bio",
        "current_title",
        "experience_level",
        "full_name",
        "headline",
        "location",
        "portfolio_url",
        "remote_pref",
        "seeking_paid",
        "seeking_partner",
        "wants_to_hire",
      ],
    };
    expected["projects UPDATE"] = expected["projects INSERT"];
    const { rows } = await db.query(
      `select table_name || ' ' || privilege_type as k, array_agg(column_name::text order by column_name) as cols
       from information_schema.column_privileges
       where table_schema = 'public' and grantee in ('authenticated', 'anon')
         and privilege_type in ('INSERT', 'UPDATE')
         and table_name = any ($1)
       group by 1`,
      [
        [
          "projects",
          "applications",
          "profiles",
          "skills",
          "subscriptions",
          "blocks",
          "reports",
          "application_questions",
          "work_references",
          "activity",
          "admins",
          "project_memberships",
          "project_outcomes",
          "application_status_history",
          "legal_acceptances",
          "deal_sheets",
          "payment_reports",
        ],
      ],
    );
    assert.deepEqual(Object.fromEntries(rows.map((r) => [r.k, r.cols])), expected);
  });

  test("moderation and creator columns aren't readable by signed-in users", async () => {
    const readable = async (table, column) =>
      (
        await db.query(`select has_column_privilege('authenticated', $1, $2, 'SELECT') as ok`, [
          `public.${table}`,
          column,
        ])
      ).rows[0].ok;
    assert.equal(await readable("reports", "resolved_by"), false);
    assert.equal(await readable("reports", "resolved_at"), false);
    assert.equal(await readable("skills", "created_by"), false);
    assert.equal(await readable("reports", "target_kind"), true);
    assert.equal(await readable("skills", "name"), true);
  });

  test("an application can exist only once per listing while live (unique index)", async () => {
    const { rows } = await db.query(
      `select indexdef from pg_indexes where schemaname = 'public' and indexname = 'applications_one_live_idx'`,
    );
    assert.match(rows[0]?.indexdef ?? "", /UNIQUE.*(project_id, applicant_id)/);
  });

  test("every listing column is readable except the reviewer's note", async () => {
    // projects uses column-level SELECT grants (20261105110000). A new column
    // must be added to that grant, or the app's selects will start failing.
    const { rows } = await db.query(
      `select column_name,
              has_column_privilege('authenticated', 'public.projects', column_name, 'SELECT') as ok
       from information_schema.columns
       where table_schema = 'public' and table_name = 'projects'`,
    );
    for (const { column_name, ok } of rows) {
      assert.equal(ok, column_name !== "review_note", `SELECT projects.${column_name}`);
    }
  });

  test("service-only wrappers are not callable by signed-in users", async () => {
    const { rows } = await db.query(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and left(p.proname, 4) = 'svc_'
         and has_function_privilege('authenticated', p.oid, 'execute')`,
    );
    assert.deepEqual(rows, []);
  });

  test("signed-out visitors can't call any public function or use any sequence", async () => {
    // The hosted project auto-grants new public functions to anon (the
    // harness mirrors it), so every migration has to revoke explicitly.
    const { rows: functions } = await db.query(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
       order by 1`,
    );
    assert.deepEqual(functions, []);
    const { rows: sequences } = await db.query(
      // offset 0 keeps the planner from running the privilege check on
      // non-sequences before the relkind filter.
      `select relname from (
         select c.oid, c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'S' offset 0
       ) s where has_sequence_privilege('anon', s.oid, 'usage')`,
    );
    assert.deepEqual(sequences, []);
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
    for (let i = 0; i < 3; i++) await upload();
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
      CONTACT_RULE,
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

  test("you can only report a listing you can see", async () => {
    const owner = await createUser(db);
    const reporter = await createUser(db);
    const draft = await createDraft(db, owner);
    await assert.rejects(report(reporter, { projectId: draft }), /Listing not found/);
    await assert.rejects(report(reporter, { projectId: randomUUID() }), /Listing not found/);
  });

  test("one open report per target, never yourself, private to the reporter", async () => {
    const owner = await createUser(db);
    const reporter = await createUser(db);
    const projectId = await createDraft(db, owner);
    await publish(db, owner, admin, projectId);
    await report(reporter, { projectId });
    await assert.rejects(report(reporter, { projectId }), /reports_one_open_per_target/);
    await assert.rejects(report(owner, { projectId }), /can't report yourself/);
    await assert.rejects(report(owner, { profileId: owner }), /can't report yourself/);
    await assert.rejects(
      report(reporter, { profileId: owner, projectId }),
      /Choose one profile or one listing/,
    );
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

  test("the reviewer's note is for the owner, not for applicants", async () => {
    const owner = await createUser(db);
    const applicant = await createUser(db);
    const reporter = await createUser(db);
    const projectId = await createDraft(db, owner);
    await publish(db, owner, admin, projectId);
    await apply(applicant, projectId);
    const {
      rows: [filed],
    } = await report(reporter, { projectId });
    await asService(db, `select public.svc_resolve_report($1, $2, true, $3)`, [
      admin,
      filed.id,
      "Reported as a scam; remove the deposit request.",
    ]);

    await assert.rejects(
      asUser(db, applicant, `select review_note from public.projects where id = $1`, [projectId]),
      /permission denied/,
    );
    const note = (who) =>
      asUser(db, who, `select public.get_review_note($1) as note`, [projectId]).then(
        (result) => result.rows[0].note,
      );
    assert.equal(await note(applicant), null);
    assert.equal(await note(owner), "Reported as a scam; remove the deposit request.");
    assert.equal(await note(admin), "Reported as a scam; remove the deposit request.");
    // Everything else on the listing stays readable to the applicant.
    const { rows } = await asUser(
      db,
      applicant,
      `select status from public.projects where id = $1`,
      [projectId],
    );
    assert.equal(rows[0].status, "changes_requested");
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

// ---------------------------------------------------------------------------
// Launch hardening (20261105110000 + 20261105120000)
// ---------------------------------------------------------------------------

async function publishedListing(owner) {
  const projectId = await createDraft(db, owner);
  await publish(db, owner, admin, projectId);
  return projectId;
}

async function acceptedPair() {
  const owner = await createUser(db);
  const member = await createUser(db);
  const projectId = await publishedListing(owner);
  const appId = await apply(member, projectId);
  await asService(db, `select public.svc_decide_application($1, $2, true, null)`, [owner, appId]);
  const {
    rows: [m],
  } = await db.query(
    `update public.project_memberships set joined_at = now() - interval '30 days'
     where application_id = $1 returning id`,
    [appId],
  );
  return { owner, member, projectId, appId, membershipId: m.id };
}

describe("contact rule: normalisation and false positives", () => {
  const check = async (text) =>
    (await db.query(`select private.has_contact_details($1) as hit`, [text])).rows[0].hit;

  test("invisible, look-alike and non-ASCII tricks are caught", async () => {
    for (const leak of [
      "john​@gmail.com",
      "john@​gmail.com",
      "john@my​domain.co.uk",
      "ht‍tps://example.com",
      "w­ww.example.com",
      "linked⁠in.com/in/john",
      "077​00 900 123",
      "٠٧٧٠٠٩٠٠١٢٣",
      "०७७००९००१२३",
      "07700•900•123",
      "0770/090/0123",
      "0770,090,0123",
      "07700–900123",
      "+44 (0) 7700 900123",
      "0044 7700 900123",
      "john@gmail。com",
      "john@gmail.cоm",
      "bit.ly/abc123",
      "lnkd.in/abc",
      "github.com/johnsmith",
      "john (at) gmail (dot) com",
      "gmail (dot) com",
    ]) {
      assert.equal(await check(leak), true, JSON.stringify(leak));
    }
  });

  test("year ranges, dates, numbers and ordinary phrases pass", async () => {
    for (const fine of [
      "2015-2019 2020-2024",
      "Grew MRR 2018-2019 2020-2021",
      "Contract runs 2024 - 2025 (12 months)",
      "Scale from 10 000 - 50 000 users",
      "Dates 01.02.2025 - 30.06.2025",
      "I started out in the dot com boom",
      "Worked at Amazon (AT) scale",
      "Previously at x.org",
      "React + TypeScript (at least 3 years)",
      "Node.js, Next.js and ASP.NET",
      "C++20 since 2020",
      "Москва, работа в офисе",
    ]) {
      assert.equal(await check(fine), false, fine);
    }
  });

  test("rows written under an older rule stay updatable on other columns", async () => {
    const owner = await createUser(db);
    const applicant = await createUser(db);
    const projectId = await publishedListing(owner);
    // Seed legacy content by bypassing the triggers, as the old rule allowed it.
    await db.exec(`alter table public.profiles disable trigger profiles_contact_rule;
                   alter table public.applications disable trigger applications_contact_rule;
                   alter table public.projects disable trigger projects_contact_rule`);
    let appId;
    try {
      await db.query(
        `update public.profiles set bio = 'Find me at linkedin.com/in/legacy' where id = $1`,
        [applicant],
      );
      await db.query(`update public.projects set public_summary = $2 where id = $1`, [
        projectId,
        "Legacy summary - reach us on john@example.com for the brief.",
      ]);
      appId = await apply(applicant, projectId);
      await db.query(`update public.applications set cover_note = $2 where id = $1`, [
        appId,
        "Legacy cover note, see linkedin.com/in/legacy for my work.",
      ]);
    } finally {
      await db.exec(`alter table public.profiles enable trigger profiles_contact_rule;
                     alter table public.applications enable trigger applications_contact_rule;
                     alter table public.projects enable trigger projects_contact_rule`);
    }

    // Other columns, status changes and flags all still work.
    await asUser(
      db,
      applicant,
      `update public.profiles set headline = 'Still here' where id = $1`,
      [applicant],
    );
    await asUser(db, applicant, `select public.confirm_availability()`);
    await asService(db, `select public.svc_set_listing_status($1, $2, 'paused')`, [
      owner,
      projectId,
    ]);
    await asService(
      db,
      `select public.svc_apply_subscription($1, 'pro', 'active', null, null, null)`,
      [owner],
    );
    await asService(db, `select public.svc_set_listing_status($1, $2, 'completed')`, [
      owner,
      projectId,
    ]);
    const {
      rows: [app],
    } = await db.query(`select status from public.applications where id = $1`, [appId]);
    assert.equal(
      app.status,
      "rejected",
      "closing the listing still turns the legacy applicant away",
    );
    // Changing the guarded text itself is checked.
    await assert.rejects(
      asUser(
        db,
        applicant,
        `update public.profiles set bio = 'Now at x.com/legacy' where id = $1`,
        [applicant],
      ),
      CONTACT_RULE,
    );
  });

  test("questions and answers are checked separately", async () => {
    const owner = await createUser(db);
    const applicant = await createUser(db);
    const projectId = await publishedListing(owner);
    const appId = await apply(applicant, projectId);
    await db.exec(
      `alter table public.application_questions disable trigger application_questions_contact_rule`,
    );
    let legacy;
    try {
      legacy = (
        await db.query(
          `insert into public.application_questions (application_id, question)
           values ($1, 'Legacy question, call 07700 900123') returning id`,
          [appId],
        )
      ).rows[0];
    } finally {
      await db.exec(
        `alter table public.application_questions enable trigger application_questions_contact_rule`,
      );
    }
    await asService(
      db,
      `select public.svc_answer_question($1, $2, 'Happy to talk here instead.')`,
      [applicant, legacy.id],
    );
    const {
      rows: [second],
    } = await db.query(
      `insert into public.application_questions (application_id, question)
       values ($1, 'Second question?') returning id`,
      [appId],
    );
    await assert.rejects(
      asService(db, `select public.svc_answer_question($1, $2, 'Mail me: me@example.com')`, [
        applicant,
        second.id,
      ]),
      CONTACT_RULE,
    );
  });
});

describe("blank text and array caps", () => {
  test("blank or invisible questions and answers are refused", async () => {
    const owner = await createUser(db);
    const applicant = await createUser(db);
    const projectId = await publishedListing(owner);
    const appId = await apply(applicant, projectId);
    const ask = (text) =>
      asService(db, `select public.svc_ask_question($1, $2, $3)`, [owner, appId, text]);
    await assert.rejects(ask("\n\n\n\n\n"), { code: "22023" });
    await assert.rejects(ask("​​​​​​"), { code: "22023" });
    await ask("  What did you build?  ");
    const {
      rows: [q],
    } = await db.query(
      `select id, question from public.application_questions where application_id = $1`,
      [appId],
    );
    assert.equal(q.question, "What did you build?", "stored trimmed");
    await assert.rejects(
      asService(db, `select public.svc_answer_question($1, $2, $3)`, [applicant, q.id, " "]),
      { code: "22023" },
    );
  });

  test("2-D arrays can't slip past the RPC caps", async () => {
    const user = await createUser(db);
    const grid = (rows, cols) =>
      `{${Array.from({ length: rows }, (_, r) => `{${Array.from({ length: cols }, (_, c) => `s${r}x${c}`).join(",")}}`).join(",")}}`;
    await assert.rejects(
      asUser(db, user, `select public.count_professionals_for($1::text[], 'paid')`, [grid(4, 5)]),
      /Too many skills/,
    );
    await assert.rejects(
      asUser(db, user, `select * from public.ensure_skills($1::text[])`, [grid(5, 5)]),
      /Too many skills/,
    );
  });
});

describe("blocks protect both sides", () => {
  test("a blocked owner can't decide, and contact details disappear", async () => {
    const { owner, member, appId } = await acceptedPair();
    const contact = async (who) =>
      (await asUser(db, who, `select * from public.get_application_contact($1)`, [appId])).rows;
    assert.equal((await contact(owner)).length, 1);
    await asUser(db, member, `insert into public.blocks (blocked_id) values ($1)`, [owner]);
    assert.equal((await contact(owner)).length, 0);
    assert.equal((await contact(member)).length, 0);

    const owner2 = await createUser(db);
    const applicant2 = await createUser(db);
    const p2 = await publishedListing(owner2);
    const app2 = await apply(applicant2, p2);
    await db.query(`insert into public.blocks (blocker_id, blocked_id) values ($1, $2)`, [
      owner2,
      applicant2,
    ]);
    // The block trigger withdrew it; put it back to pending to prove the
    // decide check stands on its own.
    await db.query(`update public.applications set status = 'submitted' where id = $1`, [app2]);
    for (const accept of [true, false]) {
      await assert.rejects(
        asService(db, `select public.svc_decide_application($1, $2, $3, null)`, [
          owner2,
          app2,
          accept,
        ]),
        { code: "P0002", message: /Application not found/ },
      );
    }
  });

  test("blocking withdraws pending applications in both directions", async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    const third = await createUser(db);
    const listingA = await publishedListing(a);
    const listingB = await publishedListing(b);
    const listingThird = await publishedListing(third);
    const aToB = await apply(a, listingB);
    const bToA = await apply(b, listingA);
    const aToThird = await apply(a, listingThird);
    await asUser(db, a, `insert into public.blocks (blocked_id) values ($1)`, [b]);
    const status = async (id) =>
      (await db.query(`select status from public.applications where id = $1`, [id])).rows[0].status;
    assert.equal(await status(aToB), "withdrawn");
    assert.equal(await status(bToA), "withdrawn");
    assert.equal(await status(aToThird), "submitted", "unrelated applications are untouched");
    const { rows: history } = await db.query(
      `select application_id, changed_by from public.application_status_history
       where application_id = any($1) and to_status = 'withdrawn'`,
      [[aToB, bToA]],
    );
    assert.equal(history.length, 2);
    assert.equal(history.find((h) => h.application_id === aToB).changed_by, a);
    assert.equal(history.find((h) => h.application_id === bToA).changed_by, null);
  });
});

describe("re-applying and the live-listing limit", () => {
  test("no re-applying after a rejection; allowed after withdrawal or a listing close", async () => {
    const owner = await createUser(db);
    const applicant = await createUser(db);
    const projectId = await publishedListing(owner);
    const first = await apply(applicant, projectId);
    await assert.rejects(apply(applicant, projectId), /already applied/);
    await asService(db, `select public.svc_withdraw_application($1, $2)`, [applicant, first]);
    const second = await apply(applicant, projectId);
    await asService(db, `select public.svc_decide_application($1, $2, false, null)`, [
      owner,
      second,
    ]);
    await assert.rejects(apply(applicant, projectId), {
      code: "P0001",
      message: /can't apply to this listing again/,
    });

    const other = await createUser(db);
    const closedOnce = await apply(other, projectId);
    await asService(db, `select public.svc_set_listing_status($1, $2, 'completed')`, [
      owner,
      projectId,
    ]);
    const {
      rows: [closed],
    } = await db.query(`select closed_by_listing from public.applications where id = $1`, [
      closedOnce,
    ]);
    assert.equal(closed.closed_by_listing, true);
    await db.query(`update public.projects set status = 'published' where id = $1`, [projectId]);
    await apply(other, projectId);
  });

  test("resuming a paused listing re-checks the plan limit", async () => {
    const owner = await createUser(db);
    const plan = (p, s) =>
      asService(db, `select public.svc_apply_subscription($1, $2, $3, null, null, null)`, [
        owner,
        p,
        s,
      ]);
    await plan("pro", "active");
    const a = await publishedListing(owner);
    const b = await publishedListing(owner);
    await plan("free", "canceled");
    await asService(db, `select public.svc_set_listing_status($1, $2, 'paused')`, [owner, b]);
    await assert.rejects(
      asService(db, `select public.svc_set_listing_status($1, $2, 'published')`, [owner, b]),
      /LISTING_LIMIT/,
    );
    await asService(db, `select public.svc_set_listing_status($1, $2, 'completed')`, [owner, a]);
    await asService(db, `select public.svc_set_listing_status($1, $2, 'published')`, [owner, b]);
  });
});

describe("activity can't be flooded", () => {
  const record = (actor, membershipId, outcome) =>
    asService(db, `select public.svc_record_outcome($1, $2, $3, null)`, [
      actor,
      membershipId,
      outcome,
    ]);
  const unread = async (userId, membershipId) =>
    (
      await db.query(
        `select kind from public.activity where user_id = $1 and membership_id = $2 and read_at is null`,
        [userId, membershipId],
      )
    ).rows.map((r) => r.kind);
  const outcomeRow = async (membershipId) =>
    (
      await db.query(`select * from public.project_outcomes where membership_id = $1`, [
        membershipId,
      ])
    ).rows;

  test("repeating or flip-flopping an outcome leaves one unread row", async () => {
    const { owner, member, membershipId } = await acceptedPair();
    for (let i = 0; i < 5; i++) await record(member, membershipId, "abandoned");
    assert.deepEqual(await unread(owner, membershipId), ["outcome_to_confirm"]);
    const before = await outcomeRow(membershipId);
    await record(member, membershipId, "abandoned");
    assert.deepEqual(await outcomeRow(membershipId), before, "a repeat doesn't touch the row");

    for (let i = 0; i < 4; i++) {
      await record(member, membershipId, i % 2 ? "abandoned" : "completed");
    }
    assert.deepEqual(await unread(owner, membershipId), ["outcome_to_confirm"]);

    // Once read, the next change is news again.
    await asUser(db, owner, `update public.activity set read_at = now() where user_id = $1`, [
      owner,
    ]);
    await record(member, membershipId, "completed");
    assert.deepEqual(await unread(owner, membershipId), ["outcome_to_confirm"]);
  });
});

describe("reports survive account deletion, anonymised", () => {
  test("deleting reporter and reported accounts keeps the anonymised reports", async () => {
    const reporter = await createUser(db);
    const target = await createUser(db);
    const otherReporter = await createUser(db);
    const targetListing = await publishedListing(target);
    const report = async (who, column, id) =>
      (
        await asUser(
          db,
          who,
          `insert into public.reports (${column}, reason) values ($1, 'scam') returning id`,
          [id],
        )
      ).rows[0].id;
    const aboutProfile = await report(reporter, "profile_id", target);
    const aboutListing = await report(otherReporter, "project_id", targetListing);
    // The target reported someone too: reports on both sides.
    const byTarget = await report(target, "profile_id", reporter);

    // Reporters never see who resolved their report.
    await assert.rejects(
      asUser(db, reporter, `select resolved_by from public.reports where id = $1`, [aboutProfile]),
      /permission denied/,
    );

    await db.query(`delete from auth.users where id = any($1)`, [[target, reporter]]);
    const { rows } = await db.query(
      `select id, reporter_id, profile_id, project_id, target_kind, reason from public.reports
       where id = any($1)`,
      [[aboutProfile, aboutListing, byTarget]],
    );
    assert.equal(rows.length, 3, "nothing cascaded away");
    for (const row of rows) {
      assert.equal(row.profile_id, null);
      assert.equal(row.project_id, null);
      assert.equal(row.reason, "scam");
    }
    assert.deepEqual(rows.map((r) => r.target_kind).sort(), ["profile", "profile", "project"]);
    assert.equal(rows.find((r) => r.id === byTarget).reporter_id, null);

    // The surviving reporter still sees their report; nobody else sees orphans.
    const stranger = await createUser(db);
    assert.equal((await asUser(db, stranger, `select id from public.reports`)).rows.length, 0);
    assert.equal((await asUser(db, otherReporter, `select id from public.reports`)).rows.length, 1);

    // An orphaned report can still be closed by id.
    await asService(db, `select public.svc_resolve_report($1, $2, false, null)`, [
      admin,
      aboutProfile,
    ]);
    const {
      rows: [closed],
    } = await db.query(`select status from public.reports where id = $1`, [aboutProfile]);
    assert.equal(closed.status, "dismissed");
  });

  test("a report needs exactly one target and target_kind isn't client-set", async () => {
    const reporter = await createUser(db);
    await assert.rejects(
      asUser(db, reporter, `insert into public.reports (reason) values ('spam')`),
      {
        code: "22023",
      },
    );
    const target = await createUser(db);
    await assert.rejects(
      asUser(
        db,
        reporter,
        `insert into public.reports (profile_id, reason, target_kind) values ($1, 'spam', 'project')`,
        [target],
      ),
      /permission denied/,
    );
  });
});

describe("storage limits and cleanup queue", () => {
  test("buckets cap files at 2 MB", async () => {
    const { rows } = await db.query(`select id, file_size_limit from storage.buckets order by id`);
    assert.equal(rows.length, 4);
    for (const row of rows) assert.equal(Number(row.file_size_limit), 2097152, row.id);
  });

  test("attachment uploads need a pending application with room left", async () => {
    const owner = await createUser(db);
    const applicant = await createUser(db);
    const projectId = await publishedListing(owner);
    const appId = await apply(applicant, projectId);
    const upload = () =>
      asUser(
        db,
        applicant,
        `insert into storage.objects (bucket_id, name) values ('application-attachments', $1)`,
        [`${applicant}/${randomUUID()}.jpg`],
      );
    for (let i = 0; i < 3; i++) {
      await upload();
      await asUser(
        db,
        applicant,
        `insert into public.application_attachments (application_id, storage_path) values ($1, $2)`,
        [appId, `${applicant}/${randomUUID()}.jpg`],
      );
    }
    await assert.rejects(upload(), /row-level security/, "the only pending application is full");
    await asService(db, `select public.svc_withdraw_application($1, $2)`, [applicant, appId]);
    await assert.rejects(upload(), /row-level security/, "no pending application");
  });

  test("unreferenced files are queued, leased and completed; live files never are", async () => {
    const user = await createUser(db);
    const [p1, p2, a1, a2] = Array.from({ length: 4 }, () => `${user}/${randomUUID()}.jpg`);
    await asUser(db, user, `insert into public.portfolio_images (storage_path) values ($1), ($2)`, [
      p1,
      p2,
    ]);
    await asUser(db, user, `delete from public.portfolio_images where storage_path = $1`, [p1]);
    for (const path of [a1, a2, a1]) {
      await asUser(db, user, `update public.profiles set avatar_url = $2 where id = $1`, [
        user,
        path,
      ]);
    }

    await assert.rejects(
      asUser(db, user, `select * from private.storage_cleanup`),
      /permission denied/,
    );
    await assert.rejects(
      asUser(db, user, `select * from public.svc_claim_storage_cleanup(10)`),
      /permission denied/,
    );

    const claim = async () =>
      (await asService(db, `select * from public.svc_claim_storage_cleanup(1000)`)).rows.filter(
        (r) => r.path.startsWith(user),
      );
    assert.equal((await claim()).length, 0, "nothing is claimed inside the 10-minute grace period");
    await db.query(
      `update private.storage_cleanup set queued_at = now() - interval '11 minutes'
       where path like $1 || '/%'`,
      [user],
    );
    const mine = await claim();
    assert.deepEqual(
      mine.map((r) => `${r.bucket}:${r.path}`).sort(),
      [`avatars:${a2}`, `portfolio:${p1}`].sort(),
      "a1 is in use again, so it was dropped from the queue",
    );
    assert.equal((await claim()).length, 0, "claimed rows are leased");

    // An expired lease comes back.
    await db.query(
      `update private.storage_cleanup set claimed_at = now() - interval '16 minutes' where path = $1`,
      [p1],
    );
    assert.deepEqual(
      (await claim()).map((r) => r.path),
      [p1],
    );
    await asService(db, `select public.svc_complete_storage_cleanup($1)`, [mine.map((r) => r.id)]);
    const { rows: left } = await db.query(
      `select path from private.storage_cleanup where path like $1`,
      [`${user}/%`],
    );
    assert.deepEqual(left, []);
  });
});

describe("legal acceptances", () => {
  const meta = { terms_version: "2026-11-06", privacy_version: "2026-11-06", age_confirmed: true };
  const rowsFor = async (userId) =>
    (
      await db.query(
        `select document, version from public.legal_acceptances where user_id = $1 order by document`,
        [userId],
      )
    ).rows;

  test("sign-up metadata records terms, privacy and 18+", async () => {
    const user = await createUser(db, { meta });
    assert.deepEqual(await rowsFor(user), [
      { document: "age_18", version: "18+" },
      { document: "privacy", version: "2026-11-06" },
      { document: "terms", version: "2026-11-06" },
    ]);
    // Later metadata edits (client-writable) don't touch the record.
    await db.query(`update auth.users set raw_user_meta_data = $2 where id = $1`, [
      user,
      { terms_version: "9999" },
    ]);
    assert.equal((await rowsFor(user)).length, 3);
  });

  test("bad or missing metadata never breaks sign-up", async () => {
    for (const bad of [
      null,
      "nonsense",
      { terms_version: "x".repeat(500), age_confirmed: "yes" },
      [1, 2],
    ]) {
      const user = await createUser(db, { meta: bad === null ? null : JSON.stringify(bad) });
      assert.deepEqual(await rowsFor(user), [], JSON.stringify(bad));
    }
  });

  test("acceptance is recorded only for the caller, idempotently, and is private", async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    await asUser(db, a, `select public.record_legal_acceptance('2026-11-01', '2026-11-02')`);
    await asUser(db, a, `select public.record_legal_acceptance('2026-11-01', '2026-11-02')`);
    assert.equal((await rowsFor(a)).length, 3);
    assert.deepEqual((await asUser(db, a, `select * from public.get_my_legal_status()`)).rows[0], {
      terms_version: "2026-11-01",
      privacy_version: "2026-11-02",
    });
    assert.deepEqual((await asUser(db, b, `select * from public.get_my_legal_status()`)).rows[0], {
      terms_version: null,
      privacy_version: null,
    });
    assert.equal(
      (await asUser(db, b, `select id from public.legal_acceptances where user_id = $1`, [a])).rows
        .length,
      0,
    );
    await assert.rejects(
      asUser(
        db,
        b,
        `insert into public.legal_acceptances (user_id, document, version) values ($1, 'terms', 'v9')`,
        [a],
      ),
      /permission denied/,
    );
    await assert.rejects(
      asUser(db, a, `update public.legal_acceptances set accepted_at = now() - interval '1 year'`),
      /permission denied/,
    );
    await assert.rejects(
      asUser(db, a, `delete from public.legal_acceptances`),
      /permission denied/,
    );
    await assert.rejects(asUser(db, a, `select public.record_legal_acceptance('', 'v3')`), {
      code: "22023",
    });
    // A made-up future version can't pre-satisfy later re-acceptance checks.
    await assert.rejects(
      asUser(db, a, `select public.record_legal_acceptance('9999-12-31', '9999-12-31')`),
      { code: "22023" },
    );
    await assert.rejects(asUser(db, a, `select public.record_legal_acceptance('v2', 'v3')`), {
      code: "22023",
    });
  });
});

describe("data export", () => {
  test("contains the caller's own data and nobody else's", async () => {
    const me = await createUser(db, {
      meta: { terms_version: "2026-10-01", privacy_version: "2026-10-02", age_confirmed: true },
    });
    const owner = await createUser(db);
    const rival = await createUser(db);
    const myListing = await publishedListing(me);
    const theirListing = await publishedListing(owner);
    await apply(me, theirListing);
    await apply(rival, theirListing);
    await apply(rival, myListing);
    await asUser(db, me, `insert into public.reports (profile_id, reason) values ($1, 'spam')`, [
      owner,
    ]);
    await asUser(db, rival, `insert into public.reports (profile_id, reason) values ($1, 'spam')`, [
      me,
    ]);
    await asUser(db, owner, `insert into public.blocks (blocked_id) values ($1)`, [me]);

    const {
      rows: [{ data }],
    } = await asUser(db, me, `select public.export_my_data() as data`);
    assert.equal(data.user_id, me);
    assert.equal(data.profile.id, me);
    assert.deepEqual(
      data.listings.map((l) => l.id),
      [myListing],
    );
    assert.deepEqual(data.listings[0].required_skills, ["React Native"]);
    assert.ok(data.applications.length === 1 && data.applications[0].applicant_id === me);
    assert.deepEqual(
      data.reports_filed.map((r) => r.profile_id),
      [owner],
      "only reports I filed, never reports about me",
    );
    assert.deepEqual(data.blocks, [], "blocks against me aren't revealed");
    assert.equal(data.legal_acceptances.length, 3);
    assert.ok(!JSON.stringify(data).includes("@example.com"), "no emails at all");
    await assert.rejects(
      asService(db, `select public.export_my_data()`),
      /Sign in first|permission denied/,
    );
  });
});

describe("legal holds", () => {
  test("only the service role can check a hold, and a held account can't be deleted", async () => {
    const user = await createUser(db);
    const held = async () =>
      (await asService(db, `select public.svc_has_legal_hold($1) as held`, [user])).rows[0].held;
    assert.equal(await held(), false);
    await db.query(`insert into private.legal_holds (user_id, reason) values ($1, 'CSEA report')`, [
      user,
    ]);
    assert.equal(await held(), true);
    await assert.rejects(
      asUser(db, user, `select public.svc_has_legal_hold($1)`, [user]),
      /permission denied/,
    );
    await assert.rejects(db.query(`delete from auth.users where id = $1`, [user]), /legal_holds/);
  });
});

describe("retention", () => {
  // Own database: retention runs table-wide.
  let rdb;
  before(async () => {
    rdb = await createDb();
  });

  test("ages out the decided periods and never accepted collaborations", async () => {
    const reviewer = await createUser(rdb);
    await makeAdmin(rdb, reviewer);
    const owner = await createUser(rdb);
    const rejected = await createUser(rdb);
    const pending = await createUser(rdb);
    const accepted = await createUser(rdb);
    const projectId = await createDraft(rdb, owner);
    await publish(rdb, owner, reviewer, projectId);
    const applyAs = async (who) =>
      (
        await asUser(
          rdb,
          who,
          `insert into public.applications (project_id, cover_note)
           values ($1, 'I have shipped three React Native apps to production.') returning id`,
          [projectId],
        )
      ).rows[0].id;
    const rejectedApp = await applyAs(rejected);
    const pendingApp = await applyAs(pending);
    const acceptedApp = await applyAs(accepted);
    const attachment = `${rejected}/${randomUUID()}.jpg`;
    await rdb.query(
      `insert into public.application_attachments (application_id, storage_path) values ($1, $2)`,
      [rejectedApp, attachment],
    );
    const decide = (app, accept) =>
      asService(rdb, `select public.svc_decide_application($1, $2, $3, null)`, [
        owner,
        app,
        accept,
      ]);
    await decide(rejectedApp, false);
    await decide(acceptedApp, true);
    const {
      rows: [m],
    } = await rdb.query(
      `update public.project_memberships set joined_at = now() - interval '30 days'
       where application_id = $1 returning id`,
      [acceptedApp],
    );
    for (const who of [owner, accepted]) {
      await asService(rdb, `select public.svc_record_outcome($1, $2, 'completed', null)`, [
        who,
        m.id,
      ]);
    }
    const track = async () =>
      (await rdb.query(`select * from public.get_track_record($1)`, [accepted])).rows;
    const trackBefore = await track();
    assert.equal(trackBefore[0].completed, 1);

    const now = "(now() + interval '400 days')";
    await rdb.query(`delete from public.activity`);
    await rdb.query(
      `insert into public.activity (user_id, kind, created_at, read_at) values
         ($1, 'listing_published', ${now} - interval '200 days', ${now} - interval '181 days'),
         ($1, 'listing_published', ${now} - interval '200 days', ${now} - interval '179 days'),
         ($1, 'listing_published', ${now} - interval '366 days', null),
         ($1, 'listing_published', ${now} - interval '300 days', null)`,
      [owner],
    );
    const reportAt = async (status, resolvedAgo) => {
      const target = await createUser(rdb);
      const {
        rows: [r],
      } = await asUser(
        rdb,
        pending,
        `insert into public.reports (profile_id, reason) values ($1, 'other') returning id`,
        [target],
      );
      await rdb.query(
        `update public.reports set status = $2, resolved_at = ${now} - $3::interval where id = $1`,
        [r.id, status, resolvedAgo],
      );
      return r.id;
    };
    const oldActioned = await reportAt("actioned", "3 years 1 day");
    const newActioned = await reportAt("actioned", "2 years");
    const oldDismissed = await reportAt("dismissed", "13 months");
    const newDismissed = await reportAt("dismissed", "11 months");
    const {
      rows: [openReport],
    } = await asUser(
      rdb,
      pending,
      `insert into public.reports (profile_id, reason) values ($1, 'other') returning id`,
      [owner],
    );

    const run = async () =>
      (await rdb.query(`select private.apply_retention(${now}) as r`)).rows[0].r;
    assert.deepEqual(await run(), { activity: 2, applications: 1, reports: 2 });

    const ids = async (table, list) =>
      (await rdb.query(`select id from public.${table} where id = any($1)`, [list])).rows
        .map((r) => r.id)
        .sort();
    assert.deepEqual(
      await ids("applications", [rejectedApp, pendingApp, acceptedApp]),
      [pendingApp, acceptedApp].sort(),
    );
    assert.deepEqual(
      await ids("reports", [oldActioned, newActioned, oldDismissed, newDismissed, openReport.id]),
      [newActioned, newDismissed, openReport.id].sort(),
    );
    const { rows: queued } = await rdb.query(`select bucket, path from private.storage_cleanup`);
    assert.deepEqual(queued, [{ bucket: "application-attachments", path: attachment }]);
    assert.deepEqual(await track(), trackBefore, "track records are untouched");

    assert.deepEqual(await run(), { activity: 0, applications: 0, reports: 0 }, "idempotent");
    const { rows: svc } = await asService(rdb, `select public.svc_apply_retention() as r`);
    assert.ok(svc[0].r);
  });
});

describe("legal holds and retention", () => {
  test("retention keeps everything belonging to a user under a legal hold", async () => {
    const owner = await createUser(db);
    const held = await createUser(db);
    const projectId = await createDraft(db, owner);
    await publish(db, owner, admin, projectId);
    const appId = await apply(held, projectId);
    await asService(db, `select public.svc_withdraw_application($1, $2)`, [held, appId]);
    await db.query(
      `update public.applications set updated_at = now() - interval '2 years' where id = $1`,
      [appId],
    );
    await db.query(`insert into private.legal_holds (user_id, reason) values ($1, 'CSEA report')`, [
      held,
    ]);

    await db.query(`select private.apply_retention(now() + interval '2 years')`);
    const kept = await db.query(`select id from public.applications where id = $1`, [appId]);
    assert.equal(kept.rows.length, 1, "a held user's old withdrawn application is preserved");

    await db.query(`delete from private.legal_holds where user_id = $1`, [held]);
    await db.query(`select private.apply_retention(now() + interval '2 years')`);
    const gone = await db.query(`select id from public.applications where id = $1`, [appId]);
    assert.equal(gone.rows.length, 0, "once the hold is lifted, normal retention applies");
  });
});

// ---------------------------------------------------------------------------
// Deal Sheets and the pays-on-time record (20261107090000)
// ---------------------------------------------------------------------------

const SHEET = {
  scope: "Build the booking flow screens and the payment step in React Native.",
  pay_basis: "fixed",
  amount: 2400,
  currency: "GBP",
  payment_terms_days: 14,
  milestones: [],
  ip_terms: "client_owns_on_payment",
};

/** YYYY-MM-DD, days from today (UTC; tests stay a few days clear of UK midnight). */
function day(offset) {
  return new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
}

function milestone(offset, title = "Milestone") {
  return { title, due_date: day(offset), amount: 500 };
}

async function propose(actor, membershipId, sheet = {}, business = false) {
  const {
    rows: [row],
  } = await asService(db, `select public.svc_propose_deal($1, $2, $3, $4::jsonb) as id`, [
    actor,
    membershipId,
    business,
    JSON.stringify({ ...SHEET, ...sheet }),
  ]);
  return row.id;
}

function confirm(actor, dealId, version, business = false) {
  return asService(db, `select public.svc_confirm_deal($1, $2, $3, $4)`, [
    actor,
    dealId,
    version,
    business,
  ]);
}

async function reportPayment(actor, dealId, index, outcome, paidOn = null) {
  const {
    rows: [row],
  } = await asService(db, `select public.svc_report_payment($1, $2, $3, $4, $5) as id`, [
    actor,
    dealId,
    index,
    outcome,
    paidOn,
  ]);
  return row.id;
}

function disputePayment(actor, reportId, reason) {
  return asService(db, `select public.svc_dispute_payment($1, $2, $3)`, [actor, reportId, reason]);
}

function resolveDispute(actor, reportId, uphold, note = null) {
  return asService(db, `select public.svc_resolve_payment_dispute($1, $2, $3, $4)`, [
    actor,
    reportId,
    uphold,
    note,
  ]);
}

async function dealRow(id) {
  return (await db.query(`select * from public.deal_sheets where id = $1`, [id])).rows[0];
}

async function kinds(userId, membershipId) {
  const { rows } = await asUser(
    db,
    userId,
    `select kind from public.activity where membership_id = $1 order by kind`,
    [membershipId],
  );
  return rows.map((r) => r.kind);
}

/** An accepted pair whose professional account is old enough to count. */
async function agreedDeal(sheet = {}, { memberAgeDays = 30 } = {}) {
  const pair = await acceptedPair();
  await db.query(
    `update public.profiles set created_at = now() - make_interval(days => $2) where id = $1`,
    [pair.member, memberAgeDays],
  );
  const dealId = await propose(pair.owner, pair.membershipId, sheet);
  await confirm(pair.member, dealId, 1);
  return { ...pair, dealId };
}

async function partnerPair() {
  const owner = await createUser(db);
  const partner = await createUser(db);
  const projectId = await createDraft(db, owner, { type: "partner" });
  await publish(db, owner, admin, projectId);
  const appId = await apply(partner, projectId);
  await asService(db, `select public.svc_decide_application($1, $2, true, null)`, [owner, appId]);
  const {
    rows: [m],
  } = await db.query(`select id from public.project_memberships where application_id = $1`, [
    appId,
  ]);
  return { owner, partner, membershipId: m.id };
}

async function payRecord(ownerId, viewer = admin) {
  const { rows } = await asUser(db, viewer, `select * from public.get_pay_record($1)`, [ownerId]);
  return rows;
}

function inAnon(sql, params = []) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role anon`);
    return tx.query(sql, params);
  });
}

const DISPUTE_REASON = "We paid this by bank transfer on the due date.";

describe("deal sheets", () => {
  test("only the two parties read it, nobody writes it directly, outsiders can't propose", async () => {
    const { owner, member, membershipId } = await acceptedPair();
    const outsider = await createUser(db);
    const dealId = await propose(owner, membershipId);

    for (const [who, count] of [
      [owner, 1],
      [member, 1],
      [outsider, 0],
      [admin, 0],
    ]) {
      const { rows } = await asUser(db, who, `select id from public.deal_sheets where id = $1`, [
        dealId,
      ]);
      assert.equal(rows.length, count);
    }
    await assert.rejects(
      asUser(db, member, `update public.deal_sheets set amount = 1 where id = $1`, [dealId]),
      { code: "42501" },
    );
    await assert.rejects(
      asUser(
        db,
        owner,
        `insert into public.deal_sheets (membership_id, proposed_by, scope, pay_basis, ip_terms)
         values ($1, $2, 'Twenty characters of scope here', 'fixed', 'joint')`,
        [membershipId, owner],
      ),
      { code: "42501" },
    );
    await assert.rejects(propose(outsider, membershipId), { code: "P0002" });
    await assert.rejects(confirm(outsider, dealId, 1), { code: "P0002" });
    await assert.rejects(
      asUser(db, owner, `select public.svc_propose_deal($1, $2, false, '{}'::jsonb)`, [
        owner,
        membershipId,
      ]),
      { code: "42501" },
    );
  });

  test("a new version clears both confirmations; agreed only when both confirm the same one", async () => {
    const { owner, member, membershipId } = await acceptedPair();
    const dealId = await propose(owner, membershipId);
    let row = await dealRow(dealId);
    assert.equal(row.version, 1);
    assert.equal(row.owner_confirmed_version, 1);
    assert.equal(row.member_confirmed_version, null);
    assert.equal(row.agreed_at, null);
    assert.deepEqual(await kinds(member, membershipId), ["deal_proposed"]);
    assert.ok(!(await kinds(owner, membershipId)).includes("deal_proposed"));

    await confirm(member, dealId, 1, true);
    row = await dealRow(dealId);
    assert.notEqual(row.agreed_at, null);
    assert.equal(row.member_business, true);
    assert.ok((await kinds(owner, membershipId)).includes("deal_agreed"));
    assert.ok((await kinds(member, membershipId)).includes("deal_agreed"));
    // Changing the business flag after agreement needs a new version.
    await assert.rejects(confirm(member, dealId, 1, false), { code: "P0001" });

    // Any edit (even after agreement) bumps the version and clears both.
    await propose(member, membershipId, { amount: 2600 });
    row = await dealRow(dealId);
    assert.equal(row.version, 2);
    assert.equal(row.proposed_by, member);
    assert.equal(row.member_confirmed_version, 2);
    assert.equal(row.owner_confirmed_version, null);
    assert.equal(row.agreed_at, null);
    assert.ok((await kinds(owner, membershipId)).includes("deal_proposed"));

    await assert.rejects(confirm(owner, dealId, 1), { code: "P0001", message: /^DEAL_CHANGED: / });
    assert.equal((await dealRow(dealId)).agreed_at, null);
    await confirm(owner, dealId, 2, true);
    row = await dealRow(dealId);
    assert.notEqual(row.agreed_at, null);
    assert.equal(row.owner_business, true);
  });

  test("fields are checked: lengths, blanks, milestones, IP notes, partner-only equity", async () => {
    const { owner, membershipId } = await acceptedPair();
    const bad = [
      { scope: "Too short" },
      { scope: "​ ".repeat(30) },
      { scope: "x".repeat(2001) },
      { pay_basis: "barter" },
      { currency: "JPY" },
      { payment_terms_days: 121 },
      { amount: -1 },
      { amount: "lots" },
      { milestones: Array.from({ length: 13 }, () => milestone(10)) },
      { milestones: [{ title: "Design", due_date: "2026-02-30" }] },
      { milestones: [{ title: "Design", due_date: "next week" }] },
      { milestones: [{ title: "  ", due_date: day(10) }] },
      { ip_terms: "other" },
      { ip_notes: "n".repeat(501) },
      { equity_percent: 5 },
      { vesting_months: 48 },
    ];
    for (const sheet of bad) {
      await assert.rejects(
        propose(owner, membershipId, sheet),
        { code: "22023" },
        JSON.stringify(sheet),
      );
    }
    const { rows: none } = await db.query(
      `select id from public.deal_sheets where membership_id = $1`,
      [membershipId],
    );
    assert.equal(none.length, 0);

    const dealId = await propose(owner, membershipId, {
      milestones: [{ title: "  Design  ", dueDate: "ignored", due_date: day(10), amount: 1200 }],
      ip_terms: "other",
      ip_notes: "Creator keeps the component library.",
    });
    const row = await dealRow(dealId);
    assert.deepEqual(row.milestones, [{ title: "Design", due_date: day(10), amount: 1200 }]);

    // Partner collaborations can carry equity terms.
    const { partner, membershipId: partnerMembership } = await partnerPair();
    const equity = { pay_basis: "equity", amount: null, equity_percent: 10, vesting_months: 48 };
    await assert.rejects(propose(partner, partnerMembership, { ...equity, cliff_months: 60 }), {
      code: "22023",
    });
    const partnerDeal = await propose(partner, partnerMembership, { ...equity, cliff_months: 12 });
    assert.equal(Number((await dealRow(partnerDeal)).equity_percent), 10);
  });

  test("blocked pairs can't propose or confirm", async () => {
    const { owner, member, membershipId } = await acceptedPair();
    const dealId = await propose(owner, membershipId);
    await asUser(db, member, `insert into public.blocks (blocked_id) values ($1)`, [owner]);
    await assert.rejects(confirm(member, dealId, 1), { code: "P0002" });
    await assert.rejects(propose(owner, membershipId), { code: "P0002" });
  });
});

describe("payment reports", () => {
  test("professional only, agreed deals only, after the due date, one per milestone", async () => {
    const { owner, member, membershipId } = await acceptedPair();
    const outsider = await createUser(db);
    const dealId = await propose(owner, membershipId, {
      milestones: [milestone(-5, "Design"), milestone(5, "Build")],
    });
    await assert.rejects(reportPayment(member, dealId, 0, "on_time"), { code: "P0001" });
    await confirm(member, dealId, 1);

    await assert.rejects(reportPayment(owner, dealId, 0, "on_time"), { code: "42501" });
    await assert.rejects(reportPayment(outsider, dealId, 0, "on_time"), { code: "P0002" });
    await assert.rejects(reportPayment(member, dealId, 1, "unpaid"), {
      code: "P0001",
      message: /^NOT_DUE_YET: /,
    });
    await assert.rejects(reportPayment(member, dealId, null, "on_time"), { code: "22023" });
    await assert.rejects(reportPayment(member, dealId, 2, "on_time"), { code: "22023" });
    await assert.rejects(reportPayment(member, dealId, 0, "late"), { code: "22023" });
    await assert.rejects(reportPayment(member, dealId, 0, "late", day(-6)), { code: "22023" });
    await assert.rejects(reportPayment(member, dealId, 0, "on_time", day(-2)), { code: "22023" });
    await assert.rejects(reportPayment(member, dealId, 0, "unpaid", day(-6)), { code: "22023" });
    await assert.rejects(reportPayment(member, dealId, 0, "late", day(3)), { code: "22023" });

    const reportId = await reportPayment(member, dealId, 0, "unpaid");
    assert.ok((await kinds(owner, membershipId)).includes("payment_reported"));
    // A second report for the same milestone corrects the first.
    assert.equal(await reportPayment(member, dealId, 0, "late", day(-2)), reportId);
    const { rows } = await db.query(
      `select outcome, paid_on::text from public.payment_reports where deal_sheet_id = $1`,
      [dealId],
    );
    assert.deepEqual(rows, [{ outcome: "late", paid_on: day(-2) }]);

    // Parties read reports; outsiders and admins (outside the RPC) don't.
    for (const [who, count] of [
      [owner, 1],
      [member, 1],
      [outsider, 0],
      [admin, 0],
    ]) {
      const { rows: seen } = await asUser(
        db,
        who,
        `select id from public.payment_reports where id = $1`,
        [reportId],
      );
      assert.equal(seen.length, count);
    }
    await assert.rejects(
      asUser(db, member, `update public.payment_reports set outcome = 'on_time' where id = $1`, [
        reportId,
      ]),
      { code: "42501" },
    );

    // Corrections close after 14 days.
    await db.query(
      `update public.payment_reports set created_at = now() - interval '15 days' where id = $1`,
      [reportId],
    );
    await assert.rejects(reportPayment(member, dealId, 0, "on_time"), { code: "P0001" });

    // Terms can't be rewritten under a report.
    await assert.rejects(propose(owner, membershipId, { amount: 1 }), { code: "P0001" });
  });

  test("without milestones the due date is the agreed date plus the payment terms", async () => {
    const { member, dealId } = await agreedDeal({ payment_terms_days: 14 });
    await assert.rejects(reportPayment(member, dealId, null, "unpaid"), {
      code: "P0001",
      message: /^NOT_DUE_YET: /,
    });
    await assert.rejects(reportPayment(member, dealId, 0, "unpaid"), { code: "22023" });
    await db.query(
      `update public.deal_sheets set agreed_at = now() - interval '20 days' where id = $1`,
      [dealId],
    );
    assert.ok(await reportPayment(member, dealId, null, "unpaid"));
  });

  test("equity-only deals have nothing to report", async () => {
    const { owner, partner, membershipId } = await partnerPair();
    const dealId = await propose(owner, membershipId, {
      pay_basis: "equity",
      amount: null,
      equity_percent: 5,
      milestones: [milestone(-5)],
    });
    await confirm(partner, dealId, 1);
    await assert.rejects(reportPayment(partner, dealId, 0, "unpaid"), { code: "P0001" });
  });
});

describe("payment disputes", () => {
  test("owner only, once, within 14 days, with a 20-500 character reason", async () => {
    const { owner, member, membershipId, dealId } = await agreedDeal({
      milestones: [milestone(-5), milestone(-4)],
    });
    const outsider = await createUser(db);
    const reportId = await reportPayment(member, dealId, 0, "unpaid");

    await assert.rejects(disputePayment(member, reportId, DISPUTE_REASON), { code: "42501" });
    await assert.rejects(disputePayment(outsider, reportId, DISPUTE_REASON), { code: "P0002" });
    await assert.rejects(disputePayment(admin, reportId, DISPUTE_REASON), { code: "P0002" });
    await assert.rejects(disputePayment(owner, reportId, "Not true"), { code: "22023" });
    await assert.rejects(disputePayment(owner, reportId, "​".repeat(40)), { code: "22023" });
    await assert.rejects(disputePayment(owner, reportId, "r".repeat(501)), { code: "22023" });

    await disputePayment(owner, reportId, DISPUTE_REASON);
    assert.ok((await kinds(member, membershipId)).includes("payment_disputed"));
    await assert.rejects(disputePayment(owner, reportId, DISPUTE_REASON), { code: "P0001" });
    // A disputed report waits for a reviewer; the reporter can't edit it.
    await assert.rejects(reportPayment(member, dealId, 0, "on_time"), { code: "P0001" });

    // The window runs from when the report was made (or last corrected).
    const stale = await reportPayment(member, dealId, 1, "unpaid");
    await db.transaction(async (tx) => {
      await tx.exec(`set local session_replication_role = replica`);
      await tx.query(
        `update public.payment_reports set updated_at = now() - interval '15 days' where id = $1`,
        [stale],
      );
    });
    await assert.rejects(disputePayment(owner, stale, DISPUTE_REASON), { code: "P0001" });
  });

  test("only admins resolve; both parties hear the outcome; admins read the deal via RPC", async () => {
    const { owner, member, membershipId, dealId } = await agreedDeal({
      milestones: [milestone(-5)],
    });
    const reportId = await reportPayment(member, dealId, 0, "unpaid");
    await assert.rejects(resolveDispute(admin, reportId, true), { code: "P0001" });
    await disputePayment(owner, reportId, DISPUTE_REASON);

    await assert.rejects(resolveDispute(owner, reportId, true), { code: "42501" });
    await assert.rejects(resolveDispute(member, reportId, false), { code: "42501" });
    await assert.rejects(
      asUser(db, admin, `select public.svc_resolve_payment_dispute($1, $2, true, null)`, [
        admin,
        reportId,
      ]),
      { code: "42501" },
    );

    const read = async (who) =>
      (await asUser(db, who, `select public.get_deal_for_dispute($1) as v`, [reportId])).rows[0].v;
    assert.equal(await read(owner), null);
    assert.equal(await read(member), null);
    const view = await read(admin);
    assert.equal(view.deal.id, dealId);
    assert.equal(view.report.id, reportId);
    assert.equal(view.report.dispute_status, "disputed");

    await resolveDispute(admin, reportId, true, "Bank statement shows payment on time.");
    const {
      rows: [row],
    } = await db.query(
      `select r.dispute_status, r.resolved_at is not null as resolved, x.note, x.resolved_by
       from public.payment_reports r join private.payment_dispute_resolutions x on x.report_id = r.id
       where r.id = $1`,
      [reportId],
    );
    assert.deepEqual(row, {
      dispute_status: "upheld",
      resolved: true,
      note: "Bank statement shows payment on time.",
      resolved_by: admin,
    });
    await assert.rejects(resolveDispute(admin, reportId, false), { code: "P0001" });
    for (const who of [owner, member]) {
      const { rows } = await asUser(
        db,
        who,
        `select actor_id from public.activity
         where membership_id = $1 and kind = 'payment_dispute_resolved'`,
        [membershipId],
      );
      assert.deepEqual(rows, [{ actor_id: null }]);
    }
  });
});

describe("pays-on-time record", () => {
  test("counts agreed, undisputed reports and shows nothing below 3", async () => {
    const { owner, member, dealId } = await agreedDeal({
      milestones: [milestone(-9), milestone(-8), milestone(-7), milestone(-6)],
    });
    const viewer = await createUser(db);
    await reportPayment(member, dealId, 0, "on_time");
    await reportPayment(member, dealId, 1, "late", day(-3));
    assert.deepEqual(await payRecord(owner, viewer), []);
    await reportPayment(member, dealId, 2, "on_time");
    assert.deepEqual(await payRecord(owner, viewer), [
      { counted: 3, on_time: 2, late: 1, unpaid: 0 },
    ]);

    const disputed = await reportPayment(member, dealId, 3, "unpaid");
    assert.equal((await payRecord(owner, viewer))[0].unpaid, 1);
    await disputePayment(owner, disputed, DISPUTE_REASON);
    assert.equal((await payRecord(owner, viewer))[0].counted, 3);
    await resolveDispute(admin, disputed, false);
    assert.deepEqual(await payRecord(owner, viewer), [
      { counted: 4, on_time: 2, late: 1, unpaid: 1 },
    ]);
    // Only about owners: the professional has no pay record of their own.
    assert.deepEqual(await payRecord(member, viewer), []);
    await assert.rejects(inAnon(`select * from public.get_pay_record($1)`, [owner]), {
      code: "42501",
    });
  });

  test("an upheld dispute removes the report from the record", async () => {
    const { owner, member, dealId } = await agreedDeal({
      milestones: [milestone(-9), milestone(-8), milestone(-7)],
    });
    const ids = [];
    for (const i of [0, 1, 2]) ids.push(await reportPayment(member, dealId, i, "unpaid"));
    assert.equal((await payRecord(owner))[0].counted, 3);
    await disputePayment(owner, ids[0], DISPUTE_REASON);
    await resolveDispute(admin, ids[0], true);
    assert.deepEqual(await payRecord(owner), []);
  });

  test("reports from accounts under 14 days old at agreement don't count (sock puppets)", async () => {
    const { owner, member, dealId } = await agreedDeal(
      { milestones: [milestone(-9), milestone(-8), milestone(-7)] },
      { memberAgeDays: 13 },
    );
    for (const i of [0, 1, 2]) await reportPayment(member, dealId, i, "unpaid");
    assert.deepEqual(await payRecord(owner), []);
    // The same reports count once the account was old enough at agreement.
    await db.query(
      `update public.profiles set created_at = now() - interval '30 days' where id = $1`,
      [member],
    );
    assert.equal((await payRecord(owner))[0].counted, 3);
  });
});

describe("payment due notices", () => {
  test("go to the professional on the due date, once, only for agreed deals", async () => {
    const due = "2031-03-10";
    const { owner, member, membershipId } = await agreedDeal({
      milestones: [{ title: "Design", due_date: due, amount: 500 }],
    });
    const pending = await acceptedPair();
    await propose(pending.owner, pending.membershipId, {
      milestones: [{ title: "Design", due_date: due }],
    });
    const dueCount = async (who, m) =>
      (await kinds(who, m)).filter((k) => k === "payment_due").length;

    await db.query(`select private.emit_payment_due('2031-03-09')`);
    assert.equal(await dueCount(member, membershipId), 0);
    await db.query(`select private.emit_payment_due('2031-03-10')`);
    assert.equal(await dueCount(member, membershipId), 1);
    assert.equal(await dueCount(owner, membershipId), 0);
    assert.equal(await dueCount(pending.member, pending.membershipId), 0);

    // Read it, run again the next day: no second notice.
    await db.query(`update public.activity set read_at = now() where user_id = $1`, [member]);
    await db.query(`select private.emit_payment_due('2031-03-11')`);
    assert.equal(await dueCount(member, membershipId), 1);

    await assert.rejects(asUser(db, member, `select private.emit_payment_due(null)`), {
      code: "42501",
    });
  });
});

describe("data export: deal sheets", () => {
  test("includes your deals, their reports and your disputes; never a stranger's", async () => {
    const mine = await agreedDeal({ milestones: [milestone(-5)] });
    const theirs = await agreedDeal({ milestones: [milestone(-5)] });
    const myReport = await reportPayment(mine.member, mine.dealId, 0, "unpaid");
    const theirReport = await reportPayment(theirs.member, theirs.dealId, 0, "unpaid");
    await disputePayment(mine.owner, myReport, DISPUTE_REASON);
    await disputePayment(theirs.owner, theirReport, DISPUTE_REASON);
    await resolveDispute(admin, myReport, false, "Reviewer-only note");

    const exportFor = async (who) =>
      (await asUser(db, who, `select public.export_my_data() as data`)).rows[0].data;
    const owner = await exportFor(mine.owner);
    const member = await exportFor(mine.member);

    for (const data of [owner, member]) {
      assert.deepEqual(
        data.deal_sheets.map((d) => d.id),
        [mine.dealId],
      );
      assert.deepEqual(
        data.payment_reports.map((r) => r.id),
        [myReport],
      );
      assert.ok(!JSON.stringify(data).includes(theirs.dealId));
      assert.ok(!JSON.stringify(data).includes(theirReport));
      assert.ok(!JSON.stringify(data).includes("Reviewer-only note"));
    }
    assert.deepEqual(
      owner.payment_disputes_raised.map((d) => [d.report_id, d.status]),
      [[myReport, "rejected"]],
    );
    assert.deepEqual(member.payment_disputes_raised, []);

    const stranger = await exportFor(await createUser(db));
    assert.deepEqual(stranger.deal_sheets, []);
    assert.deepEqual(stranger.payment_reports, []);
    assert.deepEqual(stranger.payment_disputes_raised, []);
  });
});

describe("payment dispute moderation access", () => {
  test("admins can list disputed payment reports; other outsiders can't", async () => {
    const outsider = await createUser(db);
    const visible = (who) =>
      asUser(
        db,
        who,
        `select count(*)::int as n from public.payment_reports where dispute_status <> 'none'`,
      ).then((r) => r.rows[0].n);
    const total = (
      await db.query(
        `select count(*)::int as n from public.payment_reports where dispute_status <> 'none'`,
      )
    ).rows[0].n;
    assert.equal(await visible(admin), total, "admins see every disputed report");
    assert.equal(await visible(outsider), 0, "a non-party, non-admin sees none");
  });
});

describe("skills search", () => {
  test("starter skills are there and matches are ranked", async () => {
    const user = await createUser(db);
    const search = async (q) =>
      (await asUser(db, user, `select name from public.search_skills($1)`, [q])).rows.map(
        (r) => r.name,
      );
    const design = await search("design");
    assert.equal(design.length, 10, "typing 'design' fills the suggestion list");
    assert.equal(design[0], "Design systems", "names starting with the query come first");
    const marketing = await search("Marketing");
    assert.equal(marketing[0], "Marketing", "an exact match comes first");
    const ux = await search("ux");
    assert.equal(ux[0], "UX design", "names starting with the query beat other matches");
    assert.deepEqual(await search("   "), [], "blank queries return nothing");
    assert.deepEqual(await search("%"), [], "% is matched literally, not as a wildcard");
    const { rows } = await db.query(
      `select has_function_privilege('anon', 'public.search_skills(text)', 'execute') as ok`,
    );
    assert.equal(rows[0].ok, false, "signed-out visitors can't search skills");
  });
});

describe("abuse hardening (20261107100000)", () => {
  test("read policies don't run a per-row helper over the whole table", async () => {
    // owns_project / has_applied / is_membership_party per row made an
    // unfiltered read cost O(platform). Policies must use the set helpers.
    const { rows } = await db.query(
      `select tablename, policyname from pg_policies
       where schemaname = 'public' and cmd = 'SELECT'
         and qual ~ '(owns_project|has_applied|is_membership_party)[(]'`,
    );
    assert.deepEqual(rows, []);
  });

  test("an outsider's unfiltered reads still return nothing private", async () => {
    const owner = await createUser(db);
    const pro = await createUser(db);
    const outsider = await createUser(db);
    const project = await createDraft(db, owner);
    await publish(db, owner, admin, project);
    const application = await apply(pro, project);
    await asService(db, `select public.svc_decide_application($1, $2, true, null)`, [
      owner,
      application,
    ]);
    const count = async (who, table) =>
      (await asUser(db, who, `select count(*)::int as n from public.${table}`)).rows[0].n;
    for (const table of ["applications", "project_memberships", "application_status_history"]) {
      assert.equal(await count(outsider, table), 0, `${table}: outsider sees none`);
      assert.ok((await count(owner, table)) >= 1, `${table}: owner sees theirs`);
      assert.ok((await count(pro, table)) >= 1, `${table}: applicant sees theirs`);
    }
  });

  test("skills search needs 2+ characters and stays ranked with many matches", async () => {
    const user = await createUser(db);
    const search = async (q) =>
      (await asUser(db, user, `select name from public.search_skills($1)`, [q])).rows.map(
        (r) => r.name,
      );
    assert.deepEqual(await search("a"), [], "one character is not searched");
    await db.query(
      `insert into public.skills (name) select 'Zq filler ' || g from generate_series(1, 120) g
       on conflict do nothing`,
    );
    await db.query(`insert into public.skills (name) values ('Zq') on conflict do nothing`);
    const zq = await search("zq");
    assert.equal(zq.length, 10);
    assert.equal(zq[0], "Zq", "the exact match still comes first");
  });

  test("data export is limited per account per hour", async () => {
    const user = await createUser(db);
    for (let i = 0; i < 10; i++) {
      await asUser(db, user, `select public.export_my_data()`);
    }
    await assert.rejects(asUser(db, user, `select public.export_my_data()`), {
      code: "P0001",
      message: /several times this hour/,
    });
    const other = await createUser(db);
    await asUser(db, other, `select public.export_my_data()`);
  });

  test("marking read only touches unread rows, can't un-read, and uses server time", async () => {
    const user = await createUser(db);
    await db.query(
      `insert into public.activity (user_id, kind) values ($1, 'listing_published'), ($1, 'listing_published')`,
      [user],
    );
    const first = await asUser(
      db,
      user,
      `update public.activity set read_at = '2001-01-01' where user_id = $1 returning read_at`,
      [user],
    );
    assert.equal(first.rows.length, 2);
    assert.ok(
      first.rows.every((r) => r.read_at > new Date(Date.now() - 60_000)),
      "server time",
    );
    const again = await asUser(
      db,
      user,
      `update public.activity set read_at = now() where user_id = $1 returning id`,
      [user],
    );
    assert.equal(again.rows.length, 0, "already-read rows aren't rewritten");
    const unread = await asUser(
      db,
      user,
      `update public.activity set read_at = null where user_id = $1 returning id`,
      [user],
    );
    assert.equal(unread.rows.length, 0, "read rows can't be marked unread");
  });
});
