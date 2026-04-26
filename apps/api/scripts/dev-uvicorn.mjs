/** Start uvicorn from apps/api. Port: API_PORT / PORT, env files, NEXT_PUBLIC_API_BASE_URL port in apps/web/.env.local, else 8010. */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(root, "..", "..");
const noReload = process.argv.includes("--no-reload");

/** @param {string} p */
function parseEnvFile(p) {
  /** @type {Record<string, string>} */
  const out = {};
  if (!existsSync(p)) return out;
  try {
    const text = readFileSync(p, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const s = line.trim();
      if (!s || s.startsWith("#")) continue;
      const eq = s.indexOf("=");
      if (eq === -1) continue;
      const key = s.slice(0, eq).trim();
      let val = s.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      out[key] = val;
    }
  } catch {
    /* ignore */
  }
  return out;
}

function mergedLauncherEnv() {
  const paths = [
    join(repoRoot, ".env"),
    join(repoRoot, ".env.local"),
    join(root, ".env"),
    join(root, ".env.local"),
  ];
  /** @type {Record<string, string>} */
  const merged = {};
  for (const p of paths) {
    const chunk = parseEnvFile(p);
    if (chunk.API_PORT) merged.API_PORT = chunk.API_PORT;
    if (chunk.UVICORN_HOST) merged.UVICORN_HOST = chunk.UVICORN_HOST;
  }
  return merged;
}

function portFromWebPublicUrl() {
  const p = join(repoRoot, "apps", "web", ".env.local");
  const chunk = parseEnvFile(p);
  const raw = chunk.NEXT_PUBLIC_API_BASE_URL;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.port) return u.port;
  } catch {
    /* ignore */
  }
  return null;
}

const fileEnv = mergedLauncherEnv();
const defaultPort = "8010";
const port = (
  process.env.API_PORT ||
  process.env.PORT ||
  fileEnv.API_PORT ||
  portFromWebPublicUrl() ||
  defaultPort
).trim();

const listenHost = (
  process.env.UVICORN_HOST ||
  fileEnv.UVICORN_HOST ||
  (noReload ? "0.0.0.0" : "127.0.0.1")
).trim();

const uvicornArgs = noReload
  ? ["-m", "uvicorn", "app.main:app", "--host", listenHost, "--port", port]
  : [
      "-m",
      "uvicorn",
      "app.main:app",
      "--reload",
      "--reload-dir",
      "app",
      "--reload-dir",
      "athena",
      "--host",
      listenHost,
      "--port",
      port,
    ];

/** @type {readonly [string, string[]][]} */
const attempts =
  process.platform === "win32"
    ? [
        ["py", ["-3", ...uvicornArgs]],
        ["python3", uvicornArgs],
        ["python", uvicornArgs],
      ]
    : [
        ["python3", uvicornArgs],
        ["python", uvicornArgs],
      ];

function run(i) {
  if (i >= attempts.length) {
    console.error(
      "Could not start uvicorn.\n" +
        "  Install Python 3, then from apps/api run:\n" +
        "    py -3 -m pip install -r requirements.txt   (Windows)\n" +
        "    python3 -m pip install -r requirements.txt (macOS/Linux)\n" +
        "  Then from repo root: npm run dev",
    );
    process.exit(1);
  }

  const [cmd, args] = attempts[i];
  const useShell = process.platform === "win32";

  const child = spawn(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: useShell,
    env: process.env,
  });

  child.on("error", (err) => {
    console.warn(`[api] ${cmd} failed: ${err.message}`);
    run(i + 1);
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.exit(1);
    }
    process.exit(code == null ? 1 : code);
  });
}

run(0);
