import { z } from "zod";

describe("zod under the web Content-Security-Policy", () => {
  it("never calls new Function once lib/env has loaded", () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    const original = global.Function;
    const calls: unknown[] = [];
    // Count dynamic code generation the way a CSP without unsafe-eval would block it.
    global.Function = new Proxy(original, {
      construct(target, args) {
        calls.push(args);
        return Reflect.construct(target, args);
      },
      apply(target, thisArg, args) {
        calls.push(args);
        return Reflect.apply(target, thisArg, args);
      },
    }) as FunctionConstructor;
    try {
      jest.isolateModules(() => {
        require("../env");
      });
      expect(z.config().jitless).toBe(true);
      const schema = z.object({ name: z.string().min(1), tags: z.array(z.string()) });
      expect(schema.safeParse({ name: "a", tags: ["b"] }).success).toBe(true);
      expect(calls).toHaveLength(0);
    } finally {
      global.Function = original;
    }
  });
});
