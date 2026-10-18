import { execSync } from 'node:child_process';

// Applies all migrations to the test database once before the test run.
export default function setup(): void {
  if (process.env.SKIP_DB_SETUP === 'true') {
    return;
  }

  const url =
    process.env.TEST_DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:54329/denimflow_test';
  if (url.includes('supabase')) {
    throw new Error('Refusing to run tests against a Supabase database (rule 05).');
  }

  try {
    execSync('pnpm exec prisma migrate deploy', {
      env: { ...process.env, DIRECT_URL: url },
      stdio: 'pipe',
    });
  } catch (error) {
    const output = error instanceof Error && 'stderr' in error ? String(error.stderr) : '';
    throw new Error(
      `Could not migrate the test database. Is it running? Try \`pnpm --filter @denimflow/api db:test:up\`.\n${output}`,
      { cause: error },
    );
  }
}
