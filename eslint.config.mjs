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
    ],
  },
  ...next,
  prettier,
];

export default eslintConfig;
