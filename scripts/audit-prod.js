/* global console */
// Fails when a production dependency has a high or critical advisory that is
// not on the allowlist. Run: npm run audit:prod (CI runs it on every PR).
//
// Allowlist: .github/audit-allowlist.json. Each entry needs the advisory id
// (GHSA-...), the package, a reason and an expiry date (YYYY-MM-DD). An
// expired entry fails the build again, so nothing is ignored for ever. Only
// add an entry when `npm audit fix` (never --force) can't fix it and you have
// written down why it is acceptable. See docs/OPERATIONS.md.
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const BLOCKING = new Set(["high", "critical"]);

/** Flattens `npm audit --json` into one entry per advisory. */
function advisories(report) {
  const found = new Map();
  for (const [name, vulnerability] of Object.entries(report.vulnerabilities ?? {})) {
    for (const via of vulnerability.via ?? []) {
      if (typeof via === "string") continue; // inherited: the root advisory is listed itself
      const id = String(via.url ?? "")
        .split("/")
        .pop();
      if (!id) continue;
      found.set(id, { id, package: via.name ?? name, severity: via.severity, title: via.title });
    }
  }
  return [...found.values()];
}

/**
 * @param report parsed `npm audit --json`
 * @param allowlist parsed .github/audit-allowlist.json
 * @param today YYYY-MM-DD
 */
function evaluate(report, allowlist, today) {
  const entries = allowlist.advisories ?? [];
  const malformed = entries.filter(
    (entry) =>
      !/^GHSA-/.test(entry.id ?? "") ||
      !entry.package ||
      !entry.reason ||
      !/^\d{4}-\d{2}-\d{2}$/.test(entry.expires ?? ""),
  );
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const serious = advisories(report).filter((advisory) => BLOCKING.has(advisory.severity));
  const blocking = [];
  const allowed = [];
  const expired = [];
  for (const advisory of serious) {
    const entry = byId.get(advisory.id);
    if (!entry || entry.package !== advisory.package) blocking.push(advisory);
    else if (entry.expires < today) expired.push(advisory);
    else allowed.push(advisory);
  }
  const seen = new Set(serious.map((advisory) => advisory.id));
  const unused = entries.filter((entry) => !seen.has(entry.id));
  return {
    blocking,
    allowed,
    expired,
    unused,
    malformed,
    ok: blocking.length === 0 && expired.length === 0 && malformed.length === 0,
  };
}

function runAudit() {
  try {
    return execSync("npm audit --omit=dev --json", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    // npm exits 1 whenever anything at all is reported; the JSON is on stdout.
    if (error.stdout) return error.stdout;
    throw error;
  }
}

function main() {
  const root = path.join(__dirname, "..");
  const allowlist = JSON.parse(
    fs.readFileSync(path.join(root, ".github", "audit-allowlist.json"), "utf8"),
  );
  const report = JSON.parse(runAudit());
  if (!report.vulnerabilities) {
    console.error("npm audit gave no report (registry unreachable?).", report.error ?? "");
    process.exit(2);
  }
  const result = evaluate(report, allowlist, new Date().toISOString().slice(0, 10));
  const line = (a) => `  ${a.severity ?? ""} ${a.package} ${a.id} ${a.title ?? a.reason ?? ""}`;
  if (result.allowed.length) {
    console.log("Allowlisted (see .github/audit-allowlist.json):");
    result.allowed.forEach((a) => console.log(line(a)));
  }
  if (result.unused.length) {
    console.log("Allowlist entries no longer needed (remove them):");
    result.unused.forEach((a) => console.log(line(a)));
  }
  if (result.malformed.length) {
    console.error("Allowlist entries missing id, package, reason or expires:");
    result.malformed.forEach((a) => console.error(`  ${JSON.stringify(a)}`));
  }
  if (result.expired.length) {
    console.error("Allowlist entries past their expiry date (fix or re-justify):");
    result.expired.forEach((a) => console.error(line(a)));
  }
  if (result.blocking.length) {
    console.error("High or critical advisories in production dependencies:");
    result.blocking.forEach((a) => console.error(line(a)));
    console.error("Run `npm audit fix` (never --force). See docs/OPERATIONS.md.");
  }
  if (!result.ok) process.exit(1);
  console.log("audit:prod passed: no unlisted high or critical advisories.");
}

module.exports = { advisories, evaluate };
if (require.main === module) main();
