/**
 * A small arithmetic expression, as a worked example checks its formulas against the model with
 * (Phase Y-3): numbers (1.5, 2e-3), + − × ÷ and ^ (also written *, /, ·, −), parentheses, names
 * (an input by its id, a model prediction as `@id`) and the functions sqrt, cbrt, ln, log (base
 * 10), exp, abs, round, sin, cos, tan (radians), asin, acos, atan, rad (degrees to radians), deg, min,
 * max, pow, and the constant pi. Pure; a plain Error says what it cannot read.
 */
export function evaluate(expr: string, value: (name: string) => number | undefined): number {
  const parser = new Parser(expr, value);
  const result = parser.expression();
  parser.end();
  return result;
}

/** The names an expression reads (inputs, and predictions with their `@`). */
export function namesIn(expr: string): string[] {
  const names: string[] = [];
  try {
    evaluate(expr, (name) => {
      names.push(name);
      return 1;
    });
  } catch {
    // Unreadable: `evaluate` says why where it is checked.
  }
  return names;
}

const FUNCTIONS: Readonly<Record<string, (...args: number[]) => number>> = {
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
  abs: Math.abs,
  round: Math.round,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  rad: (d) => (d * Math.PI) / 180,
  deg: (r) => (r * 180) / Math.PI,
  min: Math.min,
  max: Math.max,
  pow: Math.pow,
};
const ARITY: Readonly<Record<string, number>> = { min: 2, max: 2, pow: 2 };

class Parser {
  private at = 0;
  private readonly text: string;

  constructor(
    text: string,
    private readonly value: (name: string) => number | undefined,
  ) {
    this.text = text.replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  }

  expression(): number {
    let left = this.term();
    for (;;) {
      if (this.take('+')) left += this.term();
      else if (this.take('-')) left -= this.term();
      else return left;
    }
  }

  end(): void {
    this.space();
    if (this.at < this.text.length) this.fail(`unexpected "${this.text.slice(this.at)}"`);
  }

  private term(): number {
    let left = this.unary();
    for (;;) {
      if (this.take('*')) left *= this.unary();
      else if (this.take('/')) left /= this.unary();
      else return left;
    }
  }

  private unary(): number {
    if (this.take('-')) return -this.unary();
    if (this.take('+')) return this.unary();
    const base = this.primary();
    return this.take('^') ? base ** this.unary() : base;
  }

  private primary(): number {
    this.space();
    if (this.take('(')) {
      const inner = this.expression();
      if (!this.take(')')) this.fail('missing ")"');
      return inner;
    }
    const number = /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i.exec(this.text.slice(this.at));
    if (number) {
      this.at += number[0].length;
      return Number(number[0]);
    }
    const name = /^@?[A-Za-z_][A-Za-z0-9_]*/.exec(this.text.slice(this.at));
    if (!name) this.fail(`expected a number or a name at "${this.text.slice(this.at)}"`);
    this.at += name[0].length;
    const id = name[0];
    if (this.take('(')) {
      const fn = FUNCTIONS[id];
      if (!fn) this.fail(`unknown function "${id}"`);
      const args = [this.expression()];
      while (this.take(',')) args.push(this.expression());
      if (!this.take(')')) this.fail(`missing ")" after ${id}(`);
      if (args.length !== (ARITY[id] ?? 1)) this.fail(`${id} takes ${ARITY[id] ?? 1} argument(s)`);
      return fn(...args);
    }
    if (id === 'pi') return Math.PI;
    const known = this.value(id);
    if (known === undefined) this.fail(`unknown name "${id}"`);
    return known;
  }

  private take(token: string): boolean {
    this.space();
    if (!this.text.startsWith(token, this.at)) return false;
    this.at += token.length;
    return true;
  }

  private space(): void {
    while (this.at < this.text.length && /\s/.test(this.text[this.at] ?? '')) this.at++;
  }

  private fail(message: string): never {
    throw new Error(`expression "${this.text}": ${message}`);
  }
}
