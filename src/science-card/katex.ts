type KatexModule = typeof import('katex');
let katexPromise: Promise<KatexModule> | undefined;

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
