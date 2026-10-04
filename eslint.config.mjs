import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Spec 3 and 6: core code reaches solutions only through the registries and
    // the contract. Solution folders and solution route folders are exempt.
    files: ["src/**/*.{ts,tsx,mts}"],
    ignores: ["src/solutions/**", "src/app/**/exam/**", "src/app/**/hiring/**", "src/components/hiring/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/solutions/*",
                "!@/solutions/registry",
                "!@/solutions/registry.server",
                "!@/solutions/types",
                "**/solutions/*",
                "**/solutions/*/**",
                "!**/solutions/registry",
                "!**/solutions/registry.server",
                "!**/solutions/types",
              ],
              message:
                "Core code reaches a solution only through @/solutions/registry, @/solutions/registry.server or @/solutions/types.",
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
