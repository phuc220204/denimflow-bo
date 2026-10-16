# AGENTS.md — DenimFlow BO

Working rules for every AI coding agent (Claude Code, Codex, Cursor, ...) in this repository.
Humans: read `README.md`. This file is the single source of truth for agent behavior; `CLAUDE.md` only imports it.

## 1. What this project is

**DenimFlow BO** is the internal Back Office of a jeans subcontracting workshop. It manages a subcontracting order from fabric/color selection, cutting and sewing, through dyeing, washing, finishing and QC, to handover. Its core feature is a **Dynamic Workflow**: the chain of operations is stored as data (versioned templates), so the process can change without redeploying.

- 7 roles, 19 business rules (BR-01..BR-19), 29 functional requirements (FR-01..FR-29), 14 of them MVP.
- One product type (jeans), one stage (subcontracting BO). No payments, no customer-facing app.
- This is a university project (Software Architecture and Design). Architecture quality and traceability matter as much as features.

## 2. Read before you code (in this order)

1. `PROJECT_STATE.md` — where we are, open decisions. Keep it short.
2. `.agents/tasks/` — the task file of the current sprint. Work on one task at a time.
3. `docs/en/PRD.md` — scope, roles, MVP acceptance criteria.
4. `docs/en/BUSINESS_RECONCILIATION.md` — BR-01..19, workflow, state machines, FR traceability. **Business truth lives here.**
5. `docs/en/DATABASE_DESIGN.md` — schema, constraints, transactions.
6. `HELP.md` — official documentation links. Check the docs of the **installed** version before using an API; do not rely on memory.
7. `.agents/rules/` and `.agents/skills/` — conventions and step-by-step procedures.

If sources conflict, stop and ask the owner. Do not silently pick one. Record the resolution in `BUSINESS_RECONCILIATION.md` §7.

## 3. Tech stack (decided, option B)

| Layer | Choice |
|---|---|
| Monorepo | pnpm workspaces |
| Web | React + Vite + TypeScript + Tailwind + shadcn/ui, TanStack Query, React Router, React Hook Form + Zod, React Flow (workflow graph), Recharts |
| API | NestJS + TypeScript + Prisma (Modular Monolith, Clean Architecture) |
| Workflow engine | `packages/engine` — pure TypeScript, no framework or DB imports |
| Shared contract | `packages/shared` — Zod schemas, enums, DTO types |
| Data/Auth/Files | Supabase (Postgres, Auth, Storage) |
| Hosting (cost = 0) | Web: Cloudflare (Pages or Workers static assets, decided in Sprint 0). API: Render free web service. DB: Supabase free |
| CI | GitHub Actions |

Package names: `@denimflow/web`, `@denimflow/api`, `@denimflow/engine`, `@denimflow/shared`.

## 4. Repository layout

```
apps/web        React app          (features/ folders, one per business area)
apps/api        NestJS app         (modules/: catalog, workflow, order, execution, quality, inventory, audit)
packages/engine Workflow engine    (State, Chain of Responsibility, Strategy, Factory, Observer)
packages/shared Zod + enums + DTOs
docs/en, docs/vi  Bilingual docs   (en = agent-facing canonical, vi = mirror)
docs/adr        Architecture decision records
.agents         rules/, skills/, tasks/
```

`apps/` and `packages/` are created in Sprint 0 (`.agents/tasks/S0-scaffold-and-pipeline.md`). Until then they do not exist.

## 5. Commands (target; available after Sprint 0)

```
pnpm install --frozen-lockfile
pnpm dev                 # web + api in parallel
pnpm lint && pnpm typecheck && pnpm test && pnpm build   # must pass before every PR
pnpm --filter @denimflow/api db:migrate:dev   # create/apply a migration locally
pnpm --filter @denimflow/api db:seed
```

## 6. Hard rules

1. **Never push to `main`.** Work on a branch, open a PR. The repo ruleset blocks direct pushes. Details: `.agents/rules/03-git-and-pr-workflow.md`.
2. **No secrets in the repo.** Use `.env` (git-ignored) and `.env.example` (placeholders only). The Supabase service role key exists only in the API environment, never in `apps/web`. Details: `.agents/rules/04-security-and-secrets.md`.
3. **Engine purity.** `packages/engine` must not import NestJS, Prisma, Supabase, `fs`, or read the clock/randomness directly. Details: `.agents/rules/01-architecture-boundaries.md`.
4. **Business rules are code and are tested.** Every BR implemented gets a test named with its ID (`BR-08 rejects qtyIn above previous good qty`). Update the status in `BUSINESS_RECONCILIATION.md`.
5. **Atomic use-cases.** Any use-case that changes more than one row (Confirm order, quantity entry, QC decision, workflow change) runs in one DB transaction that also writes the `AuditLog` (BR-16).
6. **Every new table enables RLS with no policies** (deny-all for the public REST API). The API connects with a privileged role and does real authorization.
7. **Do not trust the client.** Role comes from the `profiles` table, not from user-editable JWT metadata. Re-validate everything the web sent.
8. **Naming:** camelCase for variables/functions, PascalCase for types/classes, UPPER_SNAKE for enum values, kebab-case file names. DB columns are snake_case via Prisma `@map`.
9. **Do not add a dependency** without stating why, its license and maintenance status in the PR.
10. **Do not invent business rules.** If the docs are silent, ask the owner and write the answer down.

## 7. Working with the owner (Tran Hoang Phuc)

- Reply in **Vietnamese**; keep technical terms in English.
- **Explain, do not just output code**: why this approach, short definitions of new concepts (middleware, transaction, indexing, ...), root cause when fixing a bug, trade-offs when there are several options.
- Break big tasks into small steps. **Ask before writing a lot of code** if the request is unclear.
- When you edit files, say what changed and why.
- Code comments are in English and only for non-obvious logic (cite the BR id, e.g. `// BR-08`).
- The owner may be vibe-coding: do not assume deep TypeScript knowledge. Keep code readable over clever.

## 8. Definition of done (every task)

- [ ] Acceptance criteria of the task file are met.
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass; new logic has tests.
- [ ] Schema change ⇒ Prisma migration + RLS + `DATABASE_DESIGN.md` updated (EN and VI).
- [ ] Business behavior change ⇒ `BUSINESS_RECONCILIATION.md` updated (status, log).
- [ ] No secrets, no `console.log` debugging, no commented-out code.
- [ ] `PROJECT_STATE.md` updated (done / next / open decisions), kept under ~5 KB.
- [ ] PR description filled using `.github/pull_request_template.md`.

## 9. Docs language policy

- Agent-facing files (`AGENTS.md`, `HELP.md`, `.agents/`) are English only.
- `docs/en/*` is canonical; `docs/vi/*` mirrors it. When you change one, change the other, or add `<!-- sync: pending -->` at the top of the stale one. See `.agents/rules/06-docs-and-bilingual-sync.md`.
