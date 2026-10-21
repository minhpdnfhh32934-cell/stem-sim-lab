import { describe, expect, it } from 'vitest';
import { ROLES } from '../../view3d/palette';
import { apportion, drawScale } from '../../view3d/sampling';
import { matingRun, randomMating, testHardyWeinberg } from '../population';
import { rng } from '../stats';
import {
  ALLELES_OF,
  GENOTYPES,
  HW_GENERATIONS,
  LEGIBLE_BEADS,
  LEGIBLE_FIGURES,
  alleleShape,
  alleleToken,
  beadCap,
  figureCap,
  generationAt,
  genotypeToken,
  hwModel3d,
  parseSelection,
  selectionId,
  slotClasses,
  slotGenotype,
  slotKeys,
} from './binding';
import { dialLabels, selectionCard } from './facts';
import {
  HW_VIEW,
  balancedCenter,
  figureSlots,
  hwLayout,
  plantCounts,
  plantPlaces,
  subjectPoints,
} from './layout';

const LESSON = { AA: 360, Aa: 480, aa: 160, N: 1000, seed: 1 };
const fmt = (v: number) => String(Math.round(v * 1e4) / 1e4);

describe('Hardy–Weinberg 3D: the model behind the habitat', () => {
  it('generation 0 is the learner’s counts; generation 1 is the panel’s random-mating draw', () => {
    const run = matingRun(LESSON, LESSON.N, 4, rng(7));
    expect(run[0]).toEqual({ AA: 360, Aa: 480, aa: 160 });
    // The panel's button: seed + 1, then randomMating(N, p, rng(new seed)).
    const p = testHardyWeinberg(360, 480, 160).p;
    expect(run[1]).toEqual(randomMating(LESSON.N, p, rng(7)));
    for (const g of run.slice(1)) expect(g.AA + g.Aa + g.aa).toBe(LESSON.N);
    const m = hwModel3d({ ...LESSON, seed: 7 }, 250, 200);
    expect(m.generations).toHaveLength(HW_GENERATIONS + 1);
    expect(m.generations.map((x) => x.counts)).toEqual(
      matingRun(LESSON, 1000, HW_GENERATIONS, rng(7)),
    );
  });

  it('every generation carries the model’s p, q, expectation, χ² and gene copies', () => {
    const m = hwModel3d(LESSON, 250, 200);
    for (const gen of m.generations) {
      const c = gen.counts;
      const t = testHardyWeinberg(c.AA, c.Aa, c.aa);
      expect(gen.n).toBe(t.n);
      expect(gen.p).toBe(t.p);
      expect(gen.q).toBe(t.q);
      expect([gen.expected.AA, gen.expected.Aa, gen.expected.aa]).toEqual(t.expected);
      expect(gen.chi2).toBe(t.test.chi2);
      expect(gen.pValue).toBe(t.test.p);
      expect(gen.copies).toEqual({ A: 2 * c.AA + c.Aa, a: c.Aa + 2 * c.aa });
    }
    expect(m.generations[0]?.p).toBeCloseTo(0.6, 12);
  });

  it('figures and beads: one nice scale for the whole run, classes adding up exactly', () => {
    const m = hwModel3d(LESSON, 250, 200);
    expect(m.per).toBe(drawScale(1000, 250));
    expect(m.per).toBe(5);
    expect(m.perBead).toBe(drawScale(2000, 200));
    for (const gen of m.generations) {
      const c = gen.counts;
      expect([gen.figures.AA, gen.figures.Aa, gen.figures.aa]).toEqual(
        apportion([c.AA, c.Aa, c.aa], m.per),
      );
      expect(gen.figures.AA + gen.figures.Aa + gen.figures.aa).toBeLessThanOrEqual(250);
      expect([gen.beads.A, gen.beads.a]).toEqual(
        apportion([gen.copies.A, gen.copies.a], m.perBead),
      );
    }
    expect(m.generations[0]?.figures).toEqual({ AA: 72, Aa: 96, aa: 32 });
    // A small population is drawn one figure per individual, one bead per gene copy.
    const small = hwModel3d({ AA: 36, Aa: 48, aa: 16, N: 100, seed: 3 }, 250, 200);
    expect(small.per).toBe(1);
    expect(small.perBead).toBe(1);
    expect(small.generations[0]?.figures).toEqual({ AA: 36, Aa: 48, aa: 16 });
    expect(small.generations[0]?.beads).toEqual({ A: 120, a: 80 });
    // The largest generation sets the slots: N bigger than the learner's population.
    const grow = hwModel3d({ AA: 10, Aa: 20, aa: 10, N: 900, seed: 1 }, 250, 200);
    expect(grow.per).toBe(drawScale(900, 250));
    expect(grow.slots).toBe(
      Math.max(...grow.generations.map((x) => x.figures.AA + x.figures.Aa + x.figures.aa)),
    );
  });

  it('caps: the tier’s instance share, never more than a legible crowd', () => {
    expect(figureCap(1500)).toBe(225);
    expect(figureCap(4000)).toBe(LEGIBLE_FIGURES);
    expect(figureCap(10000)).toBe(LEGIBLE_FIGURES);
    expect(beadCap(4000)).toBe(LEGIBLE_BEADS);
    expect(beadCap(10)).toBe(60);
  });

  it('colours and shape cues are the lesson chart’s and the palette’s', () => {
    expect(GENOTYPES.map(genotypeToken)).toEqual(['--chart-1', '--chart-2', '--chart-3']);
    expect(alleleToken('A')).toBe(ROLES.alleleA.token);
    expect(alleleToken('a')).toBe(ROLES.allelea.token);
    // A as AA, a as aa; the bead shapes tell them apart without colour.
    expect(alleleToken('A')).toBe(genotypeToken('AA'));
    expect(alleleToken('a')).toBe(genotypeToken('aa'));
    expect(alleleShape('A')).toBe('cube');
    expect(alleleShape('a')).toBe('sphere');
    expect(ALLELES_OF).toEqual({ AA: ['A', 'A'], Aa: ['A', 'a'], aa: ['a', 'a'] });
  });

  it('slot classes: exact counts, mixed, and stable when a count changes by one', () => {
    const keys = slotKeys(300, 0);
    const cls = slotClasses([72, 96, 32], keys);
    expect(cls).toHaveLength(200);
    const tally = [0, 0, 0];
    for (const c of cls) tally[c] = (tally[c] ?? 0) + 1;
    expect(tally).toEqual([72, 96, 32]);
    // Mixed: the first 72 slots are not all one class.
    expect(new Set(cls.slice(0, 72)).size).toBe(3);
    // One more AA: at most two of the existing slots change class.
    const more = slotClasses([73, 96, 32], keys);
    let changed = 0;
    for (let i = 0; i < 200; i++) if (more[i] !== cls[i]) changed++;
    expect(changed).toBeLessThanOrEqual(2);
    // The same keys for the first slots whatever the count.
    expect(Array.from(slotKeys(50, 0))).toEqual(Array.from(keys.slice(0, 50)));
    // Another generation, another mix.
    expect(Array.from(slotKeys(5, 1))).not.toEqual(Array.from(slotKeys(5, 0)));
  });

  it('generation of a playback time; selections; the genotype a slot shows', () => {
    expect(generationAt(-1)).toBe(0);
    expect(generationAt(2.99)).toBe(2);
    expect(generationAt(3)).toBe(3);
    expect(generationAt(99)).toBe(HW_GENERATIONS);
    expect(parseSelection(selectionId({ kind: 'figure', slot: 12 }))).toEqual({
      kind: 'figure',
      slot: 12,
    });
    expect(parseSelection(selectionId({ kind: 'pool' }))).toEqual({ kind: 'pool' });
    expect(parseSelection('nonsense')).toBeNull();
    expect(selectionId(null)).toBeNull();
    const m = hwModel3d(LESSON, 250, 200);
    const f = m.generations[2]?.figures ?? { AA: 0, Aa: 0, aa: 0 };
    const cls = slotClasses([f.AA, f.Aa, f.aa], slotKeys(m.slots, 2));
    expect(slotGenotype(m, 2, 5)).toBe(GENOTYPES[cls[5] ?? 0]);
    expect(slotGenotype(m, 2, 10_000)).toBeNull();
  });
});

