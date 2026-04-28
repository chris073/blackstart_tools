import Link from "next/link";

export const metadata = {
  title: "Tools",
  description: "Engineering utilities: queries, reachability, SSH terminal, and more.",
};

export default function ToolsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tools</h1>
        <p className="mt-2 max-w-2xl text-sm text-bsl-muted">
          Local utilities for queries, network checks, and related workflows.
        </p>
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

        <Link
          href="/tools/ping"
          className="group rounded-2xl border border-bsl-border bg-bsl-panel/60 p-5 backdrop-blur transition hover:border-emerald-500/35 hover:bg-bsl-panel"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-bsl-text">PING Check</div>
              <div className="mt-1 text-sm text-bsl-muted">Subnet or pasted tag/IP columns, board, TSV and Excel.</div>
            </div>
            <div className="mt-0.5 text-xs text-bsl-muted transition group-hover:text-emerald-200">Open →</div>
          </div>
        </Link>

        <Link
          href="/tools/terminal"
          className="group rounded-2xl border border-bsl-border bg-bsl-panel/60 p-5 backdrop-blur transition hover:border-emerald-500/35 hover:bg-bsl-panel"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-bsl-text">Terminal</div>
              <div className="mt-1 text-sm text-bsl-muted">SSH shell in the browser (PuTTY-style via the API).</div>
            </div>
            <div className="mt-0.5 text-xs text-bsl-muted transition group-hover:text-emerald-200">Open →</div>
          </div>
        </Link>

        <Link
          href="/tools/subnet"
          className="group rounded-2xl border border-bsl-border bg-bsl-panel/60 p-5 backdrop-blur transition hover:border-emerald-500/35 hover:bg-bsl-panel"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-bsl-text">Subnet Calculator</div>
              <div className="mt-1 text-sm text-bsl-muted">IPv4 CIDR: mask, wildcard, network, broadcast, hosts.</div>
            </div>
            <div className="mt-0.5 text-xs text-bsl-muted transition group-hover:text-emerald-200">Open →</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
