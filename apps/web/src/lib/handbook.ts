import type { Dirent } from "fs";
import fs from "fs/promises";
import path from "path";

const ENV_KEY = "HANDBOOK_CONTENT_PATH";

export type HandbookDoc = {
  relPath: string;
  slug: string[];
  title: string;
};

export type HandbookNavFolder = {
  name: string;
  pathSegments: string[];
  subfolders: HandbookNavFolder[];
  files: HandbookDoc[];
};

export type HandbookNavRoot = {
  rootFiles: HandbookDoc[];
  folders: HandbookNavFolder[];
};

export function getHandbookRootFromEnv(): string | null {
  const p = process.env[ENV_KEY]?.trim();
  return p || null;
}

function isPathInsideRoot(rootResolved: string, candidateResolved: string): boolean {
  const rel = path.relative(rootResolved, candidateResolved);
  return rel === "" || (!rel.startsWith(`..${path.sep}`) && rel !== "..");
}

function slugToRelativeMdPath(slug: string[]): string | null {
  for (const s of slug) {
    if (!s || s === "." || s === ".." || s.includes("/") || s.includes("\\")) return null;
  }
  return `${slug.join("/")}.md`;
}

function prettifyTitle(filename: string): string {
  const base = filename.replace(/\.md$/i, "");
  const leaf = base.includes("/") ? base.slice(base.lastIndexOf("/") + 1) : base;
  return leaf
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function collectMarkdownFiles(dir: string, rootResolved: string): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries) {
    if (e.name === ".git" || e.name === "node_modules" || e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await collectMarkdownFiles(full, rootResolved)));
    } else if (e.isFile() && e.name.toLowerCase().endsWith(".md")) {
      const rel = path.relative(rootResolved, full);
      out.push(rel.split(path.sep).join("/"));
    }
  }
  return out;
}

export async function handbookConfiguredAndReadable(): Promise<boolean> {
  const root = getHandbookRootFromEnv();
  if (!root) return false;
  try {
    const st = await fs.stat(root);
    return st.isDirectory();
  } catch {
    return false;
  }
}

export async function listHandbookDocs(): Promise<HandbookDoc[]> {
  const root = getHandbookRootFromEnv();
  if (!root) return [];
  const rootResolved = path.resolve(root);
  const rels = await collectMarkdownFiles(rootResolved, rootResolved);
  return rels.sort().map((rel) => {
    const slug = rel.replace(/\.md$/i, "").split("/").filter(Boolean);
    return {
      relPath: rel,
      slug,
      title: prettifyTitle(rel),
    };
  });
}

type AccNode = { sub: Record<string, AccNode>; files: HandbookDoc[] };

function toNavFolder(name: string, pathSegments: string[], acc: AccNode): HandbookNavFolder {
  const subfolders = Object.keys(acc.sub)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    .map((k) => toNavFolder(k, [...pathSegments, k], acc.sub[k]));
  const files = [...acc.files].sort((a, b) => a.relPath.localeCompare(b.relPath, undefined, { sensitivity: "base" }));
  return { name, pathSegments, subfolders, files };
}

export function buildHandbookNavRoot(docs: HandbookDoc[]): HandbookNavRoot {
  const root: AccNode = { sub: {}, files: [] };
  for (const doc of docs) {
    const segs = doc.slug;
    if (segs.length === 0) continue;
    let cur = root;
    for (let i = 0; i < segs.length - 1; i++) {
      const dir = segs[i];
      if (!cur.sub[dir]) cur.sub[dir] = { sub: {}, files: [] };
      cur = cur.sub[dir];
    }
    cur.files.push(doc);
  }

  const folders = Object.keys(root.sub)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    .map((k) => toNavFolder(k, [k], root.sub[k]));
  const rootFiles = [...root.files].sort((a, b) =>
    a.relPath.localeCompare(b.relPath, undefined, { sensitivity: "base" }),
  );
  return { folders, rootFiles };
}

export async function readHandbookBySlug(
  slug: string[],
): Promise<{ content: string; relPath: string } | null> {
  const root = getHandbookRootFromEnv();
  if (!root || slug.length === 0) return null;
  const rel = slugToRelativeMdPath(slug);
  if (!rel) return null;
  const rootResolved = path.resolve(root);
  const fullPath = path.resolve(rootResolved, rel);
  if (!isPathInsideRoot(rootResolved, fullPath) || !fullPath.toLowerCase().endsWith(".md")) {
    return null;
  }
  try {
    const content = await fs.readFile(fullPath, "utf8");
    return { content, relPath: rel.split(path.sep).join("/") };
  } catch {
    return null;
  }
}

export async function writeHandbookBySlug(slug: string[], content: string): Promise<{ relPath: string } | null> {
  const root = getHandbookRootFromEnv();
  if (!root || slug.length === 0) return null;
  const rel = slugToRelativeMdPath(slug);
  if (!rel) return null;
  const rootResolved = path.resolve(root);
  const fullPath = path.resolve(rootResolved, rel);
  if (!isPathInsideRoot(rootResolved, fullPath) || !fullPath.toLowerCase().endsWith(".md")) {
    return null;
  }
  try {
    await fs.writeFile(fullPath, content, "utf8");
    return { relPath: rel.split(path.sep).join("/") };
  } catch {
    return null;
  }
}
