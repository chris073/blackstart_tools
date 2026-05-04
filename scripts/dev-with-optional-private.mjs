/**
 * `npm run dev` from repo root:
 * 1) Resolve optional `private_tools` checkout (env, submodule, or sibling).
 * 2) Copy `private_tools/apps/web/public` → `apps/web/public/private-tools-sync` for shared logos/assets.
 * 3) Set `NEXT_PUBLIC_PRIVATE_TOOLS_PUBLIC_BASE` for the Next dev server when sync ran.
 * 4) Start api + web; optionally start `npm run dev` in `private_tools` (web + private API).
 *
 * Configure with `BLACKSTART_PRIVATE_TOOLS_DIR` in repo-root or `apps/web` **`.env.local`** (see README, `docs/ENV.local.example.md`).
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const webRoot = path.join(repoRoot, "apps", "web");
const webPublic = path.join(webRoot, "public");
const syncDest = path.join(webPublic, "private-tools-sync");

function parseEnvFile(filePath) {
  /** @type {Record<string, string>} */
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

/** Launcher reads only gitignored `.env.local` files (not `.env`) so paths stay private and examples stay tracked. */
function loadMergedEnv() {
  const paths = [
    path.join(repoRoot, ".env.local"),
    path.join(webRoot, ".env.local"),
  ];
  /** @type {Record<string, string>} */
  const merged = { ...process.env };
  for (const p of paths) {
    Object.assign(merged, parseEnvFile(p));
  }
  return merged;
}

function isTruthyFlag(raw) {
  if (raw === undefined) return true;
  const s = String(raw).trim().toLowerCase();
  if (s === "") return true;
  return !["0", "false", "no", "off"].includes(s);
}

function hasPrivatePackage(root) {
  return fs.existsSync(path.join(root, "package.json"));
}

function resolvePrivateToolsRoot(merged) {
  const explicit = merged.BLACKSTART_PRIVATE_TOOLS_DIR?.trim();
  if (explicit) {
    const abs = path.resolve(explicit.replace(/^["']|["']$/g, ""));
    if (hasPrivatePackage(abs)) return abs;
    console.warn(`[dev] BLACKSTART_PRIVATE_TOOLS_DIR set but no package.json: ${abs}`);
    return null;
  }

  const submodule = path.join(repoRoot, "private", "private-tools");
  if (hasPrivatePackage(submodule)) return submodule;

  const sibling = path.resolve(repoRoot, "..", "private_tools");
  if (hasPrivatePackage(sibling)) return sibling;

  return null;
}

function rmrf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, ent.name);
    const to = path.join(dest, ent.name);
    if (ent.isDirectory()) copyDirRecursive(from, to);
    else fs.copyFileSync(from, to);
  }
}

function syncPrivatePublic(privateRoot) {
  const src = path.join(privateRoot, "apps", "web", "public");
  if (!fs.existsSync(src)) {
    console.warn(`[dev] No public dir to sync (skipping): ${src}`);
    return false;
  }
  const entries = fs.readdirSync(src);
  if (entries.length === 0) {
    console.warn(`[dev] private_tools public folder is empty (skipping sync): ${src}`);
    return false;
  }
  rmrf(syncDest);
  fs.mkdirSync(webPublic, { recursive: true });
  copyDirRecursive(src, syncDest);
  console.log(`[dev] Synced private_tools public → ${path.relative(repoRoot, syncDest)}`);
  return true;
}

function main() {
  const merged = loadMergedEnv();
  const privateRoot = resolvePrivateToolsRoot(merged);
  const autostartPrivate = isTruthyFlag(merged.BLACKSTART_PRIVATE_TOOLS_AUTOSTART);

  /** @type {NodeJS.ProcessEnv} */
  const childEnv = { ...merged };

  if (privateRoot) {
    const synced = syncPrivatePublic(privateRoot);
    if (synced) childEnv.NEXT_PUBLIC_PRIVATE_TOOLS_PUBLIC_BASE = "/private-tools-sync";
    else delete childEnv.NEXT_PUBLIC_PRIVATE_TOOLS_PUBLIC_BASE;

    console.log(`[dev] private_tools root: ${privateRoot}`);
    if (!autostartPrivate) {
      console.log("[dev] BLACKSTART_PRIVATE_TOOLS_AUTOSTART is off — not spawning private_tools `npm run dev`.");
    }
  } else {
    delete childEnv.NEXT_PUBLIC_PRIVATE_TOOLS_PUBLIC_BASE;
  }

  const commands = [
    "npm run dev -w apps/api",
    "npm run dev -w apps/web",
  ];
  let names = "api,web";
  let colors = "cyan,magenta";

  if (privateRoot && autostartPrivate) {
    const escaped = privateRoot.replace(/"/g, '\\"');
    commands.push(`npm --prefix "${escaped}" run dev`);
    names += ",private";
    colors += ",violet";
  }

  const quoted = commands.map((c) => `"${c.replace(/"/g, '\\"')}"`).join(" ");
  const cmd = `npx concurrently -k -n ${names} -c ${colors} ${quoted}`;

  const child = spawn(cmd, {
    cwd: repoRoot,
    env: childEnv,
    stdio: "inherit",
    shell: true,
  });

  child.on("exit", (code, signal) => {
    if (signal) process.exit(1);
    process.exit(code ?? 1);
  });
}

const isMain =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  main();
}
