import { describe, expect, it } from 'vitest';
import conf from '../src-tauri/tauri.conf.json';

describe('tauri.conf.json security', () => {
  const sec = conf.app.security;

  it('keeps the production CSP strict (no inline scripts, no remote hosts)', () => {
    expect(sec.csp).toContain("script-src 'self' 'wasm-unsafe-eval';");
    expect(sec.csp).not.toMatch(/https?:\/\/(?!ipc\.localhost)/);
  });

  it("lets KaTeX's inline style attributes work in the packaged app", () => {
    // Tauri adds hashes to style-src by default; with a hash present, browsers ignore
    // 'unsafe-inline', which blocks KaTeX's style="top:…" and breaks every sub/superscript
    // (seen in WebKitGTK; WebView2 behaves the same).
    expect(sec.csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(sec.dangerousDisableAssetCspModification).toContain('style-src');
  });
});
