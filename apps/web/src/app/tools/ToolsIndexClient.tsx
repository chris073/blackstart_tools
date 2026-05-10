"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";

const LS_KEY = "blackstart_tools_open_tools_new_tab";

type Props = {
  showPrivate: boolean;
  privateToolsIndexHref: string;
};

const coreLinks = [
  { href: "/tools/ping", title: "PING Check", body: "Subnet or pasted tag/IP columns, board, TSV and Excel." },
  { href: "/tools/terminal", title: "Terminal", body: "SSH shell in the browser (PuTTY-style via the API)." },
  { href: "/tools/subnet", title: "Subnet Calculator", body: "IPv4 CIDR: mask, wildcard, network, broadcast, hosts." },
  {
    href: "/tools/modbus",
    title: "Modbus TCP",
    body: "TCP connect check, then poll one coil, discrete input, or register via the API.",
  },
  {
    href: "/tools/mqtt",
    title: "MQTT explorer",
    body: "Subscribe and publish through the API (paho-mqtt); optional SSH tunnel with a PEM private key.",
  },
  {
    href: "/tools/handbook",
    title: "Markdown notes",
    body: "Read and optionally edit .md files from a folder you set with HANDBOOK_CONTENT_PATH.",
  },
] as const;

function newTabProps(open: boolean): { target?: "_blank"; rel?: string } {
  if (!open) return {};
  return { target: "_blank", rel: "noopener noreferrer" };
}

export function ToolsIndexClient({ showPrivate, privateToolsIndexHref }: Props) {
  const switchId = useId();
  const [openInNewTab, setOpenInNewTab] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw === "1" || raw === "true") setOpenInNewTab(true);
    } catch {
      /* ignore */
    }
  }, []);

  function persist(next: boolean) {
    setOpenInNewTab(next);
    try {
      localStorage.setItem(LS_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  const nt = newTabProps(openInNewTab);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Tools</h1>
          <p className="mt-2 max-w-2xl text-sm text-bsl-muted">
            Local utilities for network checks and field workflows.
            {showPrivate ? (
              <>
                {" "}
                Extra tools can live in a separate <span className="font-mono text-bsl-text/85">private_tools</span>{" "}
                checkout — start <span className="font-mono text-bsl-text/80">npm run dev</span> there when you use it.
              </>
            ) : null}
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-1 rounded-xl border border-bsl-border bg-bsl-panel/50 px-3 py-2.5 sm:max-w-[14rem]">
          <span id={`${switchId}-label`} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bsl-muted">
            Tool links
          </span>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-bsl-text/90">New tab</span>
            <button
              type="button"
              id={switchId}
              role="switch"
              aria-checked={openInNewTab}
              aria-labelledby={`${switchId}-label`}
              onClick={() => persist(!openInNewTab)}
              className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bsl-bg ${
                openInNewTab
                  ? "border-emerald-500/50 bg-emerald-500/25"
                  : "border-bsl-border bg-bsl-panel"
              }`}
            >
              <span
                className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-bsl-text shadow transition-transform duration-200 ease-out ${
                  openInNewTab ? "translate-x-[1.375rem]" : "translate-x-0"
                }`}
                aria-hidden
              />
            </button>
          </div>
          <p className="text-[11px] leading-snug text-bsl-muted">When on, tool cards open in another tab.</p>
        </div>
      </div>

      <section aria-labelledby="tools-core-heading" className="space-y-4">
        <h2 id="tools-core-heading" className="text-xs font-semibold uppercase tracking-[0.18em] text-bsl-muted">
          Core
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {coreLinks.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              {...nt}
              className="group rounded-2xl border border-bsl-border bg-bsl-panel/60 p-5 backdrop-blur transition hover:border-emerald-500/35 hover:bg-bsl-panel"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-bsl-text">{tool.title}</div>
                  <div className="mt-1 text-sm text-bsl-muted">{tool.body}</div>
                </div>
                <div className="mt-0.5 text-xs text-bsl-muted transition group-hover:text-emerald-200">Open →</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {showPrivate ? (
        <>
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
                  Private companion
                </h2>
                <p className="max-w-xl text-xs leading-relaxed text-bsl-muted">
                  Optional second Next app for tools you do not want in the public repo. Set{" "}
                  <span className="font-mono text-bsl-text/80">NEXT_PUBLIC_PRIVATE_TOOLS_WEB_ORIGIN</span> in{" "}
                  <span className="font-mono text-bsl-text/80">apps/web/.env.local</span> here. Hide this block with{" "}
                  <span className="font-mono text-bsl-text/80">NEXT_PUBLIC_SHOW_PRIVATE_TOOLS=false</span>. Configure that
                  app in its own <span className="font-mono text-bsl-text/80">.env.local</span>.
                </p>
              </div>
              <span className="shrink-0 self-start rounded-lg border border-violet-400/25 bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-violet-200/90">
                Separate repo
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <a
                href={privateToolsIndexHref}
                {...nt}
                className="group rounded-2xl border border-violet-400/20 bg-bsl-panel/50 p-5 backdrop-blur transition hover:border-violet-400/45 hover:bg-bsl-panel/70 md:col-span-2"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-bsl-text">Open private tools</div>
                    <div className="mt-1 text-sm text-bsl-muted">
                      Browse whatever you ship in <span className="font-mono text-bsl-text/80">private_tools</span>—same
                      origin you configured above.
                    </div>
                  </div>
                  <div className="mt-0.5 text-xs text-bsl-muted transition group-hover:text-violet-200">Open →</div>
                </div>
              </a>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
