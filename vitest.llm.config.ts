import { defineConfig } from 'vitest/config';
import base from './vite.config.ts';

/**
 * Runs the physics golden set against a REAL LM Studio server (not part of `npm test`):
 *   LMSTUDIO_URL=http://localhost:1234/v1 LMSTUDIO_MODEL=qwen2.5-7b-instruct npm run golden:llm
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
