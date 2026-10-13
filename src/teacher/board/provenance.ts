/**
 * Where each number on the board comes from (MASTER_PROMPT §2, docs/TEACHSCRIPT.md §7). The AI
 * never computes for the learner: every number it writes is either
 * - `given`: in the learner's question (or a standard value such as g = 9,8 / 9,81 / 10),
 * - `checked`: the result of arithmetic written on the board that this code re-computed
 *   ("a = 10/2 = 5" → 10 ÷ 2 really is 5), or
 * - `unverified`: neither — the board then marks it "AI tự tính, chưa kiểm chứng".
 */
import { numbersIn } from '@/ai/numbers';

export type NumberStatus = 'given' | 'checked' | 'unverified';

export interface NumberCheck {
  raw: string;
  value: number;
  status: NumberStatus;
}

export interface Provenance {
  numbers: NumberCheck[];
  /** Results this element proved; later elements may use them as known. */
  results: number[];
  /** The worst status in the element ('given' when there are no numbers). */
  status: NumberStatus;
}

/** Standard values a teacher may use without them being in the problem. */
const STANDARD = [9.8, 9.81, 10, 3.14, 3.1416, 3.6, 1000, 100, 60, 3600, 273, 273.15];

const NUMBER = /\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+[.,]\d+|\d+/g;

function value(raw: string): number {
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw))
    return Number(raw.replace(/\./g, '').replace(',', '.'));
  return Number(raw.replace(',', '.'));
}

function close(a: number, b: number): boolean {
  if (a === b) return true;
  const scale = Math.max(Math.abs(a), Math.abs(b), 1e-12);
  // Answers are rounded: 0,5 % or the last written digit.
  return Math.abs(a - b) / scale < 5e-3;
}

/** LaTeX / board notation → plain arithmetic ("\frac{10}{2}" → "(10)/(2)"). */
export function toArithmetic(s: string): string {
  let t = s
    .replace(/\\text\{[^}]*\}|\\mathrm\{[^}]*\}/g, ' ')
    .replace(/\\left|\\right|\\,|\\;|\\!/g, ' ')
    .replace(/\{,\}/g, ',')
    .replace(/\\cdot|\\times|[×·⋅∙]/g, '*')
    .replace(/\\div|÷/g, '/')
    .replace(/−/g, '-');
  for (let i = 0; i < 5 && /\\[dt]?frac/.test(t); i++) {
    t = t.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '(($1)/($2))');
  }
  for (let i = 0; i < 3 && /\\sqrt/.test(t); i++)
    t = t.replace(/\\sqrt\s*\{([^{}]*)\}/g, 'sqrt($1)');
  return (
    t
      .replace(/\^\{([^{}]*)\}/g, '^($1)')
      // Remaining commands (\ , \quad, \Delta…) are not arithmetic.
      .replace(/\\[a-zA-Z]+|\\./g, ' ')
      .replace(/[{}]/g, '')
  );
}

/** Evaluates + − × ÷ ^ sqrt and brackets; null when the text is not pure arithmetic. */
export function evaluate(expr: string): number | null {
  const src = expr.replace(/\s+/g, '');
  if (!src || /[a-zA-Z]/.test(src.replace(/sqrt/g, ''))) return null;
  let i = 0;
  const peek = () => src[i] ?? '';
  const num = (): number | null => {
    const m = /^(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+[.,]\d+|\d+)/.exec(src.slice(i));
    if (!m) return null;
    i += m[0].length;
    return value(m[0]);
  };
  const primary = (): number | null => {
    if (src.startsWith('sqrt(', i)) {
      i += 5;
      const v = sum();
      if (peek() !== ')' || v === null || v < 0) return null;
      i++;
      return Math.sqrt(v);
    }
    if (peek() === '(') {
      i++;
      const v = sum();
      if (peek() !== ')') return null;
      i++;
      return v;
    }
    return num();
  };
  const unary = (): number | null => {
    if (peek() === '-') {
      i++;
      const v = unary();
      return v === null ? null : -v;
    }
    return primary();
  };
  const power = (): number | null => {
    const base = unary();
    if (base === null) return null;
    if (peek() === '^') {
      i++;
      const exp = power();
      return exp === null ? null : base ** exp;
    }
    return base;
  };
  const product = (): number | null => {
    let v = power();
    while (v !== null && (peek() === '*' || peek() === '/' || peek() === ':')) {
      const op = peek();
      i++;
      const r = power();
      if (r === null) return null;
      if (op !== '*' && r === 0) return null;
      v = op === '*' ? v * r : v / r;
    }
    return v;
  };
  function sum(): number | null {
    let v = product();
    while (v !== null && (peek() === '+' || peek() === '-')) {
      const op = peek();
      i++;
      const r = product();
      if (r === null) return null;
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  const result = sum();
  return result !== null && i === src.length && Number.isFinite(result) ? result : null;
}

/** "5 m/s²" → "5": a lone number followed by its unit counts as that number. */
function stripUnit(part: string): string {
  const m =
    /^\s*(-?\s*(?:\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+[.,]\d+|\d+))\s*[a-zA-Zµμ°%Ω/²³]*[a-zA-Zµμ°%Ω²³/^0-9-]*\s*$/.exec(
      part,
    );
  return m ? (m[1] ?? part) : part;
}

/**
 * Checks the numbers of one board element against the problem's numbers (`sources`) and the
 * results proved earlier in the lesson (`known`).
 */
export function checkNumbers(
  text: string,
  sources: readonly number[],
  known: readonly number[],
): Provenance {
  const arithmetic = toArithmetic(text);
  const given = (v: number) =>
    [...sources, ...STANDARD].some((s) => close(s, v)) ||
    (Number.isInteger(v) && v >= 0 && v <= 10);
  const proved = new Set<number>();
  const results: number[] = [];
  // Chains "expr = expr = value": each numeric part must equal the one before it.
  for (const chain of arithmetic.split(/[;\n]|,\s(?=[^\d])/)) {
    const parts = chain.split(/=|≈/).map((p) => stripUnit(p));
    let previous: number | null = null;
    let inputsOk = false;
    for (const part of parts) {
      const v = evaluate(part);
      if (v === null) {
        previous = null;
        continue;
      }
      const inputs = (part.match(NUMBER) ?? []).map(value);
      const inputsKnown = inputs.every(
        (x) => given(x) || known.some((k) => close(k, x)) || proved.has(x),
      );
      if (previous !== null && inputsOk && close(previous, v)) {
        for (const x of inputs) proved.add(x);
        results.push(v);
      }
      if (inputsKnown) inputsOk = true;
      previous = v;
    }
  }
  const numbers: NumberCheck[] = [];
  for (const raw of arithmetic.match(NUMBER) ?? []) {
    const v = value(raw);
    const status: NumberStatus = given(v)
      ? 'given'
      : known.some((k) => close(k, v)) || proved.has(v) || results.some((r) => close(r, v))
        ? 'checked'
        : 'unverified';
    numbers.push({ raw, value: v, status });
  }
  const status: NumberStatus = numbers.some((n) => n.status === 'unverified')
    ? 'unverified'
    : numbers.some((n) => n.status === 'checked')
      ? 'checked'
      : 'given';
  return { numbers, results, status };
}

/** Numbers of the learner's question (and the simulation context when it was shared). */
export function sourceNumbers(...texts: string[]): number[] {
  return texts.flatMap((t) => numbersIn(t));
}
