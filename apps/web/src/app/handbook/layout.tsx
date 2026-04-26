import type { ReactNode } from "react";

import {
  getHandbookRootFromEnv,
  handbookConfiguredAndReadable,
  listHandbookDocs,
} from "@/lib/handbook";

import { HandbookSidebar } from "./HandbookSidebar";

export const metadata = {
  title: "Handbook · Blackstart Labs",
  description: "Local-only markdown notes from your configured PKM path",
};

export default async function HandbookLayout({ children }: { children: ReactNode }) {
  const rootHint = getHandbookRootFromEnv();
  const ok = await handbookConfiguredAndReadable();
  const docs = ok ? await listHandbookDocs() : [];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-bsl-border bg-bsl-panel/40 p-4 backdrop-blur md:p-5">
        <div className="text-sm text-bsl-muted">Blackstart Labs</div>
        <h1 className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">
          Handbook <span className="text-sm font-normal text-bsl-muted">[private · local only]</span>
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-bsl-muted">
          Markdown reader (not available on public deploys): files come from{" "}
          <span className="font-mono text-bsl-text/85">HANDBOOK_CONTENT_PATH</span> in{" "}
          <span className="font-mono text-bsl-text/85">.env.local</span>
          {rootHint ? (
            <>
              {" "}
              — currently <span className="font-mono text-xs text-bsl-text/75">{rootHint}</span>
            </>
          ) : null}
          .
        </p>
      </div>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <HandbookSidebar docs={docs} envPathSet={Boolean(rootHint)} directoryReadable={ok} />
        <div className="min-h-[50vh] min-w-0 flex-1 rounded-2xl border border-bsl-border bg-bsl-panel/30 p-5 backdrop-blur md:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
