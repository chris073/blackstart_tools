import Link from "next/link";

export const metadata = {
  title: "Tools",
  description: "Engineering utilities: core tools plus links to private Athena & handbook.",
};

function privateToolsBase(): string {
  return (process.env.NEXT_PUBLIC_PRIVATE_TOOLS_WEB_ORIGIN ?? "http://127.0.0.1:3002").replace(/\/$/, "");
}

export default function ToolsPage() {
  const privateBase = privateToolsBase();
  const athenaHref = `${privateBase}/tools/athena`;
  const handbookHref = `${privateBase}/tools/handbook`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tools</h1>
        <p className="mt-2 max-w-2xl text-sm text-bsl-muted">
          Local utilities for network checks and field workflows. Athena and Handbook run in the separate{" "}
          <span className="font-mono text-bsl-text/85">private_tools</span> app (default{" "}
          <span className="font-mono text-bsl-text/80">{privateBase}</span>
          ) — start it with <span className="font-mono text-bsl-text/80">npm run dev</span> from that repo.
        </p>
      </div>

      <section aria-labelledby="tools-core-heading" className="space-y-4">
        <h2 id="tools-core-heading" className="text-xs font-semibold uppercase tracking-[0.18em] text-bsl-muted">
          Core
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
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

          <Link
            href="/tools/modbus"
            className="group rounded-2xl border border-bsl-border bg-bsl-panel/60 p-5 backdrop-blur transition hover:border-emerald-500/35 hover:bg-bsl-panel"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-bsl-text">Modbus TCP</div>
                <div className="mt-1 text-sm text-bsl-muted">
                  TCP connect check, then poll one coil, discrete input, or register via the API.
                </div>
              </div>
              <div className="mt-0.5 text-xs text-bsl-muted transition group-hover:text-emerald-200">Open →</div>
            </div>
          </Link>
        </div>
      </section>

      <div className="relative py-2" aria-hidden>
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-bsl-border" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-bsl-bg px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-bsl-muted">
            private
          </span>
        </div>
      </div>

      <section
        aria-labelledby="tools-private-heading"
        className="rounded-2xl border border-violet-400/20 bg-gradient-to-b from-violet-950/25 to-bsl-panel/40 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:p-6"
      >
        <div className="mb-5 flex flex-col gap-3 border-b border-violet-400/15 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 id="tools-private-heading" className="text-sm font-semibold tracking-tight text-bsl-text">
              private tools
            </h2>
            <p className="max-w-xl text-xs leading-relaxed text-bsl-muted">
              Served from <span className="font-mono text-bsl-text/80">private_tools</span> on port{" "}
              <span className="font-mono text-bsl-text/80">3002</span>. Override with{" "}
              <span className="font-mono text-bsl-text/80">NEXT_PUBLIC_PRIVATE_TOOLS_WEB_ORIGIN</span> in{" "}
              <span className="font-mono text-bsl-text/80">apps/web/.env.local</span> here. Handbook env lives in{" "}
              <span className="font-mono text-bsl-text/80">private_tools/apps/web/.env.local</span>.
            </p>
          </div>
          <span className="shrink-0 self-start rounded-lg border border-violet-400/25 bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-violet-200/90">
            Separate repo
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <a
            href={athenaHref}
            className="group rounded-2xl border border-violet-400/20 bg-bsl-panel/50 p-5 backdrop-blur transition hover:border-violet-400/45 hover:bg-bsl-panel/70"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-bsl-text">Athena</div>
                <div className="mt-1 text-sm text-bsl-muted">
                  Time-series query builder, keys discovery, and SQL runner.
                </div>
              </div>
              <div className="mt-0.5 text-xs text-bsl-muted transition group-hover:text-violet-200">Open →</div>
            </div>
          </a>

          <a
            href={handbookHref}
            className="group rounded-2xl border border-violet-400/20 bg-bsl-panel/50 p-5 backdrop-blur transition hover:border-violet-400/45 hover:bg-bsl-panel/70"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-bsl-text">Handbook</div>
                <div className="mt-1 text-sm text-bsl-muted">
                  PKM markdown reader — same FastAPI; handbook path only in private_tools{" "}
                  <span className="font-mono text-bsl-text/80">.env.local</span>.
                </div>
              </div>
              <div className="mt-0.5 text-xs text-bsl-muted transition group-hover:text-violet-200">Open →</div>
            </div>
          </a>
        </div>
      </section>
    </div>
  );
}
