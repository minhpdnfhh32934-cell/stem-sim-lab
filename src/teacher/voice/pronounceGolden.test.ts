import { describe, expect, it } from 'vitest';
import golden from './pronounceGolden.json';
import { splitForSpeech, toSpeech } from './vietnameseText';

/**
 * Golden pronunciation set (audit G5, 2026-10-14): 40 sentences a teacher writes in physics,
 * maths, chemistry and biology, with the exact words the voice must receive. `pending` marks a
 * reading that depends on classroom convention: it is the most common one, but a teacher has not
 * confirmed it yet (the lead records these in docs/DATA_REVIEW.md).
 */
interface Golden {
  id: string;
  text: string;
  reading: string;
  pending?: true;
}

const GOLDEN = golden as Golden[];

/** Inputs of the 2026-10-13 audit (pronounce.audit.test.ts): they must stay clean too. */
const AUDIT_INPUTS = [
  'g = 9,81 m/s²',
  'F = m·a',
  '$a = \\frac{F}{m}$',
  'H2SO4 và CO2',
  'pH = 7',
  '25 °C',
  'v = 36 km/h',
  '1,6·10⁻¹⁹ C',
  'Δv = 5 m/s',
  'góc α = 30°',
  '50%',
  'NST 2n = 46',
  'x² + 2x + 1 = 0',
  'Kì sau I',
  'Kì đầu II của giảm phân',
  'Giảm phân II',
  '$v = \\frac{V_{max}[S]}{K_m + [S]}$',
  'NaCl (aq)',
  'H2O(l)',
  '$2H_2 + O_2 \\rightarrow 2H_2O$',
  'Xem tài liệu [1].',
  'Có 3 con mèo.',
  'Thời gian t (s) và quãng đường s (m).',
  'Khối lượng m (g)',
  'Thể tích V (l)',
  'Thể tích V1 (l) và V2 (l)',
  'Với 5 (s) thì',
  '| Thời gian (s) | Quãng đường (m) |\n|---|---|\n| 1 | 2 |',
  'CO2(k)',
  'O₂ (k)',
  'NaCl (dd)',
  'CaCO₃(r)',
  'Fe(OH)3 (r)',
  'Na⁺(aq)',
  'C(r) + O2(k) → CO2(k)',
  'S(r) + O₂(k)',
  'C(s) + O2(g) → CO2(g)',
  '2K(r) + 2H2O(l)',
  'Thể tích V (l) = 2',
  'Khối lượng M(g)',
  'Hàm số liên tục trên đoạn [a, b].',
  '$x \\in [a, b]$',
  '[t₁; t₂]',
  'Xem [Wikipedia]',
  'Xem [SGK].',
  'Chọn [A, B]',
  '[H+]',
  '[OH-]',
  '[Na⁺]',
  '[H2O]',
  'Khi nồng độ cơ chất [S] tăng',
  'Nồng độ $[H^+]$ giảm',
  '$T_1 \\to T_2$',
  '$E_3 \\rightarrow E_2$',
  '$CH_4 + 2O_2 \\to CO_2 + 2H_2O$',
  '$Fe + S \\rightarrow FeS$',
  'Mỗi lần I tăng gấp đôi.',
  'Mỗi lần V tăng thì I giảm.',
  'Phân bào lần II',
  'Phân bào lần I.',
  'Đây là lần thứ II.',
];

/** Words that are not Vietnamese syllables but are how textbooks write or say them. */
const ALLOWED = new Set([
  // Units and loan words in the readings (jun, mol, pát-xcan, fa-ra, tes-la, mi-crô …).
  'jun',
  'mol',
  'xcan',
  'fa',
  'tes',
  'crô',
  'psi',
  'ple',
  'đrô',
  'xtanh',
  'plăng',
  // Science words written the Vietnamese way.
  'axit',
  'electron',
  'enzim',
  'ion',
  'natri',
  'clo',
  // A proper name kept as written.
  'wikipedia',
]);

const ONSET = String.raw`(?:ngh|ng|gh|gi|kh|nh|ph|th|tr|ch|qu|[bcdđghklmnprstvx])?`;
const NUCLEI = new Set(
  (
    'a ă â e ê i o ô ơ u ư y ai ao au âu ay ây eo êu ia iê iu oa oă oe oi ôi ơi oo ua uâ uê ui ' +
    'uô uơ uy ưa ưi ưu ươ yê iêu oai oay oao oeo uây uôi uya uyê uyu ươi ươu yêu'
  ).split(' '),
);
const SYLLABLE = new RegExp(String.raw`^(${ONSET})([aăâeêioôơuưy]+)(ch|nh|ng|[cmnpt])?$`, 'u');

