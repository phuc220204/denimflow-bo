# Skill: change the database schema (Prisma migration)

Use when a task adds or changes tables, columns, indexes or constraints.

## Steps

1. Read `DATABASE_DESIGN.md` §2 (conventions) and §6 (integrity rules). Decide the change on paper first: tables, columns, types, constraints, which BR it supports.
2. Edit `apps/api/prisma/schema.prisma`:
   - Model names PascalCase singular; `@@map("snake_case_plural")`; fields camelCase with `@map("snake_case")`.
   - Primary keys: `String @id @default(uuid()) @db.Uuid`. Timestamps: `@db.Timestamptz`.
   - Use Prisma enums for fixed sets, listed in `DATABASE_DESIGN.md` §5.
3. Create the migration: `pnpm --filter @denimflow/api db:migrate:dev --name <short_snake_name>`.
4. **Edit the generated SQL** (Prisma cannot express these) and commit it:
   - `ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;` for every new table (no policies).
   - Partial unique indexes (e.g. one PUBLISHED version per template).
   - `CHECK` constraints (e.g. `qty_good >= 0`).
   - Triggers (audit log append-only; immutable versions) when the task requires them.
5. Run migrate on a clean local database from scratch (`migrate reset`) to prove the whole history applies.
6. Update seed (`prisma/seed.ts`) if reference data changes. Seed must be idempotent (upsert) and use fake data only.
7. Update `DATABASE_DESIGN.md` in EN and VI (tables, ERD, deviations log if you diverge from the Proposal).
8. Production: migrations are applied by the `migrate` GitHub workflow using `DIRECT_URL`, not by the API at startup.

## Rules

- Never edit a migration that has been merged to `main`; add a new one.
- Destructive changes (drop/rename column) need an explicit note in the PR and a data-safe path.
- Use the **direct/session connection** for migrations; the transaction pooler can break DDL and prepared statements.

## Checklist

- [ ] RLS enabled on every new table
- [ ] Indexes for new foreign keys and for the main query paths
- [ ] Migration applies on an empty DB and on top of seed data
- [ ] Docs updated (EN + VI)
