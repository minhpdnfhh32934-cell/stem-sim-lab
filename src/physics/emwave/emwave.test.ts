import { describe, expect, it } from 'vitest';
import { emCard } from './card';
import {
  C_SGK,
  C_SI,
  EM_BANDS,
  bandsOf,
  frequencyOf,
  frequencyRange,
  lengthText,
  periodOf,
  sci,
  wavelengthOf,
} from './model';
import { setEm, useEmStore } from './store';

const ids = (lambda: number) => bandsOf(lambda).map((b) => b.id);

describe('electromagnetic waves (VL11 Bài 11)', () => {
  it('the textbook’s Bảng 11.1 and gamma rays (tr. 47), in metres', () => {
    const range = Object.fromEntries(EM_BANDS.map((b) => [b.id, [b.min, b.max]]));
    expect(range).toEqual({
      radio: [1e-3, 1e5],
      microwave: [1e-3, 1],
      ir: [7.6e-7, 1e-3],
      visible: [3.8e-7, 7.6e-7],
      uv: [1e-9, 3.8e-7],
      xray: [3e-11, 3e-9],
      gamma: [1e-14, 1e-10],
    });
    expect(C_SGK).toBe(3e8);
    // The textbook's rounding is within 0,07 % of the SI value.
    expect(Math.abs(C_SGK / C_SI - 1)).toBeLessThan(7e-4);
  });

  it('question 2 (tr. 47): the band of each wavelength', () => {
    expect(ids(1e3)).toEqual(['radio']);
    expect(ids(3e-2)).toEqual(['radio', 'microwave']);
    expect(ids(5e-6)).toEqual(['ir']);
    expect(ids(500e-9)).toEqual(['visible']);
    expect(ids(50e-9)).toEqual(['uv']);
    expect(ids(1e-12)).toEqual(['gamma']);
  });

  it('question 3 (tr. 47): the band of each frequency, with λ = c/f', () => {
    expect(ids(wavelengthOf(200e3))).toEqual(['radio']);
    expect(ids(wavelengthOf(100e6))).toEqual(['radio']);
    expect(wavelengthOf(5e14)).toBeCloseTo(6e-7, 20);
    expect(ids(wavelengthOf(5e14))).toEqual(['visible']);
    expect(ids(wavelengthOf(1e18))).toEqual(['xray']);
  });

  it('borders belong to both neighbours; overlaps and the scale’s ends', () => {
    expect(ids(3.8e-7)).toEqual(['visible', 'uv']);
    expect(ids(7.6e-7)).toEqual(['ir', 'visible']);
    expect(ids(5e-11)).toEqual(['xray', 'gamma']);
    expect(ids(2e-9)).toEqual(['uv', 'xray']);
    expect(ids(1e-15)).toEqual([]);
    expect(ids(2e5)).toEqual([]);
  });

  it('f = c/λ, T = λ/c, and the activity of tr. 47: each band’s frequency range', () => {
    expect(frequencyOf(3)).toBeCloseTo(1e8, 6);
    expect(periodOf(3)).toBeCloseTo(1e-8, 20);
    const vis = EM_BANDS.find((b) => b.id === 'visible');
    if (!vis) throw new Error('no visible band');
    const r = frequencyRange(vis);
    // Hình 11.3 marks visible light from about 4·10¹⁴ Hz to 7·10¹⁴ Hz.
    expect(r.min).toBeCloseTo(3.947e14, -11);
    expect(r.max).toBeCloseTo(7.895e14, -11);
  });

  it('numbers as the textbook writes them', () => {
    expect(sci('vi', 5e14)).toBe('5·10¹⁴');
    expect(sci('vi', 3.8e-7)).toBe('3,8·10⁻⁷');
    expect(sci('en', 3.8e-7)).toBe('3.8·10⁻⁷');
    expect(sci('vi', 9.9996e14)).toBe('10¹⁵');
    expect(sci('vi', 1e-12)).toBe('10⁻¹²');
    expect(sci('vi', 0.76)).toBe('0,76');
    expect(lengthText('vi', 1e5)).toBe('100 km');
    expect(lengthText('vi', 7.6e-7)).toBe('760 nm');
    expect(lengthText('vi', 3e-11)).toBe('30 pm');
    // The textbook writes the shortest gamma rays as 10⁻⁵ nm (tr. 47).
    expect(lengthText('vi', 1e-14)).toBe('10⁻⁵ nm');
    expect(lengthText('vi', 1e-3)).toBe('1 mm');
    expect(lengthText('vi', 3e-2)).toBe('3 cm');
  });

  it('the store keeps λ on the scale and ignores bad input', () => {
    setEm({ lambda: 1e-20 });
    expect(useEmStore.getState().lambda).toBe(1e-14);
    setEm({ lambda: -1, given: 'x', lUnit: 'mile' });
    expect(useEmStore.getState()).toMatchObject({ lambda: 1e-14, given: 'lambda', lUnit: 'nm' });
    setEm({ lambda: 5e-7, given: 'f', fUnit: 'GHz' });
    expect(useEmStore.getState()).toMatchObject({ lambda: 5e-7, given: 'f', fUnit: 'GHz' });
    setEm({ given: 'lambda', fUnit: 'THz' });
  });

  it('the card cites Bài 11 with its pages and states the textbook’s c', () => {
    const card = emCard();
    expect(card.sources.map((s) => s.id)).toContain('sgk-vl11-kntt-b11');
    expect(
      card.equations.some((e) =>
        (typeof e.tex === 'string' ? e.tex : e.tex.vi).includes('3\\cdot 10^{8}'),
      ),
    ).toBe(true);
  });
});
