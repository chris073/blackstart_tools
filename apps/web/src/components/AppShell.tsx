import Link from "next/link";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-5 py-6">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl border border-bsl-border bg-bsl-panel/80 shadow-glow" />
            <div>
              <div className="text-sm font-semibold tracking-tight">Blackstart Labs</div>
              <div className="text-xs text-bsl-muted">indie-tools</div>
            </div>
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link
              href="/tools/athena"
              className="rounded-xl border border-bsl-border bg-bsl-panel/40 px-3 py-1.5 text-bsl-muted transition hover:bg-bsl-panel hover:text-bsl-text"
            >
              Athena
            </Link>
          </nav>
        </header>

        <main className="mt-6">{children}</main>

        <footer className="mt-10 border-t border-bsl-border pt-6 text-xs text-bsl-muted">
          FastAPI backend on <span className="text-bsl-text">localhost:8000</span> (dev).
        </footer>
      </div>
    </div>
  );
}

