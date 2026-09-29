import { describe, expect, it } from 'vitest';
import {
  MOLECULES,
  angle,
  bondPolarity,
  centralAtom,
  distance,
  findMolecules,
  lonePairDirections,
  lonePairs,
  moleculeById,
  neighbors,
  polarity,
  prettyFormula,
  vsepr,
  type Molecule,
} from './molecules';

const mol = (id: string): Molecule => {
  const m = moleculeById(id);
  if (!m) throw new Error(id);
  return m;
};

/** Mean length of bonds between two elements. */
function meanBond(m: Molecule, x: string, y: string): number {
  const ls = m.bonds
    .filter((b) => {
      const p = [m.atoms[b.a]?.el, m.atoms[b.b]?.el].sort().join('-');
      return p === [x, y].sort().join('-');
    })
    .map((b) => distance(m, b.a, b.b));
  return ls.reduce((s, v) => s + v, 0) / ls.length;
}

/** Mean angle x–c–y over all centres of element c. */
function meanAngle(m: Molecule, x: string, c: string, y: string): number {
  const out: number[] = [];
  m.atoms.forEach((a, j) => {
    if (a.el !== c) return;
    const nb = neighbors(m, j);
    for (const i of nb)
      for (const k of nb)
        if (i < k && [m.atoms[i]?.el, m.atoms[k]?.el].sort().join() === [x, y].sort().join())
          out.push(angle(m, i, j, k));
  });
  return out.reduce((s, v) => s + v, 0) / out.length;
}

