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
  return s
    .normalize('NFC')
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]/g, (c) => `^${SUPER[c] ?? c}`)
    .replace(/\^\^/g, '^')
    .replace(/[−–—]/g, '-')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

/** All numbers mentioned in the text (absolute values; signs are interpretation). */
export function numbersIn(text: string): number[] {
  const t = normalizeText(text);
  const found: number[] = [];
  // Scientific notation first: a [.×x*] 10 ^? b
  const sci = /(\d+(?:[.,]\d+)?)\s*(?:[.×x*·])\s*10\s*\^?\s*\(?\s*(-?\d+)\s*\)?/g;
  let m: RegExpExecArray | null;
  while ((m = sci.exec(t))) {
    const mant = m[1] ?? '';
    const exp = Number(m[2]);
    for (const r of readings(mant)) found.push(r * 10 ** exp);
  }
  const plain = /\d+(?:[.,\s]\d{3})*(?:[.,]\d+)?|\d+/g;
  while ((m = plain.exec(t))) {
    const tok = m[0].replace(/\s/g, '');
    found.push(...readings(tok));
  }
  return found;
}

/** True when |value| (as written in the problem's unit) appears in the text. */
export function mentions(text: string, value: number): boolean {
  const target = Math.abs(value);
  return numbersIn(text).some((n) => Math.abs(n - target) <= 1e-9 * Math.max(1, target));
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
