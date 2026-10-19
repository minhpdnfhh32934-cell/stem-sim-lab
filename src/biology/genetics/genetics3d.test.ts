import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { SceneKit } from '../view3d/kit';
import { expectAllFreed, testKit } from '../view3d/testing';
import { allelePool, driftAt, fateOf, genotypeFigures } from './genetics3d';
import { cross, phenotype, type Locus } from './mendel';
import { wrightFisher } from './population';
import { buildDriftScene, buildHwScene, buildMendelScene } from './scenes3d';
import { rng } from './stats';

const instancedCounts = (kit: SceneKit) => {
  const out: number[] = [];
  kit.scene.traverse((o) => {
    if (o instanceof THREE.InstancedMesh) out.push(o.visible ? o.count : 0);
  });
  return out;
};
const labels = (kit: SceneKit) => {
  const out: string[] = [];
  kit.scene.traverse((o) => {
    const el = (o as { element?: HTMLElement }).element;
    if (el) out.push(el.textContent);
  });
  return out;
};

describe('genetics 3D numbers', () => {
  it('fate, frequencies and counts come straight from the runs and the genotype counts', () => {
    expect(fateOf([0.5, 0.7, 1])).toBe('fixed');
    expect(fateOf([0.5, 0.2, 0])).toBe('lost');
    expect(fateOf([0.5, 0.4])).toBe('polymorphic');
    const runs = [
      [0.5, 0.6, 1, 1],
      [0.5, 0.3, 0, 0],
      [0.5, 0.5, 0.4, 0.45],
    ];
    expect(driftAt(runs, 2)).toEqual({ p: [1, 0, 0.4], fixed: 1, lost: 1 });
    expect(driftAt(runs, 99).p).toEqual([1, 0, 0.45]);
    expect(allelePool({ AA: 360, Aa: 480, aa: 160 })).toEqual({ A: 1200, a: 800 });
    expect(genotypeFigures({ AA: 360, Aa: 480, aa: 160 }, 2000)).toEqual({
      per: 1,
      AA: 360,
      Aa: 480,
      aa: 160,
    });
    expect(genotypeFigures({ AA: 3600, Aa: 4800, aa: 1600 }, 2000)).toEqual({
      per: 5,
      AA: 720,
      Aa: 960,
      aa: 320,
    });
  });
});

describe('genetics 3D scenes', () => {
  it('drift: every tube holds 2N copies, the A beads are the run’s count at each generation', () => {
    const { kit, track, start } = testKit();
    const N = 20;
    const rand = rng(3);
    const runs = Array.from({ length: 6 }, () => wrightFisher(N, 0.5, 60, rand));
    const s = buildDriftScene(kit, { runs, copies: 2 * N, per: 1, texts: { tube: String } });
    for (const g of [0, 10, 37, 60]) {
      s.setTime?.(g);
      const [a = 0, b = 0] = instancedCounts(kit);
      const expectedA = runs.reduce((sum, r) => sum + Math.round((r[g] ?? 0) * 2 * N), 0);
      expect(a).toBe(expectedA);
      expect(a + b).toBe(runs.length * 2 * N);
    }
    expectAllFreed(kit, track, start);
  });

  it('Hardy–Weinberg: one figure per individual of each genotype, one bead per gene copy', () => {
    const { kit, track, start } = testKit();
    buildHwScene(kit, {
      figures: { AA: 36, Aa: 48, aa: 16 },
      pool: { A: 120, a: 80 },
      perAllele: 1,
      texts: { A: 'A', a: 'a', pool: 'pool', AA: 'AA', Aa: 'Aa', aa: 'aa' },
    });
    expect(instancedCounts(kit)).toEqual([36, 48, 16, 120, 80]);
    expectAllFreed(kit, track, start);
  });

  it('Mendel: one tile per Punnett cell, labelled with its genotype; bars of every phenotype', () => {
    const { kit, track, start } = testKit();
    const loci: Locus[] = [
      { letter: 'A', dominance: 'complete' },
      { letter: 'B', dominance: 'complete' },
    ];
    const r = cross('AaBb', 'AaBb', loci);
    const keys = [...r.phenotypes.keys()].sort();
    buildMendelScene(kit, {
      rows: r.punnett.rows,
      cols: r.punnett.cols,
      cells: r.punnett.cells,
      hue: r.punnett.cells.map((row) => row.map((c) => keys.indexOf(phenotype(c, loci)))),
      bars: keys.map((k, i) => ({
        key: k,
        count: String(i),
        probability: r.phenotypes.get(k) ?? 0,
        hue: i,
      })),
      texts: { female: '♀', male: '♂' },
    });
    const text = labels(kit);
    for (const row of r.punnett.cells) for (const c of row) expect(text).toContain(c);
    for (const k of keys) expect(text).toContain(k);
    expect(text.filter((t) => /^[A-Za-z]{4}$/.test(t))).toHaveLength(16);
    expectAllFreed(kit, track, start);
  });
});
