import type { NextConfig } from "next";
import { LEGACY_CANDIDATE_API_REWRITES, LEGACY_PANEL_REDIRECTS } from "./src/lib/legacy-routes";

/**
 * Behind a reverse proxy Next compares a Server Action's `Origin` against
 * `x-forwarded-host`, and refuses the request when they disagree. Almost every
 * interaction in this panel is a Server Action, so a header mismatch would not
 * look like a proxy bug, it would look like the whole product is broken. Naming
 * the origin here means a misconfigured proxy fails on one screen instead.
 *
 * `poweredByHeader` off because the version of the framework is not the
 * visitor's business.
 */
const nextConfig: NextConfig = {
  poweredByHeader: false,
  /**
   * The proctoring models live under a versioned path, so they can be cached
   * for good; the wasm type is set explicitly because streaming compilation
   * refuses anything else.
   */
  async headers() {
    return [
      {
        source: "/proctor/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/proctor/:version/wasm/:file*.wasm",
        headers: [{ key: "Content-Type", value: "application/wasm" }],
      },
    ];
  },
  /** See src/lib/legacy-routes.ts. Redirects run before the filesystem (redirects.md). */
  async redirects() {
    return LEGACY_PANEL_REDIRECTS;
  },
  /** See src/lib/legacy-routes.ts. An array is applied after the filesystem (rewrites.md). */
  async rewrites() {
    return LEGACY_CANDIDATE_API_REWRITES;
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["kademe.kadiray.com"],
    },
  },
};

export default nextConfig;
