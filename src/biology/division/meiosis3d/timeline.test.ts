import { describe, expect, it } from 'vitest';
import {
  countsOf,
  gameteSignature,
  runDivision,
  type Cell,
  type Chromatid,
  type StageState,
} from '../division';
import type { Counts3D } from '../division3d/types';
import { meiosisOptions } from '../meiosisOptions';
import {
  MEIOSIS_STAGES_3D,
  MODEL_STAGE,
  SISTER_OFFSET,
  buildMeiosisTimeline,
  insideMembranes,
  type Meiosis3DState,
  type MeiosisChromatidInfo,
  type MeiosisStage3D,
  type MeiosisTimeline,
} from './timeline';

const SEEDS = [1, 2, 3, 7];
const timeline = (pairs: number, crossover = true, seed = 1) =>
  buildMeiosisTimeline(pairs, meiosisOptions(pairs, crossover, seed));

const stateIn = (tl: MeiosisTimeline, stage: MeiosisStage3D, u: number) => {
  const w = tl.stages.find((x) => x.id === stage)!;
  // u = 1 would be the next stage's start; stay just inside the stage.
  return tl.stateAt(w.start + Math.min(u, 0.999999) * (w.end - w.start));
};
const present = (s: Meiosis3DState) => s.chromatids.filter((c) => c.present);
const dist = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(...a.map((v, i) => v - b[i]!));

/** Times spread over the whole timeline (both ends of every stage included). */
function sampleTimes(tl: MeiosisTimeline, perStage = 12): number[] {
  const out: number[] = [];
  for (const w of tl.stages)
    for (let k = 0; k <= perStage; k++) out.push(w.start + ((w.end - w.start) * k) / perStage);
  return out;
}

/**
 * Textbook counts per cell (SGK Sinh học 10), derived by hand for n pairs (2n chromosomes), for
 * the twelve 3D steps. Telophase I / II follow the 3D convention (pending teacher review,
 * DATA_REVIEW MEI3D): one cell with two nuclei, one set each. Cytokinesis: per daughter cell.
 */
const TEXTBOOK: Record<MeiosisStage3D, (n: number) => Counts3D> = {
  g1: (n) => row(1, [1, 1], 2 * n, 'single', 0, 2 * n),
  g2: (n) => row(1, [1, 1], 2 * n, 'double', 4 * n, 4 * n),
  prophase1: (n) => row(1, [1, 0], 2 * n, 'double', 4 * n, 4 * n),
  metaphase1: (n) => row(1, [0, 0], 2 * n, 'double', 4 * n, 4 * n),
  anaphase1: (n) => row(1, [0, 0], 2 * n, 'double', 4 * n, 4 * n),
  telophase1: (n) => ({ ...row(1, [0, 2], 2 * n, 'double', 4 * n, 4 * n), perNucleus: n }),
  cytokinesis1: (n) => row(2, [2, 1], n, 'double', 2 * n, 2 * n),
  prophase2: (n) => row(2, [1, 0], n, 'double', 2 * n, 2 * n),
  metaphase2: (n) => row(2, [0, 0], n, 'double', 2 * n, 2 * n),
  anaphase2: (n) => row(2, [0, 0], 2 * n, 'single', 0, 2 * n),
  telophase2: (n) => ({ ...row(2, [0, 2], 2 * n, 'single', 0, 2 * n), perNucleus: n }),
  cytokinesis2: (n) => row(4, [2, 1], n, 'single', 0, n),
};
function row(
  cells: number,
  nuclei: [number, number],
  chromosomes: number,
  state: 'single' | 'double',
  chromatids: number,
  dna: number,
): Counts3D {
  return {
    cells,
    nuclei: { from: nuclei[0], to: nuclei[1] },
    chromosomes,
    state,
    chromatids,
    centromeres: chromosomes,
    dnaMolecules: dna,
  };
}

/**
 * The model's DNA molecule for a chromatid at a model stage (where the bookkeeping keeps it):
 * the chromosome of its pair and origin in the cell it is in, the sister it is.
 */
