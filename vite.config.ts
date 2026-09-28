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
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
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
