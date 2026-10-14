/**
 * Numbers a learner writes in words ("hai giờ", "hai mươi lăm phút", "nửa giờ", "two hours"): the
 * values they give, so the chat does not list "2 giờ" in the AI's answer as a number nobody gave
 * (provenance.ts). Every value found here counts as given, so when a reading is unsure this file
 * finds less, never more: an invented number must stay listed, while a value the learner wrote that
 * is missed here only gets a false "chưa kiểm chứng" chip. An unsure numeral gives nothing at all,
 * never a shorter value.
 *
 * - Words join only into real numerals: "hai mươi ba" = 23, "một trăm linh năm" = 105, "ba nghìn"
 *   = 3000, "hai chục" = 20, "hai nghìn năm trăm" = 2500, "một trăm rưỡi" = 150, "ba phần tư" =
 *   0,75, "a hundred and twenty" = 120. Number words are never summed. A numeral never runs across
 *   punctuation ("hai, bốn" gives 2 and 4).
 * - In speech a digit word, "mốt", "lăm" or "tư" right after a lone digit, "chục", "trăm" or a
 *   scale word ends the number: "hai tư" 24, "ba sáu" 36, "hai trăm hai" 220, "một trăm mốt" 110,
 *   "một nghìn tư" 1400, "trăm hai" 120 (or "hai ba người": two or three people). Such a pair is
 *   unsure, so "hai bốn giờ", "hai trăm tư mét", "một nghìn hai", "nghìn hai", "ba nghìn hai nghìn"
 *   give nothing: not 2 and 4, 200, 1000 or 2. After a numeral that ends in a units digit, a digit
 *   word ends a range and gives nothing: "mười hai ba tuổi" (12 or 13) gives 12 only, "hai mươi lăm
 *   sáu độ" 25 only.
 * - A rough or partial numeral gives nothing: "hai trăm mấy" (two hundred-something), "hai mươi
 *   mấy", "hai trăm lẻ" (two hundred-odd), "ba lẻ năm" (3,05 or 305?), "twenty-odd", "two and a half
 *   thousand"; nor does a numeral before a multiplier this file does not read ("hai vạn", "hai tá").
 * - "năm" is also "year". Right after a number it is the year (inside a spoken number five is
 *   "lăm"): "một năm" gives 1, "hai mươi năm" 20, "Sau 3 năm" nothing. Before a unit or a count
 *   word it cannot be the year, so the whole numeral is unsure: "bốn năm lần" (four or five times),
 *   "trẻ bốn năm tuổi", "mười năm phút" (15, said with an "n"?), "bốn năm nghìn" give nothing. After
 *   "chục", "trăm" or a scale word it is the year only before "rưỡi" or a word that settles it
 *   ("hai trăm năm trước", "hai nghìn năm qua"): "Em ra hai trăm năm" (250 in speech?) gives
 *   nothing. Alone, "năm", "một" (also "a") and "chín" (also "ripe") count only before a unit or
 *   measure word ("năm giây", "một lần", "một ki-lô-gam"; not "Năm nay", "năm nhất", "Năm 1905",
 *   "Một vật rơi", "Quả chín"), as "một" in missingData.ts. "sinh viên năm hai" gives nothing.
 * - Names: a capitalised digit word that does not start a sentence is a name ("anh Ba", "chú Bảy",
 *   "bạn Nam"), and so is "Ba Lan" (Poland) and, without accents, a capitalised "Nam" anywhere
 *   ("Nam lan luot tha…": Nam, not "Năm lần"). They give nothing.
 * - "mốt", "lăm"/"nhăm" and "tư" are digits only inside a numeral ("hai mươi mốt", "mười lăm", "ba
 *   mươi tư", "một trăm lẻ tư", "ba phần tư"): "thứ tư", "tư vấn", "ngày mốt" give nothing. A "tư"
 *   that starts a word ("tư thế", "tư vấn", "tư nhân") is no digit, and the numeral it would end
 *   gives nothing: "hai mươi tư thế" (24 in "… thế có đúng không?", or 20 postures?), "mười tư vấn
 *   viên", "một trăm lẻ tư nhân hai", "ba phần tư nhân hai" give neither value ("nhân hai" still
 *   gives 2). "hai mươi tư nhân viên" is still 24 employees.
 * - A denominator is no value of its own: "phần mười giây" (a tenth of a second), "two thirds",
 *   "one tenth" give nothing; "one half" gives 0,5 only. "half-life" gives no 0,5.
 * - Halves: "hai rưỡi" 2,5, "hai chục rưỡi" 25, "một trăm rưỡi" 150, "two and a half" 2,5, and
 *   after a unit "hai giờ rưỡi", "hai năm rưỡi" 2,5 ("năm" is the unit there: "năm rưỡi" right
 *   after a numeral is never 5,5). "hai giờ rưỡi" gives 2,5 only, not 2 as well (a choice): an
 *   answer that rewrites it as "2 giờ 30 phút" gets "2 giờ" listed, a false alarm on the safe side.
 * - Decimals: "ba phẩy năm" 3,5, "không phẩy không năm mét" 0,05, "one point five" 1,5 (digits after
 *   "phẩy"/"point" one by one), "ba phẩy mười bốn" 3,14, "chín phẩy tám mốt" 9,81 (one numeral
 *   below a thousand after "phẩy"). An unsure end gives nothing at all: "hai phẩy năm năm" (2,55,
 *   or 2,5 years?), "ba phẩy một bốn mươi", "At one point two cars…", and one digit after "point"
 *   with a word after it that is no unit: "Through one point two lines…" (one point, two lines).
 * - Vietnamese words are compared with their accents ("sau" is "after", "sáu" is "six") unless the
 *   whole text was typed without any. Then nearly every digit word is also an ordinary word ("sau"
 *   after, "bay" fly, "tam" centre or "tầm" about, "muoi" salt, "tu" from, "doi" change, "nua" more,
 *   "ten" name), "gap" is both "gấp" (times) and "gặp" (meet), and "muoi" is both "mươi" (tens) and
 *   "mười" (ten). So a number counts only before a unit ("hai muoi lam giay", "nua gio"), unless it
 *   has a word that means nothing else ("hai nghin", "two thousand"). After "gap" it also counts at
 *   the end of its run ("tang gap ba", and "gap doi" anywhere), but not a lone "mot" or "nam" or a
 *   name ("An gap Nam" meets Nam).
 *   What this costs (accepted, "find less"): a numeral that starts with "sau", "bay" or "tam" never
 *   counts, alone or longer, even before a unit or after "gap": the ordinary word is often followed
 *   by a unit or by "mười" ("Sau giay dau tien", "May bay bay thang", "tam giay" a sheet of paper,
 *   "Sau muoi giay" after ten seconds, not 60, "Hai xe gap sau muoi giay" meet after ten seconds,
 *   "gap tam muoi phut" meet after about ten minutes). Nor does "bon muoi" ("Mot bon muoi lit": a
 *   tank of ten litres, not 40). So "tang gap sau lan" gives nothing. Inside a numeral that starts
 *   with another word they still count ("muoi sau giay" 16). "nam", "do", "ngay", "tan", "can", "chu"
 *   are no units there, so "ba muoi do", "ba ngay", "hai tan", "hai nam ruoi" give nothing; nor does
 *   a numeral with no unit after it ("v = hai muoi lam", "hai tram"), or after a number and "phan"
 *   ("mot phan muoi giay"; "nguyen phan ba lan" is still 3). A text with no mark at all counts as
 *   typed without accents, so a short reply "hai" or "ba" (no marks even on a Vietnamese keyboard)
 *   gives nothing either. These rules make an invented value unlikely, not impossible: an ordinary
 *   word they do not foresee can still be read as a digit ("nam muoi phut" gives 50, though it may
 *   be "nằm mười phút", lie down ten minutes).
 */

