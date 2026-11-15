import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInThisContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(__dirname, '..', path), 'utf8');

/** `--bg-app` inside the first block that starts with `selector {`. */
function bgApp(css: string, selector: string): string | undefined {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) return undefined;
  const block = css.slice(start, css.indexOf('}', start));
  return /--bg-app:\s*(#[0-9a-f]{6})/i.exec(block)?.[1];
}

describe('the first frame is the classic window (#263)', () => {
  it('theme-boot.js sets the theme and never marks a bench shell', () => {
    delete document.documentElement.dataset.shell;
    delete document.documentElement.dataset.theme;
    runInThisContext(read('public/theme-boot.js'));
    expect(document.documentElement.dataset.shell).toBeUndefined();
    expect(['light', 'dark']).toContain(document.documentElement.dataset.theme);
  });

  it("index.html paints the app's own background, light and dark", () => {
    const tokens = read('src/app/theme/tokens.css');
    const html = read('index.html');
    const light = bgApp(tokens, ":root[data-theme='light']");
    const dark = bgApp(tokens, ":root[data-theme='dark']");
    expect(light).toBeDefined();
    expect(dark).toBeDefined();
    const flat = html.replace(/\s+/g, ' ');
    expect(flat).toContain(`html { background: ${String(light)}; }`);
    expect(flat).toContain(`html[data-theme='dark'] { background: ${String(dark)}; }`);
    expect(html).not.toContain('data-shell');
  });
});
