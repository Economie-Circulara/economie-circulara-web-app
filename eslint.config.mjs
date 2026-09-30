import next from "eslint-config-next";
import prettier from "eslint-config-prettier";

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "docs/**",
      // Site-urile din sites/ au build-ul lor (typecheck-ul lor ruleaza separat in CI).
      "sites/*/node_modules/**",
      "sites/*/.next/**",
      "sites/*/out/**",
      "sites/*/next-env.d.ts",
    ],
  },
  ...next,
  prettier,
];

export default eslintConfig;
