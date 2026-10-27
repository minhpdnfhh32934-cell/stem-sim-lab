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
      // A lone ⁰ right after a digit is a degree sign ("góc 10⁰", "30⁰C"), not 10⁰ = 1.
      .replace(/(\d)⁰(?![⁰¹²³⁴⁵⁶⁷⁸⁹⁻])/g, '$1°')
      // One caret per run: "10⁻¹⁹" → "10^-19" (one caret per character gave "10^-^1^9", unread).
      .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (run) => `^${run.replace(/./gu, (c) => SUPER[c] ?? c)}`)
      .replace(/\^\^/g, '^')
      .replace(/[−–—]/g, '-')
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

/** Scientific notation: a [.×x*] 10 ^? b */
const SCI = /(\d+(?:[.,]\d+)?)\s*(?:[.×x*·])\s*10\s*\^?\s*\(?\s*(-?\d+)\s*\)?/g;
const PLAIN = /\d+(?:[.,\s]\d{3})*(?:[.,]\d+)?|\d+/g;

/**
 * Every number written in the text, one entry per written token, each with all its possible
 * readings ("2,5" → [2.5, 25], "1.200" → [1200, 1.2]). A token is known when ANY reading is:
 * checking each reading on its own always flags the reading the writer did not mean. Digits that
 * are part of a scientific-notation token ("6,67.10^-11") are not counted again on their own.
 */
export function numberTokens(text: string): number[][] {
  const t = normalizeText(text);
  const tokens: number[][] = [];
  const spans: [number, number][] = [];
  for (const m of t.matchAll(SCI)) {
    const exp = Number(m[2]);
    const sci = readings(m[1] ?? '').map((r) => r * 10 ** exp);
    // "1.106" may be 1·10^6 or a plain decimal: digits and separators alone keep both readings.
    const written = m[0].trim();
    tokens.push(/^[\d.,]+$/.test(written) ? [...sci, ...readings(written)] : sci);
    spans.push([m.index, m.index + m[0].length]);
  }
  for (const m of t.matchAll(PLAIN)) {
    const start = m.index;
    const end = start + m[0].length;
    if (spans.some(([s, e]) => start >= s && end <= e)) continue;
    tokens.push(readings(m[0].replace(/\s/g, '')));
  }
  return tokens;
}

/**
 * A symbol of one or two Latin or Greek letters at the start of a word ("q0", "q_0", "m1", "R1", "v_0").
 * Vietnamese words glued to a number ("là10", "ở45", "từ10") are typos, not symbols: their numbers stay.
 */
const SYMBOL_BEFORE = /(?<![\p{L}\p{N}])[A-Za-z\u0391-\u03C9]{1,2}_?$/u;

/**
 * All numbers mentioned in the text (absolute values; signs are interpretation). Readings that are
 * not finite ("2.10^400") are left out, and so is the digit of a symbol ("q0 = 2 nC" states no 0);
 * "nhau10", "góc30" are words, so their numbers stay.
 */
export function numbersIn(text: string): number[] {
  const t = normalizeText(text);
  const found: number[] = [];
  // Scientific notation first, then every plain token (a problem may write either reading).
  for (const m of t.matchAll(SCI)) {
    const exp = Number(m[2]);
    for (const r of readings(m[1] ?? '')) found.push(r * 10 ** exp);
  }
  for (const m of t.matchAll(PLAIN)) {
    if (SYMBOL_BEFORE.test(t.slice(0, m.index))) continue;
    found.push(...readings(m[0].replace(/\s/g, '')));
  }
  return found.filter(Number.isFinite);
}

/**
 * Equal up to floating-point noise, relatively: 5·10⁻¹⁰ and 7·10⁻¹⁰ differ (an absolute 1e-9 let
 * every tiny charge pass). Only finite numbers: Infinity ≤ 1e-9·Infinity would match anything.
 */
const same = (a: number, b: number) =>
  Number.isFinite(a) &&
  Number.isFinite(b) &&
  Math.abs(a - b) <= 1e-9 * Math.max(Math.abs(a), Math.abs(b));

/** True when |value| (as written in the problem's unit) appears in the text. */
export function mentions(text: string, value: number): boolean {
  const target = Math.abs(value);
  return numbersIn(text).some((n) => same(n, target));
}

interface Span {
  start: number;
  end: number;
  readings: number[];
}

/** The tokens of `numberTokens`, with where they stand in the normalized text (for `writtenSign`). */
function spans(t: string): Span[] {
  const out: Span[] = [];
  for (const m of t.matchAll(SCI)) {
    const exp = Number(m[2]);
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      readings: readings(m[1] ?? '').map((r) => r * 10 ** exp),
    });
  }
  const sci = out.length;
  for (const m of t.matchAll(PLAIN)) {
    const end = m.index + m[0].length;
    if (out.slice(0, sci).some((k) => m.index >= k.start && end <= k.end)) continue;
    out.push({ start: m.index, end, readings: readings(m[0].replace(/\s/g, '')) });
  }
  return out.sort((x, y) => x.start - y.start);
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
  /(?<![\p{L}\p{N}])(?:độ lớn|trái dấu|cùng dấu|khác dấu|ngược dấu|magnitude|opposite)(?![\p{L}\p{N}])/u;
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
  const tokens = spans(t).filter((k) => !/(?:[\p{L}_]|\^-?)$/u.test(t.slice(0, k.start)));
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
    if (plural) return plural === 'âm' ? -1 : 1;
    // "Hai điện tích khác dấu q1 = 2 µC và q2 = 3 µC": the sentence leaves every sign open.
    return OPEN_SIGN.test(t.slice(from, tok.start)) ? 0 : 1;
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
