import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { drawStats } from '@/ui/three/drawStats';
import { expectAllFreed, testKit } from '../view3d/testing';
import { biomoleculeCard } from './card';
import {
  BIOMOLECULES,
  GROUPS,
  GROUP_INFO,
  PART_NAME,
  biomolecule,
  moleculesOf,
  partOfAtom,
  type Biomolecule,
} from './data';
import { buildMoleculeScene, sticks } from './scene';
import { restoreBiomolecules, setGroup, setMolecule, useBiomolecules } from './store';

afterEach(() => {
  vi.restoreAllMocks();
});

const mol = (id: string): Biomolecule => {
  const m = biomolecule(id);
  if (!m) throw new Error(id);
  return m;
};
const at = (m: Biomolecule, i: number) =>
  new THREE.Vector3(...(m.atoms[i]?.xyz ?? [NaN, NaN, NaN]));

/** Hill formula counted from the atom list (C, H first, then alphabetical). */
function hill(m: Biomolecule): string {
  const n = new Map<string, number>();
  for (const a of m.atoms) n.set(a.el, (n.get(a.el) ?? 0) + 1);
  const order = ['C', 'H', ...[...n.keys()].filter((e) => e !== 'C' && e !== 'H').sort()];
  return order
    .filter((e) => n.has(e))
    .map((e) => `${e}${n.get(e) === 1 ? '' : String(n.get(e))}`)
    .join('');
}

describe('data/biomolecules.json (PubChem + RDKit)', () => {
  it('one molecule or more per group, each with its PubChem CID', () => {
    for (const g of GROUPS) expect(moleculesOf(g).length).toBeGreaterThan(0);
    expect(BIOMOLECULES.map((m) => [m.id, m.group, m.cid])).toEqual([
      ['glucose', 'carbohydrate', 64689],
      ['palmitic', 'lipid', 985],
      ['glycerol', 'lipid', 753],
      ['alanine', 'protein', 5950],
      ['damp', 'nucleicAcid', 12599],
    ]);
    expect(BIOMOLECULES.every((m) => m.review_status === 'pending')).toBe(true);
  });

  it('the atoms are the formula’s; bond lengths are chemical (0,9–1,9 Å)', () => {
    for (const m of BIOMOLECULES) {
      expect(hill(m), m.id).toBe(m.formula);
      for (const b of m.bonds) {
        const d = at(m, b.a).distanceTo(at(m, b.b));
        expect(d, `${m.id} ${String(b.a)}-${String(b.b)}`).toBeGreaterThan(0.9);
        expect(d).toBeLessThan(1.9);
      }
    }
  });

  it('the parts of a monomer share no atom and cover all of them', () => {
    for (const m of BIOMOLECULES.filter((x) => x.parts.length > 0)) {
      const all = m.parts.flatMap((p) => p.atoms).sort((a, b) => a - b);
      expect(all, m.id).toEqual(m.atoms.map((_, i) => i));
    }
    // H 5.7: amino acid = central C + H, amino group, carboxyl group, R group.
    expect(mol('alanine').parts.map((p) => p.id)).toEqual([
      'amino',
      'carboxyl',
      'alphaC',
      'rGroup',
    ]);
    // H 5.10b: nucleotide = phosphate, sugar, base.
    expect(new Set(mol('damp').parts.map((p) => p.id))).toEqual(
      new Set(['phosphate', 'sugar', 'base']),
    );
    const elementsOf = (id: string, part: string) =>
      new Set(
        mol(id)
          .parts.find((p) => p.id === part)
          ?.atoms.map((i) => mol(id).atoms[i]?.el),
      );
    expect(elementsOf('alanine', 'amino')).toEqual(new Set(['N', 'H']));
    expect(elementsOf('damp', 'phosphate')).toEqual(new Set(['P', 'O', 'H']));
    expect(elementsOf('palmitic', 'chain')).toEqual(new Set(['C', 'H']));
    expect(partOfAtom(mol('glucose'), 0)).toBeNull();
  });

  it('the rotation kept the mirror image right: L-alanine is (S)', () => {
    const m = mol('alanine');
    const ca = m.parts.find((p) => p.id === 'alphaC')?.atoms.find((i) => m.atoms[i]?.el === 'C');
    expect(ca).toBeDefined();
    const nb = (el: string, part: string) =>
      m.parts.find((p) => p.id === part)?.atoms.find((i) => m.atoms[i]?.el === el) ?? -1;
    const n = at(m, nb('N', 'amino'));
    const cooh = at(m, nb('C', 'carboxyl'));
    const ch3 = at(m, nb('C', 'rGroup'));
    const h = at(m, nb('H', 'alphaC'));
    // Priorities N > COOH > CH3 with H away: counter-clockwise (S) ⇔ positive triple product.
    const v = n
      .clone()
      .sub(h)
      .dot(cooh.clone().sub(h).cross(ch3.clone().sub(h)));
    expect(v).toBeGreaterThan(0);
  });

  it('the conformer lies on its principal axes: widest along x, thinnest along z', () => {
    for (const m of BIOMOLECULES) {
      const spread = [0, 1, 2].map((k) => m.atoms.reduce((s, a) => s + (a.xyz[k] ?? 0) ** 2, 0));
      expect(spread[0]).toBeGreaterThanOrEqual(spread[1] ?? 0);
      expect(spread[1]).toBeGreaterThanOrEqual(spread[2] ?? 0);
    }
  });
});

