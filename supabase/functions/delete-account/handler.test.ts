// Run: npm run test:functions. No network: the Supabase client is a fake
// and fetch (Stripe) is stubbed.
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  amrAt,
  depsFor,
  fakeAdmin,
  type FakeOptions,
  json,
  post,
  tokenFor,
  USER_ID,
  withFetch,
} from "../_shared/testing.ts";
import { createDeleteAccountHandler, freshlyAuthenticated, LEGAL_HOLD_MESSAGE } from "./handler.ts";
import { STRIPE_API_VERSION } from "../_shared/stripe.ts";

const ENV = { STRIPE_SECRET_KEY: "sk_test_x" };
const FRESH = tokenFor([amrAt("password", 60)]);

async function call(token: string, options: FakeOptions = {}, stripeStatus = 200) {
  const admin = fakeAdmin(options);
  const handler = createDeleteAccountHandler(depsFor(admin, ENV));
  return await withFetch(
    () => json({ id: "cus_123", deleted: true }, stripeStatus),
    async (fetches) => {
      const response = await handler(post({ Authorization: `Bearer ${token}` }));
      return { response, body: await response.json(), admin, fetches };
    },
  );
}

const withCustomer: FakeOptions["table"] = () => ({ data: { stripe_customer_id: "cus_123" } });

Deno.test("re-auth: only a recent password or recovery sign-in on this session counts", () => {
  assert(freshlyAuthenticated([amrAt("password", 60)]));
  assert(freshlyAuthenticated([amrAt("recovery", 9 * 60)]));
  assert(!freshlyAuthenticated([amrAt("password", 11 * 60)]));
  assert(!freshlyAuthenticated([amrAt("otp", 60), amrAt("oauth", 60)]));
  assert(!freshlyAuthenticated([amrAt("password", -10 * 60)]), "far-future timestamp");
  assert(!freshlyAuthenticated([]));
  // An old password sign-in plus any later method on another factor doesn't help.
  assert(!freshlyAuthenticated([amrAt("password", 3600), amrAt("totp", 30)]));
});

Deno.test("delete-account: no token is 401 and nothing is touched", async () => {
  const admin = fakeAdmin();
  const response = await createDeleteAccountHandler(depsFor(admin, ENV))(post());
  assertEquals(response.status, 401);
  assertEquals(admin.calls.includes("auth.admin.deleteUser"), false);
});

Deno.test("delete-account: a stale session (old amr) is refused with REAUTH_REQUIRED", async () => {
  const { response, body, admin, fetches } = await call(tokenFor([amrAt("password", 3600)]));
  assertEquals([response.status, body.code], [403, "REAUTH_REQUIRED"]);
  assertEquals(admin.calls.includes("rpc:svc_has_legal_hold"), false);
  assertEquals(admin.calls.includes("auth.admin.deleteUser"), false);
  assertEquals(fetches.length, 0);
});

Deno.test("delete-account: a token whose sub doesn't match the verified user is 401", async () => {
  const { response } = await call(FRESH, { users: () => "22222222-2222-4222-8222-222222222222" });
  assertEquals(response.status, 401);
});

Deno.test("delete-account: the rate limiter failing closes the door (503)", async () => {
  const { response, admin } = await call(FRESH, {
    rpc: { svc_hit_rate_limit: () => ({ error: { message: "down" } }) },
  });
  assertEquals(response.status, 503);
  assertEquals(admin.calls.includes("auth.admin.deleteUser"), false);
});

Deno.test("delete-account: a legal hold refuses deletion without saying why", async () => {
  const { response, body, admin, fetches } = await call(FRESH, {
    rpc: { svc_has_legal_hold: () => ({ data: true }) },
    table: withCustomer,
  });
  assertEquals([response.status, body.error], [403, LEGAL_HOLD_MESSAGE]);
  assertEquals(admin.args["rpc:svc_has_legal_hold"], [{ p_user: USER_ID }]);
  assertEquals(fetches.length, 0, "Stripe untouched");
  assertEquals(admin.calls.includes("auth.admin.deleteUser"), false);
});

