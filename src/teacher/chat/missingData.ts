/**
 * "Tính quãng đường ô tô đi được." — a calculation request that gives no number at all. In the
 * 2026-10-13 evaluation Gemma 1B never asked for the missing data (0/3): it invented "60 km/h"
 * and "khoảng 50 km" instead. The app finds these questions itself (no AI), tells the model to ask
 * for the data instead of assuming values, and shows the learner its own notice.
 *
 * Deliberately conservative: a false alarm would scold a learner whose question was fine, so
 * anything that might carry data — a digit, a number word, a symbol ("v", "t"), "=", "%", a
 * chemical formula, numbers earlier in the conversation, the shared screen — means "not missing".
 * Questions about a method ("Tính như thế nào?", "Công thức tính động năng là gì?") and standard
 * constants ("gia tốc rơi tự do ở mặt đất", "khối lượng mol của nước") are not requests for data.
 * A problem that gives some numbers but not enough (P11-style) is not detected here: that needs
 * the problem to be solved, so it stays with the teaching prompt.
 */
import { FormulaError, parseFormula } from '@/chemistry/formula';

/** Lower case, no marks, "đ" → "d": learners often type without accents. */
function fold(word: string): string {
  return word.normalize('NFD').toLowerCase().replace(/\p{M}/gu, '').replace(/đ/g, 'd');
}

function wordsOf(text: string): string[] {
  return text.normalize('NFC').match(/[\p{L}\p{M}\p{N}₀-₉]+/gu) ?? [];
}

/** A verb that asks the app to compute ("tính", "tìm", "xác định", "calculate"…). */
const VERBS_VI = ['tinh', 'tim', 'xac dinh'];
const VERBS_EN = ['calculate', 'compute', 'find', 'determine', 'work out'];
const VERBS = [...VERBS_VI, ...VERBS_EN];

/** Words that may sit between the verb and the quantity ("Tính giúp em quãng đường…"). */
const FILLERS = new Set(
  `giup em minh to toi voi ra lai duoc cho xem thu nhe me for us please`.split(' '),
);

/** Quantities a learner asks to compute (folded words). */
const QUANTITIES =
  `quang duong|do dai|chieu dai|khoang cach|do cao|van toc|toc do|gia toc|thoi gian|
  luc|khoi luong|trong luong|nong do|so mol|the tich|ap suat|nhiet do|nhiet luong|cong suat|cong|
  nang luong|dong nang|the nang|co nang|dong luong|cuong do|dien tro|hieu dien the|dien ap|
  dien tich|dien nang|chu ki|chu ky|tan so|buoc song|bien do|ti le|ty le|phan tram|ph|
  khoi luong rieng|hieu suat|do lon|so nhiem sac the|so nst|so te bao|so lien ket|so nucleotit|
  so nu|so giao tu|so cay|so ca the|so phan tu|so nguyen tu|so electron|so proton|so notron|
  so hat|so vong|so lan|so luong|
  distance|length|height|speed|velocity|acceleration|time|force|mass|weight|concentration|
  number of moles|moles|volume|pressure|temperature|heat|power|work|energy|kinetic energy|
  potential energy|momentum|current|resistance|voltage|charge|period|frequency|wavelength|
  amplitude|number of|ratio|percentage|density|efficiency`
    .split('|')
    .map((q) => q.trim().split(/\s+/))
    .filter((q) => q.length > 0 && q[0] !== '');

/** Asking how to compute, for a formula or a definition: not a request with data. */
const METHOD =
  /\b(nhu the nao|the nao|bang cach nao|ra sao|lam sao|lam the nao|cach tinh|cach giai|cong thuc|la gi|nghia la|vi sao|tai sao|giai thich|y nghia|khai niem|dinh nghia|phu thuoc|how|formula|what is|what are|why|explain|meaning|define|definition)\b/u;

/** Problems answered from standard constants or data tables, not from the learner's numbers. */
const STANDARD =
  /\b(gia toc (roi tu do|trong truong)|toc do anh sang|van toc anh sang|hang so|so avogadro|khoi luong mol|nguyen tu khoi|phan tu khoi|dieu kien tieu chuan|dktc|dkc|trai dat|mat dat|mat troi|mat trang|nguoi|khong khi|cua nuoc|nuoc nguyen chat|chan khong|speed of light|gravitational acceleration|acceleration due to gravity|free[- ]fall acceleration|avogadro|molar mass|standard (conditions|temperature)|stp|earth|sun|moon|human|water|vacuum|air)\b/u;

