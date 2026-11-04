// Run: npm run test:functions (Deno). ALLOWED_ORIGINS is unset here, so
// these exercise the local-development default: localhost only.
import { assertEquals } from "jsr:@std/assert@1";
import { fromDbError, HttpError, isOriginAllowed, readBodyCapped } from "./http.ts";

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
