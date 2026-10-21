import { describe, expect, it } from 'vitest';
import { apportion } from '../../view3d/sampling';
import { driftRuns, expectedHeterozygosity, wrightFisher } from '../population';
import { rng } from '../stats';
import {
  LEGIBLE_ISLAND,
  LEGIBLE_TOTAL,
  absorption,
  beadKeys,
  driftModel3d,
  fateOf,
  figureAlleles,
  figureBudget,
  generationAt,
  individualsPerFigure,
  islandAt,
  islandCap,
  pairing,
  parseSelection,
  selectionId,
  summaryAt,
  type DriftModel3D,
} from './binding';
import { scaleText, selectionCard, summaryText } from './facts';
import {
  coastAt,
  coastMax,
  columnsFor,
  driftLayout,
  frontIsland,
  islandHeight,
  islandPlantCounts,
  islandPlants,
  tagPoint,
  BAND_GAP,
  BAND_WIDTH,
} from './layout';

/** The lesson's defaults (`useDrift`). */
const LESSON = { N: 50, p0: 0.5, generations: 150, runs: 20, seed: 1 };
const fmt = (v: number, d = 6) =>
  new Intl.NumberFormat('vi-VN', { maximumSignificantDigits: d }).format(v);

function model(st = LESSON, cap = islandCap(figureBudget(4000), st.runs)): DriftModel3D {
  return driftModel3d(st, driftRuns(st), cap);
}

describe('drift 3D: the runs are the lesson’s', () => {
  it('driftRuns is rng(seed) + one Wright–Fisher run after another (the 2D chart’s runs)', () => {
    const rand = rng(LESSON.seed);
    const by2d = Array.from({ length: LESSON.runs }, () =>
      wrightFisher(LESSON.N, LESSON.p0, LESSON.generations, rand),
    );
    expect(driftRuns(LESSON)).toEqual(by2d);
    expect(driftRuns(LESSON)).toEqual(driftRuns(LESSON));
    expect(driftRuns({ ...LESSON, seed: 2 })).not.toEqual(driftRuns(LESSON));
  });

  it('one island per run, the run’s own frequencies', () => {
    const m = model();
    expect(m.runs).toHaveLength(LESSON.runs);
    const runs = driftRuns(LESSON);
    for (const g of [0, 1, 37, 150]) {
      runs.forEach((run, r) => {
        expect(islandAt(m, r, g)?.p).toBe(run[g]);
      });
    }
  });
});

