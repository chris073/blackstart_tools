"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** True when viewing a specific tool under `/tools/...`, not the tools index. */
function isOnToolRoute(pathname: string): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  return p.startsWith("/tools/") && p.length > "/tools".length;
}

export function ToolHomeNav() {
  const pathname = usePathname();
  if (!isOnToolRoute(pathname)) return null;

  return (
    <nav aria-label="Tool navigation">
      <Link
        href="/tools"
        className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold tracking-[0.12em] text-bsl-muted transition hover:bg-bsl-panel/60 hover:text-bsl-text sm:px-3 sm:text-xs"
      >
        HOME
      </Link>
    </nav>
  );
}
