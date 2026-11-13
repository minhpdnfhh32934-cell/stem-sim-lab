/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { roomsPlugin } from './src/multiplayer/roomsPlugin.ts';

export default defineConfig({
  server: { port: 5173 },
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
