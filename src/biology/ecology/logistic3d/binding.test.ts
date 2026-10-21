import { describe, expect, it } from 'vitest';
import { SERIES_VARS } from '@/ui/charts/uplot';
import { drawScale } from '../../view3d/sampling';
import { FIGURE_CLEARANCE } from '../../genetics/hw3d/layout';
import { logistic, logisticInflection } from '../ecology';
import {
  CAPACITY_TOKEN,
  LEGIBLE_FIGURES,
  POPULATION_TOKEN,
  curvePoints,
  figureCap,
  grazedPatches,
  growthRate,
  logisticModel3d,
  momentAt,
  parseSelection,
  selectionId,
  tStarInRun,
} from './binding';
import {
  CALLOUTS,
  arrowScale,
  gaugeMarks,
  momentLabel,
  readout,
  scaleText,
  selectionCard,
} from './facts';
import {
  closeupPoints,
  crowdSlots,
  fenceRadius,
  figurePoints,
  foodCount,
  foodPoints,
  gaugePoints,
  logiLayout,
  logiPlants,
  subjectPoints,
} from './layout';
import { plantCounts } from '../../genetics/hw3d/layout';

/** The lesson's defaults (store.ts). */
const LESSON = { N0: 10, r: 0.5, K: 1000, tEnd: 30 };
/** N₀ above K: the population falls towards K. */
const FALLING = { N0: 1500, r: 0.5, K: 500, tEnd: 20 };
const fmt = (v: number, d = 3) =>
  new Intl.NumberFormat('en-US', { maximumSignificantDigits: d, useGrouping: false }).format(v);

