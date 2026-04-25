"""Athena FreeSimpleGUI: load databases, import/export list, query, export CSV. Uses .env.local."""
import csv
import json
import os
import re
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set, Tuple

import boto3
import FreeSimpleGUI as sg
from dotenv import load_dotenv

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
QUERIES_DIR = os.path.join(_SCRIPT_DIR, "queries")
QB_PRESET_VERSION = 1
load_dotenv(os.path.join(_SCRIPT_DIR, ".env.local"), override=True)

REGION = os.getenv("REGION", "us-west-2")
WORKGROUP = os.getenv("WORKGROUP", "engineering")
DEVICE_TABLE = "device"
DATE_COL = "date_rec"
DATA_COL = "data"


def _env_path(key: str) -> str:
    """Read key from .env.local (handles values with apostrophes)."""
    env_file = os.path.join(_SCRIPT_DIR, ".env.local")
    if os.path.isfile(env_file):
        try:
            with open(env_file, "r", encoding="utf-8", errors="replace") as f:
                for line in f:
                    s = line.strip()
                    if not s or s.startswith("#") or not s.startswith(key + "="):
                        continue
                    rest = s.split("=", 1)[1].strip()
                    if rest.startswith('"'):
                        end = rest.find('"', 1)
                        return rest[1:end] if end != -1 else rest[1:]
                    if rest.startswith("'"):
                        end = rest.find("'", 1)
                        return rest[1:end] if end != -1 else rest[1:]
                    return rest
        except Exception:
            pass
    raw = (os.getenv(key) or "").strip()
    if (raw.startswith('"') and raw.endswith('"')) or (raw.startswith("'") and raw.endswith("'")):
        raw = raw[1:-1]
    return raw


def _resolve_path(raw: str) -> str:
    if not raw:
        return ""
    p = os.path.normpath(os.path.expanduser(raw))
    return p if os.path.isabs(p) else os.path.join(_SCRIPT_DIR, p)


DATABASES_LIST_PATH = _resolve_path(_env_path("DATABASES_LIST_PATH"))


def run_athena_query(query: str) -> Tuple[List[List[str]], str]:
    q = (query or "").strip()
    if not q:
        return [], "No query entered."
    try:
        client = boto3.client("athena", region_name=REGION)
        r = client.start_query_execution(QueryString=q, WorkGroup=WORKGROUP)
        eid = r["QueryExecutionId"]
    except Exception as e:
        return [], "Failed to start query: {}".format(e)
    while True:
        try:
            r = client.get_query_execution(QueryExecutionId=eid)
            state = r["QueryExecution"]["Status"]["State"]
        except Exception as e:
            return [], "Failed to get status: {}".format(e)
        if state in ("SUCCEEDED", "FAILED", "CANCELLED"):
            break
        time.sleep(1)
    if state != "SUCCEEDED":
        return [], "Query {}: {}".format(state, r["QueryExecution"]["Status"].get("StateChangeReason", state))
    try:
        res = client.get_query_results(QueryExecutionId=eid)
    except Exception as e:
        return [], "Failed to get results: {}".format(e)
    rows = [[col.get("VarCharValue") or "" for col in row["Data"]] for row in res["ResultSet"]["Rows"]]
    return rows, "Succeeded"


def rows_to_text(rows: List[List[str]]) -> str:
    return "\n".join("\t".join(c for c in row) for row in rows) if rows else ""


def load_databases_from_file(path: str) -> List[str]:
    if not path:
        return []
    path = os.path.normpath(os.path.expanduser(path))
    if not os.path.isfile(path):
        return []
    content = None
    for enc in ("utf-8", "utf-8-sig", "cp1252"):
        try:
            with open(path, "r", encoding=enc) as f:
                content = f.read().strip()
            break
        except (UnicodeDecodeError, OSError):
            continue
    if not content:
        return []
    try:
        if path.lower().endswith(".json"):
            d = json.loads(content)
            raw = d if isinstance(d, list) else d.get("databases", [])
            return [str(x).strip() for x in raw] if raw else []
        return [ln.strip() for ln in content.splitlines() if ln.strip()]
    except (json.JSONDecodeError, TypeError):
        return []


def save_list_to_file(path: str, names: List[str]) -> Optional[str]:
    try:
        with open(path, "w", encoding="utf-8") as f:
            if path.lower().endswith(".json"):
                json.dump({"databases": names}, f, indent=2)
            else:
                f.write("\n".join(names))
        return None
    except Exception as e:
        return str(e)


def apply_db_list(window, names: List[str]) -> None:
    window["databases_dropdown"].update(values=names, value=names[0] if names else "")
    window["config_output"].update("\n".join(names))
    window.refresh()


def _qb_default_time_range() -> Tuple[str, str]:
    """Start = now − 1 minute, end = now (for Query Builder defaults)."""
    now = datetime.now()
    start = now - timedelta(minutes=1)
    return (
        start.strftime("%Y-%m-%d %H:%M:%S"),
        now.strftime("%Y-%m-%d %H:%M:%S"),
    )


def _ensure_queries_dir() -> Optional[str]:
    try:
        os.makedirs(QUERIES_DIR, exist_ok=True)
        return None
    except OSError as e:
        return str(e)


