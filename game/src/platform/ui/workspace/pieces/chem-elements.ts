import { z } from 'zod';
import table from '../../../../content/elements.json';
import { el } from '../../dom';
import { defineChem, S, type Kit, type Part } from './chem-kit';
import type { PieceViewFactory } from '../types';

/*
 * The contextual periodic table. It is a lens on the experiment's materials, not a store of
 * ingredients: only the elements in the formulas of the materials the definition lists are active
 * and named; every other cell shows its symbol, dimmed, and says nothing else. There is no action
 * that adds or combines an element, ever.
 */

const ElementSchema = z.strictObject({
  z: z.number().int().min(1).max(118),
  symbol: z.string().regex(/^[A-Z][a-z]?$/),
  period: z.number().int().min(1).max(7),
  /** Null for the lanthanides and actinides, drawn in rows of their own below the table. */
  group: z.number().int().min(1).max(18).nullable(),
  name: z.string().min(1).optional(),
  vi: z.strictObject({ name: z.string().min(1) }).optional(),
  /** Standard atomic weight (g/mol), only for an element a model uses. */
  weight: z.number().positive().optional(),
});

const TableSchema = z
  .strictObject({
    source: z.string().min(1),
    /** The models whose results use atomic weights: only for those are weights shown. */
    weightModels: z.array(z.string().min(1)),
    elements: z.array(ElementSchema).length(118),
  })
  .superRefine((t, ctx) => {
    t.elements.forEach((e, i) => {
      if (e.z !== i + 1) ctx.addIssue({ code: 'custom', message: `element ${i + 1} is Z=${e.z}` });
      if ((e.vi !== undefined || e.weight !== undefined) && e.name === undefined) {
        ctx.addIssue({
          code: 'custom',
          message: `${e.symbol}: a translation or weight needs a name`,
        });
      }
      if (t.elements.findIndex((o) => o.symbol === e.symbol) !== i) {
        ctx.addIssue({ code: 'custom', message: `duplicate symbol ${e.symbol}` });
      }
    });
  });

export type Element = z.output<typeof ElementSchema>;
export type ElementTable = z.output<typeof TableSchema>;

let loaded: ElementTable | null = null;
/** The element table, checked once. */
export function elementTable(): ElementTable {
  loaded ??= TableSchema.parse(table);
  return loaded;
}

// ---- formulas ---------------------------------------------------------------------------------

const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉';

/** The charge of an ion written as superscripts, or after a space or ^, removed; subscripts as digits. */
function plain(formula: string): string {
  let out = '';
  for (const ch of formula) {
    const i = SUBSCRIPTS.indexOf(ch);
    out += i >= 0 ? String(i) : ch;
  }
  return out.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+$/u, '').replace(/[\s^]\d*[+-]$/, '');
}

/**
 * The atoms in a formula such as "Ba(NO₃)₂", "CuSO₄·5H₂O" or "SO₄²⁻" (ions' charges are dropped):
 * element symbol to count. Null where the text is not a formula of elements in the table.
 */
export function parseFormula(formula: string): Map<string, number> | null {
  const known = new Set(elementTable().elements.map((e) => e.symbol));
  const total = new Map<string, number>();
  for (const part of plain(formula).split(/[·.]/u)) {
    const lead = /^\d+/.exec(part)?.[0] ?? '';
    const body = part.slice(lead.length);
    let at = 0;
    const count = (): number => {
      const digits = /^\d+/.exec(body.slice(at))?.[0] ?? '';
      at += digits.length;
      return digits === '' ? 1 : Number(digits);
    };
    const group = (): Map<string, number> | null => {
      const atoms = new Map<string, number>();
      while (at < body.length && body[at] !== ')') {
        if (body[at] === '(') {
          at++;
          const inner = group();
          if (!inner || body[at] !== ')') return null;
          at++;
          const n = count();
          for (const [s, k] of inner) atoms.set(s, (atoms.get(s) ?? 0) + k * n);
          continue;
        }
        const symbol = /^[A-Z][a-z]?/.exec(body.slice(at))?.[0];
        if (symbol === undefined) return null;
        // "Co" is cobalt, "CO" carbon and oxygen: a lower-case letter belongs to the symbol only if it names an element.
        const one = symbol.slice(0, 1);
        const use = known.has(symbol) ? symbol : known.has(one) ? one : null;
        if (use === null) return null;
        at += use.length;
        atoms.set(use, (atoms.get(use) ?? 0) + count());
      }
      return atoms;
    };
    const atoms = group();
    if (!atoms || at !== body.length || atoms.size === 0) return null;
    const n = lead === '' ? 1 : Number(lead);
    for (const [s, k] of atoms) total.set(s, (total.get(s) ?? 0) + k * n);
  }
  return total.size > 0 ? total : null;
}

/** The standard atomic weight of a formula (g/mol), or null where an element has none in the table. */
export function formulaWeight(formula: string): number | null {
  const atoms = parseFormula(formula);
  if (!atoms) return null;
  const by = new Map(elementTable().elements.map((e) => [e.symbol, e]));
  let sum = 0;
  for (const [symbol, n] of atoms) {
    const weight = by.get(symbol)?.weight;
    if (weight === undefined) return null;
    sum += weight * n;
  }
  return sum;
}

