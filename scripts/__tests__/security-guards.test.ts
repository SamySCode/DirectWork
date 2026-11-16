// Guard tests for the owner's standing rules (docs/OPERATIONS.md):
//   1. no secret keys in the client bundle or in git,
//   2. the web security headers stay strict,
//   3. the product cannot send email, SMS or push to users,
//   4. only the two intended Edge Functions skip JWT verification,
//   5. the dependency audit gate works.
// Each one fails on purpose when a future change crosses the line. If a rule
// really has to change, change the test in the same commit and say why.
import fs from "fs";
import path from "path";

const { evaluate } = require("../audit-prod");
const { applyHeaders, hasPlaceholder, supabaseHost } = require("../apply-web-headers");
const { scanText, blockedFile } = require("../secret-scan");

const ROOT = path.join(__dirname, "..", "..");
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");

function walk(dir: string, out: string[] = []): string[] {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return out;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") walk(rel, out);
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs|json|sql|toml)$/.test(entry.name)) {
      out.push(rel);
    }
  }
  return out;
}

/** Drops comments, so prose about a rule doesn't trip the rule. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

const CLIENT_DIRS = ["app", "features", "lib", "components"];
const clientFiles = CLIENT_DIRS.flatMap((dir) => walk(dir));
const clientSources = clientFiles.filter((file) => !file.includes("/__tests__/"));

describe("client bundle: no secrets", () => {
  it("finds the client source files", () => {
    expect(clientSources.length).toBeGreaterThan(50);
  });

  it("only reads public (EXPO_PUBLIC_*) environment variables", () => {
    // Expo inlines EXPO_PUBLIC_* into the bundle; anything else would either
    // be undefined or, worse, a server secret someone tried to expose.
    const allowed = /^(EXPO_PUBLIC_[A-Z0-9_]+|NODE_ENV|EXPO_OS|JEST_WORKER_ID)$/;
    const offenders: string[] = [];
    for (const file of clientFiles) {
      const text = code(read(file));
      for (const match of text.matchAll(/process\.env\.([A-Za-z0-9_]+)/g)) {
        if (!allowed.test(match[1]!)) offenders.push(`${file}: process.env.${match[1]}`);
      }
      // Dynamic access (process.env[name]) hides which variable is read.
      if (/process\.env\s*\[/.test(text)) offenders.push(`${file}: process.env[...]`);
      if (/\bDeno\.env\b/.test(text)) offenders.push(`${file}: Deno.env`);
    }
    expect(offenders).toEqual([]);
  });

  it("never mentions a service_role or sb_secret key", () => {
    const offenders = clientFiles.filter((file) =>
      /service_role|sb_secret|SERVICE_ROLE_KEY|SUPABASE_SECRET/i.test(read(file)),
    );
    expect(offenders).toEqual([]);
  });

  it("only exposes the three known public variables", () => {
    const names = new Set<string>();
    for (const file of clientSources) {
      for (const match of read(file).matchAll(/EXPO_PUBLIC_[A-Z0-9_]+/g)) names.add(match[0]);
    }
    // Adding a public variable is fine, but it must be a deliberate choice:
    // everything listed here is readable by anyone who downloads the app.
    expect([...names].sort()).toEqual([
      "EXPO_PUBLIC_BILLING_ENABLED",
      "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "EXPO_PUBLIC_SUPABASE_URL",
    ]);
  });
});

describe("secret scan and .gitignore", () => {
  // Fake keys are assembled at run time so this file never contains a string
  // that a secret scanner (ours or gitleaks) would flag.
  const fakeJwt = (role: string) =>
    [
      { alg: "HS256", typ: "JWT" },
      { role, iss: "supabase", ref: "abcdefghijklmnop" },
    ]
      .map((part) => Buffer.from(JSON.stringify(part)).toString("base64url"))
      .concat("c2lnbmF0dXJlLXBsYWNlaG9sZGVy")
      .join(".");
  const samples: [string, string][] = [
    ["Supabase secret key", "sb_" + "secret_" + "a".repeat(32)],
    ["Supabase service_role JWT", fakeJwt("service_role")],
    ["Stripe live key", "sk_" + "live_" + "4".repeat(24)],
    ["Stripe webhook secret", "whsec" + "_" + "b".repeat(32)],
    ["AWS access key id", "AKIA" + "ABCDEFGHIJKLMNOP"],
    ["Private key", "-----BEGIN " + "PRIVATE KEY-----"],
    ["GitHub token", "ghp" + "_" + "c".repeat(36)],
    ["Secret assigned in an env line", "MAINTENANCE_SECRET=" + "d".repeat(64)],
  ];

  it.each(samples)("flags a %s", (rule, sample) => {
    const findings = scanText("x.ts", `const value = "ok";\n${sample}\n`);
    expect(findings.map((finding: { rule: string }) => finding.rule)).toContain(rule);
    expect(findings[0].line).toBe(2);
  });

  it("does not flag public keys, anon JWTs or empty env lines", () => {
    const harmless = [
      "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_" + "e".repeat(32),
      fakeJwt("anon"),
      "MAINTENANCE_SECRET=",
      "STRIPE_SECRET_KEY=<your key>",
      "sk_test_" + "5".repeat(24),
    ].join("\n");
    expect(scanText("x.env", harmless)).toEqual([]);
  });

  it("respects the allow marker", () => {
    expect(scanText("x.ts", `${samples[0]![1]} // secret-scan:allow`)).toEqual([]);
  });

  it("blocks key and env files by name, but not .env.example", () => {
    for (const file of [
      ".env",
      ".env.local",
      ".env.production",
      ".env.development",
      "certs/server.pem",
      "AuthKey_ABC123.p8",
      "dist.p12",
      "release.jks",
      "upload.keystore",
      "supabase/signing_keys.json",
      "android/app/google-services.json",
      "ios/GoogleService-Info.plist",
    ]) {
      expect([file, blockedFile(file)]).toEqual([file, true]);
    }
    expect(blockedFile(".env.example")).toBe(false);
    expect(blockedFile("app.json")).toBe(false);
  });

  it(".gitignore covers every credential file type", () => {
    const lines = read(".gitignore").split(/\r?\n/);
    for (const pattern of [
      ".env",
      ".env.local",
      ".env.*.local",
      ".env.production",
      ".env.development",
      "*.pem",
      "*.p8",
      "*.p12",
      "*.jks",
      "*.keystore",
      "signing_keys.json",
      "google-services.json",
      "GoogleService-Info.plist",
    ]) {
      expect(lines).toContain(pattern);
    }
  });

  it("the pre-commit hook runs the scan", () => {
    expect(read("scripts/git-hooks/pre-commit")).toContain("node scripts/secret-scan.js");
    expect(JSON.parse(read("package.json")).scripts["hooks:install"]).toBe(
      "git config core.hooksPath scripts/git-hooks",
    );
  });
});

describe("web headers (public/_headers)", () => {
  type Rule = { path: string; headers: Record<string, string> };
  const rules: Rule[] = [];
  for (const line of read("public/_headers").split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("#")) continue;
    if (!/^\s/.test(line)) rules.push({ path: line.trim(), headers: {} });
    else {
      const colon = line.indexOf(":");
      rules.at(-1)!.headers[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
    }
  }
  const rule = (rulePath: string) => rules.find((r) => r.path === rulePath)!.headers;
  const csp = Object.fromEntries(
    rule("/*")
      ["Content-Security-Policy"]!.split(";")
      .map((directive) => directive.trim().split(/\s+/))
      .map(([name, ...values]) => [name, values]),
  ) as Record<string, string[]>;

  it("has the agreed Content-Security-Policy, directive by directive", () => {
    expect(csp).toEqual({
      "default-src": ["'self'"],
      "script-src": ["'self'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", "data:", "blob:", "https://SUPABASE_PROJECT_HOST"],
      "font-src": ["'self'", "data:"],
      "connect-src": [
        "'self'",
        "data:",
        "blob:",
        "https://SUPABASE_PROJECT_HOST",
        "wss://SUPABASE_PROJECT_HOST",
      ],
      "manifest-src": ["'self'"],
      "worker-src": ["'self'"],
      "frame-src": ["'none'"],
      "frame-ancestors": ["'none'"],
      "base-uri": ["'self'"],
      "form-action": ["'self'"],
      "object-src": ["'none'"],
    });
  });

  it("never allows eval, inline script, wildcards or plain http", () => {
    const policy = rule("/*")["Content-Security-Policy"]!;
    expect(policy).not.toMatch(/unsafe-eval|wasm-unsafe-eval|\*|http:|'unsafe-hashes'/);
    expect(csp["script-src"]).toEqual(["'self'"]);
  });

  it("keeps the other security headers", () => {
    expect(rule("/*")).toMatchObject({
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
      "Cross-Origin-Resource-Policy": "same-origin",
    });
    expect(rule("/*")["Permissions-Policy"]).toContain("camera=()");
  });

  it("caches hashed assets for a year and never caches the page", () => {
    const immutable = "public, max-age=31536000, immutable";
    expect(rule("/_expo/static/*")["Cache-Control"]).toBe(immutable);
    expect(rule("/assets/*")["Cache-Control"]).toBe(immutable);
    expect(rule("/")["Cache-Control"]).toBe("no-cache");
    expect(rule("/index.html")["Cache-Control"]).toBe("no-cache");
    // Hosts join a header set by two matching rules, so the catch-all rule
    // must not set Cache-Control itself.
    expect(rule("/*")["Cache-Control"]).toBeUndefined();
  });

  it("build step swaps the placeholder for exactly one Supabase host", () => {
    const out = applyHeaders(read("public/_headers"), "https://abcdefgh.supabase.co/");
    expect(hasPlaceholder(out)).toBe(false);
    expect(out).toContain(
      "connect-src 'self' data: blob: https://abcdefgh.supabase.co wss://abcdefgh.supabase.co;",
    );
    expect(out).toContain("img-src 'self' data: blob: https://abcdefgh.supabase.co;");
    expect(hasPlaceholder(read("public/_headers"))).toBe(true);
  });

  it("build step refuses a missing, non-https or odd URL", () => {
    expect(() => supabaseHost(undefined)).toThrow();
    expect(() => supabaseHost("http://abcdefgh.supabase.co")).toThrow();
    expect(() => supabaseHost("https://*.supabase.co")).toThrow();
    expect(() => applyHeaders("/*\n  X-Test: 1\n", "https://abcdefgh.supabase.co")).toThrow();
  });
});

describe("no unsolicited communications", () => {
  // The only messages DirectWork ever sends are Supabase Auth's own account
  // emails (confirm your address, reset your password), each triggered by the
  // person themselves. Nothing here may add another channel without the
  // owner's say-so (and a PECR check: docs/OPERATIONS.md).
  const BANNED_PACKAGES =
    /^(expo-notifications|expo-server-sdk|expo-sms|nodemailer|emailjs|@emailjs\/.*|resend|@react-email\/.*|react-email|@sendgrid\/.*|sendgrid|postmark|mailgun.*|@mailchimp\/.*|mailchimp.*|mandrill.*|@getbrevo\/.*|sib-api-v3-sdk|customerio.*|klaviyo.*|@klaviyo\/.*|@aws-sdk\/client-(ses|sesv2|sns|pinpoint.*)|aws-sdk|twilio|@twilio\/.*|messagebird|@vonage\/.*|nexmo|plivo|telnyx|onesignal.*|react-native-onesignal|@onesignal\/.*|firebase|firebase-admin|@react-native-firebase\/.*|@notifee\/.*|web-push|node-pushnotifications|apn|@parse\/node-apn|pusher.*|@pusher\/.*|@knocklabs\/.*|@novu\/.*|courier.*|@trycourier\/.*|intercom.*|@intercom\/.*|braze.*|@braze\/.*)$/;

  const BANNED_IN_CODE: [string, RegExp][] = [
    [
      "mail API host",
      /api\.(resend|sendgrid|mailgun|postmarkapp|brevo|mailjet|sparkpost|elasticemail)\.(com|net)|mandrillapp\.com|amazonses\.com|email(-smtp)?\.[a-z0-9-]+\.amazonaws\.com|api\.mailchimp\.com|api\.customer\.io|a\.klaviyo\.com/i,
    ],
    [
      "SMS API host",
      /api\.twilio\.com|rest\.nexmo\.com|api\.vonage\.com|rest\.messagebird\.com|api\.plivo\.com|sns\.[a-z0-9-]+\.amazonaws\.com/i,
    ],
    [
      "push API host",
      /exp\.host\/--\/api\/v2\/push|fcm\.googleapis\.com|api\.push\.apple\.com|api\.sandbox\.push\.apple\.com|onesignal\.com/i,
    ],
    ["SMTP use", /smtps?:\/\/|\bnodemailer\b|createTransport\s*\(|Deno\.connect(Tls)?\s*\(/],
    [
      "push token or notification API",
      /getExpoPushTokenAsync|getDevicePushTokenAsync|scheduleNotificationAsync|PushNotificationIOS|new Notification\s*\(|pushManager\.subscribe|Notification\.requestPermission/,
    ],
    [
      "database-side HTTP or mail call",
      /\bnet\.http_(post|get|collect)|\bextensions\.http\b|\bhttp_post\s*\(|\bpg_net\b|\bpgmq\b.*mail/i,
    ],
  ];

  const serverFiles = [...walk("supabase/functions"), ...walk("supabase/migrations")];
  const scanned = [...clientSources, ...serverFiles].filter(
    (file) => !/\.test\.ts$/.test(file) && !/\.json$/.test(file),
  );

  it("scans the app, the Edge Functions and the migrations", () => {
    expect(scanned.some((file) => file.startsWith("supabase/functions/"))).toBe(true);
    expect(scanned.some((file) => file.startsWith("supabase/migrations/"))).toBe(true);
    expect(scanned.length).toBeGreaterThan(80);
  });

  it("package.json has no email, SMS or push package", () => {
    const pkg = JSON.parse(read("package.json"));
    const names = [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies",
    ].flatMap((section) => Object.keys(pkg[section] ?? {}));
    expect(names.length).toBeGreaterThan(20);
    expect(names.filter((name) => BANNED_PACKAGES.test(name))).toEqual([]);
  });

  it("the banned-package list catches the obvious ones", () => {
    for (const name of [
      "expo-notifications",
      "nodemailer",
      "resend",
      "@sendgrid/mail",
      "@aws-sdk/client-ses",
      "@aws-sdk/client-sesv2",
      "@aws-sdk/client-sns",
      "twilio",
      "onesignal-node",
      "@react-native-firebase/messaging",
      "web-push",
    ]) {
      expect([name, BANNED_PACKAGES.test(name)]).toEqual([name, true]);
    }
    for (const name of ["expo", "expo-router", "@supabase/supabase-js", "zod", "react"]) {
      expect([name, BANNED_PACKAGES.test(name)]).toEqual([name, false]);
    }
  });

  it("app.json has no notification plugin or permission", () => {
    expect(read("app.json")).not.toMatch(
      /notification|expo-sms|aps-environment|POST_NOTIFICATIONS/i,
    );
  });

  it("Edge Functions import only Supabase, zod and the test assertions", () => {
    const imports = new Set<string>();
    for (const file of walk("supabase/functions")) {
      for (const match of read(file).matchAll(/from\s+["']((?:npm|jsr|https?|node):[^"']+)["']/g)) {
        imports.add(match[1]!.replace(/@[\d.^~]+$/, ""));
      }
      for (const match of read(file).matchAll(
        /import\s*\(\s*["']((?:npm|jsr|https?|node):[^"']+)["']/g,
      )) {
        imports.add(match[1]!.replace(/@[\d.^~]+$/, ""));
      }
    }
    expect([...imports].sort()).toEqual([
      "jsr:@std/assert",
      "npm:@supabase/supabase-js",
      "npm:zod",
    ]);
  });

  it("the only outbound fetch in the Edge Functions is to Stripe", () => {
    const callers = walk("supabase/functions")
      .filter((file) => !/\.test\.ts$/.test(file) && /\bfetch\s*\(/.test(code(read(file))))
      .sort();
    expect(callers).toEqual(["supabase/functions/_shared/stripe.ts"]);
    const urls = [
      ...read("supabase/functions/_shared/stripe.ts").matchAll(/fetch\s*\(\s*`?["']?([^,)\s]+)/g),
    ];
    expect(urls.map((match) => match[1]!.slice(0, 26))).toEqual(["https://api.stripe.com/v1/"]);
  });

  it("no code talks to a mail, SMS or push service", () => {
    const offenders: string[] = [];
    for (const file of scanned) {
      const text = code(read(file)).replace(/^\s*--.*$/gm, "");
      for (const [label, pattern] of BANNED_IN_CODE) {
        if (pattern.test(text)) offenders.push(`${file}: ${label}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("server code never asks Supabase Auth to email or text anyone", () => {
    // These Auth calls send a message. From an Edge Function or the database
    // that would be a message the user did not ask for.
    const sends =
      /inviteUserByEmail|generateLink|signInWithOtp|resetPasswordForEmail|auth\.resend\s*\(|auth\.reauthenticate\s*\(|signUp\s*\(/;
    expect(
      serverFiles.filter((file) => !/\.test\.ts$/.test(file) && sends.test(code(read(file)))),
    ).toEqual([]);
  });

  it("in the app, only the auth screens' API can trigger an account email", () => {
    // Sign-up confirmation, resend-confirmation and password reset: each is
    // sent by Supabase Auth because the person pressed the button.
    const sends =
      /auth\s*\.\s*(signUp|resend|resetPasswordForEmail|signInWithOtp|reauthenticate)\s*\(|inviteUserByEmail|generateLink/;
    expect(clientSources.filter((file) => sends.test(code(read(file)))).sort()).toEqual([
      "features/auth/api.ts",
    ]);
    const api = code(read("features/auth/api.ts"));
    expect(api).not.toMatch(/signInWithOtp|inviteUserByEmail|generateLink|phone\s*:/);
  });

  it("Supabase Auth config keeps SMS, phone MFA and invites off", () => {
    const toml = read("supabase/config.toml");
    const section = (name: string) =>
      toml.split(/^\[/m).find((block) => block.startsWith(`${name}]`)) ?? "";
    expect(section("auth.sms")).toMatch(/^enable_signup = false$/m);
    expect(section("auth.sms.twilio")).toMatch(/^enabled = false$/m);
    expect(section("auth.mfa.phone")).toMatch(/^enroll_enabled = false$/m);
    expect(section("auth.mfa.phone")).toMatch(/^verify_enabled = false$/m);
    // No active (uncommented) hook, SMS provider or notification email.
    const active = toml
      .split(/\r?\n/)
      .filter((line) => /^\[/.test(line))
      .map((line) => line.trim());
    expect(
      active.filter((line) =>
        /auth\.hook|auth\.email\.notification|auth\.email\.template\.invite/.test(line),
      ),
    ).toEqual([]);
    const enabledSms = toml
      .split(/^\[/m)
      .filter((block) => /^auth\.sms\.[a-z_]+\]/.test(block) && /^enabled = true$/m.test(block));
    expect(enabledSms).toEqual([]);
  });
});

describe("Edge Function exposure (supabase/config.toml)", () => {
  const toml = read("supabase/config.toml");
  const functions = fs
    .readdirSync(path.join(ROOT, "supabase/functions"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => entry.name)
    .sort();
  const noJwt = [...toml.matchAll(/^\[functions\.([a-z0-9-]+)\]\s*\r?\nverify_jwt = false$/gm)]
    .map((match) => match[1]!)
    .sort();

  it("knows every deployed function", () => {
    // A new function must be added here on purpose, with its auth decided.
    expect(functions).toEqual([
      "actions",
      "billing",
      "billing-webhook",
      "delete-account",
      "maintenance",
    ]);
  });

  it("only the Stripe webhook and the scheduled job skip the gateway JWT check", () => {
    expect(noJwt).toEqual(["billing-webhook", "maintenance"]);
    expect(toml.match(/verify_jwt/g)!.filter(Boolean)).toHaveLength(
      // two settings plus one mention in the comment above them
      3,
    );
  });

  it("those two authenticate the caller themselves and answer no browser", () => {
    const webhook = code(read("supabase/functions/billing-webhook/handler.ts"));
    expect(webhook).toMatch(/cors:\s*false/);
    expect(webhook).toMatch(/requiredHeader:\s*"Stripe-Signature"/);
    const maintenance = code(read("supabase/functions/maintenance/handler.ts"));
    expect(maintenance).toMatch(/cors:\s*false/);
    expect(maintenance).toMatch(/x-maintenance-key/);
    expect(maintenance).toMatch(/MAINTENANCE_SECRET/);
  });

  it("every other function keeps the default: a signed-in user is required", () => {
    for (const name of ["actions", "billing", "delete-account"]) {
      const files = walk(`supabase/functions/${name}`).filter((file) => !/\.test\.ts$/.test(file));
      const text = files.map((file) => code(read(file))).join("\n");
      expect([name, /auth:\s*false/.test(text)]).toEqual([name, false]);
      expect([name, /cors:\s*false/.test(text)]).toEqual([name, false]);
      expect([name, /rateLimit:/.test(text)]).toEqual([name, true]);
    }
  });

  it("CORS never falls back to a wildcard", () => {
    const http = code(read("supabase/functions/_shared/http.ts"));
    expect(http).not.toMatch(/Access-Control-Allow-Origin["']?\s*:\s*["']\*/);
    expect(http).not.toMatch(/Access-Control-Allow-Credentials/);
  });
});

