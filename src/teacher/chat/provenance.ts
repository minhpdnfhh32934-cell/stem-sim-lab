/**
 * Where the numbers of an AI answer come from (MASTER_PROMPT §2: every number from deterministic
 * code). The AI Teacher's answers are free text, so the app cannot stop a model from writing a
 * number; it can show which ones nobody gave it. In the 2026-10-13 evaluation Gemma 1B answered
 * "Tính quãng đường ô tô đi được." (no data) with "khoảng 50 km".
 *
 * A number counts as given when it appears in the question, the conversation (the learner's turns,
 * also in words: "hai giờ"; the app's results; earlier answers' numbers that were checked and not
 * flagged), the excerpt sent with the question or the shared screen; rounding within 1 % is the same
 * number. Everything else that looks like a value is listed under the answer by the app (SimLab),
 * as "chưa kiểm chứng" — unverified, not wrong.
 *
 * The board (board/provenance.ts) answers a different question, so one number may get a ✓ there
 * and be listed here (review 2 asked to share one notion or say exactly why not):
 * - Board ✓ "checked" = the arithmetic written on that line is right ("a = 10/2 = 5": 10 ÷ 2 is
 *   5). It says nothing about the formula. Gemma 1B wrote "1 × 3³ = 27" for the cells after 3
 *   mitoses (B5, 2026-10-13; the answer is 2³ = 8): right arithmetic, wrong formula, ✓ on the board.
 *   Counting such results as given here would hide exactly that mistake, so they stay listed.
 * - Board "given" also covers standard values (9,8 / 10 / 3,6 / 60 / 1000…) and whole numbers 0–10,
 *   because the board marks every number it writes, counts and coefficients included. Here only
 *   stated values are listed, and a stated value with a unit is listed even when it is such a
 *   number: an invented "60 km/h" for a problem without data (P5) must not pass as given.
 * - The board reads only the question; this check also reads the conversation, the excerpt and the
 *   screen.
 * The chip's hint (chat.unverifiedHint) says that a ✓ calculation can still use a wrong formula.
 *
 * What looks like a value: a number with a unit ("50 km", "10N"), after "=", "≈", "khoảng", after
 * "là"/"bằng"/"is"/"equals" at the end of a sentence ("Số tế bào con là 6."), a decimal, a power of
 * ten, or a whole number above 10. Not: list and step numbers ("1.", "Bước 2"), small counts
 * ("2 tế bào con", "là 2 bước"), formula parts ("H2O", "x²", "2π", "1/2 mv²") and 0.
 */
import { numbersIn } from '@/ai/numbers';
import { numberWordValues } from './numberWords';

const SUPERSCRIPTS: Record<string, string> = {
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
  '⁻': '-',
};

/**
 * Tags (TeachScript, HTML) only: "<write id=…>", "</write>", "<box …/>". A "<" in the text ("pH < 7",
 * "a < b") is not a tag, nor is what follows it up to the next ">" ("->").
 */
const TAG = /<\/?[a-zA-Z][\w-]*(?:\s[^<>]*)?\/?>/g;

/**
 * The answer as plain text: no tags (TeachScript, HTML), LaTeX commands, markdown marks or
 * superscripts ("x²" → "x^2"); line breaks are kept (they mark list items).
 */
