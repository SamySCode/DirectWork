// Scheduled housekeeping, called by a scheduler (pg_cron + pg_net, or any
// cron) - never by the app. Deployed with verify_jwt = false; authenticity
// comes from the `x-maintenance-key` header, compared in constant time to
// the MAINTENANCE_SECRET secret. Unset secret = refuse everything.
//
// Each run:
// 1. applies the retention policy (public.svc_apply_retention), which may
//    queue more files for removal;
// 2. claims up to 500 queued storage paths (public.svc_claim_storage_cleanup),
//    removes them through the Storage API per bucket - never by deleting
//    storage.objects rows - and marks only the removed ones complete
//    (public.svc_complete_storage_cleanup). A bucket that fails keeps its
//    rows queued for the next run.

import { type Context, createHandler, type Deps, HttpError } from "../_shared/http.ts";

export const CLAIM_LIMIT = 500;

type QueuedFile = { id: number; bucket: string; path: string };

async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

/** Constant-time comparison; hashing first hides the secret's length too. */
export async function keyMatches(given: string, secret: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(given), sha256(secret)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

// PostgREST "function not found" (PGRST202) or Postgres undefined_function.
const MISSING_FUNCTION = new Set(["PGRST202", "42883"]);

export async function maintenance({ req, requestId, admin, env }: Context<false>) {
  const secret = env("MAINTENANCE_SECRET");
  if (!secret) throw new HttpError(503, "Maintenance not configured");
  if (!(await keyMatches(req.headers.get("x-maintenance-key") ?? "", secret))) {
    throw new HttpError(401, "Unauthorized");
  }

  const failures: string[] = [];

  let retention: unknown = "done";
  const { data: retained, error: retentionError } = await admin.rpc("svc_apply_retention");
  if (retentionError) {
    if (MISSING_FUNCTION.has(retentionError.code ?? "")) {
      retention = "skipped";
    } else {
      console.error(`[${requestId}] retention failed`, retentionError);
      retention = "failed";
      failures.push("retention");
    }
  } else if (retained !== null && retained !== undefined) {
    retention = retained;
  }

  const { data: claimed, error: claimError } = await admin.rpc("svc_claim_storage_cleanup", {
    p_limit: CLAIM_LIMIT,
  });
  if (claimError) {
    console.error(`[${requestId}] claiming storage cleanup failed`, claimError);
    throw new HttpError(500, "Maintenance failed");
  }

  const byBucket = new Map<string, QueuedFile[]>();
  for (const file of (claimed ?? []) as QueuedFile[]) {
    byBucket.set(file.bucket, [...(byBucket.get(file.bucket) ?? []), file]);
  }

  const done: number[] = [];
  for (const [bucket, files] of byBucket) {
    // A missing file isn't an error for remove(), so "done" means gone.
    const { error } = await admin.storage.from(bucket).remove(files.map((file) => file.path));
    if (error) {
      console.error(`[${requestId}] storage cleanup failed in ${bucket}`, error);
      failures.push(`storage:${bucket}`);
    } else {
      done.push(...files.map((file) => file.id));
    }
  }

  if (done.length > 0) {
    const { error } = await admin.rpc("svc_complete_storage_cleanup", { p_ids: done });
    if (error) {
      // The files are gone; the rows get claimed again and removing a
      // missing file is a no-op, so the next run tidies up.
      console.error(`[${requestId}] completing storage cleanup failed`, error);
      failures.push("complete");
    }
  }

  // Non-2xx so the scheduler's logs show the run failed; the details are
  // in this function's logs.
  if (failures.length > 0) {
    throw new HttpError(500, `Maintenance finished with errors: ${failures.join(", ")}`);
  }
  return { ok: true, retention, claimed: (claimed ?? []).length, removed: done.length };
}

export function createMaintenanceHandler(deps?: Deps) {
  return createHandler(
    "maintenance",
    // Server-to-server: no CORS, no Supabase auth, no body needed.
    { auth: false, cors: false, maxBodyBytes: 1024 },
    maintenance,
    deps,
  );
}
