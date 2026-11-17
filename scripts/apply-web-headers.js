/* global console, URL */
// Writes the Supabase project host into the exported _headers file, so the
// Content-Security-Policy allows exactly one backend origin.
//
//   node scripts/apply-web-headers.js [dist dir] [supabase url]
//
// The URL defaults to EXPO_PUBLIC_SUPABASE_URL (the same variable the app is
// built with; a local .env.local is read too). `npm run build:web` runs this
// after `expo export`. It exits non-zero if the placeholder survives.
const fs = require("fs");
const path = require("path");

const PLACEHOLDER = "SUPABASE_PROJECT_HOST";

/** The host of a Supabase project URL; throws on anything that isn't https. */
function supabaseHost(url) {
  let parsed;
  try {
    parsed = new URL(String(url ?? "").trim());
  } catch {
    throw new Error("EXPO_PUBLIC_SUPABASE_URL is missing or not a URL.");
  }
  if (parsed.protocol !== "https:") throw new Error("The Supabase URL must start with https://");
  if (!/^[a-z0-9.-]+$/.test(parsed.hostname) || !parsed.hostname.includes(".")) {
    throw new Error(`Unexpected Supabase host: ${parsed.hostname}`);
  }
  return parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
}

/** Returns the headers text with every placeholder replaced by the host. */
function applyHeaders(text, url) {
  if (!text.includes(PLACEHOLDER)) {
    throw new Error(`No ${PLACEHOLDER} placeholder found: was _headers edited by hand?`);
  }
  // Comment lines keep the placeholder name so the explanation still reads.
  const out = text
    .split("\n")
    .map((line) => (line.startsWith("#") ? line : line.split(PLACEHOLDER).join(supabaseHost(url))))
    .join("\n");
  return out;
}

function hasPlaceholder(text) {
  return text.split("\n").some((line) => !line.startsWith("#") && line.includes(PLACEHOLDER));
}

function urlFromEnvFile(root) {
  for (const name of [".env.local", ".env"]) {
    const file = path.join(root, name);
    if (!fs.existsSync(file)) continue;
    const match = fs.readFileSync(file, "utf8").match(/^EXPO_PUBLIC_SUPABASE_URL=(.+)$/m);
    if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  }
  return undefined;
}

function main() {
  const root = path.join(__dirname, "..");
  const dist = path.resolve(process.argv[2] ?? path.join(root, "dist"));
  const url = process.argv[3] ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? urlFromEnvFile(root);
  const file = path.join(dist, "_headers");
  try {
    const out = applyHeaders(fs.readFileSync(file, "utf8"), url);
    if (hasPlaceholder(out)) throw new Error("Placeholder still present after replacement.");
    fs.writeFileSync(file, out);
    console.log(`Content-Security-Policy in ${file} now allows ${supabaseHost(url)}`);
  } catch (error) {
    console.error(`apply-web-headers failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { PLACEHOLDER, supabaseHost, applyHeaders, hasPlaceholder };
if (require.main === module) main();