describe('drift 3D: counts and scale', () => {
  it('every figure is exactly k individuals, k the smallest divisor of N that fits the cap', () => {
    expect(individualsPerFigure(50, 15)).toBe(5);
    expect(individualsPerFigure(100, 15)).toBe(10);
    expect(individualsPerFigure(500, 10)).toBe(50);
    expect(individualsPerFigure(495, 15)).toBe(33);
    expect(individualsPerFigure(485, 15)).toBe(97);
    expect(individualsPerFigure(7, 15)).toBe(1);
    for (let N = 5; N <= 500; N += 5)
      for (const cap of [4, 10, 15, 60]) {
        const k = individualsPerFigure(N, cap);
        expect(N % k).toBe(0);
        expect(N / k).toBeLessThanOrEqual(cap);
        for (let j = 1; j < k; j++) expect(N % j !== 0 || N / j > cap).toBe(true);
      }
  });

  it('the islands share a legible budget (instance budget at 30 islands of N = 500)', () => {
    expect(figureBudget(4000)).toBe(LEGIBLE_TOTAL);
    expect(figureBudget(10000)).toBe(LEGIBLE_TOTAL);
    expect(islandCap(LEGIBLE_TOTAL, 20)).toBe(15);
    expect(islandCap(LEGIBLE_TOTAL, 30)).toBe(10);
    expect(islandCap(LEGIBLE_TOTAL, 1)).toBe(LEGIBLE_ISLAND);
    const big = model({ ...LESSON, N: 500, runs: 30 });
    expect(big.figures * big.runs.length).toBeLessThanOrEqual(LEGIBLE_TOTAL);
    expect(big.per).toBe(50);
    // 2 beads per figure: at most 2 · 300 bead instances.
    expect(2 * big.figures * big.runs.length).toBeLessThanOrEqual(2 * LEGIBLE_TOTAL);
  });

  it('A copies are traj·2N (whole from generation 1), the beads add up to 2N / k exactly', () => {
    for (const st of [
      LESSON,
      { ...LESSON, N: 25, p0: 0.15, runs: 30 },
      { ...LESSON, N: 5, runs: 1 },
    ]) {
      const m = model(st);
      const twoN = 2 * st.N;
      expect(m.figures).toBe(st.N / m.per);
      m.runs.forEach((run, r) => {
        for (let g = 0; g <= st.generations; g += 7) {
          const x = islandAt(m, r, g);
          if (!x) throw new Error('no island');
          const exact = (run[g] ?? 0) * twoN;
          expect(x.copies.A).toBeCloseTo(exact, 9);
          if (g > 0) expect(Number.isInteger(x.copies.A)).toBe(true);
          expect(x.copies.A + x.copies.a).toBeCloseTo(twoN, 9);
          expect(x.beads.A + x.beads.a).toBe(2 * m.figures);
          expect(x.beads.A).toBe(apportion([x.copies.A, x.copies.a], m.per)[0]);
          if (x.fate === 'fixed') expect(x.beads).toEqual({ A: 2 * m.figures, a: 0 });
          if (x.fate === 'lost') expect(x.beads).toEqual({ A: 0, a: 2 * m.figures });
          expect(x.H).toBeCloseTo(2 * x.p * (1 - x.p), 12);
        }
      });
    }
    // Generation 0 is the chosen frequency: 2N·p₀ = 50 · 0.15 = 7.5 copies.
    const half = model({ ...LESSON, N: 25, p0: 0.15 });
    expect(islandAt(half, 0, 0)?.copies.A).toBeCloseTo(7.5, 9);
  });

  it('fixation and loss: the first generation the run reaches p = 1 or p = 0', () => {
    expect(fateOf(1)).toBe('fixed');
    expect(fateOf(0)).toBe('lost');
    expect(fateOf(0.4)).toBe('polymorphic');
    expect(absorption([0.5, 0.7, 1, 1])).toEqual({ fate: 'fixed', generation: 2 });
    expect(absorption([0.5, 0.2, 0.1, 0])).toEqual({ fate: 'lost', generation: 3 });
    expect(absorption([0.5, 0.4])).toBeNull();
    const m = model();
    m.runs.forEach((run, r) => {
      const a = m.absorbed[r];
      if (!a) {
        expect(fateOf(run.at(-1) ?? 0.5)).toBe('polymorphic');
        return;
      }
      expect(islandAt(m, r, a.generation)?.fate).toBe(a.fate);
      if (a.generation > 0) expect(islandAt(m, r, a.generation - 1)?.fate).toBe('polymorphic');
      // Absorbing: it never leaves that state.
      expect(islandAt(m, r, m.generations)?.fate).toBe(a.fate);
    });
  });

  it('the summary counts fixed / lost islands; mean H is the chart’s, with its theory', () => {
    const m = model();
    const runs = driftRuns(LESSON);
    for (const g of [0, 20, 75, 150]) {
      const s = summaryAt(m, g);
      expect(s.fixed).toBe(runs.filter((r) => (r[g] ?? 0) >= 1).length);
      expect(s.lost).toBe(runs.filter((r) => (r[g] ?? 1) <= 0).length);
      expect(s.fixed + s.lost + s.polymorphic).toBe(LESSON.runs);
      // DriftBottom's mean: Σ 2p(1 − p) / runs.
      const mean = runs.reduce((h, r) => h + 2 * (r[g] ?? 0) * (1 - (r[g] ?? 0)), 0) / runs.length;
      expect(s.meanH).toBeCloseTo(mean, 12);
      expect(s.theoryH).toBeCloseTo(expectedHeterozygosity(0.5, LESSON.N, g), 12);
    }
    const end = summaryAt(m, 150);
    const t = summaryText(m, 150);
    expect(t.fixed.vi).toBe(`A cố định: ${String(end.fixed)}`);
    expect(t.lost.en).toBe(`A lost: ${String(end.lost)}`);
  });

  it('the scrubber’s generation is whole and clamped to 0 … generations', () => {
    expect(generationAt(-3, 150)).toBe(0);
    expect(generationAt(0, 150)).toBe(0);
    expect(generationAt(37.9, 150)).toBe(37);
    expect(generationAt(149.9999999, 150)).toBe(150);
    expect(generationAt(1e9, 150)).toBe(150);
    expect(islandAt(model(), 0, 999)?.g).toBe(150);
  });
});

describe('drift 3D: pairing copies into figures (illustration)', () => {
  it('the figures carry exactly the island’s A beads; one bead more moves one bead', () => {
    const figures = 10;
    const keys = beadKeys(3, 2 * figures);
    let prev: Uint8Array | null = null;
    for (let a = 0; a <= 2 * figures; a++) {
      const cls = pairing(a, figures, keys);
      expect(cls).toHaveLength(figures);
      expect(cls.reduce((s, c) => s + (2 - c), 0)).toBe(a);
      if (prev) {
        let moved = 0;
        cls.forEach((c, f) => (moved += Math.abs(c - (prev?.[f] ?? 0))));
        expect(moved).toBe(1);
      }
      prev = cls;
    }
  });

  it('a figure’s two beads come from its island’s pairing at that generation', () => {
    const m = model();
    for (const g of [0, 40]) {
      const x = islandAt(m, 2, g);
      if (!x) throw new Error('no island');
      const cls = pairing(x.beads.A, m.figures, beadKeys(2, 2 * m.figures));
      for (let f = 0; f < m.figures; f++)
        expect(figureAlleles(m, 2 * m.figures + f, g)).toBe(cls[f]);
    }
    expect(figureAlleles(m, -1, 0)).toBeNull();
    expect(figureAlleles(m, m.runs.length * m.figures, 0)).toBeNull();
  });

  it('selections round-trip through their ids', () => {
    for (const s of [
      { kind: 'figure', slot: 17 },
      { kind: 'island', island: 4 },
    ] as const)
      expect(parseSelection(selectionId(s))).toEqual(s);
    expect(parseSelection('pool')).toBeNull();
    expect(selectionId(null)).toBeNull();
  });
});

