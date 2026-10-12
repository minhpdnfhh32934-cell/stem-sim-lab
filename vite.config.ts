/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Tauri sets TAURI_ENV_* variables while running `tauri dev` / `tauri build`.
const host = process.env.TAURI_DEV_HOST;
const isDebugBuild = Boolean(process.env.TAURI_ENV_DEBUG);
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig({
  plugins: [
    react(),
    {
      // Dev only: ONNX Runtime (Gemma engine) imports its loader from /ort/ at run time. Vite
      // answers the `?import` form of a public file with an error, so serve the plain file —
      // exactly what the production build does.
      name: 'stemsim-ort-public-import',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url?.startsWith('/ort/') && req.url.includes('?')) {
            req.url = req.url.slice(0, req.url.indexOf('?'));
          }
          next();
        });
      },
    },
    {
      // Version of the web part; the desktop app compares it with downloaded updates.
      name: 'stemsim-web-version',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'web-version.txt', source: `${pkg.version}\n` });
        // The app only installs "main" bundles (the pilot edition was removed in 0.5.0; the
        // file stays so the update check of installed apps keeps working).
        this.emitFile({ type: 'asset', fileName: 'web-edition.txt', source: 'main\n' });
      },
    },
  ],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
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
  // Pre-bundled at dev start: otherwise the Gemma worker's first import makes Vite re-optimize
  // and reload the page in the middle of a model download (dev server only).
  optimizeDeps: { include: ['@huggingface/transformers'] },

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    css: false,
  },
});
