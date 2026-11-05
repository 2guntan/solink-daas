import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);

/** E2E : base réinitialisée par `pnpm test:e2e` (db:reset), serveur Next de production dédié. */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 15 * 60_000,
  expect: { timeout: 30_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 60_000,
    navigationTimeout: 120_000,
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: `pnpm --filter @solink/web build && pnpm --filter @solink/web exec next start -p ${PORT}`,
    url: `http://localhost:${PORT}/connexion`,
    reuseExistingServer: !!process.env.E2E_REUSE,
    timeout: 600_000,
    env: { APP_URL: `http://localhost:${PORT}`, PGBOSS_DISABLED: 'true', DEMO_MODE: 'true' },
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