/**
 * A written Vietnamese syllable: onset + vowel nucleus + optional final consonant, and a final
 * p/t/c/ch only with the sắc or nặng tone ("át", "ạt", never "at"). Catches raw tokens such as
 * "at", "ac", "Fe", "AaBb", "mARN", "Vmax", "cos", "log", "km".
 */
function isSyllable(token: string): boolean {
  const nfd = token.toLowerCase().normalize('NFD');
  const stopTone = /[̣́]/u.test(nfd);
  const base = nfd.replace(/[̣̀́̃̉]/gu, '').normalize('NFC');
  for (const onsetFirst of [true, false]) {
    // "gi" is an onset ("gia") or g + the vowel i ("gì"): try both.
    const m = onsetFirst
      ? SYLLABLE.exec(base)
      : /^(g)(i[aăâeêioôơuưy]*)(ch|nh|ng|[cmnpt])?$/u.exec(base);
    if (!m) continue;
    const [, , nucleus = '', coda = ''] = m;
    if (!NUCLEI.has(nucleus)) continue;
    if (/^(?:c|ch|p|t)$/.test(coda) && !stopTone) continue;
    return true;
  }
  return false;
}

function tokens(spoken: string): string[] {
  return spoken
    .split(/[\s\-–]+/u)
    .map((t) => t.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ''))
    .filter(Boolean);
}

const NUMBER_WORD =
  'không|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười|mươi|mốt|tư|lăm|linh|trăm|nghìn|triệu|tỷ';
/** A period between two number words: a decimal or a multiplication dot read as a sentence end. */
const DOT_IN_NUMBER = new RegExp(String.raw`(?:${NUMBER_WORD})\.\s*(?:${NUMBER_WORD}|nhân)\b`, 'u');

describe('golden pronunciation set', () => {
  it.each(GOLDEN.map((g) => [g.id, g] as const))('%s', (_id, g) => {
    expect(toSpeech(g.text)).toBe(g.reading);
  });

  it('marks the readings that wait for a teacher', () => {
    expect(GOLDEN).toHaveLength(40);
    expect(GOLDEN.filter((g) => g.pending).map((g) => g.id)).toEqual([
      'P13',
      'M03',
      'M04',
      'M05',
      'M07',
      'C06',
      'B01',
      'B02',
      'B04',
      'B08',
    ]);
  });
});

describe('the voice only ever receives Vietnamese words', () => {
  const corpus = [...GOLDEN.map((g) => g.text), ...AUDIT_INPUTS];

  it('the syllable checker knows a Vietnamese syllable from a raw token', () => {
    for (const ok of ['gờ', 'phẩy', 'nghìn', 'giây', 'gì', 'oát', 'xích', 'khuya', 'trường'])
      expect(isSyllable(ok), ok).toBe(true);
    for (const raw of ['at', 'ac', 'fe', 'aabb', 'marn', 'vmax', 'cos', 'log', 'km', 'fs', 'al'])
      expect(isSyllable(raw), raw).toBe(false);
  });

  it.each(corpus.map((text) => [text] as const))('%s', (text) => {
    const out = toSpeech(text);
    expect(out).not.toMatch(/\d/);
    expect(out).not.toMatch(/[$\\[\]{}^_↑↓∈→]/u);
    expect(out).not.toMatch(DOT_IN_NUMBER);
    const raw = tokens(out).filter((t) => !isSyllable(t) && !ALLOWED.has(t.toLowerCase()));
    expect(raw).toEqual([]);
  });
});