/** Vietnamese digits that stand alone or start a numeral. */
const VI_DIGITS: Record<string, number> = {
  một: 1,
  hai: 2,
  ba: 3,
  bốn: 4,
  năm: 5,
  sáu: 6,
  bảy: 7,
  bẩy: 7,
  tám: 8,
  chín: 9,
};
/**
 * The units digit after "mười"/"mươi" ("mười lăm", "hai mươi mốt", "ba mươi tư"). Not "năm": five is
 * "lăm" there, so "hai mươi năm" is twenty years.
 */
const VI_AFTER_TENS: Record<string, number> = {
  một: 1,
  mốt: 1,
  hai: 2,
  ba: 3,
  bốn: 4,
  tư: 4,
  lăm: 5,
  nhăm: 5,
  sáu: 6,
  bảy: 7,
  bẩy: 7,
  tám: 8,
  chín: 9,
};
/** The digit after "linh"/"lẻ" ("một trăm linh năm" = 105, "một trăm lẻ tư" = 104). */
const VI_AFTER_ZERO: Record<string, number> = { ...VI_DIGITS, tư: 4 };
/** Spoken tens without "mươi" ("hai lăm" = 25, "ba mốt" = 31): these forms mean nothing else. */
const VI_ELIDED: Record<string, number> = { mốt: 1, lăm: 5, nhăm: 5 };
/** "chục" (ten) follows one digit only: "hai chục" = 20, "hai chục nghìn" = 20 000. */
const VI_SCALES: Record<string, number> = {
  chục: 10,
  nghìn: 1e3,
  ngàn: 1e3,
  triệu: 1e6,
  tỉ: 1e9,
  tỷ: 1e9,
};
/** Before these a scale word is something else: "tỉ lệ", "tỉ số" (ratio), "triệu chứng" (symptom). */
const NOT_A_SCALE_BEFORE: Record<string, string[]> = {
  tỉ: ['lệ', 'số'],
  tỷ: ['lệ', 'số'],
  triệu: ['chứng'],
};
/**
 * After a numeral these make it rough or partial: "hai trăm mấy" (two hundred-something), "hai
 * trăm lẻ" (two hundred-odd), "ba lẻ năm" (3,05 or 305?), "twenty-odd". No value.
 */
const ROUGH_AFTER = ['mấy', 'lẻ', 'linh', 'odd', 'something'];
/** Multipliers this file does not read: "hai vạn" (20 000), "hai tá" (24). No value. */
const MULTIPLIERS = ['vạn', 'tá'];
/** After "chục", "trăm" or a scale word these settle "năm" as the year ("hai trăm năm trước"). */
const YEAR_AFTER = ['trước', 'sau', 'nữa', 'qua', 'nay', 'ánh'];
/** Count words: before them "năm" is five, not the year ("bốn năm người": four or five people). */
const COUNT_WORDS = `người con cái chiếc quả hạt viên vật bước điểm tuổi cây câu bài trang lực
  electron proton nơtron mẫu cốc ống`.split(/\s+/);
/** Count words in two syllables ("học sinh"; "bốn năm học" is four school years). */
const COUNT_PAIRS = [
  ['học', 'sinh'],
  ['sinh', 'viên'],
  ['tế', 'bào'],
  ['phân', 'tử'],
  ['nguyên', 'tử'],
];
/**
 * "tư" starts these words, so before them it is no digit: "tư thế", "tư vấn", "tư liệu", "tư nhân"…
 * The numeral it would end is unsure then ("hai mươi tư thế": 24, or 20 postures?).
 */
