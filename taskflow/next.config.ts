import type { NextConfig } from "next";

/**
 * Keep minimal for Vercel. (Avoid `turbopack.root` here: on some hosts it can skew
 * build output; run `npm run dev` from `taskflow/` if you see multi-lockfile warnings locally.)
 */
const nextConfig: NextConfig = {};

export default nextConfig;
