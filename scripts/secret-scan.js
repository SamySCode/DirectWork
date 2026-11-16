/* global console, Buffer */
// Refuses a commit that contains something that looks like a secret key or a
// file that should never be in git. No dependencies.
//
//   node scripts/secret-scan.js            staged files (the pre-commit hook)
//   node scripts/secret-scan.js --all      every tracked file (CI)
//
// Turn the hook on once per clone:  npm run hooks:install
// (git cannot install hooks by itself; see docs/OPERATIONS.md).
//
// A line that is a deliberate, harmless example can carry the comment
// `secret-scan:allow`. CI also runs gitleaks, which has far more rules; this
// script is the fast local guard for the keys this project actually uses.
const { execFileSync } = require("child_process");

/** Decodes a JWT payload without verifying it; null when it isn't one. */
function jwtRole(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

const RULES = [
  { name: "Supabase secret key", pattern: /\bsb_secret_[A-Za-z0-9_-]{16,}/ },
  {
    name: "Supabase service_role JWT",
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/,
    confirm: (match) => jwtRole(match) === "service_role",
  },
  { name: "Stripe live key", pattern: /\b[sr]k_live_[A-Za-z0-9]{16,}/ },
  { name: "Stripe webhook secret", pattern: /\bwhsec_[A-Za-z0-9]{24,}/ },
  { name: "AWS access key id", pattern: /\b(AKIA|ASIA)[A-Z0-9]{16}\b/ },
  { name: "Private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "GitHub token", pattern: /\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})/ },
  { name: "Expo access token", pattern: /\bexpo_[A-Za-z0-9_-]{30,}/ },
  {
    name: "Cloudflare API token assignment",
    pattern: /CLOUDFLARE_API_TOKEN\s*[=:]\s*["']?[A-Za-z0-9_-]{30,}/,
  },
  { name: "Slack token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: "Sentry auth token", pattern: /\bsntrys_[A-Za-z0-9_=-]{30,}/ },
  {
    name: "Secret assigned in an env line",
    pattern:
      /^(?!EXPO_PUBLIC_)[A-Z0-9_]*(SECRET|SERVICE_ROLE|PRIVATE_KEY|PASSWORD|SMTP_PASS)[A-Z0-9_]*\s*=\s*["']?[A-Za-z0-9+/_=-]{20,}["']?\s*$/,
  },
];

// Files that must never be committed, whatever is inside them.
const BLOCKED_FILES = [
  /(^|\/)\.env$/,
  /(^|\/)\.env\.(?!example$)[^/]+$/,
  /\.(pem|p8|p12|jks|keystore|mobileprovision)$/,
  /(^|\/)signing_keys\.json$/,
  /(^|\/)google-services\.json$/,
  /(^|\/)GoogleService-Info\.plist$/,
];

const SKIP_CONTENT =
  /\.(png|jpe?g|webp|gif|ico|ttf|otf|woff2?|pdf|zip)$|(^|\/)package-lock\.json$|(^|\/)deno\.lock$/;

function blockedFile(file) {
  return BLOCKED_FILES.some((pattern) => pattern.test(file.replace(/\\/g, "/")));
}

/** Findings for one file's text: [{ file, line, rule }]. */
function scanText(file, text) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (line.includes("secret-scan:allow")) return;
    for (const rule of RULES) {
      const match = line.match(rule.pattern);
      if (match && (!rule.confirm || rule.confirm(match[0]))) {
        findings.push({ file, line: index + 1, rule: rule.name });
      }
    }
  });
  return findings;
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
}

function main() {
  const all = process.argv.includes("--all");
  const files = git(
    all ? ["ls-files", "-z"] : ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"],
  )
    .split("\0")
    .filter(Boolean);
  const findings = [];
  for (const file of files) {
    if (blockedFile(file)) {
      findings.push({ file, line: 0, rule: "File type that must not be committed" });
      continue;
    }
    if (SKIP_CONTENT.test(file)) continue;
    let text;
    try {
      // Staged content, not the working copy: that is what would be committed.
      text = git(["show", `:${file}`]);
    } catch {
      continue;
    }
    if (text.includes("\u0000")) continue; // binary
    findings.push(...scanText(file, text));
  }
  if (findings.length === 0) {
    console.log(`secret-scan: ${files.length} ${all ? "tracked" : "staged"} files clean.`);
    return;
  }
  console.error("secret-scan: possible secrets found. Nothing was committed.");
  for (const finding of findings) {
    // The matched text is never printed, so the secret doesn't land in a log.
    console.error(`  ${finding.file}${finding.line ? `:${finding.line}` : ""}  ${finding.rule}`);
  }
  console.error(
    "Remove the secret (and rotate it if it was ever pushed: docs/OPERATIONS.md).\n" +
      "A harmless example line can be marked with the comment secret-scan:allow.",
  );
  process.exit(1);
}

module.exports = { RULES, scanText, blockedFile };
if (require.main === module) main();