const AFTER_TU_A_WORD = ['thế', 'vấn', 'liệu', 'duy', 'nhân', 'tưởng'];
/** …but "nhân" starts these ones: "hai mươi tư nhân viên" is 24 employees. */
const AFTER_NHAN_A_WORD = ['viên', 'vật', 'tố'];
/** Digits read one by one after "phẩy" ("ba phẩy không hai" = 3,02). */
const VI_DECIMAL_DIGITS: Record<string, number> = { ...VI_DIGITS, không: 0 };

const EN_UNITS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
};
const EN_TEENS: Record<string, number> = {
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
};
const EN_TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};
const EN_SCALES: Record<string, number> = { thousand: 1e3, million: 1e6, billion: 1e9 };
/** Digits read one by one after "point" ("one point two five" = 1,25). */
const EN_DECIMAL_DIGITS: Record<string, number> = { ...EN_UNITS, zero: 0 };
/** Denominators: "two thirds" gives no 2, "one tenth" no 1 ("one half" gives 0,5 from "half"). */
const EN_FRACTIONS = `half halves third thirds quarter quarters fourth fourths fifth fifths sixth
  sixths seventh sevenths eighth eighths ninth ninths tenth tenths hundredth hundredths thousandth
  thousandths`.split(/\s+/);
/** "half-life", "three half-lives": no 0,5 (and "three" is no numerator). */
const NOT_HALF_BEFORE = ['life', 'lives'];

/** Words that go on with a numeral: right after the digits of a decimal they make its end unsure. */
const NUMERAL_WORDS = [
  'mươi',
  'mười',
  'mốt',
  'lăm',
  'nhăm',
  'tư',
  'trăm',
  'linh',
  'lẻ',
  'rưỡi',
  'rưởi',
  'phẩy',
  'point',
  'hundred',
  ...Object.keys(VI_SCALES),
  ...Object.keys(EN_SCALES),
  ...Object.keys(EN_TEENS),
  ...Object.keys(EN_TENS),
];

/** Values on their own ("gấp đôi", "nửa", "half", "twice"). */
const ALONE: Record<string, number> = {
  nửa: 0.5,
  đôi: 2,
  half: 0.5,
  twice: 2,
  double: 2,
  triple: 3,
  dozen: 12,
};
/** "đôi khi", "đôi lúc" (sometimes), "đôi chút" (a little). */
const NOT_PAIR_BEFORE = ['khi', 'lúc', 'chút'];

/** Units and measure words that make a number word a value ("một giây", "hai muoi lam giay"). */
const UNIT_WORDS =
  `giây phút giờ tiếng ngày tuần tháng năm mét kilômét xentimét centimét milimét gam
  kilôgam kí ký cân tấn lít mililít mol độ vòng lần chu niutơn newton jun oát vôn ampe ôm héc calo
  second seconds minute minutes hour hours day days week weeks month months year years metre metres
  meter meters kilometre kilometres kilometer kilometers centimetre centimetres centimeter
  centimeters millimetre millimetres millimeter millimeters mph gram grams kilogram kilograms tonne
  tonnes litre litres liter liters mole moles newtons joule joules watt watts volt volts ampere
  amperes ohm ohms hertz kelvin kelvins pascal pascals degree degrees percent times cycle
  cycles`.split(/\s+/);
/** Units spelled in syllables ("ki-lô-gam", "xen-ti-mét", "mi-li-lít"), by their first two. */
const SYLLABLE_UNITS = [
  ['ki', 'lô'],
  ['kí', 'lô'],
  ['ký', 'lô'],
  ['xen', 'ti'],
  ['xăng', 'ti'],
  ['mi', 'li'],
];
/**
 * Unit words that are ordinary words without accents: "nam" (south; also the digit), "do" (because,
 * that), "tan" (dissolve), "can" (need), "chu" (uncle), "ngay" (at once).
 */
const UNCLEAR_UNITS_WITHOUT_ACCENTS = new Set(['nam', 'do', 'tan', 'can', 'chu', 'ngay']);
/**
 * Digit words that are common words a unit or "mười" (ten, also "muoi") often follows, without
 * accents: "Sau giay dau tien" (after the first second), "Sau muoi giay" (after ten seconds), "May
 * bay bay thang" (fly straight), "May bay bay muoi phut", "tam giay" (a sheet of paper), "tam muoi
 * met" (about ten metres), also after "gap" ("gặp", meet: "Hai xe gap sau muoi giay"). A numeral
 * that starts with one never counts; inside a numeral that starts with another word it still counts
 * ("muoi sau giay" 16).
 */
const DIGITS_LIKE_WORDS = ['sáu', 'bảy', 'bẩy', 'tám'];
/**
 * Digit words that are common words "mười" often follows, without accents: "bon muoi" may be
 * "bồn mười" ("Mot bon muoi lit", a tank of ten litres). Before "muoi" they never count.
 */
const DIGITS_LIKE_WORDS_BEFORE_TEN = ['bốn'];
/** Unit symbols, compared as written ("A" is an ampere, "a" is not). */
const UNIT_SYMBOLS = new Set(
  'm s h g l L kg km cm mm mg ml mL N J kJ W kW V A mA Hz Pa kPa atm K mol eV rad min ms'.split(
    ' ',
  ),
);
/** Number words that mean nothing else without accents ("ten" is also "tên", a name). */
const CLEAR_WITHOUT_ACCENTS = [
  ...Object.keys(EN_UNITS),
  ...Object.keys(EN_TEENS).filter((w) => w !== 'ten'),
  ...Object.keys(EN_TENS),
  ...Object.keys(EN_SCALES),
  'hundred',
  'half',
  'twice',
  'double',
  'triple',
  'dozen',
  'nghìn',
];

