# PROJECT_STATE

Short, current-state file. Keep it under ~5 KB: move history to `docs/adr/` or the PR log.
Last updated: 2026-10-19

## Phase

**Sprint 4 in progress**, with technical debt to pay first.
- Sprint 1–3 and T4.1 reached `main` in one self-merged PR (#26, +25k lines, **no review**, while the ruleset was disabled). Treat them as merged but unreviewed.
- `protect-main` is enabled again: 1 approval + required `CI` check. Security hotfix #28 (no local-token / password-less login, login required on workflow and catalog, roles via `AuthGuard` + `@Roles()`, 422 on invalid input).
- Supabase dev: all migrations applied, RLS on all 24 tables, 7 demo roles log in and pass 42/42 permission checks. `db:seed` fixed in #35 (template "Jean Standard" not yet seeded on dev until #35 merges and the owner runs it).
- #27, #29–#34 are being rebuilt by the owner as one PR per task from `main` (no stacking). T4.2 rebuilt (replaces #27): atomic start/complete, role + station checks, shared condition context with Confirm, engine fix R-17.

**Next:** review/merge the T4.2 PR, then rebuild T4.3 (#29), T4.4, T4.5, T5.1–T5.3 in turn; technical debt D1–D4 in `docs/TASK_BOARD.md` (cascade → restrict, guards, audit actor, module reviews); T5.5 dashboard.
Team: tasks are picked in `docs/TASK_BOARD.md` (max 2 per person); onboarding guide `docs/<lang>/GETTING_STARTED.md`.

## Decisions (settled)

| # | Decision |
|---|---|
| D1 | Stack option B: NestJS + Prisma (API), React + Vite + TS + Tailwind (web), Supabase (Postgres/Auth/Storage), pnpm monorepo |
| D2 | Architecture: Modular Monolith + Clean Architecture; `packages/engine` is pure TypeScript |
| D3 | Hosting at cost 0: Cloudflare for web, Render free for API, Supabase free for DB/Auth/Storage. Vercel not used (Hobby plan has no team collaboration and is non-commercial only) |
| D4 | Repo is **public**; `main` protected by a ruleset (PR required, 1 approval, squash only, linear history, required `CI` check) |
| D5 | Scope: MVP = 14 FR (see `docs/en/PRD.md` §5) |
| D6 | Docs are bilingual: `docs/en` canonical, `docs/vi` mirror; agent files English only |
| D7 | QC thresholds when clean wash is skipped are separate QC Profiles + signed customer acknowledgement (BR-18/19) |
| D8 | UI language is **Vietnamese** (single language; strings still live in a dictionary). Design system and Vietnamese glossary: `docs/design/DESIGN.md` |

## Open decisions (need the owner)

| # | Question | Default if no answer |
|---|---|---|
| O1 | Deadline and demo date | Plan 6 sprints (S0..S5), compress if needed |
| O2 | Cloudflare Pages or Workers static assets for the web app | Decide in Sprint 0 after reading current Cloudflare docs |
| O4 | Parallel steps (Q11) in MVP? | No. MVP engine = sequential + conditional + rework loops. Parallel is stretch |
| O5 | Custom branch (FR-27) and Hold/Cancel (FR-10) in MVP? | No (High priority, after MVP). `isCustom` is stored but the CUSTOM_REVIEW step is not built yet |
| O6 | Evidence upload (FR-14) in MVP? | Gate check implemented, upload UI in Sprint 4 only if time remains |
| O7 | QC threshold numbers (Q19) | Configurable per Style; seed placeholder values, marked as demo data |

## Sprint board

| Sprint | Goal | Status |
|---|---|---|
| S0 | Scaffold + deploy pipeline (walking skeleton) | in progress (T0.2–T0.6 done, CI required; pending: `denimflow-prod`, T0.7 deploy, CODEOWNERS) |
| S1 | Auth + RBAC + master data | merged via #26, unreviewed; hotfix #28 |
| S2 | Workflow engine core + designer MVP | merged via #26, unreviewed; seed fix #35 |
| S3 | Order create / Confirm / snapshot | merged via #26, unreviewed |
| S4 | Worklist, quantities, Gates | T4.1 merged (#26); T4.2 rebuilt in a new PR; T4.3–T4.5 to rebuild (#29–#31) |
| S5 | QC, rework, QC Profile, dashboard, handover, polish | T5.1–T5.3 in PRs #32–#34 (stacked); T5.5, T5.6 free |

## Known risks

- Render free API sleeps after 15 min idle (about 1 min cold start). Ping `/health` before demos.
- Supabase free projects pause after a week of inactivity. Keep migrations + seed in the repo to rebuild.
- Free-tier limits change. Re-check provider pricing pages before the final demo.
- Code merged via #26 was never reviewed; known debt: ON DELETE CASCADE on order history (BR-12/R-03), hand-written role checks, null audit actor (TASK_BOARD D1–D4).
- One contributor holds most tasks while three have none; rebalance via TASK_BOARD (course grading looks at contributions).
- `tsup` (package build) is no longer actively maintained. Switch to `tsdown` once it reaches 1.0 (config is ~5 lines per package).
- TypeScript is pinned to 6.0.x because `typescript-eslint` 8.x supports `typescript <6.1`. Upgrade to 7 when typescript-eslint supports it.
