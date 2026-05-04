export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8010";

/**
 * Tools index: show link to optional `private_tools` app (see `NEXT_PUBLIC_PRIVATE_TOOLS_WEB_ORIGIN`).
 * Set `NEXT_PUBLIC_SHOW_PRIVATE_TOOLS` to `false`, `0`, `no`, or `off` in `.env.local` to hide that block.
 * When unset or empty, defaults to **visible** (backward compatible).
 */
export function privateToolsVisible(): boolean {
  const raw = process.env.NEXT_PUBLIC_SHOW_PRIVATE_TOOLS;
  if (raw === undefined) return true;
  const s = raw.trim().toLowerCase();
  if (s === "") return true;
  return !["0", "false", "no", "off"].includes(s);
}

/**
 * When `npm run dev` is started from the monorepo root, `scripts/dev-with-optional-private.mjs` may copy
 * `private_tools/apps/web/public` here and set this to `/private-tools-sync` so logos match the private app.
 */
export function privateToolsPublicAssetBase(): string {
  return (process.env.NEXT_PUBLIC_PRIVATE_TOOLS_PUBLIC_BASE ?? "").replace(/\/$/, "");
}

export function brandLogoSrc(): string {
  const base = privateToolsPublicAssetBase();
  if (base) return `${base}/blackstart-labs-logo.png`;
  return "/blackstart-labs-logo.png";
}
