import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TagLayer } from '@/ui/three/tagLayer';
import { expectDisposes } from '@/ui/three/testing';
import { cross, gametes, parseGenotype, type Locus } from '../mendel';
import { mendelDraw } from '../mendelRun';
import type { MendelState } from '../store';
import { MENDEL_TOTAL, fieldOf, mendelModel3d, stepEnd, type MendelModel3D } from './binding';
import { LAYOUT } from './layout';
import { MENDEL_CLASS_TOKENS } from './look';
import { buildMendelScene, type MendelScene } from './scene';

const A: Locus = { letter: 'A', dominance: 'complete' };
const B: Locus = { letter: 'B', dominance: 'complete' };
const Ai: Locus = { letter: 'A', dominance: 'incomplete' };
const Bi: Locus = { letter: 'B', dominance: 'incomplete' };

/** Distinct colours per token, so a wrong colour shows. */
const TOKENS: Record<string, string> = {
  '--chart-1': '#0000ff',
  '--chart-2': '#ff8800',
  '--chart-3': '#00aa00',
  '--chart-4': '#ff0000',
  '--chart-5': '#ff00ff',
  '--chart-6': '#00ffff',
  '--chart-7': '#ffff00',
  '--accent': '#123456',
};
const token = (name: string) => TOKENS[name] ?? '#808080';

function build(model: MendelModel3D, maxInstances = 600): MendelScene {
  return buildMendelScene(model, { tier: 'medium', segments: 16, maxInstances, token });
}

const dihybrid = () => mendelModel3d('AaBb', 'AaBb', [A, B]);

/** A ray straight down onto a point. */
const downRay = (p: readonly number[]) =>
  new THREE.Raycaster(new THREE.Vector3(p[0], 30, p[2]), new THREE.Vector3(0, -1, 0));
/** A ray from the front onto a point. */
const frontRay = (p: readonly number[]) =>
  new THREE.Raycaster(new THREE.Vector3(p[0], p[1], 40), new THREE.Vector3(0, 0, -1));

const visibleMeshes = (sc: MendelScene) => {
  let n = 0;
  sc.scene.traverse((o) => {
    if (o instanceof THREE.InstancedMesh && o.visible) n++;
  });
  return n;
};

