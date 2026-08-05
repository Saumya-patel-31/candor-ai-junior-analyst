/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The demo path must never fail to boot because of a stray lint rule.
  // Type-safety is still enforced in CI via `npm run typecheck`.
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // Keep server actions modest; the agent streams over a route handler instead.
  },
};

export default nextConfig;
