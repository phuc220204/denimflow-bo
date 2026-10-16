# 02 — Coding conventions

Priority: **readable and boring over clever.**

## Naming

| Thing | Style | Example |
|---|---|---|
| Variables, functions, properties | camelCase | `qtyGood`, `confirmOrder()` |
| Types, classes, React components | PascalCase | `StepInstance`, `WorkflowDesigner` |
| Enum values, constants | UPPER_SNAKE_CASE | `IN_PRODUCTION`, `MAX_REWORK_LOOPS` |
| File and folder names | kebab-case | `step-instance.service.ts` |
| DB tables / columns | snake_case via Prisma `@@map` / `@map` | `step_instances.qty_good` |
| Business codes | Keep the document's code | `ORDER_CONFIRM`, `FULL_PROCESS`, `BR-08` |

Names are English. Prefer full words (`quantityGood` is fine, `qG` is not).

## TypeScript

- `strict` on. No `any`; use `unknown` and narrow, or a Zod schema.
- Validate at the boundaries (HTTP body, env, JSON columns) with Zod. Inside the code, trust the types.
- Prefer small pure functions. One exported concept per file when it is a class.
- Money is out of scope. Quantities are integers (pieces); fabric lengths are decimals in meters (`Decimal` in Prisma, string in JSON).
- Dates are UTC ISO-8601 strings on the wire; `timestamptz` in the DB.

## Comments

- Comment *why*, not *what*, and only where logic is non-obvious. Cite rules: `// BR-08: qtyIn must not exceed previous step's good quantity`.
- No commented-out code. No TODO without a task id (`// TODO(T3.4): ...`).

## Errors and logging

- Never swallow errors. Either handle with a decision or let the exception filter map it.
- Do not log secrets, tokens, or full request bodies. Log ids.

## Configuration

- Read environment variables **once**, in a config module validated by Zod at startup. Fail fast with a clear message if a variable is missing.
- No hardcoded URLs, keys, bucket names or limits: constants go to a `constants.ts`, deploy-specific values go to `.env`.

## UI

- Use shadcn/ui components and Tailwind utility classes. No custom CSS files unless unavoidable.
- Every list/table has loading, empty and error states.
- User-visible strings go through the dictionary in `apps/web/src/lib/i18n` (English now, Vietnamese later). Do not scatter literals.

## Formatting

- Prettier + ESLint configs live at the repo root and are the authority. Do not reformat unrelated files in a PR.
- Line endings are LF (`.gitattributes`).
