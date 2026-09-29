import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests in a real browser against the Vite dev server. LM Studio is mocked
 * with `page.route`, so no model is needed. Set PW_CHROMIUM to use an already installed
 * Chromium instead of `npx playwright install chromium`.
 */
const executablePath = process.env.PW_CHROMIUM;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:1420',
    locale: 'vi-VN',
    viewport: { width: 1366, height: 768 },
    trace: 'retain-on-failure',
    // The first-run tour is tested separately (tests/e2e/project.spec.ts).
    storageState: 'tests/e2e/storage-state.json',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        locale: 'vi-VN',
        viewport: { width: 1366, height: 768 },
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:1420',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
