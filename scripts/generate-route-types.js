// Regenerates .expo/types/router.d.ts (Expo Router's typed routes) without
// starting the dev server - the same call `expo start` makes on boot. Needed
// for `npm run typecheck` in CI, where no dev server ever runs and .expo/ is
// gitignored.
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
process.env.EXPO_ROUTER_APP_ROOT = path.join(projectRoot, "app");

// @expo/cli may be hoisted to the root or nested under expo depending on the
// install, so resolve it from expo's own folder (which finds either).
const expoDir = path.dirname(require.resolve("expo/package.json"));
const cliPackage = require.resolve("@expo/cli/package.json", { paths: [expoDir] });
const typedRoutes = require(
  require.resolve("@expo/router-server/build/typed-routes", { paths: [cliPackage] }),
);
const typesDirectory = path.join(projectRoot, ".expo", "types");
require("fs").mkdirSync(typesDirectory, { recursive: true });
typedRoutes.regenerateDeclarations(typesDirectory, {});
