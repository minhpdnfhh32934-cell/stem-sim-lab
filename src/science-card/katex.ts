type KatexModule = typeof import('katex');
let katexPromise: Promise<KatexModule> | undefined;

/**
 * KaTeX sets a comma as punctuation, with a space after it: an AI's "9,81" came out as "9, 81".
 * Between two digits it is a decimal comma (or a thousands mark); "x = 1, 2" keeps its space.
 */
export function tightDecimalCommas(tex: string): string {
  return tex.replace(/(?<=\d),(?=\d)/g, '{,}');
}

/**
 * Vietnamese letters inside \text{…} ("\text{tổng}") have no KaTeX font metrics; the browser draws
 * them with the UI font, which is what we want, so they are not warned about (KaTeX reported
 * 'unknownSymbol' or 'symbolNotInFont' once per letter: dozens of console lines, #342).
 */
export const KATEX_STRICT = (code: string): 'ignore' | 'warn' =>
  code === 'unknownSymbol' || code === 'symbolNotInFont' ? 'ignore' : 'warn';

/**
 * Loads KaTeX (and its CSS/fonts) on first use only — keeps app start fast. A failed load (a
 * chunk that could not be fetched) is forgotten, so a later call tries again instead of failing
 * at once for the rest of the session.
 */
export function loadKatex(): Promise<KatexModule> {
  katexPromise ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(
    ([k]) => k,
    (e: unknown) => {
      katexPromise = undefined;
      throw e;
    },
  );
  return katexPromise;
}
