import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // These directories/entry points belong to the browser UI.
    files: [
      "components/**/*.{ts,tsx}",
      "app/**/error.tsx",
      "app/global-error.tsx",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/lib/server/**",
                "@trainiq/domain",
                "@trainiq/domain/*",
                "@trainiq/recommendation",
                "@trainiq/recommendation/*",
                "@trainiq/intervals",
                "@trainiq/intervals/*",
                "@trainiq/weather",
                "@trainiq/weather/*",
              ],
              message:
                "Load planning through the server caller and pass data to the UI.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
