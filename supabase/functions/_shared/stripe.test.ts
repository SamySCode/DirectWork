// Run: npm run test:functions (Deno).
import { assertEquals } from "jsr:@std/assert@1";
import { planFor, shouldApply, signForTest, toStatus, verifySignature } from "./stripe.ts";

const SECRET = "whsec_test_secret";
const BODY = '{"type":"customer.subscription.updated"}';
const NOW = 1_800_000_000;

Deno.test("signature: a correctly signed, fresh payload verifies", async () => {
  const header = await signForTest(BODY, SECRET, NOW);
  assertEquals(await verifySignature(BODY, header, SECRET, NOW), true);
});

Deno.test("signature: a tampered body is rejected", async () => {
  const header = await signForTest(BODY, SECRET, NOW);
  assertEquals(
    await verifySignature(BODY.replace("updated", "deleted"), header, SECRET, NOW),
    false,
  );
});

Deno.test("signature: the wrong secret is rejected", async () => {
  const header = await signForTest(BODY, "whsec_other", NOW);
  assertEquals(await verifySignature(BODY, header, SECRET, NOW), false);
});

Deno.test("signature: replays older than 5 minutes are rejected", async () => {
  const header = await signForTest(BODY, SECRET, NOW - 301);
  assertEquals(await verifySignature(BODY, header, SECRET, NOW), false);
  const justInside = await signForTest(BODY, SECRET, NOW - 299);
  assertEquals(await verifySignature(BODY, justInside, SECRET, NOW), true);
});

Deno.test("signature: timestamps too far in the future are rejected", async () => {
  const header = await signForTest(BODY, SECRET, NOW + 301);
  assertEquals(await verifySignature(BODY, header, SECRET, NOW), false);
});

Deno.test("signature: any of several v1 signatures may match (secret rotation)", async () => {
  const good = await signForTest(BODY, SECRET, NOW);
  const goodSig = good.split("v1=")[1];
  const header = `t=${NOW},v1=${"0".repeat(64)},v1=${goodSig}`;
  assertEquals(await verifySignature(BODY, header, SECRET, NOW), true);
});

Deno.test("signature: missing or malformed headers are rejected", async () => {
  assertEquals(await verifySignature(BODY, "", SECRET, NOW), false);
  assertEquals(await verifySignature(BODY, "v1=abc", SECRET, NOW), false);
  assertEquals(await verifySignature(BODY, `t=notanumber,v1=abc`, SECRET, NOW), false);
  assertEquals(await verifySignature(BODY, `t=${NOW}`, SECRET, NOW), false);
});

Deno.test("status: Stripe statuses map to ours and to a plan", () => {
  const cases: [string, string, string][] = [
    ["active", "active", "pro"],
    ["trialing", "trialing", "pro"],
    ["past_due", "past_due", "pro"],
    ["canceled", "canceled", "free"],
    ["unpaid", "inactive", "free"],
    ["incomplete", "inactive", "free"],
    ["incomplete_expired", "inactive", "free"],
    ["paused", "inactive", "free"],
  ];
  for (const [stripe, ours, plan] of cases) {
    assertEquals([toStatus(stripe), planFor(toStatus(stripe))], [ours, plan], stripe);
  }
});

Deno.test("which subscription wins: the stored one always updates itself", () => {
  const stored = { stripe_subscription_id: "sub_A", status: "active" };
  assertEquals(shouldApply(stored, { id: "sub_A", status: "canceled" }), true);
});

Deno.test("which subscription wins: an old duplicate can't cancel an active plan", () => {
  const stored = { stripe_subscription_id: "sub_B", status: "active" };
  assertEquals(shouldApply(stored, { id: "sub_A", status: "canceled" }), false);
  assertEquals(shouldApply(stored, { id: "sub_A", status: "unpaid" }), false);
});

Deno.test("which subscription wins: a new active one may replace the stored one", () => {
  const stored = { stripe_subscription_id: "sub_A", status: "active" };
  assertEquals(shouldApply(stored, { id: "sub_B", status: "active" }), true);
});

Deno.test("which subscription wins: anything replaces a lapsed or missing record", () => {
  assertEquals(shouldApply(null, { id: "sub_A", status: "canceled" }), true);
  assertEquals(
    shouldApply(
      { stripe_subscription_id: "sub_A", status: "canceled" },
      { id: "sub_B", status: "incomplete" },
    ),
    true,
  );
});
