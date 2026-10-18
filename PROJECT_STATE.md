# PROJECT_STATE

Short, current-state file. Keep it under ~5 KB: move history to `docs/adr/` or the PR log.
Last updated: 2026-10-18

## Phase

**Sprint 2 in progress** (`.agents/tasks/S2-workflow-engine-and-designer.md`).
Done: T1.1..T1.5 (Sprint 1); T2.2 (Condition evaluator Strategy + AST); T2.3 (Template validation BR-01); T2.4 (Workflow persistence + publish API + Jean Standard seed); T2.5 (Designer UI MVP with React Flow).
**Next:** Sprint 2 exit review / merge PRs; Sprint 3 (`.agents/tasks/S3-order-confirm-snapshot.md`).
Team: tasks are picked in `docs/TASK_BOARD.md`; onboarding guide `docs/<lang>/GETTING_STARTED.md`.

## Decisions (settled)

| # | Decision |
|---|---|
| D1 | Stack option B: NestJS + Prisma (API), React + Vite + TS + Tailwind (web), Supabase (Postgres/Auth/Storage), pnpm monorepo |
| D2 | Architecture: Modular Monolith + Clean Architecture; `packages/engine` is pure TypeScript |
| D3 | Hosting at cost 0: Cloudflare for web, Render free for API, Supabase free for DB/Auth/Storage. Vercel not used (Hobby plan has no team collaboration and is non-commercial only) |
| D4 | Repo is **public**; `main` protected by a ruleset (PR required, 1 approval, squash only, linear history) |
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
| S0 | Scaffold + deploy pipeline (walking skeleton) | in progress (T0.2, T0.3, T0.4 part A, T0.6 done; T0.1 dev done, prod pending) |
| S1 | Auth + RBAC + master data | done |
| S2 | Workflow engine core + designer MVP | in progress (T2.2..T2.5 implemented) |
| S3 | Order create / Confirm / snapshot | not started |
| S4 | Worklist, quantities, Gates | not started |
| S5 | QC, rework, QC Profile, dashboard, handover, polish | not started |

## Known risks

- Render free API sleeps after 15 min idle (about 1 min cold start). Ping `/health` before demos.
- Supabase free projects pause after a week of inactivity. Keep migrations + seed in the repo to rebuild.
- Free-tier limits change. Re-check provider pricing pages before the final demo.
- `tsup` (package build) is no longer actively maintained. Switch to `tsdown` once it reaches 1.0 (config is ~5 lines per package).
- TypeScript is pinned to 6.0.x because `typescript-eslint` 8.x supports `typescript <6.1`. Upgrade to 7 when typescript-eslint supports it.
