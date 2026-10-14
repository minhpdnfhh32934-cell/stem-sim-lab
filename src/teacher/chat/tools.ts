/**
 * Facts the app computes for the AI Teacher (CLAUDE.md: "numbers only from deterministic tools").
 *
 * The 2026-10-13 benchmark asked Gemma 1B to balance H2 + O2 → H2O: it explained moles instead
 * and never gave the coefficients. When a question contains a chemical equation, SimLab's exact
 * balancer (src/chemistry/balance.ts, null-space method) solves it first and the AI only explains
 * that result. Nothing here is guessed: an equation the balancer cannot read or solve is reported
 * as such, never "fixed" silently.
 *
 * These facts are shown as exact results, so a false positive is worse than no fact (audit G3:
 * "F = 10N" with "hệ số ma sát" was reported as an unbalanceable reaction of fluorine and
 * nitrogen). A question is read only when it really asks about a reaction, and only species that
 * the formula parser accepts are ever balanced.
 */
import { translate, type Locale } from '@/app/i18n';
import { balance, EquationError, parseEquation, type ParsedEquation } from '@/chemistry/balance';
import { FormulaError, parseFormula } from '@/chemistry/formula';

const SUBSCRIPTS: Record<string, string> = {
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

/** "H₂ + O₂ → H₂O" → "H2 + O2 → H2O" (the balancer reads plain digits). */
function plainDigits(s: string): string {
  return s.replace(/[₀-₉]/g, (d) => SUBSCRIPTS[d] ?? d);
}

/** Arrows the balancer reads (src/chemistry/balance.ts), longest first. */
const ARROW = String.raw`<=>|<->|⇌|→|⟶|->|=>`;
/** Element symbols, counts and brackets: "Ca(OH)2", "H₂O". */
const FORMULA = String.raw`[A-Z(\[][A-Za-z0-9₀-₉()\[\]]*`;
/**
 * One species: optional coefficient, a formula, hydrate parts after "·", "•", "*" (spaces
 * allowed) or "." (only when a formula follows: "CuSO4.5H2O", not "Al2O3. Tính"), never the
 * start of a longer word.
 */
const TERM = String.raw`\d*${FORMULA}(?:(?:\s*[·•*]\s*|\.(?=\d*[A-Z(]))\d*${FORMULA})*(?![\p{L}\p{N}])`;
const SIDE = String.raw`${TERM}(?:\s*\+\s*${TERM})*`;

/**
 * Candidate equations: species joined by "+" on each side of one arrow ("=" only when the
 * learner asks to balance). A step of a chain "A → B → C" is not a candidate, and neither is a
 * part of a longer token ("R1/R2 = R3/R4").
 */
function equationPattern(withEquals: boolean): RegExp {
  const sep = withEquals ? `${ARROW}|=` : ARROW;
  return new RegExp(
    String.raw`(?<![\p{L}\p{N}/.,^(\[_])(?<!(?:${ARROW}|=|\+|[·•*])\s*)(${SIDE})\s*(${sep})\s*(${SIDE})(?!\s*(?:${ARROW}|=|\+))`,
    'gu',
  );
}
const EQUATION_ARROW = equationPattern(false);
const EQUATION_ANY = equationPattern(true);

/** The learner asks for a balance: every result (also "cannot balance") is reported. */
const BALANCE_REQUEST = /cân bằng|balanc/i;
/** A reaction is named: with an arrow, a balanced equation is reported (nothing else). */
const REACTION_WORDS = /phản ứng|pthh|phương trình (?:hóa|hoá) học|reaction|chemical equation/i;
const HAS_ARROW = new RegExp(ARROW);

/** "10N", "220V", "5N": a number with a unit, never a coefficient and an element. */
const UNIT_LIKE = /^\d+[A-Z]$/;
/** "F1", "P1" style names: chemistry never writes a count of 1. */
const COUNT_ONE = /[A-Za-z)\]]1(?!\d)/;
/** At least one species looks like a formula: two elements, a count or brackets. */
const CHEMICAL = /[A-Z].*[A-Z]|[A-Z][a-z]?\d|[([]/;

/** Splits one side into formulas without coefficients, or null when one is not a formula. */
function species(side: string, sep: string): string[] | null {
  const out: string[] = [];
  for (const raw of side.split(/\s*\+\s*/)) {
    const term = raw.trim().replace(/\s*([·•*])\s*/g, '$1');
    const m = /^(\d*)(.*)$/.exec(term);
    const coefficient = m?.[1] ?? '';
    const body = m?.[2] ?? '';
    // "F = 10N": with "=" any number + one capital is a quantity; a two-digit coefficient on a
    // lone atom is not chemistry either.
    if (UNIT_LIKE.test(term) && (sep === '=' || coefficient.length > 1)) return null;
    if (!body || COUNT_ONE.test(body)) return null;
    try {
      parseFormula(body);
    } catch (e) {
      if (e instanceof FormulaError) return null;
      throw e;
    }
    out.push(body);
  }
  return out;
}

function formatted(eq: ParsedEquation, coefficients: number[]): string {
  const all = [...eq.reactants, ...eq.products];
  const term = (i: number) => {
    const c = coefficients[i] ?? 1;
    return `${c === 1 ? '' : String(c)}${all[i]?.text ?? ''}`;
  };
  const left = eq.reactants.map((_, i) => term(i)).join(' + ');
  const right = eq.products.map((_, i) => term(eq.reactants.length + i)).join(' + ');
  return `${left} ${eq.reversible ? '⇌' : '→'} ${right}`;
}

export interface ToolFact {
  kind: 'balanced' | 'unbalanceable';
  /** The equation as the learner wrote it. */
  input: string;
  /** One sentence for the AI (with what it must not do). */
  text: string;
  /** What the learner sees, as computed by the app (shown next to the answer, not by the AI). */
  shown: string;
}

/**
 * Sentences for the AI (prompt text, like the system prompts in chatService.ts). The balanced
 * result is introduced as a result, not as "Phương trình đã cân bằng": Gemma 1B read that as
 * "the equation is already balanced" and wrote "Phương trình đã được cân đều rồi" (2026-10-13).
 */
const TEXT = {
  vi: {
    balanced: (eq: string, coef: string) =>
      `Kết quả cân bằng (SimLab tính bằng bộ cân bằng chính xác, không phải AI): ${eq}. Hệ số theo thứ tự: ${coef}.`,
    impossible: (input: string) =>
      `SimLab không cân bằng được "${input}" (không có bộ hệ số dương nào bảo toàn mọi nguyên tố): có thể đề viết sai công thức. Không tự đoán hệ số.`,
    ambiguous: (input: string) =>
      `"${input}" có nhiều cách cân bằng độc lập (thiếu thông tin): hãy hỏi lại học sinh, không tự chọn hệ số.`,
    unread: (input: string) =>
      `SimLab chưa đọc được phương trình "${input}": hãy hỏi lại học sinh cách viết công thức, không tự đoán.`,
  },
  en: {
    balanced: (eq: string, coef: string) =>
      `Balancing result (computed by SimLab's exact balancer, not by the AI): ${eq}. Coefficients in order: ${coef}.`,
    impossible: (input: string) =>
      `SimLab cannot balance "${input}" (no positive coefficients conserve every element): a formula may be wrong. Do not guess coefficients.`,
    ambiguous: (input: string) =>
      `"${input}" can be balanced in several independent ways (missing information): ask the learner, do not pick coefficients.`,
    unread: (input: string) =>
      `SimLab could not read the equation "${input}": ask the learner how the formulas are written, do not guess.`,
  },
} as const;

/** Chemical equations in the question, solved by the app (empty when there is none). */
export function toolFacts(question: string, locale: Locale): ToolFact[] {
  // Precipitate/gas marks are not part of a formula: "CaCO3↓" is CaCO3.
  const q = question.normalize('NFC').replace(/\s*[↑↓]/g, '');
  const request = BALANCE_REQUEST.test(q);
  if (!request && !(HAS_ARROW.test(q) && REACTION_WORDS.test(q))) return [];
  const t = TEXT[locale];
  const unbalanced = (input: string, text: string): ToolFact => ({
    kind: 'unbalanceable',
    input,
    text,
    shown: translate(locale, 'chat.facts.unbalanced', { input }),
  });
  const facts: ToolFact[] = [];
  for (const m of q.matchAll(request ? EQUATION_ANY : EQUATION_ARROW)) {
    const input = m[0].trim();
    const sep = m[2] ?? '';
    // "P = UI", "Q = It": a chemical equation written with "=" has at least three species.
    if (sep === '=' && !input.includes('+')) continue;
    const left = species(plainDigits(m[1] ?? ''), sep);
    const right = species(plainDigits(m[3] ?? ''), sep);
    if (!left || !right || ![...left, ...right].some((s) => CHEMICAL.test(s))) continue;
    let eq: ParsedEquation;
    try {
      eq = parseEquation(`${left.join(' + ')} ${sep} ${right.join(' + ')}`);
    } catch (e) {
      if (!(e instanceof EquationError)) throw e;
      if (request && sep !== '=') facts.push(unbalanced(input, t.unread(input)));
      continue;
    }
    const result = balance(eq);
    if (result.kind === 'balanced') {
      const equation = formatted(eq, result.coefficients);
      facts.push({
        kind: 'balanced',
        input,
        text: t.balanced(equation, result.coefficients.join(', ')),
        shown: translate(locale, 'chat.facts.balanced', { equation }),
      });
    } else if (request && sep !== '=') {
      // Only a learner who asked to balance hears "cannot balance": a reaction merely named
      // in a question may be written incompletely on purpose. With "=" the line may be physics
      // ("Thanh AB cân bằng: NB + NC = P"), so only a real balance counts there.
      facts.push(
        unbalanced(input, result.kind === 'impossible' ? t.impossible(input) : t.ambiguous(input)),
      );
    }
    if (facts.length >= 3) break;
  }
  return facts;
}

const HEADER: Record<Locale, string> = {
  vi: 'KẾT QUẢ DO SIMLAB TÍNH (dùng đúng các kết quả này, không tự tính lại hay đổi số):',
  en: 'RESULTS COMPUTED BY SIMLAB (use exactly these results, do not recompute or change numbers):',
};

/** The block appended to the instruction, or '' when the question needs no tool. */
export function toolBlock(question: string, locale: Locale): string {
  const facts = toolFacts(question, locale);
  return facts.length ? `\n\n${HEADER[locale]}\n${facts.map((f) => `- ${f.text}`).join('\n')}` : '';
}
