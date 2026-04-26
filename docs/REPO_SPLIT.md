# Repo split: blackstart_tools vs blackstart_web

Engineering tools (**Athena**, API, private UI) stay in **`blackstart_tools`** (this repo).

The **public marketing site** is scaffolded in sibling folder **`c:\repos\blackstart_web`** (intended as its own GitHub repo).

## Ports (local)

- **blackstart_web:** Next on **3000** — `npm run dev` from `blackstart_web`
- **blackstart_tools:** Next tools UI on **3001** — `npm run dev` from `blackstart_tools` (see `apps/web/package.json`)

The public site links to `http://127.0.0.1:3001/tools` via `NEXT_PUBLIC_TOOLS_WEB_ORIGIN`.

## Next steps

1. Initialize git in `blackstart_web` and push to a **public** GitHub repo.
2. Optionally add `blackstart_tools` as a submodule under `blackstart_web/private/` (see `blackstart_web/docs/GIT_SUBMODULE.md`).
3. When ready, **delete** duplicated marketing routes from `blackstart_tools/apps/web` and keep only `/tools` (and any API-only needs).