describe('texts and card', () => {
  it('lipids are the one group that is not a polymer (SGK tr. 28)', () => {
    expect(GROUPS.filter((g) => !GROUP_INFO[g].polymer)).toEqual(['lipid']);
    expect(Object.keys(PART_NAME)).toHaveLength(10);
  });

  it('approx (force field), with the PubChem page of the molecule and the textbook', () => {
    const c = biomoleculeCard(mol('damp'));
    expect(c.confidence).toBe('approx');
    expect(c.sources[0]?.url).toBe('https://pubchem.ncbi.nlm.nih.gov/compound/12599');
    expect(c.sources[1]?.citation).toMatch(/Bài 5/);
    expect(c.model.vi).toContain('CID 12599');
  });
});

describe('store', () => {
  it('a group shows its first molecule; a molecule sets its group; junk is ignored', () => {
    setGroup('lipid');
    expect(useBiomolecules.getState()).toMatchObject({ group: 'lipid', molecule: 'palmitic' });
    setMolecule('glycerol');
    useBiomolecules.setState({ part: 'hydroxyl' });
    setMolecule('alanine');
    expect(useBiomolecules.getState()).toMatchObject({
      group: 'protein',
      molecule: 'alanine',
      part: null,
    });
    restoreBiomolecules({ group: 'vitamin', molecule: 'caffeine' });
    expect(useBiomolecules.getState()).toMatchObject({ group: 'protein', molecule: 'alanine' });
    restoreBiomolecules({ group: 'carbohydrate' });
    expect(useBiomolecules.getState().molecule).toBe('glucose');
  });
});

describe('3D ball-and-stick', () => {
  it.each(BIOMOLECULES.map((m) => m.id))('%s: builds, names its parts, frees everything', (id) => {
    const m = mol(id);
    const { kit, track, start } = testKit('medium');
    const names = Object.fromEntries(m.parts.map((p) => [p.id, p.id]));
    const sc = buildMoleculeScene(kit, { molecule: m, names });
    const st = sc.state?.() as { atoms: number; sticks: number; named: string[] };
    expect(st.atoms).toBe(m.atoms.length);
    expect(st.sticks).toBe(sticks(m).length);
    expect(st.named).toEqual(m.parts.map((p) => p.id));
    // One draw per element and one for the bonds.
    expect(drawStats(kit.scene).calls).toBe(new Set(m.atoms.map((a) => a.el)).size + 1);
    expectAllFreed(kit, track, start);
  });

  it('a double bond is two sticks', () => {
    const m = mol('alanine');
    const doubles = m.bonds.filter((b) => b.order === 2).length;
    expect(doubles).toBe(1);
    expect(sticks(m)).toHaveLength(m.bonds.length + doubles);
  });

  it('a tap on the N atom of alanine picks the amino group; select marks it', () => {
    const m = mol('alanine');
    const { kit } = testKit('medium');
    const sc = buildMoleculeScene(kit, { molecule: m, names: null });
    kit.scene.updateMatrixWorld(true);
    const n = m.atoms.findIndex((a) => a.el === 'N');
    const p = at(m, n);
    const ray = new THREE.Raycaster(new THREE.Vector3(p.x, p.y, 40), new THREE.Vector3(0, 0, -1));
    // Seen from +z the N may sit behind another atom; aim from whichever side reaches it first.
    const picked = sc.pick?.(ray);
    const back = new THREE.Raycaster(new THREE.Vector3(p.x, p.y, -40), new THREE.Vector3(0, 0, 1));
    expect([picked, sc.pick?.(back)]).toContain('amino');
    expect(
      sc.pick?.(new THREE.Raycaster(new THREE.Vector3(50, 50, 40), new THREE.Vector3(0, 0, -1))),
    ).toBeNull();
    sc.select?.('amino');
    expect(sc.state?.()).toMatchObject({ selected: 'amino' });
    sc.select?.('phosphate');
    expect(sc.state?.()).toMatchObject({ selected: null });
    kit.dispose();
  });
});
