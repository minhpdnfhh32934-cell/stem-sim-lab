type KatexModule = typeof import('katex');
let katexPromise: Promise<KatexModule> | undefined;

/** Loads KaTeX (and its CSS/fonts) on first use only — keeps app start fast. */
export function loadKatex(): Promise<KatexModule> {
  katexPromise ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(
    ([k]) => k,
  );
  return katexPromise;
}
