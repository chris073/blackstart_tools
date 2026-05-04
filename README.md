# blackstart_tools (monorepo)

Next.js tools UI (**`apps/web`**, port **3001**) and FastAPI (**`apps/api`**) plus **`packages/python-tools`**.

## Dev

```bash
npm install
npm run dev          # web + api
npm run dev:web      # web only
npm run dev:api      # api only
```

Marketing site lives in **`blackstart_web`** (port **3000**).

## Optional private layer (`private_tools`)

Athena, handbook PKM, and other **private** code can live in a **separate repo** and be attached here as a **git submodule** (e.g. **`private/private-tools`**). Invited collaborators clone with submodule init; **third parties** point the submodule at **their own** private fork—no access to Blackstart’s remote required.

Details: **`docs/PRIVATE_TOOLS_SUBMODULE.md`**. Scaffold / integration notes for the split repo: clone or create **`private_tools`** (see **`c:\private_tools`** if you use that path).

Runtime secrets and local paths (**`HANDBOOK_CONTENT_PATH`**, Athena env, etc.) still live in **`apps/web/.env.local`** and **`apps/api/...`** — see each app’s **`.env.example`**.
