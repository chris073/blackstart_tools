# Athena config for the API

- **`apps/api/athena/.env.local`** — primary config for the web stack (same keys as the legacy GUI: `REGION`, `WORKGROUP`, `DATABASES_LIST_PATH`, …).
- If this file is missing, the API falls back to **`packages/python-tools/athena/.env.local`** so the old tool still works.

Keep secrets out of git: `.env.local` is listed in the repo root `.gitignore`.