export function plainAnswer(text: string): string {
  return text
    .normalize('NFC')
    .replace(TAG, ' ')
    .replace(/\\(?:d|t)?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1)/($2)')
    .replace(/\\(?:text|mathrm|mathbf|operatorname)\s*\{([^{}]*)\}/g, ' $1')
    .replace(/\\(?:cdot|times)/g, '×')
    .replace(/\\approx/g, '≈')
    .replace(/\\[a-zA-Z]+|\\[,;:! ]/g, ' ')
    .replace(/[{}$`]|\*\*|__/g, ' ')
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (s) => `^${s.replace(/./gu, (c) => SUPERSCRIPTS[c] ?? c)}`)
    .replace(/[−–—]/g, '-')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/[ \t]+/g, ' ');
}

/** Units and measure words a value may carry (longest first). */
const UNITS = [
  'm/s^2',
  'm/s2',
  'm/s',
  'km/h',
  'km/giờ',
  'g/mol',
  'mol/l',
  'mol/L',
  'N/m',
  'J/kg',
  'kJ/mol',
  'kWh',
  'kW',
  'MW',
  'mW',
  'kJ',
  'kcal',
  'cal',
  'MeV',
  'keV',
  'eV',
  'kV',
  'mV',
  'mA',
  'kΩ',
  'Ω',
  'ohm',
  'kHz',
  'MHz',
  'Hz',
  'kPa',
  'Pa',
  'atm',
  'mmHg',
  'bar',
  '°C',
  '°F',
  '°',
  'mmol',
  'mol',
  'ml',
  'mL',
  'lít',
  'dm^3',
  'cm^3',
  'm^3',
  'cm^2',
  'm^2',
  'km',
  'cm',
  'mm',
  'nm',
  'µm',
  'μm',
  'dm',
  'kg',
  'mg',
  'tấn',
  'giây',
  'phút',
  'giờ',
  'ngày',
  'năm',
  'độ',
  'vòng',
  'rad',
  'ms',
  'min',
  'Wb',
  'kN',
  'µF',
  'μF',
  'µC',
  'μC',
  'nC',
  'seconds',
  'second',
  'minutes',
  'hours',
  'metres',
  'meters',
  'grams',
  'kilograms',
  'newtons',
  'joules',
  'watts',
  'volts',
  'amperes',
  'moles',
  'litres',
  'liters',
  'percent',
  'degrees',
  '%',
  'W',
  'J',
  'V',
  'A',
  'N',
  'K',
  'M',
  'L',
  'l',
  'g',
  'm',
  's',
  'h',
  'C',
  'F',
  'T',
  'H',
] as const;

/** Text right before a value that makes it a stated result. */
const MARKER =
  /(?:=|≈|≃|≅|~|\bkhoảng|\bxấp xỉ|\bchừng|\bgần|\bapproximately|\babout|\baround|\broughly)\s*[-+]?\s*\(?\s*$/iu;
/**
 * "là 5", "bằng 6", "is 5", "equals 7": a stated result when the sentence ends there (or a unit
 * follows); in "là 2 bước" the number is a count.
 */
const WORD_MARKER = /(?:^|[\s,;:(])(?:là|bằng|is|equals|equal to)\s*[-+]?\s*$/iu;
const SENTENCE_END = /^\s*(?:[.,;:!?)\]]|$)/u;
/** Labels before a list or step number ("Bước 2", "Step 3", "câu 1", "lần thứ 2"). */
const STEP_LABEL =
  /\b(?:bước|step|câu|ý|phần|cách|ví dụ|example|part|question|stage|phase|giai đoạn|thứ|mục|bài|trường hợp|case|option|lựa chọn)\s*$/iu;

/** "m/s^2" → "m/s²": a listed number is shown the way it was written. */
function display(text: string): string {
  const sup = Object.fromEntries(Object.entries(SUPERSCRIPTS).map(([k, v]) => [v, k]));
  return text.replace(/\^(-?\d+)/g, (_, d: string) => d.replace(/./g, (c) => sup[c] ?? c));
}

interface Mention {
  /** As written, with its unit: "50 km". */
  text: string;
  values: number[];
}

function unitAfter(rest: string): string | null {
  const m = /^ ?/.exec(rest);
  const tail = rest.slice(m?.[0].length ?? 0);
  for (const unit of UNITS) {
    if (!tail.startsWith(unit)) continue;
    const next = tail.slice(unit.length, unit.length + 1);
    if (next && /[\p{L}\p{N}]/u.test(next)) continue;
    return unit;
  }
  return null;
}

/** "3.10^8", "1,6 × 10^-19", "10^-14" (after plainAnswer). */
const POWERS = /(?:(\d+(?:[.,]\d+)?)\s*[.×x*·]\s*)?10\s*\^\s*\(?\s*(-?\d+)\s*\)?/gu;
/** "12", "0,5", "1.200", "200 000". */
const NUMBER = /\d+(?:[.,]\d+)*(?: \d{3}(?!\d))*/gu;

/** Numbers of an answer that state a value (see the file comment). */
export function answerNumbers(answer: string): Mention[] {
  const text = plainAnswer(answer);
  const out: Mention[] = [];
  const taken: [number, number][] = [];
  const isTaken = (i: number) => taken.some(([a, b]) => i >= a && i < b);

  // Powers of ten first: "3.10^8", "1,6 × 10^-19", "10^-14".
  for (const m of text.matchAll(POWERS)) {
    const start = m.index;
    if (start > 0 && /[\p{L}\d^]/u.test(text[start - 1] ?? '')) continue;
    const exp = Number(m[2]);
    const mantissa = m[1] ? numbersIn(m[1]) : [1];
    const end = start + m[0].length;
    taken.push([start, end]);
    const unit = unitAfter(text.slice(end));
    out.push({
      text: display(`${m[0].trim()}${unit ? ` ${unit}` : ''}`),
      values: mantissa.map((v) => v * 10 ** exp),
    });
  }
  // Small fractions are formula coefficients: "1/2 mv²", "3/4".
  for (const m of text.matchAll(/(?<![\p{L}\p{N}.,])(\d{1,2})\s*\/\s*(\d{1,2})(?![\d.,])/gu)) {
    if (Number(m[1]) <= 10 && Number(m[2]) <= 10) taken.push([m.index, m.index + m[0].length]);
  }

  for (const m of text.matchAll(NUMBER)) {
    const start = m.index;
    const token = m[0];
    if (isTaken(start)) continue;
    const before = text.slice(0, start);
    const prev = before.slice(-1);
    // A part of a word or formula: "H2O", "x^2", "v_0", "Fe2O3", "2n".
    if (/[\p{L}_^]/u.test(prev)) continue;
    const rest = text.slice(start + token.length);
    const unit = unitAfter(rest);
    if (!unit && /^\p{L}/u.test(rest)) continue;
    // A list or step number: "1. …", "2) …" at the start of a line, "Bước 2".
    const line = before.slice(before.lastIndexOf('\n') + 1);
    if (/^[\s>*#\-•+]*$/u.test(line) && /^[.)]\s/.test(rest)) continue;
    if (STEP_LABEL.test(before)) continue;
    const values = numbersIn(token);
    if (values.every((v) => v === 0)) continue;
    const decimal = /[.,]/.test(token);
    // After "=" but followed by an operator, it is an operand ("= 1 × 3³ = 27"): the result is
    // the value after the last "=".
    const stated =
      (MARKER.test(before) && !/^\s*[*×·/+^]/u.test(rest)) ||
      (WORD_MARKER.test(before) && (unit !== null || SENTENCE_END.test(rest)));
    const large = values.some((v) => v > 10);
    if (!unit && !stated && !decimal && !large) continue;
    out.push({ text: display(unit ? `${token} ${unit}` : token), values });
  }
  return out;
}

/**
 * Every number written in the given texts, all readings ("1.200" is 1200 and 1.2), powers of ten
 * as values. Exponents and formula indices are not numbers someone gave: "m/s²" does not give 2.
 * `words`: the texts were written by the learner, whose number words count too ("hai giờ" gives 2);
 * the AI's own prose never gives a number this way.
 */
export function contextNumbers(
  texts: readonly string[],
  options: { words?: boolean } = {},
): number[] {
  const out: number[] = [];
  for (const raw of texts) {
    if (options.words) out.push(...numberWordValues(raw));
    const text = plainAnswer(raw);
    const taken: [number, number][] = [];
    for (const m of text.matchAll(POWERS)) {
      if (m.index > 0 && /[\p{L}\d^]/u.test(text[m.index - 1] ?? '')) continue;
      taken.push([m.index, m.index + m[0].length]);
      const exp = Number(m[2]);
      for (const v of m[1] ? numbersIn(m[1]) : [1]) out.push(v * 10 ** exp);
    }
    for (const m of text.matchAll(NUMBER)) {
      if (taken.some(([a, b]) => m.index >= a && m.index < b)) continue;
      if (/[\p{L}_^]/u.test(text[m.index - 1] ?? '')) continue;
      out.push(...numbersIn(m[0]));
    }
  }
  return out;
}

/** Same number, rounding included (1 %), as in src/ai/explain.ts. */
export function sameNumber(a: number, b: number): boolean {
  return Math.abs(a - b) <= 0.01 * Math.max(Math.abs(a), Math.abs(b), 1e-12);
}

/** How many unverified numbers the chip shows (it stays one line or two); the record keeps all. */
export const MAX_LISTED = 6;

/** The chip's part of a list: the first MAX_LISTED values and how many more there are. */
export function chipNumbers(list: readonly string[]): { shown: string[]; more: number } {
  return { shown: list.slice(0, MAX_LISTED), more: Math.max(0, list.length - MAX_LISTED) };
}

/**
 * The answer's stated values that match no number in `allowed`, as written ("50 km"), without
 * repeats. All of them: the record keeps the full list (a value left out would count as given in
 * later turns); only the chip shortens it (`chipNumbers`).
 */
export function unverifiedNumbers(answer: string, allowed: readonly number[]): string[] {
  const out: string[] = [];
  for (const mention of answerNumbers(answer)) {
    const given = mention.values.some((v) => allowed.some((a) => sameNumber(a, v)));
    if (!given && !out.includes(mention.text)) out.push(mention.text);
  }
  return out;
}
