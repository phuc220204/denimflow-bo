# DEVELOPMENT_SETUP — DenimFlow BO

Version 0.1 · 2026-10-16 · Language: EN (canonical) · Mirror: `docs/vi/DEVELOPMENT_SETUP.md`

> **Status:** `apps/` and `packages/` do not exist yet; they are created in Sprint 0 (`.agents/tasks/S0-scaffold-and-pipeline.md`). Commands below are the **target** commands and become valid once S0 is merged. Dashboard labels of third-party services change over time: when a label differs, follow the official docs listed in `HELP.md` and fix this file.

## 1. Overview

```
Browser ─► Cloudflare (static web) ─► Render (NestJS API) ─► Supabase Postgres
   │                                        └──────────────► Supabase Storage (private bucket)
   └──────────────► Supabase Auth (login, JWT)  ◄── API verifies the JWT
```

| Part | Service | Cost |
|---|---|---|
| Source, CI | GitHub, GitHub Actions | 0 (public repo) |
| Web (static) | Cloudflare Pages or Workers static assets (decision O2 in S0) | 0 |
| API | Render free web service | 0 (sleeps after 15 min idle, ~1 min cold start) |
| DB, Auth, Storage | Supabase free | 0 (small quotas; project pauses after about a week of inactivity) |

Use two Supabase projects: **`denimflow-dev`** (local development, tests of migrations) and **`denimflow-prod`** (deployed system). Choose the same region for the database and the API host to cut latency (a Southeast Asia region is a sensible default for a team in Vietnam).

## 2. Prerequisites

| Tool | Version | Check |
|---|---|---|
| Git | recent | `git --version` |
| Node.js | current LTS (see `.nvmrc`) | `node --version` |
| pnpm | version pinned in root `package.json` (`packageManager`) | `pnpm --version`; install with `corepack enable` or `npm i -g pnpm` |
| Editor | VS Code (UTF-8, LF) | — |

Accounts: GitHub, Supabase, Render, Cloudflare. Windows tips: use PowerShell or Git Bash; keep the repo path short (avoid very long paths); `.gitattributes` forces LF line endings, do not override it.

## 3. Clone, install, run (after Sprint 0)

```powershell
git clone https://github.com/<owner>/denimflow-bo.git
cd denimflow-bo
pnpm install --frozen-lockfile
copy apps\api\.env.example apps\api\.env      # then fill with DEV project values
copy apps\web\.env.example apps\web\.env
pnpm --filter @denimflow/api db:migrate:dev   # applies migrations to the DEV database
pnpm --filter @denimflow/api db:seed          # demo catalog, users, template
pnpm dev                                       # web on :5173, API on :3000
```

Daily commands:

