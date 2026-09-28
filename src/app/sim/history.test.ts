import { describe, expect, it } from 'vitest';
import { toCsv } from './data';
import { History } from './history';

const s = (...v: number[]) => Float64Array.from(v);

describe('History', () => {
  it('keeps samples at the minimum spacing and interpolates between them', () => {
    const h = new History(0.1, 100);
    h.push(0, s(0));
    h.push(0.05, s(5)); // too close: skipped
    h.push(0.1, s(10));
    h.push(0.2, s(20));
    expect(h.length).toBe(3);
    expect(h.stateAt(0.15)![0]).toBeCloseTo(15, 12);
    expect(h.stateAt(5)![0]).toBe(20); // clamped
  });

  it('truncates when time goes backwards (resume after scrubbing)', () => {
    const h = new History(0.1, 100);
    for (let i = 0; i <= 10; i++) h.push(i / 10, s(i));
    h.push(0.35, s(99));
    expect(h.duration).toBeCloseTo(0.35, 12);
    expect(h.times.at(-2)).toBeCloseTo(0.3, 12);
  });

  it('decimates instead of growing without bound', () => {
    const h = new History(0.01, 50);
    for (let i = 0; i < 500; i++) h.push(i * 0.01, s(i));
    expect(h.length).toBeLessThanOrEqual(51);
    expect(h.duration).toBeGreaterThan(4);
  });
});

describe('CSV export', () => {
  it('writes a BOM, quoted headers and CRLF rows', () => {
    const csv = toCsv(
      ['t (s)', 'x, m'],
      [
        [0, 1.5],
        [0.1, Number.NaN],
      ],
    );
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('"x, m"');
    expect(csv).toContain('0.1,\r\n');
  });
});
