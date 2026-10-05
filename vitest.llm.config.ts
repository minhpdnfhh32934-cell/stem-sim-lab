import { defineConfig } from 'vitest/config';
import base from './vite.config.ts';

/**
 * Runs the physics golden set against the REAL Gemini API (not part of `npm test`; uses quota):
 *   GEMINI_API_KEY=… [GEMINI_MODEL=gemini-3.8-flash] npm run golden:llm
 */
export default defineConfig({
  resolve: base.resolve,
  define: base.define,
  test: {
    include: ['tests/golden/*.llm.ts'],
    environment: 'node',
    silent: false,
    testTimeout: 30 * 60_000,
  },
});