function modelChromatid(
  model: StageState[],
  info: MeiosisChromatidInfo,
  stage: MeiosisStage3D,
): Chromatid | undefined {
  const s = model.find((m) => m.stage === MODEL_STAGE[stage])!;
  const find = (cell: Cell | undefined) =>
    cell?.chromosomes.filter((c) => c.pair === info.pair && c.origin === info.origin);
  switch (MODEL_STAGE[stage]) {
    case 'g1':
      return find(s.cells[0])?.[0]?.chromatids[0];
    case 'g2':
    case 'prophase1':
    case 'metaphase1':
    case 'anaphase1':
      return find(s.cells[0])?.[0]?.chromatids[info.sister];
    case 'telophase1':
    case 'prophase2':
    case 'metaphase2':
      return find(s.cells[info.cell1])?.[0]?.chromatids[info.sister];
    case 'anaphase2':
      // [...sister-0 copies, ...sister-1 copies] in the cell of meiosis I.
      return find(s.cells[info.cell1])?.[info.sister]?.chromatids[0];
    case 'telophase2':
      return find(s.cells[info.finalCell])?.[0]?.chromatids[0];
    default:
      return undefined;
  }
}

/** The 3D picture's chromatids of one geometric cell, as a model cell (for gameteSignature). */
function cellOf(tl: MeiosisTimeline, st: Meiosis3DState, k: number): Cell {
  const ids = st.cells[k]?.chromatids ?? [];
  return {
    chromosomes: ids.map((id) => {
      const info = tl.chromatids[id]!;
      const pose = st.chromatids[id]!;
      return {
        pair: info.pair,
        origin: info.origin,
        chromatids: [pose.crossed ? info.after : info.before],
      };
    }),
  };
}

