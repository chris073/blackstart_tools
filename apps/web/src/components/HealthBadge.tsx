"use client";

import { useEffect, useState } from "react";
import { apiBaseUrl } from "@/lib/config";

type Health = { ok: boolean };

export function HealthBadge() {
  const [state, setState] = useState<"loading" | "up" | "down">("loading");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const res = await fetch(`${apiBaseUrl}/health`, {
          cache: "no-store",
          signal: AbortSignal.timeout(6000),
        });
        const data = (await res.json()) as Health;
        if (!cancelled) setState(res.ok && data?.ok ? "up" : "down");
      } catch {
        if (!cancelled) setState("down");
      }
    }

    run();
    const t = setInterval(run, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const dotClass =
    state === "loading"
      ? "bg-bsl-muted"
      : state === "up"
        ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.95)]"
        : "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.6)]";

  const badge =
    state === "loading"
      ? {
          label: "API: …",
          cls: "border-bsl-border bg-bsl-panel/40 text-bsl-muted",
        }
      : state === "up"
        ? {
            label: "API: online",
            cls: "border-emerald-400/60 bg-emerald-500/20 text-emerald-50 shadow-[0_0_24px_rgba(16,185,129,0.22)] ring-1 ring-emerald-400/35",
          }
        : {
            label: "API: offline",
            cls: "border-rose-500/40 bg-rose-500/10 text-rose-200",
          };

  const traffic =
    state === "up" ? (
      <span className="flex items-center gap-0.5 pl-0.5" aria-hidden title="API reachable">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)] animate-pulse" />
        <span
          className="h-1.5 w-1.5 rounded-full bg-emerald-400/90 shadow-[0_0_6px_rgba(52,211,153,0.75)] animate-pulse"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="h-1.5 w-1.5 rounded-full bg-emerald-400/80 shadow-[0_0_5px_rgba(52,211,153,0.6)] animate-pulse"
          style={{ animationDelay: "300ms" }}
        />
      </span>
    ) : null;

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs ${badge.cls}`}
      title={`${apiBaseUrl}/health · polled every 5s`}
    >
      <span className={`relative h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} aria-hidden>
        {state === "up" ? (
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/40" />
        ) : null}
      </span>
      {traffic}
      <span className="font-medium">{badge.label}</span>
    </div>
  );
}
