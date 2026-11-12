import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/** Stylesheet scans shared by the theme tests (#205 A1, A2). Test-only: never imported by the app. */
const SRC = resolve(__dirname, '../..');
const ROOT = resolve(SRC, '..');

export interface CssDecl {
  /** `src/…/file.css selector`: how the tests name an exception. */
  key: string;
  file: string;
  prop: string;
  value: string;
}

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? cssFiles(join(dir, e.name))
      : e.name.endsWith('.css')
        ? [join(dir, e.name)]
        : [],
  );
}

/**
 * Every declaration of every stylesheet under src/, with the selector of its innermost rule
 * (comments removed). A regex reading, good enough for our CSS: no nested strings with braces.
 */
export function cssDeclarations(): CssDecl[] {
  return cssFiles(SRC).flatMap((path) => {
    const file = relative(ROOT, path).split('\\').join('/');
    const css = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const out: CssDecl[] = [];
    for (const [, head = '', body = ''] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = (head.trim().split('\n').pop() ?? '').trim();
      for (const [, prop = '', value = ''] of body.matchAll(/([-\w]+)\s*:\s*([^;]+);/g)) {
        out.push({ key: `${file} ${selector}`, file, prop, value: value.trim() });
      }
    }
    return out;
  });
}
