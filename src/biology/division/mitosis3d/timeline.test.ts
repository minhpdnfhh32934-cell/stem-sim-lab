import { describe, expect, it } from 'vitest';
import { countsOf, runDivision } from '../division';
import {
  PLANT,
  SISTER_OFFSET,
  STAGES_3D,
  buildTimeline,
  insideCell,
  type CellShape,
  type CellType,
  type CentromereState,
  type Counts3D,
  type Fibre,
  type Mitosis3DState,
  type Stage3D,
  type Timeline,
  type Vec3,
} from './timeline';

const CELL_TYPES: CellType[] = ['animal', 'plant'];

/** Times spread over the whole timeline (both ends of every stage included). */
function sampleTimes(tl: Timeline, perStage = 12): number[] {
  const out: number[] = [];
  for (const w of tl.stages) {
    for (let k = 0; k <= perStage; k++) out.push(w.start + ((w.end - w.start) * k) / perStage);
  }
  return out;
}

const present = (s: Mitosis3DState) => s.chromatids.filter((c) => c.present);
const stateIn = (tl: Timeline, stage: Stage3D, u: number) => {
  const w = tl.stages.find((x) => x.id === stage)!;
  // u = 1 would be the next stage's start; stay just inside the stage.
  return tl.stateAt(w.start + Math.min(u, 0.999999) * (w.end - w.start));
};
const dist = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(...a.map((v, i) => v - b[i]!));

/**
 * Textbook counts per cell (SGK Sinh học 10), derived by hand for 2n = 2p, for the seven 3D
 * steps. Telophase follows the 3D convention (pending teacher review, DATA_REVIEW): ONE cell
 * with TWO nuclei, each holding 2n single chromosomes (4n in the cell). Cytokinesis: per
 * daughter cell after the division. Nuclei per cell at the start → end of the step.
 */
const TEXTBOOK: Record<Stage3D, (p: number) => Counts3D> = {
  g1: (p) => ({
    cells: 1,
    nuclei: { from: 1, to: 1 },
    chromosomes: 2 * p,
    state: 'single',
    chromatids: 0,
    centromeres: 2 * p,
    dnaMolecules: 2 * p,
  }),
  g2: (p) => ({
    cells: 1,
    nuclei: { from: 1, to: 1 },
    chromosomes: 2 * p,
    state: 'double',
    chromatids: 4 * p,
    centromeres: 2 * p,
    dnaMolecules: 4 * p,
  }),
  prophase: (p) => ({
    cells: 1,
    nuclei: { from: 1, to: 0 },
    chromosomes: 2 * p,
    state: 'double',
    chromatids: 4 * p,
    centromeres: 2 * p,
    dnaMolecules: 4 * p,
  }),
  metaphase: (p) => ({
    cells: 1,
    nuclei: { from: 0, to: 0 },
    chromosomes: 2 * p,
    state: 'double',
    chromatids: 4 * p,
    centromeres: 2 * p,
    dnaMolecules: 4 * p,
  }),
  anaphase: (p) => ({
    cells: 1,
    nuclei: { from: 0, to: 0 },
    chromosomes: 4 * p,
    state: 'single',
    chromatids: 0,
    centromeres: 4 * p,
    dnaMolecules: 4 * p,
  }),
  telophase: (p) => ({
    cells: 1,
    nuclei: { from: 0, to: 2 },
    chromosomes: 4 * p,
    state: 'single',
    chromatids: 0,
    centromeres: 4 * p,
    dnaMolecules: 4 * p,
    perNucleus: 2 * p,
  }),
  cytokinesis: (p) => ({
    cells: 2,
    nuclei: { from: 2, to: 1 },
    chromosomes: 2 * p,
    state: 'single',
    chromatids: 0,
    centromeres: 2 * p,
    dnaMolecules: 2 * p,
  }),
};

// ---------------------------------------------------------------- continuity check

/**
 * Speed limits of the continuity check, in cell units (the animal cell radius is 5) per second
 * of model time. Every motion is a smoothstep between key poses, whose slope is at most
 * 1.5 × distance / window. The fastest ones: chromosomes moving to the plate (≤ ~5 units in
 * 1.2 s, about 6 units/s) and kinetochore fibres growing from a pole to a kinetochore (≤ ~6
 * units in 0.6 s, about 15 units/s). Between samples dt apart nothing may change by more than
 * limit · dt: on the 10 ms grid a chromosome jump above 0.08 units (about half its width)
 * fails, and across a stage boundary (samples 1 µs apart) any jump above ~1e-5 fails.
 */
