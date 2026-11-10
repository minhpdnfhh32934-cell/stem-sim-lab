import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildDraft } from '@/ai/draft';
import { basicSplit } from '@/app/sim/basicParams';
import { CHALLENGES, evaluate, startParams } from '@/learn/challenges';
import { usePerfStore } from '@/perf/perfStore';
import { applyAutoDefaults } from '../autoDefaults';
import type { ParamSource } from '../types';
import { Camera } from '../render/camera';
import { CELL_PX, cellSize, drawWater, fillWater } from './draw';
import { MAX_RATIO, MODE, beatsMeasurable, interferenceInput, pointM } from './engine';
import { dragProbe, dragSource, interference as sc } from './scenes';

const answers = (p: Record<string, number>) =>
  Object.fromEntries(sc.solve({ ...sc.defaults, ...p }, 'vi').answers.map((a) => [a.id, a]));
const messages = (p: Record<string, number>) =>
  (sc.validate?.({ ...sc.defaults, ...p }) ?? []).map((m) => m.vi);

describe('interference scene: solution', () => {
  it('defaults: λ = 3 cm, 7 maxima and 6 minima between the sources, M on the first maximum', () => {
    const a = answers({});
    expect(a.wavelength?.value).toBeCloseTo(0.03, 14);
    expect(a.maxima?.value).toBe(7);
    expect(a.minima?.value).toBe(6);
    expect(a.fringe_spacing?.value).toBeCloseTo(0.015, 14);
    expect(a.path_difference?.value).toBeCloseTo(0.03, 14);
    expect(a.order?.value).toBeCloseTo(1, 12);
    expect(a.amplitude_M?.value).toBeCloseTo(4e-4, 14);
    expect(a.period?.value).toBeCloseTo(0.1, 14);
    const steps = sc.solve(sc.defaults, 'vi').steps.map((s) => s.text.vi);
    expect(steps.some((s) => s.includes('vân cực đại bậc 1'))).toBe(true);
  });

  it('every cross-check agrees: scanned counts, phasor amplitude, measured beat period', () => {
    for (const p of [
      {},
      { d: 0.12 },
      { d: 0.135, d1: 0.05, d2: 0.1 },
      { f: 18, v: 0.3 },
      { waveFrom: 1, lambda: 0.012, d1: 0.1, d2: 0.1075 },
      { mode: MODE.beats, f2: 12 },
      { mode: MODE.beats, f: 20, f2: 19.5, d1: 0.08, d2: 0.05 },
    ]) {
      const list = sc.solve({ ...sc.defaults, ...p }, 'en').answers;
      for (const a of list)
        if (a.check !== undefined)
          expect(Math.abs(a.check - a.value), `${JSON.stringify(p)} ${a.id}`).toBeLessThan(
            2e-3 * Math.max(Math.abs(a.value), 1e-9),
          );
    }
    expect(answers({}).maxima?.check).toBe(7);
    expect(answers({}).minima?.check).toBe(6);
    expect(answers({ mode: MODE.beats }).beat_period?.check).toBeDefined();
  });

  it('a whole S₁S₂/λ leaves the maxima at the sources out (strict inequality)', () => {
    // f = 18 Hz, v = 30 cm/s: λ = 5/3 cm, S₁S₂/λ = 6 (0,1 / (0,3/18) is exactly 6 here).
    const a = answers({ f: 18 });
    expect(a.maxima?.value).toBe(11);
    expect(a.maxima?.check).toBe(11);
    expect(a.minima?.value).toBe(12);
  });

  it('beats: f_b = |f₁ − f₂| and T_b = 1/f_b', () => {
    const a = answers({ mode: MODE.beats, f: 10, f2: 11 });
    expect(a.beat_frequency?.value).toBeCloseTo(1, 14);
    expect(a.beat_period?.value).toBeCloseTo(1, 14);
    expect(a.wavelength?.value).toBeCloseTo(0.03, 14);
    expect(a.wavelength2?.value).toBeCloseTo(0.3 / 11, 14);
    expect(a.max_amplitude?.value).toBeCloseTo(4e-4, 14);
    expect(a.maxima).toBeUndefined();
  });

  it('beats: every close pair on the f₂ slider is checked and agrees; far-apart ones get a note instead', () => {
    for (const f of [10, 1.5, 63, 100]) {
      let checked = 0;
      for (let i = 10; i <= 1000; i++) {
        const f2 = i / 10;
        const p = { ...sc.defaults, mode: MODE.beats, f, f2 };
        if ((sc.validate?.(p) ?? []).length > 0) continue;
        const sol = sc.solve(p, 'en');
        const close = beatsMeasurable(f, f2);
        for (const a of sol.answers) {
          if (a.check === undefined) continue;
          checked++;
          expect(close, `${String(f)} / ${String(f2)} Hz ${a.id}`).toBe(true);
          expect(Math.abs(a.check / a.value - 1), `${String(f)} / ${String(f2)} Hz`).toBeLessThan(
            3e-3,
          );
        }
        expect(sol.notes?.some((n) => n.vi.includes('không đo lại chu kì phách')) ?? false).toBe(
          !close,
        );
        expect(sol.answers.some((a) => a.check !== undefined)).toBe(close);
      }
      expect(checked).toBeGreaterThan(0);
    }
  });

  it('beats: a beat period too long to sample is not measured, and the solution says so', () => {
    // f_b = 0,01 Hz at 100 Hz (typed, below the slider step): 3,5 beat periods need 1,4·10⁶ samples.
    const sol = sc.solve({ ...sc.defaults, mode: MODE.beats, f: 100, f2: 100.01 }, 'vi');
    expect(sol.answers.every((a) => a.check === undefined)).toBe(true);
    expect(sol.notes?.some((n) => n.vi.includes('Chu kì phách rất dài')) ?? false).toBe(true);
    // Close pairs that used to exceed the limit (30 / 30,1 Hz, 100 / 99,7 Hz) are measured now.
    for (const [f, f2] of [
      [30, 30.1],
      [100, 99.7],
    ] as const) {
      const a = answers({ mode: MODE.beats, f, f2 });
      expect(a.beat_period?.check, `${String(f)} / ${String(f2)}`).toBeDefined();
    }
  });

  it('one maximum on S₁S₂: no spacing of neighbouring maxima', () => {
    const a = answers({ d: 0.02, d1: 0.018, d2: 0.024 });
    expect(a.maxima?.value).toBe(1);
    expect(a.fringe_spacing).toBeUndefined();
    const steps = sc.solve({ ...sc.defaults, d: 0.02, d1: 0.018, d2: 0.024 }, 'vi').steps;
    expect(steps.some((st) => st.text.vi.includes('chỉ có cực đại trung tâm'))).toBe(true);
    expect(answers({}).fringe_spacing?.value).toBeCloseTo(0.015, 14);
  });

  it('λ given: v = λf', () => {
    const a = answers({ waveFrom: 1, lambda: 0.015, f: 20 });
    expect(a.speed?.value).toBeCloseTo(0.3, 14);
    expect(a.maxima?.value).toBe(13);
  });

  it('large amplitude (2a·k > 0,1): the card drops to approx and the solution says so', () => {
    expect(sc.scienceCard(sc.defaults).confidence).toBe('exact');
    const big = { ...sc.defaults, a: 0.002 };
    expect(sc.scienceCard(big).confidence).toBe('approx');
    expect(sc.solve(big, 'vi').notes?.length).toBe(1);
  });
});

