# indie-tools (monorepo)

This repo is being restructured into a monorepo with:

- `apps/web`: Next.js frontend (Blackstart Labs UI)
- `apps/api`: FastAPI backend (we'll connect Python tools to API routes one-by-one)
- `packages/python-tools`: the existing standalone Python tools, consolidated in one place

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

