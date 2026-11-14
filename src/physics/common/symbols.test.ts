import { describe, expect, it } from 'vitest';
import { SYM, both, plain, sym } from './symbols';

describe('textbook symbols by language (#258)', () => {
  it('keeps the SGK symbols in Vietnamese and uses English ones in English', () => {
    expect(sym('vi').kinetic).toBe('W_{\\text{đ}}');
    expect(sym('en').kinetic).toBe('K');
    expect(SYM.friction).toEqual({ vi: 'F_{ms}', en: 'f' });
    expect(both((s) => `${s.work} = F s`)).toEqual({ vi: 'A = F s', en: 'W = F s' });
  });

  it('turns a KaTeX symbol into a canvas label', () => {
    expect(plain('W_{\\text{đ}}')).toBe('W_đ');
    expect(plain('F_{\\text{đh}}')).toBe('F_đh');
    expect(plain('\\mathscr{P}')).toBe('𝒫');
    expect(plain('\\eta')).toBe('η');
    expect(plain('F_{ms}')).toBe('F_ms');
    expect(plain('F_g')).toBe('F_g');
  });
});
