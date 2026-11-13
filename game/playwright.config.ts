import { defineConfig } from '@playwright/test';

// Ports of their own for a second run beside this one (a shard run by a second agent, Phú
// 2026-11-05): SIMLAB_DEV_PORT and SIMLAB_PREVIEW_PORT, with --output to its own folder;
// SIMLAB_DEV_ONLY=1 starts no production build (one run builds dist/, never two at once).
const DEV_PORT = Number(process.env.SIMLAB_DEV_PORT ?? 5199);
const PREVIEW_PORT = Number(process.env.SIMLAB_PREVIEW_PORT ?? 5198);
// Specs that hold a key for a fixed time and check the distance walked: they measure real time,
// which parallel software-rendered browsers disturb, so they run after the rest, on their own.
const TIMED = /(game|grab)\.spec\.ts/;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  // Software WebGL is CPU-bound: with more browsers at once the shadowed Physics Lab fell below
  // 10 fps and specs ran in slow motion (Phase 6B: 7 → 4; Phase 6C.1: 4 → 3, after a laptop
  // warmed by long runs failed specs at 4 that pass alone — stability over speed).
  workers: 3,
  use: {
    // The installed Microsoft Edge, so no browser download is needed.
    channel: 'msedge',
    viewport: { width: 1280, height: 720 },
    // Headless browsers have no GPU; SwiftShader gives the renderer a software WebGL context.
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  projects: [
    {
      // Compiles every module once before the dev specs (e2e/warmup.setup.ts).
      name: 'warmup',
      testMatch: /warmup\.setup\.ts/,
      use: { baseURL: `http://localhost:${DEV_PORT}` },
    },
    {
      // Dev server: the debug panel exposes game state for detailed assertions.
      name: 'dev',
      testIgnore: [/production\.spec\.ts/, TIMED],
      dependencies: ['warmup'],
      use: { baseURL: `http://localhost:${DEV_PORT}` },
    },
    {
      name: 'dev-timed',
      testMatch: TIMED,
      dependencies: ['dev'],
      workers: 1,
      use: { baseURL: `http://localhost:${DEV_PORT}` },
    },
    {
      // The real production bundle (lazy chunks, minification) served by `vite preview`.
      name: 'production',
      testMatch: /production\.spec\.ts/,
      use: { baseURL: `http://localhost:${PREVIEW_PORT}` },
    },
  ],
  webServer: [
    {
      command: `npx vite --port ${DEV_PORT} --strictPort`,
      url: `http://localhost:${DEV_PORT}`,
      reuseExistingServer: true,
    },
    ...(process.env.SIMLAB_DEV_ONLY
      ? []
      : [
          {
            command: `npm run build && npx vite preview --port ${PREVIEW_PORT} --strictPort`,
            url: `http://localhost:${PREVIEW_PORT}`,
            reuseExistingServer: false,
            timeout: 180_000,
          },
        ]),
  ],
});
