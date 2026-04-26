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

/** Tools app is local-only; redirect non-local requests to marketing origin. */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/tools" || pathname.startsWith("/tools/")) {
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
