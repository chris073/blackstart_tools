"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { ClientOnly } from "@/components/ClientOnly";
import { apiBaseUrl } from "@/lib/config";
import {
  formatSavedQueryAsTsEntry,
  listAllSavedQueries,
  upsertStoredSavedQuery,
  type AthenaQuerySnapshot,
} from "./savedQueries";

type DatabasesResponse = { items: string[]; message: string; source_path?: string };
type KeysResponse = { items: string[]; sql: string; message: string; rows: string[][] };
type RunResponse = { rows: string[][]; message: string };
type BuildResponse = { sql: string; expanded_pairs: string[][] };

type BuilderRow = {
  id: string;
  device_id: string;
  json_key: string;
  labels: string;
  keyFilter: string;
};

function createRow(overrides: Partial<Omit<BuilderRow, "id">> = {}): BuilderRow {
  const id =
    typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : `r-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return {
    id,
    device_id: "",
    json_key: "",
    labels: "",
    keyFilter: "",
    ...overrides,
  };
}

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

function filterKeys(keys: string[], q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return keys;
  return keys.filter((k) => k.toLowerCase().includes(s));
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Local datetime string for Athena API: YYYY-MM-DD HH:MM:SS */
function formatAthenaDateTime(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function defaultDateAndTime() {
  const now = new Date();
  const totalMin = now.getHours() * 60 + now.getMinutes();
  const rounded = Math.floor(totalMin / 15) * 15;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  const date = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const time = `${pad2(h)}:${pad2(m)}`;
  return { date, time };
}

const TIME_OPTIONS_24H = (() => {
  const out: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let min = 0; min < 60; min += 15) {
      out.push(`${pad2(hour)}:${pad2(min)}`);
    }
  }
  return out;
})();

const SAMPLE_PERIODS = [
  { id: "1s", label: "1 second", seconds: 1 },
  { id: "2s", label: "2 seconds", seconds: 2 },
  { id: "4s", label: "4 seconds", seconds: 4 },
  { id: "1m", label: "1 minute", seconds: 60 },
  { id: "2m", label: "2 minutes", seconds: 120 },
  { id: "4m", label: "4 minutes", seconds: 240 },
  { id: "10m", label: "10 minutes", seconds: 600 },
  { id: "1h", label: "1 hour", seconds: 3600 },
  { id: "2h", label: "2 hours", seconds: 7200 },
  { id: "4h", label: "4 hours", seconds: 14400 },
] as const;

function samplePeriodIdFromSeconds(sec: number): string {
  const hit = SAMPLE_PERIODS.find((p) => p.seconds === sec);
  return hit ? hit.id : "1m";
}

function parseLabelKeys(labels: string, jsonKey: string): Set<string> {
  const lab = labels.trim();
  if (lab === "*") return new Set();
  if (lab) return new Set(lab.split(",").map((x) => x.trim()).filter(Boolean));
  const j = jsonKey.trim();
  return j ? new Set([j]) : new Set();
}

function isKeySelected(r: BuilderRow, k: string) {
  if (r.labels.trim() === "*") return false;
  return parseLabelKeys(r.labels, r.json_key).has(k);
}

const DURATION_PRESETS = [
  { id: "15s", label: "15 seconds", ms: 15_000 },
  { id: "30s", label: "30 seconds", ms: 30_000 },
  { id: "1m", label: "1 minute", ms: 60_000 },
  { id: "2m", label: "2 minutes", ms: 120_000 },
  { id: "5m", label: "5 minutes", ms: 300_000 },
  { id: "10m", label: "10 minutes", ms: 600_000 },
  { id: "15m", label: "15 minutes", ms: 900_000 },
  { id: "30m", label: "30 minutes", ms: 1_800_000 },
  { id: "60m", label: "60 minutes", ms: 3_600_000 },
  { id: "120m", label: "120 minutes", ms: 7_200_000 },
  { id: "3h", label: "3 hours", ms: 10_800_000 },
  { id: "4h", label: "4 hours", ms: 14_400_000 },
  { id: "6h", label: "6 hours", ms: 21_600_000 },
  { id: "8h", label: "8 hours", ms: 28_800_000 },
  { id: "12h", label: "12 hours", ms: 43_200_000 },
  { id: "18h", label: "18 hours", ms: 64_800_000 },
  { id: "24h", label: "24 hours", ms: 86_400_000 },
  { id: "custom", label: "Custom (hours)", ms: null },
] as const;

export default function AthenaToolPage() {
  const lastDbRef = useRef("");
  const [database, setDatabase] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const [rangeDateState, setRangeDateState] = useState(() => defaultDateAndTime().date);
  const [rangeTimeState, setRangeTimeState] = useState(() => defaultDateAndTime().time);
  const [durationPreset, setDurationPreset] = useState<string>("1m");
  const [customDurationHours, setCustomDurationHours] = useState("1");
  const [samplePeriodId, setSamplePeriodId] = useState<string>("1m");

  const [dbChoices, setDbChoices] = useState<string[]>([]);
  const [dbMeta, setDbMeta] = useState<{ message: string; path: string }>({ message: "", path: "" });
  const [keysByDevice, setKeysByDevice] = useState<Record<string, string[]>>({});

  const [rows, setRows] = useState<BuilderRow[]>(() => [createRow()]);

  const [saveQueryName, setSaveQueryName] = useState("");
  const [savedQueriesTick, setSavedQueriesTick] = useState(0);
  const [loadQueryValue, setLoadQueryValue] = useState("");

  const [query, setQuery] = useState("");
  const [output, setOutput] = useState("");
  const [resultRows, setResultRows] = useState<string[][]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const parts = rangeDateState.split("-").map((x) => parseInt(x, 10));
    const tparts = rangeTimeState.split(":").map((x) => parseInt(x, 10));
    const yy = parts[0];
    const mo = parts[1];
    const dd = parts[2];
    const th = tparts[0];
    const tm = tparts[1];
    if (
      parts.length !== 3 ||
      tparts.length !== 2 ||
      !Number.isFinite(yy) ||
      !Number.isFinite(mo) ||
      !Number.isFinite(dd) ||
      !Number.isFinite(th) ||
      !Number.isFinite(tm)
    ) {
      setStart("");
      setEnd("");
      return;
    }
    let ms = 0;
    if (durationPreset === "custom") {
      const h = parseFloat(customDurationHours);
      ms = Number.isFinite(h) && h > 0 ? h * 3600 * 1000 : 0;
    } else {
      const row = DURATION_PRESETS.find((p) => p.id === durationPreset);
      ms = row && row.ms != null ? row.ms : 0;
    }
    if (ms <= 0) {
      setStart("");
      setEnd("");
      return;
    }
    const startD = new Date(yy, mo - 1, dd, th, tm, 0, 0);
    const endD = new Date(startD.getTime() + ms);
    setStart(formatAthenaDateTime(startD));
    setEnd(formatAthenaDateTime(endD));
  }, [rangeDateState, rangeTimeState, durationPreset, customDurationHours]);

  const loadDatabases = useCallback(async () => {
    try {
      const res = await apiGet<DatabasesResponse>("/athena/databases");
      setDbChoices(res.items ?? []);
      setDbMeta({ message: res.message ?? "", path: res.source_path ?? "" });
    } catch {
      setDbChoices([]);
      setDbMeta({ message: "Could not load databases.", path: "" });
    }
  }, []);

  useEffect(() => {
    loadDatabases();
  }, [loadDatabases]);

  useEffect(() => {
    const s = database.trim();
    if (!s) return;
    const upper = s.toUpperCase();
    const prev = lastDbRef.current.trim();
    setRows((prevRows) =>
      prevRows.map((r) => {
        const d = r.device_id.trim();
        if (!d || (prev && d.toUpperCase() === prev.toUpperCase())) {
          return { ...r, device_id: upper };
        }
        return r;
      }),
    );
    lastDbRef.current = s;
  }, [database]);

  const savedQueryList = useMemo(() => listAllSavedQueries(), [savedQueriesTick]);

  const canBuild = useMemo(() => {
    if (!database.trim() || !start || !end) return false;
    return rows.every(
      (r) => r.device_id.trim() && (r.json_key.trim() || r.labels.trim()),
    );
  }, [database, start, end, rows]);

  function updateRowById(id: string, patch: Partial<BuilderRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id: string) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  }

  function addRow() {
    setRows((prev) => {
      const fallbackDev =
        database.trim().toUpperCase() || prev[prev.length - 1]?.device_id || "";
      return [...prev, createRow({ device_id: fallbackDev })];
    });
  }

  function toggleRowLabelKey(r: BuilderRow, key: string) {
    const set = parseLabelKeys(r.labels, r.json_key);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    const nextLabels = [...set].sort().join(", ");
    updateRowById(r.id, { labels: nextLabels, json_key: "" });
  }

  function applySavedQuerySnapshot(s: AthenaQuerySnapshot) {
    setDatabase(s.database);
    setRangeDateState(s.rangeDateState);
    setRangeTimeState(s.rangeTimeState);
    setDurationPreset(s.durationPreset);
    setCustomDurationHours(s.customDurationHours);
    setSamplePeriodId(samplePeriodIdFromSeconds(s.sampleBucketSeconds));
    setRows(
      s.rows.length
        ? s.rows.map((row) => createRow({ ...row }))
        : [createRow()],
    );
    setKeysByDevice({});
    setQuery("");
    setOutput("");
    setResultRows([]);
    setError(null);
  }

  function saveCurrentQuery() {
    const name = saveQueryName.trim();
    if (!name) {
      setError("Enter a name before saving.");
      return;
    }
    setError(null);
    const sampleBucketSeconds =
      SAMPLE_PERIODS.find((p) => p.id === samplePeriodId)?.seconds ?? 60;
    const snapshot: AthenaQuerySnapshot = {
      database,
      rangeDateState,
      rangeTimeState,
      durationPreset,
      customDurationHours,
      sampleBucketSeconds,
      rows: rows.map(({ device_id, json_key, labels, keyFilter }) => ({
        device_id,
        json_key,
        labels,
        keyFilter,
      })),
    };
    upsertStoredSavedQuery({ name, snapshot });
    setSavedQueriesTick((t) => t + 1);
    const ts = formatSavedQueryAsTsEntry({ name, snapshot });
    void navigator.clipboard.writeText(ts).catch(() => {});
  }

  function exportExcel() {
    if (!resultRows.length) return;
    const ws = XLSX.utils.aoa_to_sheet(resultRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Results");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    XLSX.writeFile(wb, `athena_results_${stamp}.xlsx`);
  }

  async function onKeysForRow(i: number) {
    const dev = rows[i]?.device_id?.trim();
    if (!dev) return setError(`Row ${i + 1}: device_id required.`);
    setError(null);
    setBusy(`Loading keys for ${dev}…`);
    try {
      const res = await apiGet<KeysResponse>(
        `/athena/keys?database=${encodeURIComponent(database)}&device_id=${encodeURIComponent(dev)}&start=${encodeURIComponent(start)}`
      );
      setKeysByDevice((prev) => ({ ...prev, [dev]: res.items }));
      setQuery(res.sql);
      const grid = res.rows ?? [];
      setResultRows(grid);
      setOutput(grid.length ? toTsv(grid) : res.message);
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
      const sample_bucket_seconds =
        SAMPLE_PERIODS.find((p) => p.id === samplePeriodId)?.seconds ?? 60;
      const res = await apiPost<BuildResponse>("/athena/build/timeseries-compare", {
        database,
        start,
        end,
        sample_bucket_seconds,
        rows: rows.map(({ device_id, json_key, labels }) => ({ device_id, json_key, labels })),
      });
      setQuery(res.sql);
      setOutput(`Built timeseries SQL (${res.expanded_pairs.length} series).`);
      setResultRows([]);
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
    setResultRows([]);
    try {
      const res = await apiPost<RunResponse>("/athena/run", { query: query.trim() });
      const grid = res.rows ?? [];
      setResultRows(grid);
      if (grid.length) {
        setOutput(toTsv(grid));
      } else {
        setOutput(res.message || "(no rows)");
      }
    } catch (e) {
      setOutput("");
      setResultRows([]);
      setError(String(e));
    } finally {
      setBusy(null);
    }
  }

  const shell = (
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
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-bsl-border bg-bsl-panel/60 p-5 backdrop-blur">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-bsl-muted">Database</span>
              <button
                type="button"
                onClick={() => loadDatabases()}
                className="rounded-lg border border-bsl-border bg-bsl-panel2 px-2 py-0.5 text-[10px] text-bsl-muted hover:text-bsl-text"
              >
                Refresh
              </button>
            </div>
            <select
              value={dbChoices.includes(database) ? database : ""}
              onChange={(e) => setDatabase(e.target.value)}
              className="w-full rounded-xl border border-bsl-border bg-bsl-panel2 px-3 py-2 text-sm text-bsl-text outline-none focus:border-white/20"
            >
              <option value="">— Choose from JSON list ({dbChoices.length}) —</option>
              {dbChoices.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <div className="space-y-1">
              <div className="text-[11px] text-bsl-muted">Schema for Keys / Build</div>
              <input
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                autoComplete="off"
                className="w-full rounded-xl border border-bsl-border bg-bsl-panel2 px-3 py-2 text-sm text-bsl-text outline-none focus:border-white/20"
                placeholder="Schema name"
              />
            </div>
            <div className="text-[11px] leading-snug text-bsl-muted">
              {dbMeta.message}
              {dbMeta.path ? (
                <>
                  <br />
                  <span className="opacity-80">{dbMeta.path}</span>
                </>
              ) : null}
            </div>
          </label>
          <div className="space-y-3 md:col-span-2">
            <div className="text-xs font-medium text-bsl-muted">Time range</div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1">
                <span className="text-xs text-bsl-muted">Date</span>
                <input
                  type="date"
                  value={rangeDateState}
                  onChange={(e) => setRangeDateState(e.target.value)}
                  className="w-full rounded-xl border border-bsl-border bg-bsl-panel2 px-3 py-2 text-sm text-bsl-text outline-none focus:border-white/20"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-bsl-muted">Time (24h, 15 min)</span>
                <select
                  value={rangeTimeState}
                  onChange={(e) => setRangeTimeState(e.target.value)}
                  className="w-full rounded-xl border border-bsl-border bg-bsl-panel2 px-3 py-2 text-sm text-bsl-text outline-none focus:border-white/20"
                >
                  {TIME_OPTIONS_24H.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-bsl-muted">Span</span>
                <select
                  value={durationPreset}
                  onChange={(e) => setDurationPreset(e.target.value)}
                  className="w-full rounded-xl border border-bsl-border bg-bsl-panel2 px-3 py-2 text-sm text-bsl-text outline-none focus:border-white/20"
                >
                  {DURATION_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {durationPreset === "custom" ? (
              <label className="block space-y-1">
                <span className="text-xs text-bsl-muted">Custom duration (hours)</span>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={customDurationHours}
                  onChange={(e) => setCustomDurationHours(e.target.value)}
                  className="w-full max-w-xs rounded-xl border border-bsl-border bg-bsl-panel2 px-3 py-2 text-sm text-bsl-text outline-none focus:border-white/20 sm:w-auto"
                />
              </label>
            ) : null}
            {start && end ? (
              <p className="text-[11px] leading-snug text-bsl-muted">
                <span className="text-bsl-text/80">{start}</span>
                {" → "}
                <span className="text-bsl-text/80">{end}</span>
                <span> (end exclusive)</span>
              </p>
            ) : null}
            <label className="mt-2 block space-y-1">
              <span className="text-xs text-bsl-muted">Sample period (SQL bucket)</span>
              <select
                value={samplePeriodId}
                onChange={(e) => setSamplePeriodId(e.target.value)}
                className="w-full max-w-md rounded-xl border border-bsl-border bg-bsl-panel2 px-3 py-2 text-sm text-bsl-text outline-none focus:border-white/20"
              >
                {SAMPLE_PERIODS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-bsl-border bg-bsl-panel/60 p-5 backdrop-blur">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="min-w-[200px] flex-1 space-y-1">
            <span className="text-xs text-bsl-muted">Load saved query</span>
            <select
              value={loadQueryValue}
              onChange={(e) => {
                const v = e.target.value;
                setLoadQueryValue(v);
                if (!v) return;
                const found = savedQueryList.find((q) => q.name === v);
                if (found) applySavedQuerySnapshot(found.snapshot);
                setLoadQueryValue("");
              }}
              className="w-full rounded-xl border border-bsl-border bg-bsl-panel2 px-3 py-2 text-sm text-bsl-text outline-none focus:border-white/20"
            >
              <option value="">— {savedQueryList.length} saved —</option>
              {savedQueryList.map((q) => (
                <option key={q.name} value={q.name}>
                  {q.name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[160px] flex-1 space-y-1">
            <span className="text-xs text-bsl-muted">Save as (browser + copy TS)</span>
            <input
              value={saveQueryName}
              onChange={(e) => setSaveQueryName(e.target.value)}
              placeholder="Name…"
              className="w-full rounded-xl border border-bsl-border bg-bsl-panel2 px-3 py-2 text-sm text-bsl-text outline-none focus:border-white/20"
            />
          </label>
          <button
            type="button"
            onClick={() => saveCurrentQuery()}
            className="rounded-xl border border-bsl-border bg-bsl-panel2 px-4 py-2 text-sm text-bsl-muted hover:text-bsl-text"
          >
            Save query
          </button>
        </div>
        <p className="mb-3 text-[11px] leading-snug text-bsl-muted">
          Saves go to local storage and the preset is copied for pasting into{" "}
          <span className="font-mono text-bsl-text/80">savedQueries.ts</span>. Repo presets live in{" "}
          <span className="font-mono text-bsl-text/80">ATHENA_SAVED_QUERIES_BUILTIN</span>.
        </p>
        <div className="mb-3 text-xs text-bsl-muted">
          Run <span className="text-bsl-text">Keys</span>, then toggle keys below to fill{" "}
          <span className="text-bsl-text">labels</span> (comma-separated). Type{" "}
          <span className="font-mono text-bsl-text/80">*</span> in labels for all keys at build time.{" "}
          <span className="text-bsl-text">device_id</span> tracks the schema name in ALL CAPS.
        </div>
        <div className="space-y-4">
          {rows.map((r, i) => {
            const allKeys = keysByDevice[r.device_id] ?? [];
            const filtered = filterKeys(allKeys, r.keyFilter);
            return (
              <div key={r.id} className="rounded-xl border border-bsl-border bg-bsl-panel2/40 p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-bsl-muted">Row {i + 1}</span>
                  {rows.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeRow(r.id)}
                      className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-2 py-1 text-[10px] text-rose-200 hover:bg-rose-500/20"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs text-bsl-muted">device_id</span>
                    <input
                      value={r.device_id}
                      onChange={(e) => updateRowById(r.id, { device_id: e.target.value })}
                      className="w-full rounded-xl border border-bsl-border bg-bsl-panel2 px-3 py-2 text-sm outline-none focus:border-white/20"
                      placeholder="device_id"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-bsl-muted">labels</span>
                    <input
                      value={r.labels}
                      onChange={(e) => updateRowById(r.id, { labels: e.target.value })}
                      className="w-full rounded-xl border border-bsl-border bg-bsl-panel2 px-3 py-2 text-sm outline-none focus:border-white/20"
                      placeholder="kw,solirr1 or *"
                    />
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap items-start gap-3">
                  <div className="min-w-[200px] flex-1 space-y-1">
                    <span className="text-xs text-bsl-muted">Search keys</span>
                    <input
                      value={r.keyFilter}
                      onChange={(e) => updateRowById(r.id, { keyFilter: e.target.value })}
                      disabled={!allKeys.length}
                      className="w-full rounded-xl border border-bsl-border bg-bsl-panel2 px-3 py-2 text-sm outline-none focus:border-white/20 disabled:opacity-40"
                      placeholder={allKeys.length ? "Filter loaded keys…" : "Run Keys on this row first"}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!database || !start || !r.device_id.trim()}
                    onClick={() => onKeysForRow(i)}
                    className="mt-5 shrink-0 rounded-xl border border-bsl-border bg-bsl-panel2 px-4 py-2 text-sm text-bsl-muted hover:text-bsl-text disabled:opacity-40"
                  >
                    Keys
                  </button>
                </div>
                {allKeys.length > 0 ? (
                  <div className="mt-2 max-h-36 overflow-y-auto rounded-xl border border-bsl-border bg-bsl-panel p-2">
                    <div className="flex flex-wrap gap-1">
                      {filtered.length ? (
                        filtered.map((k) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => toggleRowLabelKey(r, k)}
                            className={`rounded-lg border px-2 py-1 font-mono text-xs transition hover:border-white/20 ${
                              isKeySelected(r, k)
                                ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-100"
                                : "border-bsl-border bg-bsl-panel2 text-bsl-text"
                            }`}
                          >
                            {k}
                          </button>
                        ))
                      ) : (
                        <span className="text-xs text-bsl-muted">No keys match this search.</span>
                      )}
                    </div>
                  </div>
                ) : null}
                {r.labels.trim() === "*" ? (
                  <p className="mt-2 text-[11px] text-amber-200/90">
                    labels is <span className="font-mono">*</span> — all keys at build time.
                  </p>
                ) : r.labels.trim() || r.json_key ? (
                  <p className="mt-2 text-[11px] text-bsl-muted">
                    labels:{" "}
                    <span className="font-mono text-bsl-text/90">
                      {r.labels.trim() || r.json_key}
                    </span>
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!canBuild}
            onClick={onBuild}
            className="rounded-xl border border-white/15 bg-gradient-to-r from-bsl-accent/70 to-bsl-accent2/40 px-3 py-2 text-sm text-bsl-text shadow-glow disabled:opacity-40"
          >
            Build SQL
          </button>
          <button
            type="button"
            onClick={addRow}
            className="rounded-xl border border-bsl-border bg-bsl-panel2 px-3 py-2 text-sm text-bsl-muted hover:text-bsl-text"
          >
            + Row
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-bsl-border bg-bsl-panel/60 p-5 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium">Query</div>
          <button
            type="button"
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
          className="mt-3 h-56 w-full resize-y rounded-xl border border-bsl-border bg-bsl-panel2 p-3 font-mono text-xs text-bsl-text outline-none focus:border-white/20"
          placeholder="SQL… (Keys / Build SQL fill this box)"
          spellCheck={false}
        />
      </div>

      <div className="rounded-2xl border border-bsl-border bg-bsl-panel/40 p-5 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium">Output</div>
          <button
            type="button"
            disabled={!resultRows.length}
            onClick={exportExcel}
            className="rounded-xl border border-bsl-border bg-bsl-panel2 px-3 py-2 text-sm text-bsl-text disabled:opacity-40"
          >
            Export Excel (.xlsx)
          </button>
        </div>
        <textarea
          value={output}
          readOnly
          className="mt-3 h-64 w-full resize-y rounded-xl border border-bsl-border bg-bsl-panel2 p-3 font-mono text-xs text-bsl-text outline-none"
          placeholder="Keys / Run query results appear here (tab-separated)…"
          spellCheck={false}
        />
        <div className="mt-2 text-xs text-bsl-muted">
          {resultRows.length
            ? `${resultRows.length} row(s) — Excel export uses this grid.`
            : "Excel export is enabled when a query returns rows (e.g. after Keys or Run)."}
        </div>
      </div>
    </div>
  );

  return (
    <ClientOnly
      fallback={
        <div className="space-y-6">
          <div className="h-10 w-48 animate-pulse rounded-lg bg-bsl-panel/50" />
          <div className="h-40 animate-pulse rounded-2xl bg-bsl-panel/40" />
          <div className="h-56 animate-pulse rounded-2xl bg-bsl-panel/40" />
        </div>
      }
    >
      {shell}
    </ClientOnly>
  );
}
