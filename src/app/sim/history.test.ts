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

  it('slow motion keeps every frame: the spacing follows the playback speed (UI-22)', () => {
    // ×0,1 at 60 frames/s: one frame = 1/600 s of simulation; a 25 Hz wave (T = 0,04 s).
    const h = new History();
    h.setTimeScale(0.1);
    for (let i = 0; i <= 60; i++) h.push(i / 600, s(Math.sin(2 * Math.PI * 25 * (i / 600))));
    expect(h.length).toBe(61);
    // At least 20 recorded states per period, all exactly as pushed (no interpolation).
    expect(h.length / (0.1 / 0.04)).toBeGreaterThanOrEqual(20);
    h.states.forEach((st, i) => {
      expect(st[0]).toBe(Math.sin(2 * Math.PI * 25 * (i / 600)));
    });
  });

  it('×1 keeps the former spacing (1/120 s), ×10 ten times wider', () => {
    const one = new History();
    for (let i = 0; i <= 600; i++) one.push(i / 600, s(i));
    expect(one.length).toBe(121);
    const ten = new History();
    ten.setTimeScale(10);
    for (let i = 0; i <= 600; i++) ten.push(i / 60, s(i));
    expect(ten.length).toBe(121);
    ten.setTimeScale(Number.NaN);
    ten.setTimeScale(0);
    ten.clear();
    for (let i = 0; i <= 60; i++) ten.push(i / 60, s(i));
    expect(ten.length).toBe(13);
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
