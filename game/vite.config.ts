/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { roomsPlugin } from './src/multiplayer/roomsPlugin.ts';

export default defineConfig({
  server: {
    port: 5173,
    // Build outputs are not sources. Watched, their folders could not be emptied by the next build
    // while a dev server ran (Windows keeps a watched folder until its watcher lets go: the
    // desktop app's build failed so, 2026-11-14).
    watch: { ignored: ['**/dist/**', '**/dist-app/**', '**/dist-wallpaper/**'] },
  },
  // Ultra's WebGPU chunk (render/gpu, Phase G2): found only when it is first imported, the dev
  // server's dependencies were bundled again then, and that import failed (504, Outdated Optimize Dep).
  optimizeDeps: {
    include: [
      'three/webgpu',
      'three/tsl',
      'three/examples/jsm/tsl/display/BloomNode.js',
      'three/examples/jsm/tsl/display/GaussianBlurNode.js',
      'three/examples/jsm/tsl/display/SSGINode.js',
      'three/examples/jsm/tsl/display/TRAANode.js',
    ],
  },
  plugins: [
    // LAN rooms (Phase M) on the dev server's own WebSocket: npm run dev:lan.
    roomsPlugin(),
    {
      name: 'simlab:no-cached-globs',
      // Vitest's fsModuleCache keys a module by its own source only, so a cached
      // import.meta.glob (content/lab.ts) would miss experiment files added since.
      configureVitest({ defineCacheKeyGenerator }) {
        defineCacheKeyGenerator(({ sourceCode }) =>
          sourceCode.includes('import.meta.glob') ? false : undefined,
        );
      },
    },
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // One worker per logical CPU (31 on a 32-thread laptop) starves the tests that boot the whole
    // game (Rapier WASM + content) past the 5 s timeout; 40 % ran the suite stably and faster.
    maxWorkers: '40%',
  },
});
