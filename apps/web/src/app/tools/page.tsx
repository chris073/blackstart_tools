import Link from "next/link";

export const metadata = {
  title: "Tools · Blackstart Labs",
  description: "Internal tools and builders",
};

export default function ToolsPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-bsl-muted">Blackstart Labs</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Tools</h1>
        <p className="mt-2 max-w-2xl text-sm text-bsl-muted">Pick a tool below.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/tools/athena"
          className="group rounded-2xl border border-bsl-border bg-bsl-panel/60 p-5 backdrop-blur transition hover:border-emerald-500/35 hover:bg-bsl-panel"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-bsl-text">Athena</div>
              <div className="mt-1 text-sm text-bsl-muted">
                Time-series query builder, keys discovery, and SQL runner.
              </div>
            </div>
            <div className="mt-0.5 text-xs text-bsl-muted transition group-hover:text-emerald-200">Open →</div>
          </div>
        </Link>

        <div className="rounded-2xl border border-bsl-border border-dashed bg-bsl-panel/25 p-5 text-sm text-bsl-muted">
          More tools are wired in as we go.
        </div>
      </div>
    </div>
  );
}