describe('logistic 3D: model → scene numbers', () => {
  it('draws at most a legible crowd, from the tier’s instance share', () => {
    expect(figureCap(4000)).toBe(LEGIBLE_FIGURES);
    expect(figureCap(10000)).toBe(LEGIBLE_FIGURES);
    expect(figureCap(1500)).toBe(LEGIBLE_FIGURES);
    expect(figureCap(100)).toBe(60);
  });

  it('one figure per `per` individuals for the whole run, a nice step', () => {
    const m = logisticModel3d(LESSON, 200);
    const peak = logistic(10, 0.5, 1000, 30);
    expect(m.peak).toBeCloseTo(peak, 9);
    expect(m.per).toBe(drawScale(Math.max(peak, 1000), 200));
    expect(m.per).toBe(5);
    expect(m.slots).toBe(Math.round(peak / 5));
    expect(m.kSlots).toBe(200);
    expect(m.top).toBeCloseTo(1.08 * 1000, 9);
    expect(m.maxRate).toBe(125);
    expect(m.arrowRef).toBe(125);
    // A small population is drawn one figure per individual.
    const small = logisticModel3d({ N0: 5, r: 0.4, K: 100, tEnd: 30 }, 200);
    expect(small.per).toBe(1);
    expect(small.kSlots).toBe(100);
    // A run that stays far below K keeps the scale K needs (the fence holds K figures).
    const slow = logisticModel3d({ N0: 1, r: 0.05, K: 2000, tEnd: 30 }, 200);
    expect(slow.peak).toBeLessThan(10);
    expect(slow.per).toBe(10);
    expect(slow.kSlots).toBe(200);
    expect(momentAt(slow, 0).shown).toBe(0);
  });

  it('every moment: round(N(t) / per) figures, the column at N / top, dN/dt from the model', () => {
    const m = logisticModel3d(LESSON, 200);
    for (const t of [0, 0.4, 5, 9.19, 12, 17.5, 30]) {
      const now = momentAt(m, t);
      const N = logistic(10, 0.5, 1000, t);
      expect(now.N).toBeCloseTo(N, 9);
      expect(now.shown).toBe(Math.round(N / m.per));
      expect(now.fill).toBeCloseTo(N / m.top, 12);
      expect(now.ratio).toBeCloseTo(N / 1000, 12);
      expect(now.dNdt).toBeCloseTo(0.5 * N * (1 - N / 1000), 9);
      expect(now.perCapita).toBeCloseTo(0.5 * (1 - N / 1000), 12);
      expect(now.arrow).toBeCloseTo(now.dNdt / 125, 12);
    }
    // Times outside the run are clamped to it.
    expect(momentAt(m, -3).t).toBe(0);
    expect(momentAt(m, 99).t).toBe(30);
    expect(momentAt(m, Number.NaN).t).toBe(0);
  });

  it('the figures grow in number as t grows, and the first ones stay where they are', () => {
    const m = logisticModel3d(LESSON, 200);
    let last = -1;
    for (let t = 0; t <= 30; t += 0.25) {
      const shown = momentAt(m, t).shown;
      expect(shown).toBeGreaterThanOrEqual(last);
      last = shown;
    }
    const early = crowdSlots(momentAt(m, 6).shown, m.kSlots);
    const late = crowdSlots(momentAt(m, 20).shown, m.kSlots);
    expect(late.length).toBeGreaterThan(early.length);
    expect(late.slice(0, early.length)).toEqual(early);
  });

  it('N₀ > K: the population falls towards K and the arrow points down', () => {
    const m = logisticModel3d(FALLING, 200);
    expect(m.peak).toBe(1500);
    expect(m.per).toBe(drawScale(1500, 200));
    expect(m.kSlots).toBe(Math.round(500 / m.per));
    expect(m.arrowRef).toBeCloseTo(Math.abs(growthRate(0.5, 500, 1500)), 9);
    let last = Infinity;
    for (let t = 0; t <= 20; t += 0.5) {
      const now = momentAt(m, t);
      expect(now.shown).toBeLessThanOrEqual(last);
      expect(now.N).toBeGreaterThan(500);
      expect(now.arrow).toBeLessThan(0);
      expect(now.arrow).toBeGreaterThanOrEqual(-1 - 1e-12);
      last = now.shown;
    }
    expect(momentAt(m, 0).arrow).toBeCloseTo(-1, 12);
    expect(tStarInRun(m)).toBe(false);
  });

  it('t* is the formula’s inflection: N = K/2 and the arrow at its longest', () => {
    const m = logisticModel3d(LESSON, 200);
    expect(m.tStar).toBeCloseTo(Math.log(1000 / 10 - 1) / 0.5, 12);
    expect(m.tStar).toBe(logisticInflection(10, 0.5, 1000));
    expect(tStarInRun(m)).toBe(true);
    const at = momentAt(m, m.tStar);
    expect(at.N).toBeCloseTo(500, 9);
    expect(at.arrow).toBeCloseTo(1, 9);
    expect(at.dNdt).toBeCloseTo(m.maxRate, 9);
    // No inflection: N₀ ≥ K/2, or after the time span.
    expect(tStarInRun(logisticModel3d({ ...LESSON, N0: 600 }, 200))).toBe(false);
    expect(tStarInRun(logisticModel3d({ ...LESSON, tEnd: 5 }, 200))).toBe(false);
  });

  it('the clover grazed in proportion N/K, all of it at and above K', () => {
    expect(grazedPatches(28, 0)).toBe(0);
    expect(grazedPatches(28, 0.5)).toBe(14);
    expect(grazedPatches(28, 0.476)).toBe(Math.round(28 * 0.476));
    expect(grazedPatches(28, 1)).toBe(28);
    expect(grazedPatches(28, 3)).toBe(28);
    expect(grazedPatches(0, 0.5)).toBe(0);
  });

  it('the slider’s curve is N(t) on the column’s scale', () => {
    const m = logisticModel3d(LESSON, 200);
    const pts = curvePoints(m, 60);
    expect(pts).toHaveLength(61);
    expect(pts[0]).toEqual([0, 10 / m.top]);
    for (const [u, v] of pts) expect(v).toBeCloseTo(momentAt(m, u * 30).fill, 12);
  });

  it('colours: the figures are the 2D chart’s N(t) series, the K ring its K line', () => {
    // EcologyViews: the logistic series is series 0, the K line uses colour index 2.
    expect(POPULATION_TOKEN).toBe(SERIES_VARS[0]);
    expect(CAPACITY_TOKEN).toBe(SERIES_VARS[2]);
    expect(POPULATION_TOKEN).toBe('--chart-1');
    expect(CAPACITY_TOKEN).toBe('--chart-3');
  });

  it('every lesson setting the panel allows draws a legible crowd (K ≤ 2 000, N₀ ≤ 1 500)', () => {
    for (const K of [50, 500, 1000, 2000])
      for (const N0 of [1, 10, 400, 1500])
        for (const r of [0.05, 0.5, 2]) {
          const m = logisticModel3d({ N0, r, K, tEnd: 100 }, figureCap(4000));
          expect(m.slots).toBeLessThanOrEqual(LEGIBLE_FIGURES);
          expect(m.kSlots).toBeLessThanOrEqual(LEGIBLE_FIGURES);
          const L = logiLayout(m.slots, m.kSlots, foodCount('high'));
          expect(L.slots).toHaveLength(m.slots);
        }
  });

  it('selections round-trip through their ids', () => {
    for (const s of [{ kind: 'figure', slot: 7 }, { kind: 'gauge' }, { kind: 'food' }] as const)
      expect(parseSelection(selectionId(s))).toEqual(s);
    expect(parseSelection(null)).toBeNull();
    expect(parseSelection('island:2')).toBeNull();
  });
});