def _qb_pair_row(
    i: int,
    device_combo_values: List[str],
    dev: str = "",
    json_key: str = "",
    labels: str = "",
) -> list:
    dv = list(device_combo_values) if device_combo_values else []
    dev_s = (dev or "").strip()
    if dev_s and dev_s not in dv:
        dv = sorted(set(dv) | {dev_s})
    elif not dv:
        dv = [""]
    key_choices: List[str] = [""]
    jk = (json_key or "").strip()
    if jk:
        key_choices = sorted(set(key_choices) | {jk})
    return [
        sg.Text("{}. ".format(i + 1), size=(3, 1)),
        sg.Combo(
            dv,
            default_value=dev_s if dev_s in dv else (dv[0] if dv else ""),
            key="qb_dev_{}".format(i),
            size=(24, 1),
            readonly=False,
            enable_events=True,
            pad=((4, 0), 0),
            tooltip="Type or pick; run List device IDs query on Query tab to load choices from results",
        ),
        sg.Combo(
            key_choices,
            default_value=jk if jk in key_choices else "",
            key="qb_key_{}".format(i),
            size=(18, 1),
            readonly=False,
            expand_x=True,
            pad=((4, 0), 0),
            tooltip="Single key when labels is empty; type or pick after running Keys query",
        ),
        sg.Input(
            default_text=(labels or "").strip(),
            key="qb_labels_{}".format(i),
            size=(22, 1),
            expand_x=True,
            pad=((4, 0), 0),
            tooltip="Optional: comma-separated keys, or * for all keys loaded for this device (run Keys first). Overrides JSON key when non-empty.",
        ),
        sg.Button(
            "Keys",
            key="qb_keys_{}".format(i),
            tooltip="Place distinct JSON keys SQL on Query tab; Run query there to execute and refresh dropdowns",
        ),
    ]


def _qb_build_pairs_inner_from_preset_rows(
    rows: List[dict], device_id_choices: List[str]
) -> List[list]:
    out: List[list] = []
    for i, r in enumerate(rows):
        if not isinstance(r, dict):
            r = {}
        out.append(
            _qb_pair_row(
                i,
                list(device_id_choices),
                dev=str(r.get("device_id") or ""),
                json_key=str(r.get("json_key") or ""),
                labels=str(r.get("labels") or ""),
            )
        )
    return out


def _qb_preset_from_values(values: dict, qb_indices: List[int]) -> dict:
    row_list: List[dict] = []
    for idx in qb_indices:
        row_list.append(
            {
                "device_id": (values.get("qb_dev_{}".format(idx)) or "").strip(),
                "json_key": (values.get("qb_key_{}".format(idx)) or "").strip(),
                "labels": (values.get("qb_labels_{}".format(idx)) or "").strip(),
            }
        )
    return {
        "athena_query_builder": QB_PRESET_VERSION,
        "database": (values.get("qb_database") or "").strip(),
        "start": (values.get("qb_start") or "").strip(),
        "end": (values.get("qb_end") or "").strip(),
        "rows": row_list,
        "query_sql": values.get("query") or "",
    }


def _qb_load_preset_from_path(path: str) -> Tuple[Optional[dict], Optional[str]]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        return None, str(e)
    if not isinstance(data, dict):
        return None, "File must contain a JSON object."
    ver = data.get("athena_query_builder")
    if ver != QB_PRESET_VERSION:
        return None, "Unknown or missing athena_query_builder version (expected {}).".format(QB_PRESET_VERSION)
    rows = data.get("rows")
    if not isinstance(rows, list) or len(rows) < 1:
        return None, "Preset must include a non-empty \"rows\" array."
    norm_rows: List[dict] = []
    for r in rows:
        if not isinstance(r, dict):
            r = {}
        norm_rows.append(
            {
                "device_id": str(r.get("device_id") or "").strip(),
                "json_key": str(r.get("json_key") or "").strip(),
                "labels": str(r.get("labels") or "").strip(),
            }
        )
    out = {
        "athena_query_builder": QB_PRESET_VERSION,
        "database": str(data.get("database") or "").strip(),
        "start": str(data.get("start") or "").strip(),
        "end": str(data.get("end") or "").strip(),
        "rows": norm_rows,
        "query_sql": str(data.get("query_sql") or ""),
    }
    return out, None


def _qb_refresh_row_key_combos_after_preset(
    window, qb_indices: List[int], keys_by_device: Dict[str, List[str]], values: dict
) -> None:
    """Expand JSON key dropdowns using cached keys_by_device (e.g. after Open)."""
    for row_i in qb_indices:
        dev = (values.get("qb_dev_{}".format(row_i)) or "").strip()
        cur_k = (values.get("qb_key_{}".format(row_i)) or "").strip()
        ks = keys_by_device.get(dev, [])
        disp_k = sorted(set(ks) | ({cur_k} if cur_k else set()) | {""})
        window["qb_key_{}".format(row_i)].update(values=disp_k, value=cur_k)


def sync_qb_database_and_first_device(
    window, databases_list: List[str], device_id_choices: List[str]
) -> None:
    """If Query Builder database is empty, use first list entry; first row device_id = UPPER(database)."""
    cur = (window["qb_database"].get() or "").strip()
    if not cur and databases_list:
        cur = databases_list[0].strip()
        window["qb_database"].update(cur)
    if cur:
        u = cur.upper()
        disp = sorted(set(device_id_choices) | {u})
        window["qb_dev_0"].update(values=disp, value=u)


def apply_query_builder_defaults(
    window, databases_list: List[str], device_id_choices: List[str]
) -> None:
    """Refresh start/end to rolling now window; sync database + first device_id from list when applicable."""
    st, en = _qb_default_time_range()
    window["qb_start"].update(st)
    window["qb_end"].update(en)
    sync_qb_database_and_first_device(window, databases_list, device_id_choices)


def _sql_string_literal(s: str) -> str:
    return "'" + (s or "").replace("'", "''") + "'"


def _quote_athena_ident(ident: str) -> str:
    s = (ident or "").strip()
    return '"' + s.replace('"', '""') + '"'


