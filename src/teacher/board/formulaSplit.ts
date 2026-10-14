/**
 * Splits a long formula into lines the way a teacher writes it on the board (item 3, "the AI
 * Teacher uses the whole board"):
 *
 *   a = F/m              v₀ = 0,
 *     = 10/2             a = 2 m/s²,
 *     = 5 m/s²           t = 3 s
 *
 * An equality chain is cut before its later relations: the first piece keeps its first relation
 * ("a = F/m"), every later relation starts a piece that continues the chain ("= 10/2", written
 * indented). An implication arrow starts a new statement, so its own relation stays with it
 * ("F = ma", "⇒ a = F/m", "= 10/2"). A negated relation is cut before its `\not`, never after it
 * (`\not=` is "≠"; cut after the `\not`, the next line would read "="). A list of statements
 * ("v_0 = 0,\quad a = 2") is cut after each separator and the spacing after it, so every
 * statement keeps its name with its value: a top-level `,` or `;`, `\quad`, `\qquad`, or a word
 * written as text between statements (`\text{ và }`, or `\text{và}` set apart by spacing after
 * something that is not a number). A decimal comma (`9,81`) is not a separator, and nothing is
 * cut from the exponent or subscript after it.
 *
 * Conservative and pure: the pieces joined give back the formula exactly (`pieces.join('') ===
 * tex`, so nothing is ever changed, rounded or dropped), nothing inside braces, brackets,
 * `\left…\right`, `\begin…\end` or `\text{…}` is split, and a formula that is unbalanced or holds
 * something this reader does not follow (a `%` comment, a bare `&`) is returned whole. When in
 * doubt, it does not split. The pieces are only where a line may break: the layout puts several
 * on one line when they fit.
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

/** Text commands whose argument may be a word between two statements ("\text{ và }"). */
const PROSE_COMMANDS = new Set(['text', 'textrm', 'textit', 'textbf', 'textsf', 'mbox', 'hbox']);

/** Wide spaces that separate two statements of a list. */
const WIDE_SPACES = new Set(['quad', 'qquad']);

/** Control symbols that are spacing: `\,` `\;` `\:` `\!` `\ `. */
const SPACING_SYMBOLS = new Set([',', ';', ':', '!', ' ']);

const COMMAND = /\\([a-zA-Z]+)/y;
/** Whitespace and explicit spacing: they write nothing. */
const SPACING = /\\(?:q?quad(?![a-zA-Z])|[,;:! ])|[\s~]/g;

/** One piece of a split formula. */
export interface FormulaPiece {
  tex: string;
  /** It continues the chain of the piece before it (it starts with a relation): written indented. */
  continues: boolean;
}

const isDigit = (c: string | undefined) => c !== undefined && c >= '0' && c <= '9';

const isWhitespace = (c: string | undefined) => c === ' ' || c === '\t' || c === '\n' || c === '\r';

/** True when `s` writes something (more than spacing). */
function writes(s: string): boolean {
  return s.replace(SPACING, '') !== '';
}

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

/** Length of the explicit spacing at `at` (`\,` `\;` `\:` `\!` `\ ` `\quad` `\qquad` `~`), or 0. */
function spacingAt(tex: string, at: number): number {
  if (tex[at] === '~') return 1;
  if (tex[at] !== '\\') return 0;
  if (SPACING_SYMBOLS.has(tex[at + 1] ?? '')) return 2;
  COMMAND.lastIndex = at;
  const m = COMMAND.exec(tex);
  return m && WIDE_SPACES.has(m[1] ?? '') ? m[0].length : 0;
}

/** Index after the whitespace and explicit spacing that start at `from`. */
function afterSpacing(tex: string, from: number): number {
  let i = from;
  for (;;) {
    if (isWhitespace(tex[i])) {
      i++;
      continue;
    }
    const n = spacingAt(tex, i);
    if (n === 0) return i;
    i += n;
  }
}

/** The text at `at` starts with a relation (after whitespace): a chain goes on there. */
function opensWithRelation(tex: string, at: number): boolean {
  let i = at;
  while (isWhitespace(tex[i])) i++;
  const c = tex[i];
  if (c === '=') return true;
  if ((c === '<' || c === '>' || c === ':' || c === '!') && tex[i + 1] === '=') return true;
  if (c !== '\\') return false;
  COMMAND.lastIndex = i;
  const m = COMMAND.exec(tex);
  if (!m) return false;
  if (m[1] === 'not') return opensWithRelation(tex, i + m[0].length);
  return RELATIONS.has(m[1] ?? '');
}

