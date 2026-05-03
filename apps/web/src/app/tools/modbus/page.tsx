"use client";

import { useCallback, useRef, useState } from "react";
import { apiBaseUrl } from "@/lib/config";

type RegisterType = "coil" | "discrete_input" | "holding" | "input_register";

const REGISTER_OPTIONS: { value: RegisterType; label: string }[] = [
  { value: "coil", label: "Coil" },
  { value: "discrete_input", label: "Discrete input" },
  { value: "holding", label: "Holding register" },
  { value: "input_register", label: "Input register" },
];

function stamp(): string {
  return new Date().toLocaleTimeString(undefined, { hour12: false });
}

export default function ModbusToolPage() {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("502");
  const [unitId, setUnitId] = useState("1");
  const [registerType, setRegisterType] = useState<RegisterType>("holding");
  const [address, setAddress] = useState("0");
  const [log, setLog] = useState<string>("");
  const [busy, setBusy] = useState<"idle" | "connect" | "poll">("idle");
  const terminalRef = useRef<HTMLPreElement>(null);

  const appendLog = useCallback((line: string) => {
    setLog((prev) => (prev ? `${prev}\n${line}` : line));
    requestAnimationFrame(() => {
      const el = terminalRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  const parsePort = (): number | null => {
    const n = parseInt(port.trim(), 10);
    if (!Number.isInteger(n) || n < 1 || n > 65535) return null;
    return n;
  };

  const parseUnit = (): number | null => {
    const n = parseInt(unitId.trim(), 10);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    return n;
  };

  const parseAddress = (): number | null => {
    const n = parseInt(address.trim(), 10);
    if (!Number.isInteger(n) || n < 0 || n > 65535) return null;
    return n;
  };

  const onConnect = useCallback(async () => {
    const h = host.trim();
    if (!h) {
      appendLog(`[${stamp()}] Enter a host IP or hostname.`);
      return;
    }
    const p = parsePort();
    if (p == null) {
      appendLog(`[${stamp()}] Port must be 1–65535 (default Modbus TCP is 502).`);
      return;
    }
    setBusy("connect");
    appendLog(`[${stamp()}] Connecting TCP to ${h}:${p}…`);
    try {
      const res = await fetch(`${apiBaseUrl}/modbus/tcp-check`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ host: h, port: p }),
      });
      if (!res.ok) {
        const t = await res.text();
        appendLog(`[${stamp()}] HTTP ${res.status}: ${t || res.statusText}`);
        return;
      }
      const data = (await res.json()) as { ok?: boolean; message?: string };
      appendLog(`[${stamp()}] ${data.ok ? "OK" : "FAIL"} — ${data.message ?? "(no message)"}`);
    } catch (e) {
      appendLog(`[${stamp()}] ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy("idle");
    }
  }, [host, port, appendLog]);

  const onPoll = useCallback(async () => {
    const h = host.trim();
    if (!h) {
      appendLog(`[${stamp()}] Enter a host IP or hostname.`);
      return;
    }
    const p = parsePort();
    if (p == null) {
      appendLog(`[${stamp()}] Port must be 1–65535.`);
      return;
    }
    const u = parseUnit();
    if (u == null) {
      appendLog(`[${stamp()}] Server / unit ID must be 0–255.`);
      return;
    }
    const a = parseAddress();
    if (a == null) {
      appendLog(`[${stamp()}] Address must be 0–65535 (0-based, same as pymodbus).`);
      return;
    }
    setBusy("poll");
    appendLog(
      `[${stamp()}] Poll ${registerType} @${a} unit=${u} on ${h}:${p}…`,
    );
    try {
      const res = await fetch(`${apiBaseUrl}/modbus/poll`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          host: h,
          port: p,
          unit_id: u,
          register_type: registerType,
          address: a,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        appendLog(`[${stamp()}] HTTP ${res.status}: ${t || res.statusText}`);
        return;
      }
      const data = (await res.json()) as { ok?: boolean; message?: string; values?: number[] };
      if (data.ok) {
        appendLog(`[${stamp()}] ${data.message ?? "OK"}`);
      } else {
        appendLog(`[${stamp()}] FAIL — ${data.message ?? "Unknown error"}`);
      }
    } catch (e) {
      appendLog(`[${stamp()}] ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy("idle");
    }
  }, [host, port, unitId, address, registerType, appendLog]);

  const onClear = useCallback(() => setLog(""), []);

  const disabled = busy !== "idle";

  return (
    <div className="space-y-8">
      <div>
        <div className="text-sm text-bsl-muted">Tool</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Modbus TCP</h1>
        <p className="mt-2 max-w-2xl text-sm text-bsl-muted">
          Reads run in <span className="text-bsl-text/85">Python</span> on the FastAPI backend (pymodbus). The browser
          cannot open Modbus TCP directly; ensure the API can reach your device. Addresses are{" "}
          <span className="text-bsl-text/85">0-based</span> (protocol address, not 40001-style notation).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-bsl-muted">Host (IP or DNS)</span>
          <input
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            spellCheck={false}
            disabled={disabled}
            placeholder="192.168.1.50"
            className="w-full rounded-xl border border-bsl-border bg-bsl-panel px-3 py-2 font-mono text-sm text-bsl-text outline-none focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-400/20 disabled:opacity-50"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-bsl-muted">Port</span>
          <input
            type="text"
            inputMode="numeric"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            spellCheck={false}
            disabled={disabled}
            placeholder="502"
            className="w-full rounded-xl border border-bsl-border bg-bsl-panel px-3 py-2 font-mono text-sm text-bsl-text outline-none focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-400/20 disabled:opacity-50"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-bsl-muted">Server / unit ID</span>
          <input
            type="text"
            inputMode="numeric"
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            spellCheck={false}
            disabled={disabled}
            placeholder="1"
            className="w-full rounded-xl border border-bsl-border bg-bsl-panel px-3 py-2 font-mono text-sm text-bsl-text outline-none focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-400/20 disabled:opacity-50"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[12rem] flex-1">
          <span className="mb-1 block text-xs font-medium text-bsl-muted">Register type</span>
          <select
            value={registerType}
            onChange={(e) => setRegisterType(e.target.value as RegisterType)}
            disabled={disabled}
            className="w-full rounded-xl border border-bsl-border bg-bsl-panel px-3 py-2 text-sm text-bsl-text outline-none focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-400/20 disabled:opacity-50"
          >
            {REGISTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="w-full min-w-[8rem] sm:w-40">
          <span className="mb-1 block text-xs font-medium text-bsl-muted">Address</span>
          <input
            type="text"
            inputMode="numeric"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            spellCheck={false}
            disabled={disabled}
            placeholder="0"
            className="w-full rounded-xl border border-bsl-border bg-bsl-panel px-3 py-2 font-mono text-sm text-bsl-text outline-none focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-400/20 disabled:opacity-50"
          />
        </label>
        <div className="flex flex-wrap gap-2 pb-0.5">
          <button
            type="button"
            disabled={disabled}
            onClick={onConnect}
            className="rounded-xl border border-sky-500/45 bg-sky-500/15 px-5 py-2 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/25 disabled:opacity-45"
          >
            {busy === "connect" ? "Connecting…" : "Connect"}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={onPoll}
            className="rounded-xl border border-emerald-500/45 bg-emerald-500/15 px-5 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:opacity-45"
          >
            {busy === "poll" ? "Polling…" : "Poll"}
          </button>
          <button
            type="button"
            disabled={!log.length}
            onClick={onClear}
            className="rounded-xl border border-bsl-border bg-bsl-panel/50 px-4 py-2 text-xs font-semibold text-bsl-muted transition hover:text-bsl-text disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-tight text-bsl-text">Output</h2>
        <pre
          ref={terminalRef}
          className="max-h-[min(28rem,50dvh)] min-h-[12rem] overflow-auto rounded-xl border border-bsl-border bg-[#0c0d10] px-3 py-2 font-mono text-[11px] leading-relaxed text-emerald-200/95 [scrollbar-gutter:stable]"
        >
          {log || <span className="text-bsl-muted/60">Connect or poll to see output.</span>}
        </pre>
      </section>
    </div>
  );
}
