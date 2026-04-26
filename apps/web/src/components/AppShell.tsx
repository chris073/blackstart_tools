import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { ToolHomeNav } from "@/components/ToolHomeNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-5 py-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/tools" className="flex items-center gap-3" aria-label="Blackstart Tools™ home">
            <BrandLogo variant="header" priority />
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-semibold tracking-tight">Blackstart Tools</span>
                <span
                  className="text-[0.5rem] font-normal leading-none tracking-widest text-bsl-muted/40"
                  aria-hidden
                >
                  TM
                </span>
              </div>
              <div className="text-xs text-bsl-muted">blackstart_tools · local with blackstart_web</div>
            </div>
          </Link>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
            <ToolHomeNav />
          </div>
        </header>

        <main className="mt-6">{children}</main>

        <footer className="mt-10 border-t border-bsl-border pt-6 text-xs text-bsl-muted">
          Internal tools — pair with blackstart_web for the public labs site
        </footer>
      </div>
    </div>
  );
}