describe('molecule library', () => {
  it('every structure is consistent: formula matches atoms, bonds reference atoms', () => {
    for (const m of MOLECULES) {
      for (const b of m.bonds) {
        expect(m.atoms[b.a]).toBeDefined();
        expect(m.atoms[b.b]).toBeDefined();
        const d = distance(m, b.a, b.b);
        expect(d, `${m.id} bond length`).toBeGreaterThan(0.6);
        expect(d, `${m.id} bond length`).toBeLessThan(2.6);
      }
      const counts = new Map<string, number>();
      for (const a of m.atoms) counts.set(a.el, (counts.get(a.el) ?? 0) + 1);
      for (const [el, n] of counts) {
        const re = new RegExp(`${el}(\\d*)(?![a-z])`);
        const match = re.exec(m.formula.replace(/[+-]\d*$/, ''));
        expect(match, `${m.id}: ${el} in ${m.formula}`).not.toBeNull();
        expect(Number(match?.[1] || '1'), `${m.id}: count of ${el}`).toBe(n);
      }
    }
  });

  it('force-field geometries match experimental references (±0.03 Å, ±3°)', () => {
    let checked = 0;
    for (const m of MOLECULES) {
      if (!m.reference || m.geometry_method === 'experimental') continue;
      for (const [pair, ref] of Object.entries(m.reference.bonds ?? {})) {
        const [x, y] = pair.split('-') as [string, string];
        expect(Math.abs(meanBond(m, x, y) - ref), `${m.id} ${pair}`).toBeLessThan(0.03);
        checked++;
      }
      for (const [tri, ref] of Object.entries(m.reference.angles ?? {})) {
        const [x, c, y] = tri.split('-') as [string, string, string];
        expect(Math.abs(meanAngle(m, x, c, y) - ref), `${m.id} ${tri}`).toBeLessThan(3);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(15);
  });

  it('experimental-geometry molecules reproduce their stated r and angle exactly', () => {
    for (const m of MOLECULES) {
      if (m.geometry_method !== 'experimental' || !m.experimental) continue;
      for (const b of m.bonds) expect(distance(m, b.a, b.b)).toBeCloseTo(m.experimental.r, 3);
      const c = centralAtom(m);
      const nb = neighbors(m, c);
      if (nb.length >= 2 && m.experimental.angle !== undefined) {
        expect(angle(m, nb[0]!, c, nb[1]!)).toBeCloseTo(m.experimental.angle, 1);
      }
    }
  });

  it('ideal VSEPR structures have the textbook angles', () => {
    const angles = (id: string) => {
      const m = mol(id);
      const c = centralAtom(m);
      const nb = neighbors(m, c);
      const out = new Set<number>();
      for (const i of nb) for (const k of nb) if (i < k) out.add(Math.round(angle(m, i, c, k)));
      return [...out].sort((a, b) => a - b);
    };
    expect(angles('sf6')).toEqual([90, 180]);
    expect(angles('pcl5')).toEqual([90, 120, 180]);
    expect(angles('xef4')).toEqual([90, 180]);
    expect(angles('clf3')).toEqual([90, 180]);
  });

  it('VSEPR classes and shapes', () => {
    const at = (id: string) => vsepr(mol(id), centralAtom(mol(id)));
    const cases: [string, string, string][] = [
      ['co2', 'AX₂', 'linear'],
      ['bf3', 'AX₃', 'trigonalPlanar'],
      ['so2', 'AX₂E', 'bent'],
      ['ch4', 'AX₄', 'tetrahedral'],
      ['nh3', 'AX₃E', 'trigonalPyramidal'],
      ['h2o', 'AX₂E₂', 'bent'],
      ['pcl5', 'AX₅', 'trigonalBipyramidal'],
      ['sf4', 'AX₄E', 'seesaw'],
      ['clf3', 'AX₃E₂', 'tShaped'],
      ['xef2', 'AX₂E₃', 'linear'],
      ['sf6', 'AX₆', 'octahedral'],
      ['xef4', 'AX₄E₂', 'squarePlanar'],
      ['nh4', 'AX₄', 'tetrahedral'],
      ['no3', 'AX₃', 'trigonalPlanar'],
      ['o3', 'AX₂E', 'bent'],
      ['so4', 'AX₄', 'tetrahedral'],
    ];
    for (const [id, label, geo] of cases) {
      const v = at(id);
      expect(v.label, id).toBe(label);
      expect(v.geometry, id).toBe(geo);
    }
    expect(lonePairs(mol('h2o'), centralAtom(mol('h2o')))).toBe(2);
  });

  it('bond type from Δχ uses the textbook thresholds', () => {
    expect(bondPolarity(0)).toBe('nonpolar');
    expect(bondPolarity(0.39)).toBe('nonpolar');
    expect(bondPolarity(0.4)).toBe('polar');
    expect(bondPolarity(1.69)).toBe('polar');
    expect(bondPolarity(1.7)).toBe('ionic');
  });

  it('molecular polarity (qualitative) matches textbook expectations', () => {
    const polar = [
      'h2o',
      'nh3',
      'hcl',
      'so2',
      'chcl3',
      'hcn',
      'o3',
      'sf4',
      'clf3',
      'pcl3',
      'h2s',
      'c2h5oh',
      'co',
    ];
    const nonpolar = [
      'co2',
      'ch4',
      'bf3',
      'ccl4',
      'so3',
      'sf6',
      'xef4',
      'xef2',
      'pcl5',
      'becl2',
      'n2',
      'c2h4',
      'c6h6',
      'c2h2',
    ];
    for (const id of polar) expect(['polar', 'weak'], id).toContain(polarity(mol(id)).verdict);
    for (const id of nonpolar) expect(polarity(mol(id)).verdict, id).toBe('nonpolar');
    expect(polarity(mol('no3')).verdict).toBe('ion');
  });

  it('lone pairs of water point away from the H atoms, roughly tetrahedrally', () => {
    const m = mol('h2o');
    const o = centralAtom(m);
    const dirs = lonePairDirections(m, o);
    expect(dirs).toHaveLength(2);
    const [a, b] = dirs;
    if (!a || !b) throw new Error('two lone pairs expected');
    const cos = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const deg = (Math.acos(cos) * 180) / Math.PI;
    expect(deg).toBeGreaterThan(100);
    expect(deg).toBeLessThan(140);
  });

  it('search by name, alias, formula and SMILES', () => {
    expect(findMolecules('nuoc').map((m) => m.id)).toContain('h2o');
    expect(findMolecules('ancol etylic').map((m) => m.id)).toEqual(['c2h5oh']);
    expect(findMolecules('C₂H₆O').map((m) => m.id)).toContain('c2h5oh');
    expect(findMolecules('CC(=O)O').map((m) => m.id)).toEqual(['ch3cooh']);
    expect(prettyFormula('CO3-2')).toBe('CO₃²⁻');
    expect(prettyFormula('H4N+')).toBe('H₄N⁺');
  });
});
