// Run: npm run test:functions. No network: the Supabase client is a fake.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { depsFor, fakeAdmin, type FakeOptions, post } from "../_shared/testing.ts";
import { CLAIM_LIMIT, createMaintenanceHandler, keyMatches } from "./handler.ts";

const ENV = { MAINTENANCE_SECRET: "s3cret-maintenance-key" };
const KEY = { "x-maintenance-key": ENV.MAINTENANCE_SECRET };

const queued = [
  { id: 1, bucket: "application-attachments", path: "u1/a.pdf" },
  { id: 2, bucket: "avatars", path: "u1/avatar.jpg" },
  { id: 3, bucket: "application-attachments", path: "u2/b.pdf" },
];

async function run(
  headers: Record<string, string> = KEY,
  options: FakeOptions = {},
  env: Record<string, string> = ENV,
  method = "POST",
) {
  const admin = fakeAdmin({
    ...options,
    rpc: { svc_claim_storage_cleanup: () => ({ data: queued }), ...options.rpc },
  });
  const handler = createMaintenanceHandler(depsFor(admin, env));
  const request =
    method === "POST" ? post(headers) : new Request("http://localhost/fn", { method, headers });
  const response = await handler(request);
  return { response, body: await response.json(), admin };
}

Deno.test("maintenance: key comparison", async () => {
  assert(await keyMatches("abc", "abc"));
  assert(!(await keyMatches("abd", "abc")));
  assert(!(await keyMatches("", "abc")));
  assert(!(await keyMatches("abcabc", "abc")));
});

Deno.test("maintenance: refuses when MAINTENANCE_SECRET is unset", async () => {
  const { response, admin } = await run(KEY, {}, {});
  assertEquals(response.status, 503);
  assertEquals(admin.calls.length, 0);
});

Deno.test("maintenance: a missing or wrong key is 401 and does nothing", async () => {
  for (const headers of [{}, { "x-maintenance-key": "wrong" }] as Record<string, string>[]) {
    const { response, admin } = await run(headers);
    assertEquals(response.status, 401);
    assertEquals(admin.calls.length, 0);
  }
});

Deno.test("maintenance: POST only, and no CORS headers", async () => {
  const { response } = await run(KEY, {}, ENV, "GET");
  assertEquals(response.status, 405);
  const ok = await run({ ...KEY, Origin: "http://localhost:8081" });
  assertEquals(ok.response.headers.get("Access-Control-Allow-Origin"), null);
});

Deno.test("maintenance: runs retention, then removes claimed files per bucket", async () => {
  const { response, body, admin } = await run();
  assertEquals(response.status, 200);
  assertEquals([body.claimed, body.removed], [3, 3]);
  assert(
    admin.calls.indexOf("rpc:svc_apply_retention") <
      admin.calls.indexOf("rpc:svc_claim_storage_cleanup"),
  );
  assertEquals(admin.args["rpc:svc_claim_storage_cleanup"], [{ p_limit: CLAIM_LIMIT }]);
  assertEquals(admin.args["storage.remove:application-attachments"], [["u1/a.pdf", "u2/b.pdf"]]);
  assertEquals(admin.args["storage.remove:avatars"], [["u1/avatar.jpg"]]);
  assertEquals(admin.args["rpc:svc_complete_storage_cleanup"], [{ p_ids: [1, 3, 2] }]);
});

Deno.test("maintenance: an empty queue completes nothing", async () => {
  const { response, admin } = await run(KEY, {
    rpc: { svc_claim_storage_cleanup: () => ({ data: [] }) },
  });
  assertEquals(response.status, 200);
  assertEquals(admin.calls.includes("rpc:svc_complete_storage_cleanup"), false);
});

Deno.test("maintenance: a failing bucket keeps its rows queued; the rest complete", async () => {
  const { response, admin } = await run(KEY, {
    remove: (bucket) => (bucket === "avatars" ? { error: { message: "down" } } : {}),
  });
  assertEquals(response.status, 500);
  assertEquals(admin.args["rpc:svc_complete_storage_cleanup"], [{ p_ids: [1, 3] }]);
});

Deno.test(
  "maintenance: retention missing is skipped; retention failing still cleans up",
  async () => {
    const missing = await run(KEY, {
      rpc: { svc_apply_retention: () => ({ error: { code: "PGRST202", message: "not found" } }) },
    });
    assertEquals([missing.response.status, missing.body.retention], [200, "skipped"]);

    const failing = await run(KEY, {
      rpc: { svc_apply_retention: () => ({ error: { code: "57014", message: "timeout" } }) },
    });
    assertEquals(failing.response.status, 500);
    assert(failing.admin.calls.includes("rpc:svc_complete_storage_cleanup"));
  },
);

Deno.test("maintenance: a failed claim is a 500 and removes nothing", async () => {
  const { response, admin } = await run(KEY, {
    rpc: { svc_claim_storage_cleanup: () => ({ error: { message: "x" } }) },
  });
  assertEquals(response.status, 500);
  assertEquals(
    admin.calls.some((c) => c.startsWith("storage.")),
    false,
  );
});
