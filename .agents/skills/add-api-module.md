# Skill: add or extend an API module (NestJS)

Use when a task adds an endpoint or a new module under `apps/api/src/modules/`.

## Steps

1. **Read first:** the FR and BR ids in the task; `rules/01-architecture-boundaries.md`; the tables involved in `DATABASE_DESIGN.md`.
2. **Contract first:** add or extend the Zod schemas and enums in `packages/shared` (request, response, enums). Export types. Open this as the first commit; the web side depends on it.
3. **Module skeleton** (if new): `<name>.module.ts`, `<name>.controller.ts`, `<name>.service.ts`, `<name>.repository.ts`, `dto/`. Export only the service from the module.
4. **Repository:** Prisma queries only, no rules. Accept an optional transaction client (`tx`) so services can compose.
5. **Service (use-case):**
   - Authorize beyond roles when needed (BR-11, station ownership).
   - Call `packages/engine` for decisions (gates, transitions, validation). Do not re-implement rules in the service.
   - Wrap multi-row writes in `prisma.$transaction(async (tx) => { ... })` and call `auditService.record(tx, {...})` inside it (BR-16).
6. **Controller:** `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(...)`; parse input with the shared Zod schema through a validation pipe; return the shared response type. No logic.
7. **Errors:** throw `BusinessRuleViolation('BR-xx', message)`; do not return raw strings.
8. **Tests:** service-level integration test (happy path + each BR violation) with the Postgres service container; engine rules are tested in the engine package, not here.
9. **Docs:** update `BUSINESS_RECONCILIATION.md` §2/§5 status; add the endpoint to the task file's checklist.

## Checklist

- [ ] Shared schema added/updated
- [ ] Guards and roles correct (negative test: wrong role gets 403)
- [ ] Transaction + AuditLog for every write
- [ ] No Prisma in controller; no cross-module repository access
- [ ] Tests named with BR/FR ids