const LIMIT = {
  /** Centromeres, centrosomes, nuclei (centre, radius), fibre roots, cell size. */
  position: 8,
  /** Chromatid arm directions (unit vectors). */
  direction: 8,
  fibreTip: 20,
  /** 0…1 quantities: condensation, spindle, nuclear envelope, cell plate growth, stretch. */
  fraction: 1,
  /** Furrow radius squared: the neck of two overlapping spheres closes like a square root. */
  neckSquared: 25,
} as const;

/** Every 10 ms of model time, plus 1 µs before each stage boundary. */
function fineTimes(tl: Timeline): number[] {
  const out = new Set<number>();
  const steps = Math.round(tl.total * 100);
  for (let k = 0; k <= steps; k++) out.add(Math.min(tl.total, k / 100));
  for (const w of tl.stages.slice(1)) out.add(w.start - 1e-6);
  return [...out].sort((a, b) => a - b);
}

/** Fibres by identity: kinetochore fibres by chromatid, the others by pole and order. */
function fibresById(s: Mitosis3DState): Map<string, Fibre> {
  const out = new Map<string, Fibre>();
  const seen = new Map<string, number>();
  for (const f of s.fibres) {
    if (f.kind === 'kinetochore') {
      out.set(`kinetochore→${String(f.chromatid)}`, f);
      continue;
    }
    const base = `${f.kind}@${String(f.pole)}`;
    const k = seen.get(base) ?? 0;
    seen.set(base, k + 1);
    out.set(`${base}#${String(k)}`, f);
  }
  return out;
}

const centromereKey = (c: CentromereState) => `${String(c.chromosome)}:${c.sisters.join('')}`;