/** Lower case, no marks, "đ" → "d". */
function fold(word: string): string {
  return word.normalize('NFD').toLowerCase().replace(/\p{M}/gu, '').replace(/đ/g, 'd');
}

interface Word {
  /** Lower case, folded when the text has no accents. */
  key: string;
  /** As written (unit symbols are compared case-sensitively). */
  raw: string;
  /** Offset in the text right after the word. */
  end: number;
}

/** Words in runs separated only by spaces or a hyphen ("twenty-five"): a numeral stays in one run. */
function runs(text: string, key: (w: string) => string): Word[][] {
  const out: Word[][] = [];
  let run: Word[] = [];
  let last = -1;
  for (const m of text.matchAll(/[\p{L}\p{M}]+/gu)) {
    if (last >= 0 && !/^(?:[^\S\r\n]+|-)$/u.test(text.slice(last, m.index))) {
      out.push(run);
      run = [];
    }
    last = m.index + m[0].length;
    run.push({ key: key(m[0]), raw: m[0], end: last });
  }
  if (run.length > 0) out.push(run);
  return out;
}

interface Segment {
  value: number;
  end: number;
  /** It can follow a scale word on its own ("hai nghìn năm trăm"; not "hai nghìn năm"). */
  full: boolean;
  /** The scale word it ends with (100 for "trăm"), else 1: "một trăm rưỡi" is 150. */
  scale: number;
  /** A "tư" that starts a word comes where its last digit would ("hai mươi tư thế"): no value. */
  unsure?: boolean;
}

/** Tens and the units digit after them ("hai mươi ba"). */
interface Tens {
  value: number;
  end: number;
  /** As in `Segment`. */
  unsure?: boolean;
}

