/**
 * Facts the app computes for the AI Teacher (CLAUDE.md: "numbers only from deterministic tools").
 *
 * The 2026-10-13 benchmark asked Gemma 1B to balance H2 + O2 → H2O: it explained moles instead
 * and never gave the coefficients. When a question contains a chemical equation, SimLab's exact
 * balancer (src/chemistry/balance.ts, null-space method) solves it first and the AI only explains
 * that result. Nothing here is guessed: an equation the balancer cannot read or solve is reported
 * as such, never "fixed" silently.
 */
import type { Locale } from '@/app/i18n';
import { balance, EquationError, parseEquation, type ParsedEquation } from '@/chemistry/balance';

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

/** Candidate equations: formulas joined by " + " on each side of an arrow (or "="). */
const EQUATION =
  /((?:\d*[A-Z][A-Za-z0-9₀-₉()]*)(?:\s*\+\s*\d*[A-Z][A-Za-z0-9₀-₉()]*)*)\s*(→|⟶|->|=>|⇌|<=>|=)\s*((?:\d*[A-Z][A-Za-z0-9₀-₉()]*)(?:\s*\+\s*\d*[A-Z][A-Za-z0-9₀-₉()]*)*)/g;

/** The question is about a reaction (so "F = m·a" is never read as one). */
const CHEMISTRY_WORDS =
  /cân bằng|phương trình|phản ứng|hệ số|balance|equation|reaction|coefficient/i;

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
  /** One sentence for the AI and for the learner. */
  text: string;
}

const TEXT = {
  vi: {
    balanced: (eq: string, coef: string) =>
      `Phương trình đã cân bằng (SimLab tính bằng bộ cân bằng chính xác, không phải AI): ${eq}. Hệ số theo thứ tự: ${coef}.`,
    impossible: (input: string) =>
      `SimLab không cân bằng được "${input}" (không có bộ hệ số dương nào bảo toàn mọi nguyên tố): có thể đề viết sai công thức. Không tự đoán hệ số.`,
    ambiguous: (input: string) =>
      `"${input}" có nhiều cách cân bằng độc lập (thiếu thông tin): hãy hỏi lại học sinh, không tự chọn hệ số.`,
    unread: (input: string) =>
      `SimLab chưa đọc được phương trình "${input}": hãy hỏi lại học sinh cách viết công thức, không tự đoán.`,
  },
  en: {
    balanced: (eq: string, coef: string) =>
      `Balanced equation (computed by SimLab's exact balancer, not by the AI): ${eq}. Coefficients in order: ${coef}.`,
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
  if (!CHEMISTRY_WORDS.test(question) && !/→|⟶|->|⇌/.test(question)) return [];
  const t = TEXT[locale];
  const facts: ToolFact[] = [];
  for (const m of question.matchAll(EQUATION)) {
    const input = m[0].trim();
    // "a = F/m" and similar: an equation needs a formula with a capital letter on both sides
    // and at least one side with two elements or a subscript.
    if (!/[A-Z].*[A-Z]|[A-Z][a-z]?\d|[₀-₉]/.test(input)) continue;
    const text = plainDigits(`${m[1] ?? ''} ${m[2] === '=' ? '=' : '→'} ${m[3] ?? ''}`)
      .replace(/\s*\+\s*/g, ' + ')
      .replace(/\b\d+(?=[A-Z])/g, '');
    try {
      const eq = parseEquation(text);
      const result = balance(eq);
      if (result.kind === 'balanced') {
        facts.push({
          kind: 'balanced',
          input,
          text: t.balanced(formatted(eq, result.coefficients), result.coefficients.join(', ')),
        });
      } else {
        facts.push({
          kind: 'unbalanceable',
          input,
          text: result.kind === 'impossible' ? t.impossible(input) : t.ambiguous(input),
        });
      }
    } catch (e) {
      if (!(e instanceof EquationError)) throw e;
      facts.push({ kind: 'unbalanceable', input, text: t.unread(input) });
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