/** The materials of a workspace with their formulas' elements: what the table can say about them. */
export interface Used {
  readonly material: { readonly label: string; readonly formula?: string | undefined };
  readonly symbols: ReadonlySet<string>;
}

export function usedBy(
  materials: readonly { readonly label: string; readonly formula?: string | undefined }[],
): Used[] {
  return materials.flatMap((material) => {
    const atoms = material.formula === undefined ? null : parseFormula(material.formula);
    return atoms ? [{ material, symbols: new Set(atoms.keys()) }] : [];
  });
}

// ---- layout -----------------------------------------------------------------------------------

/** Where an element is drawn: column and row (1-based), the lanthanides and actinides in rows 8 and 9. */
export function cell(e: Element): { col: number; row: number } {
  if (e.group !== null) return { col: e.group, row: e.period };
  return { col: 3 + (e.z - (e.period === 6 ? 57 : 89)), row: e.period + 2 };
}

// ---- the piece --------------------------------------------------------------------------------

const W = 22;
const H = 24;

function periodicTable(kit: Kit): Part {
  const { texts } = kit;
  const t = elementTable();
  const art = kit.drawing(18 * W + 8, 9 * H + 14, 'group');
  const card = el('div', 'chem-card');
  card.setAttribute('role', 'status');
  card.setAttribute('aria-live', 'polite');
  kit.host.append(card);
  const cells = new Map<string, SVGElement>();
  for (const e of t.elements) {
    const { col, row } = cell(e);
    const g = S(
      'g',
      {
        class: 'chem-cell',
        transform: `translate(${4 + (col - 1) * W} ${4 + (row - 1) * H + (row > 7 ? 10 : 0)})`,
      },
      art,
    );
    S('rect', { width: W - 2, height: H - 2, rx: 2 }, g);
    S('text', { x: (W - 2) / 2, y: 15, 'text-anchor': 'middle' }, g).textContent = e.symbol;
    cells.set(e.symbol, g);
  }
  let used: Used[] | null = null;
  let model = '';

  const describe = (e: Element): void => {
    card.replaceChildren();
    const list = used ?? [];
    const inside = list.filter((u) => u.symbols.has(e.symbol));
    if (inside.length === 0 || e.name === undefined) {
      card.append(
        el(
          'p',
          undefined,
          texts.ui('chem.element.notUsed', '{symbol} is not in any material of this experiment.', {
            symbol: e.symbol,
          }),
        ),
      );
      return;
    }
    card.append(
      el(
        'h4',
        undefined,
        texts.ui('chem.element.card', '{name} ({symbol}), atomic number {z}', {
          name: texts.of(e, 'name'),
          symbol: e.symbol,
          z: e.z,
        }),
      ),
      el('p', undefined, texts.ui('chem.element.in', 'In this experiment:')),
    );
    const ul = el('ul');
    for (const u of inside) {
      ul.append(
        el(
          'li',
          undefined,
          u.material.formula
            ? `${texts.of(u.material, 'label')} (${u.material.formula})`
            : texts.of(u.material, 'label'),
        ),
      );
    }
    card.append(ul);
    // Atomic weights only where the experiment's model uses them.
    if (e.weight !== undefined && t.weightModels.includes(model)) {
      card.append(
        el(
          'p',
          undefined,
          texts.ui(
            'chem.element.weight',
            'Standard atomic weight {weight} g/mol (IUPAC 2021, abridged)',
            { weight: e.weight },
          ),
        ),
      );
    }
  };

  return {
    draw(f) {
      if (used) return;
      used = usedBy(f.view.definition.workspace?.materials ?? []);
      model = f.view.definition.model;
      const active = new Set(used.flatMap((u) => [...u.symbols]));
      for (const e of t.elements) {
        const g = cells.get(e.symbol);
        if (!g) continue;
        const on = active.has(e.symbol) && e.name !== undefined;
        g.setAttribute('data-active', on ? '1' : '0');
        if (on) {
          g.setAttribute('role', 'button');
          g.setAttribute('tabindex', '0');
          g.setAttribute(
            'aria-label',
            texts.ui('chem.element.card', '{name} ({symbol}), atomic number {z}', {
              name: texts.of(e, 'name'),
              symbol: e.symbol,
              z: e.z,
            }),
          );
          kit.listen(g, 'keydown', (event) => {
            const key = (event as KeyboardEvent).key;
            if (key === 'Enter' || key === ' ') {
              event.preventDefault();
              describe(e);
            }
          });
        } else {
          g.setAttribute('aria-hidden', 'true');
        }
        kit.listen(g, 'click', () => describe(e));
      }
      card.append(
        el(
          'p',
          'chem-note',
          texts.ui(
            'chem.element.note',
            'Elements only show what the materials are made of: nothing is added or combined here.',
          ),
        ),
      );
    },
  };
}

export const ELEMENTS: Readonly<Record<string, PieceViewFactory>> = {
  'periodic-table': defineChem('periodic-table', periodicTable),
};
