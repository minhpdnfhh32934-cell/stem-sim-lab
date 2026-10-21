import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { expectDisposes } from '@/ui/three/testing';
import { ROLES } from '../../view3d/palette';
import { complement, mutate, type Mutation } from '../dogma';
import { beadNames, changedCodons, mutationModel3d, type MutationModel3D } from './binding';
import { buildMutationScene, type MutationScene } from './scene';

const CODING = 'TACATGGCTTTCAAAGGCTGGTAAGC';

/** Distinct colours per token, so a wrong colour shows. */
const TOKENS: Record<string, string> = {
  '--chart-1': '#0000ff',
  '--chart-2': '#ff8800',
  '--chart-3': '#00aa00',
  '--chart-4': '#ff0000',
  '--chart-5': '#ff00ff',
  '--accent': '#123456',
};
const token = (name: string) => TOKENS[name] ?? '#808080';
const BASE_TOKEN: Record<string, string> = {
  A: ROLES.baseA.token,
  T: ROLES.baseT.token,
  G: ROLES.baseG.token,
  C: ROLES.baseC.token,
};
const hexOf = (b: string) => `#${new THREE.Color(token(BASE_TOKEN[b] ?? '')).getHexString()}`;

function build(m: Mutation, coding = CODING, maxBasePairs = 600): MutationScene {
  return buildMutationScene(mutationModel3d(coding, m), {
    tier: 'medium',
    segments: 16,
    maxBasePairs,
    token,
  });
}

/** Instanced meshes drawn with the accent outline material (back faces). */
function hulls(sc: MutationScene): THREE.InstancedMesh[] {
  const out: THREE.InstancedMesh[] = [];
  sc.scene.traverse((o) => {
    if (!(o instanceof THREE.InstancedMesh)) return;
    const mesh = o as THREE.InstancedMesh;
    const mat = mesh.material;
    if (mat instanceof THREE.MeshBasicMaterial && mat.side === THREE.BackSide) out.push(mesh);
  });
  return out;
}

/** A ray side-on through a point (across the rungs: no backbone in the way). */
const sideRay = (p: readonly number[]) =>
  new THREE.Raycaster(new THREE.Vector3(p[0], p[1], (p[2] ?? 0) + 20), new THREE.Vector3(0, 0, -1));