Deno.test("delete-account: a failed legal-hold check fails closed", async () => {
  const { response, admin } = await call(FRESH, {
    rpc: { svc_has_legal_hold: () => ({ error: { message: "boom" } }) },
  });
  assertEquals(response.status, 500);
  assertEquals(admin.calls.includes("auth.admin.deleteUser"), false);
});

Deno.test(
  "delete-account: a Stripe failure stops before files or the user are deleted",
  async () => {
    const { response, admin, fetches } = await call(
      FRESH,
      { rpc: { svc_has_legal_hold: () => ({ data: false }) }, table: withCustomer },
      500,
    );
    assertEquals(response.status, 502);
    assertEquals(fetches.length, 1);
    assertEquals(
      admin.calls.some((c) => c.startsWith("storage.")),
      false,
    );
    assertEquals(admin.calls.includes("auth.admin.deleteUser"), false);
  },
);

Deno.test("delete-account: happy path runs Stripe, then files, then the user", async () => {
  const files = (count: number, from = 0) =>
    Array.from({ length: count }, (_, i) => ({ name: `f${from + i}.jpg`, id: `id${from + i}` }));
  const { response, admin, fetches } = await call(FRESH, {
    rpc: { svc_has_legal_hold: () => ({ data: false }) },
    table: withCustomer,
    // 1500 avatars across two pages; a listing-images subfolder; portfolio listing fails.
    list: (bucket, prefix, offset) => {
      if (bucket === "avatars") return { data: offset === 0 ? files(1000) : files(500, 1000) };
      if (bucket === "listing-images" && prefix === USER_ID)
        return { data: [{ name: "project-1", id: null }] };
      if (bucket === "listing-images") return { data: files(2) };
      if (bucket === "portfolio") return { error: { message: "storage down" } };
      return { data: [] };
    },
  });
  assertEquals(response.status, 200);

  assertEquals(fetches.length, 1);
  assertEquals(fetches[0]!.method, "DELETE");
  assertEquals(fetches[0]!.url, "https://api.stripe.com/v1/customers/cus_123");
  assertEquals(fetches[0]!.headers.get("Stripe-Version"), STRIPE_API_VERSION);

  const removed = admin.args["storage.remove:avatars"] as string[][];
  assertEquals(
    removed.map((batch) => batch.length),
    [1000, 500],
  );
  assertEquals(removed[0]![0], `${USER_ID}/f0.jpg`);
  assertEquals(admin.args["storage.remove:listing-images"], [
    [`${USER_ID}/project-1/f0.jpg`, `${USER_ID}/project-1/f1.jpg`],
  ]);

  // Storage failure in one bucket is logged, not fatal; the user goes last.
  assertEquals(admin.calls.at(-1), "auth.admin.deleteUser");
  assertEquals(admin.args["auth.admin.deleteUser"], [USER_ID]);
  const order = ["rpc:svc_has_legal_hold", "from:subscriptions", "storage.list:avatars"];
  assertEquals(
    order
      .map((c) => admin.calls.indexOf(c))
      .every((i, n, all) => i >= 0 && (n === 0 || i > all[n - 1]!)),
    true,
  );
});

Deno.test("delete-account: no Stripe customer or no Stripe key means no Stripe call", async () => {
  const { response, fetches } = await call(FRESH, {
    rpc: { svc_has_legal_hold: () => ({ data: false }) },
  });
  assertEquals([response.status, fetches.length], [200, 0]);
});

Deno.test("delete-account: a failed user deletion is a 500", async () => {
  const { response } = await call(FRESH, {
    rpc: { svc_has_legal_hold: () => ({ data: false }) },
    deleteUser: () => ({ error: { message: "nope" } }),
  });
  assertEquals(response.status, 500);
});
