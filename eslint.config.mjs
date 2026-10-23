import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Spec 3 and 6: core code reaches solutions only through the registries and the contract.
const solutionBoundary = {
  group: [
    "@/solutions/*",
    "!@/solutions/registry",
    "!@/solutions/registry.server",
    "!@/solutions/types",
    "**/solutions/*",
    "**/solutions/*/**",
    "@/components/hiring/*",
    "**/components/hiring/*",
    "!**/solutions/registry",
    "!**/solutions/registry.server",
    "!**/solutions/types",
  ],
  message:
    "Core code reaches a solution only through @/solutions/registry, @/solutions/registry.server or @/solutions/types (and never into a solution's components).",
};

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
          patterns: [solutionBoundary],
        },
      ],
    },
  },
  {
    // T16: the how-it-works stage is inert and offline. No API client, no real
    // listening player or recorder (MediaItems, the media recorder), no proctor
    // engine. Repeats the solution boundary: a later rule replaces an earlier one.
    files: ["src/components/candidate/exam/tutorial/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            solutionBoundary,
            {
              group: [
                "@/lib/client/api",
                "**/lib/client/api",
                "@/lib/client/recorder",
                "**/lib/client/recorder",
                "@/lib/client/proctor/*",
                "**/lib/client/proctor/*",
                "@/components/candidate/exam/MediaItems",
                "**/MediaItems",
              ],
              message: "The tutorial stage is inert and offline: no API client, no real listening player or recorder, no proctor engine (see tutorial/no-network.test.ts).",
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
    // Vendored MediaPipe build (git-ignored, copied in by setup), not our code.
    "public/proctor/**",
  ]),
]);

export default eslintConfig;
