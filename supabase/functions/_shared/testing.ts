// Test doubles for the Edge Function handlers: a fake service-role client,
// fake JWTs and a fetch stub. Nothing here touches the network. Imported
// only by *.test.ts files, so it's never part of a deployed function.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2.112.2";
import type { AuthMethod, Deps } from "./http.ts";

type Result = { data?: unknown; error?: { code?: string; message: string } | null };

function base64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** An unsigned JWT-shaped token; the fake getUser() decides if it's valid. */
export function fakeJwt(payload: Record<string, unknown>): string {
  return `${base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${base64Url(
    JSON.stringify(payload),
  )}.signature`;
}

export const USER_ID = "11111111-1111-4111-8111-111111111111";

export function amrAt(method: string, secondsAgo: number): AuthMethod {
  return { method, timestamp: Math.floor(Date.now() / 1000) - secondsAgo };
}

export function tokenFor(amr: AuthMethod[], sub = USER_ID): string {
  return fakeJwt({ sub, role: "authenticated", amr });
}

export type FakeOptions = {
  /** token -> user id that getUser() returns (default: the token's own sub). */
  users?: (token: string) => string | null;
  rpc?: Record<string, (args: Record<string, unknown> | undefined) => Result>;
  /** Result of from(table).select(...).eq(...).maybeSingle(). */
  table?: (table: string) => Result;
  list?: (bucket: string, prefix: string, offset: number) => Result;
  remove?: (bucket: string, paths: string[]) => Result;
  deleteUser?: (id: string) => Result;
};

/** A fake service-role client that records every call it receives in `calls`. */
export function fakeAdmin(options: FakeOptions = {}) {
  const calls: string[] = [];
  const args: Record<string, unknown[]> = {};
  const record = (call: string, arg?: unknown) => {
    calls.push(call);
    (args[call] ??= []).push(arg);
  };
  const ok = (data: unknown = null): Result => ({ data, error: null });

  const client = {
    auth: {
      getUser: async (token: string) => {
        record("auth.getUser");
        const sub = JSON.parse(
          atob(token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/")),
        ).sub;
        const id = options.users ? options.users(token) : sub;
        return id
          ? { data: { user: { id, email: "a@example.com" } }, error: null }
          : { data: { user: null }, error: { message: "bad token" } };
      },
      admin: {
        deleteUser: async (id: string) => {
          record("auth.admin.deleteUser", id);
          return options.deleteUser?.(id) ?? ok();
        },
      },
    },
    rpc: async (name: string, params?: Record<string, unknown>) => {
      record(`rpc:${name}`, params);
      if (options.rpc?.[name]) return { data: null, error: null, ...options.rpc[name](params) };
      if (name === "svc_hit_rate_limit") return ok(true);
      return ok();
    },
    from: (table: string) => {
      record(`from:${table}`);
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({ data: null, error: null, ...options.table?.(table) }),
      };
      return builder;
    },
    storage: {
      from: (bucket: string) => ({
        list: async (prefix: string, opts: { offset: number }) => {
          record(`storage.list:${bucket}`, prefix);
          return { data: [], error: null, ...options.list?.(bucket, prefix, opts.offset) };
        },
        remove: async (paths: string[]) => {
          record(`storage.remove:${bucket}`, paths);
          return { data: [], error: null, ...options.remove?.(bucket, paths) };
        },
      }),
    },
  };
  return { client: client as unknown as SupabaseClient, calls, args };
}

export function depsFor(
  admin: ReturnType<typeof fakeAdmin>,
  env: Record<string, string> = {},
): Deps {
  return { admin: () => admin.client, env: (name) => env[name] };
}

export type FetchCall = { url: string; method: string; headers: Headers };

/** Replaces global fetch for the duration of `run`; records each call. */
export async function withFetch<T>(
  respond: (call: FetchCall) => Response,
  run: (calls: FetchCall[]) => Promise<T>,
): Promise<T> {
  const original = globalThis.fetch;
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const call = {
      url: String(input),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
    };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
  try {
    return await run(calls);
  } finally {
    globalThis.fetch = original;
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function post(headers: Record<string, string> = {}, body = ""): Request {
  return new Request("http://localhost/fn", { method: "POST", headers, body });
}
