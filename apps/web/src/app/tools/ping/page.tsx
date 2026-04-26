"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { apiBaseUrl } from "@/lib/config";

type PingStatus = "icmp_ok" | "tcp_only" | "down";

type PingResult = {
  tag: string;
  host: string;
  status: PingStatus;
  rtt_ms: number | null;
  open_ports: number[];
  detail: string | null;
};

const TSV_HEADER = "tag\thost\tstatus\trtt_ms\topen_ports";

const DEFAULT_PORTS_INPUT = "23, 443, 502, 4712, 8080, 20000";

function parsePortsInput(raw: string): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  for (const part of raw.split(/[,;\s]+/)) {
    const t = part.trim();
    if (!t) continue;
    const n = parseInt(t, 10);
    if (!Number.isInteger(n) || n < 1 || n > 65535 || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

const EXAMPLE_TAGS = `RELAY-A
RELAY-B
CORE-SW`;

const EXAMPLE_IPS = `192.168.1.1
192.168.1.2
192.168.1.10`;

/** Pair lines by row index (paste column A / column B from Excel). */
function parseTagIpColumns(tagRaw: string, ipRaw: string): { tag: string; host: string }[] {
  const tagLines = tagRaw.split(/\r?\n/);
  const ipLines = ipRaw.split(/\r?\n/);
  const n = Math.max(tagLines.length, ipLines.length);
  const out: { tag: string; host: string }[] = [];
  for (let i = 0; i < n; i++) {
    const rawTag = tagLines[i] ?? "";
    const rawHost = ipLines[i] ?? "";
    const tag = rawTag.replace(/^\uFEFF/, "").trim();
    const host = rawHost.replace(/^\uFEFF/, "").trim();
    if (!tag && !host) continue;
    if (tag.startsWith("#") || host.startsWith("#")) continue;
    if (!host) continue;
    out.push({ tag: tag || host, host });
  }
  return out;
}

function resultsToTsv(rows: PingResult[]): string {
  const lines = [
    TSV_HEADER,
    ...rows.map((r) => {
      const rtt = r.rtt_ms == null ? "" : String(r.rtt_ms);
      const ports = r.open_ports.length ? r.open_ports.join(",") : "";
      return `${r.tag}\t${r.host}\t${r.status}\t${rtt}\t${ports}`;
    }),
  ];
  return `${lines.join("\n")}\n`;
}

function parseNdjsonChunk(buf: string): { events: Record<string, unknown>[]; rest: string } {
  const idx = buf.lastIndexOf("\n");
  if (idx === -1) {
    return { events: [], rest: buf };
  }
  const complete = buf.slice(0, idx + 1);
  const rest = buf.slice(idx + 1);
  const events: Record<string, unknown>[] = [];
  for (const line of complete.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      events.push(JSON.parse(t) as Record<string, unknown>);
    } catch {
      /* skip bad line */
    }
  }
  return { events, rest };
}

function formatOpenPorts(ports: number[]): string {
  if (!ports.length) return "";
  return ports.join(",");
}

function annunciatorSub(row: PingResult): string {
  const portsStr = formatOpenPorts(row.open_ports);
  if (row.status === "icmp_ok") {
    const rtt = row.rtt_ms != null ? `${row.rtt_ms} ms` : "—";
    return portsStr ? `${rtt} · ${portsStr}` : rtt;
  }
  if (row.status === "tcp_only") {
    return portsStr || "—";
  }
  return portsStr || "—";
}

function AnnunciatorCard({ row }: { row: PingResult }) {
  const sub = annunciatorSub(row);
  const { border, glow, bar, label } =
    row.status === "icmp_ok"
      ? {
          border: "border-emerald-500/55",
          glow: "shadow-[0_0_14px_rgba(16,185,129,0.14)]",
          bar: "bg-emerald-400",
          label: "ICMP OK",
        }
      : row.status === "tcp_only"
        ? {
            border: "border-amber-500/50",
            glow: "shadow-[0_0_12px_rgba(245,158,11,0.12)]",
            bar: "bg-amber-400",
            label: "TCP",
          }
        : {
            border: "border-rose-500/45",
            glow: "shadow-[0_0_10px_rgba(244,63,94,0.1)]",
            bar: "bg-rose-500",
            label: "DOWN",
          };

  return (
    <div
      className={`relative flex h-[3.625rem] w-full min-w-0 flex-col rounded-lg border bg-bsl-panel/70 px-1.5 py-1 ${border} ${glow} transition-[transform,box-shadow] duration-300`}
    >
      <div className={`absolute left-0 right-0 top-0 h-0.5 rounded-t-[0.4rem] ${bar} opacity-90`} aria-hidden />
      <div className="flex min-h-0 flex-1 items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <div className="text-[7px] font-bold leading-none tracking-[0.12em] text-bsl-muted/90">{label}</div>
          <div className="mt-0.5 truncate text-[11px] font-semibold leading-tight text-bsl-text" title={row.tag}>
            {row.tag}
          </div>
          <div className="truncate font-mono text-[9px] leading-tight text-bsl-muted" title={row.host}>
            {row.host}
          </div>
        </div>
        <div
          className="shrink-0 self-end font-mono text-[7px] leading-none text-bsl-muted/75"
          title={sub}
        >
          {sub}
        </div>
      </div>
    </div>
  );
}

function RunStopButtons({
  busy,
  onRun,
  onStop,
}: {
  busy: boolean;
  onRun: () => void;
  onStop: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={onRun}
        className="rounded-xl border border-emerald-500/45 bg-emerald-500/15 px-5 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:opacity-45"
      >
        {busy ? "Running…" : "Run checks"}
      </button>
      <button
        type="button"
        disabled={!busy}
        onClick={onStop}
        className="rounded-xl border border-rose-500/45 bg-rose-500/10 px-5 py-2 text-xs font-semibold text-rose-100/95 transition hover:bg-rose-500/20 disabled:opacity-40"
      >
        Stop
      </button>
    </div>
  );
}

export default function PingCheckPage() {
  const [mode, setMode] = useState<"subnet" | "table">("table");
  const [subnet, setSubnet] = useState("192.168.1.0/24");
  const [tagColumnText, setTagColumnText] = useState(EXAMPLE_TAGS);
  const [ipColumnText, setIpColumnText] = useState(EXAMPLE_IPS);
  const [portsInput, setPortsInput] = useState(DEFAULT_PORTS_INPUT);
  const [results, setResults] = useState<PingResult[]>([]);
  const [tsvOut, setTsvOut] = useState(`${TSV_HEADER}\n`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyFlash, setCopyFlash] = useState(false);
  const [progress, setProgress] = useState<{ total: number; done: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setTsvOut(resultsToTsv(results));
  }, [results]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const stopPing = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const runCheck = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setError(null);
    setProgress(null);
    setResults([]);
    setBusy(true);

    const tcpPorts = parsePortsInput(portsInput);
    const baseBody: { subnet?: string; targets?: { tag: string; host: string }[]; tcp_ports?: number[] } = {};
    if (tcpPorts.length) {
      baseBody.tcp_ports = tcpPorts;
    }
    if (mode === "subnet") {
      const cidr = subnet.trim();
      if (!cidr) {
        setError("Enter a CIDR (e.g. 10.0.0.0/24).");
        setBusy(false);
        abortRef.current = null;
        return;
      }
      baseBody.subnet = cidr;
    } else {
      const targets = parseTagIpColumns(tagColumnText, ipColumnText);
      if (!targets.length) {
        setError("Add at least one IP address, aligned with tag rows (paste from two Excel columns).");
        setBusy(false);
        abortRef.current = null;
        return;
      }
      baseBody.targets = targets;
    }
    const body = baseBody;

    try {
      const res = await fetch(`${apiBaseUrl}/ping/check/stream`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: ac.signal,
      });
      if (!res.ok) {
        const t = await res.text();
        let msg = t || res.statusText;
        try {
          const j = JSON.parse(t) as { detail?: unknown };
          if (typeof j.detail === "string") msg = j.detail;
          else if (Array.isArray(j.detail))
            msg = j.detail.map((x: { msg?: string }) => x?.msg).filter(Boolean).join("; ");
        } catch {
          /* not JSON */
        }
        throw new Error(msg);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body.");

      const dec = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += dec.decode(value, { stream: true });
        const { events, rest } = parseNdjsonChunk(buffer);
        buffer = rest;

        for (const msg of events) {
          const ev = msg.event;
          if (ev === "start" && typeof msg.total === "number") {
            setProgress({ total: msg.total, done: 0 });
          } else if (ev === "result") {
            const status = msg.status as PingStatus;
            if (status === "icmp_ok" || status === "tcp_only" || status === "down") {
              const op = msg.open_ports;
              const open_ports = Array.isArray(op)
                ? op
                    .map((p) => (typeof p === "number" ? p : parseInt(String(p), 10)))
                    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 65535)
                : [];
              setResults((prev) => [
                ...prev,
                {
                  tag: String(msg.tag ?? ""),
                  host: String(msg.host ?? ""),
                  status,
                  rtt_ms: typeof msg.rtt_ms === "number" ? msg.rtt_ms : null,
                  open_ports,
                  detail: typeof msg.detail === "string" ? msg.detail : null,
                },
              ]);
            }
            setProgress((p) => (p ? { ...p, done: p.done + 1 } : null));
          } else if (ev === "end") {
            setProgress(null);
          }
        }
      }

      if (buffer.trim()) {
        try {
          const msg = JSON.parse(buffer.trim()) as Record<string, unknown>;
          if (msg.event === "end") setProgress(null);
        } catch {
          /* trailing fragment */
        }
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        setError(null);
      } else {
        setResults([]);
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
      setProgress(null);
    }
  }, [mode, subnet, tagColumnText, ipColumnText, portsInput]);

  const copyTsv = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(tsvOut);
      setCopyFlash(true);
      window.setTimeout(() => setCopyFlash(false), 1200);
    } catch {
      /* selection fallback */
    }
  }, [tsvOut]);

  const exportExcel = useCallback(() => {
    if (!results.length) return;
    const rows = [...results].sort(
      (a, b) =>
        a.tag.localeCompare(b.tag, undefined, { sensitivity: "base" }) || a.host.localeCompare(b.host),
    );
    const aoa: string[][] = [
      ["Tag", "IP address", "Ping (ms)", "Open ports", "Status"],
      ...rows.map((r) => [
        r.tag,
        r.host,
        r.rtt_ms == null ? "" : String(r.rtt_ms),
        r.open_ports.length ? r.open_ports.join(", ") : "",
        r.status,
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const tagW = Math.min(48, Math.max(10, ...rows.map((r) => r.tag.length)) + 2);
    const hostW = Math.min(32, Math.max(12, ...rows.map((r) => r.host.length)) + 2);
    const portColW = Math.min(28, Math.max(12, ...rows.map((r) => formatOpenPorts(r.open_ports).length)) + 2);
    ws["!cols"] = [{ wch: tagW }, { wch: hostW }, { wch: 10 }, { wch: portColW }, { wch: 12 }];
    ws["!autofilter"] = { ref: `A1:E${rows.length + 1}` };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Targets");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    XLSX.writeFile(wb, `ping_targets_${stamp}.xlsx`);
  }, [results]);

  const sortedForDisplay = useMemo(() => {
    const rank = (s: PingStatus) => (s === "down" ? 0 : s === "tcp_only" ? 1 : 2);
    return [...results].sort((a, b) => rank(a.status) - rank(b.status) || a.host.localeCompare(b.host));
  }, [results]);

  return (
    <div className="space-y-8">
      <div>
        <div className="text-sm text-bsl-muted">Tool</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">PING Check</h1>
        <p className="mt-2 max-w-2xl text-sm text-bsl-muted">
          Checks run in <span className="text-bsl-text/85">Python</span> on the FastAPI backend (ICMP via OS{" "}
          <span className="font-mono text-bsl-text/80">ping</span>, then TCP connects on your port list). Stop aborts
          the stream and leaves partial results. Max 512 targets per run.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["table", "Tag + IP columns"],
            ["subnet", "Subnet (CIDR)"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            disabled={busy}
            onClick={() => setMode(id)}
            className={`rounded-xl border px-4 py-2 text-xs font-semibold tracking-wide transition disabled:opacity-45 ${
              mode === id
                ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-50"
                : "border-bsl-border bg-bsl-panel/40 text-bsl-muted hover:border-bsl-border hover:text-bsl-text"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-bsl-muted">TCP ports to check (comma-separated)</span>
        <input
          type="text"
          value={portsInput}
          onChange={(e) => setPortsInput(e.target.value)}
          spellCheck={false}
          disabled={busy}
          placeholder={DEFAULT_PORTS_INPUT}
          className="w-full rounded-xl border border-bsl-border bg-bsl-panel px-3 py-2 font-mono text-sm text-bsl-text outline-none focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-400/20 disabled:opacity-50"
        />
        <p className="mt-1 text-[11px] text-bsl-muted/85">
          Each host gets a TCP connect attempt on every listed port. Clear the field to use the API default (23, 443,
          502, 4712, 8080, 20000).
        </p>
      </label>

      {mode === "subnet" ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-xs font-medium text-bsl-muted">CIDR</span>
            <input
              value={subnet}
              onChange={(e) => setSubnet(e.target.value)}
              spellCheck={false}
              disabled={busy}
              className="w-full rounded-xl border border-bsl-border bg-bsl-panel px-3 py-2 font-mono text-sm text-bsl-text outline-none focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-400/20 disabled:opacity-50"
              placeholder="192.168.1.0/24"
            />
          </label>
          <RunStopButtons busy={busy} onRun={runCheck} onStop={stopPing} />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-bsl-muted">Input (one row per host)</span>
            <RunStopButtons busy={busy} onRun={runCheck} onStop={stopPing} />
          </div>
          <p className="text-[11px] text-bsl-muted/90">
            Paste each Excel column separately — line 1 with line 1, and so on. Rows with no IP are skipped; empty tag
            uses the IP as the label.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex min-h-0 flex-col gap-1">
              <span className="text-xs font-medium text-bsl-muted">Tag name</span>
              <textarea
                value={tagColumnText}
                onChange={(e) => setTagColumnText(e.target.value)}
                spellCheck={false}
                rows={10}
                disabled={busy}
                className="min-h-[10rem] w-full resize-y rounded-xl border border-bsl-border bg-bsl-panel2/80 px-3 py-2 font-mono text-xs leading-relaxed text-bsl-text outline-none focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-400/20 disabled:opacity-50"
                aria-label="Tag names, one per line"
              />
            </label>
            <label className="flex min-h-0 flex-col gap-1">
              <span className="text-xs font-medium text-bsl-muted">IP address</span>
              <textarea
                value={ipColumnText}
                onChange={(e) => setIpColumnText(e.target.value)}
                spellCheck={false}
                rows={10}
                disabled={busy}
                className="min-h-[10rem] w-full resize-y rounded-xl border border-bsl-border bg-bsl-panel2/80 px-3 py-2 font-mono text-xs leading-relaxed text-bsl-text outline-none focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-400/20 disabled:opacity-50"
                aria-label="IP addresses, one per line"
              />
            </label>
          </div>
        </div>
      )}

      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100/95">
          {error}
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-tight text-bsl-text">Annunciator</h2>
          {progress ? (
            <span className="text-[11px] text-bsl-muted">
              {progress.done} / {progress.total}
            </span>
          ) : results.length ? (
            <span className="text-[11px] text-bsl-muted">
              {results.filter((r) => r.status === "icmp_ok").length} green ·{" "}
              {results.filter((r) => r.status === "tcp_only").length} amber ·{" "}
              {results.filter((r) => r.status === "down").length} red
            </span>
          ) : (
            <span className="text-[11px] text-bsl-muted">Run checks</span>
          )}
        </div>
        <div
          className={`overflow-x-auto rounded-2xl border border-bsl-border bg-bsl-panel/25 p-4 ${
            busy ? "animate-pulse" : ""
          }`}
        >
          {sortedForDisplay.length === 0 ? (
            <p className="min-h-[4rem] w-full py-6 text-center text-sm text-bsl-muted/80">No results yet.</p>
          ) : (
            <div className="grid min-w-[400px] grid-cols-5 gap-2">
              {sortedForDisplay.map((row, i) => (
                <AnnunciatorCard key={`${row.host}-${row.tag}-${i}`} row={row} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-tight text-bsl-text">Results (TSV)</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyTsv}
              className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition ${
                copyFlash
                  ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-50"
                  : "border-bsl-border bg-bsl-panel/50 text-bsl-muted hover:text-bsl-text"
              }`}
            >
              {copyFlash ? "Copied" : "Copy all"}
            </button>
            <button
              type="button"
              disabled={!results.length}
              onClick={exportExcel}
              className="rounded-lg border border-bsl-border bg-bsl-panel/50 px-3 py-1.5 text-[11px] font-semibold text-bsl-muted transition hover:text-bsl-text disabled:pointer-events-none disabled:opacity-40"
            >
              Export Excel
            </button>
          </div>
        </div>
        <textarea
          readOnly
          value={tsvOut}
          spellCheck={false}
          rows={14}
          className="w-full cursor-text select-all rounded-xl border border-bsl-border bg-bsl-bg/80 px-3 py-2 font-mono text-xs leading-relaxed text-bsl-text/95 outline-none focus:border-emerald-500/35 focus:ring-1 focus:ring-emerald-400/25"
          aria-label="Tab-separated results for copy and paste"
          onFocus={(e) => e.target.select()}
        />
        <p className="text-[11px] text-bsl-muted/85">Select all on focus; or Copy all. Header row is always included.</p>
      </section>
    </div>
  );
}
