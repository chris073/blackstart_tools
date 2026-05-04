import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Monorepo root (`blackstart_tools/`), where npm hoists workspace dependencies. */
const monorepoRoot = path.resolve(__dirname, "../..");

/** Allow blackstart_web (3000) to embed /tools in an iframe. */
function frameAncestorsCsp(): string {
  const configured = (
    process.env.NEXT_PUBLIC_MARKETING_WEB_ORIGIN ?? "http://127.0.0.1:3000"
  ).replace(/\/$/, "");
  const origins = new Set<string>([
    "'self'",
    configured,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3002",
    "http://127.0.0.1:3002",
  ]);
  return `frame-ancestors ${[...origins].join(" ")}`;
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /** Server output traces include the repo root so hoisted deps under `../../node_modules` resolve. */
  outputFileTracingRoot: monorepoRoot,
  webpack: (config) => {
    const rootNodeModules = path.join(monorepoRoot, "node_modules");
    const localNodeModules = path.join(__dirname, "node_modules");
    config.resolve.modules = [
      localNodeModules,
      rootNodeModules,
      "node_modules",
      ...(config.resolve.modules ?? []),
    ];
    return config;
  },
  async headers() {
    const value = frameAncestorsCsp();
    return [
      { source: "/tools", headers: [{ key: "Content-Security-Policy", value: value }] },
      { source: "/tools/:path*", headers: [{ key: "Content-Security-Policy", value: value }] },
    ];
  },
};

export default nextConfig;
