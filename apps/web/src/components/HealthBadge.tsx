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
        const res = await fetch(`${apiBaseUrl}/health`, { cache: "no-store" });
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

  const badge =
    state === "loading"
      ? { label: "API: checking…", cls: "border-bsl-border bg-bsl-panel/40 text-bsl-muted" }
      : state === "up"
        ? { label: "API: online", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" }
        : { label: "API: offline", cls: "border-rose-500/30 bg-rose-500/10 text-rose-200" };

  return (
    <div className={`rounded-xl border px-3 py-1.5 text-xs ${badge.cls}`}>
      {badge.label}
    </div>
  );
}

