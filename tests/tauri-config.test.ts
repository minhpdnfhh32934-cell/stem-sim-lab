import { describe, expect, it } from 'vitest';
import pkg from '../package.json';
import conf from '../src-tauri/tauri.conf.json';
import pilot from '../src-tauri/tauri.pilot.conf.json';

describe('tauri.pilot.conf.json (second installer, 3b.6)', () => {
  it('installs next to the main app: own name and identifier (own data and keys)', () => {
    expect(pilot.identifier).not.toBe(conf.identifier);
    expect(pilot.productName).not.toBe(conf.productName);
    expect(pilot.productName.startsWith(conf.productName)).toBe(true);
  });

  it('packs the pilot web part (the build that checks there is no Gemini code)', () => {
    expect(pilot.build.beforeBuildCommand).toBe('npm run build:pilot');
    expect(pkg.scripts['build:pilot']).toContain('pilot');
  });

  it('never overrides the security settings, the version or the bundle targets', () => {
    expect(pilot).not.toHaveProperty('version');
    expect(pilot.app).not.toHaveProperty('security');
    expect(pilot.bundle).not.toHaveProperty('targets');
  });

  it('keeps the same window size as the main app (merging replaces the whole window list)', () => {
    const [main] = conf.app.windows;
    const [win] = pilot.app.windows;
    expect({ ...win, title: main?.title }).toEqual(main);
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

describe('tauri.conf.json security', () => {
  const sec = conf.app.security;

  it('keeps the production CSP strict (no inline scripts, only the model hosts)', () => {
    expect(sec.csp).toContain("script-src 'self' 'wasm-unsafe-eval';");
    // The in-app Gemma engine downloads model files from HuggingFace, which redirects to its
    // CDN (e.g. us.aws.cdn.hf.co, checked 2026-10-12), plus the opt-in Wikipedia lookup.
    // These are the only remote hosts allowed — nothing else (fork exception, CLAUDE.md).
    expect(remotes(sec.csp)).toEqual(ALLOWED_REMOTES);
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
