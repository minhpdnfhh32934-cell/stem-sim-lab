import { describe, expect, it } from 'vitest';
import { countsOf, runDivision } from '../division';
import {
  SISTER_OFFSET,
  STAGES_3D,
  buildTimeline,
  insideCell,
  type CellType,
  type Mitosis3DState,
  type Stage3D,
  type Timeline,
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
        expect(tel.state).toBe('single');
        // Cytokinesis: the model's two daughter cells, each 2n single.
        const cyt = tl.counts('cytokinesis');
        expect([cyt.cells, cyt.chromosomes, cyt.state, cyt.chromatids, cyt.centromeres]).toEqual([
          2,
          2 * n,
          'single',
          0,
          2 * n,
        ]);
        expect(cyt.nuclei).toEqual({ from: 2, to: 1 });
        expect(tl.counts('prophase').nuclei).toEqual({ from: 1, to: 0 });
        expect(tl.counts('metaphase').nuclei).toEqual({ from: 0, to: 0 });
        expect(tl.counts('g1').nuclei).toEqual({ from: 1, to: 1 });
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
          const gap = Math.hypot(...s0.centromere.map((v, k) => v - s1.centromere[k]!));
          expect(gap).toBeCloseTo(2 * SISTER_OFFSET, 9);
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

  it('metaphase: kinetochore fibres reach a chromosome before it moves to the plate', () => {
    const dist = (a: readonly number[], b: readonly number[]) =>
      Math.hypot(...a.map((v, i) => v - b[i]!));
    for (const type of CELL_TYPES) {
      for (const n of [2, 4, 23]) {
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
      }
    }
  });

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
            expect(Math.hypot(...f.to.map((v, i) => v - c.centromere[i]!))).toBeLessThan(1e-6);
          }
        }
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

  it('telophase: one cell with two nuclei, each around one full set', () => {
    for (const type of CELL_TYPES) {
      const n = 4;
      const tl = buildTimeline(n, type);
      const s = stateIn(tl, 'telophase', 1);
      expect(s.cells).toHaveLength(1);
      const nuclei = s.nuclei.filter((x) => x.envelope > 0.5);
      expect(nuclei).toHaveLength(2);
      expect(s.spindle).toBe(0);
      expect(s.condensation).toBe(0);
      for (const nucleus of nuclei) {
        const inside = present(s).filter(
          (c) => Math.hypot(...c.centromere.map((v, i) => v - nucleus.center[i]!)) < nucleus.radius,
        );
        expect(inside).toHaveLength(2 * n);
        expect(new Set(inside.map((c) => c.chromosome)).size).toBe(2 * n);
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

  it('stateAt is continuous (topology changes only at stage boundaries)', () => {
    for (const type of CELL_TYPES) {
      const tl = buildTimeline(4, type);
      const dt = 1e-3;
      for (const w of tl.stages) {
        for (let t = w.start; t + dt < w.end; t += 0.05) {
          const a = tl.stateAt(t);
          const b = tl.stateAt(t + dt);
          expect(b.stage).toBe(a.stage);
          for (let i = 0; i < a.chromatids.length; i++) {
            const p = a.chromatids[i]!;
            const q = b.chromatids[i]!;
            const d = Math.hypot(...p.centromere.map((v, k) => v - q.centromere[k]!));
            expect(d).toBeLessThan(0.05);
            expect(Math.hypot(...p.dirA.map((v, k) => v - q.dirA[k]!))).toBeLessThan(0.05);
          }
          expect(Math.abs(a.condensation - b.condensation)).toBeLessThan(0.01);
          expect(Math.abs(a.spindle - b.spindle)).toBeLessThan(0.01);
          expect(b.centrosomes).toHaveLength(a.centrosomes.length);
          a.centrosomes.forEach((c, i) => {
            expect(Math.hypot(...c.map((v, k) => v - b.centrosomes[i]![k]!))).toBeLessThan(0.05);
          });
        }
      }
      // Positions are also continuous across boundaries (only topology flags change there).
      for (const w of tl.stages.slice(1)) {
        const a = tl.stateAt(w.start - 1e-6);
        const b = tl.stateAt(w.start);
        for (let i = 0; i < a.chromatids.length; i++) {
          const p = a.chromatids[i]!;
          const q = b.chromatids[i]!;
          expect(Math.hypot(...p.centromere.map((v, k) => v - q.centromere[k]!))).toBeLessThan(
            1e-3,
          );
        }
        expect(Math.abs(a.condensation - b.condensation)).toBeLessThan(1e-3);
      }
    }
  });

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
