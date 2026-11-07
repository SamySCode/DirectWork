// Pre-launch check: fails while legal/operator placeholders remain.
// Run `npm run check:launch` before a store submission or public launch.
// Deliberately NOT part of `npm run check` / CI - placeholders are expected
// until the owner has the company, ICO and contact details.
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const OPERATOR_FILE = path.join(root, "features", "legal", "operator.json");
const DOCUMENTS_DIR = path.join(root, "features", "legal", "documents");

// An uppercase [PLACEHOLDER] inside document text (not array/index syntax).
const DOC_PLACEHOLDER = /\[[A-Z][A-Z0-9 ,.'"/()-]{2,}\]/g;

/** Operator fields whose value still contains "[" (unfilled placeholder). */
function findOperatorPlaceholders(operator) {
  return Object.entries(operator)
    .filter(([, value]) => typeof value !== "string" || value.trim() === "" || value.includes("["))
    .map(([key, value]) => `operator.json "${key}": ${JSON.stringify(value)}`);
}

/** [PLACEHOLDER]s written straight into document source text. */
function findDocumentPlaceholders(files) {
  const problems = [];
  for (const [file, source] of files) {
    for (const match of source.matchAll(DOC_PLACEHOLDER)) {
      problems.push(`${file}: ${match[0]}`);
    }
  }
  return problems;
}

function run() {
  const operator = JSON.parse(fs.readFileSync(OPERATOR_FILE, "utf8"));
  const files = fs
    .readdirSync(DOCUMENTS_DIR)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => [
      path.join("features", "legal", "documents", name),
      fs.readFileSync(path.join(DOCUMENTS_DIR, name), "utf8"),
    ]);
  const problems = [...findOperatorPlaceholders(operator), ...findDocumentPlaceholders(files)];
  if (problems.length) {
    process.stderr.write(
      `check:launch failed - fill in these placeholders before launch:\n  ${problems.join("\n  ")}\n`,
    );
    process.exitCode = 1;
    return;
  }
  process.stdout.write("check:launch passed - no legal placeholders left.\n");
}

module.exports = { findOperatorPlaceholders, findDocumentPlaceholders };

if (require.main === module) run();
