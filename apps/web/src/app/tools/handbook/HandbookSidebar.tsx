"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { HandbookDoc, HandbookNavFolder, HandbookNavRoot } from "@/lib/handbook";

const HANDBOOK_BASE = "/tools/handbook";

function docHref(slug: string[]) {
  return `${HANDBOOK_BASE}/${slug.map((s) => encodeURIComponent(s)).join("/")}`;
}

function activeSlugFromPath(pathname: string): string[] {
  const raw = pathname.replace(new RegExp(`^${HANDBOOK_BASE.replace(/\//g, "\\/")}\\/?`), "");
  if (!raw) return [];
  return raw.split("/").filter(Boolean).map((s) => decodeURIComponent(s));
}

function folderIsOnActivePath(activeSlug: string[], folderPathSegments: string[]): boolean {
  if (activeSlug.length < folderPathSegments.length) return false;
  for (let i = 0; i < folderPathSegments.length; i++) {
    if (activeSlug[i] !== folderPathSegments[i]) return false;
  }
  return true;
}

function linkLine(active: boolean) {
  return `block rounded-lg px-2 py-1.5 ${
    active
      ? "bg-bsl-panel text-bsl-text ring-1 ring-emerald-400/35"
      : "text-bsl-muted hover:bg-bsl-panel/60 hover:text-bsl-text"
  }`;
}

function NavFolderBlock({ folder, pathname }: { folder: HandbookNavFolder; pathname: string }) {
  const activeSlug = activeSlugFromPath(pathname);
  const open = folderIsOnActivePath(activeSlug, folder.pathSegments);

  return (
    <li className="list-none">
      <details open={open} className="group">
        <summary className="cursor-pointer list-none rounded-lg px-2 py-1.5 text-xs font-semibold tracking-wide text-bsl-muted hover:bg-bsl-panel/50 [&::-webkit-details-marker]:hidden">
          {folder.name.replace(/[-_]+/g, " ")}
        </summary>
        <ul className="ml-1.5 mt-1 space-y-0.5 border-l border-bsl-border/60 pl-2">
          {folder.subfolders.map((sf) => (
            <NavFolderBlock key={sf.pathSegments.join("/")} folder={sf} pathname={pathname} />
          ))}
          {folder.files.map((d) => {
            const href = docHref(d.slug);
            const active = pathname === href;
            return (
              <li key={d.relPath}>
                <Link href={href} className={linkLine(active)} title={d.relPath}>
                  <span className="line-clamp-2 text-sm">{d.title}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </details>
    </li>
  );
}

export function HandbookSidebar({
  navRoot,
  envPathSet,
  directoryReadable,
}: {
  navRoot: HandbookNavRoot;
  envPathSet: boolean;
  directoryReadable: boolean;
}) {
  const pathname = usePathname();
  const hasDocs = navRoot.folders.length > 0 || navRoot.rootFiles.length > 0;

  if (!envPathSet) {
    return (
      <aside className="w-full shrink-0 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 lg:w-72">
        <p className="text-xs text-amber-100/90">
          Set <span className="font-mono">HANDBOOK_CONTENT_PATH</span> in this app&apos;s{" "}
          <span className="font-mono">.env.local</span> (see <span className="font-mono">.env.example</span>) and restart
          the dev server.
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

  if (!hasDocs) {
    return (
      <aside className="w-full shrink-0 rounded-2xl border border-bsl-border bg-bsl-panel2/50 p-4 lg:w-72">
        <p className="text-xs text-bsl-muted">No .md files found under that path (hidden folders are skipped).</p>
      </aside>
    );
  }

  return (
    <aside className="w-full shrink-0 lg:sticky lg:top-6 lg:max-h-[calc(100vh-8rem)] lg:w-72 lg:overflow-y-auto">
      <nav className="rounded-2xl border border-bsl-border bg-bsl-panel2/50 p-3" aria-label="Markdown notes">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-bsl-muted">Notes</div>
        <ul className="space-y-0.5 text-sm">
          <li>
            <Link
              href={HANDBOOK_BASE}
              className={`block rounded-lg px-2 py-1.5 font-medium ${
                pathname === HANDBOOK_BASE
                  ? "bg-bsl-panel text-bsl-text ring-1 ring-emerald-400/35"
                  : "text-bsl-muted hover:bg-bsl-panel/60 hover:text-bsl-text"
              }`}
            >
              Overview
            </Link>
          </li>
          {navRoot.rootFiles.map((d: HandbookDoc) => {
            const href = docHref(d.slug);
            const active = pathname === href;
            return (
              <li key={d.relPath}>
                <Link href={href} className={linkLine(active)} title={d.relPath}>
                  <span className="line-clamp-2">{d.title}</span>
                </Link>
              </li>
            );
          })}
          {navRoot.folders.map((f) => (
            <NavFolderBlock key={f.pathSegments.join("/")} folder={f} pathname={pathname} />
          ))}
        </ul>
      </nav>
    </aside>
  );
}
