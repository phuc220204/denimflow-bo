# Sprint 0 — Scaffold and pipeline (walking skeleton)

Goal: a trivial but **real** vertical slice running in production: log in on the web app, web calls the API `/health`, the API queries the database. Everything that can go wrong with infrastructure goes wrong here, cheaply.

Constraints: free tiers only. Read `HELP.md` links for the installed versions. Ask the owner before choosing between alternatives marked "decide".

### T0.1 Cloud accounts and projects   [owner: human]
- Create two Supabase projects: `denimflow-dev`, `denimflow-prod`. Note: URL, anon/publishable key, service role/secret key, pooled and direct connection strings.
- Create the Render web service (later, after T0.7) and the Cloudflare project (after T0.5).
- Put real values only in dashboards and local `.env`. Never in chat or git.
Acceptance:
- [ ] Owner confirms both Supabase projects exist and the keys are stored privately.

### T0.2 Monorepo root   [owner: agent]
Branch: `chore/monorepo-root`
Do:
- `package.json` (private, `packageManager` pinned, `engines.node` = current LTS), `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `tsconfig.base.json` (strict), ESLint + Prettier configs, `.editorconfig`, `.nvmrc`.
- Root scripts: `dev` (web + API), `dev:web`, `dev:api`, `build`, `lint`, `typecheck`, `test` using `pnpm -r`; plus `format` (`prettier --write .`), `format:check` (`prettier --check .`) and `clean` (remove build output and caches).
- Git hooks: Husky (installed by the `prepare` script) with a `pre-commit` hook running `lint-staged` (`eslint --fix` + `prettier --write` on staged ts/tsx/js/mjs/cjs, `prettier --write` on staged json/css/yaml). Add `.prettierrc` and `.prettierignore`. Why: catches style errors before CI; hooks are a convenience, CI stays the real gate. Markdown is not formatted by Prettier (owner decision, PR #3: avoids re-padding tables in the bilingual docs).
Acceptance:
- [x] `pnpm install` works from a clean clone; `pnpm format:check` and `pnpm lint` run (even with no sources yet).
- [x] A deliberately mis-formatted staged file is fixed or rejected by the `pre-commit` hook.

### T0.3 packages/shared and packages/engine skeletons   [owner: agent]
Branch: `feat/shared-engine-skeleton`
Do:
- `@denimflow/shared`: Zod, enums from `DATABASE_DESIGN.md` §5, a `health` response schema.
- `@denimflow/engine`: empty `src/index.ts`, Vitest configured, one placeholder test, **no framework imports**.
- Build both with `tsup` to **dual ESM + CJS** (the plan assumed a CommonJS NestJS; NestJS 12 turned out to be ESM-only, see ADR 0004, so the CJS output now serves CommonJS tools only).
Acceptance:
- [x] `import { ... } from '@denimflow/shared'` works from both a CJS and an ESM consumer (prove with a tiny test or script).

### T0.4 apps/api skeleton   [owner: agent]
Branch: `feat/api-skeleton`
Do:
- NestJS app, config module validated by Zod (see `DEVELOPMENT_SETUP.md` §4), `GET /health` returning `{ status, db }` after `select 1`.
- Prisma set up for Supabase (pooled `DATABASE_URL` + `DIRECT_URL`); first migration creates `profiles`, `audit_logs` (+ append-only trigger) and enables RLS.
- `JwtAuthGuard` verifying the Supabase JWT, `RolesGuard` + `@Roles()`, `GET /me` returning the profile and role.
- Exception filter and `BusinessRuleViolation`.
- `apps/api/.env.example`: fake values only, every API variable of `DEVELOPMENT_SETUP.md` §4.
Acceptance:
- [ ] `GET /health` is 200 locally with the dev database.
- [ ] `GET /me` is 401 without a token and 200 with a valid token for a seeded profile.
- [ ] Migration applies on an empty database; RLS enabled on both tables.
Status: part A merged (#6), verified on Docker and in CI; dev-database checks wait for T0.1. Part B (auth, `/me`, seed) pending.

### T0.5 apps/web skeleton   [owner: agent]
Branch: `feat/web-skeleton`
Do:
- Vite + React + TS + Tailwind + shadcn/ui; React Router; TanStack Query; Supabase client for Auth only; i18n dictionary with a single Vietnamese (`vi`) locale (UI language is Vietnamese, D8); Inter font with the Vietnamese subset; theme tokens from `docs/design/DESIGN.md`; MSW set up.
- Login page, protected layout, a Home page that shows `/me` and `/health`.
- SPA fallback: all routes serve `index.html` (Cloudflare setting, see `DEVELOPMENT_SETUP.md` §7).
- `apps/web/.env.example`: fake values only, every web (`VITE_*`) variable of `DEVELOPMENT_SETUP.md` §4; no server secrets.
Acceptance:
- [ ] Log in with a seeded user locally; Home shows name, role and API health.

### T0.6 CI   [owner: agent]
Branch: `ci/pipeline`
Do:
- `.github/workflows/ci.yml`: on PR and push to `main`: checkout, pnpm + Node setup with cache, `pnpm install --frozen-lockfile`, `pnpm format:check`, lint, typecheck, test, build. Use a Postgres **service container** for API tests.
- `.github/workflows/keep-alive.yml`: scheduled (every ~10 min) `curl` to the API `/health` URL from a repository variable. Document that GitHub may delay or disable schedules on inactive repos.
- Workflow permissions: `contents: read` only.
Acceptance:
- [x] CI is green on the PR itself.

### T0.7 First deploy   [owner: human, with agent guidance]
- Apply migrations to `denimflow-prod` using the `DIRECT_URL` (the owner runs the command the agent provides, or a `migrate` workflow does).
- Deploy the API to Render (build/start from `DEVELOPMENT_SETUP.md` §6); set env vars in the dashboard.
- Deploy the web to Cloudflare (decide: Pages vs Workers static assets after reading current docs; record in an ADR). Set `VITE_*` at build time.
- Set `CORS_ORIGINS` on the API to the web URL.
Acceptance:
- [ ] The public web URL logs in and shows API health from the Render URL.
- [ ] Cold start measured and written in `PROJECT_STATE.md`.

### T0.8 Lock the pipeline   [owner: human]
- After the first green CI run: GitHub → Settings → Rules → edit `protect-main` → add **Require status checks to pass** and select the CI job.
- Add `.github/CODEOWNERS` (agent drafts it with real GitHub usernames provided by the owner).
Acceptance:
- [ ] A PR with failing CI cannot be merged.
- [ ] Update `PROJECT_STATE.md`: S0 done; open decisions O2 resolved.
