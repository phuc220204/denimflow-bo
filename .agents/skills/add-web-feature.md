# Skill: add a web feature (React)

Use when a task adds a screen or flow under `apps/web/src/features/`.

## Steps

1. Read the FR acceptance criteria in `PRD.md` §5 and the roles allowed to see it.
2. Make sure the API contract exists in `packages/shared` (Zod schemas, types). If not, add it first (small PR) or mock it.
3. Create `features/<area>/`:
   ```
   pages/        route-level components
   components/   feature-only components
   hooks/        TanStack Query hooks (useXxxQuery, useXxxMutation)
   api.ts        typed calls using the shared types
   ```
4. Add a mock handler (MSW) in `src/mocks/handlers/<area>.ts` so the screen works before the API is finished.
5. Forms: React Hook Form + `zodResolver(sharedSchema)`. Show field-level and server (`BusinessRuleViolation`) errors, including the BR id in a developer-visible detail.
6. Guard routes by role (`<RequireRole roles={[...]}>`). Hiding a button is UX only; the API enforces.
7. Every list/table: loading, empty and error states. Mutations invalidate the right query keys.
8. Strings through the i18n dictionary. Use shadcn/ui components.
9. Tests: Testing Library for the critical interaction (submit, validation error, role guard).
10. Screenshots in the PR description.

## Checklist

- [ ] No business rule implemented only in the web
- [ ] No import from another feature folder
- [ ] Loading / empty / error states present
- [ ] Role guard on the route
