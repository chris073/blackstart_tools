import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { isLocalHost } from "@/lib/local-dev";

function requireLocal(req: NextRequest) {
  const host = req.headers.get("host");
  if (!isLocalHost(host)) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return null;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/tools") || pathname === "/handbook" || pathname.startsWith("/handbook/")) {
    return requireLocal(req) ?? NextResponse.next();
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/tools/:path*", "/handbook", "/handbook/:path*"],
};
