# blackstart_tools

Monorepo: **Next.js** (`apps/web`, default port **3001**) and **FastAPI** (`apps/api`, default **8010**), plus optional **`packages/python-tools`** scripts.

## Development

```bash
npm install
npm run dev       # web + API (see scripts for optional extras)
npm run dev:core  # web + API only
npm run dev:web   # web only
npm run dev:api   # API only
```

Environment templates live in **`.env.example`** at the repo root and under **`apps/web`** / **`apps/api`**. Copy values into **`.env.local`** (gitignored); see **`docs/ENV.local.example.md`** for a fuller walkthrough.

## Documentation

- **`docs/ENV.local.example.md`** — local env layout
- **`docs/REPO_SPLIT.md`** — how this app relates to a separate marketing site (ports, embed URL) if you use one
- **`docs/PRIVATE_TOOLS_SUBMODULE.md`** — optional second repo / submodule for extra tools (advanced)
