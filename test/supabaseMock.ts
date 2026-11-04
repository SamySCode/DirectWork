// A tiny stand-in for supabase-js's chainable query builder. Every chained
// call (.select().eq().order()...) is recorded, and awaiting the chain
// resolves to the next queued result for that table - enough to test the
// logic around queries (ordering, rollbacks, error mapping) without a
// database. Database behaviour itself is covered by supabase/tests/db.

type Result = { data?: unknown; error?: unknown };

export function createSupabaseMock() {
  const queues = new Map<string, Result[]>();
  const calls: { target: string; method: string; args: unknown[] }[] = [];

  const chain = (target: string): unknown => {
    const proxy: unknown = new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === "then") {
            const next = queues.get(target)?.shift() ?? { data: null, error: null };
            return (resolve: (value: Result) => void) =>
              resolve({ data: null, error: null, ...next });
          }
          return (...args: unknown[]) => {
            calls.push({ target, method: String(prop), args });
            return proxy;
          };
        },
      },
    );
    return proxy;
  };

  const supabase = {
    from: (table: string) => chain(table),
    rpc: (fn: string, args: unknown) => {
      calls.push({ target: `rpc:${fn}`, method: "rpc", args: [args] });
      return chain(`rpc:${fn}`);
    },
    storage: {
      from: (bucket: string) => ({
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn/${bucket}/${path}` } }),
      }),
    },
  };

  return {
    supabase,
    calls,
    /** Queue results returned, in order, by awaited chains on this table/rpc. */
    queue(target: string, ...results: Result[]) {
      queues.set(target, [...(queues.get(target) ?? []), ...results]);
    },
    callsTo(target: string) {
      return calls.filter((call) => call.target === target);
    },
    reset() {
      queues.clear();
      calls.length = 0;
    },
  };
}
