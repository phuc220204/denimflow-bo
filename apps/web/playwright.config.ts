import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5174', trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'pnpm --filter "@denimflow/api..." build && node apps/api/scripts/e2e-server.mjs',
      cwd: '../..',
      url: 'http://127.0.0.1:3101/health',
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: 'pnpm exec vite --host 127.0.0.1 --port 5174 --strictPort',
      url: 'http://127.0.0.1:5174',
      env: { VITE_API_URL: 'http://127.0.0.1:3101' },
      timeout: 60_000,
      reuseExistingServer: false,
    },
  ],
});