/** Everything that moved too far between two moments (empty = continuous). */
function jumps(a: Mitosis3DState, b: Mitosis3DState): string[] {
  const out: string[] = [];
  const dt = b.t - a.t;
  const boundary = a.stage !== b.stage;
  const at = `${a.cellType} t=${a.t.toFixed(6)}→${b.t.toFixed(6)} (${a.stage}→${b.stage})`;
  const within = (what: string, moved: number, limit: keyof typeof LIMIT) => {
    // Written so that NaN fails too.
    if (!(moved <= LIMIT[limit] * dt + 1e-9))
      out.push(`${at}: ${what} changed by ${String(moved)}`);
  };
  const onlyAtBoundary = (what: string) => {
    if (!boundary) out.push(`${at}: ${what} inside a stage`);
  };

  // Chromatids: centromere and arm directions (arms, bead and chromatin thread follow them).
  if (a.chromatids.length !== b.chromatids.length) out.push(`${at}: chromatid list changed`);
  a.chromatids.forEach((p, i) => {
    const q = b.chromatids[i];
    if (!q) return;
    if (p.side !== q.side) out.push(`${at}: chromatid ${String(i)} changed pole`);
    // Replication (S, shown between G1 and G2) is the only time a chromatid appears.
    if (p.present !== q.present && !(a.stage === 'g1' && b.stage === 'g2'))
      out.push(`${at}: chromatid ${String(i)} appeared or vanished`);
    if (p.joined !== q.joined) onlyAtBoundary(`chromatid ${String(i)} joined or split`);
    if (!p.present || !q.present) return;
    within(`chromatid ${String(i)} centromere`, dist(p.centromere, q.centromere), 'position');
    within(`chromatid ${String(i)} arm A`, dist(p.dirA, q.dirA), 'direction');
    within(`chromatid ${String(i)} arm B`, dist(p.dirB, q.dirB), 'direction');
  });

  // Centromeres: the same ones move smoothly; a centromere is shared (S) or splits (anaphase)
  // only at a stage boundary, next to the old centromere of the same chromosome.
  const before = new Map(a.centromeres.map((c) => [centromereKey(c), c]));
  const after = new Set(b.centromeres.map(centromereKey));
  for (const c of b.centromeres) {
    const old = before.get(centromereKey(c));
    if (old) {
      within(`centromere ${centromereKey(c)}`, dist(old.position, c.position), 'position');
      continue;
    }
    onlyAtBoundary(`centromere ${centromereKey(c)} formed`);
    const near = Math.min(
      ...a.centromeres
        .filter((x) => x.chromosome === c.chromosome)
        .map((x) => dist(x.position, c.position)),
    );
    if (!(near <= SISTER_OFFSET + LIMIT.position * dt + 1e-9))
      out.push(`${at}: centromere ${centromereKey(c)} formed ${String(near)} from its chromosome`);
  }
  for (const c of a.centromeres)
    if (!after.has(centromereKey(c))) onlyAtBoundary(`centromere ${centromereKey(c)} vanished`);

  // Centrosomes (animal): the copy made in S appears at the G1 → G2 boundary, next to the first.
  if (a.centrosomes.length !== b.centrosomes.length) {
    const added = b.centrosomes[1];
    const first = b.centrosomes[0];
    const ok =
      a.stage === 'g1' &&
      b.stage === 'g2' &&
      a.centrosomes.length === 1 &&
      b.centrosomes.length === 2 &&
      !!added &&
      !!first &&
      dist(added, first) <= 1;
    if (!ok) out.push(`${at}: centrosome count changed`);
  }
  for (let i = 0; i < Math.min(a.centrosomes.length, b.centrosomes.length); i++)
    within(`centrosome ${String(i)}`, dist(a.centrosomes[i]!, b.centrosomes[i]!), 'position');

  // Nuclei: a nucleus appears or disappears only while its envelope is invisible.
  const shared = Math.min(a.nuclei.length, b.nuclei.length);
  for (let i = 0; i < Math.max(a.nuclei.length, b.nuclei.length); i++) {
    const x = a.nuclei[i];
    const y = b.nuclei[i];
    if (x && y) {
      within(`nucleus ${String(i)} centre`, dist(x.center, y.center), 'position');
      within(`nucleus ${String(i)} radius`, Math.abs(x.radius - y.radius), 'position');
      within(`nucleus ${String(i)} envelope`, Math.abs(x.envelope - y.envelope), 'fraction');
    } else {
      const only = x ?? y;
      if (only && i >= shared)
        within(`nucleus ${String(i)} (dis)appearing envelope`, only.envelope, 'fraction');
    }
  }

  within('condensation', Math.abs(a.condensation - b.condensation), 'fraction');
  within('spindle', Math.abs(a.spindle - b.spindle), 'fraction');

  // Cell shape.
  const sa = a.shape;
  const sb = b.shape;
  if (sa.type === 'animal' && sb.type === 'animal') {
    within('elongation', Math.abs(sa.elongation - sb.elongation), 'fraction');
    within('daughter offset', Math.abs(sa.offset - sb.offset), 'position');
    within('cell radius', Math.abs(sa.radius - sb.radius), 'position');
    within('furrow radius²', Math.abs(sa.ringRadius ** 2 - sb.ringRadius ** 2), 'neckSquared');
    if (sa.separated && !sb.separated) out.push(`${at}: daughter cells joined again`);
  } else if (sa.type === 'plant' && sb.type === 'plant') {
    within('cell plate growth', Math.abs(sa.plate - sb.plate), 'fraction');
    within('cell plate radius', Math.abs(sa.plateRadius - sb.plateRadius), 'position');
    within('cell size', dist(sa.half, sb.half), 'position');
    within('wall', Math.abs(sa.wall - sb.wall), 'position');
    if (sa.separated && !sb.separated) out.push(`${at}: daughter cells joined again`);
  } else {
    out.push(`${at}: cell type changed`);
  }

  // Spindle fibres: the same fibre moves smoothly; a fibre grows out of its root and shrinks
  // back into it (zero length when it appears or disappears).
  const fa = fibresById(a);
  const fb = fibresById(b);
  for (const [key, f] of fb) {
    const g = fa.get(key);
    if (!g) {
      within(`new fibre ${key} length`, dist(f.from, f.to), 'fibreTip');
      continue;
    }
    if (g.pole !== f.pole) out.push(`${at}: fibre ${key} changed pole`);
    within(`fibre ${key} root`, dist(g.from, f.from), 'position');
    within(`fibre ${key} tip`, dist(g.to, f.to), 'fibreTip');
  }
  for (const [key, g] of fa)
    if (!fb.has(key)) within(`removed fibre ${key} length`, dist(g.from, g.to), 'fibreTip');
  return out;
}

/** Inside daughter cell `side` (−1 = −x, 1 = +x): its sphere (animal) or its half box (plant). */
function insideDaughter(shape: CellShape, side: -1 | 1, p: Vec3, margin: number): boolean {
  if (shape.type === 'plant') {
    return (
      side * p[0] >= margin &&
      Math.abs(p[0]) <= shape.half[0] - margin &&
      Math.abs(p[1]) <= shape.half[1] - margin &&
      Math.abs(p[2]) <= shape.half[2] - margin
    );
  }
  const s = 1 + shape.elongation;
  const x = p[0] / s;
  const r = Math.hypot(p[1], p[2]) * Math.sqrt(s);
  return side * p[0] > 0 && Math.hypot(x - side * shape.offset, r) <= shape.radius - margin;
}

