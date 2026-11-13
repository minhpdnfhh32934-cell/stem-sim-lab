/**
 * Formulas in text as a teacher writes them (Phú, 2026-11-10): `m_A` an A written small and low
 * after the m, `x^2` / `e^(−t/τ)` a small raised exponent, `a/b` between quantities a fraction (the
 * numerator over a bar over the denominator), units (`m/s`, `J/(kg·K)`) and words (`true/false`)
 * left as they are written. Shared by the board, the HTML views and the voice
 * (`formulaSpeech.ts`), so what is written and what is said agree. Pure.
 *
 * Every run keeps the index in the source of its first character (`from`), so text written out
 * letter by letter (the board, the dialogue) shows the runs whose characters it has reached.
 */
export interface Run {
  readonly text: string;
  readonly level: 'base' | 'sub' | 'sup';
  /** Index of its first character in the source. */
  readonly from: number;
  /** A unit (after a number, or a unit over a unit): the voice says its name. */
  readonly unit?: true;
}

export interface Fraction {
  readonly num: readonly Item[];
  readonly den: readonly Item[];
  /** Index of its first and past its last character in the source. */
  readonly from: number;
  readonly to: number;
}

export type Item = Run | Fraction;

export const isFraction = (item: Item): item is Fraction => 'num' in item;

/** Unit symbols (and their powers): a slash between two of them is a unit's, not a fraction. */
const UNITS = new Set([
  'm',
  's',
  'kg',
  'g',
  'mg',
  'µg',
  'mol',
  'mmol',
  'L',
  'mL',
  'J',
  'kJ',
  'N',
  'V',
  'mV',
  'A',
  'mA',
  'W',
  'kW',
  'Pa',
  'kPa',
  'K',
  'h',
  'min',
  'rad',
  'cm',
  'mm',
  'µm',
  'nm',
  'km',
  'Hz',
  'C',
  'Ω',
  'T',
  'F',
  'µF',
  'Wb',
  'lx',
  'day',
  'days',
  'beats',
  'cells',
  'mmHg',
  '°C',
  '°',
]);

/** A unit expression: unit symbols joined by · (powers allowed), maybe in parentheses. */
function isUnitExpr(raw: string): boolean {
  const inner = raw.startsWith('(') && raw.endsWith(')') ? raw.slice(1, -1) : raw;
  return inner.split('·').every((f) => UNITS.has(f.replace(/[²³⁻¹⁰-⁹]+$/u, '')) && f.length > 0);
}

const LETTER = /[\p{L}µ°]/u;
const DIGIT = /[0-9]/;
const SUPERSCRIPTS = /[²³⁰¹⁴-⁹⁻⁺]/u;
const SUBSCRIPTS = /[₀-₉]/u;

/** A term the parser reads as one thing: its source range and how it is written. */
interface Atom {
  readonly start: number;
  readonly end: number;
  readonly raw: string;
  /** A number, a quantity (a letter or two, maybe subscripted), or a group in parentheses. */
  readonly kind: 'number' | 'quantity' | 'word' | 'group' | 'root';
}

/** The atom starting at `i`, or null (an operator, a space, punctuation). */
function atomAt(src: string, i: number): Atom | null {
  const c = src[i] ?? '';
  if (c === '(') {
    let depth = 0;
    for (let j = i; j < src.length; j++) {
      if (src[j] === '(') depth++;
      else if (src[j] === ')' && --depth === 0) {
        return { start: i, end: j + 1, raw: src.slice(i, j + 1), kind: 'group' };
      }
    }
    return null;
  }
  if (c === '√') {
    const inner = atomAt(src, i + 1);
    return inner ? { start: i, end: inner.end, raw: src.slice(i, inner.end), kind: 'root' } : null;
  }
  if (DIGIT.test(c)) {
    let j = i;
    while (DIGIT.test(src[j] ?? '') || (src[j] === '.' && DIGIT.test(src[j + 1] ?? ''))) j++;
    return { start: i, end: j, raw: src.slice(i, j), kind: 'number' };
  }
  if (LETTER.test(c)) {
    let j = i;
    while (LETTER.test(src[j] ?? '') || DIGIT.test(src[j] ?? '')) j++;
    const letters = j - i;
    let marked = false;
    // Its subscript (letters and digits after `_`), primes, unicode sub- and superscripts.
    for (;;) {
      if (src[j] === '_' && /[\p{L}0-9]/u.test(src[j + 1] ?? '')) {
        j++;
        while (/[\p{L}0-9]/u.test(src[j] ?? '')) j++;
        marked = true;
      } else if ((src[j] === "'" || src[j] === '′') && (letters <= 2 || marked)) {
        j++; // a prime (v′); not a word's apostrophe (Newton's)
        marked = true;
      } else if (SUPERSCRIPTS.test(src[j] ?? '') || SUBSCRIPTS.test(src[j] ?? '')) {
        j++;
        marked = true;
      } else break;
    }
    const raw = src.slice(i, j);
    const quantity = marked || letters <= 2 || /^[α-ωΑ-Ω]/u.test(raw);
    return { start: i, end: j, raw, kind: quantity ? 'quantity' : 'word' };
  }
  return null;
}

