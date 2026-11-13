import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PRECIPITATES } from '../../../../simulation/models/precipitation';
import { byClass, findAll, installDom, totalListeners } from '../testing/chemDom';
import { definitionOf, mountPiece, piece, stationView } from '../testing/chemFixtures';
import { cell, elementTable, formulaWeight, parseFormula, usedBy } from './chem-elements';
import { CHEM_PIECES } from './chem-pieces';

// The element table and the contextual periodic table: only the elements in the experiment's
// material formulas are named and active; nothing is ever added or combined.

/** The formulas of the materials of the shipped and drafted Chemistry experiments (their preset labels and notes). */
const FORMULAS = [
  'HCl',
  'NaOH',
  'NaCl',
  'H₂O', // acid-base titration, heating curve, separation
  'KNO₃',
  'KCl', // solubility
  'KBr',
  'KI',
  'Na₂SO₄',
  'CuSO₄',
  'FeCl₃',
  'AgNO₃',
  'Ba(NO₃)₂', // precipitation
  'AgCl',
  'AgBr',
  'AgI',
  'BaSO₄',
  'Ag₂SO₄',
  'Cu(OH)₂',
  'Fe(OH)₃', // its products
  'NH₄Cl',
  'NH₃',
  'CH₃COOH',
  'CH₃COONa', // pH measurement
];

const named = () =>
  elementTable()
    .elements.filter((e) => e.name !== undefined)
    .map((e) => e.symbol);

const experiments = import.meta.glob<{ workspace?: { materials: { formula?: string }[] } }>(
  '../../../../content/experiments/*.json',
  { eager: true, import: 'default' },
);

describe('the element table', () => {
  it('has the 118 elements in order, each once', () => {
    const t = elementTable();
    expect(t.elements.map((e) => e.z)).toEqual(Array.from({ length: 118 }, (_, i) => i + 1));
    expect(new Set(t.elements.map((e) => e.symbol)).size).toBe(118);
    expect(t.elements[10]).toMatchObject({ symbol: 'Na', period: 3, group: 1 });
  });

  it('names, in English and Vietnamese, exactly the elements the materials use', () => {
    const used = new Set(FORMULAS.flatMap((f) => [...(parseFormula(f)?.keys() ?? [])]));
    expect(new Set(named())).toEqual(used);
    for (const e of elementTable().elements.filter((x) => x.name !== undefined)) {
      expect(e.vi?.name, e.symbol).toBeTruthy();
    }
  });

  it('gives atomic weights only where a model uses them, and they reproduce the precipitation model', () => {
    const weighted = elementTable()
      .elements.filter((e) => e.weight !== undefined)
      .map((e) => e.symbol);
    expect(weighted.sort()).toEqual(['Ag', 'Ba', 'Br', 'Cl', 'Cu', 'Fe', 'H', 'I', 'O', 'S']);
    for (const precipitate of PRECIPITATES) {
      // The model states its molar masses to 0.01 g/mol.
      const weight = formulaWeight(precipitate.formula) ?? Number.NaN;
      expect(Math.abs(weight - precipitate.molarMass), precipitate.formula).toBeLessThan(0.01);
    }
    expect(elementTable().weightModels).toEqual(['chemistry.precipitation']);
  });

  it('places the main groups by period and group, the lanthanides and actinides in rows of their own', () => {
    const at = (symbol: string) => cell(elementTable().elements.find((e) => e.symbol === symbol)!);
    expect(at('H')).toEqual({ col: 1, row: 1 });
    expect(at('He')).toEqual({ col: 18, row: 1 });
    expect(at('Ba')).toEqual({ col: 2, row: 6 });
    expect(at('La')).toEqual({ col: 3, row: 8 });
    expect(at('Lu')).toEqual({ col: 17, row: 8 });
    expect(at('Ac')).toEqual({ col: 3, row: 9 });
    const cells = elementTable().elements.map((e) => `${cell(e).col},${cell(e).row}`);
    expect(new Set(cells).size).toBe(118);
  });
});

describe('material formulas', () => {
  it('parse to elements in the table', () => {
    for (const formula of FORMULAS) {
      const atoms = parseFormula(formula);
      expect(atoms, formula).not.toBeNull();
      for (const symbol of atoms!.keys())
        expect(named(), `${formula}: ${symbol}`).toContain(symbol);
    }
  });

  it('count atoms, with groups, hydrates and ions', () => {
    expect(parseFormula('Ba(NO₃)₂')).toEqual(
      new Map([
        ['Ba', 1],
        ['N', 2],
        ['O', 6],
      ]),
    );
    expect(parseFormula('Fe(OH)3')).toEqual(
      new Map([
        ['Fe', 1],
        ['O', 3],
        ['H', 3],
      ]),
    );
    expect(parseFormula('CuSO₄·5H₂O')).toEqual(
      new Map([
        ['Cu', 1],
        ['S', 1],
        ['O', 9],
        ['H', 10],
      ]),
    );
    expect(parseFormula('SO₄²⁻')).toEqual(
      new Map([
        ['S', 1],
        ['O', 4],
      ]),
    );
    expect(parseFormula('Ag⁺')).toEqual(new Map([['Ag', 1]]));
    expect(parseFormula('SO4 2-')).toEqual(
      new Map([
        ['S', 1],
        ['O', 4],
      ]),
    );
    expect(parseFormula('CO')).toEqual(
      new Map([
        ['C', 1],
        ['O', 1],
      ]),
    );
    expect(parseFormula('Co')).toEqual(new Map([['Co', 1]]));
  });

  it('are refused when they are not a formula of known elements', () => {
    for (const bad of ['', 'xyz', 'Na(OH', 'Na)OH', 'Xx2', '2', 'a b'])
      expect(parseFormula(bad), bad).toBeNull();
    expect(formulaWeight('NaCl')).toBeNull(); // Na has no weight: no model uses it
  });

  it('in every bundled experiment parse to named elements', () => {
    for (const [path, definition] of Object.entries(experiments)) {
      for (const material of definition.workspace?.materials ?? []) {
        if (material.formula === undefined) continue;
        const atoms = parseFormula(material.formula);
        expect(atoms, `${path}: ${material.formula}`).not.toBeNull();
        for (const symbol of atoms!.keys()) expect(named(), `${path}: ${symbol}`).toContain(symbol);
      }
    }
  });

  it('are kept with the materials that have one', () => {
    const used = usedBy([
      { label: 'Salt', formula: 'NaCl' },
      { label: 'Water' },
      { label: 'Bad', formula: '??' },
    ]);
    expect(used).toHaveLength(1);
    expect([...used[0]!.symbols].sort()).toEqual(['Cl', 'Na']);
  });
});

