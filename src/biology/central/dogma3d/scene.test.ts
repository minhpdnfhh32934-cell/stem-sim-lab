import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { expectDisposes } from '@/ui/three/testing';
import { ROLES } from '../../view3d/palette';
import { anticodon } from '../dogma';
import {
  STEP,
  chainAt,
  dogmaClock,
  dogmaModel3d,
  keyTime,
  momentAt,
  type DogmaModel3D,
} from './binding';
import { buildDogmaScene, type DogmaScene } from './scene';

const CODING = 'TACATGGCTTTCAAAGGCTGGTAAGC';

/** Distinct colours per token, so a wrong colour shows. */
const TOKENS: Record<string, string> = {
  '--chart-1': '#0000ff',
  '--chart-2': '#ff8800',
  '--chart-3': '#00aa00',
  '--chart-4': '#ff0000',
  '--chart-5': '#ff00ff',
};
const token = (name: string) => TOKENS[name] ?? '#808080';
const BASE_TOKEN: Record<string, string> = {
  A: ROLES.baseA.token,
  T: ROLES.baseT.token,
  G: ROLES.baseG.token,
  C: ROLES.baseC.token,
  U: ROLES.baseU.token,
};
const colourOf = (b: string) => new THREE.Color(token(BASE_TOKEN[b] ?? ''));

function build(m: DogmaModel3D, maxBasePairs = 600): DogmaScene {
  return buildDogmaScene(m, { tier: 'medium', segments: 16, maxBasePairs, token });
}

/** The scene's instanced meshes, by instance count. */
function instanced(sc: DogmaScene): THREE.InstancedMesh[] {
  const out: THREE.InstancedMesh[] = [];
  sc.scene.traverse((o) => {
    if (o instanceof THREE.InstancedMesh) out.push(o as THREE.InstancedMesh);
  });
  return out;
}

