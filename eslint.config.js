// @ts-check
const eslint = require("@eslint/js");
const tseslint = require("typescript-eslint");
const eslintConfigPrettier = require("eslint-config-prettier");

module.exports = tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    ignores: ["node_modules", "dist", "web-build", ".expo"],
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
    files: ["*.config.js", "*.config.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { require: "readonly", module: "writable", __dirname: "readonly" },
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
);
