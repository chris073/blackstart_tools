"""Resolve Athena paths and load databases list from JSON/text (legacy athena_test.py behavior)."""
import json
import os
from typing import List, Optional, Tuple

from dotenv import load_dotenv

# apps/api/app/services -> repo root is four levels up
def _repo_root() -> str:
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.abspath(os.path.join(here, "..", "..", "..", ".."))


def athena_tool_dir() -> str:
    """Legacy FreeSimpleGUI tool directory."""
    return os.path.join(_repo_root(), "packages", "python-tools", "athena")


def api_athena_config_dir() -> str:
    """Config bundled with the FastAPI app (preferred)."""
    return os.path.join(_repo_root(), "apps", "api", "athena")


# Directory of the .env.local file that was actually loaded (for relative DATABASES_LIST_PATH)
_LOADED_ENV_DIR: Optional[str] = None


def _candidate_env_files() -> List[str]:
    return [
        os.path.join(api_athena_config_dir(), ".env.local"),
        os.path.join(athena_tool_dir(), ".env.local"),
    ]


def load_athena_env() -> None:
    """
    Load the first existing .env.local in order:
    1) apps/api/athena/.env.local (copied / maintained for the web API)
    2) packages/python-tools/athena/.env.local (legacy GUI)
    """
    global _LOADED_ENV_DIR
    _LOADED_ENV_DIR = None
    for path in _candidate_env_files():
        if os.path.isfile(path):
            load_dotenv(path, override=True)
            _LOADED_ENV_DIR = os.path.dirname(os.path.abspath(path))
            return


def _env_value_from_file(env_file: str, key: str) -> str:
    """
    Read key=value from .env.local the same way as legacy athena_test._env_path.
    Avoids python-dotenv mangling paths that contain apostrophes (e.g. Athena_DB's.json).
    """
    if not os.path.isfile(env_file):
        return ""
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
    except OSError:
        return ""
    return ""


def _resolve_path(raw: str) -> str:
    if not raw:
        return ""
    p = os.path.normpath(os.path.expanduser(raw))
    if os.path.isabs(p):
        return p
    base = _LOADED_ENV_DIR or athena_tool_dir()
    return os.path.join(base, p)


def databases_list_path() -> str:
    load_athena_env()
    raw = ""
    for env_path in _candidate_env_files():
        if os.path.isfile(env_path):
            raw = _env_value_from_file(env_path, "DATABASES_LIST_PATH")
            if raw:
                break
    if not raw:
        raw = (os.getenv("DATABASES_LIST_PATH") or "").strip()
    if (raw.startswith('"') and raw.endswith('"')) or (raw.startswith("'") and raw.endswith("'")):
        raw = raw[1:-1].strip()
    return _resolve_path(raw)


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


def load_database_names_for_dropdown() -> Tuple[List[str], str, str]:
    """
    Returns (names, message, resolved_path_or_empty).
    Mirrors DATABASES_LIST_PATH from .env.local (same as legacy athena_test.py).
    """
    path = databases_list_path()
    if not path:
        return (
            [],
            "No DATABASES_LIST_PATH in .env.local (apps/api/athena or packages/python-tools/athena).",
            "",
        )
    if not os.path.isfile(path):
        return [], "DATABASES_LIST_PATH does not exist:\n{}".format(path), path
    names = load_databases_from_file(path)
    if not names:
        return [], "No databases read from file (empty or unreadable):\n{}".format(path), path
    return sorted(set(names)), "Loaded {} database(s) from file.".format(len(names)), path
