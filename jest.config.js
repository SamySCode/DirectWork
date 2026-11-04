// Unit + component tests (React Native Testing Library on jest-expo).
// Database tests are separate: npm run test:db (supabase/tests/db).
module.exports = {
  preset: "jest-expo",
  setupFiles: ["<rootDir>/test/setup.js"],
  testMatch: ["**/__tests__/**/*.test.ts?(x)"],
  testPathIgnorePatterns: ["/node_modules/", "/supabase/", "/dist/", "/.expo/"],
  collectCoverageFrom: [
    "components/**/*.{ts,tsx}",
    "features/**/*.{ts,tsx}",
    "lib/**/*.{ts,tsx}",
    "!**/__tests__/**",
  ],
};
