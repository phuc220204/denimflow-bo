import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Prisma 7 does not load .env by itself. Locally we use apps/api/.env; on Render and in CI
// the variables come from the environment.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // Runs the compiled seed (build first; `pnpm db:seed` does both). Used by `prisma db seed`
    // and `prisma migrate reset`.
    seed: 'node --env-file-if-exists=.env dist/seed/index.js',
  },
  datasource: {
    // Migrations use the direct (or session pooler) connection; the transaction pooler
    // breaks DDL. The runtime client uses DATABASE_URL through the pg adapter instead.
    url: process.env.DIRECT_URL ?? '',
  },
});
