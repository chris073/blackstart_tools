"use client";

import { ClientOnly } from "@/components/ClientOnly";
import { HealthBadge } from "@/components/HealthBadge";

export function ToolApiBar() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-bsl-border bg-bsl-panel/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-bsl-muted">FastAPI backend</p>
      <ClientOnly
        fallback={
          <div className="flex items-center justify-end">
            <div className="h-8 w-[7.5rem] animate-pulse rounded-xl bg-bsl-panel/50" title="Loading…" />
          </div>
        }
      >
        <HealthBadge />
      </ClientOnly>
    </div>
  );
}
