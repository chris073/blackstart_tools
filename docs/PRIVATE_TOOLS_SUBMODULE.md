# Optional `private_tools` submodule

**Non-public** tools and experiments can live in a separate repository (e.g. **`private_tools`**) and be linked into this monorepo as a **git submodule** under `private/private-tools`.

## Invited collaborators

1. Get read access to the **`private_tools`** GitHub repo.  
2. Clone **`blackstart_tools`** and initialize submodules:

   ```bash
   git clone --recurse-submodules https://github.com/YOUR_ORG/blackstart_tools.git
   # or, if already cloned:
   git submodule update --init --recursive
   ```

3. Use normal **`npm install`** / **`npm run dev`** at the `blackstart_tools` root.

## Third parties / your own private fork

- Use **your** private repo URL in `git submodule add` (or change `origin` inside `private/private-tools` after add).  
- You do **not** need Blackstart’s private remote—only your fork or empty scaffold.  
- Submodule URL is stored in **`.gitmodules`**; it is not configured via `.env`.  
- **`.env` / `.env.local`** remain for **runtime** settings (API keys, content paths, etc. in each app)—see each repo’s `.env.example`.

## Hiding private tools on `/tools`

In **`blackstart_tools/apps/web/.env.local`**, set **`NEXT_PUBLIC_SHOW_PRIVATE_TOOLS=false`** (or `0`, `no`, `off`) to remove the private companion link from the tools index. Omit the variable or set it to `true` to show it (default).

## One-command dev (sync assets + start private app)

From **`blackstart_tools`** root, **`npm run dev`** resolves **`private_tools`**, copies **`apps/web/public`** into **`apps/web/public/private-tools-sync`** for shared logos, and spawns **`npm run dev`** in **`private_tools`** (unless **`BLACKSTART_PRIVATE_TOOLS_AUTOSTART=false`**). Configure **`BLACKSTART_PRIVATE_TOOLS_DIR`** in repo-root **`.env.local`** if discovery does not find your clone. See **`docs/ENV.local.example.md`**, repo **`.env.example`**, **`apps/web/.env.example`**, and **`README.md`**.

## Scaffold clone

A minimal scaffold lives at **`c:\private_tools`** (or your chosen path). See that folder’s **`README.md`** and **`docs/INTEGRATION.md`** for push and wiring notes.

When the code split is complete, this doc will be updated with the exact mount path and any `package.json` workspace changes.
