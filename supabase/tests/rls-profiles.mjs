// Asserts the profiles/skills/profile_skills RLS policies actually block
// what they're supposed to - a policy bug is a silent data leak, not a
// crash, so it won't surface in typecheck, lint, or manual QA by the row's
// owner. See docs/ACCESS_CONTROL.md's "Standing rules for every migration".
//
// Run: node supabase/tests/rls-profiles.mjs
//
// Requires, set locally in your shell (never commit these):
//   SUPABASE_URL                  - same value as EXPO_PUBLIC_SUPABASE_URL
//   SUPABASE_PUBLISHABLE_KEY      - same value as EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
//   SUPABASE_SERVICE_ROLE_KEY     - dashboard > Settings > API > service_role.
//                                   Used ONLY here, to create two disposable
//                                   pre-confirmed test users via the admin
//                                   API (bypassing email confirmation) and
//                                   delete them when done. Never ships in
//                                   the app, never goes in .env.local.

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !publishableKey || !serviceRoleKey) {
  console.error(
    "Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SERVICE_ROLE_KEY " +
      "in your shell before running this.",
  );
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey);

let failures = 0;

function check(label, condition) {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    console.error(`  FAIL  ${label}`);
    failures += 1;
  }
}

async function createConfirmedTestUser(label) {
  const email = `rls-test-${label}-${Date.now()}@example.com`;
  const password = "TestPassword123!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;

  const client = createClient(url, publishableKey);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  return { id: data.user.id, client };
}

async function main() {
  console.log("Creating two disposable test users...");
  const userA = await createConfirmedTestUser("a");
  const userB = await createConfirmedTestUser("b");

  try {
    console.log("\nUser A creates their own profile (expect: succeeds)");
    const { error: insertOwnError } = await userA.client.from("profiles").insert({
      id: userA.id,
      full_name: "RLS Test User A",
      headline: "Testing",
      seeking_paid: true,
    });
    check("User A can insert their own profile", !insertOwnError);

    console.log(
      "\nUser B reads User A's profile (expect: succeeds - profiles are readable by any authenticated user)",
    );
    const { data: readAsB, error: readError } = await userB.client
      .from("profiles")
      .select("id")
      .eq("id", userA.id)
      .maybeSingle();
    check("User B can read User A's profile", !readError && readAsB?.id === userA.id);

    console.log("\nUser B attempts to update User A's profile (expect: blocked)");
    const { data: updateAsB, error: updateError } = await userB.client
      .from("profiles")
      .update({ headline: "Hijacked" })
      .eq("id", userA.id)
      .select();
    check("User B cannot update User A's profile", !updateError && (updateAsB ?? []).length === 0);

    console.log("\nUser B attempts to insert a profile using User A's id (expect: blocked)");
    const { error: impersonateError } = await userB.client.from("profiles").insert({
      id: userA.id,
      full_name: "Impersonated",
      headline: "Should fail",
      seeking_paid: true,
    });
    check("User B cannot insert a profile using User A's id", !!impersonateError);

    console.log("\nUser B attempts to add a profile_skills row for User A (expect: blocked)");
    const { data: skillRow } = await admin.from("skills").select("id").limit(1).maybeSingle();
    if (skillRow) {
      const { error: skillInsertError } = await userB.client.from("profile_skills").insert({
        profile_id: userA.id,
        skill_id: skillRow.id,
      });
      check("User B cannot add a skill to User A's profile", !!skillInsertError);
    } else {
      console.log("  SKIP  (no skills exist yet to test with)");
    }
  } finally {
    console.log("\nCleaning up test users...");
    await admin.auth.admin.deleteUser(userA.id);
    await admin.auth.admin.deleteUser(userB.id);
  }

  console.log(failures === 0 ? "\nAll RLS checks passed." : `\n${failures} RLS check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("Test run crashed:", error);
  process.exit(1);
});
