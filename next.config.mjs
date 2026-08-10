/** @type {import('next').NextConfig} */

// Baseline hardening. The app has no third-party scripts and makes only
// server-side outbound calls, so a strict policy costs nothing.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The demo path must never fail to boot because of a stray lint rule.
  // Type-safety is still enforced in CI via `npm run typecheck`.
  eslint: { ignoreDuringBuilds: true },

  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Agent endpoints are per-request and rate limited — never cache them.
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
    ];
  },
};

export default nextConfig;
