import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.112.2";

// ---------------------------------------------------------------------------
// CORS: an explicit allowlist, never "*". Browsers (the Expo web build) send
// an Origin and get it echoed back only if listed; native apps send no
// Origin and are unaffected. Set ALLOWED_ORIGINS to a comma-separated list
// of exact origins, e.g. "https://app.directwork.co,https://directwork.co".
// Unset = local development: only localhost origins are allowed.
// ---------------------------------------------------------------------------
const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const LOCALHOST = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return true; // native app / server-to-server
  if (allowedOrigins.length === 0) return LOCALHOST.test(origin);
  return allowedOrigins.includes(origin);
}

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !isOriginAllowed(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

// Responses are JSON for an API client, never rendered - lock that in.
const SECURITY_HEADERS = {
  "Content-Type": "application/json",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type AuthedUser = { id: string; email?: string };

/**
 * Resolves the caller from their bearer token via Supabase Auth - never
 * from any user id in the request body.
 */
async function authenticate(req: Request): Promise<AuthedUser | null> {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  const { data, error } = await serviceClient().auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email };
}

/**
 * Maps a Postgres error raised by a private.* function to an HttpError.
 * Those raise P0001 with a user-facing message for rule violations and
 * P0002 for not-found/not-yours; anything else is unexpected and must not
 * leak internals.
 */
export function fromDbError(error: { code?: string; message: string }): HttpError {
  if (error.code === "P0001") {
    const [code, ...rest] = error.message.split(": ");
    return rest.length > 0 && /^[A-Z_]+$/.test(code ?? "")
      ? new HttpError(409, rest.join(": "), code)
      : new HttpError(409, error.message);
  }
  if (error.code === "P0002") return new HttpError(404, error.message);
  // 42501 is also Postgres's own "permission denied for table x" - only
  // pass through messages our functions raised, never internals.
  if (error.code === "42501") {
    return error.message.startsWith("permission denied")
      ? new HttpError(403, "You don't have permission to do that.")
      : new HttpError(403, error.message);
  }
  if (error.code === "22023") return new HttpError(400, error.message);
  return new HttpError(500, "Something went wrong on our side. Try again.");
}

type RateLimit = {
  max: number;
  windowSeconds: number;
  /** Refuse requests if the limiter itself is down (for money/destructive actions). */
  failClosed?: boolean;
};

/**
 * Reads the body while counting bytes, so a chunked upload with no
 * Content-Length can't make us buffer more than the cap.
 */
export async function readBodyCapped(req: Request, maxBytes: number): Promise<string> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, "Request too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

type Options = {
  /** Require a signed-in user (default true). */
  auth?: boolean;
  /** Per-user (or per-IP when unauthenticated) limit for this function. */
  rateLimit?: RateLimit;
  /** Reject bodies over this size (default 16 KB). */
  maxBodyBytes?: number;
  /** Return the raw body text instead of parsed JSON (for signature checks). */
  rawBody?: boolean;
  /** Browser-callable (default true). Webhooks set false: no CORS at all. */
  cors?: boolean;
};

type Context<Authed extends boolean> = {
  req: Request;
  requestId: string;
  user: Authed extends true ? AuthedUser : AuthedUser | null;
  body: unknown;
  rawBody: string;
};

/**
 * The middleware every function goes through: CORS allowlist, POST-only,
 * body size cap, JSON parsing, auth, rate limiting, security headers,
 * request ids, and uniform error responses.
 */
export function handle<A extends boolean = true>(
  name: string,
  options: Options & { auth?: A },
  handler: (ctx: Context<A>) => Promise<unknown>,
) {
  const {
    auth = true,
    rateLimit,
    maxBodyBytes = 16 * 1024,
    rawBody = false,
    cors = true,
  } = options;

  Deno.serve(async (req) => {
    const requestId = crypto.randomUUID();
    const origin = cors ? req.headers.get("Origin") : null;
    const headers = { ...SECURITY_HEADERS, ...corsHeaders(origin), "X-Request-Id": requestId };
    const respond = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers });

    try {
      if (cors && origin && !isOriginAllowed(origin)) {
        throw new HttpError(403, "Origin not allowed");
      }
      if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
      if (req.method !== "POST") throw new HttpError(405, "Method not allowed");

      const declared = Number(req.headers.get("Content-Length") ?? 0);
      if (declared > maxBodyBytes) throw new HttpError(413, "Request too large");
      const text = await readBodyCapped(req, maxBodyBytes);

      let body: unknown = null;
      if (!rawBody && text) {
        try {
          body = JSON.parse(text);
        } catch {
          throw new HttpError(400, "Invalid request body");
        }
      }

      const user = auth || req.headers.get("Authorization") ? await authenticate(req) : null;
      if (auth && !user) throw new HttpError(401, "Sign in again to continue.");

      if (rateLimit) {
        const who =
          user?.id ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
        const { data: allowed, error } = await serviceClient().rpc("svc_hit_rate_limit", {
          p_key: `${name}:${who}`,
          p_max: rateLimit.max,
          p_window_seconds: rateLimit.windowSeconds,
        });
        // By default fail open on a limiter outage rather than taking the
        // feature down (logged so it's visible); money and destructive
        // actions opt into failing closed.
        if (error) {
          console.error(`[${requestId}] rate limiter error`, error);
          if (rateLimit.failClosed) {
            throw new HttpError(503, "This is temporarily unavailable. Try again shortly.");
          }
        } else if (allowed === false) {
          throw new HttpError(
            429,
            "You're doing that too often. Wait a minute and try again.",
            "RATE_LIMITED",
          );
        }
      }

      const result = await handler({
        req,
        requestId,
        user: user as Context<A>["user"],
        body,
        rawBody: text,
      });
      return respond(200, result ?? { ok: true });
    } catch (error) {
      if (error instanceof HttpError) {
        if (error.status >= 500) console.error(`[${requestId}] ${name}`, error.message);
        return respond(error.status, { error: error.message, code: error.code, requestId });
      }
      console.error(`[${requestId}] ${name} unhandled`, error);
      return respond(500, { error: "Something went wrong on our side. Try again.", requestId });
    }
  });
}
