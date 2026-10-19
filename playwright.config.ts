import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests in a real browser against the Vite dev server. The AI providers are mocked
 * with `page.route`, so no key or model is needed. Set PW_CHROMIUM to use an already installed
 * Chromium instead of `npx playwright install chromium`.
 */
const executablePath = process.env.PW_CHROMIUM;
const chromium = {
  ...devices['Desktop Chrome'],
  locale: 'vi-VN',
  viewport: { width: 1366, height: 768 },
};
/**
 * The 3D mitosis spec renders WebGL in software for about a minute; next to the other specs it
 * starved them while the dev server was still compiling (seen 2026-10-14: chemistry and learner
 * specs timed out only in the full parallel run). It runs on its own, after the others — so does
 * the Biology Studio spec, which shows the same 3D view in software.
 */
const HEAVY_3D = /(mitosis3d|studio-biology)\.spec\.ts$/;
/** The 3D performance budget test (tag @perf): its own project, after the other 3D tests. */
const PERF = /@perf/;
/** Software WebGL (SwiftShader): the perf numbers are never measured on a GPU. */
const SWIFTSHADER = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

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
    { name: 'chromium', use: chromium, testIgnore: HEAVY_3D },
    // Skipped when a spec of the first project fails (Playwright dependencies); fix those first.
    {
      name: 'chromium-3d',
      use: chromium,
      testMatch: HEAVY_3D,
      grepInvert: PERF,
      dependencies: ['chromium'],
    },
    {
      name: 'chromium-3d-perf',
      use: {
        ...chromium,
        launchOptions: { ...(executablePath ? { executablePath } : {}), args: SWIFTSHADER },
      },
      testMatch: HEAVY_3D,
      grep: PERF,
      dependencies: ['chromium-3d'],
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:1420',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
