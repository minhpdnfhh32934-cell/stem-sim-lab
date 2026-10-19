/**
 * Basic content checks before and after the AI (PROMPT_PHAN_2 A3). They run on this computer;
 * nothing they see is stored (the incident log keeps only the kind and the time).
 *
 * This is a first line of defence for a physics learning tool, not a full moderation system:
 * the AI providers also filter on their side. The lists are short and aimed at clear cases so
 * that normal problems ("máy bay thả bom…", "thuốc nổ TNT…") are not blocked.
 */

export type PersonalKind = 'phone' | 'email' | 'idNumber' | 'nameOrAddress';

export type InputCheck =
  | { ok: true }
  | { ok: false; reason: 'crisis' }
  | { ok: false; reason: 'personalData'; found: PersonalKind[] }
  | { ok: false; reason: 'unsafe' };

/** Lower case, NFC, single spaces: Vietnamese can be typed with composed or combined accents. */
export function normalize(text: string): string {
  return text.normalize('NFC').toLowerCase().replace(/\s+/g, ' ');
}

/** Word-ish boundary that also works with Vietnamese letters (JS `\b` is ASCII only). */
export const WORD_START = String.raw`(?<![\p{L}\p{N}])`;
export const WORD_END = String.raw`(?![\p{L}\p{N}])`;
const B = WORD_START;
const E = WORD_END;
const anyOf = (phrases: readonly string[], flags = 'u') =>
  new RegExp(`${B}(?:${phrases.join('|')})${E}`, flags);

/** Signs that someone may be in crisis: show the support card, do not send to the AI. */
const CRISIS = anyOf([
  'muốn chết',
  'muốn tự tử',
  'tự tử',
  'tự sát',
  'không muốn sống',
  'chẳng muốn sống',
  'kết thúc cuộc đời',
  'kết liễu (?:bản thân|đời mình)',
  'tự làm hại (?:bản thân|mình)',
  'tự làm đau (?:bản thân|mình)',
  'rạch tay',
  'kill myself',
  'want to die',
  'suicide',
  'suicidal',
  'self[- ]harm',
  'hurt myself',
]);

/**
 * Textbook biology terms that contain a crisis word but are about cells, not people: the
 * lysosome's name "túi tự sát" ("suicide bag") and apoptosis ("tế bào tự sát", "cell suicide").
 * They are taken out before the crisis check only, so a real crisis sentence is still caught.
 */
const CELL_TERMS = anyOf(
  ['túi tự sát', '(?:tế bào|cell|cellular) (?:tự sát|suicide)', 'suicide (?:bag|bags|sac|sacs)'],
  'gu',
);

function crisisIn(n: string): boolean {
  return CRISIS.test(n.replace(CELL_TERMS, ' '));
}

/** Clearly unsuitable requests (intent phrases only, never single physics/chemistry words). */
const UNSAFE = anyOf([
  'khiêu dâm',
  'ảnh nóng',
  'clip nóng',
  // Intent phrases only: "sex chromosomes", "sex-linked", "sex determination" are biology.
  '(?:phim|clip|ảnh|hình|truyện|video|web|trang|chat) sex',
  'sex (?:video|clip|tape|chat|story|stories|pics?|photos?|images?|movies?|sites?)',
  'hav(?:e|ing) sex',
  'sexting',
  'porn\\w*',
  'nude\\w*',
  '(?:cách|hướng dẫn) (?:làm|chế tạo|chế|tự chế) (?:bom|mìn|súng|thuốc nổ)',
  '(?:chế tạo|tự chế) (?:bom|mìn|súng)',
  'how to (?:make|build) (?:a )?(?:bomb|gun|explosive)s?',
  '(?:cách|hướng dẫn) (?:điều chế|làm|nấu) (?:ma túy|ma tuý|heroin)',
  'mua ma túy',
  'mua ma tuý',
  '(?:cách|hướng dẫn) (?:hack|trộm|ăn trộm|lừa đảo)',
  'giết (?:người|nó|hắn|bạn|cô|thầy)',
]);

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.[a-z]{2,}/iu;
/**
 * A run of digit groups separated by one space, dot or dash ("0912 345 678", "+84 912.345.678",
 * but also a data row "0 3 6 9 12"). `phoneIn` decides whether part of it is a phone number.
 */
