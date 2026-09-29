import { elementBySymbol } from './data/elements';

/**
 * Chemical formula parser for the equation balancer and data checks.
 *
 * Accepts: element symbols with counts, nested (), [], hydrates "CuSO4·5H2O" (also "*" or
 * "."), structural marks (=, ≡, –) which are ignored, and charges written "Fe^3+",
 * "Fe{3+}", superscripts "Fe³⁺", RDKit style "CO3-2", or trailing signs only ("NH4+",
 * "OH-", "O--"). A digit before a plain sign is a COUNT ("NH4+" is NH₄⁺), so a charge
 * larger than 1 needs "^" or braces. The electron is "e-".
 */
export interface ParsedFormula {
  counts: Map<string, number>;
  charge: number;
}

export class FormulaError extends Error {
  override name = 'FormulaError';
}

const SUP: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '⁺': '+',
  '⁻': '-',
};
const SUB: Record<string, string> = {
  '₀': '0',
  '₁': '1',
  '₂': '2',
  '₃': '3',
  '₄': '4',
  '₅': '5',
  '₆': '6',
  '₇': '7',
  '₈': '8',
  '₉': '9',
};

function splitCharge(s: string): { body: string; charge: number } {
  let m = /^(.*)\^\{?(\d*)([+-])\}?$/.exec(s) ?? /^(.*)\{(\d*)([+-])\}$/.exec(s);
  if (m) return { body: m[1] ?? '', charge: (m[3] === '-' ? -1 : 1) * Number(m[2] || '1') };
  m = /^(.*[A-Za-z0-9)\]])([+-])(\d+)$/.exec(s); // RDKit "CO3-2"
  if (m) return { body: m[1] ?? '', charge: (m[2] === '-' ? -1 : 1) * Number(m[3]) };
  m = /^(.*?)([+]+|[-]+)$/.exec(s);
  if (m && (m[1] ?? '') !== '') {
    const signs = m[2] ?? '';
    return { body: m[1] ?? '', charge: (signs.startsWith('-') ? -1 : 1) * signs.length };
  }
  return { body: s, charge: 0 };
}

export function parseFormula(input: string): ParsedFormula {
  const raw = input
    .trim()
    // Superscript charges are unambiguous: "Fe³⁺" → "Fe^3+".
    .replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]*[⁺⁻])$/, (c) => `^${[...c].map((x) => SUP[x] ?? x).join('')}`)
    .replace(/[₀-₉]/g, (c) => SUB[c] ?? c)
    .replace(/\s+/g, '');
  if (!raw) throw new FormulaError('empty formula');
  if (/^e-?$/.test(raw) || raw === 'e^-') return { counts: new Map(), charge: -1 };
  const { body, charge } = splitCharge(raw);
  const clean = body.replace(/[=≡–—#]/g, '');
  const parts = clean.split(/[·*.•]/);
  const total = new Map<string, number>();
  for (const part of parts) {
    const pm = /^(\d*)(.*)$/.exec(part);
    const mult = pm?.[1] ? Number(pm[1]) : 1;
    const counts = parseGroup(pm?.[2] ?? '', input);
    for (const [el, n] of counts) total.set(el, (total.get(el) ?? 0) + n * mult);
  }
  if (total.size === 0) throw new FormulaError(`no elements in "${input}"`);
  return { counts: total, charge };
}

function parseGroup(s: string, original: string): Map<string, number> {
  let i = 0;
  const readCount = () => {
    const m = /^\d+/.exec(s.slice(i));
    if (!m) return 1;
    i += m[0].length;
    return Number(m[0]);
  };
  const parse = (close: string | null): Map<string, number> => {
    const counts = new Map<string, number>();
    while (i < s.length) {
      const ch = s[i] ?? '';
      if (ch === '(' || ch === '[') {
        i++;
        const inner = parse(ch === '(' ? ')' : ']');
        const k = readCount();
        for (const [el, n] of inner) counts.set(el, (counts.get(el) ?? 0) + n * k);
        continue;
      }
      if (ch === ')' || ch === ']') {
        if (ch !== close) throw new FormulaError(`unbalanced brackets in "${original}"`);
        i++;
        return counts;
      }
      const m = /^[A-Z][a-z]?/.exec(s.slice(i));
      if (!m) throw new FormulaError(`unexpected "${ch}" in "${original}"`);
      let sym = m[0];
      // Prefer a valid two-letter symbol, else fall back to one letter ("Co" vs "CO").
      if (sym.length === 2 && !elementBySymbol(sym)) sym = sym.slice(0, 1);
      if (!elementBySymbol(sym))
        throw new FormulaError(`unknown element "${sym}" in "${original}"`);
      i += sym.length;
      const k = readCount();
      counts.set(sym, (counts.get(sym) ?? 0) + k);
    }
    if (close) throw new FormulaError(`unbalanced brackets in "${original}"`);
    return counts;
  };
  return parse(null);
}

/** "H2SO4" → "H₂SO₄", charges as superscripts. */
export function formatFormula(input: string): string {
  const { body, charge } = splitCharge(input.trim());
  const sub = body.replace(/(?<=[A-Za-z)\]])\d+/g, (d) =>
    d.replace(/\d/g, (x) => '₀₁₂₃₄₅₆₇₈₉'[Number(x)] ?? x),
  );
  if (!charge) return sub;
  const mag =
    Math.abs(charge) === 1
      ? ''
      : String(Math.abs(charge)).replace(/\d/g, (x) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(x)] ?? x);
  return `${sub}${mag}${charge > 0 ? '⁺' : '⁻'}`;
}

/** Molar mass (g/mol) from standard atomic weights. */
export function molarMass(input: string): number {
  const { counts } = parseFormula(input);
  let m = 0;
  for (const [el, n] of counts) m += (elementBySymbol(el)?.atomic_weight ?? NaN) * n;
  return m;
}
