/**
 * Built-in presets (commit these). Browser saves merge on top by name — stored wins.
 */

export type AthenaRowSnapshot = {
  device_id: string;
  json_key: string;
  labels: string;
  keyFilter: string;
};

export type AthenaQuerySnapshot = {
  database: string;
  rangeDateState: string;
  rangeTimeState: string;
  durationPreset: string;
  customDurationHours: string;
  sampleBucketSeconds: number;
  rows: AthenaRowSnapshot[];
};

export type AthenaSavedQuery = {
  name: string;
  snapshot: AthenaQuerySnapshot;
};

export const ATHENA_SAVED_QUERIES_BUILTIN: AthenaSavedQuery[] = [];

export const ATHENA_SAVED_QUERIES_STORAGE_KEY = "athena-saved-queries-v1";

function safeParseStored(raw: string | null): AthenaSavedQuery[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is AthenaSavedQuery =>
        Boolean(x) &&
        typeof x === "object" &&
        typeof (x as AthenaSavedQuery).name === "string" &&
        typeof (x as AthenaSavedQuery).snapshot === "object" &&
        (x as AthenaSavedQuery).snapshot !== null,
    );
  } catch {
    return [];
  }
}

export function readStoredSavedQueries(): AthenaSavedQuery[] {
  if (typeof window === "undefined") return [];
  return safeParseStored(localStorage.getItem(ATHENA_SAVED_QUERIES_STORAGE_KEY));
}

export function writeStoredSavedQueries(items: AthenaSavedQuery[]) {
  localStorage.setItem(ATHENA_SAVED_QUERIES_STORAGE_KEY, JSON.stringify(items));
}

export function upsertStoredSavedQuery(q: AthenaSavedQuery) {
  const cur = readStoredSavedQueries();
  const next = cur.filter((x) => x.name !== q.name);
  next.push(q);
  writeStoredSavedQueries(next);
}

/** Built-in entries plus stored; same name → stored overrides built-in. */
export function listAllSavedQueries(): AthenaSavedQuery[] {
  const byName = new Map<string, AthenaSavedQuery>();
  for (const q of ATHENA_SAVED_QUERIES_BUILTIN) {
    byName.set(q.name, q);
  }
  for (const q of readStoredSavedQueries()) {
    byName.set(q.name, q);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Paste an object into `ATHENA_SAVED_QUERIES_BUILTIN` in this file. */
export function formatSavedQueryAsTsEntry(q: AthenaSavedQuery): string {
  const body = JSON.stringify(q, null, 2);
  return `${body},\n`;
}