const DIGIT_RUN = /(?<![\p{N},.+])(\+84[\s.-]?)?\d+(?:[\s.-]\d+)*/gu;

/**
 * Real Vietnamese phone groupings: 0 + a digit 2–9 + 8 more digits (10 in all; after +84, 9),
 * written together or as 0xx/0xxx followed by groups of 2–4 digits. A single-digit group never
 * belongs to a phone number, so data tables ("0 3 6 9 12 15 18 21") and decimals ("0.523598776")
 * are not phone numbers.
 */
function phoneGroups(groups: readonly string[], intl: boolean): boolean {
  const want = intl ? 9 : 10;
  const first = groups[0] ?? '';
  if (!(intl ? /^[2-9]/ : /^0[2-9]/).test(first)) return false;
  if (first.length === want) return true;
  if (first.length < (intl ? 2 : 3) || first.length > (intl ? 3 : 4)) return false;
  let digits = first.length;
  for (const g of groups.slice(1)) {
    if (g.length < 2 || g.length > 4) return false;
    digits += g.length;
    if (digits === want) return true;
    if (digits > want) return false;
  }
  return false;
}

function phoneIn(n: string): boolean {
  for (const m of n.matchAll(DIGIT_RUN)) {
    const prefix = m[1] ?? '';
    // [group, separator, group, separator, …]
    const parts = m[0].slice(prefix.length).split(/([\s.-])/);
    for (let i = 0; i < parts.length; i += 2) {
      // A number starts the run or follows a space, never "0." / "0-" (a decimal, a range).
      if (i > 0 && parts[i - 1] !== ' ') continue;
      const groups = parts.slice(i).filter((_, j) => j % 2 === 0);
      if (phoneGroups(groups, prefix !== '' && i === 0)) return true;
    }
  }
  return false;
}
/**
 * Citizen ID (CCCD) numbers have 12 digits. Round physics values written out in full
 * ("300000000000") end in many zeros and are not flagged.
 */
const ID_NUMBER = /(?<![\p{N},.])(?!\d{6}0{6})\d{12}(?![\p{N},.])/u;
const ID_WORD = anyOf(['cccd', 'cmnd', 'căn cước', 'chứng minh nhân dân', 'số định danh']);
const NAME_OR_ADDRESS = anyOf([
  '(?:tên|họ tên) (?:tôi|em|mình|tớ|con|cháu) là',
  '(?:tôi|em|mình|tớ|con|cháu) tên là',
  'nhà (?:tôi|em|mình|tớ|con|cháu) ở',
  '(?:tôi|em|mình|tớ|con|cháu) (?:sống|ở) tại',
  'địa chỉ (?:nhà|của (?:tôi|em|mình))',
  'số nhà',
  'my name is',
  'i live at',
]);

export function findPersonalData(text: string): PersonalKind[] {
  const n = normalize(text);
  const found: PersonalKind[] = [];
  if (phoneIn(n)) found.push('phone');
  if (EMAIL.test(n)) found.push('email');
  if (ID_NUMBER.test(n) || ID_WORD.test(n)) found.push('idNumber');
  if (NAME_OR_ADDRESS.test(n)) found.push('nameOrAddress');
  return found;
}

/** Checks a problem before it is sent to the AI. Crisis comes first: it needs a kind answer. */
export function checkInput(text: string): InputCheck {
  const n = normalize(text);
  if (crisisIn(n)) return { ok: false, reason: 'crisis' };
  const found = findPersonalData(text);
  if (found.length > 0) return { ok: false, reason: 'personalData', found };
  if (UNSAFE.test(n)) return { ok: false, reason: 'unsafe' };
  return { ok: true };
}

/**
 * Checks text written by the AI before it is shown. Hidden when it is unsuitable, talks about
 * self-harm, or contains contact details (the AI must never ask for or repeat them).
 */
export function outputIsSafe(text: string): boolean {
  const n = normalize(text);
  return !UNSAFE.test(n) && !crisisIn(n) && !EMAIL.test(n) && !phoneIn(n);
}