describe('drift 3D: cards and chips say the model’s numbers', () => {
  it('island card: copies, p, the fixation generation, H and the theory', () => {
    const m = model();
    const r = m.absorbed.findIndex((a) => a?.fate === 'fixed');
    const a = m.absorbed[r];
    if (!a) throw new Error('no island fixed A with seed 1');
    const card = selectionCard(m, m.generations, { kind: 'island', island: r }, fmt);
    const text = card?.lines.map((l) => l.vi).join('\n') ?? '';
    expect(card?.title.vi).toBe(`Đảo ${String(r + 1)} — thế hệ 150`);
    expect(text).toContain(`A có ${fmt(100)}, a có 0 trong 100 bản sao → p = 1`);
    expect(text).toContain(`A cố định từ thế hệ ${String(a.generation)}`);
    expect(text).toContain('p₀ = 0,5');
    const before = selectionCard(m, 0, { kind: 'island', island: r }, fmt);
    expect(before?.lines.map((l) => l.vi).join('\n')).toContain(
      `về sau A cố định ở thế hệ ${String(a.generation)}`,
    );
  });

  it('figure card: its two beads, its island’s copies and the scale', () => {
    const m = model();
    const card = selectionCard(m, 30, { kind: 'figure', slot: 0 }, fmt);
    const text = card?.lines.map((l) => l.vi).join('\n') ?? '';
    expect(card?.title.vi).toBe('Cá thể trên đảo 1');
    expect(text).toContain('Hình này đại diện cho 5 cá thể; mỗi hạt = 5 bản sao gen (làm tròn)');
    const x = islandAt(m, 0, 30);
    expect(text).toContain(`A có ${fmt(x?.copies.A ?? -1)}`);
    expect(scaleText(m, fmt).vi).toBe('1 hình = 5 cá thể · 1 hạt = 5 bản sao gen (làm tròn)');
    expect(scaleText(model({ ...LESSON, runs: 1 }), fmt).vi).toBe(
      '1 hình = 1 cá thể · 1 hạt = 1 bản sao gen',
    );
  });
});

describe('drift 3D: the archipelago layout (illustration)', () => {
  it('islands are numbered row by row from the back, never touch, and hold their figures', () => {
    for (const runs of [1, 6, 20, 30]) {
      const m = model({ ...LESSON, runs });
      const L = driftLayout(runs, m.figures);
      expect(L.islands).toHaveLength(runs);
      expect(L.slots).toHaveLength(runs * m.figures);
      const cols = columnsFor(runs);
      L.islands.forEach((a, i) => {
        // Reading order: a later row is nearer the camera (+z).
        const next = L.islands[i + cols];
        if (next) expect(next.z).toBeGreaterThan(a.z);
        for (const b of L.islands.slice(i + 1)) {
          const reach = coastMax(a) + BAND_GAP + BAND_WIDTH + coastMax(b) + BAND_GAP + BAND_WIDTH;
          expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(reach + 1);
        }
        // Each figure stands on its island's grass, inside its coast.
        for (const s of L.slots.slice(i * m.figures, (i + 1) * m.figures)) {
          const ang = Math.atan2(s.z - a.z, s.x - a.x);
          expect(Math.hypot(s.x - a.x, s.z - a.z)).toBeLessThan(coastAt(a, ang) - 1);
          expect(islandHeight(a, s.x, s.z)).toBeGreaterThan(0.15);
        }
        expect(tagPoint(a)[2]).toBeGreaterThan(a.z + coastMax(a));
      });
      // The close-up's default island is in the front row (nearest the camera), mid-row.
      const f = frontIsland(runs);
      expect(f).toBeGreaterThanOrEqual((Math.ceil(runs / cols) - 1) * cols);
      expect(f).toBeLessThan(runs);
      expect(L.islands[f]?.z ?? -Infinity).toBeGreaterThan(
        Math.max(...L.islands.map((x) => x.z)) - 1.01,
      );
    }
  });

  it('trees grow on each island’s back half, every plant on land', () => {
    const m = model();
    const L = driftLayout(m.runs.length, m.figures);
    const list = islandPlants(L, islandPlantCounts('medium'));
    for (const p of list) {
      const is = L.islands.reduce((best, x) =>
        Math.hypot(p.x - x.x, p.z - x.z) < Math.hypot(p.x - best.x, p.z - best.z) ? x : best,
      );
      expect(islandHeight(is, p.x, p.z)).toBeGreaterThan(0);
      if (p.kind === 'conifer' || p.kind === 'broadleaf') expect(p.z).toBeLessThanOrEqual(is.z);
    }
  });
});
