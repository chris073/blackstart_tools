"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ToolHomeNav } from "@/components/ToolHomeNav";

function normalizedPath(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/";
}

export function AppHeader() {
  const pathname = usePathname();
  const p = normalizedPath(pathname);

  if (p === "/tools") {
    return null;
  }

  if (p.startsWith("/tools/")) {
    return (
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/tools"
          className="w-fit text-sm font-semibold tracking-tight text-bsl-text transition hover:text-emerald-200/90"
          aria-label="Tools home"
        >
          Tools
        </Link>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
          <ToolHomeNav />
        </div>
      </header>
    );
  }

  return null;
}