/** The formula's pieces, one per possible line (one piece when it cannot or need not be split). */
export function formulaPieces(tex: string): FormulaPiece[] {
  const whole: FormulaPiece[] = [{ tex, continues: false }];
  const cuts: { at: number; continues: boolean }[] = [];
  let depth = 0;
  /** The current piece already holds its relation (a later one starts the next piece). */
  let hasRelation = false;
  /** Where the current piece starts. */
  let pieceStart = 0;
  /** Where a `\not` just read starts: it belongs to the relation it negates. */
  let negation: number | null = null;
  /** Explicit spacing came after the last thing written… */
  let spaced = false;
  /** …and the last character of that thing ("" for a command). */
  let last = '';

  const relation = (at: number, arrow: boolean) => {
    if (depth !== 0) return;
    if (hasRelation) {
      cuts.push({ at, continues: true });
      pieceStart = at;
      hasRelation = !arrow;
    } else hasRelation = true;
  };

  /**
   * A statement ends with the separator from `at` to `end`: the next one starts after the spacing
   * that follows. Never a cut that leaves nothing but the separator before it or nothing after
   * it, or that takes an exponent, a subscript or a prime away from what it belongs to. Returns
   * where reading goes on.
   */
  const statement = (at: number, end: number): number => {
    const next = afterSpacing(tex, end);
    const after = tex[next];
    const cut =
      writes(tex.slice(pieceStart, at)) &&
      writes(tex.slice(next)) &&
      after !== '^' &&
      after !== '_' &&
      after !== "'";
    if (cut) {
      cuts.push({ at: next, continues: opensWithRelation(tex, next) });
      pieceStart = next;
      hasRelation = false;
    }
    spaced = !cut && next > end;
    return next;
  };

  let i = 0;
  while (i < tex.length) {
    const c = tex[i];
    // Whitespace is ignored in a formula (a `\not` still applies across it).
    if (isWhitespace(c)) {
      i++;
      continue;
    }
    const negated = negation;
    negation = null;
    const wasSpaced = spaced;
    const before = last;
    const space = spacingAt(tex, i);
    if (space > 0) {
      if (depth === 0 && WIDE_SPACES.has(tex.slice(i + 1, i + space))) {
        // "\quad" between two statements of a list.
        last = '';
        i = statement(i, i + space);
      } else {
        spaced = true;
        i += space;
      }
      continue;
    }
    spaced = false;
    if (c === '\\') {
      COMMAND.lastIndex = i;
      const m = COMMAND.exec(tex);
      if (!m) {
        // A control symbol: "\{" and "\}" are brackets, the rest ("\\", "\%"…) is skipped.
        const next = tex[i + 1];
        if (next === '{') depth++;
        else if (next === '}') depth--;
        if (depth < 0) return whole;
        last = next ?? '';
        i += 2;
        continue;
      }
      const name = m[1] ?? '';
      const end = i + m[0].length;
      last = '';
      if (name === 'not') {
        negation = i;
        i = end;
        continue;
      }
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
          const content = tex.slice(j + 1, after - 1);
          // A word between two statements: "\text{ và }", or "\ \text{và}\ " after something
          // that is not a number (after a number it is the number's unit).
          const connective =
            depth === 0 &&
            PROSE_COMMANDS.has(name) &&
            content.trim() !== '' &&
            ((/^\s/.test(content) && /\s$/.test(content)) ||
              (wasSpaced && !isDigit(before) && spacingAt(tex, after) > 0));
          if (connective) {
            i = statement(i, after);
            continue;
          }
          last = '}';
          i = after;
          continue;
        }
      }
      if (RELATIONS.has(name)) relation(negated ?? i, ARROWS.has(name));
      i = end;
      continue;
    }
    last = c ?? '';
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
      relation(negated ?? start, false);
      if (tex[i + 1] === '=') i++;
    } else if (
      depth === 0 &&
      (c === ';' || (c === ',' && !(isDigit(tex[i - 1]) && isDigit(tex[i + 1]))))
    ) {
      // A separator between two statements (a comma between two digits is a decimal comma).
      i = statement(i, i + 1);
      continue;
    }
    i++;
  }
  if (depth !== 0 || cuts.length === 0) return whole;
  const pieces: FormulaPiece[] = [];
  let from = 0;
  let continues = false;
  for (const cut of cuts) {
    pieces.push({ tex: tex.slice(from, cut.at), continues });
    from = cut.at;
    continues = cut.continues;
  }
  pieces.push({ tex: tex.slice(from), continues });
  // Never a piece that writes nothing (a relation alone is still something to write).
  return pieces.every((p) => writes(p.tex)) ? pieces : whole;
}

/** The formula's pieces as text, one per possible line (see `formulaPieces`). */
export function splitFormula(tex: string): string[] {
  return formulaPieces(tex).map((p) => p.tex);
}