describe('Hardy–Weinberg 3D: places (illustration)', () => {
  it('figure slots never move when the count changes', () => {
    const a = figureSlots(120, -3, 0);
    const b = figureSlots(121, -3, 0);
    expect(b.slice(0, 120)).toEqual(a);
  });

  it('the subject is centred, the plinth beside the meadow, the ground far larger', () => {
    const L = hwLayout(200, 200);
    expect(L.slots).toHaveLength(200);
    expect(L.meadow.x).toBeLessThan(0);
    expect(L.pool.x).toBeGreaterThan(0);
    expect(L.pool.x - L.pool.plinthR).toBeGreaterThan(L.meadow.x + L.meadow.r);
    expect(L.habitatR).toBeGreaterThan(2 * L.halfWidth);
    expect(L.pool.beads).toHaveLength(200);
    // The beads fit inside the jar.
    for (const b of L.pool.beads) {
      expect(Math.hypot(b[0], b[2]) + L.pool.beadR).toBeLessThan(L.pool.jarR);
      expect(b[1] + L.pool.beadR).toBeLessThan(L.pool.jarH);
    }
  });

  it('plants keep off the meadow and the plinth; trees never stand in front of the subject', () => {
    const L = hwLayout(200, 200);
    const plants = plantPlaces(L, plantCounts('high'));
    expect(plants.length).toBeGreaterThan(400);
    for (const p of plants) {
      expect(Math.hypot(p.x - L.pool.x, p.z - L.pool.z)).toBeGreaterThan(L.pool.plinthR);
      if (p.kind === 'tuft') continue;
      expect(Math.hypot(p.x - L.meadow.x, p.z - L.meadow.z)).toBeGreaterThan(L.meadow.r * 1.1);
      if (p.kind === 'conifer' || p.kind === 'broadleaf')
        expect(p.z <= -L.meadow.r * 0.6 || Math.abs(p.x) >= L.halfWidth + 3).toBe(true);
    }
    // Seeded: the same habitat grows the same plants.
    expect(plantPlaces(L, plantCounts('medium'))).toEqual(plantPlaces(L, plantCounts('medium')));
  });

  it('the orbit centre balances the subject across and up the default view', () => {
    const L = hwLayout(200, 200);
    const pts = subjectPoints(L);
    const c = balancedCenter(pts, HW_VIEW);
    const n = Math.hypot(...HW_VIEW);
    const z = HW_VIEW.map((v) => v / n);
    const right = [z[2] ?? 0, 0, -(z[0] ?? 0)];
    const along = (p: readonly number[], a: readonly number[]) =>
      (p[0] ?? 0) * (a[0] ?? 0) + (p[1] ?? 0) * (a[1] ?? 0) + (p[2] ?? 0) * (a[2] ?? 0);
    const xs = pts.map((p) => along([p[0] - c[0], p[1] - c[1], p[2] - c[2]], right));
    expect(Math.max(...xs) + Math.min(...xs)).toBeCloseTo(0, 6);
  });
});

