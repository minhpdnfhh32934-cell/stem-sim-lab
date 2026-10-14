/**
 * Numbers a learner writes in words ("hai giờ", "hai mươi lăm phút", "nửa giờ", "two hours"): the
 * values they give, so the chat does not list "2 giờ" in the AI's answer as a number nobody gave
 * (provenance.ts). Vietnamese words are compared with their accents ("sau" is "after", "sáu" is
 * "six") unless the whole text was typed without any.
 */

/** Digit words. "lăm"/"nhăm" (5), "tư" (4) and "mốt" (1) are the forms used after "mươi". */
const DIGITS: Record<string, number> = {
  một: 1,
  mốt: 1,
  hai: 2,
  ba: 3,
  bốn: 4,
  tư: 4,
  năm: 5,
  lăm: 5,
  nhăm: 5,
  sáu: 6,
  bảy: 7,
  bẩy: 7,
  tám: 8,
  chín: 9,
  mười: 10,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  dozen: 12,
};

/** "mươi" multiplies what comes before it by ten ("hai mươi" = 20). */
const TENS = new Set(['mươi']);
/** Multipliers that close a group ("ba trăm", "two thousand"). */
const SCALES: Record<string, number> = {
  trăm: 100,
  nghìn: 1000,
  ngàn: 1000,
  triệu: 1e6,
  tỉ: 1e9,
  tỷ: 1e9,
  hundred: 100,
  thousand: 1000,
  million: 1e6,
  billion: 1e9,
};
/** Words inside a number that add nothing ("hai trăm linh năm", "one hundred and five"). */
const JOINERS = new Set(['linh', 'lẻ', 'and']);
/** Values on their own ("gấp đôi", "nửa", "half", "twice"). */
const ALONE: Record<string, number> = {
  nửa: 0.5,
  đôi: 2,
  half: 0.5,
  twice: 2,
  double: 2,
  triple: 3,
};

/** Lower case, no marks, "đ" → "d". */
function fold(word: string): string {
  return word.normalize('NFD').toLowerCase().replace(/\p{M}/gu, '').replace(/đ/g, 'd');
}

function table<T>(entries: Record<string, T>, folded: boolean): Map<string, T> {
  return new Map(Object.entries(entries).map(([k, v]) => [folded ? fold(k) : k, v]));
}

/** Every value the number words of `text` give: each word, each run of words, "… rưỡi" (+ 0,5). */
export function numberWordValues(text: string): number[] {
  const folded = !/\p{M}|đ/iu.test(text.normalize('NFD'));
  const key = (w: string) => (folded ? fold(w) : w.normalize('NFC').toLowerCase());
  const digits = table(DIGITS, folded);
  const scales = table(SCALES, folded);
  const alone = table(ALONE, folded);
  const tens = new Set([...TENS].map((w) => (folded ? fold(w) : w)));
  const joiners = new Set([...JOINERS].map((w) => (folded ? fold(w) : w)));
  const half = folded ? 'ruoi' : 'rưỡi';
  const words = (text.match(/[\p{L}\p{M}]+/gu) ?? []).map(key);
  const out: number[] = [];
  let total = 0;
  /** The part below the current thousand ("một trăm hai mươi" → 120). */
  let group = 0;
  /** The last digit word, which "mươi" turns into tens ("hai mươi" → 20). */
  let lastDigit = 0;
  let inRun = false;
  /** The value of the run that ended last, and how many words ago (for "hai giờ rưỡi"). */
  let last: { value: number; at: number } | null = null;
  const endRun = (i: number) => {
    if (!inRun) return;
    const value = total + group;
    if (value > 0) {
      out.push(value);
      last = { value, at: i };
    }
    total = 0;
    group = 0;
    lastDigit = 0;
    inRun = false;
  };
  words.forEach((w, i) => {
    const digit = digits.get(w);
    const scale = scales.get(w);
    // Without accents "muoi" is both "mười" (10) and "mươi" (tens): after a digit it is "mươi".
    if (tens.has(w) && inRun && lastDigit > 0) {
      group += lastDigit * 9;
      lastDigit = 0;
    } else if (digit !== undefined) {
      out.push(digit);
      group += digit;
      lastDigit = digit;
      inRun = true;
    } else if (scale !== undefined && inRun) {
      if (scale >= 1000) {
        total += (group || 1) * scale;
        group = 0;
      } else {
        group = (group || 1) * scale;
      }
      lastDigit = 0;
    } else if (joiners.has(w) && inRun) {
      /* "hai trăm linh năm": the run goes on */
    } else {
      endRun(i);
      const value = alone.get(w);
      if (value !== undefined) out.push(value);
      // "hai giờ rưỡi", "hai rưỡi": half after the number or after its unit.
      const before: { value: number; at: number } | null = last;
      if (w === half && before !== null && i - before.at <= 1) out.push(before.value + 0.5);
    }
  });
  endRun(words.length);
  return [...new Set(out)];
}
