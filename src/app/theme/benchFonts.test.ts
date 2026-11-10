// @vitest-environment node
import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The bench fonts (#113): what `benchFonts.ts` imports, how much it weighs and which characters
 * the bundled subsets cannot draw (those fall back to the next font of `--font-sans` /
 * `--font-mono`, e.g. Segoe UI / Cascadia Mono on Windows). Whether the browser really draws the
 * Vietnamese letters with them: tests/e2e/bench-fonts.spec.ts.
 */
const root = resolve(__dirname, '../../..');
const imports = [
  ...readFileSync(resolve(__dirname, 'benchFonts.ts'), 'utf8').matchAll(/^import '([^']+)';/gm),
].map((m) => resolve(root, 'node_modules', m[1] ?? ''));

/** Every @font-face of the imported files: family, file and unicode-range ([from, to] pairs). */
const faces = imports.flatMap((css) =>
  [...readFileSync(css, 'utf8').matchAll(/@font-face\s*{([^}]*)}/g)].map(([, body = '']) => ({
    family: /font-family:\s*'([^']+)'/.exec(body)?.[1] ?? '',
    file: resolve(dirname(css), /url\((\.\/files\/[^)]+\.woff2)\)/.exec(body)?.[1] ?? ''),
    ranges: [
      ...(/unicode-range:\s*([^;]+);/.exec(body)?.[1] ?? '').matchAll(
        /U\+([0-9A-F]+)(?:-([0-9A-F]+))?/gi,
      ),
    ].map(([, a = '', b]) => [parseInt(a, 16), parseInt(b ?? a, 16)] as const),
  })),
);

/** Characters of the app's science text that a subset might lack. */
const SYMBOLS = '₀₁₂₃₄₅₆₇₈₉₊₋⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻µ·°×−→⇌≈≤≥√ΔΩαλπω';

/** The characters of `text` no imported face of `family` covers (the fallback font draws them). */
function fallsBack(family: string, text: string): string {
  const own = faces.filter((f) => f.family === family);
  return Array.from(text)
    .filter((ch) => {
      const cp = ch.codePointAt(0) ?? 0;
      return !own.some((f) => f.ranges.some(([a, b]) => cp >= a && cp <= b));
    })
    .join('');
}

describe('bench fonts', () => {
  it('imports Be Vietnam Pro 400/500/600 and JetBrains Mono 400/500, every face with a unicode-range', () => {
    const weights = (family: string) => [
      ...new Set(imports.filter((f) => f.includes(family)).map((f) => /(\d+)\.css$/.exec(f)?.[1])),
    ];
    expect(weights('be-vietnam-pro')).toEqual(['400', '500', '600']);
    expect(weights('jetbrains-mono')).toEqual(['400', '500']);
    for (const f of faces) expect(f.ranges.length, f.file).toBeGreaterThan(0);
  });

  it('weighs at most 400 KB of woff2 in all', () => {
    const bytes = faces.reduce((s, f) => s + statSync(f.file).size, 0);
    expect(bytes).toBeLessThanOrEqual(400 * 1024);
  });

  it('covers every Vietnamese letter; these symbols fall back to the next font', () => {
    const vietnamese = 'ĂăÂâĐđÊêÔôƠơƯưĨĩŨũ' + String.fromCodePoint(...range(0x1ea0, 0x1ef9));
    expect(fallsBack('Be Vietnam Pro', vietnamese)).toBe('');
    expect(fallsBack('JetBrains Mono', vietnamese)).toBe('');
    // The subsets (latin, latin-ext, vietnamese; JetBrains Mono also greek and cyrillic) leave
    // out sub- and superscript digits (except ¹²³), arrows and these maths signs.
    expect(fallsBack('Be Vietnam Pro', SYMBOLS)).toBe('₀₁₂₃₄₅₆₇₈₉₊₋⁰⁴⁵⁶⁷⁸⁹⁺⁻→⇌≈≤≥√ΔΩαλπω');
    expect(fallsBack('JetBrains Mono', SYMBOLS)).toBe('₀₁₂₃₄₅₆₇₈₉₊₋⁰⁴⁵⁶⁷⁸⁹⁺⁻→⇌≈≤≥√');
  });
});

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
