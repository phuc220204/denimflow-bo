# HELP.md — Official documentation links for agents

Use these when you need the exact API of a library. **Check the docs of the version installed in `package.json`**, not what you remember. Pin versions and note any major-version differences in your PR.

> Link status: the authoring environment had no outbound access to most of these sites, so links were written from known official doc roots and **not automatically verified**. Only `render.com/docs/free` and `developers.cloudflare.com/pages/` were opened while writing. If a link is dead, fix it in a PR and mention it in `PROJECT_STATE.md`.

## Language and tooling

- TypeScript: https://www.typescriptlang.org/docs/
- Node.js (use the current LTS): https://nodejs.org/en/about/previous-releases
- pnpm workspaces: https://pnpm.io/workspaces
- Conventional Commits: https://www.conventionalcommits.org/en/v1.0.0/

## API (NestJS + Prisma)

- NestJS: https://docs.nestjs.com
  - Guards (JWT, roles): https://docs.nestjs.com/guards
  - Configuration: https://docs.nestjs.com/techniques/configuration
  - Exception filters: https://docs.nestjs.com/exception-filters
  - Testing: https://docs.nestjs.com/fundamentals/testing
  - OpenAPI/Swagger: https://docs.nestjs.com/openapi/introduction
- Prisma ORM: https://www.prisma.io/docs
  - Transactions (interactive `$transaction`): https://www.prisma.io/docs/orm/prisma-client/queries/transactions
  - Prisma with Supabase: https://www.prisma.io/docs/orm/overview/databases/supabase
  - Note: Prisma's config layout changed between major versions (`schema.prisma` vs `prisma.config.ts`). Follow the guide for the installed major version.
- Zod: https://zod.dev

## Database, Auth, Storage (Supabase / PostgreSQL)

- Supabase docs: https://supabase.com/docs
  - Connecting to Postgres (direct vs pooler): https://supabase.com/docs/guides/database/connecting-to-postgres
  - Auth: https://supabase.com/docs/guides/auth
  - JWTs (how to verify tokens): https://supabase.com/docs/guides/auth/jwts
  - Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
  - Storage: https://supabase.com/docs/guides/storage
  - JavaScript client: https://supabase.com/docs/reference/javascript/introduction
- PostgreSQL:
  - Explicit locking (`SELECT ... FOR UPDATE`): https://www.postgresql.org/docs/current/explicit-locking.html
  - Triggers (audit log immutability): https://www.postgresql.org/docs/current/plpgsql-trigger.html
  - Partial indexes (one PUBLISHED version per template): https://www.postgresql.org/docs/current/indexes-partial.html

## Web (React)

- React: https://react.dev
- Vite: https://vite.dev/guide/
- Tailwind CSS: https://tailwindcss.com/docs
- shadcn/ui: https://ui.shadcn.com/docs
- React Router: https://reactrouter.com
- TanStack Query: https://tanstack.com/query/latest
- React Hook Form: https://react-hook-form.com
- React Flow (workflow graph): https://reactflow.dev/learn
- Recharts: https://recharts.org

## Testing

- Vitest (engine, web, API): https://vitest.dev
- Testing Library: https://testing-library.com/docs/
- MSW (mock API in web): https://mswjs.io/docs/
- Playwright (E2E): https://playwright.dev/docs/intro

## Deploy and CI

- Cloudflare Pages: https://developers.cloudflare.com/pages/
- Cloudflare Workers static assets (Cloudflare now recommends Workers for new projects): https://developers.cloudflare.com/workers/static-assets/
- Render free web services (sleeps after 15 min idle): https://render.com/docs/free
- Render monorepo support: https://render.com/docs/monorepo-support
- GitHub Actions: https://docs.github.com/en/actions
- GitHub rulesets: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets

## Design and modeling references (for the course deliverables)

- Design patterns catalog: https://refactoring.guru/design-patterns
- UML activity diagrams: https://www.uml-diagrams.org/activity-diagrams.html
- Mermaid (diagrams in Markdown, rendered by GitHub): https://mermaid.js.org/

## Project documents

- Business source: `docs/reference/` (Proposal V2.0 and Appendix, EN/VI)
- Scope and acceptance: `docs/en/PRD.md`
- Business rules and traceability: `docs/en/BUSINESS_RECONCILIATION.md`
- Schema: `docs/en/DATABASE_DESIGN.md`
- Setup and deploy: `docs/en/DEVELOPMENT_SETUP.md`