/**
 * Number words: a learner may write the data in words ("hai giây", "gấp đôi"). Compared with
 * accents ("sau" is "after", "sáu" is "six"), folded only in a question typed without accents.
 */
const NUMBER_WORDS_LIST = `hai ba bốn năm sáu bảy tám chín mười mươi trăm nghìn ngàn triệu rưỡi
  nửa đôi gấp one two three four five six seven eight nine ten eleven twelve twenty thirty
  hundred thousand million half twice double triple dozen`.split(/\s+/);
const NUMBER_WORDS = new Set(NUMBER_WORDS_LIST.map((w) => w.normalize('NFC')));
const NUMBER_WORDS_FOLDED = new Set(NUMBER_WORDS_LIST.map(fold));

/** The text has Vietnamese accents (then words are compared with them). */
function accented(text: string): boolean {
  return /\p{M}|đ/iu.test(text.normalize('NFD'));
}

/** Element symbols and formulas ("NaOH", "CO₂", "Fe"): the data comes from tables. */
function isFormula(word: string): boolean {
  if (!/^[A-Z][A-Za-z₀-₉()]*$/u.test(word) || /^[A-Z][a-z]{2,}/.test(word)) return false;
  try {
    parseFormula(word.replace(/[₀-₉]/g, (d) => String(d.charCodeAt(0) - 0x2080)));
    return true;
  } catch (e) {
    if (e instanceof FormulaError) return false;
    throw e;
  }
}

/** The text may carry data: digits, number words, symbols, "=", "%" or a formula. */
function carriesData(text: string): boolean {
  if (/[\d₀-₉=%]/u.test(text)) return true;
  const withAccents = accented(text);
  return wordsOf(text).some(
    (w) =>
      (withAccents ? NUMBER_WORDS.has(w.toLowerCase()) : NUMBER_WORDS_FOLDED.has(fold(w))) ||
      // One Latin letter is a symbol ("v", "t", "F"); "a" and "I" are English words.
      (/^[A-Za-z]$/.test(w) && w !== 'a' && w !== 'A' && w !== 'I') ||
      isFormula(w),
  );
}

/** The quantity asked for, as the learner wrote it, when a verb asks to compute it. */
function requestedQuantity(question: string): string | null {
  const words = wordsOf(question);
  const folded = words.map(fold);
  for (let i = 0; i < folded.length; i++) {
    const verb = VERBS.find((v) => v.split(' ').every((part, k) => folded[i + k] === part));
    if (!verb) continue;
    // "tìm hiểu" (learn about) is not "tìm" (find).
    let j = i + verb.split(' ').length;
    if (folded[i] === 'tim' && folded[j] === 'hieu') continue;
    for (
      let skipped = 0;
      skipped < 4 && j < folded.length && FILLERS.has(folded[j] as string);
      skipped++
    )
      j++;
    // English "find the speed" (in Vietnamese "the" is "thể", as in "thể tích").
    if (VERBS_EN.includes(verb) && folded[j] === 'the') j++;
    const quantity = QUANTITIES.filter((q) => q.every((part, k) => folded[j + k] === part)).sort(
      (a, b) => b.length - a.length,
    )[0];
    if (quantity) return words.slice(j, j + quantity.length).join(' ');
  }
  return null;
}

export interface MissingData {
  /** The quantity the learner asked to compute ("quãng đường"). */
  quantity: string;
}

/**
 * The question asks to compute a quantity and nothing in it, in the last turns or on the shared
 * screen gives any number. Null otherwise (also whenever in doubt).
 */
export function missingNumericData(
  question: string,
  history: readonly { role: string; content: string }[] = [],
  screenShared = false,
): MissingData | null {
  if (screenShared) return null;
  const folded = wordsOf(question).map(fold).join(' ');
  if (METHOD.test(folded) || STANDARD.test(folded)) return null;
  if (carriesData(question)) return null;
  // Data given a few turns earlier ("Một ô tô chạy 20 m/s…" then "Tính quãng đường.").
  if (history.slice(-6).some((m) => carriesData(m.content))) return null;
  const quantity = requestedQuantity(question);
  return quantity ? { quantity } : null;
}
