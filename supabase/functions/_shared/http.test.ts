// Run: npm run test:functions (Deno). ALLOWED_ORIGINS is unset here, so
// these exercise the local-development default: localhost only.
import { assertEquals } from "jsr:@std/assert@1";
import {
  CONTACT_DETAILS_MESSAGE,
  createHandler,
  fromDbError,
  HttpError,
  isOriginAllowed,
  jwtPayload,
  looksLikeUserToken,
  readBodyCapped,
} from "./http.ts";
import { amrAt, depsFor, fakeAdmin, fakeJwt, post, tokenFor, USER_ID } from "./testing.ts";

Deno.test("CORS: requests without an Origin (native apps, servers) are allowed", () => {
  assertEquals(isOriginAllowed(null), true);
});

Deno.test("CORS: only localhost origins are allowed when no allowlist is set", () => {
  assertEquals(isOriginAllowed("http://localhost:8081"), true);
  assertEquals(isOriginAllowed("http://127.0.0.1:19006"), true);
  assertEquals(isOriginAllowed("https://evil.example"), false);
  // Look-alikes must not slip through a loose match.
  assertEquals(isOriginAllowed("http://localhost.evil.example"), false);
  assertEquals(isOriginAllowed("http://evil.example/localhost"), false);
});

Deno.test("DB errors: rule violations keep their user-facing message and code", () => {
  const error = fromDbError({
    code: "P0001",
    message: "LISTING_LIMIT: Your plan's live listing limit is reached",
  });
  assertEquals(error instanceof HttpError, true);
  assertEquals(
    [error.status, error.code, error.message],
    [409, "LISTING_LIMIT", "Your plan's live listing limit is reached"],
  );
});

Deno.test("DB errors: plain rule violations have no code", () => {
  const error = fromDbError({ code: "P0001", message: "Only drafts can be submitted for review" });
  assertEquals([error.status, error.code], [409, undefined]);
});

Deno.test("DB errors: not-found, forbidden and bad-input map to 404/403/400", () => {
  assertEquals(fromDbError({ code: "P0002", message: "Listing not found" }).status, 404);
  assertEquals(fromDbError({ code: "42501", message: "Only reviewers can do this" }).status, 403);
  assertEquals(fromDbError({ code: "22023", message: "Unknown outcome" }).status, 400);
});

Deno.test("DB errors: anything unexpected is a generic 500 that leaks nothing", () => {
  const error = fromDbError({ code: "42P01", message: 'relation "secret_table" does not exist' });
  assertEquals(error.status, 500);
  assertEquals(error.message.includes("secret_table"), false);
});

Deno.test("DB errors: Postgres's own permission errors are not passed through", () => {
  const error = fromDbError({ code: "42501", message: "permission denied for table projects" });
  assertEquals([error.status, error.message], [403, "You don't have permission to do that."]);
  const ours = fromDbError({ code: "42501", message: "Only reviewers can do this" });
  assertEquals(ours.message, "Only reviewers can do this");
});

Deno.test("body cap: bodies over the limit are refused while streaming", async () => {
  const small = new Request("http://x", { method: "POST", body: "hello" });
  assertEquals(await readBodyCapped(small, 10), "hello");
  const big = new Request("http://x", { method: "POST", body: "x".repeat(11) });
  const error = await readBodyCapped(big, 10).catch((e) => e);
  assertEquals([error instanceof HttpError, error.status], [true, 413]);
});

Deno.test("body cap: an empty body reads as empty", async () => {
  assertEquals(await readBodyCapped(new Request("http://x", { method: "POST" }), 10), "");
});

Deno.test("DB errors: contact-rule violations are a 400 with the fixed contact message", () => {
  const error = fromDbError({
    code: "23514",
    message: CONTACT_DETAILS_MESSAGE,
    hint: "CONTACT_DETAILS",
    details: "no_contact: profiles.bio",
  });
  assertEquals(
    [error.status, error.code, error.message],
    [400, "CONTACT_DETAILS", CONTACT_DETAILS_MESSAGE],
  );
  // Other check violations (lengths etc.) must not blame contact details.
  const other = fromDbError({ code: "23514", message: 'violates check "profiles_bio_length"' });
  assertEquals([other.status, other.code], [400, undefined]);
  assertEquals(other.message === CONTACT_DETAILS_MESSAGE, false);
  assertEquals(
    CONTACT_DETAILS_MESSAGE,
    "Leave out emails, phone numbers and links. Contact details are shared automatically once you both accept.",
  );
});