describe('interference scene: validation', () => {
  it('defaults are valid', () => {
    expect(messages({})).toEqual([]);
    expect(messages({ mode: MODE.beats })).toEqual([]);
  });

  it('M must exist: |d₁ − d₂| ≤ S₁S₂ ≤ d₁ + d₂', () => {
    expect(messages({ d1: 0.02, d2: 0.15 })[0]).toContain('Không có điểm M');
    expect(messages({ d1: 0.02, d2: 0.03 })[0]).toContain('Không có điểm M');
  });

  it('equal frequencies in the beats mode, non-positive values, too many wavelengths', () => {
    expect(messages({ mode: MODE.beats, f2: 10 })[0]).toContain('không có phách');
    expect(messages({ d: 0 })[0]).toContain('S₁S₂');
    expect(messages({ waveFrom: 1, lambda: 0 })[0]).toContain('Bước sóng');
    expect(messages({ v: 0.001, d: 0.5, d1: 0.4, d2: 0.4 })[0]).toContain(String(MAX_RATIO));
  });
});

describe('interference scene: reading a problem', () => {
  it('f₂ stated → beats; λ stated without v → λ; M not stated follows S₁S₂', () => {
    const src = (keys: string[]): Record<string, ParamSource> =>
      Object.fromEntries(
        sc.params.map((d) => [d.key, keys.includes(d.key) ? 'problem' : 'default']),
      );
    const p1 = applyAutoDefaults(sc, { ...sc.defaults, f2: 12 }, src(['f2']));
    expect(p1.mode).toBe(MODE.beats);
    const p2 = applyAutoDefaults(sc, { ...sc.defaults, lambda: 0.02 }, src(['lambda']));
    expect(p2.waveFrom).toBe(1);
    const p3 = applyAutoDefaults(sc, { ...sc.defaults, d: 0.3 }, src(['d']));
    expect(p3.d1).toBeCloseTo(0.27, 14);
    expect(p3.d2).toBeCloseTo(0.36, 14);
    expect(pointM(0.3, p3.d1 ?? 0, p3.d2 ?? 0)).not.toBeNull();
  });

  it('a counting problem asks for nothing else; a λ-only problem asks for f', () => {
    const text =
      'Hai nguồn kết hợp A, B cách nhau 12 cm dao động cùng pha với tần số 20 Hz. Tốc độ truyền sóng là 30 cm/s.';
    const draft = buildDraft(
      sc,
      {
        quantities: [
          { key: 'd', value: 12, unit: 'cm', quote: 'cách nhau 12 cm' },
          { key: 'f', value: 20, unit: 'Hz', quote: 'tần số 20 Hz' },
          { key: 'v', value: 30, unit: 'cm/s', quote: 'Tốc độ truyền sóng là 30 cm/s' },
        ],
        questions: [],
        assumptions: [],
        unsupported_parts: [],
        clarifications: [],
      },
      text,
      9.81,
    );
    expect(draft.missing).toEqual([]);
    expect(sc.validate?.(draft.params)).toEqual([]);
    const lambdaOnly = buildDraft(
      sc,
      {
        quantities: [
          { key: 'd', value: 10, unit: 'cm', quote: 'cách nhau 10 cm' },
          { key: 'lambda', value: 1.5, unit: 'cm', quote: 'bước sóng 1,5 cm' },
        ],
        questions: [],
        assumptions: [],
        unsupported_parts: [],
        clarifications: [],
      },
      'Hai nguồn A, B cách nhau 10 cm, bước sóng 1,5 cm.',
      9.81,
    );
    expect(lambdaOnly.params.waveFrom).toBe(1);
    expect(lambdaOnly.missing).toEqual(['f']);
  });

  it('Basic mode shows the main parameters first', () => {
    const visible = (p: Record<string, number>) =>
      sc.params.filter((d) => !d.when || d.when({ ...sc.defaults, ...p }));
    const main = (p: Record<string, number>) => basicSplit(visible(p), {}).main.map((d) => d.key);
    expect(main({})).toEqual(['mode', 'd', 'f', 'v', 'a']);
    expect(main({ mode: MODE.beats })).toEqual(['mode', 'd', 'f', 'f2', 'v']);
  });
});