const mathy = (a: Atom) => a.kind !== 'word';

/**
 * `src` as runs and fractions. `fractions` false: every slash written inline (in an exponent,
 * where a stacked fraction would be too small to read).
 */
export function layoutFormula(src: string, offset = 0, fractions = true): Item[] {
  // The atoms and what is between them, in order.
  const parts: (Atom | { start: number; end: number; raw: string; kind: 'gap' })[] = [];
  for (let i = 0; i < src.length;) {
    const atom = atomAt(src, i);
    if (atom) {
      parts.push(atom);
      i = atom.end;
    } else {
      parts.push({ start: i, end: i + 1, raw: src[i] ?? '', kind: 'gap' });
      i++;
    }
  }
  const items: Item[] = [];
  // Plain stretches; a group with a slash inside (√(2h/g)) laid out within its brackets, unless
  // it is an exponent's (e^(−t/τ): written inline, raised).
  const emit = (start: number, end: number) => {
    let at = start;
    for (let k = 0; k < parts.length; k++) {
      const part = parts[k];
      if (!part || part.start < start || part.end > end || part.kind === 'gap') continue;
      const group =
        part.kind === 'root'
          ? { open: part.start + 2 }
          : part.kind === 'group'
            ? { open: part.start + 1 }
            : null;
      if (!group || !part.raw.includes('/') || parts[k - 1]?.raw === '^') continue;
      items.push(...written(src, at, group.open, offset));
      items.push(
        ...layoutFormula(src.slice(group.open, part.end - 1), offset + group.open, fractions),
      );
      at = part.end - 1;
    }
    items.push(...written(src, at, end, offset));
  };
  let done = 0; // source index written so far
  for (let k = 0; k < parts.length; k++) {
    const slash = parts[k];
    if (!fractions || slash?.kind !== 'gap' || slash.raw !== '/') continue;
    const right = parts[k + 1];
    if (!right || right.kind === 'gap' || !mathy(right)) continue;
    // The numerator: the atom before, and the product it ends (atoms joined by ·, × or nothing).
    let first = k - 1;
    const left = parts[first];
    if (!left || left.kind === 'gap' || !mathy(left)) continue;
    while (first >= 2) {
      const join = parts[first - 1];
      const before = parts[first - 2];
      if (!before || before.kind === 'gap' || !mathy(before)) break;
      if (join?.kind === 'gap' && (join.raw === '·' || join.raw === '×')) first -= 2;
      else break;
    }
    while (first >= 1) {
      const before = parts[first - 1];
      if (before && before.kind !== 'gap' && mathy(before) && before.end === parts[first]?.start) {
        first--; // 2h, ½m: written together
      } else break;
    }
    const numStart = parts[first]?.start ?? left.start;
    if (numStart < done) continue; // inside a fraction already made
    // A unit over a unit (m/s, J/(kg·K)) is a unit's slash; the whole numerator counts (2h/g is not).
    if (isUnitExpr(src.slice(numStart, left.end)) && isUnitExpr(right.raw)) continue;
    emit(done, numStart);
    const strip = (a: { start: number; end: number; kind: string }): [number, number] =>
      a.kind === 'group' ? [a.start + 1, a.end - 1] : [a.start, a.end];
    const numParts = parts.slice(first, k);
    const [ns, ne] = numParts.length === 1 ? strip(left) : [numStart, left.end];
    const [ds, de] = strip(right);
    items.push({
      num: layoutFormula(src.slice(ns, ne), offset + ns, fractions),
      den: layoutFormula(src.slice(ds, de), offset + ds, fractions),
      from: offset + numStart,
      to: offset + right.end,
    });
    done = right.end;
    k++;
  }
  emit(done, src.length);
  return merge(items);
}

