import { describe, expect, it } from 'vitest';
import {
  MOLECULES,
  textbookFormula,
  angle,
  bondPolarity,
  centralAtom,
  deltaEn,
  hasSeveralCentres,
  distance,
  findMolecules,
  lonePairDirections,
  lonePairs,
  moleculeById,
  neighbors,
  partialSigns,
  paulingDelta,
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

  it('Δχ is read to the 2 decimals of the Pauling values, so a 0,40 difference is polar', () => {
    // 3.44 − 3.04 is 0.3999… in floating point (#255).
    expect(paulingDelta('O', 'N')).toBe(0.4);
    expect(bondPolarity(paulingDelta('O', 'N') ?? NaN)).toBe('polar');
    const no3 = mol('no3');
    for (const b of no3.bonds) expect(bondPolarity(deltaEn(no3, b) ?? NaN)).toBe('polar');
    expect(paulingDelta('Cl', 'H')).toBe(0.96);
    expect(paulingDelta('Xx', 'H')).toBeNull();
  });

  it('partial signs read Δχ like paulingDelta: O of NO₃⁻ and NO gets δ−, N δ+', () => {
    const no3 = mol('no3');
    const signs = partialSigns(no3);
    no3.atoms.forEach((a, i) => {
      expect(signs[i], `${a.el}${String(i)}`).toBe(a.el === 'O' ? '−' : '+');
    });
    const no = mol('no');
    expect(no.atoms.map((a, i) => `${a.el}${partialSigns(no)[i] ?? ''}`)).toEqual(['N+', 'O−']);
    // HCN: C–H (0,35) is non-polar and adds nothing; C≡N (0,49) is polar: C δ+, N δ−, H unsigned.
    const hcn = mol('hcn');
    expect(hcn.atoms.map((a, i) => `${a.el}${partialSigns(hcn)[i] ?? ''}`)).toEqual([
      'C+',
      'N−',
      'H',
    ]);
  });

  it('partial signs skip non-polar bonds (Bảng 12.1): CH₄ unsigned, C₂H₅OH signs only C–O–H', () => {
    expect(new Set(partialSigns(mol('ch4')))).toEqual(new Set(['']));
    const e = mol('c2h5oh');
    const s = partialSigns(e);
    const o = e.atoms.findIndex((a) => a.el === 'O');
    const nb = neighbors(e, o);
    const cO = nb.find((i) => e.atoms[i]?.el === 'C') ?? -1;
    const hO = nb.find((i) => e.atoms[i]?.el === 'H') ?? -1;
    expect(s[o]).toBe('−');
    expect(s[cO]).toBe('+');
    expect(s[hO]).toBe('+');
    // Every other atom (the CH₃ carbon and the C–H hydrogens) is unsigned.
    e.atoms.forEach((a, i) => {
      if (![o, cO, hO].includes(i)) expect(s[i], `${a.el}${String(i)}`).toBe('');
    });
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

  it('the centre is the atom with the most heavy-atom neighbours, not a CH3/NH2 end group', () => {
    const centre = (id: string) => {
      const m = mol(id);
      const c = centralAtom(m);
      return { el: m.atoms[c]?.el, ...vsepr(m, c), several: hasSeveralCentres(m) };
    };
    expect(centre('urea')).toMatchObject({ el: 'C', label: 'AX₃', geometry: 'trigonalPlanar' });
    expect(centre('acetone')).toMatchObject({ el: 'C', label: 'AX₃', geometry: 'trigonalPlanar' });
    expect(centre('isobutene')).toMatchObject({ el: 'C', label: 'AX₃', several: false });
    expect(centre('ch3cooh')).toMatchObject({ el: 'C', label: 'AX₃', several: false });
    expect(centre('ch3cho')).toMatchObject({ el: 'C', label: 'AX₃', several: false });
    expect(centre('c3h6')).toMatchObject({ el: 'C', label: 'AX₃', several: false });
    // Ties keep the textbook answers.
    expect(centre('hcn')).toMatchObject({ el: 'C', label: 'AX₂' });
    expect(centre('co')).toMatchObject({ el: 'C' });
    // Equivalent centres (benzene, butane) are one class; branched skeletons are several.
    expect(centre('c6h6').several).toBe(false);
    expect(centre('c4h10').several).toBe(false);
    for (const id of ['etac', 'glycine', 'toluene', 'glucose'])
      expect(centre(id).several, id).toBe(true);
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

describe('textbookFormula (UI-39: heading and formula row agree)', () => {
  it('keeps the textbook order without carbon and Hill order with carbon', () => {
    expect(textbookFormula({ formula: 'H3N', display_formula: 'NH3' })).toBe('NH3');
    expect(textbookFormula({ formula: 'ClH', display_formula: 'HCl' })).toBe('HCl');
    expect(textbookFormula({ formula: 'C2H6O', display_formula: 'C2H5OH' })).toBe('C2H6O');
    expect(textbookFormula({ formula: 'CO2', display_formula: 'CO2' })).toBe('CO2');
    // "Cl" or "Ca" first is not carbon.
    expect(textbookFormula({ formula: 'CaO', display_formula: 'CaO' })).toBe('CaO');
  });

  it('HCN reads "HCN" on the formula row, as in its heading, not Hill’s "CHN" (#192)', () => {
    const hcn = moleculeById('hcn');
    expect(hcn && textbookFormula(hcn)).toBe('HCN');
    expect(hcn?.display_formula).toBe('HCN');
    // Every other molecule: the row and the heading agree, or the heading is a condensed
    // structure of a carbon compound and the row its Hill formula.
    for (const m of MOLECULES)
      if (textbookFormula(m) !== m.display_formula)
        expect([m.id, textbookFormula(m)]).toEqual([m.id, m.formula]);
  });
});
