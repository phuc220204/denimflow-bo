# DenimFlow BO

DenimFlow BO is the internal Back Office of a jeans subcontracting workshop. It manages a subcontracting order from fabric and color selection, cutting and sewing, through dyeing, washing, finishing and QC, to packing and handover. Its core feature is a configurable **Dynamic Workflow**: the chain of operations is stored as versioned data, so the process can change without redeploying the system.

Built with pnpm workspaces, React (Vite), NestJS, Prisma and Supabase. Hosting cost is zero (free tiers only).

> **Status:** early stage. The repository currently contains documentation, agent rules and the sprint backlog. The applications and packages shown below are created in Sprint 0 (`.agents/tasks/S0-scaffold-and-pipeline.md`); entries marked **(S0)** do not exist yet. Current progress: [`PROJECT_STATE.md`](PROJECT_STATE.md).

---

## System Architecture

The project is a monorepo with a web application, an API, a pure-TypeScript workflow engine and a shared contract package.

```text
denimflow-bo/
├── apps/
│   ├── web/                    # (S0) React + Vite web application (all 7 roles)
│   └── api/                    # (S0) NestJS API (Modular Monolith) + Prisma
├── packages/
│   ├── engine/                 # (S0) Pure TypeScript workflow engine (no framework or DB imports)
│   └── shared/                 # (S0) Zod schemas, enums and DTO types shared by web and api
├── docs/
│   ├── en/                     # Canonical documentation (PRD, DEVELOPMENT_SETUP, DATABASE_DESIGN, BUSINESS_RECONCILIATION)
│   ├── vi/                     # Vietnamese mirror of docs/en
│   ├── adr/                    # Architecture decision records
│   ├── design/                 # UI design system (DESIGN.md) and Stitch/Antigravity prompts
│   └── reference/              # Business source documents (Proposal V2.0, Appendix)
├── .agents/                    # Rules, skills and sprint tasks for AI coding agents
├── .github/                    # Pull request template; workflows and CODEOWNERS added in Sprint 0
├── AGENTS.md                   # Working rules for AI agents (CLAUDE.md imports it)
├── PROJECT_STATE.md            # Current status and open decisions
├── HELP.md                     # Official documentation links
├── Tutorial_denimflow-bo.md    # Team workflow guide (Vietnamese)
├── package.json                # (S0) Root workspace scripts
├── pnpm-workspace.yaml         # (S0) Workspace configuration
└── tsconfig.base.json          # (S0) Shared TypeScript configuration
```

### Runtime architecture

```text
Browser ─► Cloudflare (static web) ─► Render (NestJS API) ─► Supabase Postgres
   │                                        └──────────────► Supabase Storage (private bucket)
   └──────────────► Supabase Auth (login, JWT)  ◄── API verifies the JWT
```

- The web app talks to Supabase **only for Auth** (login and session). All data goes through the API.
- The API connects to Postgres with Prisma and does all authorization. Row Level Security is enabled with no policies, so the auto-generated Supabase REST API exposes nothing.

---

## Roles and Capabilities

DenimFlow BO is a web application. Every role uses the same app and sees a menu limited to its permissions (RBAC).

| Role | Primary capabilities |
| :--- | :--- |
| **Admin** | Users and roles, catalogs (Style, Fabric, Color, Fabric–Color Matrix), AuditLog |
| **Process Engineer** | Design and publish workflow templates, configure QC Profile thresholds |
| **Production Planner** | Create and confirm production orders, fabric–color selection, BOM, packing and handover |
| **Warehouse Keeper** | Fabric lots, material allocation, Material Requests |
| **Station Operator** | Station worklist: start/complete steps, enter good/defect quantities |
| **QC Inspector** | Inspections against the order's QC Profile, Pass/Rework/Reject, defects |
| **Manager** | Read-only WIP dashboard and reports |

Separation of duties (BR-11): whoever performed a step cannot approve its QC, and the Process Engineer cannot confirm completion of production steps.

---

## Folder Roles and Responsibilities

### `apps/web` (Web application)

