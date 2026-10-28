import { describe, expect, it } from 'vitest';
import { texNum, texNumbers } from './tex';

describe('texNum', () => {
  it('groups thousands in Vietnamese like formatNumber; English stays ungrouped', () => {
    expect(texNum('vi', 35950)).toBe('35{.}950');
    expect(texNum('en', 35950)).toBe('35950');
    expect(texNum('vi', 8000)).toBe('8{.}000');
    expect(texNum('vi', -1234.5)).toBe('-1{.}235');
    expect(texNum('vi', 9.81)).toBe('9{,}81');
    expect(texNum('en', 9.81)).toBe('9.81');
    expect(texNum('vi', 999.5)).toBe('999{,}5');
    expect(texNum('vi', 123456)).toBe('123{.}500');
    expect(texNum('vi', 1.6e-19)).toBe('1{,}6 \\cdot 10^{-19}');
  });
});

describe('texNumbers (one meaning per written number)', () => {
  it('reads back exactly what texNum wrote, in both languages', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    for (let i = 0; i < 4000; i++) {
      const v = rnd() * 10 ** Math.round(rnd() * 12);
      const sig = 2 + (i % 4);
      for (const locale of ['vi', 'en'] as const) {
        const tex = texNum(locale, v, sig);
        const shown = Math.abs(Number(v.toPrecision(sig)));
        const read = texNumbers(tex);
        expect(read, `${locale} ${tex}`).toHaveLength(1);
        expect(read[0] ?? NaN, `${locale} ${tex}`).toBeCloseTo(shown, 12 - Math.log10(shown || 1));
      }
    }
  });

  it('never gives the readings of free text', () => {
    expect(texNumbers('9{,}81')).toEqual([9.81]);
    expect(texNumbers('35{.}950')).toEqual([35950]);
    expect(texNumbers('1{.}234{,}5')).toEqual([1234.5]);
    expect(texNumbers('9.81')).toEqual([9.81]);
    expect(texNumbers('8{,}011 \\cdot 10^{-16}\\,\\text{N}')[0]).toBeCloseTo(8.011e-16, 28);
    expect(texNumbers('y = 45 + 0t - \\tfrac{1}{2}\\cdot 9{,}81\\,t^2')).toEqual([
      45, 0, 1, 2, 9.81, 2,
    ]);
  });
});
