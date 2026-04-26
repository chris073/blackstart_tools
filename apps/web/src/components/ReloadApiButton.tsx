"use client";

import { useCallback, useState } from "react";
import { apiBaseUrl } from "@/lib/config";

export function ReloadApiButton() {
  const [status, setStatus] = useState<"idle" | "busy" | "ok" | "err">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  const onReload = useCallback(async () => {
    setStatus("busy");
    setMsg(null);
    try {
      const res = await fetch(`${apiBaseUrl}/admin/reload`, { method: "POST" });
      if (res.status === 404) {
        setStatus("err");
        setMsg("Reload only works with API dev mode (uvicorn --reload).");
        return;
      }
      if (!res.ok) {
        const t = await res.text();
        setStatus("err");
        setMsg(t || res.statusText);
        return;
      }
      setStatus("ok");
      setMsg("Worker restarting…");
      window.setTimeout(() => {
        setStatus("idle");
        setMsg(null);
      }, 2500);
    } catch (e) {
      setStatus("err");
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }, []);

  return (
    <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
      <button
        type="button"
        onClick={onReload}
        disabled={status === "busy"}
        className="rounded-xl border border-bsl-border bg-bsl-panel/55 px-3 py-1.5 text-[11px] font-semibold text-bsl-muted transition hover:border-amber-500/35 hover:text-bsl-text disabled:opacity-45"
        title="Trigger uvicorn reload (keeps port bound; dev --reload only)"
      >
        {status === "busy" ? "Reloading…" : "Reload API"}
      </button>
      {msg ? (
        <span
          className={`max-w-[14rem] text-right text-[10px] leading-snug ${
            status === "err" ? "text-rose-300/95" : "text-bsl-muted"
          }`}
        >
          {msg}
        </span>
      ) : null}
    </div>
  );
}