- **Framework**: React with Vite, TypeScript, Tailwind CSS.
- **Architecture**: feature folders under `src/features/`, one per business area:
  - `auth/`: login, session, role-based route guards.
  - `catalog/`: Style, FabricType, ColorOption, Fabric–Color Matrix, QC Profile configuration.
  - `workflow-designer/`: template editor (step list, transitions, conditions), read-only React Flow graph, validate and publish.
  - `orders/`: create/edit/confirm orders, fabric–color selection, BOM, customer acknowledgement.
  - `inventory/`: fabric lots, allocation, Material Requests.
  - `station-worklist/`: operator worklist, start/complete, quantity entry.
  - `quality/`: QC inspection, rework routing, defects.
  - `dashboard/`: WIP and defect charts, AuditLog viewer.
- **Server state**: TanStack Query. **Forms**: React Hook Form with Zod schemas from `packages/shared`. **UI**: shadcn/ui components, Recharts for charts.
- **Mocking**: MSW handlers in `src/mocks/` let a screen be built before its endpoint exists.

### `apps/api` (API)

- **Framework**: NestJS, TypeScript, Prisma, Postgres (Supabase).
- **Architecture**: Modular Monolith with Clean Architecture. Each module has `controller → service (use-case) → repository`:
  - `catalog`: master data and the Fabric–Color Matrix.
  - `workflow`: templates, versions, publish and validation.
  - `order`: production orders, Confirm and snapshot, BOM.
  - `execution`: Workflow Instances, worklist, quantities, Gates.
  - `quality`: inspections, QC Profiles, rework routing.
  - `inventory`: fabric lots, allocation, Material Requests.
  - `audit`: append-only AuditLog written inside the caller's transaction.
- **Cross-cutting**: JWT guard, roles guard, Zod validation pipe, exception filter that maps `BusinessRuleViolation` to HTTP errors.
- **Transactions**: every multi-row use-case (Confirm, quantity entry, QC decision) runs in one database transaction together with its audit row.

### `packages/engine` (`@denimflow/engine`)

- **Role**: the workflow engine as plain TypeScript. It has no dependency on NestJS, Prisma or Supabase, so it is unit-tested in milliseconds and its template validation (BR-01) can be reused by the web app.
- **Contents and patterns**:
  - **State**: `ProductionOrder` and `StepInstance` transitions.
  - **Chain of Responsibility**: Gate checks before a step opens.
  - **Strategy**: condition evaluation, BOM calculation, QC thresholds by QC Profile.
  - **Factory Method**: step handlers per `stepType`.
  - **Observer**: domain events such as `StepCompleted` and `QcFailed`.

### `packages/shared` (`@denimflow/shared`)

- **Role**: the contract between web and API. Imported by both.
- **Contents**: Zod schemas (requests, responses, the condition AST), enums mirroring the database enums, DTO types, small utilities.

---

## Tech Stack

- **Monorepo**: pnpm workspaces (Turborepo can be added later if CI time grows)
- **Web**: React, Vite, TypeScript 5+, Tailwind CSS, shadcn/ui, React Flow, Recharts
- **API**: NestJS, Prisma, Zod
- **Data, Auth, Files**: Supabase (PostgreSQL, Auth, Storage)
- **State and forms (web)**: TanStack Query, React Router, React Hook Form + Zod
- **Testing**: Vitest (engine, web, API), Supertest (API HTTP tests), Testing Library, MSW, Playwright (E2E)
- **Code quality**: ESLint, Prettier, Husky, lint-staged
- **CI/CD and hosting**: GitHub Actions; Cloudflare (web), Render free web service (API), Supabase free (database)

---

## Getting Started

### Prerequisites

- **Node.js**: current LTS (the exact version is in `.nvmrc`)
- **pnpm**: the version pinned in `package.json` (`packageManager`); install with `corepack enable` or `npm i -g pnpm`
- **Git**

```bash
node -v
pnpm -v
```

### Installation

```bash
git clone https://github.com/<owner>/denimflow-bo.git
cd denimflow-bo
pnpm install
```

> `pnpm install` runs the `prepare` script, which installs the Git hooks (Husky).