def _normalize_qb_timestamp(s: str, is_end: bool) -> str:
    """Expand date-only or missing seconds to full TIMESTAMP strings for Athena."""
    raw = (s or "").strip()
    if len(raw) == 10 and raw[4] == "-" and raw[7] == "-":
        try:
            datetime.strptime(raw, "%Y-%m-%d")
            return raw + (" 23:59:59" if is_end else " 00:00:00")
        except ValueError:
            pass
    if len(raw) == 16 and raw[10] == " " and raw[13] == ":":
        try:
            datetime.strptime(raw, "%Y-%m-%d %H:%M")
            return raw + ":00"
        except ValueError:
            pass
    return raw


def _parse_dt_for_range(s: str, is_end: bool) -> datetime:
    """Parse builder date/time after normalization (for partition day list)."""
    t = _normalize_qb_timestamp(s, is_end).strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(t, fmt)
        except ValueError:
            continue
    raise ValueError("Cannot parse date/time: {!r}".format(s))


def _partition_days_half_open(start_dt: datetime, end_dt: datetime) -> List[Tuple[int, int, int]]:
    """Calendar days that intersect [start_dt, end_dt) (end exclusive), for year/month/day filters."""
    if end_dt <= start_dt:
        return [(start_dt.year, start_dt.month, start_dt.day)]
    last_instant = end_dt - timedelta(microseconds=1)
    out: List[Tuple[int, int, int]] = []
    cd = start_dt.date()
    last_d = last_instant.date()
    while cd <= last_d:
        out.append((cd.year, cd.month, cd.day))
        cd += timedelta(days=1)
    return out


def _partition_sql_clause(days: List[Tuple[int, int, int]]) -> str:
    if not days:
        return ""
    parts = ["(year = {} AND month = {} AND day = {})".format(y, m, d) for y, m, d in days]
    if len(parts) == 1:
        return "\n      AND " + parts[0]
    return "\n      AND (\n          " + "\n          OR ".join(parts) + "\n      )"


def _json_path_literal_for_key(json_key: str) -> str:
    """Single-quoted $.path for json_extract_scalar from user key (e.g. kw, solirr1, stats.temp)."""
    k = (json_key or "").strip().lstrip("$").strip()
    if k.startswith("."):
        k = k[1:]
    if not k:
        raise ValueError("empty JSON key")
    return _sql_string_literal("$." + k)


def _sql_alias_from_json_key(json_key: str, used_lower: Set[str]) -> str:
    """Stable SQL identifier for CTE name and column alias (from JSON key path)."""
    base = re.sub(r"[^a-zA-Z0-9_]", "_", json_key.strip()) or "metric"
    if base[0].isdigit():
        base = "c_" + base
    a = base
    n = 2
    while a.lower() in used_lower:
        a = base + "_" + str(n)
        n += 1
    used_lower.add(a.lower())
    return a


def _from_database_device(database: str) -> str:
    """Unquoted schema.table when the database name is a plain identifier (matches working Athena queries)."""
    d = (database or "").strip()
    if re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", d):
        return "{}.{}".format(d, DEVICE_TABLE)
    return "{}.{}".format(_quote_athena_ident(d), DEVICE_TABLE)


_QB_SPIN_HOURS = ["{:02d}".format(i) for i in range(24)]
_QB_SPIN_MINSEC = ["{:02d}".format(i) for i in range(60)]


def _parse_for_dt_picker(raw: str) -> Tuple[str, str, str, str]:
    """Defaults for the date/time popup: (YYYY-MM-DD, hh, mm, ss) as two-digit strings."""
    r = (raw or "").strip()
    now = datetime.now()
    if not r:
        return (
            now.strftime("%Y-%m-%d"),
            "{:02d}".format(now.hour),
            "{:02d}".format(now.minute),
            "{:02d}".format(now.second),
        )
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            dt = datetime.strptime(r, fmt)
            return (
                dt.strftime("%Y-%m-%d"),
                "{:02d}".format(dt.hour),
                "{:02d}".format(dt.minute),
                "{:02d}".format(dt.second),
            )
        except ValueError:
            continue
    if len(r) >= 10:
        try:
            datetime.strptime(r[:10], "%Y-%m-%d")
            return r[:10], "00", "00", "00"
        except ValueError:
            pass
    return (
        now.strftime("%Y-%m-%d"),
        "00",
        "00",
        "00",
    )


def open_qb_datetime_picker(parent_window, current_value: str, target_key: str, title: str) -> None:
    """Modal calendar + time spinners; writes YYYY-MM-DD HH:MM:SS to target_input."""
    date_s, h0, m0, s0 = _parse_for_dt_picker(current_value)
    layout = [
        [
            sg.Text("Date", size=(5, 1)),
            sg.Input(default_text=date_s, key="-dt-date-", size=(12, 1)),
            sg.CalendarButton(
                "📅",
                target="-dt-date-",
                key="-dt-cal-",
                format="%Y-%m-%d",
                border_width=1,
                tooltip="Choose date",
            ),
        ],
        [
            sg.Text("Time", size=(5, 1)),
            sg.Spin(_QB_SPIN_HOURS, initial_value=h0, key="-dt-h-", size=(4, 1)),
            sg.Text(":"),
            sg.Spin(_QB_SPIN_MINSEC, initial_value=m0, key="-dt-m-", size=(4, 1)),
            sg.Text(":"),
            sg.Spin(_QB_SPIN_MINSEC, initial_value=s0, key="-dt-s-", size=(4, 1)),
            sg.Text("24-hour", font=("Segoe UI", 8), text_color="gray", pad=((8, 0), 0)),
        ],
        [
            sg.Push(),
            sg.Button("OK", key="-dt-ok-", bind_return_key=True),
            sg.Button("Cancel", key="-dt-cancel-"),
        ],
    ]
    w = sg.Window(title, layout, modal=True, finalize=True)
    while True:
        ev, vals = w.read()
        if ev in (sg.WIN_CLOSED, "-dt-cancel-"):
            break
        if ev != "-dt-ok-":
            continue
        d = (vals.get("-dt-date-") or "").strip()
        hh = str(vals.get("-dt-h-") or "00").strip()
        mm = str(vals.get("-dt-m-") or "00").strip()
        ss = str(vals.get("-dt-s-") or "00").strip()
        if len(d) != 10:
            sg.popup_error("Enter or pick a date as YYYY-MM-DD.")
            continue
        try:
            datetime.strptime(d, "%Y-%m-%d")
            hi, mi, si = int(hh), int(mm), int(ss)
            if hi < 0 or hi > 23 or mi < 0 or mi > 59 or si < 0 or si > 59:
                raise ValueError("range")
        except ValueError:
            sg.popup_error("Invalid date or time.")
            continue
        out = "{} {:02d}:{:02d}:{:02d}".format(d, int(hh), int(mm), int(ss))
        parent_window[target_key].update(out)
        break
    w.close()


