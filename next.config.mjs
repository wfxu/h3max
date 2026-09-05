import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

// Same headers the static site shipped in vercel.json.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: { root },
  outputFileTracingRoot: root,
  async rewrites() {
    // The marketing homepage stays the hand-written static page in public/index.html.
    return { beforeFiles: [{ source: "/", destination: "/index.html" }] };
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      { source: "/favicon.svg", headers: [{ key: "Cache-Control", value: "public, max-age=604800" }] },
    ];
  },
};

export default nextConfig;