describe('3D point-mutation scene', () => {
  it('the mutated helix is drawn from mutate(): every rung coloured by its base and partner', () => {
    for (const m of [
      { kind: 'substitution', pos: 12, base: 'T' },
      { kind: 'insertion', pos: 9, bases: 'GCA' },
      { kind: 'deletion', pos: 9, count: 2 },
    ] as Mutation[]) {
      const sc = build(m);
      const d = sc.drawn();
      const mutated = mutate(CODING, m);
      const tpl = complement(mutated);
      expect(d.halves.mutated.map((x) => x.index)).toEqual(
        Array.from({ length: mutated.length }, (_, k) => k),
      );
      for (const h of d.halves.mutated) {
        expect(h.coding).toBe(hexOf(mutated[h.index] ?? ''));
        expect(h.template).toBe(hexOf(tpl[h.index] ?? ''));
      }
      for (const h of d.halves.normal) expect(h.coding).toBe(hexOf(CODING[h.index] ?? ''));
      sc.dispose();
    }
  });

  it('outlines sit on the mutation: 1 pair, the inserted pairs, the deleted pairs (+ gap markers)', () => {
    const cases: [Mutation, number, number][] = [
      [{ kind: 'substitution', pos: 12, base: 'T' }, 1, 0],
      [{ kind: 'insertion', pos: 9, bases: 'GC' }, 2, 0],
      [{ kind: 'deletion', pos: 9, count: 3 }, 3, 3],
    ];
    for (const [m, outlines, gaps] of cases) {
      const sc = build(m);
      const d = sc.drawn();
      expect(d.outlined).toHaveLength(outlines);
      expect(d.outlined[0]?.index).toBe(m.pos);
      expect(d.outlined[0]?.helix).toBe(m.kind === 'deletion' ? 'normal' : 'mutated');
      expect(d.gapSlots).toHaveLength(gaps);
      // The outline mesh of the pairs (made before the beads' one) draws exactly those pairs,
      // around the outlined pair's own rung.
      const pairHull = hulls(sc)[0];
      expect(pairHull?.count).toBe(outlines);
      const at = sc.pairPoint(d.outlined[0]!.helix, m.pos)!;
      const mat = new THREE.Matrix4();
      pairHull!.getMatrixAt(0, mat);
      const centre = new THREE.Vector3().setFromMatrixPosition(mat);
      expect(centre.x).toBeCloseTo(at[0], 6);
      sc.dispose();
    }
  });

  it('the bracket highlight starts at the first changed codon; only on the mutated mRNA', () => {
    const m: Mutation = { kind: 'deletion', pos: 9, count: 1 };
    const model = mutationModel3d(CODING, m);
    const sc = build(m);
    const d = sc.drawn();
    const hot = d.brackets.mutated.filter((b) => b.look === 'changed').map((b) => b.codon);
    expect(hot).toEqual(changedCodons(model));
    expect(Math.min(...hot)).toBe(model.firstChange);
    expect(d.brackets.normal.some((b) => b.look === 'changed')).toBe(false);
    expect(d.brackets.normal[0]?.look).toBe('start');
    expect(d.brackets.normal.at(-1)?.look).toBe('stop');
    // Frameshift: after the first change the brackets are not where the normal ones are.
    for (const b of d.brackets.mutated.filter((x) => x.codon >= model.firstChange)) {
      const n = d.brackets.normal.find((x) => x.codon === b.codon);
      if (n) expect(b.from).not.toBe(n.from);
    }
    sc.dispose();
  });

  it('the bead chains are both translations (silent: identical; nonsense: shorter)', () => {
    const silent = build({ kind: 'substitution', pos: 8, base: 'C' });
    const s = silent.drawn();
    expect(s.beads.normal.map((b) => b.index)).toEqual(s.beads.mutated.map((b) => b.index));
    expect(s.beads.mutated.some((b) => b.changed || b.outlined)).toBe(false);
    silent.dispose();
    const m: Mutation = { kind: 'substitution', pos: 12, base: 'T' };
    const model = mutationModel3d(CODING, m);
    const sc = build(m);
    const d = sc.drawn();
    expect(d.beads.normal).toHaveLength(beadNames(model.normal.t).length);
    expect(d.beads.mutated).toHaveLength(beadNames(model.mutated.t).length);
    expect(d.beads.mutated).toHaveLength(3);
    // The normal chain's lost tail is outlined.
    expect(d.beads.normal.filter((b) => b.outlined).map((b) => b.index)).toEqual([3, 4, 5]);
    sc.dispose();
    // Missense (GGC → AGC, Gly → Ser): only that bead is drawn as changed; the Trp after it is not.
    const mis = build({ kind: 'substitution', pos: 15, base: 'A' });
    const e = mis.drawn();
    expect(e.beads.mutated.filter((b) => b.changed).map((b) => b.index)).toEqual([4]);
    expect(e.beads.mutated.filter((b) => b.outlined).map((b) => b.index)).toEqual([4]);
    expect(e.beads.normal.filter((b) => b.outlined).map((b) => b.index)).toEqual([4]);
    mis.dispose();
  });

  it('a premature stop codon ends the mutated chain with a flat cap; other changes do not', () => {
    const cases: [Mutation, boolean][] = [
      [{ kind: 'substitution', pos: 12, base: 'T' }, true], // AAA → TAA: nonsense
      [{ kind: 'substitution', pos: 8, base: 'C' }, false], // silent
      [{ kind: 'substitution', pos: 15, base: 'A' }, false], // missense
      [{ kind: 'deletion', pos: 9, count: 3 }, false], // in-frame deletion: shorter, no early stop
      [{ kind: 'deletion', pos: 6, count: 6 }, false],
      [{ kind: 'insertion', pos: 12, bases: 'TAA' }, true], // in-frame insertion of a stop
    ];
    for (const [m, cap] of cases) {
      const sc = build(m);
      expect(sc.drawn().endCap, `${m.kind} at ${String(m.pos)}`).toBe(cap);
      sc.dispose();
    }
  });

  it('label obstacles hold every base pair and bead drawn, on both helices', () => {
    const sc = build({ kind: 'insertion', pos: 12, bases: 'TA' });
    const avoid = sc.labelObstacles().avoid!;
    const inside = (p: readonly number[]) =>
      avoid.some((hull) =>
        [0, 1, 2].every(
          (k) =>
            Math.min(...hull.map((q) => q[k]!)) - 1e-9 <= p[k]! &&
            p[k]! <= Math.max(...hull.map((q) => q[k]!)) + 1e-9,
        ),
      );
    const d = sc.drawn();
    for (const helix of ['normal', 'mutated'] as const) {
      for (const h of d.halves[helix]) expect(inside(sc.pairPoint(helix, h.index)!)).toBe(true);
      for (const b of d.beads[helix])
        expect(inside(sc.focusPoint({ kind: 'bead', helix, index: b.index })!)).toBe(true);
    }
    sc.dispose();
  });

  it('picking: a base pair of either helix, a bead, a bracket; nothing off the picture', () => {
    const m: Mutation = { kind: 'substitution', pos: 12, base: 'T' };
    const sc = build(m);
    for (const helix of ['normal', 'mutated'] as const)
      for (const i of [3, 12, 20]) {
        const p = sc.pairPoint(helix, i);
        expect(p).not.toBeNull();
        expect(sc.pick(sideRay(p!))).toEqual({ kind: 'pair', helix, index: i });
      }
    const bead = sc.focusPoint({ kind: 'bead', helix: 'mutated', index: 2 });
    expect(sc.pick(sideRay(bead!))).toEqual({ kind: 'bead', helix: 'mutated', index: 2 });
    const miss = new THREE.Raycaster(new THREE.Vector3(0, 50, 50), new THREE.Vector3(0, 0, 1));
    expect(sc.pick(miss)).toBeNull();
    sc.dispose();
  });

  it('inserted pairs bulge out in front of the helix and can be picked', () => {
    const m: Mutation = { kind: 'insertion', pos: 9, bases: 'GC' };
    const sc = build(m);
    for (const i of [9, 10]) {
      const p = sc.pairPoint('mutated', i)!;
      expect(p[2]).toBeGreaterThan(1);
      expect(sc.pick(sideRay(p))).toEqual({ kind: 'pair', helix: 'mutated', index: i });
    }
    sc.dispose();
  });

  it('a long sequence draws a window around the site', () => {
    const long = `ATG${'GCT'.repeat(400)}TAA`;
    const sc = build({ kind: 'substitution', pos: 900, base: 'A' }, long, 120);
    const w = sc.window();
    expect(w.to - w.from).toBe(120);
    expect(w.from).toBeLessThanOrEqual(900);
    expect(w.to).toBeGreaterThan(900);
    expect(sc.pairPoint('normal', w.from)).not.toBeNull();
    expect(sc.pairPoint('normal', w.from - 1)).toBeNull();
    expect(sc.drawn().outlined).toEqual([{ helix: 'mutated', index: 900 }]);
    sc.dispose();
  });

  it('the outlines pulse and come to rest', () => {
    const sc = build({ kind: 'deletion', pos: 9, count: 2 });
    const mat = hulls(sc)[0]!.material as THREE.MeshBasicMaterial;
    sc.setPulse(null);
    const rest = mat.opacity;
    sc.setPulse(0.45);
    expect(mat.opacity).toBeLessThan(rest);
    sc.setPulse(null);
    expect(mat.opacity).toBe(rest);
    sc.dispose();
  });

  it('tiny sequences and every kind build without errors', () => {
    const seqs = ['A', 'ATG', 'ATGTAA', 'TTTCCC'];
    for (const seq of seqs)
      for (const m of [
        { kind: 'substitution', pos: 0, base: 'G' },
        { kind: 'insertion', pos: 0, bases: 'AT' },
        { kind: 'deletion', pos: 0, count: 1 },
      ] as Mutation[]) {
        const model: MutationModel3D = mutationModel3d(seq, m);
        const sc = buildMutationScene(model, {
          tier: 'high',
          segments: 24,
          maxBasePairs: 1500,
          token,
        });
        sc.setSelection({ kind: 'pair', helix: 'normal', index: 0 });
        expect(sc.window()).toEqual({ from: 0, to: seq.length });
        sc.dispose();
      }
  });

  it('frees every geometry and material it made', () => {
    expectDisposes(
      () => {
        const sc = build({ kind: 'insertion', pos: 9, bases: 'GC' });
        sc.setSelection({ kind: 'bead', helix: 'normal', index: 1 });
        sc.setSelection({ kind: 'codon', helix: 'mutated', codon: 2 });
        sc.setPulse(0.2);
        return sc;
      },
      (sc) => {
        sc.dispose();
        expect(sc.scene.children).toHaveLength(0);
      },
    );
  });

  it('labels name the parts drawn', () => {
    const sc = build({ kind: 'substitution', pos: 12, base: 'T' });
    expect(sc.labelAnchors().map((a) => a.id)).toEqual(
      expect.arrayContaining([
        'normalDna',
        'mutatedDna',
        'normalMrna',
        'mutatedMrna',
        'normalProtein',
        'mutatedProtein',
      ]),
    );
    sc.dispose();
  });
});
