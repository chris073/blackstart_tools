/* eslint-disable @next/next/no-async-client-component */
"use client";

import { useEffect, useMemo, useState } from "react";
import { HealthBadge } from "@/components/HealthBadge";
import { apiBaseUrl } from "@/lib/config";

type ListResponse = { items: string[]; message: string };
type RunResponse = { rows: string[][]; message: string };
type BuildResponse = { sql: string; expanded_pairs: string[][] };

type BuilderRow = { device_id: string; json_key: string; labels: string };

function toTsv(rows: string[][]) {
  return rows.map((r) => r.join("\t")).join("\n");
}

async function apiGet<T>(path: string) {
  const res = await fetch(`${apiBaseUrl}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as T;
}

async function apiPost<T>(path: string, body: unknown) {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as T;
}

export default function AthenaToolPage() {
  const [tab, setTab] = useState<"builder" | "query">("builder");

  const [database, setDatabase] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const [dbChoices, setDbChoices] = useState<string[]>([]);
  const [deviceIdChoices, setDeviceIdChoices] = useState<string[]>([]);
  const [keysByDevice, setKeysByDevice] = useState<Record<string, string[]>>({});

  const [rows, setRows] = useState<BuilderRow[]>([
    { device_id: "", json_key: "", labels: "" },
  ]);

  const [query, setQuery] = useState("");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    const end0 = now;
    const start0 = new Date(now.getTime() - 60_000);
    const fmt = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };
    setStart(fmt(start0));
    setEnd(fmt(end0));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await apiGet<ListResponse>("/athena/databases");
        if (!cancelled) setDbChoices(res.items);
      } catch {
        // ignore; may be offline
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const canBuild = useMemo(() => !!database && !!start && !!end, [database, start, end]);

  function updateRow(i: number, patch: Partial<BuilderRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => {
      const lastDev = prev.length ? prev[prev.length - 1].device_id : "";
      return [...prev, { device_id: lastDev, json_key: "", labels: "" }];
    });
  }

  async function onListDeviceIds() {
    setError(null);
    setBusy("Listing device IDs…");
    try {
      const res = await apiGet<ListResponse>(
        `/athena/device-ids?database=${encodeURIComponent(database)}&start=${encodeURIComponent(start)}`
      );
      setDeviceIdChoices(res.items);
      setOutput(res.message);
      setTab("query");
      if (rows[0]?.device_id?.trim() === "" && res.items[0]) {
        updateRow(0, { device_id: res.items[0] });
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onKeysForRow(i: number) {
    const dev = rows[i]?.device_id?.trim();
    if (!dev) return setError(`Row ${i + 1}: device_id required.`);
    setError(null);
    setBusy(`Loading keys for ${dev}…`);
    try {
      const res = await apiGet<ListResponse>(
        `/athena/keys?database=${encodeURIComponent(database)}&device_id=${encodeURIComponent(dev)}&start=${encodeURIComponent(start)}`
      );
      setKeysByDevice((prev) => ({ ...prev, [dev]: res.items }));
      setOutput(res.message);
      setTab("query");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onBuild() {
    setError(null);
    setBusy("Building SQL…");
    try {
      const res = await apiPost<BuildResponse>("/athena/build/timeseries-compare", {
        database,
        start,
        end,
        rows,
      });
      setQuery(res.sql);
      setTab("query");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onRun() {
    if (!query.trim()) return;
    setError(null);
    setBusy("Running query…");
    setOutput("Running…");
    try {
      const res = await apiPost<RunResponse>("/athena/run", { query });
      setOutput(res.rows?.length ? toTsv(res.rows) : res.message);
    } catch (e) {
      setOutput("");
      setError(String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-bsl-muted">Tool</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Athena</h1>
        </div>
        <div className="flex items-center gap-2">
          {busy ? (
            <div className="rounded-xl border border-bsl-border bg-bsl-panel/40 px-3 py-1.5 text-xs text-bsl-muted">
              {busy}
            </div>
          ) : null}
          <HealthBadge />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setTab("builder")}
          className={`rounded-xl border px-3 py-1.5 text-sm ${
            tab === "builder"
              ? "border-white/15 bg-bsl-panel text-bsl-text"
              : "border-bsl-border bg-bsl-panel/30 text-bsl-muted hover:bg-bsl-panel/50"
          }`}
        >
          Query Builder
        </button>
        <button
          onClick={() => setTab("query")}
          className={`rounded-xl border px-3 py-1.5 text-sm ${
            tab === "query"
              ? "border-white/15 bg-bsl-panel text-bsl-text"
              : "border-bsl-border bg-bsl-panel/30 text-bsl-muted hover:bg-bsl-panel/50"
          }`}
        >
          Query / Output
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {tab === "builder" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-bsl-border bg-bsl-panel/60 p-5 backdrop-blur">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1">
                <div className="text-xs text-bsl-muted">Database</div>
                <input
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  list="dbs"
                  className="w-full rounded-xl border border-bsl-border bg-bsl-panel2 px-3 py-2 text-sm outline-none focus:border-white/20"
                  placeholder="schema (e.g. MYDB)"
                />
                <datalist id="dbs">
                  {dbChoices.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </label>
              <label className="space-y-1">
                <div className="text-xs text-bsl-muted">Start</div>
                <input
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="w-full rounded-xl border border-bsl-border bg-bsl-panel2 px-3 py-2 text-sm outline-none focus:border-white/20"
                  placeholder="YYYY-MM-DD HH:MM:SS"
                />
              </label>
              <label className="space-y-1">
                <div className="text-xs text-bsl-muted">End (exclusive)</div>
                <input
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="w-full rounded-xl border border-bsl-border bg-bsl-panel2 px-3 py-2 text-sm outline-none focus:border-white/20"
                  placeholder="YYYY-MM-DD HH:MM:SS"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                disabled={!database || !start}
                onClick={onListDeviceIds}
                className="rounded-xl border border-bsl-border bg-bsl-panel2 px-3 py-2 text-sm text-bsl-text disabled:opacity-40"
              >
                List device IDs
              </button>
              <button
                disabled={!canBuild}
                onClick={onBuild}
                className="rounded-xl border border-white/15 bg-gradient-to-r from-bsl-accent/70 to-bsl-accent2/40 px-3 py-2 text-sm text-bsl-text shadow-glow disabled:opacity-40"
              >
                Build SQL
              </button>
              <button
                onClick={addRow}
                className="rounded-xl border border-bsl-border bg-bsl-panel2 px-3 py-2 text-sm text-bsl-muted hover:text-bsl-text"
              >
                + Row
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-bsl-border bg-bsl-panel/60 p-5 backdrop-blur">
            <div className="mb-3 text-xs text-bsl-muted">
              Labels overrides JSON key. Use comma-separated keys, or <span className="text-bsl-text">*</span> to
              include all keys (API loads them for the device/day).
            </div>
            <div className="space-y-2">
              {rows.map((r, i) => {
                const keyChoices = keysByDevice[r.device_id] ?? [];
                return (
                  <div key={i} className="grid gap-2 md:grid-cols-[28px_1fr_1fr_1fr_120px]">
                    <div className="pt-2 text-xs text-bsl-muted">{i + 1}.</div>
                    <input
                      value={r.device_id}
                      onChange={(e) => updateRow(i, { device_id: e.target.value })}
                      list="device-ids"
                      className="rounded-xl border border-bsl-border bg-bsl-panel2 px-3 py-2 text-sm outline-none focus:border-white/20"
                      placeholder="device_id"
                    />
                    <input
                      value={r.json_key}
                      onChange={(e) => updateRow(i, { json_key: e.target.value })}
                      list={`keys-${i}`}
                      className="rounded-xl border border-bsl-border bg-bsl-panel2 px-3 py-2 text-sm outline-none focus:border-white/20"
                      placeholder="json key (e.g. kw)"
                    />
                    <datalist id={`keys-${i}`}>
                      {keyChoices.map((k) => (
                        <option key={k} value={k} />
                      ))}
                    </datalist>
                    <input
                      value={r.labels}
                      onChange={(e) => updateRow(i, { labels: e.target.value })}
                      className="rounded-xl border border-bsl-border bg-bsl-panel2 px-3 py-2 text-sm outline-none focus:border-white/20"
                      placeholder="labels (e.g. kw,solirr1 or *)"
                    />
                    <button
                      disabled={!database || !start || !r.device_id.trim()}
                      onClick={() => onKeysForRow(i)}
                      className="rounded-xl border border-bsl-border bg-bsl-panel2 px-3 py-2 text-sm text-bsl-muted hover:text-bsl-text disabled:opacity-40"
                    >
                      Keys
                    </button>
                  </div>
                );
              })}
              <datalist id="device-ids">
                {deviceIdChoices.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-bsl-border bg-bsl-panel/60 p-5 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium">Query</div>
              <button
                disabled={!query.trim()}
                onClick={onRun}
                className="rounded-xl border border-white/15 bg-gradient-to-r from-bsl-accent/70 to-bsl-accent2/40 px-3 py-2 text-sm text-bsl-text shadow-glow disabled:opacity-40"
              >
                Run query
              </button>
            </div>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="mt-3 h-64 w-full resize-y rounded-xl border border-bsl-border bg-bsl-panel2 p-3 font-mono text-xs text-bsl-text outline-none focus:border-white/20"
              placeholder="SQL…"
            />
          </div>

          <div className="rounded-2xl border border-bsl-border bg-bsl-panel/40 p-5 backdrop-blur">
            <div className="text-sm font-medium">Output</div>
            <textarea
              value={output}
              readOnly
              className="mt-3 h-64 w-full resize-y rounded-xl border border-bsl-border bg-bsl-panel2 p-3 font-mono text-xs text-bsl-text outline-none"
              placeholder="Run a query to see results…"
            />
          </div>
        </div>
      )}
    </div>
  );
}

