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
 * the Biology Studio spec, which shows the same 3D view in software, the meiosis 3D view
 * (meiosis3d.spec.ts), the DNA → mRNA → protein 3D view (dogma3d.spec.ts), the point-mutation
 * 3D view (mutation3d.spec.ts), the Mendel 3D view (mendel3d.spec.ts), the enzyme kinetics 3D
 * view (enzyme3d.spec.ts), the diffusion & osmosis 3D view (transport3d.spec.ts), the logistic
 * growth 3D habitat (logistic3d.spec.ts) and the other biology lessons' 3D views (bio3d.spec.ts).
 * Since 0.7.0 every biology lesson opens in 3D, so the specs that open biology topics
 * (biology.spec.ts, project.spec.ts) draw WebGL in software too and run here as well.
 *
 * Keep the test output in `test-results/` (the default; Vite does not watch it). Traces written
 * inside the watched project (e.g. `--output .agent-logs/…`) contain `.html` files, and each one
 * makes the dev server reload every open page in the middle of a test (seen 2026-10-20: random
 * "element not found" failures in the studio, chemistry, AI and board specs).
 */
const HEAVY_3D =
  /(mitosis3d|meiosis3d|dogma3d|mutation3d|mendel3d|hw3d|logistic3d|enzyme3d|transport3d|studio-biology|bio3d|biology|project)\.spec\.ts$/;
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
      // Each worker draws WebGL in software on the CPU. With 8 at once (16-thread machine,
      // 2026-10-20) the first mitosis view took over 20 s to get its canvas; alone it passes.
      // The CI runner has 4 vCPUs: 4 software renderers at once left mitosis 3D without a
      // renderer for over 40 s (PR #32), so CI runs 2 at a time.
      workers: process.env.CI ? 2 : 4,
      // Every lesson here opens a lazy module whose 3D view draws in software. On the CI runner
      // (few CPU cores) a first open can take longer than the 5 s default, so waits here are
      // 15 s; what is checked does not change.
      expect: { timeout: 15_000 },
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