Deno.test("DB errors: unique violations are a 409 that leaks nothing", () => {
  const error = fromDbError({ code: "23505", message: 'duplicate key "applications_pkey"' });
  assertEquals([error.status, error.message], [409, "That's already been done."]);
});

Deno.test("JWT payload: decodes base64url, rejects junk", () => {
  assertEquals(jwtPayload(fakeJwt({ sub: "é-user" }))?.sub, "é-user");
  assertEquals(jwtPayload("not-a-jwt"), null);
  assertEquals(jwtPayload("a.!!!.c"), null);
});

const echo = createHandler(
  "echo",
  {},
  async ({ user }) => ({ id: user.id, amr: user.amr }),
  depsFor(fakeAdmin()),
);

Deno.test("middleware: OPTIONS is 204, non-POST is 405, bad JSON is 400", async () => {
  const options = await echo(new Request("http://x", { method: "OPTIONS" }));
  assertEquals(options.status, 204);
  assertEquals((await echo(new Request("http://x"))).status, 405);
  const token = tokenFor([amrAt("password", 5)]);
  assertEquals((await echo(post({ Authorization: `Bearer ${token}` }, "{"))).status, 400);
});

Deno.test(
  "middleware: disallowed origins are refused; responses carry security headers",
  async () => {
    const refused = await echo(
      new Request("http://x", { method: "POST", headers: { Origin: "https://evil.example" } }),
    );
    assertEquals(refused.status, 403);
    assertEquals(refused.headers.get("X-Content-Type-Options"), "nosniff");
    assertEquals(refused.headers.get("Cache-Control"), "no-store");
  },
);

Deno.test("middleware: the verified user and their token amr reach the handler", async () => {
  const amr = [amrAt("password", 5)];
  const response = await echo(post({ Authorization: `Bearer ${tokenFor(amr)}` }));
  assertEquals(await response.json(), { id: USER_ID, amr });
  assertEquals((await echo(post())).status, 401);
});

Deno.test("middleware: over the rate limit is 429 RATE_LIMITED", async () => {
  const admin = fakeAdmin({ rpc: { svc_hit_rate_limit: () => ({ data: false }) } });
  const limited = createHandler(
    "x",
    { rateLimit: { max: 1, windowSeconds: 60 } },
    async () => ({}),
    depsFor(admin),
  );
  const response = await limited(post({ Authorization: `Bearer ${tokenFor([])}` }));
  assertEquals([response.status, (await response.json()).code], [429, "RATE_LIMITED"]);
});

Deno.test(
  "auth: tokens that can't be a signed-in user are refused before the Auth call",
  async () => {
    const admin = fakeAdmin();
    const handler = createHandler(
      "echo",
      {},
      async ({ user }) => ({ id: user.id }),
      depsFor(admin),
    );
    const now = Math.floor(Date.now() / 1000);
    for (const token of [
      "junk",
      fakeJwt({ role: "anon", iss: "supabase" }),
      fakeJwt({ role: "service_role" }),
      fakeJwt({ role: "authenticated" }),
      fakeJwt({ role: "authenticated", sub: USER_ID, exp: now - 3600 }),
    ]) {
      assertEquals((await handler(post({ Authorization: `Bearer ${token}` }))).status, 401);
    }
    assertEquals(admin.calls.filter((c) => c === "auth.getUser").length, 0);

    const fresh = fakeJwt({ role: "authenticated", sub: USER_ID, exp: now + 3600 });
    assertEquals((await handler(post({ Authorization: `Bearer ${fresh}` }))).status, 200);
    assertEquals(admin.calls.filter((c) => c === "auth.getUser").length, 1);
  },
);

