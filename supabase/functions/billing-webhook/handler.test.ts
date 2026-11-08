// Run: npm run test:functions. No network: the Supabase client is a fake
// and fetch (Stripe) is stubbed.
import { assertEquals } from "jsr:@std/assert@1";
import {
  depsFor,
  fakeAdmin,
  type FakeOptions,
  type FetchCall,
  json,
  post,
  USER_ID,
  withFetch,
} from "../_shared/testing.ts";
import { signForTest, STRIPE_API_VERSION } from "../_shared/stripe.ts";
import { createBillingWebhookHandler } from "./handler.ts";

const ENV = { STRIPE_WEBHOOK_SECRET: "whsec_test", STRIPE_SECRET_KEY: "sk_test_x" };

const subscription = (overrides: Record<string, unknown> = {}) => ({
  id: "sub_new",
  customer: "cus_123",
  status: "active",
  metadata: { user_id: USER_ID },
  items: { data: [{ current_period_end: 1_900_000_000 }] },
  ...overrides,
});

async function deliver(
  event: unknown,
  options: {
    admin?: FakeOptions;
    env?: Record<string, string>;
    stripe?: (call: FetchCall) => Response;
    signature?: string;
  } = {},
) {
  const payload = JSON.stringify(event);
  const signature =
    options.signature ??
    (await signForTest(payload, ENV.STRIPE_WEBHOOK_SECRET, Math.floor(Date.now() / 1000)));
  const admin = fakeAdmin(options.admin);
  const handler = createBillingWebhookHandler(depsFor(admin, options.env ?? ENV));
  return await withFetch(options.stripe ?? (() => json(subscription())), async (fetches) => {
    const response = await handler(post({ "Stripe-Signature": signature }, payload));
    return { response, body: await response.json(), admin, fetches };
  });
}

const updated = { type: "customer.subscription.updated", data: { object: { id: "sub_new" } } };
const deletedUser: FakeOptions = {
  rpc: { svc_apply_subscription: () => ({ error: { code: "23503", message: "fk" } }) },
};

Deno.test("webhook: not configured is a 503", async () => {
  const { response } = await deliver(updated, { env: {} });
  assertEquals(response.status, 503);
});

Deno.test("webhook: no Stripe-Signature header is a 400 before the body is read", async () => {
  for (const headers of [{}, { "Stripe-Signature": "" }] as Record<string, string>[]) {
    let pulled = false;
    // highWaterMark 0: the stream is only pulled when someone reads the body.
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          pulled = true;
          controller.enqueue(new TextEncoder().encode(JSON.stringify(updated)));
          controller.close();
        },
      },
      { highWaterMark: 0 },
    );
    const req = new Request("http://localhost/fn", { method: "POST", headers, body });
    const admin = fakeAdmin();
    const handler = createBillingWebhookHandler(depsFor(admin, ENV));
    const response = await handler(req);
    assertEquals(response.status, 400);
    assertEquals((await response.json()).error, "Missing Stripe-Signature header");
    assertEquals([pulled, req.bodyUsed, admin.calls.length], [false, false, 0]);
  }
});

Deno.test("webhook: a bad or stale signature is a 400 and nothing is read", async () => {
  for (const signature of ["", "t=1,v1=deadbeef", "garbage"]) {
    const { response, admin, fetches } = await deliver(updated, { signature });
    assertEquals(response.status, 400);
    assertEquals([admin.calls.length, fetches.length], [0, 0]);
  }
  const old = await signForTest(JSON.stringify(updated), ENV.STRIPE_WEBHOOK_SECRET, 1_000_000);
  assertEquals((await deliver(updated, { signature: old })).response.status, 400);
});

Deno.test("webhook: other event types are acknowledged and ignored", async () => {
  const { response, body, admin, fetches } = await deliver({ type: "invoice.paid", data: {} });
  assertEquals([response.status, body.ignored], [200, "invoice.paid"]);
  assertEquals([admin.calls.length, fetches.length], [0, 0]);
});

Deno.test("webhook: a malformed subscription id is ignored without calling Stripe", async () => {
  const event = { type: "customer.subscription.updated", data: { object: { id: "../x" } } };
  const { body, fetches } = await deliver(event);
  assertEquals([body.ignored, fetches.length], ["bad id", 0]);
});

Deno.test("webhook: current state is fetched from Stripe and applied", async () => {
  const { response, admin, fetches } = await deliver(updated);
  assertEquals(response.status, 200);
  assertEquals(fetches[0]!.url, "https://api.stripe.com/v1/subscriptions/sub_new");
  assertEquals(fetches[0]!.headers.get("Stripe-Version"), STRIPE_API_VERSION);
  assertEquals(admin.args["rpc:svc_apply_subscription"], [
    {
      p_user: USER_ID,
      p_plan: "pro",
      p_status: "active",
      p_customer: "cus_123",
      p_subscription: "sub_new",
      p_period_end: new Date(1_900_000_000 * 1000).toISOString(),
    },
  ]);
});

Deno.test("webhook: Stripe being down is a 502 so Stripe retries", async () => {
  const { response, admin } = await deliver(updated, { stripe: () => json({}, 500) });
  assertEquals(response.status, 502);
  assertEquals(admin.calls.includes("rpc:svc_apply_subscription"), false);
});

Deno.test("webhook: a subscription without a valid user_id is ignored", async () => {
  const { body, admin } = await deliver(updated, {
    stripe: () => json(subscription({ metadata: { user_id: "not-a-uuid" } })),
  });
  assertEquals(body.ignored, "no user_id");
  assertEquals(admin.calls.length, 0);
});

Deno.test("webhook: cancelling an old duplicate doesn't override an active plan", async () => {
  const { body, admin } = await deliver(updated, {
    stripe: () => json(subscription({ status: "canceled" })),
    admin: { table: () => ({ data: { stripe_subscription_id: "sub_current", status: "active" } }) },
  });
  assertEquals(body.ignored, "superseded subscription");
  assertEquals(admin.calls.includes("rpc:svc_apply_subscription"), false);
});

Deno.test("webhook: a subscription for a deleted user gets its customer erased", async () => {
  const { response, body, fetches } = await deliver(updated, {
    admin: deletedUser,
    stripe: (call) => (call.method === "DELETE" ? json({ deleted: true }) : json(subscription())),
  });
  assertEquals([response.status, body.cancelled], [200, "user deleted"]);
  assertEquals(
    fetches.map((f) => `${f.method} ${f.url}`),
    [
      "GET https://api.stripe.com/v1/subscriptions/sub_new",
      "DELETE https://api.stripe.com/v1/customers/cus_123",
    ],
  );
});

Deno.test("webhook: if erasing a deleted user's customer fails, Stripe retries (502)", async () => {
  const { response } = await deliver(updated, {
    admin: deletedUser,
    stripe: (call) => (call.method === "DELETE" ? json({}, 500) : json(subscription())),
  });
  assertEquals(response.status, 502);
});

Deno.test("webhook: a transient DB error is a 500 so Stripe retries", async () => {
  const { response } = await deliver(updated, {
    admin: { rpc: { svc_apply_subscription: () => ({ error: { code: "08006", message: "x" } }) } },
  });
  assertEquals(response.status, 500);
});
