import { defineConfig } from '@playwright/test';

const PORT = 5197;

// Phase 6C.1 performance benchmark (`npm run bench`), not part of `npm run test:e2e`: the
// production build's Physics Lab played as a player plays it, frame times recorded in the page.
// gpu: a visible Edge window, so WebGL runs on the real GPU, at the E2E suite's 1280×720;
// gpu-native: maximized, at the display's own resolution and pixel ratio; gpu-headless: the
// real GPU without a window (immune to someone using the mouse meanwhile); software: the E2E
// suite's SwiftShader, for comparison. One worker: measurements never share the machine.
// The visible windows capture the mouse while they aim: leave the machine alone meanwhile.
// gpu-fullscreen: the whole panel (2560×1600 on the target laptop), no taskbar or title bar; the
// benches make the window fullscreen through CDP (support.ts fullscreenWindow).
// BENCH_UNCAPPED=1 turns the browser's vsync and frame-rate limit off, so a frame rate above the
// display's refresh is the renderer's own: never mix those numbers with vsync-capped ones.
const UNCAPPED = process.env.BENCH_UNCAPPED
  ? ['--disable-gpu-vsync', '--disable-frame-rate-limit']
  : [];
export default defineConfig({
  testDir: 'e2e',
  testMatch: /\.bench\.ts$/,
  timeout: 300_000,
  workers: 1,
  use: { baseURL: `http://localhost:${PORT}`, channel: 'msedge', screenshot: 'only-on-failure' },
  projects: [
    {
      name: 'gpu',
      use: {
        headless: false,
        viewport: { width: 1280, height: 720 },
        launchOptions: { args: UNCAPPED },
      },
    },
    {
      name: 'gpu-native',
      use: {
        headless: false,
        viewport: null,
        launchOptions: { args: ['--start-maximized', ...UNCAPPED] },
      },
    },
    {
      name: 'gpu-fullscreen',
      use: {
        headless: false,
        viewport: null,
        launchOptions: { args: UNCAPPED }, // made fullscreen through CDP: e2e/support.ts fullscreenWindow
      },
    },
    {
      name: 'gpu-headless',
      use: { viewport: { width: 1280, height: 720 }, launchOptions: { args: UNCAPPED } },
    },
    {
      name: 'software',
      use: {
        viewport: { width: 1280, height: 720 },
        launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
      },
    },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
