import { describe, expect, it } from 'vitest';
import { Camera } from '../render/camera';
import type { DrawOptions, ThemeColors } from '../types';
import { STRING_POINTS, verticalScale } from './draw';
import { MODE, SW, standingInput } from './engine';
import { harmonicFrequency } from './model';
import { probeAmplitude, standingWave as sc } from './scenes';

const answers = (p: Record<string, number>) =>
  Object.fromEntries(sc.solve({ ...sc.defaults, ...p }, 'vi').answers.map((a) => [a.id, a]));
const messages = (p: Record<string, number>) =>
  (sc.validate?.({ ...sc.defaults, ...p }) ?? []).map((m) => m.vi);

describe('standing wave scene: solution', () => {
  it('defaults: f = 25 Hz, λ = 0,8 m, 4 nodes, 3 antinodes, 2A at the antinode probe', () => {
    const a = answers({});
    expect(a.frequency?.value).toBeCloseTo(25, 12);
    expect(a.wavelength?.value).toBeCloseTo(0.8, 12);
    expect(a.nodes?.value).toBe(4);
    expect(a.antinodes?.value).toBe(3);
    expect(a.node_spacing?.value).toBeCloseTo(0.4, 12);
    expect(a.antinode_amplitude?.value).toBeCloseTo(0.02, 12);
    expect(a.probe_amplitude?.value).toBeCloseTo(0.02, 12);
    expect(a.period?.value).toBeCloseTo(0.04, 12);
  });

  it('every mode agrees with its DOPRI5 lattice check', () => {
    for (const p of [
      {},
      { mode: MODE.speed, f: 50, n: 4 },
      { mode: MODE.harmonic, f: 25 },
      { vFrom: 1, tension: 8 },
      { mode: MODE.harmonic, vFrom: 1, tension: 2, muL: 0.005, f: 125 / 3 },
    ]) {
      for (const a of sc.solve({ ...sc.defaults, ...p }, 'en').answers)
        if (a.check !== undefined) expect(Math.abs(a.check / a.value - 1)).toBeLessThan(1e-8);
    }
    expect(answers({}).frequency?.check).toBeDefined();
    expect(answers({ mode: MODE.speed, f: 50, n: 4 }).speed?.check).toBeDefined();
    expect(answers({ mode: MODE.harmonic, f: 25 }).harmonic?.check).toBeDefined();
  });

  it('three modes describe the same string: L, v, n → f; L, f, n → v; L, f, v → n', () => {
    expect(answers({ mode: MODE.speed, f: 25, n: 3 }).speed?.value).toBeCloseTo(20, 12);
    expect(answers({ mode: MODE.harmonic, f: 25 }).harmonic?.value).toBe(3);
    // v = √(F/μ): F × 4 doubles v, hence f.
    expect(answers({ vFrom: 1, tension: 8 }).frequency?.value).toBeCloseTo(50, 12);
    expect(answers({ vFrom: 1, tension: 8 }).speed?.value).toBeCloseTo(40, 12);
  });

  it('a probe on a node has amplitude exactly 0', () => {
    expect(probeAmplitude(standingInput({ ...sc.defaults, xP: 0.4 }))).toBe(0);
    expect(answers({ xP: 1.2 }).probe_amplitude?.value).toBe(0);
  });
});

