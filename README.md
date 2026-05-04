# blackstart_tools (monorepo)

Next.js tools UI (**`apps/web`**, port **3001**) and FastAPI (**`apps/api`**) plus **`packages/python-tools`**.

## Dev

```bash
npm install
npm run dev          # web + api (+ optional private_tools: see below)
npm run dev:core     # web + api only (no private_tools discovery)
npm run dev:web      # web only
npm run dev:api      # api only
```

### Optional `private_tools` from one command

From the repo root, **`npm run dev`** runs **`scripts/dev-with-optional-private.mjs`**, which:

1. **Finds** a `private_tools` checkout: `BLACKSTART_PRIVATE_TOOLS_DIR` in **repo-root** or **`apps/web/.env.local`**, else **`private/private-tools`**, else **`../private_tools`** (sibling folder).
2. **Copies** `private_tools/apps/web/public` → **`apps/web/public/private-tools-sync`** so the tools UI can reuse the same logo and static assets.
3. **Starts** **`npm run dev`** inside `private_tools` (Next **:3002** + private API **:8011**) alongside this repo’s API and web — unless **`BLACKSTART_PRIVATE_TOOLS_AUTOSTART=false`**.

Put **`BLACKSTART_PRIVATE_TOOLS_DIR`** in **repo-root `.env.local`** (gitignored) so `npm run dev` can find `private_tools`, sync its `public/` assets, and start that repo’s dev servers. Put **`NEXT_PUBLIC_*`** values in **`apps/web/.env.local`**. Tracked templates: **`.env.example`** (root), **`apps/web/.env.example`**, and **`docs/ENV.local.example.md`** (copy-paste reference only — never commit real paths).

Marketing site lives in **`blackstart_web`** (port **3000**).

## Optional private layer (`private_tools`)

Optional **private** tools and experiments can live in a **separate repo** and be attached here as a **git submodule** (e.g. **`private/private-tools`**). Invited collaborators clone with submodule init; **third parties** point the submodule at **their own** private fork—no access to Blackstart’s remote required.

Details: **`docs/PRIVATE_TOOLS_SUBMODULE.md`**. Scaffold / integration notes: clone or create **`private_tools`** (see **`c:\private_tools`** if you use that path).

To **hide** the private companion link on **`/tools`**, set **`NEXT_PUBLIC_SHOW_PRIVATE_TOOLS=false`** in **`apps/web/.env.local`** (see **`.env.example`**). Configure the private app in its own repo; core tools env stays in **`blackstart_tools`** **`.env.example`** files.

**Markdown notes** (`/tools/handbook`) and **`HANDBOOK_*`** env live on **`blackstart_tools`** `apps/web`—move those variables from any old `private_tools` `.env.local` when you migrate.