describe('interference scene: dragging', () => {
  it('a dragged source sets S₁S₂ = 2|x| (both move): free while M follows, kept so a stated M exists', () => {
    const p = { ...sc.defaults, d1: 0.09, d2: 0.12 };
    const auto: Record<string, ParamSource> = {};
    const stated: Record<string, ParamSource> = { d1: 'problem', d2: 'problem' };
    expect(dragSource(0.06, p, auto)).toEqual({ d: 0.12 });
    expect(dragSource(-0.06, p, auto)).toEqual({ d: 0.12 });
    // A fast drag reaches the pointer when M is not stated (M then follows S₁S₂).
    expect(dragSource(0.13, p, auto)).toEqual({ d: 0.26 });
    // Stated M: |d₁ − d₂| = 3 cm ≤ S₁S₂ ≤ d₁ + d₂ = 21 cm.
    expect(dragSource(0.001, p, stated)).toEqual({ d: 0.03 });
    expect(dragSource(0.4, p, stated)).toEqual({ d: 0.21 });
    // The slider's range: 1 cm … 50 cm.
    expect(dragSource(0, p, auto)).toEqual({ d: 0.01 });
    expect(dragSource(0.4, p, auto)).toEqual({ d: 0.5 });
    // M placed by the learner keeps its place on the water: d₁, d₂ follow the sources.
    const placed: Record<string, ParamSource> = { d1: 'user', d2: 'user' };
    const m0 = interferenceInput(p).m;
    const next = dragSource(0.15, p, placed);
    expect(next.d).toBe(0.3);
    const m1 = interferenceInput({ ...p, ...next }).m;
    expect(m1?.x).toBeCloseTo(m0?.x ?? NaN, 3);
    expect(m1?.y).toBeCloseTo(m0?.y ?? NaN, 3);
  });

  it('many source drags leave a learner-placed M where it was, even on or near S₁S₂', () => {
    const placed: Record<string, ParamSource> = { d1: 'user', d2: 'user' };
    for (const [mx, my] of [
      [0.02, -0.03],
      [0.03, 0.002],
      [0.01, 0.003],
      [0.07, 0.001],
    ] as const) {
      let p: Record<string, number> = { ...sc.defaults, ...dragProbe(mx, my, sc.defaults) };
      const m0 = interferenceInput(p).m;
      // Out to S₁S₂ = 40 cm and back to 10 cm in small pointer moves.
      for (let i = 1; i <= 60; i++) p = { ...p, ...dragSource(0.05 + 0.0025 * i, p, placed) };
      for (let i = 59; i >= 0; i--) p = { ...p, ...dragSource(0.05 + 0.0025 * i, p, placed) };
      const m1 = interferenceInput(p).m;
      expect(
        Math.abs((m1?.x ?? NaN) - (m0?.x ?? NaN)),
        `M at (${String(mx)}, ${String(my)})`,
      ).toBeLessThan(1e-6);
      expect(
        Math.abs((m1?.y ?? NaN) - (m0?.y ?? NaN)),
        `M at (${String(mx)}, ${String(my)})`,
      ).toBeLessThan(1e-6);
    }
  });

  it('a dragged M takes its distances to the sources (drawn on the side y ≥ 0)', () => {
    const p = { ...sc.defaults };
    const next = dragProbe(0.01, 0.04, p);
    const m = interferenceInput({ ...p, ...next }).m;
    expect(m?.x).toBeCloseTo(0.01, 3);
    expect(m?.y).toBeCloseTo(0.04, 3);
    // Below S₁S₂ the pointer keeps M on the line, never on the mirror point.
    const below = interferenceInput({ ...p, ...dragProbe(0.01, -0.04, p) }).m;
    expect(below?.x).toBeCloseTo(0.01, 3);
    expect(below?.y).toBeCloseTo(0, 3);
    for (const b of sc.bodies) expect(b.dragTo, b.id).toBeDefined();
  });

  it('the challenge “9 maxima” is not spoilt by dragging M', () => {
    const c = CHALLENGES.find((x) => x.id === 'interference.max9');
    if (!c) throw new Error('interference.max9');
    const sources: Record<string, ParamSource> = Object.fromEntries(
      sc.params.map((d) => [d.key, 'default']),
    );
    const start = startParams(sc, c);
    const after = { ...sources, d: 'user' as const, d1: 'user' as const, d2: 'user' as const };
    // M dragged anywhere (above, near the middle, below S₁S₂), then a source dragged to 13 cm.
    for (const [mx, my] of [
      [0.02, 0.1],
      [0, 0.01],
      [0.02, -0.03],
    ] as const) {
      const withM = { ...start, ...dragProbe(mx, my, start) };
      const moved = { ...withM, ...dragSource(0.065, withM, after) };
      expect(moved.d, `M at (${String(mx)}, ${String(my)})`).toBeCloseTo(0.13, 12);
      expect(sc.validate?.(moved)).toEqual([]);
      expect(evaluate(sc, c, moved, after).state, `M at (${String(mx)}, ${String(my)})`).toBe(
        'done',
      );
    }
  });
});

