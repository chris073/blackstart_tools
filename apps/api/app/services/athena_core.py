import os
import re
import time
from datetime import datetime, timedelta
from typing import List, Set, Tuple

import boto3

REGION = os.getenv("REGION", "us-west-2")
WORKGROUP = os.getenv("WORKGROUP", "engineering")

DEVICE_TABLE = "device"
DATE_COL = "date_rec"
DATA_COL = "data"


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


def list_databases() -> Tuple[List[str], str]:
    rows, msg = run_athena_query("SHOW DATABASES;")
    if not rows:
        return [], msg
    # Athena returns a header row.
    vals = [r[0] for r in (rows[1:] if len(rows) > 1 else rows) if r]
    return sorted(set([v for v in vals if v])), msg


def _sql_string_literal(s: str) -> str:
    return "'" + (s or "").replace("'", "''") + "'"


def _quote_athena_ident(ident: str) -> str:
    s = (ident or "").strip()
    return '"' + s.replace('"', '""') + '"'


def _from_database_device(database: str) -> str:
    d = (database or "").strip()
    if re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", d):
        return "{}.{}".format(d, DEVICE_TABLE)
    return "{}.{}".format(_quote_athena_ident(d), DEVICE_TABLE)


def _normalize_qb_timestamp(s: str, is_end: bool) -> str:
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
    t = _normalize_qb_timestamp(s, is_end).strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(t, fmt)
        except ValueError:
            continue
    raise ValueError("Cannot parse date/time: {!r}".format(s))


def _partition_days_half_open(start_dt: datetime, end_dt: datetime) -> List[Tuple[int, int, int]]:
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
    k = (json_key or "").strip().lstrip("$").strip()
    if k.startswith("."):
        k = k[1:]
    if not k:
        raise ValueError("empty JSON key")
    return _sql_string_literal("$." + k)


def _sql_alias_from_json_key(json_key: str, used_lower: Set[str]) -> str:
    base = re.sub(r"[^a-zA-Z0-9_]", "_", (json_key or "").strip()) or "metric"
    if base[0].isdigit():
        base = "c_" + base
    a = base
    n = 2
    while a.lower() in used_lower:
        a = base + "_" + str(n)
        n += 1
    used_lower.add(a.lower())
    return a


def _qb_cte_name_for_column(col_alias: str, used_cte_lower: Set[str]) -> str:
    base = "c_" + col_alias
    name = base
    n = 2
    while name.lower() in used_cte_lower:
        name = base + "_" + str(n)
        n += 1
    used_cte_lower.add(name.lower())
    return name


def build_timeseries_compare_query(database: str, start_ts: str, end_ts: str, rows: List[Tuple[str, str]]) -> str:
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


def build_list_device_ids_query(database: str, start_ts: str) -> str:
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


def build_device_json_keys_query(database: str, device_id: str, start_ts: str) -> str:
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