describe('Hardy–Weinberg 3D: texts', () => {
  it('the cards and the dial show the model’s numbers', () => {
    const m = hwModel3d(LESSON, 250, 200);
    const pool = selectionCard(m, 0, { kind: 'pool' }, fmt);
    expect(pool?.title.vi).toBe('Vốn gen — thế hệ 0');
    expect(pool?.lines[0]?.vi).toContain('2·360 + 480 = 1200');
    expect(pool?.lines[0]?.vi).toContain('p = 0.6');
    expect(pool?.lines[1]?.vi).toContain('480 + 2·160 = 800');
    expect(pool?.lines[3]?.vi).toContain('phù hợp');
    const gt = slotGenotype(m, 0, 0);
    const card = selectionCard(m, 0, { kind: 'figure', slot: 0 }, fmt);
    expect(card?.title.vi).toBe(`Cá thể kiểu gen ${gt ?? ''}`);
    expect(card?.lines[1]?.vi).toContain(`${String(m.generations[0]?.counts[gt ?? 'AA'])} cá thể`);
    expect(card?.lines[3]?.vi).toContain('5 cá thể');
    expect(selectionCard(m, 0, { kind: 'figure', slot: 9999 }, fmt)).toBeNull();
    const dial = dialLabels(m, fmt);
    expect(dial[0]?.vi).toBe('A: 1200 · p = 0.6\na: 800 · q = 0.4');
    expect(dial).toHaveLength(HW_GENERATIONS + 1);
  });
});
