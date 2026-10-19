import { describe, expect, it } from 'vitest';
import pkg from '../package.json';
import { existsSync } from 'node:fs';
import conf from '../src-tauri/tauri.conf.json';

describe('one edition: SimLab (the high-school pilot was removed 2026-10-12)', () => {
  it('ships one installer named SimLab and keeps the identifier (data, keys, updates)', () => {
    expect(conf.productName).toBe('SimLab');
    expect(conf.identifier).toBe('vn.stemsimlab.desktop');
    expect(existsSync('src-tauri/tauri.pilot.conf.json')).toBe(false);
    expect(Object.keys(pkg.scripts).some((k) => k.includes('pilot'))).toBe(false);
  });
});

const ALLOWED_REMOTES = [
  '*.hf.co',
  'cas-bridge.xethub.huggingface.co',
  'cdn-lfs.huggingface.co',
  'en.wikipedia.org',
  'huggingface.co',
  'vi.wikipedia.org',
].sort();

const remotes = (csp: string) => [...csp.matchAll(/https:\/\/([^\s;]+)/g)].map((m) => m[1]).sort();

/** The CSP as { directive: sources }, so a test can compare every source, not only https:// ones. */
const directives = (csp: string): Record<string, string[]> =>
  Object.fromEntries(
    csp
      .split(';')
      .map((d) => d.trim().split(/\s+/))
      .filter((parts) => parts[0])
      .map(([name, ...sources]): [string, string[]] => [name ?? '', sources]),
  );

const MODEL_AND_WIKI = ALLOWED_REMOTES.map((h) => `https://${h}`).sort();
const LOCAL = ["'self'", 'ipc:', 'http://ipc.localhost'];

describe('tauri.conf.json security', () => {
  const sec = conf.app.security;

  it('keeps the production CSP strict (no inline scripts, only the model hosts)', () => {
    expect(sec.csp).toContain("script-src 'self' 'wasm-unsafe-eval';");
    // The in-app Gemma engine downloads model files from HuggingFace, which redirects to its
    // CDN (e.g. us.aws.cdn.hf.co, checked 2026-10-12), plus the opt-in Wikipedia lookup.
    // These are the only remote hosts allowed — nothing else (fork exception, CLAUDE.md).
    expect(remotes(sec.csp)).toEqual(ALLOWED_REMOTES);
  });

  it('pins every production directive exactly (no https:, *, ws: or bare host can slip in)', () => {
    const d = directives(sec.csp);
    expect(Object.keys(d).sort()).toEqual(
      [
        'connect-src',
        'default-src',
        'font-src',
        'img-src',
        'script-src',
        'style-src',
        'worker-src',
      ].sort(),
    );
    expect(d['default-src']).toEqual(["'self'"]);
    expect(d['script-src']).toEqual(["'self'", "'wasm-unsafe-eval'"]);
    expect(d['style-src']).toEqual(["'self'", "'unsafe-inline'"]);
    expect(d['img-src']).toEqual(["'self'", 'data:', 'blob:']);
    expect(d['font-src']).toEqual(["'self'", 'data:']);
    expect(d['worker-src']).toEqual(["'self'", 'blob:']);
    expect([...(d['connect-src'] ?? [])].sort()).toEqual([...LOCAL, ...MODEL_AND_WIKI].sort());
  });

  it('the dev CSP adds only the Vite websockets to connect-src', () => {
    const d = directives(sec.devCsp);
    expect([...(d['connect-src'] ?? [])].sort()).toEqual(
      [...LOCAL, 'ws://localhost:1420', 'ws://localhost:1421', ...MODEL_AND_WIKI].sort(),
    );
  });

  it('the dev CSP allows the same model hosts, so `tauri dev` can download a model', () => {
    expect(remotes(sec.devCsp)).toEqual(ALLOWED_REMOTES);
  });

  it("lets KaTeX's inline style attributes work in the packaged app", () => {
    // Tauri adds hashes to style-src by default; with a hash present, browsers ignore
    // 'unsafe-inline', which blocks KaTeX's style="top:…" and breaks every sub/superscript
    // (seen in WebKitGTK; WebView2 behaves the same).
    expect(sec.csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(sec.dangerousDisableAssetCspModification).toContain('style-src');
  });
});