describe('standing wave scene: trap 5 (2Lf/v is never rounded)', () => {
  it('a non-whole ratio is reported with the resonances below and above, f unchanged', () => {
    const p = { mode: MODE.harmonic, f: 30 };
    const msg = messages(p);
    expect(msg).toHaveLength(1);
    expect(msg[0]).toContain('3,6');
    expect(msg[0]).toContain('f₃ = 25 Hz');
    expect(msg[0]).toContain('f₄ = 33,33 Hz');
    const a = answers(p);
    expect(a.harmonic).toBeUndefined();
    expect(a.ratio?.value).toBeCloseTo(3.6, 12);
    expect(a.f_below?.value).toBeCloseTo(harmonicFrequency(3, 20, 1.2), 12);
    expect(a.f_above?.value).toBeCloseTo(harmonicFrequency(4, 20, 1.2), 12);
    expect(standingInput({ ...sc.defaults, ...p }).f).toBe(30);
  });

  it('below the fundamental only f₁ is suggested', () => {
    const msg = messages({ mode: MODE.harmonic, f: 5 });
    expect(msg[0]).toContain('f₁ = 8,333 Hz');
    expect(answers({ mode: MODE.harmonic, f: 5 }).f_below).toBeUndefined();
  });

  it('a ratio off by round-off only is accepted (L = 0,7 m, f = 50 Hz, v = 35 m/s → n = 2)', () => {
    const p = { mode: MODE.harmonic, L: 0.7, f: 50, v: 35, xP: 0.1 };
    expect(messages(p)).toEqual([]);
    expect(answers(p).harmonic?.value).toBe(2);
  });

  it('other invalid inputs are reported', () => {
    expect(messages({})).toEqual([]);
    expect(messages({ n: 2.5 })[0]).toContain('số nguyên dương');
    expect(messages({ xP: 1.5 })[0]).toContain('x_P');
    expect(messages({ L: 0 }).length).toBeGreaterThan(0);
    expect(messages({ vFrom: 1, muL: 0 }).length).toBeGreaterThan(0);
  });
});

describe('standing wave scene: card, picture', () => {
  it('Science Card: exact, all parts present, sources, no Vietnamese inside \\text{}', () => {
    const card = sc.scienceCard(sc.defaults);
    expect(card.confidence).toBe('exact');
    expect(card.equations.length).toBeGreaterThanOrEqual(4);
    expect(card.assumptions.length).toBeGreaterThanOrEqual(5);
    expect(card.sources.length).toBeGreaterThanOrEqual(2);
    expect(card.validity.vi.length).toBeGreaterThan(0);
    for (const e of card.equations) expect(e.tex).not.toMatch(/\\text\{[^}]*[^\x20-\x7e}]/);
    expect(card.assumptions.some((a) => a.vi.includes('2A'))).toBe(true);
  });

  it('nothing is draggable', () => {
    for (const b of sc.bodies) expect(b.draggable).toBe(false);
  });

  it('draws the string with ≥ 200 points, stretched vertically by a nice factor', () => {
    expect(STRING_POINTS).toBeGreaterThanOrEqual(200);
    expect(verticalScale(standingInput(sc.defaults))).toBe(5);
    expect(verticalScale(standingInput({ ...sc.defaults, A: 0.1 }))).toBe(1);
    let lineTo = 0;
    const texts: string[] = [];
    const ctx = new Proxy(
      {},
      {
        get: (_t, k) =>
          k === 'lineTo'
            ? () => lineTo++
            : k === 'fillText'
              ? (s: string) => texts.push(s)
              : () => undefined,
        set: () => true,
      },
    ) as CanvasRenderingContext2D;
    const cam = new Camera();
    cam.fit(sc.view(sc.defaults));
    const state = new Float64Array(4);
    state[SW.phi] = Math.PI / 2;
    const colors = new Proxy({}, { get: () => '#000' }) as ThemeColors;
    const opts: DrawOptions = {
      vectors: false,
      intervened: false,
      trail: false,
      selected: null,
      locale: 'vi',
      colors,
      time: 0,
    };
    sc.draw({ ctx, cam, state, p: sc.defaults, opts });
    expect(lineTo).toBeGreaterThanOrEqual(4 * (STRING_POINTS - 1));
    expect(texts.filter((s) => s === 'N')).toHaveLength(4);
    expect(texts.filter((s) => s === 'B')).toHaveLength(3);
    expect(texts.some((s) => s.includes('×5'))).toBe(true);
  });
});
