/**
 * Finding numbers in Vietnamese problem text, used to enforce MASTER_PROMPT §2.1:
 * every value the AI extracts must literally appear in the problem.
 *
 * Handles decimal commas ("0,5"), thousands separators ("1.200" / "1 200"), unicode minus,
 * superscripts and scientific notation ("3.10^8", "3×10⁸", "1,6.10-19").
 */

const SUPER: Record<string, string> = {
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

export function normalizeText(s: string): string {
  return (
    s
      .normalize('NFC')
      // A lone ⁰ after a number is a degree sign ("góc 10⁰", "30⁰C"), not 10⁰ = 1.
      .replace(/(\d)⁰(?![⁰¹²³⁴⁵⁶⁷⁸⁹⁻])/g, '$1°')
      // One caret per run: "10⁻¹⁰" → "10^-10" (not "10^-^1^0", which no reader understood).
      .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, '^$&')
      .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]/g, (c) => SUPER[c] ?? c)
      .replace(/\^\^/g, '^')
      .replace(/[−–—]/g, '-')
      // Cyrillic "х" pasted for "x", zero-width spaces.
      .replace(/х/g, 'x')
      .replace(/[\u200b-\u200d\u2060\ufeff]/g, '')
      .replace(/[\u00a0\u202f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/** Candidate numeric readings of one token such as "1.200", "0,5" or "12". */
function readings(token: string): number[] {
  const out = new Set<number>();
  const push = (s: string) => {
    const v = Number(s);
    if (Number.isFinite(v)) out.add(v);
  };
  // Decimal comma, dots as thousands separators (Vietnamese).
  push(token.replace(/\./g, '').replace(',', '.'));
  // Decimal point, commas as thousands separators (English).
  push(token.replace(/,/g, ''));
  // Only the first separator as decimal point.
  push(token.replace(/[.,]/, '.').replace(/[.,]/g, ''));
  return [...out];
}

/** Scientific notation: a × 10^b, with the multiplication signs of typed, pasted and LaTeX text. */
// An exponent is a whole number: "10^-8,5" is no power of ten this reader knows.
const SCI =
  /(\d+(?:[.,]\d+)?)\s*(?:[.×xX*·⋅∙´•✕⨯]|\\cdot|\\times)\s*10\s*\^?\s*[({]?\s*(-?\d+)(?![.,]?\d)\s*[)}]?/g;
/** A power of ten on its own ("10⁻⁸", normalized to "10^-8"); unlike SCI the caret is required. */
const POW = /(?<![\d.,])10\s*\^\s*[({]?\s*(-?\d+)(?![.,]?\d)\s*[)}]?/g;
/** Words that join a mantissa to a power ("2 lần 10⁻⁸", "2 times 10^-8"): never a lone power. */
const TIMES_WORDS = new Set(['lần', 'nhân', 'với', 'times', 'by', 'of', 'của']);

/**
 * Allow-list (third review of #89): a power of ten is read on its own only right after the start
 * of the text, "=", "≈", ":" or an ordinary word of two letters or more (spaces and opening brackets
 * skipped), and only when what follows it is the end, a unit or a word — never a multiplication or
 * a number. Anything else ("2 LẦN 10⁻⁸", "½·10⁻⁸", "10⁻⁸·2", "10⁻⁸, 10⁻⁹") may be a mantissa the
 * reader does not understand: the power is refused, the learner enters the value (§2.1).
 */
function standsAlone(before: string, after: string): boolean {
  // One sign may stand right before the power ("q = −10⁻⁸"); "2 − 10⁻⁸" still ends in a number.
  const b = before
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s([{]+$/u, '')
    .replace(/[-+]$/u, '')
    .replace(/[\s([{]+$/u, '');
  // A LaTeX command (\cdot, \times) is no ordinary word.
  const word = /(?<![\p{L}\p{N}_\\])\p{L}+$/u.exec(b)?.[0];
  const startOk =
    b === '' ||
    /[=≈:]$/u.test(b) ||
    (word !== undefined && word.length >= 2 && !TIMES_WORDS.has(word));
  const a = after
    .normalize('NFKC')
    .toLowerCase()
    .replace(/^[\s)\]}]+/u, '');
  const next = /^\p{L}+/u.exec(a)?.[0];
  const endOk =
    a === '' ||
    /^[,;.!?](?!\s*[\p{N}(])/u.test(a) ||
    (next !== undefined && !TIMES_WORDS.has(next) && !/^\p{L}\s*[\p{N}(]/u.test(a));
  return startOk && endOk;
}

/** A reading a problem can state: finite, and not a power of ten that underflowed to 0. */
const usable = (v: number) => Number.isFinite(v) && v !== 0;
// A thousands group is exactly three digits: "0,000719" is one decimal, not "0,000" and "719".
const PLAIN = /\d+(?:[.,\s]\d{3}(?!\d))*(?:[.,]\d+)?|\d+/g;

interface Token {
  start: number;
  end: number;
  readings: number[];
}

/**
 * Number tokens of normalized text, in reading order. Scientific notation and lone powers of ten
 * come first; plain digits inside them are left out unless `keepInner` (a problem may write either
 * reading, see `numbersIn`).
 */
function scan(t: string, keepInner = false): Token[] {
  const tokens: Token[] = [];
  const inside = (s: number, e: number) => tokens.some((k) => s >= k.start && e <= k.end);
  for (const m of t.matchAll(SCI)) {
    // "2·10^400" is Infinity, which `same` would match with every value: such readings are dropped.
    const sci = readings(m[1] ?? '')
      .map((r) => r * 10 ** Number(m[2]))
      .filter(usable);
    // "1.106" may be 1·10^6 or a plain decimal: digits and separators alone keep both readings.
    const written = m[0].trim();
    const all = /^[\d.,]+$/.test(written) ? [...sci, ...readings(written)] : sci;
    tokens.push({ start: m.index, end: m.index + m[0].length, readings: all });
  }
  for (const m of t.matchAll(POW)) {
    const end = m.index + m[0].length;
    const value = 10 ** Number(m[1]);
    // 10^0 is never read as 1: "10^0" after a number is a degree typed with a caret.
    if (
      inside(m.index, end) ||
      Number(m[1]) === 0 ||
      !usable(value) ||
      !standsAlone(t.slice(0, m.index), t.slice(end))
    ) {
      continue;
    }
    tokens.push({ start: m.index, end, readings: [value] });
  }
  const outer = tokens.length;
  for (const m of t.matchAll(PLAIN)) {
    const end = m.index + m[0].length;
    if (!keepInner && tokens.slice(0, outer).some((k) => m.index >= k.start && end <= k.end)) {
      continue;
    }
    tokens.push({ start: m.index, end, readings: readings(m[0].replace(/\s/g, '')) });
  }
  return tokens.sort((a, b) => a.start - b.start);
}

/**
 * Every number written in the text, one entry per written token, each with all its possible
 * readings ("2,5" → [2.5, 25], "1.200" → [1200, 1.2]). A token is known when ANY reading is:
 * checking each reading on its own always flags the reading the writer did not mean. Digits that
 * are part of a scientific-notation token ("6,67.10^-11") are not counted again on their own.
 */
export function numberTokens(text: string): number[][] {
  return scan(normalizeText(text)).map((k) => k.readings);
}

/** All numbers mentioned in the text (absolute values; signs are interpretation). */
export function numbersIn(text: string): number[] {
  return scan(normalizeText(text), true).flatMap((k) => k.readings);
}

/** Equal up to floating-point noise: relative, so 5·10⁻¹⁰ and 7·10⁻¹⁰ differ (an absolute 1e-9 did not). */
const same = (a: number, b: number) =>
  // Never Infinity: Infinity ≤ 1e-9·Infinity would make every value "in the problem".
  Number.isFinite(a) &&
  Number.isFinite(b) &&
  Math.abs(a - b) <= 1e-9 * Math.max(Math.abs(a), Math.abs(b));

/** True when |value| (as written in the problem's unit) appears in the text. */
export function mentions(text: string, value: number): boolean {
  const target = Math.abs(value);
  return numbersIn(text).some((n) => same(n, target));
}

/**
 * Words that give a charge its sign — only next to "điện tích"/"điện"/"dấu", so "bản âm" or "chiều
 * âm" say nothing — and words saying the sign is left open ("độ lớn 2 µC").
 */
const NEGATIVE =
  /(?<![\p{L}\p{N}])(?:(?:điện(?: tích)?|dấu) âm|negative(?:ly)? charged?)(?![\p{L}\p{N}])/u;
const POSITIVE =
  /(?<![\p{L}\p{N}])(?:(?:điện(?: tích)?|dấu) dương|positive(?:ly)? charged?)(?![\p{L}\p{N}])/u;
/** "Hai điện tích âm q1 = 2 µC và q2 = 3 µC": one sign word for every charge of the sentence. */
const PLURAL_SIGN = /(?<![\p{L}\p{N}])(?:hai|ba|các|những) điện tích (âm|dương)(?![\p{L}\p{N}])/u;
/** A new charge named after the number ("… cách điện tích âm q2"): its words are not this one's. */
const NEXT_CHARGE = /(?<![\p{L}\p{N}])(?<!mang )điện tích(?![\p{L}\p{N}])/u;
const OPEN_SIGN =
  /(?<![\p{L}\p{N}])(?:độ lớn|trái dấu|cùng dấu|magnitude|opposite)(?![\p{L}\p{N}])/u;
/** A sentence ends at ".;!?" followed by a space ("1,6.10-19" has none). */
const SENTENCE_END = /[.;!?](?=\s|$)/g;

/**
 * The sign the problem gives |value|: −1 for "q = −2 µC" or "điện tích âm … 2 µC", +1 for a plain
 * or "+"/"dương" number, 0 when the text leaves it open ("độ lớn", "trái dấu", both words) or
 * writes the number with different signs and the quote does not say which one is meant.
 * The words count within the sentence, up to the neighbouring numbers. Used to flag an AI that
 * changed a charge's sign: `mentions` compares absolute values only.
 */
export function writtenSign(text: string, value: number, quote = ''): -1 | 0 | 1 {
  const t = normalizeText(text).toLowerCase();
  // Digits of names and unit powers ("q1", "m/s^2") are not numbers of the problem.
  const tokens = scan(t).filter((k) => !/(?:[\p{L}_]|\^-?)$/u.test(t.slice(0, k.start)));
  const target = Math.abs(value);
  const ends = [...t.matchAll(SENTENCE_END)].map((m) => m.index);
  const signAt = (i: number): -1 | 0 | 1 => {
    const tok = tokens[i];
    if (!tok) return 0;
    const mark = /(?:^|[^\p{L}\p{N}.,)])([+-]) ?$/u.exec(t.slice(0, tok.start))?.[1];
    if (mark) return mark === '-' ? -1 : 1;
    const from = Math.max(0, ...ends.filter((e) => e < tok.start));
    const to = Math.min(t.length, ...ends.filter((e) => e >= tok.end));
    // Between two numbers of one sentence, a ", " gives each the words on its side.
    const prev = tokens[i - 1];
    let before = t.slice(prev && prev.end > from ? prev.end : from, tok.start);
    if (prev && prev.end > from) before = before.slice(before.lastIndexOf(', ') + 1);
    const next = tokens[i + 1];
    let after = t.slice(tok.end, next && next.start < to ? next.start : to);
    if (next && next.start < to && after.includes(', '))
      after = after.slice(0, after.indexOf(', '));
    after = after.slice(0, NEXT_CHARGE.exec(after)?.index ?? after.length);
    const words = `${before} ${after}`;
    const neg = NEGATIVE.test(words);
    const pos = POSITIVE.test(words);
    if (neg !== pos) return neg ? -1 : 1;
    if (neg || OPEN_SIGN.test(words)) return 0;
    const plural = PLURAL_SIGN.exec(t.slice(from, tok.start))?.[1];
    return plural ? (plural === 'âm' ? -1 : 1) : 1;
  };
  const places = tokens.flatMap((k, i) => (k.readings.some((r) => same(r, target)) ? [i] : []));
  const signs = new Set(places.map(signAt));
  if (signs.size === 1) return [...signs][0] ?? 0;
  // The number is written with different signs: the quote must point at one place.
  const q = normalizeText(quote).toLowerCase();
  if (!q) return 0;
  const picked = new Set<-1 | 0 | 1>();
  for (let at = t.indexOf(q); at >= 0; at = t.indexOf(q, at + 1)) {
    for (const i of places) {
      const k = tokens[i];
      if (k && k.start >= at && k.end <= at + q.length) picked.add(signAt(i));
    }
  }
  return picked.size === 1 ? ([...picked][0] ?? 0) : 0;
}

/** Loose "is this quote from the text" check (case, spaces and punctuation insensitive). */
export function quoteInText(text: string, quote: string): boolean {
  const norm = (s: string) =>
    normalizeText(s)
      .toLowerCase()
      .replace(/[^\p{L}\p{N},.%°/^-]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const q = norm(quote);
  return q.length > 0 && norm(text).includes(q);
}