/** The runs of `src[start, end)`: subscripts after `_`, exponents after `^`, units named. */
function written(src: string, start: number, end: number, offset: number): Run[] {
  const runs: Run[] = [];
  const push = (text: string, level: Run['level'], from: number, unit = false) => {
    if (text)
      runs.push(
        unit ? { text, level, from: offset + from, unit } : { text, level, from: offset + from },
      );
  };
  let i = start;
  let plain = start;
  // Plain text, piece by piece: a unit after a number and a space ("0.4 m/s", "12 V") is marked.
  const flush = (to: number) => {
    let at = plain;
    for (const piece of src.slice(plain, to).split(/(\s+)/u)) {
      if (!piece) continue;
      // Its trailing punctuation off, and a closing bracket that is not its own.
      let clean = piece.replace(/[;,.:]+$/u, '');
      if (clean.endsWith(')') && count(clean, '(') < count(clean, ')')) clean = clean.slice(0, -1);
      const afterNumber = /[0-9]\s+$/u.test(src.slice(Math.max(0, at - 12), at));
      if (clean && afterNumber && isUnitWithSlash(clean)) {
        push(clean, 'base', at, true);
        push(piece.slice(clean.length), 'base', at + clean.length);
      } else push(piece, 'base', at);
      at += piece.length;
    }
  };
  while (i < end) {
    const c = src[i];
    if (
      c === '_' &&
      i > start &&
      /[\p{L}0-9′'²³]/u.test(src[i - 1] ?? '') &&
      /[\p{L}0-9]/u.test(src[i + 1] ?? '')
    ) {
      flush(i);
      let j = i + 1;
      while (j < end && /[\p{L}0-9]/u.test(src[j] ?? '')) j++;
      push(src.slice(i + 1, j), 'sub', i + 1);
      i = plain = j;
    } else if (c === '^' && i > start) {
      flush(i);
      let j = i + 1;
      let text: string;
      if (src[j] === '(') {
        let depth = 0;
        for (; j < end; j++) {
          if (src[j] === '(') depth++;
          else if (src[j] === ')' && --depth === 0) break;
        }
        text = src.slice(i + 2, j);
        j++;
      } else {
        while (
          j < end &&
          /[\p{L}0-9.−-]/u.test(src[j] ?? '') &&
          !(j > i + 1 && /[−-]/u.test(src[j] ?? ''))
        )
          j++;
        text = src.slice(i + 1, j);
      }
      push(text, 'sup', i + 1);
      i = plain = j;
    } else i++;
  }
  flush(end);
  return runs;
}

/** A unit, maybe over another: `m`, `m/s²`, `J/(kg·K)`, `beats/min`. */
function isUnitWithSlash(raw: string): boolean {
  const slash = raw.indexOf('/');
  if (slash < 0) return isUnitExpr(raw);
  return isUnitExpr(raw.slice(0, slash)) && isUnitExpr(raw.slice(slash + 1));
}

const count = (text: string, c: string) => text.split(c).length - 1;

/** Neighbouring plain runs of one level joined (fewer to draw). */
function merge(items: Item[]): Item[] {
  const out: Item[] = [];
  for (const item of items) {
    const last = out[out.length - 1];
    if (
      last &&
      !isFraction(last) &&
      !isFraction(item) &&
      last.level === item.level &&
      !last.unit &&
      !item.unit &&
      last.from + last.text.length === item.from
    ) {
      out[out.length - 1] = { text: last.text + item.text, level: last.level, from: last.from };
    } else out.push(item);
  }
  return out;
}

/** The text written in Vietnamese: decimal commas (0,5), as Vietnamese teachers write. */
export function decimalComma(text: string): string {
  return text.replace(/(\d)\.(\d)/gu, '$1,$2');
}