Deno.test("auth pre-check allows a minute of clock skew on expiry", () => {
  const base = { role: "authenticated", sub: USER_ID };
  assertEquals(looksLikeUserToken({ ...base, exp: 1000 }, 1030), true);
  assertEquals(looksLikeUserToken({ ...base, exp: 1000 }, 1100), false);
  assertEquals(looksLikeUserToken(null), false);
});

// ---------------------------------------------------------------------------
// CORS and exposure, end to end through the middleware.
// ---------------------------------------------------------------------------

const CORS_HEADERS = [
  "Access-Control-Allow-Origin",
  "Access-Control-Allow-Headers",
  "Access-Control-Allow-Methods",
  "Access-Control-Allow-Credentials",
];

Deno.test("CORS: a disallowed origin gets no CORS headers, on POST or preflight", async () => {
  for (const method of ["POST", "OPTIONS"]) {
    const refused = await echo(
      new Request("http://x", { method, headers: { Origin: "https://evil.example" } }),
    );
    assertEquals(refused.status, 403);
    for (const header of CORS_HEADERS) assertEquals(refused.headers.get(header), null);
  }
});

Deno.test("CORS: an allowed origin is echoed exactly, never '*', with Vary", async () => {
  const preflight = await echo(
    new Request("http://x", { method: "OPTIONS", headers: { Origin: "http://localhost:8081" } }),
  );
  assertEquals(preflight.status, 204);
  assertEquals(preflight.headers.get("Access-Control-Allow-Origin"), "http://localhost:8081");
  assertEquals(preflight.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
  assertEquals(preflight.headers.get("Vary"), "Origin");
  // Bearer tokens only: cookies are never accepted cross-origin.
  assertEquals(preflight.headers.get("Access-Control-Allow-Credentials"), null);
});

Deno.test("CORS: no Origin (native app) gets no CORS headers and still needs a token", async () => {
  const response = await echo(post({}, "{}"));
  assertEquals(response.status, 401);
  for (const header of CORS_HEADERS) assertEquals(response.headers.get(header), null);
});

Deno.test("CORS: cors:false handlers (webhook, maintenance) never emit CORS headers", async () => {
  const closed = createHandler(
    "closed",
    { auth: false, cors: false },
    () => Promise.resolve({ ok: true }),
    depsFor(fakeAdmin()),
  );
  for (const origin of ["http://localhost:8081", "https://evil.example"]) {
    const response = await closed(post({ Origin: origin }, "{}"));
    for (const header of CORS_HEADERS) assertEquals(response.headers.get(header), null);
  }
});

Deno.test("CORS: with ALLOWED_ORIGINS set, only those exact origins pass", async () => {
  // http.ts reads the variable once at load, so load a fresh copy of it.
  Deno.env.set("ALLOWED_ORIGINS", "https://app.example.co.uk, https://example.co.uk");
  try {
    const fresh: typeof import("./http.ts") = await import("./http.ts?allowlist");
    assertEquals(fresh.isOriginAllowed("https://app.example.co.uk"), true);
    assertEquals(fresh.isOriginAllowed("https://example.co.uk"), true);
    assertEquals(fresh.isOriginAllowed(null), true);
    // Production must not trust localhost, other schemes, ports or look-alikes.
    for (const origin of [
      "http://localhost:8081",
      "http://app.example.co.uk",
      "https://app.example.co.uk:8443",
      "https://app.example.co.uk.evil.example",
      "https://evil-example.co.uk",
      "https://sub.app.example.co.uk",
      "null",
      "*",
    ]) {
      assertEquals([origin, fresh.isOriginAllowed(origin)], [origin, false]);
    }
    const handler = fresh.createHandler(
      "echo",
      { auth: false },
      () => Promise.resolve({ ok: true }),
      depsFor(fakeAdmin()),
    );
    const allowed = await handler(post({ Origin: "https://app.example.co.uk" }, "{}"));
    assertEquals(allowed.status, 200);
    assertEquals(allowed.headers.get("Access-Control-Allow-Origin"), "https://app.example.co.uk");
    const local = await handler(post({ Origin: "http://localhost:8081" }, "{}"));
    assertEquals(local.status, 403);
    assertEquals(local.headers.get("Access-Control-Allow-Origin"), null);
  } finally {
    Deno.env.delete("ALLOWED_ORIGINS");
  }
});
