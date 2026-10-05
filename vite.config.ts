/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Tauri sets TAURI_ENV_* variables while running `tauri dev` / `tauri build`.
const host = process.env.TAURI_DEV_HOST;
const isDebugBuild = Boolean(process.env.TAURI_ENV_DEBUG);
// Edition (PROMPT_PHAN_2 A2): `VITE_EDITION=pilot` builds the supervised high-school pilot
// (Claude only). `__EDITION__` is replaced in every module, so code behind
// `__EDITION__ === 'main'` is removed from the pilot bundle (checked by scripts/edition-bundle.mjs).
const edition = process.env.VITE_EDITION === 'pilot' ? 'pilot' : 'main';
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig({
  plugins: [
    react(),
    {
      // Version of the web part; the desktop app compares it with downloaded updates.
      name: 'stemsim-web-version',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'web-version.txt', source: `${pkg.version}\n` });
        // Edition of the bundle ("main" / "pilot"); updates must never cross editions.
        this.emitFile({ type: 'asset', fileName: 'web-edition.txt', source: `${edition}\n` });
      },
    },
  ],
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __EDITION__: JSON.stringify(edition) },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@data': fileURLToPath(new URL('./data', import.meta.url)),
    },
  },

  // Tauri expects a fixed port and must be able to see Rust errors in the terminal.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host ?? false,
    ...(host ? { hmr: { protocol: 'ws', host, port: 1421 } } : {}),
    watch: { ignored: ['**/src-tauri/**'] },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_'],

  build: {
    // WebView2 (Windows) and WebKitGTK/WKWebView are evergreen, ES2022 is safe.
    target: 'es2022',
    minify: !isDebugBuild,
    sourcemap: isDebugBuild,
    // three.js (~620 kB) is one lazily loaded chunk, fetched only by the 3D chemistry topics.
    chunkSizeWarningLimit: 700,
  },

  worker: { format: 'es' },

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    css: false,
  },
});