### Environment Configuration

Copy the example files and fill in values from your **development** Supabase project. Never commit the real files.

```bash
# apps/api/.env
DATABASE_URL=...            # pooled connection string
DIRECT_URL=...              # direct or session-pooler connection string (migrations)
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...   # secret, API only
CORS_ORIGINS=http://localhost:5173

# apps/web/.env
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...      # public key
```

The full variable list, where to find each value and the Supabase/Render/Cloudflare setup are in [`docs/en/DEVELOPMENT_SETUP.md`](docs/en/DEVELOPMENT_SETUP.md).

### Database

```bash
pnpm --filter @denimflow/api db:migrate:dev   # apply migrations to the dev database
pnpm --filter @denimflow/api db:seed          # demo catalog, 7 demo users, template "Jean Standard"
```

### Running in Development

```bash
# Run web and API together
pnpm dev

# Run one of them
pnpm dev:web
pnpm dev:api
```

The web app is served at `http://localhost:5173` and the API at `http://localhost:3000` (health check: `/health`).

---

## Build and Quality Assurance Scripts

| Command | Action |
| :--- | :--- |
| `pnpm build` | Builds all packages and apps |
| `pnpm typecheck` | Runs TypeScript type checking in every workspace |
| `pnpm lint` | Runs ESLint in every workspace |
| `pnpm test` | Runs all unit and integration tests |
| `pnpm format` | Formats the codebase with Prettier |
| `pnpm format:check` | Verifies formatting without changing files |
| `pnpm clean` | Removes build output and caches |
| `pnpm --filter @denimflow/engine test` | Runs only the engine tests (fast, no database) |
| `pnpm --filter @denimflow/api db:migrate:dev` | Creates and applies a migration locally |
| `pnpm --filter @denimflow/api db:studio` | Opens a browser UI for the dev database |

Before every pull request, run:

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

---

## Git Hooks and Quality Gates

### Husky and lint-staged

A `pre-commit` hook (`.husky/pre-commit`) runs on every `git commit` and invokes `lint-staged` on the staged files only:

- `*.{ts,tsx,js,mjs,cjs}`: `eslint --fix`, then `prettier --write`
- `*.{json,css,yaml,yml}`: `prettier --write`

Markdown files are not formatted by Prettier (listed in `.prettierignore`), so editing one table cell does not re-pad the whole table.

If an error cannot be fixed automatically, the commit is rejected: read the output, fix it, stage again and commit again. Do not bypass hooks with `--no-verify`.

### Protected `main`

A repository ruleset protects `main`:

- Changes only through a **pull request**; direct pushes are rejected.
- **1 approval** required, and the author of the latest push cannot approve.
- Conversations must be resolved.
- **Squash merge** only, linear history, no force push, no branch deletion.
- Required status checks (the CI job) are added after the first green CI run.

---

## Continuous Integration (GitHub Actions)

Workflows live in `.github/workflows/` (created in Sprint 0).

| Workflow | Trigger | Purpose |
| :--- | :--- | :--- |
| `ci.yml` | Pull request and push to `main` | Install, format check, lint, typecheck, test (Postgres service container), build |
| `migrate.yml` | Manual | Applies Prisma migrations to production using a secret connection string |
| `keep-alive.yml` | Scheduled (~10 min) | Calls the API `/health` to reduce cold starts of the free host |

Pipeline steps of `ci.yml`:

1. **Checkout** the source.
2. **Setup** Node.js (version from `.nvmrc`) and pnpm, with dependency caching.
3. **Install** with `pnpm install --frozen-lockfile`.
4. **Prettier check**: `pnpm format:check`.
5. **ESLint**: `pnpm lint`.
6. **TypeScript check**: `pnpm typecheck`.
7. **Tests**: `pnpm test`.
8. **Build validation**: `pnpm build`.

Workflows run with read-only repository permissions.

---

## Deployment Overview

