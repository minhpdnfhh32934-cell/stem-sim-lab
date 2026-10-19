import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { expectAllFreed, testKit } from '../view3d/testing';
import { STAGES, runDivision } from './division';
import { CELL_R, meiosisLayout, widthOf } from './meiosisLayout';
import { buildMeiosisScene } from './meiosisScene';

const runs = [1, 2, 3, 4].map((pairs) =>
  runDivision('meiosis', pairs, {
    orientation: Array.from({ length: pairs }, (_, k) => k % 2 === 0),
    crossovers: [{ pair: 0, point: 0.4 }],
  }),
);

describe('meiosis 3D layout', () => {
  it('draws every chromosome of every cell of the model’s stage, inside its cell', () => {
    for (const stages of runs) {
      expect(stages.map((s) => s.stage)).toEqual(STAGES.meiosis);
      for (const s of stages) {
        const lay = meiosisLayout(s);
        expect(lay.cells).toHaveLength(s.cells.length);
        const total = s.cells.reduce((n, c) => n + c.chromosomes.length, 0);
        expect(lay.chromosomes, s.stage).toHaveLength(total);
        for (const p of lay.chromosomes) {
          const c = lay.cells[p.cell] ?? [0, 0, 0];
          const far = Math.hypot(p.center[0] - c[0], p.center[2] - c[2]) + 0.3;
          const reach = Math.hypot(far, Math.abs(p.center[1] - c[1]) + p.length / 2);
          expect(reach, s.stage).toBeLessThanOrEqual(CELL_R * 1.12);
        }
      }
    }
  });

  it('metaphase I: each homologue faces the pole the model sends it to; anaphase I splits pairs', () => {
    for (const stages of runs) {
      const meta = stages.find((s) => s.stage === 'metaphase1');
      const ana = stages.find((s) => s.stage === 'anaphase1');
      if (!meta || !ana) throw new Error('stages');
      const lay = meiosisLayout(meta);
      for (const p of lay.chromosomes) {
        const mFirst = meta.orientation?.[p.chromosome.pair] ?? true;
        const toFirst = p.chromosome.origin === 'M' ? mFirst : !mFirst;
        expect(p.pole).toBe(toFirst ? -1 : 1);
        expect(Math.sign(p.center[0])).toBe(p.pole);
      }
      const a = meiosisLayout(ana);
      const left = a.chromosomes.filter((p) => p.pole === -1);
      const right = a.chromosomes.filter((p) => p.pole === 1);
      const n = (ana.poles?.[0]?.[0] ?? []).length;
      expect(left).toHaveLength(n);
      expect(right).toHaveLength(n);
      // One homologue of every pair on each side.
      expect(new Set(left.map((p) => p.chromosome.pair)).size).toBe(n);
    }
  });

  it('chromosomes lined up on a plate or at a pole never overlap', () => {
    for (const stages of runs) {
      for (const s of stages) {
        const lay = meiosisLayout(s);
        const groups = new Map<string, typeof lay.chromosomes>();
        for (const p of lay.chromosomes) {
          if (p.pole === null) continue;
          const key = `${String(p.cell)}|${String(Math.round(p.center[0] * 10))}`;
          groups.set(key, [...(groups.get(key) ?? []), p]);
        }
        for (const list of groups.values()) {
          for (let i = 0; i < list.length; i++)
            for (let j = 0; j < i; j++) {
              const a = list[i];
              const b = list[j];
              if (!a || !b) continue;
              const dy = Math.abs(a.center[1] - b.center[1]) - (a.length + b.length) / 2;
              const dz =
                Math.abs(a.center[2] - b.center[2]) -
                (widthOf(a.chromosome) + widthOf(b.chromosome)) / 2;
              expect(dy > 0 || dz > 0, `${s.stage}: ${String(i)} overlaps ${String(j)}`).toBe(true);
            }
        }
      }
    }
  });

  it('the scene draws each chromatid segment by segment (crossing over shows); frees all', () => {
    const stages = runs[1] ?? [];
    const meta = stages.find((s) => s.stage === 'metaphase1');
    if (!meta) throw new Error('stage');
    const { kit, track, start } = testKit();
    buildMeiosisScene(kit, meta);
    const segments = meta.cells.reduce(
      (n, c) =>
        n + c.chromosomes.reduce((m, ch) => m + ch.chromatids.reduce((k, t) => k + t.length, 0), 0),
      0,
    );
    let cylinders = 0;
    kit.scene.traverse((o) => {
      if (o instanceof THREE.Mesh && o.geometry instanceof THREE.CylinderGeometry) cylinders++;
    });
    // Chromatid segments plus spindle fibres (4 polar per pole + one per attached chromosome).
    const attached = meiosisLayout(meta).chromosomes.length;
    expect(cylinders).toBe(segments + 8 + attached);
    // The crossover made more segments than chromatids.
    expect(segments).toBeGreaterThan(8);
    expectAllFreed(kit, track, start);
  });
});
