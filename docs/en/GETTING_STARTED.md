# Getting started (new team member)

From a fresh clone to running the checks and the API on your machine. For the full reference (environment variables, deploy, CI) see [`DEVELOPMENT_SETUP.md`](DEVELOPMENT_SETUP.md); for branches, commits and pull requests see [`Tutorial_denimflow-bo.md`](../../Tutorial_denimflow-bo.md); to pick a task see [`docs/TASK_BOARD.md`](../TASK_BOARD.md).

Last checked: 2026-10-18, on Windows 11 with Git Bash, against `main` after #28 plus the seed fix.

## 1. What exists today

| Part | Status |
|---|---|
| Monorepo root (pnpm workspace, TypeScript strict, ESLint, Prettier, Husky) | Done (#3) |
| `packages/shared` and `packages/engine` (conditions, BR-01 validation, gates, BOM) | Merged via #26 (not yet reviewed) |
| `apps/api`: auth (Supabase), users, catalog, workflow, orders, inventory | Merged via #26; security hotfix #28 (login required, roles, 422 on bad input) |
| `apps/web`: login, role menus, catalog, users, workflow designer, orders | Merged via #26 |
| CI (GitHub Actions, job `CI`, required before merge) | Done and green |
| Supabase | `denimflow-dev` exists and is migrated; `denimflow-prod` not yet (T0.1) |
| Seed (`pnpm db:seed`): catalog, 7 demo accounts, "Jean Standard" template, BOM, fabric lots | Working (see §6) |

## 2. Install the tools

| Tool | Version | Check |
|---|---|---|
| Git | recent | `git --version` |
| Node.js | 24 (see `.nvmrc`) | `node --version` |
| pnpm | pinned in root `package.json` (`packageManager`) | `pnpm --version` |
| Docker Desktop | recent, running | `docker info` |
| VS Code | recommended extensions: ESLint, Prettier, Prisma | — |

- pnpm: run `corepack enable` once; corepack then uses the exact version from `packageManager`. (`npm i -g pnpm` also works; pnpm switches to the pinned version itself.)
- Windows: run `git config --global core.longpaths true` and keep the repository in a short path (for example `C:\dev\denimflow-bo`). Deep paths hit the Windows path length limit ("Filename too long").

## 3. Clone and install

```bash
git clone https://github.com/phuc220204/denimflow-bo.git
cd denimflow-bo
pnpm install --frozen-lockfile
```

- `--frozen-lockfile` installs exactly what `pnpm-lock.yaml` says and fails if `package.json` and the lockfile disagree. CI uses the same flag.
- The install also runs `prisma generate` for the API (`postinstall`), which creates the Prisma client in `apps/api/src/generated/` (git-ignored).
- pnpm blocks install scripts of dependencies unless they are allowed. `pnpm-workspace.yaml` → `allowBuilds` allows only `esbuild`, `prisma` and `@prisma/engines`. If you add a dependency that needs a script, pnpm stops with `ERR_PNPM_IGNORED_BUILDS`; ask in the team before allowing it.

## 4. Run the same checks as CI

API tests need a throwaway Postgres in Docker. They never touch Supabase.

```bash
pnpm --filter @denimflow/api db:test:up      # Postgres 17 on localhost:54329
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm --filter @denimflow/api db:test:down    # stop it when done (the container is removed)
```

All five must pass before you open a pull request. `pnpm format` fixes formatting for you.

## 5. Run the API on a local database (no Supabase)

Use a second database in the same Docker container. Good for API work and `/health`; **logging in needs Supabase** (§6), because there is no local login. For UI work without Supabase set `VITE_ENABLE_MSW=true` in `apps/web/.env`.

```bash
pnpm --filter @denimflow/api db:test:up
docker exec denimflow-test-db createdb -U postgres denimflow_dev
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env` and set these two lines (local values, safe to use):

```
DATABASE_URL=postgresql://postgres:postgres@localhost:54329/denimflow_dev
DIRECT_URL=postgresql://postgres:postgres@localhost:54329/denimflow_dev
```

Then:

```bash
pnpm --filter @denimflow/api db:migrate:deploy
pnpm --filter @denimflow/api dev
```

Open http://localhost:3000/health and expect `{"status":"ok","db":"up"}`. Stop the server with Ctrl+C.

Notes:
- `db:test:down` removes the container, including `denimflow_dev`. Repeat the `createdb` and `db:migrate:deploy` steps after the next `db:test:up`.
- Variables already set in your shell take precedence over `apps/api/.env`.
- `apps/api/.env` is git-ignored. Never commit it.

## 6. After the Supabase projects exist (T0.1)

Ask the owner for the **dev** values of `apps/api/.env` (sent privately), or fill them as described in [`DEVELOPMENT_SETUP.md`](DEVELOPMENT_SETUP.md) §4 and §5. Never put production connection strings in a local `.env`.

```bash
pnpm --filter @denimflow/api db:migrate:deploy   # apply committed migrations
pnpm --filter @denimflow/api db:seed             # owner/maintainer only: creates or updates the demo Auth accounts
pnpm --filter @denimflow/api dev                 # API on :3000
pnpm --filter @denimflow/api smoke:roles         # in another terminal: logs in as each role and checks permissions
```

- `db:seed` is idempotent (safe to run again). It needs `SEED_DEFAULT_PASSWORD` (at least 12 characters) and resets the demo accounts to that password.
- Demo accounts: `admin@`, `pe@`, `planner@`, `warehouse@`, `operator@`, `qc@`, `manager@` + `denimflow.internal`. The password is the dev `SEED_DEFAULT_PASSWORD`; ask the owner privately.
- `smoke:roles` prints only HTTP status codes and writes no data. Expect `ALL CHECKS PASSED`.

## 7. Daily workflow

1. Pick a task in [`docs/TASK_BOARD.md`](../TASK_BOARD.md) and read its task file in `.agents/tasks/`.
2. `git switch main && git pull`, then `git switch -c <branch name from the task file>`.
3. Code, run §4, commit (Conventional Commits). Check `git branch --show-current` before every commit: never commit on `main`.
4. Push the branch and open a pull request with the template. CI must be green and one teammate must approve.

Details: [`Tutorial_denimflow-bo.md`](../../Tutorial_denimflow-bo.md). When you use an AI coding agent, make it read [`AGENTS.md`](../../AGENTS.md) first.

## 8. Common problems

| Symptom | Cause | Fix |
|---|---|---|
| `Could not migrate the test database. Is it running?` | Docker or the test container is not running | Start Docker Desktop, then `pnpm --filter @denimflow/api db:test:up` |
| `docker: ... port is already allocated` (54329) | An old container or another Postgres uses the port | `pnpm --filter @denimflow/api db:test:down`, or stop the other process |
| `failed to connect to the docker API` | Docker Desktop is not started | Start Docker Desktop and wait until it is running |
| `ERR_PNPM_IGNORED_BUILDS` | A new dependency wants to run an install script | Ask the team; allow only trusted packages with `pnpm approve-builds <name>` |
| `Unsupported engine` warning | Node version is not 24 | Install Node 24 (nvm-windows: `nvm install 24 && nvm use 24`) |
| `Invalid environment configuration` when starting the API | A required variable in `apps/api/.env` is missing or not a URL | Compare with `apps/api/.env.example` (the message lists the variable names) |
| Prisma refuses `migrate reset` when run by an AI agent | Prisma's safety check for destructive commands | Run it yourself if you really want to wipe the database, or recreate the Docker container |
| `Filename too long` | Windows path length limit | `git config --global core.longpaths true`, move the repo to a short path |
| The `pre-commit` hook rejects the commit | ESLint found an error it cannot fix | Fix the error, `git add`, commit again. Do not use `--no-verify` |