describe('the periodic table piece', () => {
  beforeEach(() => installDom());
  afterEach(() => vi.unstubAllGlobals());

  const withMaterials = (
    materials: { id: string; kind: string; label: string; formula?: string }[],
    model = 'acid-base.titration',
  ) => {
    const base = definitionOf('acid-base-titration');
    const definition = { ...base, model, workspace: { pieces: [], materials, setup: [] } } as never;
    const m = mountPiece(CHEM_PIECES['periodic-table']!, piece('periodic-table'));
    m.view.update(stationView(definition, {}));
    return m;
  };
  const cells = (m: ReturnType<typeof withMaterials>) =>
    findAll(m.root, (n) => n.className === '' && n.getAttribute('class') === 'chem-cell');
  const symbolOf = (n: { children: { tag: string; textContent: string }[] }) =>
    n.children.find((c) => c.tag === 'text')!.textContent;
  const click = (m: ReturnType<typeof withMaterials>, symbol: string) =>
    cells(m)
      .find((n) => symbolOf(n) === symbol)!
      .dispatch('click');
  it('is a group, not an image, so its element buttons stay exposed', () => {
    const m = withMaterials([]);
    expect(findAll(m.root, (n) => n.tag === 'svg')[0]!.getAttribute('role')).toBe('group');
  });

  const card = (m: ReturnType<typeof withMaterials>) =>
    byClass(m.root, 'chem-card')[0]!.textContent;

  const MATERIALS = [
    { id: 'hcl', kind: 'solution', label: 'Hydrochloric acid', formula: 'HCl' },
    { id: 'naoh', kind: 'solution', label: 'Sodium hydroxide', formula: 'NaOH' },
    { id: 'indicator', kind: 'indicator', label: 'Phenolphthalein' },
  ];

  it('activates only the elements in the materials formulas', () => {
    const m = withMaterials(MATERIALS);
    expect(cells(m)).toHaveLength(118);
    const active = cells(m)
      .filter((n) => n.getAttribute('data-active') === '1')
      .map(symbolOf)
      .sort();
    expect(active).toEqual(['Cl', 'H', 'Na', 'O']);
    // Active cells can be reached by keyboard and are named; the others are dimmed with no name.
    const na = cells(m).find((n) => symbolOf(n) === 'Na')!;
    expect(na.getAttribute('tabindex')).toBe('0');
    expect(na.getAttribute('aria-label')).toBe('Sodium (Na), atomic number 11');
    const cu = cells(m).find((n) => symbolOf(n) === 'Cu')!;
    expect(cu.getAttribute('tabindex')).toBeNull();
    expect(cu.getAttribute('aria-label')).toBeNull();
    expect(cu.getAttribute('aria-hidden')).toBe('true');
  });

  it('says what an element is and where it is in this experiment, and says nothing of others', () => {
    const m = withMaterials(MATERIALS);
    click(m, 'Na');
    expect(card(m)).toContain('Sodium (Na), atomic number 11');
    expect(card(m)).toContain('Sodium hydroxide (NaOH)');
    expect(card(m)).not.toContain('Hydrochloric');
    expect(card(m)).not.toContain('atomic weight'); // the titration model does not use weights
    click(m, 'Cu');
    expect(card(m)).toBe('Cu is not in any material of this experiment.');
  });

  it('shows the atomic weight only for a model that uses it', () => {
    const m = withMaterials(
      [{ id: 'agno3', kind: 'solution', label: 'Silver nitrate', formula: 'AgNO₃' }],
      'chemistry.precipitation',
    );
    click(m, 'Ag');
    expect(card(m)).toContain('Standard atomic weight 107.87 g/mol');
    click(m, 'N'); // nitrogen has no weight in the table: no model uses it
    expect(card(m)).not.toContain('atomic weight');
  });

  it('offers no way to add or combine an element, and releases its listeners', () => {
    const m = withMaterials(MATERIALS);
    expect(findAll(m.root as never, (n) => n.tag === 'button' || n.tag === 'input')).toHaveLength(
      0,
    );
    expect(totalListeners(m.root as never)).toBeGreaterThan(0);
    m.view.dispose();
    expect(totalListeners(m.root as never)).toBe(0);
  });

  it('is empty of active elements for an experiment with no formulas', () => {
    const m = withMaterials([{ id: 'x', kind: 'solution', label: 'Plain' }]);
    expect(cells(m).filter((n) => n.getAttribute('data-active') === '1')).toHaveLength(0);
  });
});
