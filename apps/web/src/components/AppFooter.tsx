"use client";

import { usePathname } from "next/navigation";

function isToolsIndex(pathname: string): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  return p === "/tools";
}

export function AppFooter() {
  const pathname = usePathname();
  const toolsHome = isToolsIndex(pathname);

  return (
    <footer className="mt-10 border-t border-bsl-border pt-6 text-xs text-bsl-muted">
      {toolsHome ? "Internal engineering tools." : "Internal tools — pair with the public labs site for marketing."}
    </footer>
  );
}