def _qb_cte_name_for_column(col_alias: str, used_cte_lower: Set[str]) -> str:
    """CTE names use a c_ prefix so they never match the metric column (avoids kw.kw / TYPE_MISMATCH on Athena)."""
    base = "c_" + col_alias
    name = base
    n = 2
    while name.lower() in used_cte_lower:
        name = base + "_" + str(n)
        n += 1
    used_cte_lower.add(name.lower())
    return name


def build_timeseries_compare_query(database: str, start_ts: str, end_ts: str, rows: List[Tuple[str, str]]) -> str:
    """
    Build WITH CTEs per (device_id, JSON key): column aliases from the key (kw, solirr1);
    CTE names are c_<alias> so relation kw vs column kw never collide (Trino/Athena ROW errors).
    """
    if not rows:
        raise ValueError("no series rows")
    start_dt = _parse_dt_for_range(start_ts, False)
    end_dt = _parse_dt_for_range(end_ts, True)
    start_lit = _normalize_qb_timestamp(start_ts, False).replace("'", "''")
    end_lit = _normalize_qb_timestamp(end_ts, True).replace("'", "''")
    from_tbl = _from_database_device(database)
    part_clause = _partition_sql_clause(_partition_days_half_open(start_dt, end_dt))

    used_col: Set[str] = set()
    used_cte: Set[str] = set()
    specs: List[dict] = []
    for idx, (device_id, json_key) in enumerate(rows):
        col_alias = _sql_alias_from_json_key(json_key, used_col)
        cte_name = _qb_cte_name_for_column(col_alias, used_cte)
        path_lit = _json_path_literal_for_key(json_key)
        specs.append(
            {
                "i": idx,
                "cte": cte_name,
                "col": col_alias,
                "json_key": json_key,
                "path_lit": path_lit,
                "dev_lit": _sql_string_literal(device_id.strip()),
            }
        )

    cte_parts = []
    for sp in specs:
        cte = """{cte} AS (
    SELECT
        date_trunc('minute', from_iso8601_timestamp({dcol})) AS ts,
        AVG(TRY_CAST(json_extract_scalar({dc}, {jp}) AS DOUBLE)) AS {col}
    FROM {from_tbl}
    WHERE device_id = {dv}{part}
      AND from_iso8601_timestamp({dcol}) >= TIMESTAMP '{t0}'
      AND from_iso8601_timestamp({dcol}) < TIMESTAMP '{t1}'
    GROUP BY 1
)""".format(
            cte=sp["cte"],
            col=sp["col"],
            dcol=DATE_COL,
            dc=DATA_COL,
            jp=sp["path_lit"],
            from_tbl=from_tbl,
            dv=sp["dev_lit"],
            part=part_clause,
            t0=start_lit,
            t1=end_lit,
        )
        cte_parts.append(cte)

    primary = specs[0]["cte"]
    sel_cols = ["    {}.ts".format(primary)]
    for sp in specs:
        sel_cols.append("    {cte}.{col}".format(cte=sp["cte"], col=sp["col"]))
    select_list = "SELECT\n" + ",\n".join(sel_cols)

    from_join = "FROM {}\n".format(primary)
    for sp in specs[1:]:
        from_join += "LEFT JOIN {j}\n    ON {p}.ts = {j}.ts\n".format(j=sp["cte"], p=primary)
    from_join += "ORDER BY {}.ts;".format(primary)

    return "WITH\n" + ",\n".join(cte_parts) + "\n" + select_list + "\n" + from_join


def build_device_json_keys_query(database: str, device_id: str, start_ts: str) -> str:
    """DISTINCT top-level keys from data JSON for one device; partitions use calendar day of Start."""
    from_tbl = _from_database_device(database)
    dev_lit = _sql_string_literal(device_id.strip())
    start_dt = _parse_dt_for_range(start_ts, False)
    y, m, d = start_dt.year, start_dt.month, start_dt.day
    return (
        "SELECT DISTINCT key\n"
        "FROM {tbl}\n"
        "CROSS JOIN UNNEST(\n"
        "    map_keys(\n"
        "        CAST(json_parse({dc}) AS MAP(VARCHAR, JSON))\n"
        "    )\n"
        ") AS t(key)\n"
        "WHERE device_id = {dv}\n"
        "  AND year = {y}\n"
        "  AND month = {m}\n"
        "  AND day = {d}\n"
        "ORDER BY key;"
    ).format(tbl=from_tbl, dc=DATA_COL, dv=dev_lit, y=y, m=m, d=d)


def build_list_device_ids_query(database: str, start_ts: str) -> str:
    """DISTINCT device_id from JSON in data; partitions use calendar day of Start."""
    from_tbl = _from_database_device(database)
    start_dt = _parse_dt_for_range(start_ts, False)
    y, m, d = start_dt.year, start_dt.month, start_dt.day
    return (
        "SELECT DISTINCT json_extract_scalar({dc}, '$.device_id') AS device_id\n"
        "FROM {tbl}\n"
        "WHERE year = {y}\n"
        "  AND month = {m}\n"
        "  AND day = {d}\n"
        "ORDER BY device_id;"
    ).format(tbl=from_tbl, dc=DATA_COL, y=y, m=m, d=d)


