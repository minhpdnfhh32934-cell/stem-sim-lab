import { describe, expect, it } from 'vitest';
import { KATEX_STRICT } from './katex';

describe("KaTeX's strict mode for SimLab", () => {
  it('Vietnamese letters in \text{…} are drawn by the UI font, never warned about (#342)', () => {
    expect(KATEX_STRICT('unknownSymbol')).toBe('ignore');
    expect(KATEX_STRICT('symbolNotInFont')).toBe('ignore');
    // Anything else KaTeX finds odd is still reported.
    expect(KATEX_STRICT('unicodeTextInMathMode')).toBe('warn');
  });
});
