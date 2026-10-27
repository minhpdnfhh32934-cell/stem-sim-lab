import { describe, expect, it } from 'vitest';
import { columnFormat, formatDeviation } from './numbers';

describe('check chip deviation (UI-08)', () => {
  it('writes powers of ten as 5·10⁻¹³, never "5E-13"', () => {
    expect(formatDeviation('vi', 5e-13)).toBe('5·10⁻¹³');
    expect(formatDeviation('en', 3.2e-15)).toBe('3·10⁻¹⁵');
    // 9,6·10⁻¹¹ rounds up to 1·10⁻¹⁰, not "10·10⁻¹¹".
    expect(formatDeviation('vi', 9.6e-11)).toBe('1·10⁻¹⁰');
    expect(formatDeviation('vi', 0.03)).toBe('0,03');
    expect(formatDeviation('vi', 0)).toBe('0');
    expect(formatDeviation('vi', 1e-17)).toBe('0');
    expect(formatDeviation('vi', Number.NaN)).toBe('0');
  });
});

describe('Số liệu columns (UI-18, UI-19)', () => {
  it('the same number of decimals down a column', () => {
    const f = columnFormat('vi', [25, 25.007, 25.02, 25.06]);
    expect([25, 25.007, 25.02].map(f)).toEqual(['25,000', '25,007', '25,020']);
    const t = columnFormat('vi', [0, 0.016667, 0.05, 1.2]);
    expect([0, 0.016667, 0.05].map(t)).toEqual(['0,0000', '0,0167', '0,0500']);
  });

  it('round-off noise and −0 print as 0, without a minus sign', () => {
    const y = [0.01, 1.4164e-17, -1.4164e-17, -0, -0.0049];
    const f = columnFormat('vi', y);
    expect(y.map(f)).toEqual(['0,010000', '0,000000', '0,000000', '0,000000', '-0,004900']);
    expect(columnFormat('vi', [-0, 2.5])(-0)).toBe('0,0000');
  });

  it('very small or very large columns keep 5 significant digits, noise still 0', () => {
    const q = columnFormat('en', [1.6e-19, 3.2e-19, 1e-40]);
    expect(q(1.6e-19)).toBe('0.00000000000000000016');
    expect(q(1e-40)).toBe('0');
    expect(columnFormat('vi', [7.19e10])(7.19e10)).toBe('71.900.000.000');
  });
});
