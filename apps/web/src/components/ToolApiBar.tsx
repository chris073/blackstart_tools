"use client";

import { ClientOnly } from "@/components/ClientOnly";
import { HealthBadge } from "@/components/HealthBadge";
import { ReloadApiButton } from "@/components/ReloadApiButton";

export function ToolApiBar() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-bsl-border bg-bsl-panel/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-bsl-muted">FastAPI backend (Python)</p>
      <ClientOnly
        fallback={
          <div className="flex items-center justify-end gap-2">
            <div className="h-8 w-[7.5rem] animate-pulse rounded-xl bg-bsl-panel/50" title="Loading…" />
          </div>
        }
      >
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          <ReloadApiButton />
          <HealthBadge />
        </div>
      </ClientOnly>
    </div>
  );
}
