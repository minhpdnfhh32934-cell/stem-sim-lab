import { defineConfig } from 'vitest/config';
import base from './vite.config.ts';

/**
 * Runs the physics golden set against a REAL model (not part of `npm test`; uses quota):
 *   GEMINI_API_KEY=… [GEMINI_MODEL=…] npm run golden:llm
 *   LLM_PROVIDER=claude ANTHROPIC_API_KEY=… [CLAUDE_MODEL=…] npm run golden:llm
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