describe('3D meiosis timeline', () => {
  it('has twelve stages in textbook order, each read from a model stage', () => {
    expect(MEIOSIS_STAGES_3D).toEqual([
      'g1',
      'g2',
      'prophase1',
      'metaphase1',
      'anaphase1',
      'telophase1',
      'cytokinesis1',
      'prophase2',
      'metaphase2',
      'anaphase2',
      'telophase2',
      'cytokinesis2',
    ]);
    expect(MODEL_STAGE.cytokinesis1).toBe('telophase1');
    expect(MODEL_STAGE.cytokinesis2).toBe('telophase2');
    const tl = timeline(2);
    expect(tl.stages.map((w) => w.id)).toEqual(MEIOSIS_STAGES_3D);
    for (const id of MEIOSIS_STAGES_3D) {
      const key = tl.keyTime(id);
      expect(tl.stageAt(key).stage).toBe(id);
    }
  });

  for (const n of [1, 2, 3, 4]) {
    it(`counts per stage come from runDivision and match the textbook (2n = ${2 * n})`, () => {
      for (const seed of SEEDS) {
        const tl = timeline(n, seed % 2 === 1, seed);
        for (const stage of MEIOSIS_STAGES_3D) {
          const c = tl.counts(stage);
          expect(c, `${stage} seed ${seed}`).toEqual(TEXTBOOK[stage](n));
          // Read from the model (per cell), except telophase's one cell with two nuclei.
          const m = countsOf(tl.model.find((x) => x.stage === MODEL_STAGE[stage])!);
          if (stage === 'telophase1' || stage === 'telophase2') {
            expect(c.perNucleus).toBe(m.chromosomes);
            expect(c.chromosomes).toBe(2 * m.chromosomes);
            expect(c.dnaMolecules).toBe(2 * m.dnaMolecules);
            expect(c.cells).toBe(m.cells / 2);
          } else {
            expect([c.cells, c.chromosomes, c.state, c.chromatids, c.centromeres]).toEqual([
              m.cells,
              m.chromosomes,
              m.state,
              m.chromatids,
              m.centromeres,
            ]);
            expect(c.dnaMolecules).toBe(m.dnaMolecules);
          }
        }
      }
    });

    it(`the drawn chromatids match the counts at every stage (2n = ${2 * n})`, () => {
      const tl = timeline(n);
      for (const stage of MEIOSIS_STAGES_3D) {
        const c = tl.counts(stage);
        const st = stateIn(tl, stage, 1);
        const cells = st.cells.length;
        expect(cells, stage).toBe(c.cells);
        for (const cell of st.cells) {
          // DNA molecules in one drawn cell = its present chromatids.
          expect(cell.chromatids.length, stage).toBe(c.dnaMolecules);
          const joined = cell.chromatids.filter((id) => st.chromatids[id]!.joined).length;
          expect(joined, stage).toBe(c.chromatids);
        }
        expect(st.centromeres.length / cells, stage).toBe(c.centromeres);
      }
    });
  }

  it('counts only for a big set: 2n = 46', () => {
    const tl = timeline(23);
    for (const stage of MEIOSIS_STAGES_3D) expect(tl.counts(stage)).toEqual(TEXTBOOK[stage](23));
  });

  it('metaphase I: each homologue faces the pole the model sends it to (orientation)', () => {
    for (const n of [1, 2, 3, 4]) {
      for (const seed of SEEDS) {
        const tl = timeline(n, true, seed);
        const st = tl.stateAt(tl.keyTime('metaphase1'));
        for (const info of tl.chromatids) {
          const pose = st.chromatids[tl.chromatids.indexOf(info)]!;
          const mFirst = tl.options.orientation[info.pair]!;
          // orientation true = the maternal homologue goes to the first (−x) pole.
          const expected = (info.origin === 'M') === mFirst ? -1 : 1;
          expect(Math.sign(pose.centromere[0]), `pair ${info.pair} ${info.origin}`).toBe(expected);
          expect(pose.paired).toBe(true);
          expect(pose.joined).toBe(true);
        }
        // The model's anaphase I poles agree.
        const ana = tl.model.find((s) => s.stage === 'anaphase1')!.poles![0]!;
        for (const c of ana[0]) {
          const info = tl.chromatids.find((x) => x.pair === c.pair && x.origin === c.origin)!;
          expect(info.cell1).toBe(0);
        }
      }
    }
  });

  it('anaphase I moves whole double chromosomes; anaphase II splits the sisters', () => {
    const tl = timeline(3, true, 2);
    const a1 = stateIn(tl, 'anaphase1', 1);
    for (let i = 0; i < a1.chromatids.length; i += 2) {
      const s0 = a1.chromatids[i]!;
      const s1 = a1.chromatids[i + 1]!;
      expect(s0.joined && s1.joined).toBe(true);
      // Both sisters at the same pole, next to each other.
      expect(Math.sign(s0.centromere[0])).toBe(Math.sign(s1.centromere[0]));
      expect(dist(s0.centromere, s1.centromere)).toBeLessThanOrEqual(2 * SISTER_OFFSET + 1e-9);
      expect(Math.abs(s0.centromere[0])).toBeGreaterThan(3);
    }
    // Homologues of one pair end at opposite poles.
    for (const info of tl.chromatids.filter((c) => c.origin === 'M')) {
      const partner = tl.chromatids.findIndex(
        (c) => c.pair === info.pair && c.origin === 'P' && c.sister === info.sister,
      );
      const me = a1.chromatids[tl.chromatids.indexOf(info)]!;
      expect(Math.sign(me.centromere[0])).toBe(-Math.sign(a1.chromatids[partner]!.centromere[0]));
    }
    const a2 = stateIn(tl, 'anaphase2', 1);
    for (let i = 0; i < a2.chromatids.length; i += 2) {
      const s0 = a2.chromatids[i]!;
      const s1 = a2.chromatids[i + 1]!;
      expect(s0.joined || s1.joined).toBe(false);
      // Same cell of meiosis I (same side of x), opposite poles of its own spindle (y).
      expect(Math.sign(s0.centromere[0])).toBe(Math.sign(s1.centromere[0]));
      expect(s0.centromere[1]).toBeLessThan(-1.5);
      expect(s1.centromere[1]).toBeGreaterThan(1.5);
    }
  });

  it('metaphase II: in each cell the spindle is at a right angle to the first one', () => {
    const tl = timeline(2);
    const m1 = tl.stateAt(tl.keyTime('metaphase1'));
    const m2 = tl.stateAt(tl.keyTime('metaphase2'));
    const axis = (s: Meiosis3DState, i: number) => {
      const p = s.centrosomes[i]!;
      const q = s.centrosomes[i + (s.division === 1 ? 1 : 2)]!;
      const d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
      const l = Math.hypot(...d);
      return d.map((x) => x / l);
    };
    expect(Math.abs(axis(m1, 0)[0]!)).toBeCloseTo(1, 6);
    for (const i of [0, 1]) {
      const a = axis(m2, i);
      expect(Math.abs(a[1]!)).toBeCloseTo(1, 6);
      expect(Math.abs(a[0]! * 1)).toBeCloseTo(0, 6);
    }
    // Every centromere on its cell's plate (y = 0), sisters on opposite sides of it.
    for (const c of m2.centromeres) expect(Math.abs(c.position[1])).toBeLessThan(1e-9);
  });

  it('each final cell has n single chromosomes, one of each pair', () => {
    for (const n of [1, 2, 3, 4]) {
      const tl = timeline(n, true, 3);
      const st = stateIn(tl, 'cytokinesis2', 1);
      expect(st.cells).toHaveLength(4);
      for (const cell of st.cells) {
        const poses = cell.chromatids.map((id) => st.chromatids[id]!);
        expect(poses).toHaveLength(n);
        for (const p of poses) expect(p.joined).toBe(false);
        expect(new Set(poses.map((p) => tl.chromatids[p.id]!.pair)).size).toBe(n);
      }
    }
  });

  it('each chromatid is painted from the model; only inner non-sister chromatids recombine', () => {
    for (const n of [1, 2, 3, 4]) {
      for (const crossover of [true, false]) {
        const tl = timeline(n, crossover, 5);
        for (const stage of MEIOSIS_STAGES_3D) {
          for (const u of [0.05, 0.5, 0.95]) {
            const st = stateIn(tl, stage, u);
            st.chromatids.forEach((p, id) => {
              if (!p.present) return;
              const info = tl.chromatids[id]!;
              const painted = p.crossed ? info.after : info.before;
              // Prophase I before the exchange still shows the G2 chromatid (the model's
              // prophase I is the state after crossing over).
              const ref =
                stage === 'prophase1' && !p.crossed
                  ? modelChromatid(tl.model, info, 'g2')
                  : modelChromatid(tl.model, info, stage);
              expect(painted, `${stage} u=${u} chromatid ${id}`).toEqual(ref);
            });
          }
        }
        const recombinant = tl.chromatids.filter((c) => c.recombinant);
        expect(recombinant.length).toBe(crossover ? 2 : 0);
        for (const c of recombinant) {
          expect(c.inner).toBe(true);
          expect(c.pair).toBe(0);
        }
        if (crossover) {
          // Geometrically inner: in metaphase I they are the closest chromatids of the two
          // homologues of pair 1.
          const st = tl.stateAt(tl.keyTime('metaphase1'));
          const pair0 = tl.chromatids.flatMap((c, id) => (c.pair === 0 ? [id] : []));
          let best: [number, number] = [-1, -1];
          let bestD = Infinity;
          for (const a of pair0)
            for (const b of pair0) {
              if (tl.chromatids[a]!.origin !== 'M' || tl.chromatids[b]!.origin !== 'P') continue;
              const d = dist(st.chromatids[a]!.centromere, st.chromatids[b]!.centromere);
              if (d < bestD) [bestD, best] = [d, [a, b]];
            }
          expect(best.map((id) => tl.chromatids[id]!.recombinant)).toEqual([true, true]);
          expect(st.chiasmata).toHaveLength(1);
          expect(st.chiasmata[0]!.chromatids).toEqual(best);
          expect(st.chiasmata[0]!.point).toBe(tl.options.crossovers[0]!.point);
        }
      }
    }
  });

  it('crossing over happens in prophase I once the homologues are paired; chiasma until anaphase I', () => {
    const tl = timeline(2, true, 1);
    const early = stateIn(tl, 'prophase1', 0.2);
    expect(early.chromatids.some((c) => c.crossed)).toBe(false);
    expect(early.chiasmata).toEqual([]);
    const late = stateIn(tl, 'prophase1', 0.9);
    expect(late.chromatids.every((c) => c.crossed && c.paired)).toBe(true);
    expect(late.chiasmata[0]?.weight).toBeCloseTo(1, 6);
    expect(stateIn(tl, 'anaphase1', 0.5).chiasmata).toEqual([]);
    expect(stateIn(tl, 'anaphase1', 0.5).chromatids.some((c) => c.paired)).toBe(false);
    expect(timeline(2, false).stateAt(tl.keyTime('metaphase1')).chiasmata).toEqual([]);
  });

  it('the same seed gives the same gametes in the 2D model and the 3D picture', () => {
    for (const n of [1, 2, 3, 4]) {
      for (const seed of SEEDS) {
        for (const crossover of [true, false]) {
          const opts = meiosisOptions(n, crossover, seed);
          const tl = buildMeiosisTimeline(n, opts);
          // The 2D lesson runs runDivision with the same options (useStages).
          const twoD = runDivision('meiosis', n, meiosisOptions(n, crossover, seed))
            .at(-1)!
            .cells.map(gameteSignature);
          const st = stateIn(tl, 'cytokinesis2', 1);
          const threeD = st.cells.map((_, k) => gameteSignature(cellOf(tl, st, k)));
          expect(threeD).toEqual(twoD);
          expect(tl.gametes()).toEqual(twoD);
          expect(new Set(threeD).size).toBe(crossover ? 4 : 2);
        }
      }
    }
  });

  it('no DNA replication between meiosis I and meiosis II', () => {
    for (const n of [1, 2, 3, 4]) {
      const tl = timeline(n);
      const dna = (['telophase1', 'cytokinesis1', 'prophase2', 'metaphase2'] as const).map(
        (s) => tl.counts(s).dnaMolecules,
      );
      // Telophase I counts the one cell's two nuclei (2 × n double chromosomes).
      expect(dna).toEqual([4 * n, 2 * n, 2 * n, 2 * n]);
      // The same chromatids (DNA molecules), none added: 4n from G2 to the end.
      for (const t of sampleTimes(tl, 6)) {
        const st = tl.stateAt(t);
        if (st.stage === 'g1') continue;
        expect(present(st)).toHaveLength(4 * n);
      }
      const before = stateIn(tl, 'cytokinesis1', 1);
      const after = stateIn(tl, 'prophase2', 0);
      expect(before.chromatids.map((c) => c.joined)).toEqual(after.chromatids.map((c) => c.joined));
      expect(after.chromatids.every((c) => c.joined)).toBe(true);
    }
  });

  it('nuclei and cells: one cell, then two, then four', () => {
    const tl = timeline(2);
    expect(stateIn(tl, 'telophase1', 1).cells).toHaveLength(1);
    expect(stateIn(tl, 'telophase1', 1).nuclei.filter((x) => x.envelope >= 0.5)).toHaveLength(2);
    expect(stateIn(tl, 'cytokinesis1', 1).cells).toHaveLength(2);
    expect(stateIn(tl, 'telophase2', 1).cells).toHaveLength(2);
    expect(stateIn(tl, 'telophase2', 1).nuclei.filter((x) => x.envelope >= 0.5)).toHaveLength(4);
    expect(stateIn(tl, 'cytokinesis2', 1).cells).toHaveLength(4);
    // Each final cell's chromatids lie in its own quadrant (x: meiosis I cell; y: sister).
    const st = stateIn(tl, 'cytokinesis2', 1);
    st.cells.forEach((cell, k) => {
      for (const id of cell.chromatids) {
        const p = st.chromatids[id]!.centromere;
        expect(Math.sign(p[0])).toBe(k < 2 ? -1 : 1);
        expect(Math.sign(p[1])).toBe(k % 2 === 0 ? -1 : 1);
      }
    });
  });

  it('chromosomes, nuclei, centrosomes and fibres stay inside the cells', () => {
    for (const n of [1, 2, 3, 4]) {
      const tl = timeline(n);
      for (const t of sampleTimes(tl, 16)) {
        const s = tl.stateAt(t);
        const at = `2n=${2 * n} ${s.stage} u=${s.u.toFixed(2)}`;
        for (const c of present(s))
          expect(insideMembranes(s.membranes, c.centromere, 0.3), at).toBe(true);
        for (const x of s.nuclei)
          expect(insideMembranes(s.membranes, x.center, x.radius * 0.9), at).toBe(true);
        for (const c of s.centrosomes) expect(insideMembranes(s.membranes, c, 0.2), at).toBe(true);
        for (const f of s.fibres) expect(insideMembranes(s.membranes, f.to, 0), at).toBe(true);
      }
    }
  });

  it('prophase I and II: no spindle fibre enters a nucleus whose envelope is still there', () => {
    const tl = timeline(4);
    for (const stage of ['prophase1', 'prophase2'] as const) {
      for (let k = 0; k <= 200; k++) {
        const s = stateIn(tl, stage, k / 200);
        for (const nuc of s.nuclei) {
          if (nuc.envelope < 0.5) continue;
          for (const f of s.fibres)
            expect(dist(f.to, nuc.center), `${stage} u=${k / 200}`).toBeGreaterThan(nuc.radius);
        }
      }
    }
  });

  it('stateAt is continuous: no jump in 10 ms or across a boundary', () => {
    for (const n of [1, 4]) {
      const tl = timeline(n);
      const times = new Set<number>();
      for (let k = 0; k <= Math.round(tl.total * 100); k++) times.add(Math.min(tl.total, k / 100));
      for (const w of tl.stages.slice(1)) times.add(w.start - 1e-6);
      const sorted = [...times].sort((a, b) => a - b);
      const errors: string[] = [];
      let prev = tl.stateAt(sorted[0]!);
      for (const t of sorted.slice(1)) {
        const next = tl.stateAt(t);
        errors.push(...jumps(prev, next));
        prev = next;
      }
      expect(errors.slice(0, 10), `${String(errors.length)} jumps (2n = ${2 * n})`).toEqual([]);
    }
  });

  it('the continuity check catches small jumps', () => {
    const tl = timeline(2);
    const a = tl.stateAt(10);
    const b = tl.stateAt(10.01);
    expect(jumps(a, b)).toEqual([]);
    const moved = structuredClone(b);
    moved.chromatids[0]!.centromere[0] += 0.2;
    expect(jumps(a, moved).length).toBeGreaterThan(0);
  });

  it('builds the same timeline for the same inputs (deterministic)', () => {
    const a = timeline(3, true, 9);
    const b = timeline(3, true, 9);
    for (const t of [0, 7.5, 21, 40]) expect(a.stateAt(t)).toEqual(b.stateAt(t));
  });
});

