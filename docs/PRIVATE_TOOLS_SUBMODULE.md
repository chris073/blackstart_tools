# Optional `private_tools` submodule

Athena, handbook, and other **non-public** pieces can live in a separate repository (e.g. **`private_tools`**) and be linked into this monorepo as a **git submodule** under `private/private-tools`.

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
- **`.env` / `.env.local`** remain for **runtime** settings (e.g. `HANDBOOK_CONTENT_PATH`, Athena credentials) inside `apps/web` or `apps/api`—see each app’s `.env.example`.

## Scaffold clone

A minimal scaffold lives at **`c:\private_tools`** (or your chosen path). See that folder’s **`README.md`** and **`docs/INTEGRATION.md`** for push and wiring notes.

When the code split is complete, this doc will be updated with the exact mount path and any `package.json` workspace changes.