def _qb_parse_single_column_rows(rows: List[List[str]], header: str) -> List[str]:
    """First column strings; skip a leading header row if it matches (case-insensitive)."""
    if not rows:
        return []
    h = header.strip().lower()
    start = 0
    if rows[0] and str(rows[0][0] or "").strip().lower() == h:
        start = 1
    out: List[str] = []
    for r in rows[start:]:
        if not r:
            continue
        cell = str(r[0] or "").strip()
        if cell:
            out.append(cell)
    return sorted(set(out))


def _qb_device_id_literal_from_keys_query(q: str) -> Optional[str]:
    """Extract device_id string literal from WHERE device_id = '…' in a keys-style query."""
    m = re.search(r"device_id\s*=\s*'((?:[^']|'')*)'", q, re.IGNORECASE | re.DOTALL)
    if not m:
        return None
    return m.group(1).replace("''", "'")


def _qb_refresh_combos_after_run(
    window,
    q: str,
    rows: List[List[str]],
    values: dict,
    qb_indices: List[int],
    device_id_choices: List[str],
    keys_by_device: Dict[str, List[str]],
) -> None:
    """If Run query executed a builder-style SQL, refresh device / JSON key dropdowns from results."""
    ql = (q or "").lower()
    if not rows:
        return
    if "distinct" in ql and "'$.device_id'" in ql.replace(" ", "") and "json_extract_scalar" in ql:
        device_id_choices[:] = _qb_parse_single_column_rows(rows, "device_id")
        for ri in qb_indices:
            cur = (values.get("qb_dev_{}".format(ri)) or "").strip()
            disp = sorted(set(device_id_choices) | ({cur} if cur else set()))
            window["qb_dev_{}".format(ri)].update(values=disp, value=cur)
        return
    if "map_keys" in ql and "json_parse" in ql and "distinct" in ql:
        dev = _qb_device_id_literal_from_keys_query(q)
        if not dev:
            return
        found = _qb_parse_single_column_rows(rows, "key")
        prev = keys_by_device.get(dev, [])
        merged = sorted(set(prev) | set(found))
        keys_by_device[dev] = merged
        for ri in qb_indices:
            if (values.get("qb_dev_{}".format(ri)) or "").strip() != dev:
                continue
            cur_k = (values.get("qb_key_{}".format(ri)) or "").strip()
            disp_k = sorted(set(merged) | ({cur_k} if cur_k else set()) | {""})
            window["qb_key_{}".format(ri)].update(values=disp_k, value=cur_k)


def _qb_resolve_row_json_keys(
    labels_raw: str,
    json_key_fallback: str,
    dev: str,
    keys_by_device: Dict[str, List[str]],
    row_display_num: int,
) -> Tuple[Optional[str], List[str]]:
    """
    Labels override JSON key when non-empty: comma-separated keys, or * = all keys for device
    from keys_by_device (populated after a successful Keys query).
    """
    labels = (labels_raw or "").strip()
    if labels:
        if labels == "*":
            ks = keys_by_device.get(dev, [])
            if not ks:
                return (
                    "Row {}: use * only after keys are loaded — click Keys on this row and Run query on the Query tab.".format(
                        row_display_num
                    ),
                    [],
                )
            return (None, list(ks))
        parts = [p.strip() for p in labels.split(",")]
        keys = [p for p in parts if p]
        if not keys:
            return ("Row {}: labels are empty after splitting on commas.".format(row_display_num), [])
        return (None, keys)
    jkey = (json_key_fallback or "").strip()
    if not jkey:
        return (None, [])
    return (None, [jkey])


