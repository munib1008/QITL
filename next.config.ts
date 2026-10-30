import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const tiles = process.env.NEXT_PUBLIC_MAP_TILES_URL ? new URL(process.env.NEXT_PUBLIC_MAP_TILES_URL).origin : "";

/**
 * Content Security Policy. Scripts: self plus inline (Next's hydration payload and the pre-paint theme script);
 * a nonce-based policy is tracked in docs/security/threat-model.md. No third-party script origins.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:" + (supabase ? ` ${supabase}` : "") + (tiles ? ` ${tiles}` : ""),
  "font-src 'self'",
  "connect-src 'self'" + (supabase ? ` ${supabase} ${supabase.replace(/^http/, "ws")}` : "") + (tiles ? ` ${tiles}` : ""),
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  // Only on an https site: on plain-http localhost it would break the service worker and assets.
  ...(!dev && (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://") ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
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
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default config;
