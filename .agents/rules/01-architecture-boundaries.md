# 01 — Architecture boundaries

Style: **Modular Monolith + Clean Architecture**. One deployable API, strict internal module borders so a module can be extracted later.

## Dependency direction

```
apps/web ──► packages/shared ◄── apps/api ──► packages/engine
                                    │
                                    └──► Prisma/Supabase (infrastructure only)
```

- `packages/engine` depends on nothing in this repo (it may depend on `packages/shared` types only if they stay pure).
- `packages/shared` depends only on `zod`.
- `apps/web` never imports from `apps/api`. The contract is `packages/shared` (+ OpenAPI if generated).

## packages/engine (pure TypeScript)

Why: the workflow engine is the hardest and most examinable part. Pure code is unit-testable in milliseconds without a database, and the web app can reuse BR-01 validation for template previews.

- Forbidden imports: `@nestjs/*`, `@prisma/client`, `@supabase/*`, `fs`, `http`, anything that does I/O.
- Do not call `Date.now()`, `new Date()` (without argument) or `Math.random()` inside engine logic. Receive a `clock` and `idGenerator` through parameters so tests are deterministic.
- Input and output are plain data. The engine returns **decisions and domain events**; the API layer persists them.
- Patterns live here:
  - **State** — `ProductionOrder` and `StepInstance` transitions (tables in `BUSINESS_RECONCILIATION.md` §4).
  - **Chain of Responsibility** — Gate checks before a step opens (BR-14, BR-06, BR-08, BR-15).
  - **Strategy** — Condition evaluation, BOM calculation, QC threshold selection by QC Profile.
  - **Factory Method** — `StepHandler` per `stepType`.
  - **Observer** — events `StepCompleted`, `StepBlocked`, `QcFailed`.
- Conditions are a small JSON AST evaluated by a Strategy. **Never** use `eval`, `Function()` or a string expression parser from the network.

## apps/api layering

```
modules/<name>/
  <name>.controller.ts   HTTP only: parse DTO (Zod), call service, map result
  <name>.service.ts      use-cases: orchestrate engine + repository + transaction
  <name>.repository.ts   Prisma queries only
  dto/                   re-export shared Zod schemas
```

- Controllers never touch Prisma. Repositories contain no business rules.
- A module reads another module's data only through that module's **exported service**, never its repository or tables directly. Why: keeps extraction possible and the dependency graph explicit.
- Modules: `catalog`, `workflow`, `order`, `execution`, `quality`, `inventory`, `audit`. `audit` is written to by others through an `AuditService.record(tx, ...)` that **receives the open transaction**.
- Use-cases that write more than one row run inside one `prisma.$transaction` (interactive form) and write the `AuditLog` row in the same transaction (BR-16).
- Row locking for quantity conservation (BR-08): inside the transaction, lock the `step_instances` row with `SELECT ... FOR UPDATE` (raw query), re-read quantities, then validate and write. See `DATABASE_DESIGN.md` §7.
- Authorization: `JwtAuthGuard` → `RolesGuard` (`@Roles(...)`) → service-level checks for rules a role list cannot express (BR-11 separation of duties, station ownership).
- Errors: throw domain errors (`BusinessRuleViolation` with the BR id); an exception filter maps them to HTTP 409/422 with a stable `code`.

## apps/web layering

- `features/<area>/` owns its pages, components, hooks and API calls. A feature does not import from another feature; shared UI goes to `components/`, shared helpers to `lib/`.
- Server state: TanStack Query. Local UI state: React state. No global store unless a task asks for it.
- Forms: React Hook Form + the Zod schema from `packages/shared`.
- The web may pre-validate for UX, but the API is authoritative. Never implement a business rule only in the web.