describe('logistic 3D: the growth arrow’s scale', () => {
  /** The run's own largest |dN/dt| (dense sampling of the exact solution). */
  const runMax = (st: typeof LESSON) => {
    let best = 0;
    for (let i = 0; i <= 4000; i++) {
      const N = logistic(st.N0, st.r, st.K, (i / 4000) * st.tEnd);
      best = Math.max(best, Math.abs(growthRate(st.r, st.K, N)));
    }
    return best;
  };
  const cardText = (st: typeof LESSON) => {
    const m = logisticModel3d(st, 200);
    return selectionCard(m, momentAt(m, 0), { kind: 'gauge' }, fmt)
      ?.lines.map((l) => l.vi)
      .join('\n');
  };

  it('r = 0.1: the run never reaches K/2, so the arrow is scaled by rK/4, never full', () => {
    const st = { ...LESSON, r: 0.1 };
    const m = logisticModel3d(st, 200);
    expect(tStarInRun(m)).toBe(false);
    expect(m.arrowBasis).toBe('maxRate');
    expect(m.arrowRef).toBe(25);
    expect(runMax(st)).toBeLessThan(m.arrowRef * 0.6);
    expect(Math.abs(momentAt(m, st.tEnd).arrow)).toBeLessThan(0.6);
    const text = cardText(st) ?? '';
    expect(text).toContain(`so với rK/4 = ${fmt(25, 3)}`);
    expect(text).toContain('không dài hết cỡ');
    expect(text).not.toContain('lớn nhất của lần chạy');
  });

  it('N₀ = 600 > K/2: the run is fastest at t = 0 (120), still scaled by rK/4 = 125', () => {
    const st = { ...LESSON, N0: 600 };
    const m = logisticModel3d(st, 200);
    expect(m.arrowBasis).toBe('maxRate');
    expect(m.arrowRef).toBe(125);
    expect(runMax(st)).toBeCloseTo(120, 6);
    expect(momentAt(m, 0).arrow).toBeCloseTo(120 / 125, 9);
    expect(cardText(st)).toContain(`so với rK/4 = ${fmt(125, 3)}`);
  });

  it('N₀ far above K: scaled by |dN/dt| at t = 0, the run’s largest; just above K: rK/4', () => {
    const m = logisticModel3d(FALLING, 200);
    expect(m.arrowBasis).toBe('start');
    expect(m.arrowRef).toBe(1500);
    expect(runMax(FALLING)).toBeCloseTo(1500, 6);
    expect(momentAt(m, 0).arrow).toBeCloseTo(-1, 12);
    const text = arrowScale(m, fmt);
    expect(text.vi).toContain(`so với |dN/dt| lúc t = 0 = ${fmt(1500, 3)}`);
    expect(text.vi).toContain(`rK/4 = ${fmt(62.5, 3)}`);
    expect(text.en).toContain('at t = 0');
    // N₀ = 1,1 K: |dN/dt| at t = 0 (27,5) is below rK/4 (62,5), the scale stays rK/4.
    const near = logisticModel3d({ ...FALLING, N0: 550 }, 200);
    expect(near.arrowBasis).toBe('maxRate');
    expect(near.arrowRef).toBe(62.5);
  });
});

