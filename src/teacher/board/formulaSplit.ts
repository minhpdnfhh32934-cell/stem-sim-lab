/**
 * Splits a long formula into lines at its top-level relations, the way a teacher writes an
 * equality chain on the board (item 3, "the AI Teacher uses the whole board"):
 *
 *   a = F/m
 *     = 10/2
 *     = 5 m/s²
 *
 * The first piece keeps its first relation ("a = F/m"); every later relation starts a new piece
 * ("= 10/2"). An implication arrow starts a new statement, so its own relation stays with it
 * ("F = ma", "⇒ a = F/m", "= 10/2").
 *
 * Conservative and pure: the pieces joined give back the formula exactly (`pieces.join('') ===
 * tex`, so nothing is ever changed, rounded or dropped), nothing inside braces, brackets,
 * `\left…\right`, `\begin…\end` or `\text{…}` is split, and a formula that is unbalanced or holds
 * something this reader does not follow (a `%` comment, a bare `&`) is returned whole. When in
 * doubt, it does not split.
 */

/** Relations written as commands where a chain may be broken. */
const RELATIONS = new Set([
  'approx',
  'le',
  'leq',
  'ge',
  'geq',
  'ne',
  'neq',
  'equiv',
  'Rightarrow',
  'Leftrightarrow',
  'Longrightarrow',
  'implies',
  'iff',
  'to',
  'rightarrow',
  'longrightarrow',
]);

/** Arrows that start a new statement (its own relation stays with it). */
const ARROWS = new Set([
  'Rightarrow',
  'Leftrightarrow',
  'Longrightarrow',
  'implies',
  'iff',
  'to',
  'rightarrow',
  'longrightarrow',
]);

/** Commands whose braced argument is text: read as a block, never looked into. */
const TEXT_COMMANDS = new Set([
  'text',
  'textrm',
  'textit',
  'textbf',
  'textsf',
  'texttt',
  'mathrm',
  'mathit',
  'mathbf',
  'mathsf',
  'mathtt',
  'operatorname',
  'mbox',
  'hbox',
]);

const COMMAND = /\\([a-zA-Z]+)/y;

/** Index just after the brace group opening at `open`, or -1 when it never closes. */
function afterGroup(tex: string, open: number): number {
  let depth = 0;
  for (let i = open; i < tex.length; i++) {
    const c = tex[i];
    if (c === '\\') {
      i++;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/** Index just after the delimiter that follows `\left` / `\right` (at `from`). */
function afterDelimiter(tex: string, from: number): number {
  let i = from;
  while (tex[i] === ' ') i++;
  if (tex[i] !== '\\') return Math.min(tex.length, i + 1);
  COMMAND.lastIndex = i;
  const m = COMMAND.exec(tex);
  return m ? i + m[0].length : Math.min(tex.length, i + 2);
}

/** The formula's pieces, one per line (one piece when it cannot or need not be split). */
export function splitFormula(tex: string): string[] {
  const whole = [tex];
  const cuts: number[] = [];
  let depth = 0;
  /** The current piece already holds its relation (a later one starts the next piece). */
  let hasRelation = false;
  const relation = (at: number, arrow: boolean) => {
    if (depth !== 0) return;
    if (hasRelation) {
      cuts.push(at);
      hasRelation = !arrow;
    } else hasRelation = true;
  };
  let i = 0;
  while (i < tex.length) {
    const c = tex[i];
    if (c === '\\') {
      COMMAND.lastIndex = i;
      const m = COMMAND.exec(tex);
      if (!m) {
        // A control symbol: "\{" and "\}" are brackets, the rest ("\,", "\ ", "\\") is skipped.
        const next = tex[i + 1];
        if (next === '{') depth++;
        else if (next === '}') depth--;
        if (depth < 0) return whole;
        i += 2;
        continue;
      }
      const name = m[1] ?? '';
      const end = i + m[0].length;
      if (name === 'left' || name === 'right') {
        depth += name === 'left' ? 1 : -1;
        if (depth < 0) return whole;
        i = afterDelimiter(tex, end);
        continue;
      }
      if (name === 'begin' || name === 'end') {
        depth += name === 'begin' ? 1 : -1;
        if (depth < 0) return whole;
        i = end;
        continue;
      }
      if (TEXT_COMMANDS.has(name)) {
        let j = end;
        while (tex[j] === ' ') j++;
        if (tex[j] === '{') {
          const after = afterGroup(tex, j);
          if (after < 0) return whole;
          i = after;
          continue;
        }
      }
      if (RELATIONS.has(name)) relation(i, ARROWS.has(name));
      i = end;
      continue;
    }
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') {
      depth--;
      if (depth < 0) return whole;
    } else if (c === '%' || (c === '&' && depth === 0)) {
      // A comment or an alignment outside an environment: not read further, left whole.
      return whole;
    } else if (c === '=') {
      // ":=", "<=", ">=", "!=" and "==" are one relation.
      const prev = tex[i - 1];
      const start = prev === ':' || prev === '<' || prev === '>' || prev === '!' ? i - 1 : i;
      relation(start, false);
      if (tex[i + 1] === '=') i++;
    }
    i++;
  }
  if (depth !== 0 || cuts.length === 0) return whole;
  const pieces: string[] = [];
  let from = 0;
  for (const at of cuts) {
    pieces.push(tex.slice(from, at));
    from = at;
  }
  pieces.push(tex.slice(from));
  // Never a piece that writes nothing (a relation alone is still something to write).
  return pieces.every((p) => p.trim() !== '') ? pieces : whole;
}
