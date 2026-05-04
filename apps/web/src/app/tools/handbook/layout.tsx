import type { ReactNode } from "react";

import {
  buildHandbookNavRoot,
  getHandbookRootFromEnv,
  handbookConfiguredAndReadable,
  listHandbookDocs,
} from "@/lib/handbook";

import { HandbookSidebar } from "./HandbookSidebar";

export const metadata = {
  title: "Markdown notes · Tools",
  description: "Local markdown from a folder configured in this app.",
};

export default async function ToolsHandbookLayout({ children }: { children: ReactNode }) {
  const rootHint = getHandbookRootFromEnv();
  const ok = await handbookConfiguredAndReadable();
  const docs = ok ? await listHandbookDocs() : [];
  const navRoot = buildHandbookNavRoot(docs);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-bsl-border bg-bsl-panel/40 p-4 backdrop-blur md:p-5">
        <div className="text-sm text-bsl-muted">Tools</div>
        <h1 className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">Markdown notes</h1>
        <p className="mt-2 max-w-3xl text-sm text-bsl-muted">
          Files are read from <span className="font-mono text-bsl-text/85">HANDBOOK_CONTENT_PATH</span> in this
          app&apos;s <span className="font-mono text-bsl-text/85">.env.local</span>
          {rootHint ? (
            <>
              {" "}
              — currently <span className="font-mono text-xs text-bsl-text/75">{rootHint}</span>
            </>
          ) : null}
          . Served on this tools app (default port <span className="font-mono text-bsl-text/85">3001</span>).
        </p>
      </div>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <HandbookSidebar navRoot={navRoot} envPathSet={Boolean(rootHint)} directoryReadable={ok} />
        <div className="min-h-[50vh] min-w-0 flex-1 rounded-2xl border border-bsl-border bg-bsl-panel/30 p-5 backdrop-blur md:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
