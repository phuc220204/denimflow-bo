import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Tests always use a throwaway Postgres (Docker locally, a service container in CI),
// never the Supabase dev/prod projects (rule 05).
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:54329/denimflow_test';

export default defineConfig({
  resolve: {
    // Use workspace package sources so tests do not need `pnpm build` first.
    alias: {
      '@denimflow/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    globals: true,
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    globalSetup: ['test/global-setup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl,
      DIRECT_URL: testDatabaseUrl,
      CORS_ORIGINS: 'http://localhost:5173',
    },
    // Test files share one database; run them one after another.
    fileParallelism: false,
  },
});
