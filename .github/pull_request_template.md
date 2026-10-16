## What and why

<!-- One or two sentences. Link the task file, e.g. .agents/tasks/S1-auth-rbac-master-data.md (T1.2) -->

## Related

- Task: 
- FR / BR touched: 

## Changes

- 

## How to test

<!-- Commands or click path. Screenshots for UI changes. -->

## Checklist

- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass locally
- [ ] New logic has tests (business rules named by ID, e.g. `BR-08 ...`)
- [ ] Schema change: migration included, RLS enabled, `DATABASE_DESIGN.md` updated (EN + VI)
- [ ] Business behavior change: `BUSINESS_RECONCILIATION.md` updated (EN + VI)
- [ ] No secrets, `.env` files or real customer data committed
- [ ] `PROJECT_STATE.md` updated if status or decisions changed
- [ ] PR is small and focused (one task)