| Command | Purpose |
|---|---|
| `pnpm dev` | Web + API in watch mode |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` | Quality gates (CI runs the same) |
| `pnpm --filter @denimflow/engine test` | Engine unit tests (fast, no DB) |
| `pnpm --filter @denimflow/api db:migrate:dev --name <name>` | Create and apply a migration |
| `pnpm --filter @denimflow/api db:studio` | Browse the dev database |

Never run migrate/seed commands against `denimflow-prod` from a laptop by accident: keep the prod connection strings out of local `.env` files; production migrations run from the `migrate` workflow (§8).

## 4. Environment variables

Real values live only in git-ignored `.env` files and in provider dashboards. The repo contains `.env.example` files with placeholders. The web file must contain **no** server secrets.

### `apps/api/.env`

| Variable | Meaning | Where to get it |
|---|---|---|
| `NODE_ENV` | `development` / `production` | — |
| `PORT` | API port (3000 locally; Render injects its own) | — |
| `DATABASE_URL` | Pooled (transaction mode) connection string used at runtime | Supabase → Connect |
| `DIRECT_URL` | Direct or session-pooler connection string used by migrations | Supabase → Connect |
| `SUPABASE_URL` | Project URL | Supabase → Project settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** key (service role); API only | same |
| `SUPABASE_JWT_SECRET` | Only if the project still uses the legacy shared JWT secret; otherwise the API verifies via the project's JWKS | Supabase → JWT settings |
| `SUPABASE_STORAGE_BUCKET` | Private bucket name, e.g. `denimflow-files` | you create it |
| `CORS_ORIGINS` | Comma-separated allowed web origins | web URL(s) |
| `SEED_DEFAULT_PASSWORD` | Initial password for seeded demo users (never committed) | you choose |

### `apps/web/.env`

| Variable | Meaning |
|---|---|
| `VITE_API_URL` | Base URL of the API |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | **Public** anon/publishable key (safe to expose; RLS is deny-all) |

`VITE_*` values are compiled into public JavaScript. Never put a secret there. Supabase has renamed its key types over time (anon/service role vs publishable/secret): use the public one in the web and the secret one only in the API.

## 5. Database (Supabase + Prisma)

1. Create the project in Supabase; note the database password (store it in a password manager, not in git).
2. **Auth settings:** disable public sign-ups (users are created by the Admin through the API); set Site URL and redirect URLs to the web origin(s).
3. **Storage:** create a **private** bucket (`denimflow-files`).
4. **Connection strings:** Dashboard → Connect. Use the **transaction pooler** string as `DATABASE_URL` and the **direct or session pooler** string as `DIRECT_URL`. The direct host is IPv6-only on some plans; if your network or host is IPv4-only, use the session pooler for `DIRECT_URL`.
5. Prisma: set `DATABASE_URL` for runtime and `DIRECT_URL` for migrations following the Prisma docs for the **installed major version** (the config file layout differs between versions; see `HELP.md`). Transaction pooling needs the Prisma pgbouncer option.
6. Apply migrations: `pnpm --filter @denimflow/api db:migrate:dev` (dev) or the `migrate` workflow (prod). Then `db:seed` on dev.
7. Verify RLS: run the "tables without RLS" check query from `DATABASE_DESIGN.md` §8.

Free-tier reminders: a project pauses after about a week of inactivity (restore from the dashboard; the keep-alive workflow and regular use prevent it); backups are not guaranteed on the free tier, so rebuild from migrations + seed and export data before the final demo.

## 6. Deploy the API on Render

1. Render → New → **Web Service** → connect the GitHub repo. Instance type **Free**. Same region as Supabase if possible.
2. Root directory: repository root (the monorepo lockfile is at the root).
3. Build command (adjust to the final scripts):
   ```
   corepack enable && pnpm install --frozen-lockfile && pnpm --filter @denimflow/shared build && pnpm --filter @denimflow/engine build && pnpm --filter @denimflow/api db:generate && pnpm --filter @denimflow/api build
   ```
4. Start command: `node apps/api/dist/main.js`
5. Health check path: `/health`.
6. Environment: all variables of `apps/api/.env` **with production values**, plus `NODE_VERSION` matching `.nvmrc`. Set `CORS_ORIGINS` to the deployed web URL.
7. Auto-deploy from `main`.

Do **not** run migrations in the start command (every wake-up would run them). Free instance behavior: sleeps after 15 minutes without traffic, about 1 minute to wake; limited instance hours per month (one always-on service fits; do not add a second service). Before a demo, open the `/health` URL a few minutes early.

## 7. Deploy the web on Cloudflare

Decision O2: Pages or Workers static assets. Cloudflare's docs currently recommend Workers for new projects while Pages remains supported; record the choice in an ADR.

Settings (either option):
- Build: `pnpm --filter @denimflow/web build` (install may be run by the platform; check its build log).
- Output directory: `apps/web/dist`.
- Build-time variables: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `NODE_VERSION`.
- **SPA fallback:** every unknown path must serve `index.html`, otherwise refreshing `/orders` returns 404. For Workers static assets this is the `not_found_handling = "single-page-application"` setting in the Wrangler config; verify the current behavior in the docs for the option you choose.
- Production branch: `main`; PRs get preview deployments.

After the first deploy: add the web URL to Supabase Auth redirect URLs and to the API `CORS_ORIGINS`.

## 8. CI/CD (GitHub Actions)

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | PR, push to `main` | install (cached), lint, typecheck, test (Postgres service container), build |
| `migrate.yml` | manual (`workflow_dispatch`) | `prisma migrate deploy` against production using the `DIRECT_URL` stored as an Actions secret; optionally gated by a protected environment |
| `keep-alive.yml` | schedule (~10 min) | `curl` the API `/health` (URL in a repository variable) to reduce Render cold starts and Supabase pauses |

Workflows use `permissions: contents: read`. GitHub may delay scheduled runs and may disable schedules on inactive repositories; the keep-alive is a convenience, not a guarantee.

After the first green `ci.yml`: add **Require status checks to pass** to the `protect-main` ruleset (owner task T0.8).

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| First request after idle takes ~1 min | Render free instance asleep | Wait; call `/health` before demos; keep-alive workflow |
| Prisma error `prepared statement ... already exists` | Transaction pooler without the Prisma pgbouncer option | Add the pgbouncer option to `DATABASE_URL` per the Prisma docs |
| `P1001` cannot reach database from CI/Render/local | Direct connection is IPv6-only | Use the session pooler string for `DIRECT_URL` |
| Browser CORS error | Web origin missing in `CORS_ORIGINS` (check scheme, no trailing slash) | Fix the variable, redeploy API |
| API returns 401 for a logged-in user | Wrong Supabase URL/keys, expired token, wrong JWT verification method | Check env vs project; follow the Supabase JWT docs |
| Login works but role is empty / 403 | No `profiles` row for the auth user, or inactive | Create/activate the profile (Admin) |
| Refresh on a route gives 404 on the web | SPA fallback not configured | See §7 |
| Supabase project paused | Inactivity | Restore in the dashboard, then run `/health` |
| Lockfile merge conflict | Parallel dependency changes | Take `main`'s `pnpm-lock.yaml`, run `pnpm install` |
| Strange whole-file diffs | CRLF vs LF | Keep `.gitattributes`; `git add --renormalize .` |
| Build fails on Render: cannot find `@denimflow/shared` | Packages not built before the API | Keep the build order in §6 |
