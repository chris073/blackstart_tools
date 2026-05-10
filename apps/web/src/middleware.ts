import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { isLocalHost } from "@/lib/local-dev";

function marketingPublicUrl(): string {
  const o = (process.env.NEXT_PUBLIC_MARKETING_WEB_ORIGIN ?? "http://127.0.0.1:3000").replace(/\/$/, "");
  return `${o}/`;
}

function requireLocal() {
  return NextResponse.redirect(marketingPublicUrl());
}

/** Paths under /tools that stay reachable on any Host (public deploy, LAN URL, iframe embed). */
function isPublicToolsPath(pathname: string): boolean {
  return pathname === "/tools/mqtt" || pathname.startsWith("/tools/mqtt/");
}

/**
 * Most tools are local-only (localhost) so they are not exposed when the app is reachable on a
 * public hostname. MQTT explorer is an exception: it is intended to be shared like other public pages.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/tools" || pathname.startsWith("/tools/")) {
    if (isPublicToolsPath(pathname)) {
      return NextResponse.next();
    }
    const host = req.headers.get("host");
    if (!isLocalHost(host)) {
      return requireLocal();
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/tools", "/tools/:path*"],
};
