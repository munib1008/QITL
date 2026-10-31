import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";

/**
 * Security headers for every response. The Content-Security-Policy of pages is NOT set here: the middleware builds it
 * per request with a nonce (src/middleware.ts, src/lib/security/csp.ts). Responses the middleware does not render
 * (API JSON, route handlers, files) get API_CSP below, under which nothing can run.
 */
// Kept in step with API_CSP in src/lib/security/csp.ts (tests/unit/security.test.ts checks they match).
const API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

const securityHeaders = [
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(!dev && (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://")
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const config: NextConfig = {
  outputFileTracingRoot: import.meta.dirname,
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/api/:path*", headers: [{ key: "Content-Security-Policy", value: API_CSP }] },
      { source: "/auth/:path*", headers: [{ key: "Content-Security-Policy", value: API_CSP }] },
      // The service worker script: its own policy governs the worker; it only fetches same-origin pages.
      { source: "/sw.js", headers: [{ key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" }] },
    ];
  },
};

export default config;
