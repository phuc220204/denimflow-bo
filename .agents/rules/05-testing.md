# 05 — Testing

Principle: business rules are the product. Test them first and name tests after them.

## Pyramid

| Level | Tool | Scope | Target |
|---|---|---|---|
| Engine unit | Vitest | `packages/engine`: every BR the engine owns, state transitions, gate chain, condition evaluation, BR-01 template validation | High coverage (aim ≥ 80% lines); fast, no I/O |
| API integration | Vitest + Supertest (Nest 12 `ts-esm` template, ADR 0004) | One happy path and the main rule violations per endpoint, against a real Postgres | Per task |
| Web component | Vitest + Testing Library + MSW | Forms and critical screens (designer, worklist, QC) | Key flows only |
| E2E smoke | Playwright | The demo scenario in `PRD.md` §6 | Sprint 5 |

## Conventions

- Test title starts with the rule/FR id: `BR-08: rejects qtyIn above previous step's good quantity`.
- Arrange–Act–Assert. One behavior per test. No shared mutable state between tests.
- Deterministic: inject clock and id generator; no real time, no randomness.
- A bug fix starts with a failing test that reproduces it.
- Do not mock what you own (engine, repositories) in integration tests; mock only the outside world (Supabase Storage, Supabase Auth admin calls).

## Database in tests

- CI uses a GitHub Actions **Postgres service container** and runs `prisma migrate deploy` + seed. Tests never touch the Supabase dev/prod projects.
- Each integration test file starts a transaction or truncates its own tables; tests must be runnable in any order.
- Concurrency test (BR-08): two parallel quantity entries on the same step must not exceed the previous step's good quantity. This test is mandatory in Sprint 4.

## Before a PR

```
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

If a test is flaky, fix or delete it in the same PR; do not retry-until-green.