describe('3D Mendel scene', () => {
  it('the gametes drawn and their probabilities are gametes(); the board cells are cross().punnett', () => {
    const cases: [string, string, Locus[]][] = [
      ['AaBb', 'AaBb', [A, B]],
      ['AaBb', 'aabb', [A, B]],
      ['Aa', 'Aa', [Ai]],
    ];
    for (const [p1, p2, loci] of cases) {
      const m = mendelModel3d(p1, p2, loci);
      const sc = build(m);
      const d = sc.drawn();
      const want = [
        ...gametes(parseGenotype(p1, loci)).map((g) => ({ parent: 0, ...g })),
        ...gametes(parseGenotype(p2, loci)).map((g) => ({ parent: 1, ...g })),
      ];
      expect(d.gametes).toEqual(want);
      const punnett = cross(p1, p2, loci).punnett;
      expect(d.cells).toHaveLength(punnett.rows.length * punnett.cols.length);
      for (const c of d.cells) expect(c.genotype).toBe(punnett.cells[c.row]?.[c.col]);
      // Every allele on the parents' chromosomes is parseGenotype()'s.
      for (const a of d.alleles) {
        const pairs = parseGenotype(a.parent === 0 ? p1 : p2, loci);
        expect(a.allele).toBe(pairs[a.locus]?.[a.side]);
      }
      expect(d.alleles).toHaveLength(2 * 2 * loci.length);
      sc.dispose();
    }
  });

  it('bar heights are the phenotype probabilities × barH, coloured by class', () => {
    const m = dihybrid();
    const sc = build(m);
    sc.setTime(MENDEL_TOTAL);
    const bars = sc.drawn().bars;
    expect(bars.map((b) => b.key)).toEqual(m.classes.map((c) => c.key));
    // The drawn matrix holds 32-bit floats.
    for (const b of bars) expect(b.height / LAYOUT.barH).toBeCloseTo(b.p, 6);
    expect(bars.map((b) => b.p)).toEqual([9 / 16, 3 / 16, 3 / 16, 1 / 16]);
    // Bar colours: the class tokens in order.
    let mesh: THREE.InstancedMesh | null = null;
    sc.scene.traverse((o) => {
      if (o instanceof THREE.InstancedMesh && o.count === 4 && o.instanceColor) mesh = o;
    });
    expect(mesh).not.toBeNull();
    const c = new THREE.Color();
    m.classes.forEach((_, i) => {
      (mesh as unknown as THREE.InstancedMesh).getColorAt(i, c);
      expect(`#${c.getHexString()}`).toBe(
        `#${new THREE.Color(token(MENDEL_CLASS_TOKENS[i] ?? '')).getHexString()}`,
      );
    });
    sc.dispose();
  });

  it('the steps: gametes after meiosis, offspring after fertilisation, bars and field at the end', () => {
    const m = dihybrid();
    const sc = build(m);
    const field = fieldOf(m, mendelDraw(state()));
    sc.setField(field);
    sc.setTime(0);
    expect(sc.drawn().bars.every((b) => b.height === 0)).toBe(true);
    expect(sc.fieldShown()).toBe(0);
    expect(sc.focusPoint({ kind: 'gamete', parent: 0, index: 0 })).toBeNull();
    const atStart = visibleMeshes(sc);
    sc.setTime(stepEnd(1));
    expect(sc.focusPoint({ kind: 'gamete', parent: 0, index: 0 })).not.toBeNull();
    expect(visibleMeshes(sc)).toBeGreaterThan(atStart);
    sc.setTime(stepEnd(2));
    expect(sc.drawn().bars.every((b) => b.height === 0)).toBe(true);
    sc.setTime(MENDEL_TOTAL);
    expect(sc.fieldShown()).toBe(200);
    expect(sc.drawn().field).toEqual(field?.figures);
    sc.setField(null);
    expect(sc.fieldShown()).toBe(0);
    sc.dispose();
  });

  it('picking: a parent, a gamete, a board cell and a bar', () => {
    const m = dihybrid();
    const sc = build(m);
    sc.setTime(MENDEL_TOTAL);
    const at = (sel: Parameters<MendelScene['focusPoint']>[0]) => {
      const p = sc.focusPoint(sel);
      expect(p, JSON.stringify(sel)).not.toBeNull();
      return p ?? [0, 0, 0];
    };
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 4; col++)
        expect(sc.pick(downRay(at({ kind: 'cell', row, col })))).toEqual({
          kind: 'cell',
          row,
          col,
        });
    expect(sc.pick(downRay(at({ kind: 'gamete', parent: 1, index: 2 })))).toEqual({
      kind: 'gamete',
      parent: 1,
      index: 2,
    });
    expect(sc.pick(downRay(at({ kind: 'gamete', parent: 0, index: 3 })))).toEqual({
      kind: 'gamete',
      parent: 0,
      index: 3,
    });
    expect(sc.pick(downRay(at({ kind: 'parent', parent: 0 })))).toEqual({
      kind: 'parent',
      parent: 0,
    });
    expect(sc.pick(frontRay(at({ kind: 'class', index: 0 })))).toEqual({
      kind: 'class',
      index: 0,
    });
    // Nothing there.
    expect(sc.pick(downRay([60, 0, 60]))).toBeNull();
    sc.dispose();
  });

  it('the selection ring follows the picked part', () => {
    const sc = build(dihybrid());
    sc.setTime(MENDEL_TOTAL);
    const ring = () => {
      let r: THREE.Mesh | null = null;
      sc.scene.traverse((o) => {
        if (o instanceof THREE.Mesh && o.geometry instanceof THREE.TorusGeometry) r = o;
      });
      return r as unknown as THREE.Mesh;
    };
    expect(ring().visible).toBe(false);
    sc.setSelection({ kind: 'cell', row: 1, col: 2 });
    const cell = sc.focusPoint({ kind: 'cell', row: 1, col: 2 });
    expect(ring().visible).toBe(true);
    expect(ring().position.x).toBeCloseTo(cell?.[0] ?? NaN, 9);
    expect(ring().position.z).toBeCloseTo(cell?.[2] ?? NaN, 9);
    sc.setSelection({ kind: 'cell', row: 9, col: 9 });
    expect(ring().visible).toBe(false);
    sc.dispose();
  });

  it('tags: genotypes, gametes with probabilities, phenotypes with probabilities, counts', () => {
    const m = dihybrid();
    const sc = build(m);
    sc.setField(fieldOf(m, mendelDraw(state())));
    sc.setTime(MENDEL_TOTAL);
    const host = document.createElement('div');
    const layer = new TagLayer(host);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 500);
    cam.position.set(1.5, 60, 0.01);
    cam.lookAt(1.5, 0, 0);
    layer.begin(cam, 6000, 6000, { left: 0, top: 0, right: 6000, bottom: 6000 });
    sc.tags(layer, String);
    layer.end();
    const shown = layer.shown();
    for (const row of m.punnett.cells) for (const g of row) expect(shown).toContain(g);
    expect(shown).toContain('AB · 1/4');
    expect(shown).toContain('9/16');
    expect(shown).toContain('1/16');
    for (const c of m.classes) expect(shown).toContain(c.key);
    expect(shown).toContain('♀ AaBb');
    const draw = mendelDraw(state());
    for (const o of draw?.obs ?? []) expect(shown).toContain(String(o));
    layer.dispose();
    expect(sc.labelAnchors().map((a) => a.id)).toEqual([
      'mother',
      'father',
      'board',
      'pedestals',
      'femaleGametes',
      'maleGametes',
      'field',
    ]);
    sc.dispose();
  });

  it('genotypes show in the slots only at close zoom or on the picked cell; no tag overlaps', () => {
    const m = dihybrid();
    const sc = build(m);
    sc.setTime(MENDEL_TOTAL);
    const host = document.createElement('div');
    const layer = new TagLayer(host);
    const shownFrom = (height: number, size: number) => {
      const cam = new THREE.PerspectiveCamera(34, 1, 0.1, 500);
      cam.position.set(1, height, height * 0.9);
      cam.lookAt(1, 0, 0);
      layer.begin(cam, size, size, { left: 0, top: 0, right: size, bottom: size });
      sc.tags(layer, String);
      layer.end();
      return layer.shown();
    };
    const genotypes = m.punnett.cells.flat();
    // Far (cells ~30 px apart): no genotype in the slots; the gametes, ratio marks and keys stay.
    const far = shownFrom(30, 800);
    for (const g of genotypes) expect(far).not.toContain(g);
    expect(far).toContain('9/16');
    for (const c of m.classes) expect(far).toContain(c.key);
    // A picked cell shows its genotype even far away.
    sc.setSelection({ kind: 'cell', row: 0, col: 1 });
    expect(shownFrom(30, 800)).toContain(m.punnett.cells[0]?.[1]);
    sc.setSelection(null);
    // Close: every slot's genotype.
    const close = shownFrom(12, 3000);
    for (const g of genotypes) expect(close).toContain(g);
    // The tags shown never overlap on screen.
    const boxes = layer.rects();
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        if (!a || !b) continue;
        const overlap =
          a.left < b.right - 4 &&
          b.left < a.right - 4 &&
          a.top < b.bottom - 4 &&
          b.top < a.bottom - 4;
        expect(overlap, `tags ${String(i)} and ${String(j)}`).toBe(false);
      }
    layer.dispose();
    sc.dispose();
  });

  it('quality tiers change how things look, never what is drawn', () => {
    const m = dihybrid();
    const field = fieldOf(m, mendelDraw(state()));
    const drawnAt = (tier: 'medium' | 'high', segments: number, maxInstances: number) => {
      const sc = buildMendelScene(m, { tier, segments, maxInstances, token });
      sc.setField(field);
      sc.setTime(MENDEL_TOTAL);
      const d = sc.drawn();
      sc.dispose();
      return d;
    };
    expect(drawnAt('high', 24, 1500)).toEqual(drawnAt('medium', 16, 600));
  });

  it('frees every geometry, material and texture it made', () => {
    expectDisposes(
      () => {
        const m = mendelModel3d('AaBb', 'AaBb', [Ai, B]);
        const sc = build(m);
        sc.setField(fieldOf(m, mendelDraw(state({ dominance: ['incomplete', 'complete'] }))));
        sc.setTime(1.3);
        return sc;
      },
      (sc) => {
        sc.dispose();
      },
    );
  });

  it('draw calls stay few: one per instanced set, never one per offspring', () => {
    const m = mendelModel3d('AaBb', 'AaBb', [Ai, Bi]);
    const sc = build(m, 1500);
    sc.setField(
      fieldOf(m, mendelDraw(state({ dominance: ['incomplete', 'incomplete'], n: 10000 }))),
    );
    sc.setTime(MENDEL_TOTAL);
    expect(m.classes).toHaveLength(9);
    expect(sc.fieldShown()).toBe(200);
    // Measured 2026-10-21 (CPU count, no GPU) after the lab-bench pass (bench, tray with slots
    // and channels, pedestals, glass cylinders with liquid, meniscus and marks; the cylinders'
    // back faces on High only): 43 calls, about 86 000 triangles on Medium for nine classes and
    // 200 figures (was 37 calls, 119 000; High 44 calls). A bigger change must update this budget
    // on purpose.
    const stats = sc.drawStats();
    expect(stats.calls).toBeLessThanOrEqual(43);
    expect(stats.triangles).toBeLessThan(125_000);
    sc.dispose();
  });
});

function state(over: Partial<MendelState> = {}): MendelState {
  return {
    loci: 2,
    dominance: ['complete', 'complete'],
    p1: 'AaBb',
    p2: 'AaBb',
    n: 1000,
    seed: 3,
    ran: true,
    view3d: true,
    ...over,
  };
}
