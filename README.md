# blackstart_tools (monorepo)

This repo is structured as a monorepo with:

- `apps/web`: Next.js frontend (Blackstart Labs UI)
- `apps/api`: FastAPI backend (Python tools connected via API routes one-by-one)
- `packages/python-tools`: standalone Python tools, consolidated in one place

## Dev

Install Node deps at the repo root:

```bash
npm install
```

Run web + api together:

```bash
npm run dev
```

Or individually:

```bash
npm run dev:web
npm run dev:api
```

## Athena (web + API)

The API reads **`apps/api/athena/.env.local`** first (same variables as the legacy GUI). If that file is missing, it falls back to **`packages/python-tools/athena/.env.local`**.

Copy or symlink from the legacy folder if needed:

```bash
# example (Windows PowerShell)
Copy-Item packages\python-tools\athena\.env.local apps\api\athena\.env.local
```

See `apps/api/athena/.env.local.example` for a template. `apps/api/athena/.env.local` is gitignored.
