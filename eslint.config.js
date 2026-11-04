// @ts-check
const eslint = require("@eslint/js");
const tseslint = require("typescript-eslint");
const eslintConfigPrettier = require("eslint-config-prettier");

module.exports = tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    ignores: ["node_modules", "dist", "web-build", ".expo", "supabase/functions"],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react-native",
              importNames: ["Text"],
              message:
                "Import Text from components/Text instead - it applies the app's font family. Without it, React Native Web falls back to the browser's default serif font.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["components/Text.tsx"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    files: ["*.config.js", "*.config.cjs", "scripts/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        require: "readonly",
        module: "writable",
        __dirname: "readonly",
        process: "writable",
      },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["lib/fonts.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["supabase/tests/**/*.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: { process: "readonly", console: "readonly" },
    },
  },
  {
    // jest.mock() factories are hoisted above imports, so they must use
    // require(); the setup/config files are CommonJS. Scoped to tests only.
    files: ["**/__tests__/**/*.{ts,tsx}", "test/**/*.{js,ts,tsx}", "jest.config.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { jest: "readonly", require: "readonly", module: "writable", process: "writable" },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["supabase/tests/db/**/*.mjs"],
    languageOptions: {
      globals: { process: "readonly", console: "readonly", Buffer: "readonly" },
    },
  },
);