describe("dependency audit gate (scripts/audit-prod.js)", () => {
  const report = {
    vulnerabilities: {
      "bad-lib": {
        severity: "high",
        via: [
          {
            name: "bad-lib",
            severity: "high",
            url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc",
            title: "bad",
          },
        ],
      },
      parent: { severity: "high", via: ["bad-lib"] },
      meh: {
        severity: "moderate",
        via: [
          {
            name: "meh",
            severity: "moderate",
            url: "https://github.com/advisories/GHSA-dddd-eeee-ffff",
            title: "meh",
          },
        ],
      },
    },
  };
  const entry = {
    id: "GHSA-aaaa-bbbb-cccc",
    package: "bad-lib",
    reason: "build tool",
    expires: "2027-01-31",
  };

  it("fails on an unlisted high advisory and ignores moderate ones", () => {
    const result = evaluate(report, { advisories: [] }, "2026-11-12");
    expect(result.ok).toBe(false);
    expect(result.blocking.map((a: { id: string }) => a.id)).toEqual(["GHSA-aaaa-bbbb-cccc"]);
  });

  it("passes when the advisory is allowlisted and in date", () => {
    expect(evaluate(report, { advisories: [entry] }, "2026-11-12").ok).toBe(true);
  });

  it("fails again once the allowlist entry expires", () => {
    const result = evaluate(report, { advisories: [entry] }, "2027-02-01");
    expect(result.ok).toBe(false);
    expect(result.expired).toHaveLength(1);
  });

  it("an entry for a different package does not cover the advisory", () => {
    expect(
      evaluate(report, { advisories: [{ ...entry, package: "other" }] }, "2026-11-12").ok,
    ).toBe(false);
  });

  it("rejects allowlist entries without a reason or an expiry", () => {
    expect(evaluate(report, { advisories: [{ ...entry, reason: "" }] }, "2026-11-12").ok).toBe(
      false,
    );
    expect(
      evaluate(report, { advisories: [{ ...entry, expires: "never" }] }, "2026-11-12").ok,
    ).toBe(false);
  });

  it("the committed allowlist is well formed and nothing in it is open-ended", () => {
    const allowlist = JSON.parse(read(".github/audit-allowlist.json"));
    const result = evaluate({ vulnerabilities: {} }, allowlist, "2026-11-12");
    expect(result.malformed).toEqual([]);
    for (const item of allowlist.advisories) {
      // At most about six months out, so each one gets looked at again.
      expect(item.expires <= "2027-06-30").toBe(true);
    }
  });

  it("CI runs the audit gate and the secret scans", () => {
    const ci = read(".github/workflows/ci.yml");
    expect(ci).toContain("npm run audit:prod");
    expect(ci).toContain("npm run scan:secrets");
    expect(ci).toMatch(/gitleaks\/gitleaks-action@[0-9a-f]{40}/);
  });
});
