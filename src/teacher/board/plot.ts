/**
 * `<plot fn="…" domain="a..b">`: the curve is computed here, never drawn from numbers the AI
 * typed. A small, safe expression reader (no `eval`): x, + − × ÷ ^, brackets, implicit
 * products ("2x", "3(x+1)"), sin cos tan sqrt exp ln log abs, pi and e.
 */

type Fn = (x: number) => number;

const FUNCS: Record<string, (v: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  sqrt: Math.sqrt,
  exp: Math.exp,
  ln: Math.log,
  log: Math.log10,
  abs: Math.abs,
};

type Tok =
  | { t: 'num'; v: number }
  | { t: 'x' }
  | { t: 'const'; v: number }
  | { t: 'fn'; name: string }
  | { t: 'op'; v: string }
  | { t: '(' }
  | { t: ')' };

function lex(src: string): Tok[] | null {
  const s = src
    .replace(/\s+/g, '')
    .replace(/[×·⋅∙]/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/\*\*/g, '^');
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const rest = s.slice(i);
    const num = /^\d+(?:[.,]\d+)?/.exec(rest);
    if (num) {
      out.push({ t: 'num', v: Number(num[0].replace(',', '.')) });
      i += num[0].length;
      continue;
    }
    const word = /^[a-z]+/i.exec(rest);
    if (word) {
      const w = word[0].toLowerCase();
      if (w === 'x') out.push({ t: 'x' });
      else if (w === 'pi') out.push({ t: 'const', v: Math.PI });
      else if (w === 'e') out.push({ t: 'const', v: Math.E });
      else if (w in FUNCS) out.push({ t: 'fn', name: w });
      else return null;
      i += w.length;
      continue;
    }
    const c = s[i] ?? '';
    if ('+-*/^'.includes(c)) out.push({ t: 'op', v: c });
    else if (c === '(') out.push({ t: '(' });
    else if (c === ')') out.push({ t: ')' });
    else return null;
    i++;
  }
  // Implicit products: "2x", "2(", ")(", "x(", "2sin".
  const withProducts: Tok[] = [];
  for (const tok of out) {
    const prev = withProducts[withProducts.length - 1];
    const prevEnds =
      prev && (prev.t === 'num' || prev.t === 'x' || prev.t === 'const' || prev.t === ')');
    const starts =
      tok.t === 'num' || tok.t === 'x' || tok.t === 'const' || tok.t === 'fn' || tok.t === '(';
    if (prevEnds && starts) withProducts.push({ t: 'op', v: '*' });
    withProducts.push(tok);
  }
  return withProducts;
}

/** Compiles `fn` into a function of x; null when it is not a plain formula in x. */
export function compileFn(src: string): Fn | null {
  if (src.length > 200) return null;
  const toks = lex(src);
  if (!toks || toks.length === 0) return null;
  let i = 0;
  const peek = () => toks[i];
  const expr = (): Fn | null => {
    let left = term();
    while (left) {
      const p = peek();
      if (!(p?.t === 'op' && (p.v === '+' || p.v === '-'))) break;
      i++;
      const right = term();
      if (!right) return null;
      const l = left;
      left = p.v === '+' ? (x) => l(x) + right(x) : (x) => l(x) - right(x);
    }
    return left;
  };
  const term = (): Fn | null => {
    let left = unary();
    while (left) {
      const p = peek();
      if (!(p?.t === 'op' && (p.v === '*' || p.v === '/'))) break;
      i++;
      const right = unary();
      if (!right) return null;
      const l = left;
      left = p.v === '*' ? (x) => l(x) * right(x) : (x) => l(x) / right(x);
    }
    return left;
  };
  const unary = (): Fn | null => {
    const p = peek();
    if (p?.t === 'op' && p.v === '-') {
      i++;
      const v = unary();
      return v ? (x) => -v(x) : null;
    }
    return power();
  };
  const power = (): Fn | null => {
    const base = atom();
    if (!base) return null;
    const p = peek();
    if (p?.t === 'op' && p.v === '^') {
      i++;
      const exp = unary();
      return exp ? (x) => base(x) ** exp(x) : null;
    }
    return base;
  };
  const atom = (): Fn | null => {
    const p = peek();
    if (!p) return null;
    i++;
    if (p.t === 'num' || p.t === 'const') {
      const v = p.v;
      return () => v;
    }
    if (p.t === 'x') return (x) => x;
    if (p.t === '(') {
      const v = expr();
      if (peek()?.t !== ')') return null;
      i++;
      return v;
    }
    if (p.t === 'fn') {
      const f = FUNCS[p.name];
      if (!f || peek()?.t !== '(') return null;
      const arg = atom();
      return arg ? (x) => f(arg(x)) : null;
    }
    return null;
  };
  const fn = expr();
  return fn && i === toks.length ? fn : null;
}

export interface Series {
  points: [number, number][];
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** Samples the curve (gaps where it is undefined); null when the formula cannot be read. */
export function sample(src: string, domain: [number, number], n = 160): Series | null {
  const f = compileFn(src);
  if (!f) return null;
  const [a, b] = domain;
  const points: [number, number][] = [];
  for (let k = 0; k <= n; k++) {
    const x = a + ((b - a) * k) / n;
    const y = f(x);
    if (Number.isFinite(y) && Math.abs(y) < 1e9) points.push([x, y]);
  }
  if (points.length < 2) return null;
  const ys = points.map((p) => p[1]);
  let yMin = Math.min(...ys, 0);
  let yMax = Math.max(...ys, 0);
  if (yMax - yMin < 1e-9) {
    yMin -= 1;
    yMax += 1;
  }
  return { points, xMin: a, xMax: b, yMin, yMax };
}