/** Every value the number words of `text` give (each numeral once, "… rưỡi" included). */
export function numberWordValues(text: string): number[] {
  const folded = !/\p{M}|đ/iu.test(text.normalize('NFD'));
  const key = (w: string) => (folded ? fold(w) : w.normalize('NFC').toLowerCase());
  const map = (entries: Record<string, number>) =>
    new Map(Object.entries(entries).map(([k, v]) => [key(k), v]));
  const viDigits = map(VI_DIGITS);
  const viAfterTens = map(VI_AFTER_TENS);
  const viAfterZero = map(VI_AFTER_ZERO);
  const viElided = map(VI_ELIDED);
  const viScales = map(VI_SCALES);
  const viDecimal = map(VI_DECIMAL_DIGITS);
  const enUnits = map(EN_UNITS);
  const enTeens = map(EN_TEENS);
  const enTens = map(EN_TENS);
  const enScales = map(EN_SCALES);
  const enDecimal = map(EN_DECIMAL_DIGITS);
  const alone = map(ALONE);
  const units = new Set(
    UNIT_WORDS.map(key).filter((w) => !folded || !UNCLEAR_UNITS_WITHOUT_ACCENTS.has(w)),
  );
  const clear = new Set(CLEAR_WITHOUT_ACCENTS.map(key));
  const out: number[] = [];

  for (const words of runs(text, key)) {
    const is = (k: number, ...options: string[]) => options.some((o) => words[k]?.key === key(o));
    const get = (table: Map<string, number>, k: number) => table.get(words[k]?.key ?? '');

    /** A unit or measure word at `k` ("giây", "m", "%", "ki-lô-gam"); not "giây thứ" (an ordinal). */
    const unitAt = (k: number): boolean => {
      const w = words[k];
      if (!w) return /^[^\S\r\n]*[%°]/u.test(text.slice(words[k - 1]?.end ?? text.length));
      if (is(k + 1, 'thứ')) return false;
      if (UNIT_SYMBOLS.has(w.raw) || units.has(w.key)) return true;
      return SYLLABLE_UNITS.some(([first = '', second = '']) => is(k, first) && is(k + 1, second));
    };
    /**
     * A scale word at `k`, not "tỉ lệ", "tỉ số", "triệu chứng". Without accents "le" is also "lẻ"
     * (zero): "ba nghin le hai" is 3002 ("ti le" stays a ratio).
     */
    const scaleAt = (table: Map<string, number>, k: number) => {
      const not = Object.entries(NOT_A_SCALE_BEFORE).find(([w]) => is(k, w))?.[1] ?? [];
      return is(k + 1, ...not) ? undefined : get(table, k);
    };
    /**
     * A "tư" at `k` that starts a word ("tư thế", "tư vấn", "tư nhân"; not "tư nhân viên"): no
     * digit, and a numeral it would end is unsure, so nothing of it counts.
     */
    const tuStartsWordAt = (k: number) =>
      is(k, 'tư') &&
      is(k + 1, ...AFTER_TU_A_WORD) &&
      !(is(k + 1, 'nhân') && is(k + 2, ...AFTER_NHAN_A_WORD));
    /** `tens` and the units digit at `k`, if any ("mươi [mốt]", "mười [lăm]"). */
    const unitsAfter = (tens: number, k: number): Tens => {
      if (tuStartsWordAt(k)) return { value: tens, end: k + 1, unsure: true };
      // Without accents "tu A" is "từ A" (from point A) or "tư A" (four amperes): unsure.
      if (folded && is(k, 'tư') && /^\p{Lu}$/u.test(words[k + 1]?.raw ?? '')) {
        return { value: tens, end: k + 1, unsure: true };
      }
      const u = get(viAfterTens, k);
      return u === undefined ? { value: tens, end: k } : { value: tens + u, end: k + 1 };
    };

    /** "mười [lăm]", "hai mươi [mốt]", "hai lăm" (spoken, with accents only). */
    const viTens = (i: number): Tens | null => {
      const d = get(viDigits, i);
      if (d !== undefined && d >= 2) {
        if (is(i + 1, 'mươi')) return unitsAfter(d * 10, i + 2);
        const u = folded ? undefined : get(viElided, i + 1);
        if (u !== undefined) return { value: d * 10 + u, end: i + 2 };
      }
      return is(i, 'mười') ? unitsAfter(10, i + 1) : null;
    };
    /** Below a thousand: "một trăm linh năm", "hai mươi ba", "mười"; "không trăm…" after a scale. */
    const viSegment = (i: number, afterScale: boolean): Segment | null => {
      const h = get(viDigits, i);
      const hundreds = is(i + 1, 'trăm') && (h !== undefined || (afterScale && is(i, 'không')));
      const base = hundreds ? (h ?? 0) * 100 : 0;
      const at = hundreds ? i + 2 : i;
      if ((hundreds || afterScale) && is(at, 'linh', 'lẻ')) {
        // "một trăm lẻ tư nhân hai": 104 × 2, or 100 and "tư nhân"? Nothing counts.
        if (tuStartsWordAt(at + 1)) {
          return { value: base, end: at + 2, full: true, scale: 1, unsure: true };
        }
        const u = get(viAfterZero, at + 1);
        if (u !== undefined) return { value: base + u, end: at + 2, full: true, scale: 1 };
      }
      const tens = viTens(at);
      if (tens) return { ...tens, value: base + tens.value, full: true, scale: 1 };
      if (hundreds) return { value: base, end: at, full: true, scale: 100 };
      // A lone digit; after "trăm" it stays apart ("hai trăm năm" may be two hundred years).
      return h === undefined ? null : { value: h, end: i + 1, full: false, scale: 1 };
    };

    const enBelow100 = (i: number): { value: number; end: number } | null => {
      const teen = get(enTeens, i);
      if (teen !== undefined) return { value: teen, end: i + 1 };
      const tens = get(enTens, i);
      const unit = get(enUnits, tens === undefined ? i : i + 1);
      if (tens !== undefined) {
        return unit === undefined
          ? { value: tens, end: i + 1 }
          : { value: tens + unit, end: i + 2 };
      }
      return unit === undefined ? null : { value: unit, end: i + 1 };
    };
    /**
     * "a" as one: "a hundred and twenty" 120, "a thousand" 1000. Not after "of" or a fraction:
     * "half a million" is no million.
     */
    const aOneAt = (k: number) =>
      is(k, 'a') &&
      (is(k + 1, 'hundred') || get(enScales, k + 1) !== undefined) &&
      !is(k - 1, 'of', ...EN_FRACTIONS);
    /** "five", "twenty-five", "one hundred and five", "twelve hundred", "a hundred". */
    const enSegment = (i: number, afterScale: boolean): Segment | null => {
      const below =
        !afterScale && aOneAt(i)
          ? { value: 1, end: i + 1 }
          : enBelow100(afterScale && is(i, 'and') ? i + 1 : i);
      if (!below) return null;
      if (!is(below.end, 'hundred')) return { ...below, full: true, scale: 1 };
      const rest = enBelow100(is(below.end + 1, 'and') ? below.end + 2 : below.end + 1);
      // "between one hundred and two hundred": two numerals (a range), not 102. Nothing counts.
      if (rest && (is(rest.end, 'hundred') || get(enScales, rest.end) !== undefined)) {
        return { value: below.value * 100, end: rest.end + 1, full: true, scale: 1, unsure: true };
      }
      return rest
        ? { value: below.value * 100 + rest.value, end: rest.end, full: true, scale: 1 }
        : { value: below.value * 100, end: below.end + 1, full: true, scale: 100 };
    };

    /** Segments joined by falling scale words: "ba triệu hai trăm nghìn", "ba nghìn tỷ". */
    const numeral = (
      i: number,
      segment: (i: number, afterScale: boolean) => Segment | null,
      scales: Map<string, number>,
    ): Segment | null => {
      const first = segment(i, false);
      if (!first || first.unsure) return first;
      let total = 0;
      let { value: current, end, scale } = first;
      let previous = Infinity;
      for (;;) {
        const s = scaleAt(scales, end);
        if (s === undefined) break;
        if (s === 10 && !(current > 0 && current < 10)) {
          // "chục" follows one digit only: "mười hai chục", "hai trăm chục" are unsure.
          return { value: total + current, end: end + 1, full: true, scale: s, unsure: true };
        }
        if (current > 0 && s < previous) {
          total += current * s;
          current = 0;
        } else if (current === 0 && s > previous) {
          total *= s; // a compound scale: "nghìn tỷ"
        } else if (current > 0 && previous !== Infinity) {
          // "one thousand and two thousand", "hai nghìn ba nghìn": a second numeral of the same or
          // a higher scale (a range), never one number. Nothing counts.
          return { value: total + current, end: end + 1, full: true, scale: s, unsure: true };
        } else break;
        previous = s;
        scale = s;
        end += 1;
        const next = segment(end, true);
        if (!next) continue;
        // "hai chục mười lăm", "hai chục một trăm mét": "chục" takes no numeral after it (only
        // "rưỡi" or a higher scale word), so two numerals are never added up: nothing counts.
        // "hai chục năm trước": "năm" is the year there; the main loop decides.
        if (s === 10 && !next.full && is(end, 'năm')) break;
        if (s === 10) return { value: total, end: next.end, full: true, scale: s, unsure: true };
        // "ba nghìn hai mươi tư thế": the whole numeral is unsure.
        if (next.unsure) return next;
        const after = scaleAt(scales, next.end);
        if (!next.full && !(after !== undefined && after < previous)) break;
        ({ value: current, end, scale } = next);
      }
      return { value: total + current, end, full: true, scale };
    };
    const numeralAt = (i: number) =>
      numeral(i, viSegment, viScales) ?? numeral(i, enSegment, enScales);
    const isHalf = (k: number) => is(k, 'rưỡi', 'rưởi');
    /** A number word at `k` ("hai", "mươi", "trăm", "tư", "seven"…). */
    const numberWordAt = (k: number) =>
      is(k, ...NUMERAL_WORDS) ||
      [viDigits, viAfterTens, enUnits].some((table) => get(table, k) !== undefined);
    /** The word at `k` comes right after a number, in words or in digits ("một năm", "Sau 3 năm"). */
    const afterNumber = (k: number) => {
      const w = words[k];
      if (!w) return false;
      return numberWordAt(k - 1) || /\d[^\S\r\n]*$/u.test(text.slice(0, w.end - w.raw.length));
    };
    /**
     * A word at `k` that, in speech, may end the number right before it: a digit, "mốt", "lăm",
     * "tư" ("hai tư" 24, "hai trăm hai" 220, "một trăm mốt" 110, "một nghìn tư" 1400).
     */
    const endsInSpeechAt = (k: number) =>
      get(viDigits, k) !== undefined || get(viAfterTens, k) !== undefined;
    /**
     * Where a spoken pair or range that goes on at `k` ends: the numeral at `k` and any digit words
     * after it ("hai ba người", "Mot bon muoi lit": no 10 either). It stops before "năm" (a year).
     */
    const skipSpoken = (k: number): number => {
      let at = k;
      do {
        at = numeralAt(at)?.end ?? at + 1;
      } while (endsInSpeechAt(at) && !is(at, 'năm'));
      return at;
    };
    /**
     * The numeral at `k` goes on a "trăm" or a scale word with no digit before it: "trăm hai" 120,
     * "nghìn hai" 1200, "vài nghìn hai trăm", "hundred and twenty" (not "năm phần trăm").
     */
    const afterBareScale = (k: number) =>
      (is(k - 1, 'trăm') && !is(k - 2, 'phần')) ||
      is(k - 1, 'hundred') ||
      get(viScales, k - 1) !== undefined ||
      get(enScales, k - 1) !== undefined ||
      (is(k - 1, 'and') && (is(k - 2, 'hundred') || get(enScales, k - 2) !== undefined));
    /** The word at `k` starts the text, a line, a sentence or a list item. */
    const sentenceStartAt = (k: number) => {
      const w = words[k];
      return (
        w !== undefined &&
        /(?:^|[.!?:;…)\r\n])[\s"'“”‘’«»([{*•–—-]*$/u.test(text.slice(0, w.end - w.raw.length))
      );
    };
    const capitalAt = (k: number) => /^\p{Lu}/u.test(words[k]?.raw ?? '');
    /**
     * A lone digit word at `k` that is a name: capitalised inside a sentence ("anh Ba", "chú Bảy",
     * "bạn Nam"), "Ba Lan" (Poland), and without accents a capitalised "Nam" anywhere ("Nam lan
     * luot tha…": Nam in turn, or "Năm lần"?).
     */
    const nameAt = (k: number) =>
      (capitalAt(k) && (!sentenceStartAt(k) || (folded && is(k, 'năm')))) ||
      (is(k, 'ba') && is(k + 1, 'lan') && capitalAt(k + 1));
    /** A count word at `k`: "người", "quả", "tuổi", "học sinh"… */
    const countWordAt = (k: number) =>
      is(k, ...COUNT_WORDS) ||
      COUNT_PAIRS.some(([first = '', second = '']) => is(k, first) && is(k + 1, second));
    /**
     * "năm" right after the numeral `num` may be five, not the year, so the numeral is unsure:
     * before a unit or a count word ("bốn năm lần", "mười năm phút": 15 said with an "n"?), after
     * "chục", "trăm" or a scale word unless "rưỡi" or a word settles it ("hai trăm năm trước"; not
     * "Em ra hai trăm năm", 250 in speech), and before a number word that would go on with it
     * ("bốn năm nghìn", "hai mươi năm sáu"; not "một năm hai tháng", a year and two months).
     */
    const yearUnsure = (num: Segment): boolean => {
      const after = num.end + 1;
      if (isHalf(after)) return false;
      if (unitAt(after) || countWordAt(after)) return true;
      if (num.scale >= 10) return numberWordAt(after) || !is(after, ...YEAR_AFTER);
      if (is(num.end - 1, 'mươi', 'mười')) return numberWordAt(after);
      return numberWordAt(after) && get(viDigits, after) === undefined && !is(after, 'mười');
    };
    /** The numeral `num` at `i` ends in a units digit ("mười hai", "hai mươi lăm", "hai lăm"). */
    const endsInUnitsDigit = (num: Segment, i: number) =>
      num.scale === 1 &&
      num.end - i >= 2 &&
      (get(viAfterTens, num.end - 1) !== undefined || get(viAfterZero, num.end - 1) !== undefined);

    /** Digit or numeral words from `k` on: an unsure decimal skips all of them. */
    const numberTail = (k: number): number => {
      let at = k;
      while (
        is(at, ...NUMERAL_WORDS) ||
        get(viDecimal, at) !== undefined ||
        get(enDecimal, at) !== undefined
      ) {
        at += 1;
      }
      return at;
    };
    /**
     * The decimal part after the numeral that starts at `i`, when "phẩy"/"point" is at `k`: its
     * digits and the word after them. `sure` false: nothing counts, up to `end`.
     */
    const decimalAt = (
      i: number,
      k: number,
    ): { digits: string; sure: boolean; end: number } | null => {
      const vi = is(k, 'phẩy');
      if (!vi && !is(k, 'point')) return null;
      let at = k + 1;
      let digits = '';
      let asNumeral = false;
      if (vi) {
        for (; is(at, 'không'); at += 1) digits += '0';
        // "ba phẩy mười bốn" 3,14, "chín phẩy tám mốt" 9,81: one numeral below a thousand.
        const below = viSegment(at, false);
        // "ba phẩy hai mươi tư thế": nothing counts.
        if (below?.unsure) return { digits, sure: false, end: below.end };
        if (below && (below.end > at + 1 || below.value >= 10)) {
          digits += String(below.value);
          at = below.end;
          asNumeral = true;
        }
      }
      if (!asNumeral) {
        const table = vi ? viDecimal : enDecimal;
        for (let d = get(table, at); d !== undefined; d = get(table, at)) {
          digits += String(d);
          at += 1;
        }
      }
      const goesOn = is(at, ...NUMERAL_WORDS) || (is(at, 'phần') && !is(at + 1, 'trăm'));
      if (digits === '') return goesOn ? { digits, sure: false, end: numberTail(at) } : null;
      const unsure =
        goesOn ||
        // "hai phẩy hai mươi năm": 2,20 years, or 2,205?
        (asNumeral && get(viDecimal, at) !== undefined) ||
        // "hai phẩy năm năm": 2,55, or 2,5 years? Only a unit after it settles it.
        (vi && !asNumeral && at - k > 2 && is(at - 1, 'năm') && !unitAt(at)) ||
        // "At one point two cars collided" is no decimal; "at one point five metres" is.
        (!vi && is(i - 1, 'at') && !unitAt(at)) ||
        // "Through one point two lines can be drawn": one point, two lines. One digit and a word
        // after it that is no unit: unsure ("one point five" at the end still counts).
        (!vi && digits.length === 1 && words[at] !== undefined && !unitAt(at));
      return unsure
        ? { digits, sure: false, end: numberTail(at) }
        : { digits, sure: true, end: at };
    };

    for (let i = 0; i < words.length;) {
      let num = numeralAt(i);
      if (num?.unsure) {
        // "hai mươi tư thế": neither 24 nor 20.
        i = num.end;
        continue;
      }
      /** Where to go on after the value: past the second half of a range ("mười hai ba tuổi"). */
      let resume = 0;
      if (num && is(num.end, 'mươi', 'trăm')) {
        // "năm mươi sáu mươi km/h" (50 to 60), "hai mươi ba mươi người", "mười hai trăm mét": two
        // numerals of a range run together. Neither counts, and no shorter value either.
        i = num.end + 1;
        continue;
      }
      if (num) {
        const lone = num.end === i + 1 && get(viDigits, i) !== undefined;
        if (lone && is(i, 'năm') && afterNumber(i)) {
          // "một năm", "Sau 3 năm": the year, no 5.
          i += 1;
          continue;
        }
        if (afterBareScale(i)) {
          // "trăm hai" 120, "nghìn hai" 1200, "hundred and twenty" 120: no 2 or 20.
          i = skipSpoken(i);
          continue;
        }
        if (lone && nameAt(i)) {
          // "anh Ba", "Ban Nam", "Ba Lan": a name, no 3 or 5.
          i += 1;
          continue;
        }
        if (is(i - 1, 'phần') && (!folded || numberWordAt(i - 2))) {
          // A denominator: "phần mười giây" (a tenth of a second), "mot phan muoi giay". Without
          // accents only after a number: "nguyen phan ba lan" (nguyên phân) is 3.
          i = num.end;
          continue;
        }
        if (
          is(num.end, ...EN_FRACTIONS) &&
          !(is(num.end, 'half') && is(num.end + 1, ...NOT_HALF_BEFORE))
        ) {
          // A numerator: "two thirds", "one tenth" ("one half" gives 0,5 from "half").
          i = num.end;
          continue;
        }
        if (is(num.end, ...ROUGH_AFTER)) {
          // "hai trăm mấy", "hai mươi mấy", "hai trăm lẻ", "ba lẻ năm" (3,05 or 305?): no value.
          i = numeralAt(num.end + 1)?.end ?? num.end + 1;
          continue;
        }
        if (is(num.end, ...MULTIPLIERS)) {
          // "hai vạn" (20 000), "hai tá" (24): no 2.
          i = num.end + 1;
          continue;
        }
        // Without accents "sau", "bay", "tam" alone are words ("Sau hai giay": after two seconds).
        const spoken = (lone && !(folded && is(i, ...DIGITS_LIKE_WORDS))) || num.scale >= 10;
        if (is(num.end, 'năm')) {
          // Right after a number "năm" is the year (five is "lăm" there): "hai năm", "hai trăm năm
          // trước", "hai nghìn năm rưỡi"; unless the word after it says otherwise ("bốn năm lần").
          if (yearUnsure(num)) {
            i = numeralAt(num.end)?.end ?? num.end + 1;
            continue;
          }
        } else if (endsInSpeechAt(num.end)) {
          if (spoken) {
            // "hai tư" 24, "hai trăm hai" 220, "một nghìn tư" 1400, "hai ba người" (two or three
            // people?): neither the shorter numeral nor what follows it counts, a whole numeral
            // included ("Mot bon muoi lit": no 10 either).
            i = skipSpoken(num.end);
            continue;
          }
          // "mười hai ba tuổi" (12 or 13), "hai mươi lăm sáu độ": the digit after it is the other
          // end of a range, no value; the numeral the learner wrote still counts.
          if (endsInUnitsDigit(num, i)) resume = skipSpoken(num.end);
        }
      }
      if (!num && is(i, 'không', 'zero') && decimalAt(i, i + 1)) {
        // "không phẩy năm", "zero point five".
        num = { value: 0, end: i + 1, full: true, scale: 1 };
      }
      if (!num) {
        const value = get(alone, i);
        const notValue =
          (is(i, 'đôi') && is(i + 1, ...NOT_PAIR_BEFORE)) ||
          (is(i, 'half') && is(i + 1, ...NOT_HALF_BEFORE)) ||
          // Without accents "doi" is also "đổi" (convert: "doi gio sang giay"): only "gap doi".
          (folded && is(i, 'đôi') && !is(i - 1, 'gấp')) ||
          // "an hour and a half": the half of a quantity before it (1,5 h), no 0,5.
          (is(i, 'half') && is(i - 1, 'a') && is(i - 2, 'and')) ||
          // "half a million", "half a hundred": no 0,5.
          (is(i, 'half') &&
            is(i + 1, 'a') &&
            (is(i + 2, 'hundred') || get(enScales, i + 2) !== undefined));
        // Without accents only "gap doi" counts after "gap": "gap nua" may be "gặp nữa" (meet again).
        const counts =
          !folded ||
          clear.has(words[i]?.key ?? '') ||
          unitAt(i + 1) ||
          (is(i - 1, 'gấp') && is(i, 'đôi'));
        if (value !== undefined && counts && !notValue) out.push(value);
        i += 1;
        continue;
      }
      const decimal = decimalAt(i, num.end);
      if (decimal && !decimal.sure) {
        i = decimal.end;
        continue;
      }
      let value = decimal ? Number(`${num.value}.${decimal.digits}`) : num.value;
      const spelledEnd = decimal ? decimal.end : num.end;
      let end = spelledEnd;
      let context = unitAt(end);
      let unsure = false;
      /** A half was read with the value ("hai rưỡi", "two and a half", "hai giờ rưỡi"). */
      let halfTaken = false;
      if (decimal) {
        if (!folded && is(end, 'phần') && is(end + 1, 'trăm')) {
          // "ba phẩy năm phần trăm": 3,5 %.
          context = true;
          end += 2;
        }
      } else if (isHalf(end)) {
        // "hai rưỡi" 2,5; "một trăm rưỡi" 150; "hai nghìn rưỡi" 2500.
        value += num.scale > 1 ? num.scale / 2 : 0.5;
        end += 1;
        halfTaken = true;
        context ||= !folded || unitAt(end);
      } else if (is(end, 'and') && is(end + 1, 'a') && is(end + 2, 'half')) {
        // "two and a half": 2,5. "two and a half thousand" (2500), "a million and a half": no value.
        value += 0.5;
        end += 3;
        halfTaken = true;
        context ||= unitAt(end);
        unsure = num.scale > 1 || is(end, 'hundred') || get(enScales, end) !== undefined;
      } else if (
        isHalf(end + 1) &&
        words[end] &&
        // "hai năm rưỡi" is 2,5 years: "năm" is the unit here, not the digit.
        (!numeralAt(end) || is(end, 'năm')) &&
        get(alone, end) === undefined
      ) {
        // "hai giờ rưỡi": half after the unit.
        value += 0.5;
        end += 2;
        halfTaken = true;
        context ||= !folded;
      } else if (!folded && is(end, 'phần')) {
        if (is(end + 1, 'trăm')) {
          // "năm phần trăm": 5 %.
          context = true;
          end += 2;
        } else {
          const below =
            numeralAt(end + 1) ??
            (is(end + 1, 'tư')
              ? { value: 4, end: end + 2, unsure: tuStartsWordAt(end + 1) }
              : null);
          if (below?.unsure) {
            // "ba phần tư nhân hai": 3/4 × 2, or three parts and "tư nhân"? Not even the 3 counts.
            unsure = true;
            end = below.end;
          } else if (below) {
            // "ba phần tư" = 3/4.
            value /= below.value;
            end = below.end;
            context = true;
          }
        }
      }
      if (!decimal && !halfTaken) {
        // "hai ki-lô-mét rưỡi", "hai cây số rưỡi", "two hours and a half": a half after a unit
        // of several words is not read, so the numeral gives nothing (never the 2 alone).
        for (let k = end; k < Math.min(words.length, end + 4); k += 1) {
          if (isHalf(k) || (is(k, 'and') && is(k + 1, 'a') && is(k + 2, 'half'))) {
            unsure = true;
            break;
          }
          if (numberWordAt(k)) break;
        }
      }
      const spelled = words.slice(i, spelledEnd).map((w) => w.key);
      // "một" is also "a", "năm" "year", "chín" "ripe": alone they need a unit or measure word.
      const needsContext = folded
        ? !spelled.some((w) => clear.has(w))
        : spelled.length === 1 && is(i, 'một', 'năm', 'chín');
      // Without accents "gap" is "gấp" (times) but also "gặp" (meet): "tang gap ba" counts without
      // a unit at the end of its run; "gap mot xe" (meets a car), "an gap nam", "An gap Nam" do not.
      const afterGap =
        folded &&
        is(i - 1, 'gấp') &&
        end === words.length &&
        !(spelled.length === 1 && is(i, 'một', 'năm')) &&
        !/^\p{Lu}/u.test(words[i]?.raw ?? '');
      // Without accents "sau", "bay", "tam" are ordinary words, also before "muoi" (mười, ten) and
      // after "gap" (gặp, meet): "Sau giay dau tien", "bay gio" (now), "Sau muoi giay" (after ten
      // seconds, not 60), "Hai xe gap sau muoi giay". "bon muoi" may be "bồn mười" (a tank of ten).
      // The whole numeral is skipped, not 10 either, even before a unit or after "gap".
      const ordinary =
        folded &&
        (is(i, ...DIGITS_LIKE_WORDS) ||
          (is(i, ...DIGITS_LIKE_WORDS_BEFORE_TEN) && is(i + 1, 'mươi')));
      if (!unsure && !ordinary && (afterGap || !needsContext || context)) out.push(value);
      i = Math.max(end, resume);
    }
  }
  return [...new Set(out)];
}
