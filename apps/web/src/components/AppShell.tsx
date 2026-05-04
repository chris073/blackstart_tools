import Link from "next/link";

import { AppFooter } from "@/components/AppFooter";
import { AppHeader } from "@/components/AppHeader";
import { BrandLogo } from "@/components/BrandLogo";

const marketingOrigin = (process.env.NEXT_PUBLIC_MARKETING_WEB_ORIGIN ?? "http://127.0.0.1:3000").replace(/\/$/, "");

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <div className="mx-auto max-w-6xl px-5 py-6">
        <AppHeader />

        <main className="mt-6">{children}</main>

        <AppFooter />
      </div>

      <div className="pointer-events-none fixed bottom-3 right-3 z-50 sm:bottom-4 sm:right-4">
        <Link
          href={marketingOrigin}
          target="_blank"
          rel="noreferrer"
          className="pointer-events-auto flex max-w-[11.5rem] items-center gap-2 rounded-xl border border-bsl-border/80 bg-bsl-panel/90 px-2 py-1.5 shadow-lg shadow-black/25 ring-1 ring-white/5 backdrop-blur-md transition hover:border-emerald-500/30 hover:ring-emerald-400/20"
          aria-label="Blackstart Labs — open public site"
        >
          <BrandLogo variant="corner" />
          <div className="min-w-0 leading-tight">
            <div className="flex items-baseline gap-0.5">
              <span className="truncate text-[10px] font-semibold tracking-tight text-bsl-text">Blackstart Labs</span>
              <span
                className="shrink-0 text-[0.45rem] font-normal leading-none tracking-widest text-bsl-muted/50"
                aria-hidden
              >
                TM
              </span>
            </div>
            <div className="truncate text-[9px] text-bsl-muted">Public site</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
