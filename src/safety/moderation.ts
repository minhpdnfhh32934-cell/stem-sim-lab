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
const B = String.raw`(?<![\p{L}\p{N}])`;
const E = String.raw`(?![\p{L}\p{N}])`;
const anyOf = (phrases: readonly string[]) => new RegExp(`${B}(?:${phrases.join('|')})${E}`, 'u');

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

/** Clearly unsuitable requests (intent phrases only, never single physics/chemistry words). */
const UNSAFE = anyOf([
  'khiêu dâm',
  'ảnh nóng',
  'clip nóng',
  'phim sex',
  'sex',
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
 * Vietnamese phone numbers: 0 or +84, then a non-zero digit and 8 more digits, optionally
 * grouped with spaces, dots or dashes. Decimal numbers ("0,25", "0.000012") do not match: the
 * digit after the leading 0 must be 2–9.
 */
const PHONE = /(?<![\p{N},.])(?:\+84|0)[\s.-]?[2-9](?:[\s.-]?\d){8}(?![\p{N}])/u;
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
  if (PHONE.test(n)) found.push('phone');
  if (EMAIL.test(n)) found.push('email');
  if (ID_NUMBER.test(n) || ID_WORD.test(n)) found.push('idNumber');
  if (NAME_OR_ADDRESS.test(n)) found.push('nameOrAddress');
  return found;
}

/** Checks a problem before it is sent to the AI. Crisis comes first: it needs a kind answer. */
export function checkInput(text: string): InputCheck {
  const n = normalize(text);
  if (CRISIS.test(n)) return { ok: false, reason: 'crisis' };
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
  return !UNSAFE.test(n) && !CRISIS.test(n) && !EMAIL.test(n) && !PHONE.test(n);
}
