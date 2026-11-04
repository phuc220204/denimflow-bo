# PROJECT_STATE

Short, current-state file. Keep it under ~5 KB: move history to `docs/adr/` or the PR log.
Last updated: 2026-11-05

## Phase

Sprint 0 deployment is pending. Supabase `denimflow-prod` was created (owner confirmed); GitHub Environment `production` exists but secrets and deployment verification are pending. Do not mark S0 done yet.

Merged: S1–S3 and T4.1 (#26, still need module review), T4.2 (#43), T4.3 (#44), T4.5 (#45), QC PASS (#46), audit (#47), dashboard (#48), deploy preparation (#40), auth HTTP tests (#49).

**Current PR #30 (T4.4):** Private signed uploads with MIME/size verification, step/operator-bound paths and a completion evidence gate. Conflict repair keeps current `main`; legacy unpublished migrations and replaced execution/QC implementations are removed. Latest CI must pass. Owner authorized one-off admin merges; protect-main remains active. #33/#34/#37 merged.

**Next:** finish #33/#34/#37/#30/#41, configure production secrets, migrate/seed prod, deploy Render + Cloudflare and measure cold start. D1–D4 remain in `docs/TASK_BOARD.md`.

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
| O6 | Evidence upload (FR-14) in MVP? | Gate check implemented, upload UI in Sprint 4 only if time remains |
| O7 | QC threshold numbers (Q19) | Configurable per Style; seed placeholder values, marked as demo data |

## Sprint board

| Sprint | Goal | Status |
|---|---|---|
| S0 | Scaffold + deploy pipeline (walking skeleton) | in progress (T0.2–T0.6 done, CI required; prod created; CODEOWNERS merged; pending: prod configuration and T0.7 deploy) |
| S1 | Auth + RBAC + master data | merged via #26, unreviewed; hotfix #28 |
| S2 | Workflow engine core + designer MVP | merged via #26, unreviewed; seed fix #35 |
| S3 | Order create / Confirm / snapshot | merged via #26, unreviewed |
| S4 | Worklist, quantities, Gates | T4.1 (#26), T4.2 (#43), T4.3 (#44), T4.5 (#45) merged; T4.4 optional, last |
| S5 | QC, rework, QC Profile, dashboard, handover, polish | T5.1 (#46), T5.5 (#48), T5.6 (#47) merged; T5.2–T5.4 and T5.7 in conflict repair/review |

## Known risks

- Render free API sleeps after 15 min idle (about 1 min cold start). Ping `/health` before demos.
- Supabase free projects pause after a week of inactivity. Keep migrations + seed in the repo to rebuild.
- Free-tier limits change. Re-check provider pricing pages before the final demo.
- Code merged via #26 was never reviewed; known debt: ON DELETE CASCADE on order history (BR-12/R-03), hand-written role checks, null audit actor (TASK_BOARD D1–D4).
- One contributor holds most tasks while three have none; rebalance via TASK_BOARD (course grading looks at contributions).
- `tsup` (package build) is no longer actively maintained. Switch to `tsdown` once it reaches 1.0 (config is ~5 lines per package).
- TypeScript is pinned to 6.0.x because `typescript-eslint` 8.x supports `typescript <6.1`. Upgrade to 7 when typescript-eslint supports it.