describe('sentence ends a teacher would not make', () => {
  const chunks = (text: string) => splitForSpeech(toSpeech(text)).map((c) => c.text);

  it('reads "tr." as "trang" and keeps the pause after "v.v."', () => {
    expect(chunks('Theo SGK tr. 45, ta có v.v. Vậy F = 10 N.')).toEqual([
      'Theo sách giáo khoa trang bốn mươi lăm, ta có vân vân.',
      'Vậy ép bằng mười niu-tơn.',
    ]);
    expect(toSpeech('các lực ma sát, lực cản v.v. đều cản trở')).toBe(
      'các lực ma sát, lực cản vân vân đều cản trở',
    );
  });

  it('keeps answer options and numbered steps whole', () => {
    expect(chunks('Chọn đáp án đúng:\nA. 10 m/s\nB. 20 m/s')).toEqual([
      'Chọn đáp án đúng:',
      'a, mười mét trên giây',
      'bê, hai mươi mét trên giây',
    ]);
    expect(chunks('A. 10 m/s B. 20 m/s C. 30 m/s D. 40 m/s')).toEqual([
      'a, mười mét trên giây',
      'bê, hai mươi mét trên giây',
      'xê, ba mươi mét trên giây',
      'đê, bốn mươi mét trên giây',
    ]);
    expect(chunks('Có hai bước: 1. Tính gia tốc. 2. Tính lực.')).toEqual([
      'Có hai bước:',
      'một, Tính gia tốc.',
      'hai, Tính lực.',
    ]);
    // A number that ends a sentence still ends it; "Chọn A." is an answer, not an option list.
    expect(chunks('Kết quả là 5. Vậy chọn A. Hết.')).toEqual([
      'Kết quả là năm.',
      'Vậy chọn a.',
      'Hết.',
    ]);
  });

  it('reads set membership and intervals', () => {
    expect(toSpeech('x ∈ [0; 1]')).toBe('ích thuộc đoạn từ không đến một');
    expect(toSpeech('$x \\in [a, b]$')).toBe('ích thuộc đoạn từ a đến bê');
    expect(toSpeech('Hàm số liên tục trên đoạn [a, b].')).toBe(
      'Hàm số liên tục trên đoạn từ a đến bê.',
    );
  });

  it('reads gas and precipitate arrows only in chemistry', () => {
    expect(toSpeech('BaCl₂ + Na₂SO₄ → BaSO₄↓ + 2NaCl')).toMatch(/bê a ét ô bốn kết tủa/);
    expect(toSpeech('Khi T ↑ thì V ↑')).toBe('Khi tê tăng thì vê tăng');
  });

  it('reads functions in plain text but keeps the word "tan"', () => {
    expect(toSpeech('tan 45° = 1')).toBe('tang bốn mươi lăm độ bằng một');
    expect(toSpeech('ln 2 ≈ 0,69')).toBe('lốc nê-pe hai xấp xỉ không phẩy sáu chín');
    expect(toSpeech('Muối tan trong nước')).toBe('Muối tan trong nước');
  });

  it('reads units without a number, spaced multiplication dots and genotypes', () => {
    expect(toSpeech('Đơn vị kg/m³ và g/cm³, N/m², km/h.')).toBe(
      'Đơn vị ki-lô-gam trên mét khối và gam trên xen-ti-mét khối, niu-tơn trên mét vuông, ki-lô-mét trên giờ.',
    );
    // A formula is not a unit.
    expect(toSpeech('a = F/m và ρ = m/V')).toBe('a bằng ép trên mờ và rô bằng mờ trên vê');
    expect(toSpeech('P = UI = 220 . 2 = 440 W.')).toBe(
      'pê bằng u i bằng hai trăm hai mươi nhân hai bằng bốn trăm bốn mươi oát.',
    );
    expect(toSpeech('Kiểu gen aa và Bb, AA × aa.')).toBe('Kiểu gen a a và bê bê, a a lai với a a.');
    expect(toSpeech('sin²x + cos²x = 1')).toBe(
      'sin bình phương ích cộng cốt bình phương ích bằng một',
    );
    expect(toSpeech('x ∈ ℝ, x ∉ [1; 2]')).toBe('ích thuộc rờ, ích không thuộc đoạn từ một đến hai');
    expect(toSpeech('Nồng độ 0,5M và 2 mM')).toBe(
      'Nồng độ không phẩy năm mol trên lít và hai mi-li-mol trên lít',
    );
  });

  it('keeps plain Vietnamese words and symbols outside chemistry', () => {
    expect(toSpeech('Ta có: Ba vật cùng rơi.')).toBe('Ta có: Ba vật cùng rơi.');
    expect(toSpeech('Ba kim loại Na, K và Ca.')).toBe('Ba kim loại nờ a, ca và xê a.');
    expect(toSpeech('Kim loại kiềm: Li, Na, K.')).toBe('Kim loại kiềm: lờ i, nờ a, ca.');
    expect(toSpeech('Cho Ba vào dung dịch HCl.')).toBe('Cho bê a vào dung dịch hát xê lờ.');
    expect(toSpeech('Phương án A. sai, phương án B. đúng.')).toBe(
      'Phương án a. sai, phương án bê. đúng.',
    );
    expect(toSpeech('Cấu hình [Ar] 3d⁶ 4s²')).toBe('Cấu hình a rờ, ba đê sáu, bốn ét hai');
  });
});
