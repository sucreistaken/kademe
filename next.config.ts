import type { NextConfig } from "next";

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
  experimental: {
    serverActions: {
      allowedOrigins: ["kademe.kadiray.com"],
    },
  },
};

export default nextConfig;