describe('interference scene: water picture', () => {
  afterEach(() => {
    usePerfStore.setState({ preference: 'auto', degraded: false });
  });

  it('a cell on a minimum (path difference λ/2) stays calm; on the central maximum it swings', () => {
    const q = interferenceInput(sc.defaults);
    const data = new Uint8ClampedArray(8);
    // Two cells, centred at x = λ/4 (r₁ − r₂ = λ/2) and x = 0 on S₁S₂ (y = 0).
    const step = q.lambda1 / 4;
    for (const t of [0, 0.013, 0.031, 0.07]) {
      // A negative step walks right to left: centres x₀ + (i + ½)·(−λ/4) = λ/4, 0; y = 0.
      fillWater(data, 2, 1, 1.5 * step, -0.5 * step, -step, q, t, '#0072b2', '#d55e00');
      expect(data[3], `t = ${String(t)}`).toBe(0);
      const u = Math.cos(2 * Math.PI * 10 * t - ((2 * Math.PI) / q.lambda1) * (q.d / 2));
      expect(Math.abs((data[7] ?? 0) - 204 * Math.abs(u))).toBeLessThanOrEqual(0.5 + 1e-9);
      expect(data[4]).toBe(u >= 0 ? 0x00 : 0xd5);
    }
  });

  it('the overload ladder only coarsens the picture, never removes it', () => {
    expect(CELL_PX.low).toBeGreaterThan(CELL_PX.medium);
    expect(CELL_PX.medium).toBeGreaterThan(CELL_PX.high);
    // A wide wavelength: each tier's own cell.
    expect(cellSize('high', 100)).toBe(CELL_PX.high);
    expect(cellSize('low', 100)).toBe(CELL_PX.low);
    // λ = 10 px: a lower tier would alias with its 3–4 px cells, so it keeps 2 px (λ/4 at most).
    expect(cellSize('medium', 10)).toBe(2);
    expect(cellSize('low', 10)).toBe(2);
    expect(cellSize('low', 5)).toBe(1);
    // Only under 4 px per λ is there no picture, on every tier.
    expect(cellSize('high', 3.9)).toBeNull();
    const q = interferenceInput(sc.defaults);
    const cam = new Camera();
    cam.resize(800, 600);
    cam.fit({ xMin: 0, xMax: 300 * q.lambda1, yMin: -1, yMax: 1 }, 0);
    expect(q.lambda1 * cam.scale).toBeLessThan(4);
    const ctx = { drawImage: () => undefined } as unknown as CanvasRenderingContext2D;
    usePerfStore.setState({ preference: 'high', degraded: false });
    expect(drawWater(ctx, cam, q, 0, '#000', '#fff')).toBe(false);
  });

  it('one overload step at λ = 10 px still draws the water, with 2 px cells', () => {
    // jsdom has no 2D canvas: a stand-in that keeps the image data.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      createImageData: (w: number, h: number) => ({
        width: w,
        height: h,
        data: new Uint8ClampedArray(4 * w * h),
      }),
      putImageData: () => undefined,
    } as unknown as CanvasRenderingContext2D);
    const q = interferenceInput(sc.defaults);
    const cam = new Camera();
    cam.resize(800, 600);
    cam.fit({ xMin: 0, xMax: 80 * q.lambda1, yMin: -0.1, yMax: 0.1 }, 0);
    expect(q.lambda1 * cam.scale).toBeCloseTo(10, 9);
    const drawImage = vi.fn();
    const ctx = { drawImage } as unknown as CanvasRenderingContext2D;
    // High, one step down: Medium (3 px cells would alias at 10 px per λ).
    usePerfStore.setState({ preference: 'high', degraded: true });
    expect(drawWater(ctx, cam, q, 0, '#000', '#fff')).toBe(true);
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(drawImage.mock.calls[0]?.[3]).toBe(Math.ceil(800 / 2) * 2);
    vi.restoreAllMocks();
  });

  it('the numbers do not depend on the tier', () => {
    // The numbers do not depend on the tier.
    const before = sc.solve(sc.defaults, 'vi').answers;
    usePerfStore.setState({ preference: 'low', degraded: true });
    expect(sc.solve(sc.defaults, 'vi').answers).toEqual(before);
  });
});