// ---------------------------------------------------------------- continuity check

/** Speed limits (cell units, or shares, per second of model time); see the mitosis test. */
const LIMIT = { position: 8, direction: 8, fibreTip: 20, fraction: 1, neckSquared: 25 } as const;

function jumps(a: Meiosis3DState, b: Meiosis3DState): string[] {
  const out: string[] = [];
  const dt = b.t - a.t;
  const boundary = a.stage !== b.stage;
  const at = `t=${a.t.toFixed(6)}→${b.t.toFixed(6)} (${a.stage}→${b.stage})`;
  const within = (what: string, moved: number, limit: keyof typeof LIMIT) => {
    if (!(moved <= LIMIT[limit] * dt + 1e-9))
      out.push(`${at}: ${what} changed by ${String(moved)}`);
  };
  const onlyAtBoundary = (what: string) => {
    if (!boundary) out.push(`${at}: ${what} inside a stage`);
  };
  // The second division gives each chromatid a new pole (its sister's spindle).
  const newDivision = a.stage === 'cytokinesis1' && b.stage === 'prophase2';
  a.chromatids.forEach((p, i) => {
    const q = b.chromatids[i]!;
    if (p.side !== q.side && !newDivision) out.push(`${at}: chromatid ${i} changed pole`);
    if (p.present !== q.present && !(a.stage === 'g1' && b.stage === 'g2'))
      out.push(`${at}: chromatid ${i} appeared or vanished`);
    if (p.joined !== q.joined) onlyAtBoundary(`chromatid ${i} joined or split`);
    if (!p.present || !q.present) return;
    within(`chromatid ${i} centromere`, dist(p.centromere, q.centromere), 'position');
    within(`chromatid ${i} arm A`, dist(p.dirA, q.dirA), 'direction');
    within(`chromatid ${i} arm B`, dist(p.dirB, q.dirB), 'direction');
  });
  // Centrosomes: S adds one next to the first (G1 → G2); each cell's partner appears next to
  // it at the start of meiosis II.
  const shared = Math.min(a.centrosomes.length, b.centrosomes.length);
  for (let i = 0; i < shared; i++)
    within(`centrosome ${i}`, dist(a.centrosomes[i]!, b.centrosomes[i]!), 'position');
  if (a.centrosomes.length !== b.centrosomes.length) {
    const ok =
      (a.stage === 'g1' && b.stage === 'g2') || (a.stage === 'cytokinesis1' && newDivision);
    if (!ok) out.push(`${at}: centrosome count changed`);
    for (let i = shared; i < b.centrosomes.length; i++) {
      const near = Math.min(...a.centrosomes.map((c) => dist(c, b.centrosomes[i]!)));
      if (near > 1) out.push(`${at}: centrosome ${i} appeared ${near} away`);
    }
  }
  // Nuclei: matched by order; one appears or disappears only while its envelope is invisible.
  for (let i = 0; i < Math.max(a.nuclei.length, b.nuclei.length); i++) {
    const x = a.nuclei[i];
    const y = b.nuclei[i];
    if (x && y) {
      within(`nucleus ${i} centre`, dist(x.center, y.center), 'position');
      within(`nucleus ${i} radius`, Math.abs(x.radius - y.radius), 'position');
      within(`nucleus ${i} envelope`, Math.abs(x.envelope - y.envelope), 'fraction');
    } else {
      const only = x ?? y;
      if (only) within(`nucleus ${i} (dis)appearing envelope`, only.envelope, 'fraction');
    }
  }
  within('condensation', Math.abs(a.condensation - b.condensation), 'fraction');
  within('spindle', Math.abs(a.spindle - b.spindle), 'fraction');
  // Membranes: the same ones change smoothly; at the start of meiosis II the two separated
  // daughters of meiosis I become two membranes of their own, in the same place.
  if (a.membranes.length === b.membranes.length) {
    a.membranes.forEach((m, i) => {
      const n = b.membranes[i]!;
      within(`membrane ${i} centre`, dist(m.center, n.center), 'position');
      within(`membrane ${i} elongation`, Math.abs(m.elongation - n.elongation), 'fraction');
      within(`membrane ${i} offset`, Math.abs(m.offset - n.offset), 'position');
      within(`membrane ${i} radius`, Math.abs(m.radius - n.radius), 'position');
      within(`furrow ${i}`, Math.abs(m.ringRadius ** 2 - n.ringRadius ** 2), 'neckSquared');
      if (m.separated && !n.separated) out.push(`${at}: cells joined again`);
    });
  } else if (newDivision) {
    const m = a.membranes[0]!;
    if (!m.separated || m.elongation > 1e-6) out.push(`${at}: meiosis I cells not apart yet`);
    b.membranes.forEach((n, k) => {
      const c = (k === 0 ? -1 : 1) * m.offset;
      within(`cell ${k} centre`, dist(n.center, [c, 0, 0]), 'position');
      within(`cell ${k} radius`, Math.abs(n.radius - m.radius), 'position');
      if (n.offset > 1e-9 || n.elongation > 1e-9) out.push(`${at}: cell ${k} not round`);
    });
  } else {
    out.push(`${at}: membrane count changed`);
  }
  // Fibres: matched by kind, pole and order; new ones grow out of their root.
  const key = (s: Meiosis3DState) => {
    const m = new Map<string, Meiosis3DState['fibres'][number]>();
    const seen = new Map<string, number>();
    for (const f of s.fibres) {
      const base =
        f.kind === 'kinetochore' ? `k→${String(f.chromatid)}` : `${f.kind}@${String(f.pole)}`;
      const k = seen.get(base) ?? 0;
      seen.set(base, k + 1);
      m.set(`${base}#${String(k)}`, f);
    }
    return m;
  };
  const fa = key(a);
  const fb = key(b);
  for (const [k, f] of fb) {
    const g = fa.get(k);
    if (!g) {
      within(`new fibre ${k} length`, dist(f.from, f.to), 'fibreTip');
      continue;
    }
    within(`fibre ${k} root`, dist(g.from, f.from), 'position');
    within(`fibre ${k} tip`, dist(g.to, f.to), 'fibreTip');
  }
  for (const [k, g] of fa)
    if (!fb.has(k)) within(`removed fibre ${k} length`, dist(g.from, g.to), 'fibreTip');
  return out;
}