def main():
    sg.theme("Default1")
    config_tab = [
        [sg.Text("Databases list", font=("Segoe UI", 10, "bold"))],
        [
            sg.Button("Load databases from Athena", key="load_databases"),
            sg.Button("Import list", key="import_list"),
            sg.Button("Export list", key="export_list"),
        ],
        [sg.Text("Database:", size=(8, 1)), sg.Combo([], key="databases_dropdown", size=(30, 1), readonly=True)],
        [sg.Text("(Selected database is used by Run query unless the SQL names another.)", font=("Segoe UI", 8), text_color="gray")],
        [sg.Multiline(size=(80, 12), key="config_output", font=("Consolas", 10), disabled=True, expand_x=True, expand_y=True)],
    ]
    query_tab = [
        [sg.Text("Query", font=("Segoe UI", 10, "bold"))],
        [sg.Multiline(size=(80, 8), key="query", font=("Consolas", 10), expand_x=True, expand_y=False)],
        [sg.Button("Run query", key="run_query")],
        [sg.Text("Output", font=("Segoe UI", 10, "bold"))],
        [sg.Multiline(size=(80, 14), key="output", font=("Consolas", 10), disabled=True, expand_x=True, expand_y=True, autoscroll=True)],
        [sg.Button("Export results to CSV", key="export_csv")],
    ]
    _dt_in = dict(
        size=(20, 1),
        tooltip="YYYY-MM-DD HH:MM:SS (🕒 to pick). End is exclusive (<), e.g. 19:00 ends the 18:xx hour.",
    )

    databases_list: List[str] = []
    last_query_rows: List[List[str]] = []
    device_id_choices: List[str] = []
    keys_by_device: Dict[str, List[str]] = {}
    qb_preset_reload: Optional[dict] = None
    startup_db_file_loaded = False

    while True:
        use_preset = qb_preset_reload
        qb_preset_reload = None
        if use_preset:
            qb_row_dicts: List[dict] = use_preset["rows"]
            st_def, en_def = _qb_default_time_range()
            _qb_st0 = (use_preset.get("start") or "").strip() or st_def
            _qb_en0 = (use_preset.get("end") or "").strip() or en_def
            _qb_db0 = (use_preset.get("database") or "").strip()
            _query_sql0 = use_preset.get("query_sql") or ""
        else:
            qb_row_dicts = [{}]
            _qb_st0, _qb_en0 = _qb_default_time_range()
            _qb_db0 = ""
            _query_sql0 = ""

        qb_pairs_inner = _qb_build_pairs_inner_from_preset_rows(qb_row_dicts, device_id_choices)

        query_builder_tab = [
            [sg.Text("Query Builder", font=("Segoe UI", 10, "bold"))],
            [sg.HorizontalSeparator(pad=(0, (4, 8)))],
            [
                sg.Text("Database", size=(11, 1), justification="right"),
                sg.Input(
                    key="qb_database",
                    default_text=_qb_db0,
                    size=(32, 1),
                    expand_x=True,
                    pad=((6, 8), 0),
                ),
                sg.Button("Use Config", key="qb_use_config_db", tooltip="Fill from Config tab database dropdown"),
            ],
            [
                sg.Text("Start", size=(11, 1), justification="right"),
                sg.Input(
                    key="qb_start",
                    default_text=_qb_st0,
                    pad=((6, 4), 0),
                    expand_x=True,
                    **_dt_in,
                ),
                sg.Button("🕒", key="qb_pick_start", tooltip="Pick date and time"),
            ],
            [
                sg.Text("End", size=(11, 1), justification="right"),
                sg.Input(key="qb_end", default_text=_qb_en0, pad=((6, 4), 0), expand_x=True, **_dt_in),
                sg.Button("🕒", key="qb_pick_end", tooltip="Pick date and time"),
            ],
            [
                sg.Text(
                    "Builds WITH c_<key> AS (…) per row (CTE prefix avoids name clash with metric column; "
                    "SELECT uses c_solirr1.solirr1, c_kw.kw). Minute buckets, "
                    "AVG(TRY_CAST(json_extract_scalar({c}, '$.key') AS DOUBLE)), year/month/day partitions, "
                    "and from_iso8601_timestamp({d}) >= start AND < end (end exclusive). "
                    "Plain database names use schema.table without quotes. "
                    "List device IDs / Keys only place SQL on the Query tab; use Run query there to execute. "
                    "After a successful run, matching results refresh the device_id / JSON key dropdowns. "
                    "Labels: comma-separated keys, or * for all keys loaded for that device (Keys + Run first). "
                    "+ Row copies device_id from the row above. "
                    "Save/Open preset writes JSON under the queries folder next to this script."
                    .format(d=DATE_COL, c=DATA_COL),
                    font=("Segoe UI", 8),
                    text_color="gray",
                    expand_x=True,
                )
            ],
        [
            sg.Button(
                "List device IDs",
                key="qb_list_devices",
                tooltip="Build SQL on Query tab; Run query there — results then refresh device_id dropdowns",
            ),
        ],
        [
            sg.Frame(
                "device_id and JSON field",
                [
                    [
                        sg.Text("#", size=(3, 1)),
                        sg.Text("device_id", size=(24, 1), pad=((4, 0), 0)),
                        sg.Text("JSON key", size=(14, 1), pad=((4, 0), 0)),
                        sg.Text("labels", size=(8, 1), pad=((4, 0), 0)),
                        sg.Push(),
                        sg.Button("+ Row", key="qb_add_row", tooltip="Add another series"),
                    ],
                    [
                        sg.Column(
                            qb_pairs_inner,
                            key="qb_pairs_col",
                            scrollable=True,
                            vertical_scroll_only=True,
                            size=(800, 200),
                            expand_x=True,
                            pad=(0, (4, 0)),
                        )
                    ],
                ],
                pad=(0, (0, 4)),
                expand_x=True,
            )
        ],
        [
            sg.Button("Build query", key="qb_build", pad=((0, 0), (8, 0))),
            sg.Button(
                "Save preset…",
                key="qb_save_preset",
                tooltip="Save Query Builder fields and Query tab SQL to {}".format(QUERIES_DIR),
            ),
            sg.Button(
                "Open preset…",
                key="qb_open_preset",
                tooltip="Load a JSON preset (reopens this window with the saved rows)",
            ),
        ],
        ]
        layout = [
            [
                sg.TabGroup(
                    [
                        [
                            sg.Tab("Config", config_tab),
                            sg.Tab("Query Builder", query_builder_tab),
                            sg.Tab("Query", query_tab),
                        ]
                    ]
                )
            ],
            [sg.Button("Exit", key="exit")],
        ]
        window = sg.Window("Athena", layout, resizable=True, finalize=True)
        window.set_min_size((600, 500))

        qb_indices = list(range(len(qb_row_dicts)))
        qb_next_idx = len(qb_indices)

        if not startup_db_file_loaded:
            startup_db_file_loaded = True
            if DATABASES_LIST_PATH:
                databases_list = load_databases_from_file(DATABASES_LIST_PATH)
                if databases_list:
                    apply_db_list(window, databases_list)
                    print("Loaded {} database(s) from startup file.".format(len(databases_list)))
                else:
                    print(
                        "no startup db list found\n  Tried: {}\n  Exists: {}".format(
                            DATABASES_LIST_PATH, os.path.isfile(DATABASES_LIST_PATH)
                        )
                    )
            else:
                print("No DATABASES_LIST_PATH in .env.local")

        if use_preset:
            window["qb_database"].update(_qb_db0)
            window["qb_start"].update(_qb_st0)
            window["qb_end"].update(_qb_en0)
            window["query"].update(_query_sql0)
            vals_syn: dict = {}
            for ri in qb_indices:
                row_d = qb_row_dicts[ri] if ri < len(qb_row_dicts) else {}
                dev = (row_d.get("device_id") or "").strip()
                disp = sorted(set(device_id_choices) | ({dev} if dev else set()))
                window["qb_dev_{}".format(ri)].update(values=disp, value=dev)
                vals_syn["qb_dev_{}".format(ri)] = dev
                vals_syn["qb_key_{}".format(ri)] = (row_d.get("json_key") or "").strip()
            _qb_refresh_row_key_combos_after_preset(window, qb_indices, keys_by_device, vals_syn)
        else:
            apply_query_builder_defaults(window, databases_list, device_id_choices)

        while True:
            event, values = window.read()
            if event in (sg.WIN_CLOSED, "exit"):
                window.close()
                return

            elif event == "load_databases":
                window["config_output"].update("Loading…")
                window.refresh()
                rows, msg = run_athena_query("SHOW DATABASES;")
                if rows:
                    databases_list = [r[0] for r in (rows[1:] if len(rows) > 1 else rows)]
                    apply_db_list(window, databases_list)
                    sync_qb_database_and_first_device(window, databases_list, device_id_choices)
                    sg.popup_quick_message("{} ({} db(s))".format(msg, len(rows)), background_color="green")
                else:
                    window["config_output"].update(msg)
                    sg.popup_quick_message(msg, background_color="red")
    
            elif event == "import_list":
                path = DATABASES_LIST_PATH if (DATABASES_LIST_PATH and os.path.isfile(DATABASES_LIST_PATH)) else None
                if not path:
                    path = sg.popup_get_file("Import list", file_types=(("JSON", "*.json"), ("Text", "*.txt"), ("All", "*")))
                if path:
                    databases_list = load_databases_from_file(path)
                    if databases_list:
                        apply_db_list(window, databases_list)
                        sync_qb_database_and_first_device(window, databases_list, device_id_choices)
                        sg.popup_quick_message("Imported {} item(s).".format(len(databases_list)), background_color="green")
                    else:
                        sg.popup("Import failed", "Could not read or parse file.")
    
            elif event == "qb_use_config_db":
                db = (values.get("databases_dropdown") or "").strip()
                if not db:
                    sg.popup("No database on Config tab.", "Load databases and pick one in the dropdown, or type a database name manually.")
                    continue
                window["qb_database"].update(db)
                disp = sorted(set(device_id_choices) | {db.upper()})
                window["qb_dev_0"].update(values=disp, value=db.upper())
    
            elif event == "qb_pick_start":
                open_qb_datetime_picker(window, values.get("qb_start") or "", "qb_start", "Start — date and time")
    
            elif event == "qb_pick_end":
                open_qb_datetime_picker(window, values.get("qb_end") or "", "qb_end", "End — date and time")
    
            elif event == "qb_add_row":
                prev_i = qb_indices[-1] if qb_indices else None
                prev_dev = (values.get("qb_dev_{}".format(prev_i)) or "").strip() if prev_i is not None else ""
                i = qb_next_idx
                qb_next_idx += 1
                qb_indices.append(i)
                window.extend_layout(window["qb_pairs_col"], [_qb_pair_row(i, list(device_id_choices))])
                if prev_dev:
                    disp = sorted(set(device_id_choices) | {prev_dev})
                    window["qb_dev_{}".format(i)].update(values=disp, value=prev_dev)
                    ks = keys_by_device.get(prev_dev, [])
                    cur_k = (values.get("qb_key_{}".format(i)) or "").strip()
                    disp_k = sorted(set(ks) | ({cur_k} if cur_k else set()) | {""})
                    window["qb_key_{}".format(i)].update(values=disp_k, value=cur_k)
    
            elif event == "qb_list_devices":
                db = (values.get("qb_database") or "").strip()
                start_ts = (values.get("qb_start") or "").strip()
                if not db:
                    sg.popup("Database required.", "Enter the database (or Use Config).")
                    continue
                if not start_ts:
                    sg.popup("Start required.", "Start date/time sets the partition day for the device list query.")
                    continue
                try:
                    q = build_list_device_ids_query(db, start_ts)
                except ValueError as ex:
                    sg.popup("Cannot build device list query", str(ex))
                    continue
                window["query"].update(q)
                sg.popup_quick_message("Device list query on Query tab — Run query to execute.", background_color="green")
    
            elif isinstance(event, str) and event.startswith("qb_dev_"):
                try:
                    row_i = int(event.rsplit("_", 1)[-1])
                except ValueError:
                    continue
                if row_i not in qb_indices:
                    continue
                dev = (values.get("qb_dev_{}".format(row_i)) or "").strip()
                cur_k = (values.get("qb_key_{}".format(row_i)) or "").strip()
                ks = keys_by_device.get(dev, [])
                disp_k = sorted(set(ks) | ({cur_k} if cur_k else set()) | {""})
                window["qb_key_{}".format(row_i)].update(values=disp_k, value=cur_k)
    
            elif isinstance(event, str) and event.startswith("qb_keys_"):
                try:
                    row_i = int(event.rsplit("_", 1)[-1])
                except ValueError:
                    continue
                if row_i not in qb_indices:
                    continue
                db = (values.get("qb_database") or "").strip()
                start_ts = (values.get("qb_start") or "").strip()
                dev = (values.get("qb_dev_{}".format(row_i)) or "").strip()
                if not db:
                    sg.popup("Database required.", "Enter the database (or Use Config).")
                    continue
                if not dev:
                    sg.popup("device_id required.", "Enter device_id on this row before listing keys.")
                    continue
                if not start_ts:
                    sg.popup("Start required.", "Start date/time sets the partition day (year / month / day) for the keys query.")
                    continue
                try:
                    q = build_device_json_keys_query(db, dev, start_ts)
                except ValueError as ex:
                    sg.popup("Cannot build keys query", str(ex))
                    continue
                window["query"].update(q)
                sg.popup_quick_message("Keys query on Query tab — Run query to execute.", background_color="green")

            elif event == "qb_save_preset":
                err_mk = _ensure_queries_dir()
                if err_mk:
                    sg.popup("Cannot create queries folder", err_mk)
                    continue
                path = sg.popup_get_file(
                    "Save query builder preset",
                    save_as=True,
                    default_path=os.path.join(QUERIES_DIR, "preset.json"),
                    initial_folder=QUERIES_DIR,
                    file_types=(("JSON preset", "*.json"), ("All", "*.*")),
                )
                if path:
                    p = path if path.lower().endswith(".json") else path + ".json"
                    try:
                        preset = _qb_preset_from_values(values, qb_indices)
                        with open(p, "w", encoding="utf-8") as wf:
                            json.dump(preset, wf, indent=2)
                        sg.popup_quick_message("Saved preset.", background_color="green")
                    except OSError as e:
                        sg.popup("Save failed", str(e))

            elif event == "qb_open_preset":
                err_mk = _ensure_queries_dir()
                if err_mk:
                    sg.popup("Cannot create queries folder", err_mk)
                    continue
                path = sg.popup_get_file(
                    "Open query builder preset",
                    default_path=os.path.join(QUERIES_DIR, "preset.json"),
                    initial_folder=QUERIES_DIR,
                    file_types=(("JSON preset", "*.json"), ("All", "*.*")),
                )
                if path:
                    loaded, err = _qb_load_preset_from_path(path)
                    if err:
                        sg.popup("Open failed", err)
                    else:
                        qb_preset_reload = loaded
                        window.close()
                        break

            elif event == "qb_build":
                db = (values.get("qb_database") or "").strip()
                start_ts = (values.get("qb_start") or "").strip()
                end_ts = (values.get("qb_end") or "").strip()
                if not db:
                    sg.popup("Database required.", "Enter the Athena database (schema) name.")
                    continue
                if not start_ts or not end_ts:
                    sg.popup("Date/time required.", "Pick or enter start and end for {} (YYYY-MM-DD HH:MM:SS).".format(DATE_COL))
                    continue
                pairs: List[Tuple[str, str]] = []
                qb_pair_error = None
                key_re = re.compile(r"^[a-zA-Z0-9_.]+$")
                for i in qb_indices:
                    dev = (values.get("qb_dev_{}".format(i)) or "").strip()
                    jkey = (values.get("qb_key_{}".format(i)) or "").strip()
                    labels_raw = (values.get("qb_labels_{}".format(i)) or "").strip()
                    err, key_list = _qb_resolve_row_json_keys(
                        labels_raw, jkey, dev, keys_by_device, i + 1
                    )
                    if err:
                        qb_pair_error = err
                        break
                    if not dev and not key_list:
                        continue
                    if key_list and not dev:
                        qb_pair_error = "Row {}: enter device_id for each JSON key / labels.".format(i + 1)
                        break
                    if dev and not key_list:
                        qb_pair_error = (
                            "Row {}: enter a JSON key or labels (comma-separated or * after loading keys).".format(i + 1)
                        )
                        break
                    for k in key_list:
                        if not key_re.match(k):
                            qb_pair_error = "Row {}: key {!r} may only use letters, digits, underscore, and dot.".format(
                                i + 1, k
                            )
                            break
                    if qb_pair_error:
                        break
                    for k in key_list:
                        pairs.append((dev, k))
                if qb_pair_error:
                    sg.popup("Check rows", qb_pair_error)
                    continue
                if not pairs:
                    sg.popup("No rows to query.", "Enter at least one device_id and JSON key, or add a row.")
                    continue
                try:
                    q = build_timeseries_compare_query(db, start_ts, end_ts, pairs)
                except ValueError as ex:
                    sg.popup("Cannot build query", str(ex))
                    continue
                window["query"].update(q)
                sg.popup_quick_message("Query placed on Query tab.", background_color="green")
    
            elif event == "export_list":
                if not databases_list:
                    sg.popup("No list to export.", "Load or import a list first.")
                    continue
                path = sg.popup_get_file("Export list", save_as=True, default_path="databases_list.json", file_types=(("JSON", "*.json"), ("Text", "*.txt"), ("All", "*")))
                if path:
                    err = save_list_to_file(path, databases_list)
                    sg.popup("Export failed", err) if err else sg.popup("Exported.", "Saved {} item(s).".format(len(databases_list)))
    
            elif event == "run_query":
                q = (values.get("query") or "").strip()
                if not q:
                    sg.popup("Enter a query first.")
                    continue
                window["output"].update("Running…")
                window.refresh()
                rows, msg = run_athena_query(q)
                last_query_rows = rows
                window["output"].update(rows_to_text(rows) if rows else msg)
                if rows:
                    _qb_refresh_combos_after_run(
                        window, q, rows, values, qb_indices, device_id_choices, keys_by_device
                    )
                sg.popup_quick_message("{} ({} row(s))".format(msg, len(rows)) if rows else msg, background_color="green" if rows else "red")
    
            elif event == "export_csv":
                if not last_query_rows:
                    sg.popup("No results to export.", "Run a query first.")
                    continue
                path = sg.popup_get_file("Export results to CSV", save_as=True, default_path="query_results.csv", file_types=(("CSV", "*.csv"), ("All", "*")))
                if path:
                    path = path if path.endswith(".csv") else path + ".csv"
                    try:
                        with open(path, "w", newline="", encoding="utf-8") as f:
                            csv.writer(f).writerows(last_query_rows)
                        sg.popup("Exported.", "Saved to\n{}".format(path))
                    except Exception as e:
                        sg.popup("Export failed", str(e))

        continue


if __name__ == "__main__":
    main()