| Part | Service | Notes |
| :--- | :--- | :--- |
| Web | Cloudflare (Pages or Workers static assets; decided in Sprint 0) | Build output `apps/web/dist`; SPA fallback required |
| API | Render free web service | Sleeps after 15 minutes idle, about 1 minute cold start |
| Database, Auth, Storage | Supabase free | Two projects: `denimflow-dev` and `denimflow-prod`; free projects pause after inactivity |

Step-by-step instructions: [`docs/en/DEVELOPMENT_SETUP.md`](docs/en/DEVELOPMENT_SETUP.md). Free-tier limits change; re-check provider pricing pages before a demo.

---

## Contribution Workflow

The complete guide (Vietnamese): [`Tutorial_denimflow-bo.md`](Tutorial_denimflow-bo.md). Summary:

1. **Clone and install**: `git clone <url>`, `pnpm install`, create the `.env` files.
2. **Branch from `main`**: `git switch main && git pull && git switch -c feat/<module>-<topic>`. Branch types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`. One task = one branch = one PR.
3. **Implement and test locally**: `pnpm dev`.
4. **Run the quality checks**: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
5. **Commit with Conventional Commits**: `git commit -m "feat(order): confirm order in a single transaction"`. Scope is the module or package.
6. **Push and open a PR** against `main`, using the pull request template. The PR title follows the same commit format because it becomes the squash commit.
7. **Get 1 approval and green CI**, then **Squash and merge**. Delete the local branch.

Working with AI agents: start from [`AGENTS.md`](AGENTS.md). The prompt template and rules are in the tutorial.

---

## Documentation Map

| Topic | English | Tiếng Việt |
| :--- | :--- | :--- |
| Product requirements, RBAC, MVP acceptance criteria, demo scenario | [PRD](docs/en/PRD.md) | [PRD](docs/vi/PRD.md) |
| Setup, environment variables, deploy, troubleshooting | [DEVELOPMENT_SETUP](docs/en/DEVELOPMENT_SETUP.md) | [DEVELOPMENT_SETUP](docs/vi/DEVELOPMENT_SETUP.md) |
| Schema, ERD, constraints, transactions | [DATABASE_DESIGN](docs/en/DATABASE_DESIGN.md) | [DATABASE_DESIGN](docs/vi/DATABASE_DESIGN.md) |
| 19 business rules, workflow, state machines, FR traceability | [BUSINESS_RECONCILIATION](docs/en/BUSINESS_RECONCILIATION.md) | [BUSINESS_RECONCILIATION](docs/vi/BUSINESS_RECONCILIATION.md) |

Other entry points: [`AGENTS.md`](AGENTS.md) (agent rules), [`PROJECT_STATE.md`](PROJECT_STATE.md) (status), [`HELP.md`](HELP.md) (library docs), [`.agents/tasks/`](.agents/tasks/) (sprint backlog), [`docs/adr/`](docs/adr/) (decisions), [`Tutorial_denimflow-bo.md`](Tutorial_denimflow-bo.md) (team guide, Vietnamese).

---

## Roadmap

| Sprint | Outcome | Status |
| :--- | :--- | :--- |
| S0 | Walking skeleton deployed end to end (web → API → DB → Auth), CI | not started |
| S1 | Login, RBAC, master data, Fabric–Color Matrix, QC Profile data | not started |
| S2 | Workflow engine core, template designer, validation, publish | not started |
| S3 | Order create/Confirm/snapshot, BOM, allocation | not started |
| S4 | Worklist, quantities, Gates, separation of duties | not started |
| S5 | QC, rework, handover, dashboard, E2E demo | not started |

MVP scope: 14 functional requirements (see the PRD). Items deferred after the MVP are listed in `docs/en/BUSINESS_RECONCILIATION.md`.

---

## Design System

The UI is in Vietnamese. The design system (flat light theme, denim-blue primary `#2F5D8A`, Inter with Vietnamese subset, no gradients) and the Vietnamese UI glossary are defined in [`docs/design/DESIGN.md`](docs/design/DESIGN.md). Prompts for generating screens with Stitch and implementing them with an agent are in [`docs/design/UI_DESIGN_PROMPTS.md`](docs/design/UI_DESIGN_PROMPTS.md). Components must use design tokens, never hard-coded colors.