describe('3D dogma scene', () => {
  const m = dogmaModel3d(CODING);
  const c = dogmaClock(m);

  it('one rung half per base of each strand, coloured by its base; one mRNA base each', () => {
    const sc = build(m);
    sc.update(momentAt(c, 0));
    const n = CODING.length;
    const meshes = instanced(sc);
    const halves = meshes.find((x) => x.count === 2 * n && x.instanceColor);
    expect(halves).toBeDefined();
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      halves!.getColorAt(2 * i, col);
      expect(col.getHexString()).toBe(colourOf(CODING[i]!).getHexString());
      halves!.getColorAt(2 * i + 1, col);
      expect(col.getHexString()).toBe(colourOf(m.template[i]!).getHexString());
    }
    const rna = meshes.find((x) => x !== halves && x.count === n && x.instanceColor);
    expect(rna).toBeDefined();
    for (let i = 0; i < n; i++) {
      rna!.getColorAt(i, col);
      expect(col.getHexString()).toBe(colourOf(m.mrna[i]!).getHexString());
    }
    sc.dispose();
  });

  it('picking a base returns its index and strand (0-based, the model’s)', () => {
    const sc = build(m);
    sc.update(momentAt(c, c.total));
    // A ray across the middle of a rung half, side-on (the backbone is not in its way).
    for (const [strand, i] of [
      ['coding', 2],
      ['coding', 12],
      ['template', 7],
    ] as const) {
      const p = sc.basePoint(strand, i);
      expect(p).not.toBeNull();
      const a = Math.atan2(p![2], p![1]);
      const across = new THREE.Vector3(0, -Math.sin(a), Math.cos(a));
      const ray = new THREE.Raycaster(
        new THREE.Vector3(...p!).addScaledVector(across, 10),
        across.clone().negate(),
      );
      expect(sc.pick(ray)).toEqual({ kind: 'base', strand, index: i });
    }
    sc.dispose();
  });

  it('the bead chain is the model’s chain; no tRNA comes for the stop codon', () => {
    const sc = build(m);
    for (let s = 0; s < c.steps; s++) {
      const mo = momentAt(c, keyTime(c, s));
      sc.update(mo);
      const beads = instanced(sc).find(
        (x) =>
          x.geometry instanceof THREE.SphereGeometry &&
          x.count <= 12 &&
          x.count === chainAt(m, mo).length,
      );
      expect(beads, `step ${String(s)}`).toBeDefined();
      // tRNAs on screen: their anticodon bases are coloured as the anticodon (from the model).
      const trnaGroups = sc.scene.children.filter(
        (o) => o instanceof THREE.Group && o.name !== 'light-rig' && o.visible,
      );
      const codon = m.t.codons[s]!;
      if (codon.entry?.stop) {
        // Only the previous tRNA, leaving.
        expect(trnaGroups.length).toBeLessThanOrEqual(1);
      } else {
        expect(trnaGroups.length).toBeGreaterThanOrEqual(1);
        const anti = anticodon(codon.codon);
        const docked = trnaGroups.find(
          (g) => Math.abs(g.position.x - (codon.pos + 1) * 0.34) < 1e-6,
        );
        expect(docked).toBeDefined();
        const cols = docked!.children
          .filter((x): x is THREE.Mesh => x instanceof THREE.Mesh)
          .slice(-3)
          .map((x) => (x.material as THREE.MeshStandardMaterial).color.getHexString());
        expect(cols).toEqual(anti.split('').map((b) => colourOf(b).getHexString()));
      }
    }
    // Picking a bead names its amino acid's codon.
    const end = momentAt(c, keyTime(c, 2));
    sc.update(end);
    expect(chainAt(m, end)).toEqual([0, 1, 2]);
    for (const codon of [2, 0]) {
      const at = sc.focusPoint({ kind: 'residue', codon });
      expect(at).not.toBeNull();
      const ray = new THREE.Raycaster(
        new THREE.Vector3(at![0], at![1], at![2] + 10),
        new THREE.Vector3(0, 0, -1),
      );
      expect(sc.pick(ray)).toEqual({ kind: 'residue', codon });
    }
    sc.dispose();
  });

  it('a long sequence draws a window of at most maxBasePairs around the active position', () => {
    const long = dogmaModel3d(`ATG${'GCT'.repeat(400)}TAA`);
    const lc = dogmaClock(long);
    const sc = build(long, 120);
    const mo = momentAt(lc, lc.txEnd * 0.6);
    sc.update(mo);
    const w = sc.window();
    expect(w.to - w.from).toBe(120);
    expect(mo.made).toBeGreaterThanOrEqual(w.from);
    expect(mo.made).toBeLessThan(w.to);
    const halves = instanced(sc).find((x) => x.instanceColor && x.count === 240);
    expect(halves).toBeDefined();
    // Absolute indices: the first drawn base is the model's base `from`.
    expect(sc.basePoint('coding', w.from)).not.toBeNull();
    expect(sc.basePoint('coding', w.from - 1)).toBeNull();
    sc.dispose();
  });

  it('tiny and AUG-less sequences play from start to end without errors', () => {
    for (const seq of ['A', 'AT', 'ATG', 'TTTCCCGGGAAA', 'ATGTAA']) {
      const tm = dogmaModel3d(seq);
      const tc = dogmaClock(tm);
      const sc = build(tm);
      for (let k = 0; k <= 40; k++) sc.update(momentAt(tc, (k / 40) * tc.total));
      expect(sc.window()).toEqual({ from: 0, to: seq.length });
      const miss = new THREE.Raycaster(new THREE.Vector3(0, 50, 50), new THREE.Vector3(0, 0, 1));
      expect(sc.pick(miss)).toBeNull();
      sc.dispose();
    }
  });

  it('frees every geometry and material it made', () => {
    expectDisposes(
      () => {
        const sc = build(m);
        for (const t of [0, c.txEnd / 2, c.tlStart + 0.5, keyTime(c, 3), c.total])
          sc.update(momentAt(c, t));
        sc.setSelection({ kind: 'base', strand: 'coding', index: 4 });
        sc.setSelection({ kind: 'part', part: 'ribosome' });
        return sc;
      },
      (sc) => {
        sc.dispose();
        expect(sc.scene.children).toHaveLength(0);
      },
    );
  });

  it('labels name only the parts on screen at the moment', () => {
    const sc = build(m);
    sc.update(momentAt(c, c.txEnd / 2));
    const tx = sc.labelAnchors().map((a) => a.id);
    expect(tx).toContain('polymerase');
    expect(tx).not.toContain('ribosome');
    sc.update(momentAt(c, keyTime(c, 2)));
    const tl = sc.labelAnchors().map((a) => a.id);
    expect(tl).toEqual(expect.arrayContaining(['ribosome', 'trna', 'polypeptide', 'mrna']));
    expect(tl).not.toContain('polymerase');
    // The middle of a step: the tRNA is still on its way, its amino acid not yet joined.
    sc.update(momentAt(c, c.tlStart + (2 + STEP.MOVE / 2) * c.perCodon));
    expect(sc.partVisible('polypeptide')).toBe(true);
    sc.dispose();
  });
});
