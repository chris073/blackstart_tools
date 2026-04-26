import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { SiteNav } from "@/components/SiteNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-5 py-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex items-center gap-3">
            <BrandLogo variant="header" priority />
            <div>
              <div className="text-sm font-semibold tracking-tight">Blackstart Labs</div>
              <div className="text-xs text-bsl-muted">blackstart_tools</div>
            </div>
          </Link>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
            <SiteNav />
          </div>
        </header>

        <main className="mt-6">{children}</main>

        <footer className="mt-10 border-t border-bsl-border pt-6 text-xs text-bsl-muted">
          Blackstart Labs — internal tools
        </footer>
      </div>
    </div>
  );
}