describe('3D mitosis timeline', () => {
  it('has the stages in textbook order for both cell types', () => {
    for (const type of CELL_TYPES) {
      const tl = buildTimeline(2, type);
      expect(tl.stages.map((s) => s.id)).toEqual([
        'g1',
        'g2',
        'prophase',
        'metaphase',
        'anaphase',
        'telophase',
        'cytokinesis',
      ]);
      let prev = -1;
      for (const t of sampleTimes(tl)) {
        const i = tl.stateAt(t).stageIndex;
        expect(i).toBeGreaterThanOrEqual(prev);
        prev = i;
      }
      expect(tl.stateAt(0).stage).toBe('g1');
      expect(tl.stateAt(tl.total).stage).toBe('cytokinesis');
    }
  });

  for (const n of [2, 4, 23]) {
    it(`counts per stage come from runDivision (2n = ${2 * n})`, () => {
      const model = runDivision('mitosis', n);
      const m = (id: string) => countsOf(model.find((s) => s.stage === id)!);
      for (const type of CELL_TYPES) {
        const tl = buildTimeline(n, type);
        for (const id of ['g1', 'g2', 'prophase', 'metaphase', 'anaphase'] as const) {
          const c = tl.counts(id);
          const e = m(id);
          expect(
            [c.cells, c.chromosomes, c.state, c.chromatids, c.centromeres, c.dnaMolecules],
            id,
          ).toEqual([e.cells, e.chromosomes, e.state, e.chromatids, e.centromeres, e.dnaMolecules]);
        }
        // Telophase: ONE cell with TWO nuclei, each holding one set of the model.
        const tel = tl.counts('telophase');
        const sets = m('telophase');
        expect(tel.cells).toBe(1);
        expect(tel.nuclei).toEqual({ from: 0, to: 2 });
        expect(tel.perNucleus).toBe(sets.chromosomes);
        expect(tel.chromosomes).toBe(2 * sets.chromosomes);
        expect(tel.chromatids).toBe(2 * sets.chromatids);
        expect(tel.centromeres).toBe(2 * sets.centromeres);
        expect(tel.dnaMolecules).toBe(2 * sets.dnaMolecules);
        expect(tel.state).toBe(sets.state);
        expect(tel.state).toBe('single');
        // Cytokinesis: the model's two daughter cells (the 2D telophase row), each 2n single.
        const cyt = tl.counts('cytokinesis');
        expect([cyt.cells, cyt.chromosomes, cyt.state, cyt.chromatids, cyt.centromeres]).toEqual([
          2,
          2 * n,
          'single',
          0,
          2 * n,
        ]);
        expect([
          cyt.cells,
          cyt.chromosomes,
          cyt.state,
          cyt.chromatids,
          cyt.centromeres,
          cyt.dnaMolecules,
        ]).toEqual([
          sets.cells,
          sets.chromosomes,
          sets.state,
          sets.chromatids,
          sets.centromeres,
          sets.dnaMolecules,
        ]);
        expect(cyt.nuclei).toEqual({ from: 2, to: 1 });
        expect(tl.counts('prophase').nuclei).toEqual({ from: 1, to: 0 });
        expect(tl.counts('metaphase').nuclei).toEqual({ from: 0, to: 0 });
        expect(tl.counts('g1').nuclei).toEqual({ from: 1, to: 1 });
      }
    });

    it(`every count row matches the textbook table by hand (2n = ${2 * n})`, () => {
      for (const type of CELL_TYPES) {
        const tl = buildTimeline(n, type);
        for (const id of STAGES_3D) expect(tl.counts(id), `${type} ${id}`).toEqual(TEXTBOOK[id](n));
      }
    });

    it(`the drawn chromatids match the counts at every stage (2n = ${2 * n})`, () => {
      for (const type of CELL_TYPES) {
        const tl = buildTimeline(n, type);
        for (const id of ['g1', 'g2', 'prophase', 'metaphase', 'anaphase'] as const) {
          const s = tl.stateAt(tl.keyTime(id));
          const c = tl.counts(id);
          expect(s.stage).toBe(id);
          expect(s.cells).toHaveLength(1);
          expect(present(s)).toHaveLength(c.dnaMolecules);
          expect(s.centromeres).toHaveLength(c.centromeres);
          const double = present(s).every((x) => x.joined);
          const single = present(s).every((x) => !x.joined);
          expect(c.state === 'double' ? double : single, id).toBe(true);
        }
        // Telophase: one cell holding all 4n DNA molecules; cytokinesis: 2n in each daughter.
        const tel = tl.stateAt(tl.keyTime('telophase'));
        expect(tel.cells).toHaveLength(1);
        expect(present(tel)).toHaveLength(tl.counts('telophase').dnaMolecules);
        expect(tel.centromeres).toHaveLength(tl.counts('telophase').centromeres);
        const end = tl.stateAt(tl.keyTime('cytokinesis'));
        expect(end.cells).toHaveLength(tl.counts('cytokinesis').cells);
        for (const cell of end.cells)
          expect(cell.chromatids).toHaveLength(tl.counts('cytokinesis').dnaMolecules);
      }
    });
  }

  it('animal cells: centrosomes and a cleavage furrow, never a wall or a cell plate', () => {
    const tl = buildTimeline(2, 'animal');
    let furrow = false;
    for (const t of sampleTimes(tl)) {
      const s = tl.stateAt(t);
      expect(s.shape.type).toBe('animal');
      expect(s.centrosomes.length).toBeGreaterThanOrEqual(1);
      if (s.shape.type === 'animal' && s.shape.ring) {
        expect(s.stage).toBe('cytokinesis');
        furrow = true;
      }
      expect('plate' in s.shape).toBe(false);
      expect('wall' in s.shape).toBe(false);
    }
    expect(furrow).toBe(true);
    // One centrosome in G1; duplicated in S (not its own step), so G2 has two from its very
    // start, the original stays where it was and nothing moves inside G2; one at each pole in
    // metaphase.
    const g1End = stateIn(tl, 'g1', 1);
    const g2Start = stateIn(tl, 'g2', 0);
    expect(tl.stateAt(tl.keyTime('g1')).centrosomes).toHaveLength(1);
    expect(g1End.centrosomes).toHaveLength(1);
    expect(g2Start.centrosomes).toHaveLength(2);
    expect(g2Start.centrosomes[0]).toEqual(g1End.centrosomes[0]);
    expect(stateIn(tl, 'g2', 1).centrosomes).toEqual(g2Start.centrosomes);
    expect(tl.stateAt(tl.keyTime('g2')).centrosomes).toEqual(g2Start.centrosomes);
    const meta = tl.stateAt(tl.keyTime('metaphase'));
    const [c0, c1] = meta.centrosomes;
    expect(c0![0]).toBeLessThan(-3);
    expect(c1![0]).toBeGreaterThan(3);
  });

  it('plant cells: a wall and a cell plate, never centrosomes, asters or a furrow', () => {
    const tl = buildTimeline(2, 'plant');
    let plate = 0;
    for (const t of sampleTimes(tl)) {
      const s = tl.stateAt(t);
      expect(s.shape.type).toBe('plant');
      expect(s.centrosomes).toHaveLength(0);
      expect(s.fibres.some((f) => f.kind === 'astral')).toBe(false);
      expect('ring' in s.shape).toBe(false);
      if (s.shape.type === 'plant') {
        expect(s.shape.wall).toBeGreaterThan(0);
        if (s.stage !== 'cytokinesis') expect(s.shape.plate).toBe(0);
        plate = Math.max(plate, s.shape.plate);
      }
    }
    expect(plate).toBe(1);
    // The plant spindle still forms (without centrosomes).
    expect(tl.stateAt(tl.keyTime('metaphase')).fibres.length).toBeGreaterThan(0);
  });

  it('S phase is not its own step: every chromosome is already double at the start of G2', () => {
    for (const type of CELL_TYPES) {
      for (const n of [2, 4, 23]) {
        const tl = buildTimeline(n, type);
        const g1End = stateIn(tl, 'g1', 1);
        const start = stateIn(tl, 'g2', 0);
        const end = stateIn(tl, 'g2', 1);
        // G1 up to its last moment: single chromosomes (the model's G1 count).
        expect(present(g1End)).toHaveLength(tl.counts('g1').dnaMolecules);
        expect(present(g1End).every((c) => c.sister === 0)).toBe(true);
        // G2 from its first moment: the model's G2 counts, all double, sisters side by side.
        const g2 = tl.counts('g2');
        expect(g2.state).toBe('double');
        expect(present(start)).toHaveLength(g2.dnaMolecules);
        expect(start.centromeres).toHaveLength(g2.centromeres);
        expect(start.centromeres.every((c) => c.sisters.length === 2)).toBe(true);
        expect(present(start).every((c) => c.joined)).toBe(true);
        for (let i = 0; i < start.chromatids.length; i += 2) {
          const s0 = start.chromatids[i]!;
          const s1 = start.chromatids[i + 1]!;
          expect(dist(s0.centromere, s1.centromere)).toBeCloseTo(2 * SISTER_OFFSET, 9);
        }
        // Sister 0 stays where it was in G1; nothing duplicates or splits inside G2.
        for (const c of present(g1End)) {
          expect(start.chromatids[c.id]!.centromere).toEqual(c.centromere);
        }
        expect(end.chromatids.map((c) => c.centromere)).toEqual(
          start.chromatids.map((c) => c.centromere),
        );
      }
    }
  });

  for (const type of CELL_TYPES) {
    for (const n of [2, 4, 23]) {
      it(`metaphase: kinetochore fibres reach a chromosome before it moves to the plate (${type}, 2n = ${String(2 * n)})`, () => {
        const tl = buildTimeline(n, type);
        const w = tl.stages.find((x) => x.id === 'metaphase')!;
        const prophase = tl.stateAt(tl.keyTime('prophase'));
        const steps = 200;
        let moved = 0;
        for (let k = 0; k <= steps; k++) {
          const s = stateIn(tl, 'metaphase', k / steps);
          expect(s.stage).toBe('metaphase');
          for (const cen of s.centromeres) {
            const before = prophase.centromeres.find((c) => c.chromosome === cen.chromosome)!;
            if (dist(cen.position, before.position) < 1e-9) continue;
            moved++;
            // Moved → both sisters are held by a fibre from their own pole, tip on the kinetochore.
            expect(cen.sisters).toEqual([0, 1]);
            for (const sister of cen.sisters) {
              const c = s.chromatids.find(
                (x) => x.chromosome === cen.chromosome && x.sister === sister,
              )!;
              const f = s.fibres.filter((x) => x.kind === 'kinetochore' && x.chromatid === c.id);
              expect(f, `${type} 2n=${2 * n} t=${s.t}`).toHaveLength(1);
              expect(f[0]!.pole).toBe(sister);
              expect(dist(f[0]!.to, c.centromere), `${type} 2n=${2 * n} t=${s.t}`).toBeLessThan(
                1e-6,
              );
            }
          }
        }
        expect(moved).toBeGreaterThan(0);
        // Sanity: the samples cover the whole stage.
        expect(stateIn(tl, 'metaphase', 1).t).toBeCloseTo(w.end, 4);
      });
    }
  }

  it('metaphase: every centromere on the equatorial plane, attached to both poles', () => {
    for (const type of CELL_TYPES) {
      for (const n of [2, 4, 23]) {
        const tl = buildTimeline(n, type);
        for (const u of [0.45, 0.7, 0.99]) {
          const s = stateIn(tl, 'metaphase', u);
          expect(s.centromeres).toHaveLength(2 * n);
          for (const c of s.centromeres) {
            expect(c.sisters).toEqual([0, 1]);
            expect(Math.abs(c.position[0])).toBeLessThan(1e-9);
          }
          const kf = s.fibres.filter((f) => f.kind === 'kinetochore');
          expect(kf).toHaveLength(4 * n);
          for (const f of kf) {
            const c = s.chromatids[f.chromatid!]!;
            expect(f.pole).toBe(c.sister);
            // Fibre reaches the kinetochore.
            expect(dist(f.to, c.centromere)).toBeLessThan(1e-6);
          }
        }
      }
    }
  });

  it('spindle fibres start at their own pole; one kinetochore fibre from each pole per double chromosome', () => {
    // Plant cells have no centrosomes: their fibres start in a broad polar region near the end
    // walls (this test: beyond 3/4 of the half length, within half the half width of the axis).
    const inPolarRegion = (p: Vec3, side: -1 | 1) =>
      side * p[0] >= 0.75 * PLANT.half[0] && Math.hypot(p[1], p[2]) <= PLANT.half[1] / 2;
    for (const type of CELL_TYPES) {
      for (const n of [1, 2, 4, 23]) {
        const tl = buildTimeline(n, type);
        const errors: string[] = [];
        for (const stage of ['metaphase', 'anaphase'] as const) {
          for (let k = 1; k <= 40; k++) {
            const s = stateIn(tl, stage, k / 40);
            const at = `${type} 2n=${String(2 * n)} ${stage} u=${String(k / 40)}`;
            for (const f of s.fibres) {
              const side = f.pole === 0 ? -1 : 1;
              if (Math.sign(f.from[0]) !== side)
                errors.push(`${at}: ${f.kind} fibre on the wrong side`);
              if (type === 'animal') {
                // Animal spindle: every fibre comes out of the centrosome at its pole.
                const pole = s.centrosomes[f.pole];
                if (!pole || dist(f.from, pole) > 1e-9 || side * pole[0] < 3)
                  errors.push(
                    `${at}: ${f.kind} fibre does not start at centrosome ${String(f.pole)}`,
                  );
              } else if (!inPolarRegion(f.from, side) || !insideCell(s.shape, f.from)) {
                errors.push(`${at}: ${f.kind} fibre starts outside polar region ${String(f.pole)}`);
              }
            }
            const kf = s.fibres.filter((f) => f.kind === 'kinetochore');
            for (const f of kf) {
              const c = s.chromatids[f.chromatid ?? -1];
              if (!c?.present) errors.push(`${at}: kinetochore fibre to a missing chromatid`);
              else if (f.pole !== c.sister)
                errors.push(`${at}: sister ${String(c.sister)} pulled to pole ${String(f.pole)}`);
            }
            // One fibre from each pole to every double chromosome (metaphase), and one to
            // each single chromosome from the pole it moves to (anaphase).
            for (let chromosome = 0; chromosome < 2 * n; chromosome++) {
              const poles = kf
                .filter((f) => s.chromatids[f.chromatid ?? -1]?.chromosome === chromosome)
                .map((f) => f.pole)
                .sort();
              if (poles.join() !== '0,1')
                errors.push(
                  `${at}: chromosome ${String(chromosome)} fibres from poles ${poles.join()}`,
                );
            }
            if (stage === 'metaphase') {
              for (const cen of s.centromeres)
                if (cen.sisters.length !== 2) errors.push(`${at}: single chromosome in metaphase`);
            }
          }
        }
        expect(errors.slice(0, 10), `${String(errors.length)} problems`).toEqual([]);
      }
    }
  });

  it('anaphase: sister chromatids move to opposite poles', () => {
    for (const type of CELL_TYPES) {
      const tl = buildTimeline(3, type);
      for (const u of [0.01, 0.3, 0.6, 0.99]) {
        const s = stateIn(tl, 'anaphase', u);
        expect(s.centromeres).toHaveLength(12);
        for (const c of present(s)) {
          expect(c.joined).toBe(false);
          if (c.sister === 0) expect(c.centromere[0]).toBeLessThan(0);
          else expect(c.centromere[0]).toBeGreaterThan(0);
        }
      }
      const end = stateIn(tl, 'anaphase', 1);
      for (const c of present(end)) expect(Math.abs(c.centromere[0])).toBeGreaterThan(3);
    }
  });

  it('telophase: one cell with two nuclei; the −x nucleus holds exactly the sister-0 chromatids', () => {
    for (const type of CELL_TYPES) {
      for (const n of [1, 2, 4, 23]) {
        const tl = buildTimeline(n, type);
        const sisters = (k: 0 | 1, s: Mitosis3DState) =>
          present(s)
            .filter((c) => c.sister === k)
            .map((c) => c.id);
        for (let k = 0; k <= 20; k++) {
          const u = k / 20;
          const s = stateIn(tl, 'telophase', u);
          expect(s.cells).toHaveLength(1);
          // Each set stays on its own side all through telophase.
          for (const c of present(s)) expect(Math.sign(c.centromere[0])).toBe(c.side);
          if (u < 0.8) continue;
          // The chromosomes have arrived: each re-forming nucleus holds exactly one set.
          const nuclei = s.nuclei.filter((x) => x.envelope >= 0.5);
          expect(nuclei).toHaveLength(2);
          for (const nucleus of nuclei) {
            const inside = present(s)
              .filter((c) => dist(c.centromere, nucleus.center) < nucleus.radius)
              .map((c) => c.id);
            const side = nucleus.center[0] < 0 ? 0 : 1;
            expect(inside, `${type} 2n=${String(2 * n)} u=${String(u)}`).toEqual(sisters(side, s));
            expect(new Set(inside.map((id) => s.chromatids[id]!.chromosome)).size).toBe(2 * n);
          }
        }
        const end = stateIn(tl, 'telophase', 1);
        expect(end.spindle).toBe(0);
        expect(end.condensation).toBe(0);
      }
    }
  });

  it('cytokinesis: every chromatid of daughter k lies inside daughter k and its nucleus', () => {
    for (const type of CELL_TYPES) {
      for (const n of [1, 2, 4, 23]) {
        const tl = buildTimeline(n, type);
        let separatedAt: number | null = null;
        for (let k = 0; k <= 40; k++) {
          const u = k / 40;
          const s = stateIn(tl, 'cytokinesis', u);
          const at = `${type} 2n=${String(2 * n)} u=${String(u)}`;
          for (const side of [-1, 1] as const) {
            const ids = present(s)
              .filter((c) => c.side === side)
              .map((c) => c.id);
            // The −x nucleus holds exactly the sister-0 chromatids, the +x one sister 1.
            const nucleus = s.nuclei.find((x) => Math.sign(x.center[0]) === side)!;
            expect(
              present(s)
                .filter((c) => dist(c.centromere, nucleus.center) < nucleus.radius)
                .map((c) => c.id),
              at,
            ).toEqual(ids);
            for (const id of ids)
              expect(insideDaughter(s.shape, side, s.chromatids[id]!.centromere, 0.3), at).toBe(
                true,
              );
          }
          if (!s.shape.separated) {
            expect(s.cells, at).toHaveLength(1);
            expect(separatedAt, `${at}: joined again`).toBeNull();
            continue;
          }
          separatedAt ??= u;
          expect(s.cells, at).toHaveLength(2);
          s.cells.forEach((cell, i) => {
            const side = i === 0 ? -1 : 1;
            expect(Math.sign(cell.center[0])).toBe(side);
            // The listed chromatids are this daughter's set, inside it and inside its nucleus.
            expect(cell.chromatids, at).toEqual(
              present(s)
                .filter((c) => c.side === side)
                .map((c) => c.id),
            );
            const nucleus = s.nuclei.find((x) => x.cell === i)!;
            expect(Math.sign(nucleus.center[0])).toBe(side);
            expect(insideDaughter(s.shape, side, nucleus.center, nucleus.radius * 0.9)).toBe(true);
            for (const id of cell.chromatids) {
              const p = s.chromatids[id]!.centromere;
              expect(insideDaughter(s.shape, side, p, 0.3), at).toBe(true);
              expect(dist(p, nucleus.center), at).toBeLessThan(nucleus.radius);
            }
          });
        }
        expect(separatedAt).not.toBeNull();
      }
    }
  });

  it('after cytokinesis: two cells, each with 2n single chromosomes like the mother cell', () => {
    for (const type of CELL_TYPES) {
      for (const n of [2, 4, 23]) {
        const tl = buildTimeline(n, type);
        const s = tl.stateAt(tl.total);
        expect(s.shape.separated).toBe(true);
        expect(s.cells).toHaveLength(2);
        const mother = tl.model[0]!.cells[0]!.chromosomes;
        for (const cell of s.cells) {
          expect(cell.chromatids).toHaveLength(2 * n);
          const cs = cell.chromatids.map((id) => s.chromatids[id]!);
          expect(cs.every((c) => !c.joined)).toBe(true);
          expect([...new Set(cs.map((c) => c.chromosome))].sort((a, b) => a - b)).toEqual(
            mother.map((_, i) => i),
          );
          expect(cs.filter((c) => c.origin === 'M')).toHaveLength(n);
          expect(cs.filter((c) => c.origin === 'P')).toHaveLength(n);
        }
        expect(s.nuclei.map((x) => x.cell).sort()).toEqual([0, 1]);
      }
    }
  });

  it('the continuity check catches small jumps', () => {
    const tl = buildTimeline(2, 'animal');
    // Metaphase after the move (u 0.6): chromosomes and fibres hold still.
    const a = tl.stateAt(13.4);
    const b = tl.stateAt(13.41);
    expect(a.stage).toBe('metaphase');
    expect(jumps(a, b)).toEqual([]);
    const moved = structuredClone(b);
    moved.chromatids[3]!.centromere[1] += 0.1;
    expect(jumps(a, moved)).toHaveLength(1);
    const tip = structuredClone(b);
    tip.fibres.find((f) => f.kind === 'kinetochore')!.to[0] += 0.25;
    expect(jumps(a, tip)).toHaveLength(1);
    const cut = structuredClone(b);
    cut.fibres = cut.fibres.filter((f) => f.kind !== 'polar');
    expect(jumps(a, cut).length).toBeGreaterThan(0);
    // G1: the nucleus may not fade or vanish suddenly.
    const g = tl.stateAt(1);
    const h = tl.stateAt(1.01);
    expect(jumps(g, h)).toEqual([]);
    const faded = structuredClone(h);
    faded.nuclei[0]!.envelope = 0.97;
    expect(jumps(g, faded)).toHaveLength(1);
    expect(jumps(g, { ...h, nuclei: [] })).toHaveLength(1);
  });

  for (const type of CELL_TYPES) {
    for (const n of [1, 2, 3, 4, 23]) {
      it(`stateAt is continuous: no jump in 10 ms or across a boundary (${type}, 2n = ${String(2 * n)})`, () => {
        const tl = buildTimeline(n, type);
        const times = fineTimes(tl);
        expect(times.length).toBeGreaterThan(tl.total * 100);
        const errors: string[] = [];
        let prev = tl.stateAt(times[0]!);
        for (const t of times.slice(1)) {
          const next = tl.stateAt(t);
          for (const e of jumps(prev, next)) errors.push(e);
          prev = next;
        }
        expect(errors.slice(0, 10), `${String(errors.length)} jumps`).toEqual([]);
      });
    }
  }

  it('chromosomes, nuclei and centrosomes stay inside the cell', () => {
    for (const type of CELL_TYPES) {
      for (const n of [1, 2, 3, 4]) {
        const tl = buildTimeline(n, type);
        for (const t of sampleTimes(tl, 20)) {
          const s = tl.stateAt(t);
          for (const c of present(s))
            expect(insideCell(s.shape, c.centromere, 0.3), `${type} t=${t}`).toBe(true);
          for (const x of s.nuclei)
            expect(insideCell(s.shape, x.center, x.radius * 0.9)).toBe(true);
          for (const c of s.centrosomes) expect(insideCell(s.shape, c, 0.2)).toBe(true);
          for (const f of s.fibres) expect(insideCell(s.shape, f.to, 0)).toBe(true);
        }
      }
    }
  });

  it('builds the same timeline for the same inputs (deterministic)', () => {
    const a = buildTimeline(3, 'animal').stateAt(7.3);
    const b = buildTimeline(3, 'animal').stateAt(7.3);
    expect(b).toEqual(a);
    expect(STAGES_3D).toHaveLength(7);
  });
});
