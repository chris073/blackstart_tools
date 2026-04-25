import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-bsl-border bg-bsl-panel/70 p-6 shadow-glow backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm text-bsl-muted">Blackstart Labs</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Indie Tools</h1>
            <p className="mt-2 max-w-2xl text-sm text-bsl-muted">
              A Next.js + FastAPI monorepo. We’ll connect legacy Python tools to API routes one at a time.
            </p>
          </div>
          <div className="hidden sm:block">
            <div className="rounded-xl border border-bsl-border bg-bsl-panel2 px-4 py-3 text-xs text-bsl-muted">
              <div className="font-medium text-bsl-text">API</div>
              <div className="mt-1">`GET /health`</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/tools/athena"
          className="group rounded-2xl border border-bsl-border bg-bsl-panel/60 p-5 backdrop-blur transition hover:border-white/15 hover:bg-bsl-panel"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium">Athena</div>
              <div className="mt-1 text-sm text-bsl-muted">
                Query builder and helpers (first tool we’ll wire up).
              </div>
            </div>
            <div className="mt-0.5 text-xs text-bsl-muted transition group-hover:text-bsl-text">
              Open →
            </div>
          </div>
        </Link>

        <div className="rounded-2xl border border-bsl-border bg-bsl-panel/30 p-5 text-sm text-bsl-muted">
          More tools coming next.
        </div>
      </div>
    </div>
  );
}

