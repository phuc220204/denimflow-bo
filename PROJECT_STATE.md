# PROJECT_STATE

Short, current-state file. Keep it under ~5 KB: move history to `docs/adr/` or the PR log.
Last updated: 2026-11-05

## Phase

MVP feature code is integrated; production deployment and demo rehearsal are pending. Sprint 0 is NOT done: Supabase prod exists and GitHub Environment `production` exists, but secrets, production migration/seed, hosting, public login/health and cold-start evidence remain to verify.

Merged: S1–S3/T4.1 (#26, module review pending), T4.2 (#43), T4.3 (#44), T4.5 (#45), QC PASS (#46), audit (#47), dashboard (#48), deploy prep (#40), auth HTTP tests (#49), rework (#33), defects (#34), handover (#37), evidence (#30).

**Current #41 (T5.7):** real Chromium browser smoke and full FULL_PROCESS / SKIP_CLEAN_WASH scenarios now run against this branch's actual integrated API, web and disposable Postgres. CI requires the full suite, with external Auth/Storage substituted only in the loopback test host. Deployed-system acceptance is still pending.

**Next:** complete #41 checks/merge, configure production secrets, migrate/seed via GitHub Environment, deploy Render/Cloudflare and rehearse PRD §6. Owner authorized one-off admin squash merges for #33/#34/#37/#30/#41 after latest-head CI success (2026-11-05); protect-main stays active. Independent module review remains debt (D4), not a claimed approval. D1–D4 remain open.

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
| D9 | Web on **Cloudflare Workers static assets** via Workers Builds (O2 resolved, ADR 0001); API on Render free; prod migrations via the `migrate.yml` workflow |

## Open decisions (need the owner)

| # | Question | Default if no answer |
|---|---|---|
| O1 | Deadline and demo date | Plan 6 sprints (S0..S5), compress if needed |
| O4 | Parallel steps (Q11) in MVP? | No. MVP engine = sequential + conditional + rework loops. Parallel is stretch |
| O5 | Custom branch (FR-27) and Hold/Cancel (FR-10) in MVP? | No (High priority, after MVP). `isCustom` is stored but the CUSTOM_REVIEW step is not built yet |
| O7 | QC threshold numbers (Q19) | Configurable per Style; seed placeholder values, marked as demo data |

## Sprint board

| Sprint | Goal | Status |
|---|---|---|
| S0 | Scaffold + deploy pipeline (walking skeleton) | in progress (T0.2–T0.6 done, CI required; prod and CODEOWNERS ready; configuration and deploy pending) |
| S1 | Auth + RBAC + master data | merged via #26, unreviewed; hotfix #28 |
| S2 | Workflow engine core + designer MVP | merged via #26, unreviewed; seed fix #35 |
| S3 | Order create / Confirm / snapshot | merged via #26, unreviewed |
| S4 | Worklist, quantities, Gates | T4.1 (#26), T4.2 (#43), T4.3 (#44), T4.5 (#45), T4.4 (#30) merged |
| S5 | QC, rework, dashboard, handover, demo | T5.1–T5.6 merged; T5.7 automated E2E in #41; production rehearsal pending |

## Known risks

- Render free API sleeps after 15 min idle (about 1 min cold start). Ping `/health` before demos.
- Supabase free projects pause after a week of inactivity. Keep migrations + seed in the repo to rebuild.
- Free-tier limits change. Re-check provider pricing pages before the final demo.
- Code merged via #26 was never reviewed; known debt: ON DELETE CASCADE on order history (BR-12/R-03), hand-written role checks, null audit actor (TASK_BOARD D1–D4).
- One contributor holds most tasks while three have none; rebalance via TASK_BOARD (course grading looks at contributions).
- `tsup` (package build) is no longer actively maintained. Switch to `tsdown` once it reaches 1.0 (config is ~5 lines per package).
- TypeScript is pinned to 6.0.x because `typescript-eslint` 8.x supports `typescript <6.1`. Upgrade to 7 when typescript-eslint supports it.