describe('logistic 3D: layout (illustration)', () => {
  const dist = (a: { x: number; z: number }, b: { x: number; z: number }) =>
    Math.hypot(a.x - b.x, a.z - b.z);

  it('the fence holds exactly the first kSlots figures; the rest stand outside it', () => {
    for (const [slots, kSlots] of [
      [200, 200],
      [150, 50],
      [150, 5],
      [60, 30],
    ] as const) {
      const L = logiLayout(slots, kSlots, 28);
      const c = { x: L.meadow.x, z: L.meadow.z };
      expect(L.fenceR).toBe(fenceRadius(kSlots));
      L.slots.forEach((s, i) => {
        const d = dist(s, c);
        if (i < kSlots) expect(d + FIGURE_CLEARANCE / 2).toBeLessThan(L.fenceR);
        else expect(d - FIGURE_CLEARANCE / 2).toBeGreaterThan(L.fenceR);
      });
    }
  });

  it('no two figures overlap, inside or outside the fence', () => {
    const L = logiLayout(150, 50, 28);
    for (let i = 0; i < L.slots.length; i++)
      for (let j = i + 1; j < L.slots.length; j++) {
        const a = L.slots[i];
        const b = L.slots[j];
        if (a && b) expect(dist(a, b)).toBeGreaterThanOrEqual(FIGURE_CLEARANCE);
      }
  });

  it('clover inside the fence, nearest the centre first; the column beside the crowd', () => {
    const L = logiLayout(200, 200, 28);
    const c = { x: L.meadow.x, z: L.meadow.z };
    expect(L.food).toHaveLength(28);
    let last = 0;
    for (const p of L.food) {
      const d = dist(p, c);
      expect(d + p.size).toBeLessThan(L.fenceR + 0.5);
      expect(d).toBeGreaterThanOrEqual(last);
      last = d;
    }
    expect(L.gauge.x - L.gauge.plinthR).toBeGreaterThan(L.meadow.x + L.meadow.r);
    // The subject is centred on the origin.
    expect(L.meadow.x - L.meadow.r + (L.gauge.x + L.gauge.plinthR)).toBeCloseTo(0, 9);
    // Plants stay clear of the crowd, the fence and the plinth.
    for (const p of logiPlants(L, plantCounts('high'))) {
      if (p.kind === 'tuft') continue;
      expect(dist(p, c)).toBeGreaterThan(L.fenceR);
      expect(dist(p, L.gauge)).toBeGreaterThan(L.gauge.plinthR);
    }
    expect(subjectPoints(L).length).toBeGreaterThan(30);
  });

  it('close-ups: the herd strip, a picked animal with its neighbours, the column’s labels', () => {
    const spread = (pts: [number, number, number][]) => {
      const xs = pts.map((p) => p[0]);
      const zs = pts.map((p) => p[2]);
      return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
    };
    for (const [slots, kSlots] of [
      [200, 200],
      [150, 50],
    ] as const) {
      const L = logiLayout(slots, kSlots, 28);
      const whole = spread(subjectPoints(L));
      // "Cận cảnh đàn": from the meadow's centre (the first animals) to the front of the crowd
      // and the fence; much narrower than the whole subject.
      const close = closeupPoints(L);
      const zs = close.map((p) => p[2]);
      const xs = close.map((p) => p[0]);
      const first = L.slots[0];
      const edge = Math.max(L.meadow.r, L.fenceR);
      expect(Math.min(...zs)).toBeLessThanOrEqual(L.meadow.z + 0.12 * edge);
      expect(Math.max(...zs)).toBeGreaterThanOrEqual(L.meadow.z + Math.max(L.meadow.r, L.fenceR));
      expect(Math.min(...xs)).toBeLessThan(first?.x ?? 0);
      expect(Math.max(...xs)).toBeGreaterThan(first?.x ?? 0);
      expect(spread(close)).toBeLessThan(whole * 0.62);
      // The clover's: the outer, last-grazed part of the meadow up to the fence.
      const food = foodPoints(L);
      expect(Math.max(...food.map((p) => p[2]))).toBeGreaterThanOrEqual(L.meadow.z + edge);
      expect(spread(food)).toBeLessThan(whole * 0.62);
      // A picked animal: centred on its slot, a few figures wide.
      const slot = L.slots[slots - 1];
      const fig = figurePoints(L, slots - 1);
      const cx = fig.reduce((a, p) => a + p[0], 0) / fig.length;
      const cz = fig.reduce((a, p) => a + p[2], 0) / fig.length;
      expect(Math.hypot(cx - (slot?.x ?? 0), cz - (slot?.z ?? 0))).toBeLessThan(1e-9);
      expect(spread(fig)).toBeLessThan(whole * 0.3);
      expect(figurePoints(L, slots)).toEqual([]);
      // The column: its K / K/2 tags on the left and the moment's label on the right.
      const g = gaugePoints(L).map((p) => p[0]);
      expect(Math.min(...g)).toBeLessThan(L.gauge.x - L.gauge.tubeR - 3);
      expect(Math.max(...g)).toBeGreaterThan(L.gauge.x + L.gauge.plinthR + 2.2);
      expect(spread(gaugePoints(L))).toBeLessThan(whole * 0.45);
    }
  });
});

