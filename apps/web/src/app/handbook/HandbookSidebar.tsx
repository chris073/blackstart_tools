"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { HandbookDoc } from "@/lib/handbook";

function docHref(slug: string[]) {
  return `/handbook/${slug.map((s) => encodeURIComponent(s)).join("/")}`;
}

export function HandbookSidebar({
  docs,
  envPathSet,
  directoryReadable,
}: {
  docs: HandbookDoc[];
  envPathSet: boolean;
  directoryReadable: boolean;
}) {
  const pathname = usePathname();

  if (!envPathSet) {
    return (
      <aside className="w-full shrink-0 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 lg:w-72">
        <p className="text-xs text-amber-100/90">
          Set <span className="font-mono">HANDBOOK_CONTENT_PATH</span> in{" "}
          <span className="font-mono">apps/web/.env.local</span> and restart the dev server.
        </p>
      </aside>
    );
  }

  if (!directoryReadable) {
    return (
      <aside className="w-full shrink-0 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 lg:w-72">
        <p className="text-xs text-rose-100/90">
          The path in <span className="font-mono">HANDBOOK_CONTENT_PATH</span> could not be opened. Confirm the folder
          exists and this process can read it (mapped drives, permissions).
        </p>
      </aside>
    );
  }

  if (docs.length === 0) {
    return (
      <aside className="w-full shrink-0 rounded-2xl border border-bsl-border bg-bsl-panel2/50 p-4 lg:w-72">
        <p className="text-xs text-bsl-muted">No .md files found under that path (hidden folders are skipped).</p>
      </aside>
    );
  }

  return (
    <aside className="w-full shrink-0 lg:sticky lg:top-6 lg:max-h-[calc(100vh-8rem)] lg:w-72 lg:overflow-y-auto">
      <nav className="rounded-2xl border border-bsl-border bg-bsl-panel2/50 p-3" aria-label="Handbook notes">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-bsl-muted">Notes</div>
        <ul className="space-y-0.5 text-sm">
          <li>
            <Link
              href="/handbook"
              className={`block rounded-lg px-2 py-1.5 font-medium ${
                pathname === "/handbook"
                  ? "bg-bsl-panel text-bsl-text ring-1 ring-emerald-400/35"
                  : "text-bsl-muted hover:bg-bsl-panel/60 hover:text-bsl-text"
              }`}
            >
              Overview
            </Link>
          </li>
          {docs.map((d) => {
            const href = docHref(d.slug);
            const active = pathname === href;
            return (
              <li key={d.relPath}>
                <Link
                  href={href}
                  className={`block rounded-lg px-2 py-1.5 ${
                    active
                      ? "bg-bsl-panel text-bsl-text ring-1 ring-emerald-400/35"
                      : "text-bsl-muted hover:bg-bsl-panel/60 hover:text-bsl-text"
                  }`}
                  title={d.relPath}
                >
                  <span className="line-clamp-2">{d.title}</span>
                  {d.slug.length > 1 ? (
                    <span className="mt-0.5 block truncate font-mono text-[10px] text-bsl-muted/80">
                      {d.relPath}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
