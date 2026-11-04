# Demo rehearsal

1. Merge #33, #34, #37 and #30 after independent review and CI. Update #41 from main. Full E2E must pass on its actual branch before merge.
2. Start disposable test Postgres (`pnpm --filter @denimflow/api db:test:up`). For local E2E create database `denimflow_e2e` in that test container, or set `TEST_DATABASE_URL` to loopback `denimflow_test`. No Supabase database is accepted by the E2E host.
3. `pnpm --filter @denimflow/web exec playwright install chromium` then `pnpm --filter @denimflow/web test:e2e`. `test:e2e:smoke` checks browser login/dashboard/RBAC independently of unmerged features. CI currently runs that smoke slice; switch its final step to `test:e2e` once the dependencies are merged.
4. Auth and Storage are substituted only in `scripts/e2e-server.mjs`; production never loads this host. It binds loopback and refuses remote databases. The hard-coded fixture password does not authenticate against Supabase or the production API.
5. Configure the production Environment secrets. Reseed via Actions → Migrate → seed=true (also dispatched by `pnpm --filter @denimflow/api demo:reseed`). This resets the seven demo accounts to the configured seed password; keep that password private. Check the production approval and workflow result.
6. Before demo, open API `/health` and wait for `db=up`, then open the deployed web, log in, and rehearse PRD §6. Measure the first request after an idle period; an ordinary warm response is not a cold-start measurement.
7. Demonstrate FULL_PROCESS (failed QC, FINISHING rework, PASS, handover) and SKIP_CLEAN_WASH (acknowledgement required, 4%/level 2 accepted). Check actual packing quantities, dashboard WIP and audit trail.

New dev dependency: `@playwright/test` 1.64.1, Apache-2.0, maintained by Microsoft; npm metadata last updated 2026-11-04. It provides a real browser runner; Vitest component tests cannot verify SPA navigation or live API connections. No production dependency is added.