describe('logistic 3D: texts', () => {
  it('the scale, the readout and the column’s labels carry the model’s numbers', () => {
    const m = logisticModel3d(LESSON, 200);
    expect(scaleText(1, fmt).vi).toBe('1 hình = 1 cá thể');
    expect(scaleText(5, fmt).vi).toBe('1 hình = 5 cá thể (làm tròn)');
    const now = momentAt(m, 12);
    expect(readout(now, fmt)).toBe(`t = 12 · N = ${fmt(now.N, 4)}`);
    expect(momentLabel(now, fmt)).toBe(`N = ${fmt(now.N, 4)}\ndN/dt = ${fmt(now.dNdt, 3)}`);
    // A falling population: a true minus sign.
    const f = momentAt(logisticModel3d(FALLING, 200), 1);
    expect(momentLabel(f, fmt)).toContain(`dN/dt = −${fmt(-f.dNdt, 3)}`);
    expect(gaugeMarks(m, fmt)).toEqual({ k: 'K = 1000', half: 'K/2 = 500' });
    expect(Object.keys(CALLOUTS).sort()).toEqual(['fence', 'figure', 'food']);
  });

  it('the cards: an animal’s scale and the moment, the column’s levels, the clover’s N/K', () => {
    const m = logisticModel3d(LESSON, 200);
    const now = momentAt(m, m.tStar);
    const fig = selectionCard(m, now, { kind: 'figure', slot: 3 }, fmt);
    const text = fig?.lines.map((l) => l.vi).join('\n') ?? '';
    expect(text).toContain('đại diện cho 5 cá thể');
    expect(text).toContain(`${fmt(now.shown, 6)} hình cho N = ${fmt(now.N, 4)}`);
    expect(text).toContain(`r(1 − N/K) = ${fmt(now.perCapita, 3)}`);
    // A slot that is not drawn now has no card.
    expect(selectionCard(m, now, { kind: 'figure', slot: now.shown }, fmt)).toBeNull();
    const col = selectionCard(m, now, { kind: 'gauge' }, fmt);
    const ct = col?.lines.map((l) => l.vi).join('\n') ?? '';
    expect(ct).toContain(`K = ${fmt(1000, 4)}`);
    expect(ct).toContain(`t* = ${fmt(m.tStar, 3)}`);
    expect(ct).toContain(`rK/4 = ${fmt(125, 3)}`);
    const food = selectionCard(m, now, { kind: 'food' }, fmt);
    expect(food?.lines.map((l) => l.vi).join('\n')).toContain('không mô tả thức ăn cụ thể');
    // Every card line has both languages.
    for (const c of [fig, col, food]) for (const l of c?.lines ?? []) expect(l.en).toBeTruthy();
  });
});
