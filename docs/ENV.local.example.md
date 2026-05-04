# Example `.env.local` files for `blackstart_tools`

**Only `.env.local` is for secrets and machine paths** (gitignored). Tracked **`.env.example`** files and this doc show *what to set*, not your real paths. Do not add `BLACKSTART_PRIVATE_TOOLS_DIR` to a committed `.env` file.

Copy the sections below into **two** gitignored files (create them if missing):

1. **Repo root:** `blackstart_tools/.env.local` — used by `npm run dev` to find `private_tools`, sync static assets, and optionally start that repo’s dev servers.
2. **Web app:** `blackstart_tools/apps/web/.env.local` — Next.js / browser (`NEXT_PUBLIC_*`) and local overrides.

Adjust paths and ports for your machine.

---

## 1. `blackstart_tools/.env.local` (repo root)

```env
# Path to your private_tools clone (Windows or POSIX). Edit to match your machine:
BLACKSTART_PRIVATE_TOOLS_DIR=c:\private_tools

# Optional: only sync logos from private_tools into apps/web — do not spawn `npm run dev` there.
# BLACKSTART_PRIVATE_TOOLS_AUTOSTART=false
```

If you omit `BLACKSTART_PRIVATE_TOOLS_DIR`, `npm run dev` still tries **`private/private-tools`** then **`../private_tools`** when a `package.json` exists there.

---

## 2. `blackstart_tools/apps/web/.env.local`

```env
# FastAPI for this repo (must match apps/api listen port).
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8010

# Marketing site — CSP frame-ancestors for /tools embed.
NEXT_PUBLIC_MARKETING_WEB_ORIGIN=http://127.0.0.1:3000

# Optional private_tools Next app. blackstart_tools /tools links here when the block is shown.
NEXT_PUBLIC_PRIVATE_TOOLS_WEB_ORIGIN=http://127.0.0.1:3002

# Optional: hide private companion block on /tools (false / 0 / no / off).
# NEXT_PUBLIC_SHOW_PRIVATE_TOOLS=false

# Markdown notes (/tools/handbook): folder of .md files. Optional in-browser save:
# HANDBOOK_CONTENT_PATH=P:\pkm\notes
# HANDBOOK_EDITABLE=1
```

You can also set **`BLACKSTART_PRIVATE_TOOLS_DIR`** in this file instead of the repo root; the dev launcher reads both.

**Note:** `NEXT_PUBLIC_PRIVATE_TOOLS_PUBLIC_BASE` is injected automatically when the dev launcher syncs `private_tools/apps/web/public` — do not set it by hand unless you know you need to.
