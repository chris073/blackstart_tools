import type { NextConfig } from "next";

/** Allow blackstart_web (3000) to embed /tools in an iframe. */
function frameAncestorsCsp(): string {
  const configured = (
    process.env.NEXT_PUBLIC_MARKETING_WEB_ORIGIN ?? "http://127.0.0.1:3000"
  ).replace(/\/$/, "");
  const origins = new Set<string>(["'self'", configured, "http://localhost:3000", "http://127.0.0.1:3000"]);
  return `frame-ancestors ${[...origins].join(" ")}`;
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    const value = frameAncestorsCsp();
    return [
      { source: "/tools", headers: [{ key: "Content-Security-Policy", value: value }] },
      { source: "/tools/:path*", headers: [{ key: "Content-Security-Policy", value: value }] },
    ];
  },
};

export default nextConfig;
