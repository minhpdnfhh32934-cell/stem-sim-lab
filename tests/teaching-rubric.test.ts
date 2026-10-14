import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  asksForMissingData,
  buildConflicts,
  endsWithQuestion,
  fileRuns,
  fold,
  foreignScript,
  gpuRefusal,
  groupKey,
  inventedNumbers,
  mangledTerms,
  mcnemarP,
  namesMissing,
  numberRepeats,
  opensWithAgreement,
  pairedComparison,
  scoreAnswer,
  servedPromptVariant,
  signTestP,
  skipRefusal,
  stepsInOrder,
  summarize,
  summarizeRuns,
  trapHandled,
  variantRefusal,
  type AnswerScore,
  type EvalItem,
  type EvalRun,
} from '../scripts/teaching/rubric.mjs';

/** The AI Teacher evaluation set and its objective checks (audit EDU-02). */
const set = JSON.parse(
  readFileSync(resolve(import.meta.dirname, 'teaching/teaching-eval.json'), 'utf8'),
) as { items: EvalItem[]; review_status: string };

function item(id: string): EvalItem {
  const found = set.items.find((i) => i.id === id);
  if (!found) throw new Error(`${id} missing`);
  return found;
}

/** Items added on 2026-10-14 (missing data, step-by-step and trap questions). */
const NEW_IDS = [
  'P11',
  'P12',
  'P13',
  'P14',
  'C11',
  'C12',
  'C13',
  'C14',
  'B11',
  'B12',
  'B13',
  'B14',
];

const matches = (patterns: string[], text: string) =>
  patterns.some((p) => new RegExp(p).test(fold(text)));

describe('teaching evaluation set', () => {
  it('covers three subjects and every question type, 42 items', () => {
    expect(set.items.length).toBe(42);
    for (const subject of ['physics', 'chemistry', 'biology'] as const) {
      expect(set.items.filter((i) => i.subject === subject).length).toBe(14);
    }
    const types = new Set(set.items.map((i) => i.type));
    for (const t of [
      'concept',
      'problem',
      'missing-data',
      'misconception',
      'followup',
      'tool',
      'steps',
      'trap',
    ]) {
      expect(types).toContain(t);
    }
    expect(new Set(set.items.map((i) => i.id)).size).toBe(set.items.length);
    expect(set.review_status).toBe('pending');
  });

  it('has patterns that compile and well-formed item fields', () => {
    for (const i of set.items) {
      for (const p of [...i.keyFacts.flat(), ...i.mustNot, ...(i.missing ?? []).flat()]) {
        new RegExp(p);
      }
      if (i.answerUnit) new RegExp(i.answerUnit);
      for (const stage of i.steps ?? []) {
        for (const k of stage) expect(i.keyFacts[k], `${i.id} step ${k}`).toBeDefined();
      }
      for (const n of i.allowNumbers ?? []) expect(Number.isFinite(Number(n))).toBe(true);
      if (i.type === 'missing-data') {
        expect(i.expectsClarify, i.id).toBe(true);
        expect(i.missing?.length, i.id).toBeGreaterThan(0);
      }
      if (i.type === 'steps') {
        expect(i.steps?.length, i.id).toBeGreaterThan(1);
        expect(i.derivation, i.id).toBeTruthy();
      }
      if (i.type === 'trap') {
        expect(i.trap?.note, i.id).toBeTruthy();
        expect(i.keyFacts[0]?.length, i.id).toBeGreaterThan(0);
      }
    }
    for (const id of NEW_IDS) {
      expect(item(id).review_status).toBe('pending');
      expect(item(id).expected).toBeTruthy();
    }
  });

  // The numbers of the step-by-step and trap items, recomputed here: the answer key must accept
  // the right result and the mustNot patterns must catch the named mistakes.
  const comma = (x: number) => String(Math.round(x * 1000) / 1000).replace('.', ',');

  it('P13: braking distance 50 m (a = F/m, v² − v₀² = 2as, energy cross-check)', () => {
    const [m, v0, F] = [1000, 20, 4000];
    const a = F / m;
    const s = v0 ** 2 / (2 * a);
    const t = v0 / a;
    expect([a, s, t]).toEqual([4, 50, 5]);
    expect(v0 * t - 0.5 * a * t ** 2).toBe(s);
    expect((0.5 * m * v0 ** 2) / F).toBe(s);
    const p13 = item('P13');
    expect(p13.derivation).toContain(`${s} m`);
    expect(matches(p13.keyFacts[2] ?? [], `s = ${s} m`)).toBe(true);
    expect(scoreAnswer(p13, `Vậy s = ${s} m.`).noKnownErrors).toBe(true);
    // Named mistakes: s = v₀t, v₀t + ½|a|t², a sign error.
    for (const wrong of [v0 * t, v0 * t + 0.5 * a * t ** 2, -s]) {
      expect(scoreAnswer(p13, `Vậy s = ${comma(wrong).replace('-', '−')} m.`).noKnownErrors).toBe(
        false,
      );
    }
  });

  it('C13: 13,6 g ZnCl₂ from 6,5 g Zn (Zn = 65, Cl = 35,5)', () => {
    const n = 6.5 / 65;
    const M = 65 + 2 * 35.5;
    const mass = n * M;
    expect(n).toBeCloseTo(0.1, 12);
    expect(M).toBe(136);
    expect(mass).toBeCloseTo(13.6, 12);
    const c13 = item('C13');
    expect(c13.derivation).toContain('13,6 g');
    expect(matches(c13.keyFacts[4] ?? [], `m = ${comma(mass)} g`)).toBe(true);
    expect(matches(c13.keyFacts[4] ?? [], `m = ${comma(mass)} (g)`)).toBe(true);
    expect(matches(c13.keyFacts[3] ?? [], `M = ${M} g/mol`)).toBe(true);
    // Named mistakes: ZnCl (index 2 forgotten), the HCl coefficient, half the moles.
    for (const wrong of [n * (65 + 35.5), 2 * n * M, (n / 2) * M]) {
      expect(scoreAnswer(c13, `m = ${comma(wrong)} g.`).noKnownErrors).toBe(false);
    }
  });

  it('B13: 3120 hydrogen bonds for N = 2400, A = 20 %', () => {
    const N = 2400;
    const A = 0.2 * N;
    const G = N / 2 - A;
    const H = 2 * A + 3 * G;
    expect([A, G, H]).toEqual([480, 720, 3120]);
    expect(N + G).toBe(H);
    const b13 = item('B13');
    expect(b13.derivation).toContain(String(H));
    expect(matches(b13.keyFacts[3] ?? [], `H = ${H}`)).toBe(true);
    expect(matches(b13.keyFacts[3] ?? [], 'H = 3.120')).toBe(true);
    // Named mistakes: % of one strand, swapped coefficients, T forgotten.
    const wrongs = [
      2 * (0.2 * (N / 2)) + 3 * (0.3 * (N / 2)),
      3 * A + 2 * G,
      2 * A + 3 * ((N - A) / 2),
    ];
    expect(wrongs).toEqual([1560, 2880, 3840]);
    for (const wrong of wrongs) {
      expect(scoreAnswer(b13, `H = ${wrong}.`).noKnownErrors).toBe(false);
    }
  });

  it('C14 and C12: mixed concentration stays 1 M; a volume needs the conditions', () => {
    expect((0.1 * 1 + 0.1 * 1) / (0.1 + 0.1)).toBe(1);
    expect(item('C14').derivation).toContain('1 M');
    // C12: a volume at assumed conditions is an invented number (teacher decision pending).
    for (const v of [0.2 * 24.79, 0.2 * 22.4]) {
      expect(inventedNumbers(item('C12'), `V = ${comma(v)} L.`)).toEqual([comma(v)]);
    }
    expect(item('C12').expected).toMatch(/Giáo viên cần xác nhận/);
  });
});

/**
 * Answer-key fixes (report on the 2026-10-13 Gemma 3 1B run): each old pattern misjudged a real
 * sentence of the saved answers (eval-gemma3-1b.json). keyFacts: `oldHit` is what the old pattern
 * said for that group, the current group must say the opposite. mustNot: `oldHit` is whether the
 * old pattern flagged the sentence; the current noKnownErrors must equal it (a missed error is now
 * flagged, a wrongly flagged correct sentence is now accepted).
 */
const KEY_FIXES: {
  id: string;
  group?: number;
  old: string;
  oldHit: boolean;
  text: string;
}[] = [
  // Too loose: "huc" inside "công thức".
  {
    id: 'P8',
    group: 1,
    old: 'k ?.?\\|?.?x|k ?\\*? ?\\(?delta|hooke|huc',
    oldHit: true,
    text: 'Theo công thức, ΔPE = -F * l.',
  },
  // Too loose: "du" inside "duy".
  {
    id: 'B1',
    group: 2,
    old: 'giong|du|bo (nst|nhiem sac the)|2n',
    oldHit: true,
    text: 'Điều này giúp duy trì sự cân bằng gen và tránh những biến chứng không mong muốn.',
  },
  // Too loose: any "không".
  {
    id: 'C7',
    group: 0,
    old: 'khong',
    oldHit: true,
    text: 'Để xác định xem chất xúcatz đã làm tăng hoặc không làm tăng sự hình thành sản phẩm, chúng ta cần phân tích mối quan hệ giữa enthalpy (ΔrH°) và lượng sản phôi.',
  },
  {
    id: 'P9',
    group: 0,
    old: 'khong phu thuoc|khong',
    oldHit: true,
    text: 'Nếu chúng ta giả định rằng con shaken giản dị, thì L (khối lượng) không phụ thuộc trực tiếp vào góc phi.',
  },
  // Too loose: "hai" inside "phải".
  {
    id: 'C10',
    group: 1,
    old: '\\b2\\b|hai',
    oldHit: true,
    text: 'Vậy, vể trái 96, vê phải 3.',
  },
  // Too loose: "axit" in "tính axit hay bazơ" is not a conclusion.
  {
    id: 'C4',
    group: 0,
    old: 'axit|acid',
    oldHit: true,
    text: 'pH là thước đo tính axit hay bazơ của dung dịch.',
  },
  // Too strict: "thay đổi trong cấu trúc".
  {
    id: 'B6',
    group: 0,
    old: 'bien tinh|pha vo cau truc|thay doi cau truc|bien doi cau truc',
    oldHit: false,
    text: 'Nhiệt độ quá nóng làm enzyme bị phá hủy do sự thay đổi trong cấu trúc não vật chất.',
  },
  // Too strict mustNot: "chu kỳ" (y), "tỉ lệ nghịch với khối lượng".
  {
    id: 'P9',
    old: '(co|chu ki) phu thuoc vao khoi luong',
    oldHit: false,
    text: 'Khi con lắc đàn đơn dài, chu kỳ tự nhiên (T) của dao động tỉ lệ nghịch với khối lượng của quả nặng.',
  },
  // mustNot flagged a restated question.
  {
    id: 'P9',
    old: '(co|chu ki) phu thuoc vao khoi luong',
    oldHit: true,
    text: 'Chu kì của con lắc đơn có phụ thuộc vào khối lượng quả nặng không? Không: T = 2π√(l/g).',
  },
  // Too strict mustNot: "sẽ rơi nhanh hơn", and the reverse error.
  {
    id: 'P2',
    old: 'vat nang (roi )?nhanh hon',
    oldHit: false,
    text: 'Trong chân không (không có môi trường), vật nặng sẽ rơi nhanh hơn vật nhẹ vì lực hấp dẫn tác dụng lên cả hai vật đều là F = ma * g, nhưng ma (m) của vật nặng nhỏ hơn so với ma của vật nhẹ.',
  },
  {
    id: 'P2',
    old: 'vat nang (roi )?nhanh hon',
    oldHit: false,
    text: 'Do đó, vật nhẹ sẽ rơi nhanh hơn vật nặng trong chânnang.',
  },
  // mustNot flagged a correction.
  {
    id: 'P2',
    old: 'vat nang (roi )?nhanh hon',
    oldHit: true,
    text: 'Không phải vật nặng rơi nhanh hơn: trong chân không mọi vật rơi với cùng gia tốc g.',
  },
  // Too strict mustNot: "dung dịch là bazơ", "khả năng cao là **bazơ**".
  {
    id: 'C4',
    old: 'moi truong (bazo|kiem)\\b',
    oldHit: false,
    text: 'Nếu pH < 7 thì dung dịch là bazơ.',
  },
  {
    id: 'C4',
    old: 'moi truong (bazo|kiem)\\b',
    oldHit: false,
    text: 'Do đó, dung chất phụ gia có pH ≈ 3, có khả năng cao là **bazơ**.',
  },
  // mustNot flagged the pH scale itself.
  {
    id: 'C4',
    old: 'moi truong (bazo|kiem)\\b',
    oldHit: true,
    text: 'Dung dịch có pH > 7 mới là môi trường bazơ; pH = 3 < 7 nên dung dịch có môi trường axit.',
  },
  // Too strict mustNot: "Có, … luôn có hại".
  {
    id: 'B9',
    old: '(^|[.!?:,] )[*_ ]*dung([*_ ]*[.!,]| (vay|the|roi)\\b)',
    oldHit: false,
    text: 'Có, đột biến gen luôn có hại.',
  },
  // mustNot flagged reverse transcription, which is correct. No saved answer mentions it: this
  // sentence is a textbook one.
  {
    id: 'B8',
    old: 'arn ?(→|tao ra|thanh) ?adn',
    oldHit: true,
    text: 'Ngược lại, phiên mã ngược (ARN → ADN) chỉ gặp ở một số virut.',
  },
];

describe('answer-key fixes (saved Gemma 3 1B answers)', () => {
  for (const fix of KEY_FIXES) {
    const what = fix.group === undefined ? 'mustNot' : `keyFacts[${fix.group}]`;
    it(`${fix.id} ${what}: "${fix.text.slice(0, 50)}…"`, () => {
      expect(new RegExp(fix.old).test(fold(fix.text))).toBe(fix.oldHit);
      if (fix.group === undefined) {
        expect(scoreAnswer(item(fix.id), fix.text).noKnownErrors).toBe(fix.oldHit);
      } else {
        expect(matches(item(fix.id).keyFacts[fix.group] ?? [], fix.text)).toBe(!fix.oldHit);
      }
    });
  }

  it('still credits the correct statements', () => {
    const credited: [string, number, string][] = [
      ['P8', 1, 'F = k * x, trong đó:'],
      ['P8', 1, 'Theo định luật Húc, F = k·|Δl| = 100·0,1 = 10 N.'],
      ['B1', 2, 'Nhờ vậy mỗi tế bào con nhận đủ bộ NST giống tế bào mẹ.'],
      ['C7', 0, 'Không, xúc tác chỉ làm tăng tốc độ phản ứng, không làm tăng lượng sản phẩm.'],
      ['C7', 0, 'Không. Chất xúc tác chỉ làm phản ứng nhanh hơn.'],
      ['P9', 0, 'Không, chu kì không phụ thuộc vào khối lượng quả nặng.'],
      ['P9', 0, 'T = 2π√(l/g) không chứa m.'],
      ['C10', 1, 'Vế phải có 2 phân tử H₂O nên cũng có 2 nguyên tử O.'],
      ['C10', 1, 'Mỗi vế đều có 2 nguyên tử oxi.'],
      ['C4', 0, 'pH = 3 < 7 nên dung dịch có môi trường axit.'],
      ['C4', 0, 'Dung dịch này là **axit**.'],
      ['B6', 0, 'Nhiệt độ cao làm protein enzyme bị biến tính.'],
      // 2026-10-14: superscript and "×" forms were missed (found while writing the references).
      ['B5', 1, 'Sau 3 lần nguyên phân có 2³ = 8 tế bào con.'],
      ['B5', 1, 'Số tế bào con: 2 × 2 × 2 = 8.'],
    ];
    for (const [id, g, text] of credited) {
      expect(matches(item(id).keyFacts[g] ?? [], text), `${id} ${text}`).toBe(true);
    }
    // Wrong statements stay flagged; negated ones and the misconception sentence do not.
    expect(scoreAnswer(item('B9'), 'Phải, đột biến luôn gây hại.').noKnownErrors).toBe(false);
    expect(
      scoreAnswer(item('B9'), 'Đột biến gen không phải luôn có hại: có đột biến trung tính.')
        .noKnownErrors,
    ).toBe(true);
    expect(scoreAnswer(item('B8'), 'Phiên mã là quá trình ARN tạo ra ADN.').noKnownErrors).toBe(
      false,
    );
    expect(scoreAnswer(item('C4'), 'Môi trường bazơ.').noKnownErrors).toBe(false);
  });
});

describe('teaching rubric', () => {
  it('scores a good answer above a wrong one', () => {
    const good =
      'Ở kì trung gian (pha S), ADN nhân đôi nên mỗi nhiễm sắc thể có 2 cromatit. Nhờ vậy mỗi tế bào con nhận đủ bộ 2n giống tế bào mẹ. Lỗi hay gặp: nghĩ ADN nhân đôi trong kì đầu. Em thử trả lời: pha nào ADN nhân đôi?';
    const wrong = 'ADN nhân đôi xảy ra ở pha M rồi chia đều cho các tế bào.';
    const a = scoreAnswer(item('B1'), good);
    const b = scoreAnswer(item('B1'), wrong);
    expect(a.keyFacts).toBe(1);
    expect(a.facts).toEqual([true, true, true]);
    expect(a.noKnownErrors).toBe(true);
    expect(a.checkQuestion).toBe(true);
    expect(a.mangled).toEqual([]);
    expect(a.foreignScript).toBe(0);
    expect(b.noKnownErrors).toBe(false);
    expect(b.keyFacts).toBeLessThan(1);
    // Checks that do not apply to a concept question.
    expect([a.asksClarification, a.namesMissing, a.steps, a.trapHandled]).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  it('expects a clarifying question when data is missing', () => {
    expect(scoreAnswer(item('P5'), 'Quãng đường là 100 m.').asksClarification).toBe(false);
    const asks = scoreAnswer(
      item('P5'),
      'Em cho thầy biết vận tốc và thời gian chuyển động là bao nhiêu nhé?',
    );
    expect(asks.asksClarification).toBe(true);
    expect(asks.namesMissing).toBe(true);
    expect(scoreAnswer(item('P5'), 'Em cho thầy biết thêm dữ kiện nhé?').namesMissing).toBe(false);
    expect(summarize([scoreAnswer(item('P5'), 'Em cho biết vận tốc là bao nhiêu?')]).n).toBe(1);
  });

  it('does not count an answer that invents the missing numbers as asking for them', () => {
    // Audit finding: "Đề cho biết" + any "?" used to pass although the numbers were made up.
    const invented =
      'Đề cho biết ô tô chạy đều. Giả sử v = 20 m/s và t = 10 s, quãng đường s = 200 m. Em hiểu chưa?';
    expect(asksForMissingData(invented)).toBe(false);
    expect(scoreAnswer(item('P5'), invented).asksClarification).toBe(false);
    // "em chọn" folds to "em chon": not a request for data.
    expect(asksForMissingData('Em chọn công thức nào?')).toBe(false);
    // The request must be the question sentence itself.
    expect(asksForMissingData('Em cho thầy biết vận tốc. Em hiểu chưa?')).toBe(false);
    // Asking, then assuming values and computing anyway, still invents numbers.
    expect(
      asksForMissingData(
        'Em cho thầy biết vận tốc là bao nhiêu? Ví dụ v = 10 m/s, t = 5 s thì s = 50 m.',
      ),
    ).toBe(false);
    expect(
      asksForMissingData('Bạn có thể cung cấp thể tích dung dịch không? Nồng độ khoảng 2 M.'),
    ).toBe(false);
    // Real requests for the missing data.
    expect(asksForMissingData('Đề bài có cho vận tốc và thời gian không?')).toBe(true);
    expect(asksForMissingData('**Câu hỏi:** Em cho thầy biết thể tích dung dịch nhé?**')).toBe(
      true,
    );
    expect(asksForMissingData('Để tính, ta cần s = v·t. Ô tô chạy trong bao lâu?')).toBe(true);
    // Symbols are not invented values; "để cho" (so that) is not "đề cho".
    expect(
      asksForMissingData('Ví dụ, nếu biết v₀ và bộ 2n thì sao? Em cho thầy biết các số đó nhé?'),
    ).toBe(true);
    expect(asksForMissingData('Để cho dễ hiểu, em nghĩ quãng đường phụ thuộc gì?')).toBe(false);
  });

  it('does not count symbols, formula coefficients or given numbers as invented', () => {
    // Used to fail: "= 2n" and "s = 1/2·a·t²" were read as invented values.
    expect(
      asksForMissingData('Số NST trong tế bào con = 2n. Em cho thầy biết 2n là bao nhiêu?'),
    ).toBe(true);
    expect(
      asksForMissingData('Em cho thầy biết thời gian là bao nhiêu? Công thức s = 1/2·a·t².'),
    ).toBe(true);
    // A value given in the question may be repeated.
    expect(
      scoreAnswer(item('P11'), 'Đề cho v₀ = 20 m/s, v = 0. Em cho thầy biết gia tốc là bao nhiêu?')
        .asksClarification,
    ).toBe(true);
    // Without the question, the same 20 is new.
    expect(inventedNumbers({ question: '' }, 'Ta có v₀ = 20 m/s.')).toEqual(['20']);
    // A final number before the asked unit, an estimate, an assumption.
    expect(
      inventedNumbers(item('P11'), 'Quãng đường ô tô đi được là 40 m. Đề có cho gia tốc không?'),
    ).toEqual(['40']);
    expect(
      inventedNumbers(
        item('P11'),
        'Ta dùng v² − v₀² = 2as. Giả sử gia tốc a = −5 m/s² thì s = 40 m.',
      ),
    ).toEqual(['5', '40']);
    expect(inventedNumbers(item('C12'), 'Thể tích khoảng 4,48 lít.')).toEqual(['4,48']);
    // Thousands dots read both ways (3.120 = 3120).
    expect(inventedNumbers(item('B13'), 'H = 3.120.')).toEqual(['3.120']);
    expect(inventedNumbers({ question: 'N = 3120' }, 'H = 3.120.')).toEqual([]);
    // allowNumbers: the molar volume at standard conditions may be quoted.
    expect(inventedNumbers(item('C12'), 'Ở đkc, 1 mol khí chiếm 24,79 L/mol.')).toEqual([]);
  });

  it('reads a natural request for an amount as asking for data', () => {
    // Used to fail: "Em đã hòa tan bao nhiêu gam NaOH?" matched no request pattern.
    expect(asksForMissingData('Em đã hòa tan bao nhiêu gam NaOH?')).toBe(true);
    expect(asksForMissingData('Em đã dùng bao nhiêu ml dung dịch?')).toBe(true);
    const s = scoreAnswer(item('C11'), 'Em đã hòa tan bao nhiêu gam NaOH?');
    expect(s.asksClarification).toBe(true);
    expect(s.namesMissing).toBe(true);
  });

  it('needs the last sentence to be the question', () => {
    expect(
      endsWithQuestion(
        'Vậy vật đi được bao xa? Ta dùng s = v·t = 10·5 = 50 m. Kết quả cuối cùng là 50 m.',
      ),
    ).toBe(false);
    expect(endsWithQuestion('Em hiểu chưa? Chúc em học tốt!')).toBe(false);
    expect(endsWithQuestion('Gia tốc là 5 m/s². Em thử: lực tăng gấp đôi thì sao? 😊\n')).toBe(
      true,
    );
    expect(endsWithQuestion('**Câu hỏi kiểm tra:** pha nào ADN nhân đôi?**\n\n')).toBe(true);
  });

  it('does not read "em dùng" as praise of a wrong answer', () => {
    for (const id of ['P10', 'C10', 'B10']) {
      const followup = item(id);
      const errorsIn = (answer: string) => scoreAnswer(followup, answer).noKnownErrors;
      expect(errorsIn('Chưa đúng: em dùng sai quan hệ, hãy xem lại công thức.')).toBe(true);
      expect(errorsIn('Em trả lời chưa đúng.')).toBe(true);
      expect(errorsIn('Đúng rồi! Em làm tốt lắm.')).toBe(false);
      expect(errorsIn('Em trả lời đúng rồi.')).toBe(false);
      // Seen in the saved Gemma 1B answers: a bare "Đúng!" praising a wrong answer.
      expect(errorsIn('Đúng! Vì vậy kết quả của em hợp lý.')).toBe(false);
    }
    // Same folding trap in the agreement patterns: "tác dụng thế nào" is not "đúng thế".
    for (const id of ['P6', 'B9']) {
      const errorsIn = (answer: string) => scoreAnswer(item(id), answer).noKnownErrors;
      expect(errorsIn('Không phải. Dù các yếu tố tác dụng thế nào, hãy xét tổng thể.')).toBe(true);
      expect(errorsIn('Đúng vậy, em hiểu đúng.')).toBe(false);
      expect(errorsIn('Đúng. Điều đó luôn xảy ra.')).toBe(false);
    }
  });

  it('ignores a known wrong idea inside the misconception sentence', () => {
    const good =
      'Trong chân không mọi vật rơi với cùng gia tốc g, không phụ thuộc khối lượng. Lỗi hay gặp: nghĩ vật nặng rơi nhanh hơn. Em thử đoán: hòn bi và lông chim, vật nào chạm đất trước?';
    expect(scoreAnswer(item('P2'), good).noKnownErrors).toBe(true);
    expect(
      scoreAnswer(item('P2'), 'Vật nặng rơi nhanh hơn vì có trọng lượng lớn hơn.').noKnownErrors,
    ).toBe(false);
    // The marker only covers its own sentence.
    expect(
      scoreAnswer(item('P2'), 'Nhiều bạn nghĩ khác. Thật ra vật nặng rơi nhanh hơn.').noKnownErrors,
    ).toBe(false);
    expect(
      scoreAnswer(
        item('C7'),
        'Không, xúc tác chỉ làm phản ứng nhanh hơn. Sai lầm thường gặp: tin rằng xúc tác làm tăng lượng sản phẩm.',
      ).noKnownErrors,
    ).toBe(true);
  });
});

/** Hand-written answers to the new items: [label, answer, expected fields]. */
type Want = Partial<
  Pick<
    AnswerScore,
    | 'keyFacts'
    | 'noKnownErrors'
    | 'correct'
    | 'checkQuestion'
    | 'endsWithQuestion'
    | 'asksClarification'
    | 'namesMissing'
    | 'steps'
    | 'trapHandled'
    | 'invented'
  >
>;
const NEW_ITEM_CASES: Record<string, [string, string, Want][]> = {
  P11: [
    [
      'good',
      'Để tính quãng đường hãm phanh ta dùng v² − v₀² = 2as, với v₀ = 20 m/s và v = 0. Nhưng đề chưa cho gia tốc. Em cho thầy biết gia tốc (hoặc thời gian hãm phanh) là bao nhiêu nhé?',
      { asksClarification: true, namesMissing: true, keyFacts: 1, invented: [] },
    ],
    [
      'invents a',
      'Ta dùng v² − v₀² = 2as. Giả sử gia tốc a = −5 m/s² thì s = 40 m. Em cho thầy biết gia tốc thật là bao nhiêu nhé?',
      { asksClarification: false, invented: ['5', '40'] },
    ],
    [
      'final number, no "="',
      'Quãng đường ô tô đi được là 40 m. Đề có cho gia tốc không?',
      { asksClarification: false, invented: ['40'] },
    ],
    [
      'generic ask',
      'Bài này cần thêm dữ kiện. Em cho thầy biết thêm nhé?',
      { asksClarification: true, namesMissing: false },
    ],
    [
      'asks for the braking time',
      'Em cho thầy biết ô tô hãm phanh trong bao lâu thì dừng?',
      { asksClarification: true, namesMissing: true },
    ],
  ],
  P12: [
    [
      'good',
      'Đèn sáng bình thường nên U = 220 V. Muốn tính I ta dùng I = P/U, nhưng đề chưa cho công suất của đèn. Em xem trên bóng ghi bao nhiêu W rồi cho thầy biết nhé?',
      { asksClarification: true, namesMissing: true, keyFacts: 1 },
    ],
    [
      'assumes 100 W',
      'Bóng đèn thường là 100 W nên I = 100/220 ≈ 0,45 A. Em cho thầy biết công suất thật là bao nhiêu nhé?',
      { asksClarification: false, invented: ['0,45'] },
    ],
    [
      '"hoạt động" is not "oát"',
      'Em cho thầy biết đèn hoạt động thế nào nhé?',
      { namesMissing: false },
    ],
  ],
  P13: [
    [
      'good',
      'Bước 1: gia tốc a = −F/m = −4000/1000 = −4 m/s². Bước 2: dùng v² − v₀² = 2as với v = 0. Bước 3: s = 400/8 = 50 m. Kiểm tra: đơn vị m hợp lý. Em thử: nếu lực hãm gấp đôi thì quãng đường thay đổi thế nào?',
      {
        keyFacts: 1,
        steps: 1,
        noKnownErrors: true,
        correct: true,
        endsWithQuestion: true,
        // The check-question metric covers concept and misconception items only.
        checkQuestion: null,
      },
    ],
    [
      'energy route',
      'Động năng ban đầu ½mv₀² = 200 000 J. Theo định lý động năng, công của lực hãm bằng độ giảm động năng: F·s = 200 000 J, nên s = 50 m. Em thử tính thời gian hãm phanh nhé?',
      { keyFacts: 1, steps: 1 },
    ],
    [
      'substituted formula, units in brackets',
      'Gia tốc a = F/m = 4 (m/s²). Áp dụng 0 − 20² = 2·(−4)·s, suy ra s = 50 (m). Em hiểu chưa?',
      { keyFacts: 1, steps: 1, noKnownErrors: true },
    ],
    ['result only', 'Quãng đường là 50 m. Em hiểu chưa?', { steps: 0 }],
    [
      'wrong 100 m',
      'a = 4 m/s², t = 20/4 = 5 s, s = v₀·t = 100 m. Em hiểu chưa?',
      { noKnownErrors: false },
    ],
    [
      '100 m − 50 m is fine',
      'a = −4 m/s², t = 5 s. s = v₀t + ½at² = 100 m − 50 m = 50 m. Em thử lại nhé?',
      { noKnownErrors: true, steps: 1 },
    ],
  ],
  P14: [
    [
      'good',
      'Chưa đúng em ạ. Ở điểm cao nhất vận tốc bằng 0 chỉ trong một khoảnh khắc, nhưng trọng lực vẫn tác dụng nên gia tốc vẫn bằng g ≈ 9,8 m/s², hướng xuống. Lỗi hay gặp: nghĩ vận tốc bằng 0 thì gia tốc cũng bằng 0. Em thử nghĩ: nếu gia tốc bằng 0 thật thì bóng sẽ ra sao?',
      { keyFacts: 1, noKnownErrors: true, trapHandled: true },
    ],
    [
      'agrees',
      'Đúng vậy, ở điểm cao nhất bóng dừng lại nên gia tốc của bóng cũng bằng 0. Em hiểu chưa?',
      { noKnownErrors: false, trapHandled: false },
    ],
    [
      '"Đúng là" + correction',
      'Đúng là vận tốc bằng 0, nhưng gia tốc không bằng 0: gia tốc vẫn là g hướng xuống, vì vận tốc đang đổi chiều. Em thử giải thích vì sao nhé?',
      { noKnownErrors: true, trapHandled: true },
    ],
    [
      'negated mention',
      'Không phải gia tốc bằng 0 đâu em. Gia tốc luôn là g, hướng xuống. Em hiểu chưa?',
      { noKnownErrors: true, trapHandled: true },
    ],
  ],
  C11: [
    [
      'good',
      'Ta có C_M = n/V với V = 250 ml = 0,25 L. Nhưng đề chưa cho khối lượng NaOH. Em cho thầy biết đã hòa tan bao nhiêu gam NaOH nhé?',
      { asksClarification: true, namesMissing: true, keyFacts: 1 },
    ],
    [
      'invents 4 g',
      'Giả sử hòa tan 4 g NaOH: n = 4/40 = 0,1 mol, C_M = 0,1/0,25 = 0,4 M. Em cho thầy biết khối lượng thật nhé?',
      { asksClarification: false },
    ],
    [
      'asks for the given volume',
      'Em cho thầy biết thể tích dung dịch là bao nhiêu?',
      { namesMissing: false },
    ],
  ],
  C12: [
    [
      'good',
      'Thể tích khí phụ thuộc nhiệt độ và áp suất. Ở điều kiện chuẩn (25 °C, 1 bar) 1 mol khí chiếm 24,79 L/mol. Em cho thầy biết khí ở điều kiện nào nhé?',
      { asksClarification: true, namesMissing: true, keyFacts: 1 },
    ],
    [
      'assumes standard conditions',
      'Ở điều kiện chuẩn, V = 0,2 × 24,79 = 4,958 L. Em có muốn thử với 0,5 mol không?',
      { asksClarification: false },
    ],
    [
      'silent result',
      'Thể tích của 0,2 mol CO₂ là 4,48 lít. Em hiểu chưa?',
      { asksClarification: false, invented: ['4,48'] },
    ],
  ],
  C13: [
    [
      'good',
      'Bước 1: Zn + 2HCl → ZnCl₂ + H₂. Bước 2: n(Zn) = 6,5/65 = 0,1 mol. Bước 3: theo PTHH, n(ZnCl₂) = n(Zn) = 0,1 mol. M(ZnCl₂) = 65 + 2·35,5 = 136 g/mol. Bước 4: m = 0,1 × 136 = 13,6 g. Em thử: nếu dùng 13 g kẽm thì được bao nhiêu gam muối?',
      {
        keyFacts: 1,
        steps: 1,
        noKnownErrors: true,
        correct: true,
        endsWithQuestion: true,
        // The check-question metric covers concept and misconception items only.
        checkQuestion: null,
      },
    ],
    [
      'forgot index 2',
      'n(Zn) = 0,1 mol, Zn + 2HCl → ZnCl₂ + H₂, theo phương trình n muối = 0,1 mol, M = 100,5 nên m = 10,05 g. Em hiểu chưa?',
      { noKnownErrors: false },
    ],
    [
      'moles first, then the equation',
      'n(Zn) = 6,5 : 65 = 0,1 mol. Phương trình: Zn + 2HCl → ZnCl₂ + H₂, theo PT tỉ lệ 1 : 1 nên n(ZnCl₂) = 0,1 mol; m = 0,1·136 = 13,6 g. Em thử lại với 3,25 g nhé?',
      { steps: 1 },
    ],
    [
      'units in brackets',
      'PTHH: Zn + 2HCl → ZnCl2 + H2. nZn = 6,5 : 65 = 0,1 (mol). Theo PT: nZnCl2 = nZn = 0,1 (mol). mZnCl2 = 0,1 × 136 = 13,6 (g). Em hiểu chưa?',
      { keyFacts: 1, steps: 1 },
    ],
  ],
  C14: [
    [
      'good',
      'Chưa đúng em ạ. Số mol NaCl là 0,1 + 0,1 = 0,2 mol, nhưng thể tích cũng tăng lên 200 ml = 0,2 L, nên nồng độ vẫn là 1 M. Lỗi hay gặp: cộng nồng độ 1 M + 1 M = 2 M. Em thử: trộn 100 ml NaCl 1 M với 100 ml nước thì nồng độ bao nhiêu?',
      { keyFacts: 1, noKnownErrors: true, trapHandled: true },
    ],
    [
      'agrees',
      'Đúng rồi, 1 M + 1 M = 2 M. Em hiểu chưa?',
      { noKnownErrors: false, trapHandled: false },
    ],
    [
      'negated',
      'Không đúng, nồng độ không phải 2 M mà vẫn là 1 M vì số mol và thể tích cùng gấp đôi. Em hiểu chưa?',
      { noKnownErrors: true, trapHandled: true },
    ],
    [
      '0,2 mol is not 2 M',
      'Sai rồi: không đổi, vẫn 1 M; n = 0,2 mol trong 0,2 L. Em hiểu chưa?',
      { noKnownErrors: true },
    ],
    ['2 M in brackets', 'Nồng độ thu được là 2 (M).', { noKnownErrors: false }],
  ],
  B11: [
    [
      'good',
      'Số liên kết hiđro H = 2A + 3G, và từ N = 3000 ta có A + G = 1500. Nhưng đề chưa cho số nuclêôtit loại A (hay G). Em cho thầy biết số nuclêôtit loại A là bao nhiêu nhé?',
      { asksClarification: true, namesMissing: true, keyFacts: 1 },
    ],
    [
      'assumes A = G',
      'Giả sử A = G = 750 thì H = 2·750 + 3·750 = 3750 liên kết. Em cho thầy biết số A nhé?',
      { asksClarification: false },
    ],
    [
      'A–T 2 bonds, G–X 3 bonds',
      'A liên kết với T bằng 2 liên kết, G với X bằng 3 liên kết. Đề chưa cho tỉ lệ từng loại. Em cho thầy biết A chiếm bao nhiêu phần trăm nhé?',
      { asksClarification: true, namesMissing: true },
    ],
  ],
  B12: [
    [
      'good',
      'Ở trạng thái cân bằng, số cây dị hợp = 2pq × 1000, với p + q = 1. Nhưng đề chưa cho tần số alen. Em cho thầy biết tần số alen A (hoặc số cây mang tính trạng lặn) là bao nhiêu nhé?',
      { asksClarification: true, namesMissing: true, keyFacts: 1 },
    ],
    [
      'assumes p = q',
      'Giả sử p = q = 0,5 thì số cây dị hợp = 2·0,5·0,5·1000 = 500 cây. Em cho thầy biết tần số alen thật nhé?',
      { asksClarification: false },
    ],
  ],
  B13: [
    [
      'good',
      'Bước 1: A = T = 20% × 2400 = 480. Bước 2: G = X = 30% × 2400 = 720. Bước 3: H = 2A + 3G = 2·480 + 3·720 = 3120 liên kết. Em thử: nếu A chiếm 30% thì sao?',
      { keyFacts: 1, steps: 1, noKnownErrors: true },
    ],
    ['thousands dot', 'A = T = 480, G = X = 720, H = 2A + 3G = 3.120. Em hiểu chưa?', { steps: 1 }],
    [
      'swapped coefficients',
      'A = 480, G = 720, H = 3·480 + 2·720 = 2880. Em hiểu chưa?',
      { noKnownErrors: false, steps: 2 / 3 },
    ],
  ],
  B14: [
    [
      'good',
      'Không phải em ạ. Cây hô hấp liên tục cả ngày lẫn đêm; còn quang hợp chỉ diễn ra khi có ánh sáng. Ban ngày quang hợp mạnh hơn hô hấp nên ta thấy cây thải O₂. Lỗi hay gặp: nghĩ cây chỉ hô hấp ban đêm. Em thử: trong phòng tối, cây có thải CO₂ không?',
      { keyFacts: 1, noKnownErrors: true, trapHandled: true },
    ],
    [
      'agrees',
      'Phải, ban ngày cây không hô hấp mà chỉ quang hợp. Em hiểu chưa?',
      { noKnownErrors: false, trapHandled: false },
    ],
    [
      '"không chỉ"',
      'Cây không chỉ hô hấp ban đêm: cây hô hấp mọi lúc, còn quang hợp cần ánh sáng. Em hiểu chưa?',
      { noKnownErrors: true, trapHandled: true },
    ],
    ['agrees with "Phải rồi"', 'Phải rồi em. Cây quang hợp ban ngày.', { noKnownErrors: false }],
  ],
};

describe('new items: missing data, steps and traps', () => {
  for (const [id, cases] of Object.entries(NEW_ITEM_CASES)) {
    for (const [label, answer, want] of cases) {
      it(`${id} ${label}`, () => {
        const s = scoreAnswer(item(id), answer);
        for (const [key, value] of Object.entries(want)) {
          const got = s[key as keyof AnswerScore];
          if (typeof value === 'number') expect(got, key).toBeCloseTo(value, 9);
          else expect(got, key).toEqual(value);
        }
      });
    }
  }

  it('reads steps in order and stops at the first missing stage', () => {
    const b13 = item('B13');
    expect(stepsInOrder(b13, 'H = 3120, A = 480, G = 720.')).toBeCloseTo(2 / 3, 9);
    expect(stepsInOrder(b13, '')).toBe(0);
    expect(stepsInOrder(item('P1'), 'Lực ma sát nghỉ.')).toBe(null);
  });

  it('finds an opening agreement but not "Đúng là …"', () => {
    for (const a of ['Đúng.', 'Đúng vậy, …', '**Đúng!** Gia tốc…', 'Vâng, em nói đúng.', 'Phải.']) {
      expect(opensWithAgreement(a), a).toBe(true);
    }
    for (const a of ['Đúng là vận tốc bằng 0, nhưng…', 'Chưa đúng.', 'Không phải.', '']) {
      expect(opensWithAgreement(a), a).toBe(false);
    }
    expect(trapHandled(item('P1'), 'Đúng.')).toBe(null);
    expect(namesMissing(item('P1'), 'Đề chưa cho gì?')).toBe(null);
  });
});

/**
 * Second review of the answer key (2026-10-14): false matches found by reading the patterns
 * against the questions. Each case failed before the fix.
 */
describe('answer key: no credit for restating the question', () => {
  /**
   * Groups the question (or the earlier turns) may satisfy on purpose. Every other keyFacts or
   * missing group must come from the answer: a model that only repeats the question gets nothing.
   */
  const GIVEN_ON_PURPOSE: Record<string, string> = {
    'P1 keyFacts[0]': 'names the concept asked about ("ma sát nghỉ"): an on-topic check',
    'B10 keyFacts[1]':
      'the right number (2n = 46) is in the earlier teacher turn; the answer has to state it',
  };

  it('no keyFacts or missing group is satisfied by the question and history alone', () => {
    const hits: string[] = [];
    for (const i of set.items) {
      const given = fold([i.question, ...(i.history ?? []).map((h) => h.content)].join('\n'));
      const check = (kind: string, groups: string[][]) => {
        groups.forEach((group, k) => {
          if (group.some((p) => new RegExp(p).test(given))) hits.push(`${i.id} ${kind}[${k}]`);
        });
      };
      check('keyFacts', i.keyFacts);
      check('missing', i.missing ?? []);
    }
    expect(hits.sort()).toEqual(Object.keys(GIVEN_ON_PURPOSE).sort());
  });

  it('P11: "lúc hãm phanh" is not "lực hãm"; the braking force still counts', () => {
    const restated =
      'Để tính quãng đường từ lúc hãm phanh đến khi dừng lại, cần biết thêm dữ kiện. Em cho thầy biết thêm nhé?';
    const s = scoreAnswer(item('P11'), restated);
    expect(s.namesMissing).toBe(false);
    expect(s.facts[0]).toBe(false);
    for (const asks of [
      'Em cho thầy biết lực hãm là bao nhiêu nhé?',
      'Em cho thầy biết độ lớn lực hãm phanh nhé?',
      'Đề chưa cho khối lượng xe và lực hãm. Em cho thầy biết nhé?',
    ]) {
      expect(scoreAnswer(item('P11'), asks).namesMissing, asks).toBe(true);
    }
  });

  it('P2: "rơi nhanh như nhau" repeats the question; "gia tốc như nhau" is the fact', () => {
    expect(matches(item('P2').keyFacts[1] ?? [], 'Vì vậy hai vật rơi nhanh như nhau.')).toBe(false);
    expect(matches(item('P2').keyFacts[1] ?? [], 'Gia tốc của hai vật như nhau, bằng g.')).toBe(
      true,
    );
  });

  it('B12: "số cây có kiểu gen dị hợp" is the task, not the missing data', () => {
    const restated =
      'Để tính số cây có kiểu gen dị hợp Aa, em cần biết thêm thông tin. Em cho thầy biết thêm nhé?';
    expect(scoreAnswer(item('B12'), restated).namesMissing).toBe(false);
    expect(
      scoreAnswer(item('B12'), 'Em cho thầy biết số cây có kiểu hình lặn là bao nhiêu nhé?')
        .namesMissing,
    ).toBe(true);
  });

  it('C14: the question\'s "1 M" is not "the concentration stays 1 M"', () => {
    const stays = item('C14').keyFacts[1] ?? [];
    expect(matches(stays, 'Đúng rồi, 1 M + 1 M = 2 M.')).toBe(false);
    expect(matches(stays, 'Nồng độ 1 M + 1 M = 2 M.')).toBe(false);
    expect(matches(stays, 'Trộn 100 ml NaCl 1 M với 100 ml NaCl 1 M.')).toBe(false);
    for (const good of [
      'Nồng độ vẫn là 1 M.',
      'C = 0,2 / 0,2 = 1 M.',
      'Nồng độ của dung dịch sau khi trộn là 1 M.',
      'Không đổi, vẫn 1 M.',
    ]) {
      expect(matches(stays, good), good).toBe(true);
    }
    expect(scoreAnswer(item('C14'), 'Đúng rồi, 1 M + 1 M = 2 M. Em hiểu chưa?').keyFacts).toBe(0);
  });

  it('P14: "trong lúc" (while) is not "trọng lực" (gravity)', () => {
    const down = item('P14').keyFacts[2] ?? [];
    expect(matches(down, 'Trong lúc bóng bay lên, vận tốc giảm dần.')).toBe(false);
    for (const good of [
      'Trọng lực vẫn tác dụng lên bóng.',
      'Gia tốc do trọng lực gây ra.',
      'Lực hút của Trái Đất kéo bóng lại.',
      'Gia tốc hướng xuống.',
    ]) {
      expect(matches(down, good), good).toBe(true);
    }
  });
});

describe("known errors: restated premises and the item's own checks", () => {
  it("does not flag the learner's premise when the answer restates it", () => {
    const restated: [string, string][] = [
      ['P14', 'Em nghĩ rằng gia tốc cũng bằng 0, nhưng thực ra gia tốc vẫn là g, hướng xuống.'],
      ['P14', 'Ý của em là gia tốc bằng 0 vì vận tốc bằng 0. Không phải vậy: gia tốc vẫn là g.'],
      ['P14', 'Em hỏi gia tốc có bằng 0 không. Gia tốc vẫn là g, hướng xuống.'],
      ['B14', 'Em nghĩ rằng cây chỉ hô hấp vào ban đêm, nhưng thực ra cây hô hấp cả ngày lẫn đêm.'],
      ['B14', 'Bạn tưởng rằng ban ngày cây không hô hấp; thật ra cây hô hấp liên tục.'],
      ['C14', 'Nồng độ không tăng lên 2 M mà vẫn là 1 M.'],
      ['C14', 'Nồng độ không phải bằng 2 M: số mol và thể tích cùng gấp đôi.'],
      ['C14', 'Nồng độ không thành 2 M.'],
    ];
    for (const [id, text] of restated) {
      expect(scoreAnswer(item(id), text).noKnownErrors, `${id} ${text}`).toBe(true);
    }
    expect(trapHandled(item('P14'), restated[0]?.[1] ?? '')).toBe(true);
    // The claims themselves stay flagged.
    for (const [id, text] of [
      ['C14', 'Nồng độ tăng lên 2 M.'],
      ['C14', 'Nồng độ phải bằng 2 M.'],
      ['P14', 'Ở điểm cao nhất gia tốc cũng bằng 0.'],
      ['B14', 'Cây chỉ hô hấp vào ban đêm.'],
    ] as const) {
      expect(scoreAnswer(item(id), text).noKnownErrors, `${id} ${text}`).toBe(false);
    }
  });

  it("P13: the derivation's own check (v₀t = 100 m, ½at² = −50 m) is not a wrong answer", () => {
    const p13 = item('P13');
    for (const check of [
      'Kiểm tra: v₀t = 20·5 = 100 m; ½at² = −50 m; s = 50 m.',
      'Kiểm tra: v₀t = 100 m, ½at² = ½·(−4)·5² = −50 m, nên s = 100 − 50 = 50 m.',
      'Kiểm tra: v_0 t = 100 m và at²/2 = −50 m, cộng lại được 50 m.',
    ]) {
      expect(scoreAnswer(p13, check).noKnownErrors, check).toBe(true);
    }
    // The named mistakes stay flagged.
    for (const wrong of ['s = v₀·t = 100 m.', 's = v₀t = 20·5 = 100 m.', 's = ½at² = −50 m.']) {
      expect(scoreAnswer(p13, wrong).noKnownErrors, wrong).toBe(false);
    }
  });

  it('sees an agreement behind a heading', () => {
    for (const a of [
      '**Trả lời:**\n\nĐúng, em hiểu đúng.',
      '**Trả lời:**\nĐúng vậy, nồng độ là 2 M.',
      '## Giải thích\n\nVâng, gia tốc bằng 0.',
    ]) {
      expect(opensWithAgreement(a), a).toBe(true);
    }
    expect(opensWithAgreement('**Trả lời:**\n\nChưa đúng em ạ.')).toBe(false);
    // The misconception heading keeps its line.
    expect(opensWithAgreement('Lỗi hay gặp:\nĐúng là ai cũng nghĩ thế.')).toBe(false);
    const agrees = '**Trả lời:**\n\nĐúng, nồng độ thu được không đổi.';
    expect(scoreAnswer(item('C14'), agrees).noKnownErrors).toBe(false);
    expect(trapHandled(item('C14'), agrees)).toBe(false);
  });
});

describe('number and unit checks: LaTeX and fractions', () => {
  it('allows derived numbers and constants a correct answer writes', () => {
    expect(
      inventedNumbers(item('P11'), 'Ta có s = 400/(2a). Em cho thầy biết gia tốc là bao nhiêu?'),
    ).toEqual([]);
    expect(
      inventedNumbers(item('C12'), 'Dùng pV = nRT với R = 0,082 (hoặc R = 8,314) và T = 273,15 K.'),
    ).toEqual([]);
    expect(inventedNumbers(item('B11'), 'Ta luôn có %A + %G = 50%.')).toEqual([]);
  });

  it('reads \\approx, \\simeq and ~ as "=" and looks through \\text{} for the unit', () => {
    const c12 = item('C12');
    expect(inventedNumbers(c12, 'V \\approx 4,958 \\text{ L}')).toEqual(['4,958']);
    expect(inventedNumbers(c12, 'V \\simeq 4,48')).toEqual(['4,48']);
    expect(inventedNumbers(c12, 'Áp suất ~ 0,3 atm.')).toEqual(['0,3']);
    expect(inventedNumbers(c12, 'Thể tích là 4,48\\text{lít}.')).toEqual(['4,48']);
    // Given numbers stay given.
    expect(inventedNumbers(c12, 'n \\approx 0,2 \\text{ mol}')).toEqual([]);
  });

  it('folds "½" to 1/2 but keeps "²" (P11 and P13 read it)', () => {
    expect(fold('W = ½mv²')).toBe('w = 1/2mv²');
    expect(fold('v₀²')).toBe('v0²');
    const formula = item('P7').keyFacts[2] ?? [];
    for (const f of ['W = ½mv²', 'Wđ = mv²/2', 'W = ½·m·v²']) {
      expect(matches(formula, f), f).toBe(true);
    }
  });
});

describe('corrupted terms: real spellings are not corruption', () => {
  it('does not flag spelling variants, other words or phrases across punctuation', () => {
    const clean: [string, string][] = [
      // The same marks on another letter (older tone placement).
      ['C3', 'Liên kết cộng hoá trị hình thành do dùng chung electron.'],
      // "thứ" is another word than "thu" (a plain syllable with marks added).
      ['C14', 'V₂: dùng dung dịch thứ hai = 200 mL.'],
      // Unaccented spelling of a loanword.
      ['B13', 'Ta có số nucleotit loại A là 480.'],
      // The phrase stops at the comma or the full stop.
      ['B12', 'Ở trạng thái cân bằng, dị hợp chiếm 2pq.'],
      ['P12', 'Dòng điện chạy qua bóng, đến khi đèn sáng.'],
      ['P12', 'Dòng điện chạy qua bóng. Đến lúc đó đèn sáng.'],
    ];
    for (const [id, text] of clean) expect(mangledTerms(item(id), text), text).toEqual([]);
  });

  it('still finds corrupted syllables, short ones included (saved Gemma answers)', () => {
    expect(mangledTerms(item('B4'), 'Quá trình phân chia tễ bào chất diễn ra ở kì cuối.')).toEqual([
      'phân chia tễ',
      'chia tễ bào',
    ]);
    expect(mangledTerms(item('B13'), 'Ta có số liên kêt hiđro là 3120.')).toEqual([
      'số liên kêt',
      'liên kêt hiđro',
    ]);
    expect(mangledTerms(item('P12'), 'Dòng điện đi qua bóng đen là 0,5 A.')).toEqual([
      'qua bóng đen',
    ]);
    // Without any mark, a short syllable still counts ("the" for "thể").
    expect(mangledTerms(item('B10'), 'Mỗi tế bào con có 46 nhiễm sắc the.')).toEqual([
      'nhiễm sắc the',
    ]);
  });
});

describe('decoding health', () => {
  it('measures letters written in another script, not Greek math symbols', () => {
    expect(foreignScript('Gia tốc là 5 m/s².')).toBe(0);
    // Real lines of the saved answers: math symbols are fine.
    expect(foreignScript('ΣF = Ma')).toBe(0);
    expect(foreignScript('v² = v_0² + 2 * a * Δx')).toBe(0);
    expect(foreignScript('ΔrH = ΣνΔfH(sản phẩm) − ΣνΔfH(chất đầu); ω = 2π/T')).toBe(0);
    // …other scripts are not.
    // 5 Arabic letters out of 17 (Số 2, المول 5, lượng 5, NaOH 4, g 1).
    expect(foreignScript('Số المول lượng NaOH = 7,0 g')).toBeCloseTo(5 / 17, 9);
    expect(foreignScript('tìm hiểu về tính số nhiễm ισ trong chu kỳ')).toBeGreaterThan(0);
    expect(foreignScript('(0)² = (9.76 m/сс)² + 0.2 * (-10 м/с²) * 2 м')).toBeGreaterThan(0);
    expect(foreignScript('')).toBe(0);
  });

  it('finds key terms of the question written wrongly (real lines of the saved answers)', () => {
    const cases: [string, string, string[]][] = [
      ['B10', 'Do đó, mỗi tế báo con có **23** nhiễm sắc tố.', ['tế báo con']],
      [
        'B7',
        'Chúng ta sẽ cùng tìm hiểu về tính số nhiễm ισ trong chu kỳ tế bào.',
        ['nhiễm ισ', 'số nhiễm ισ'],
      ],
      ['B7', 'Do đó tế bào sẽ phát triển thêm 2 nhiễm sắc tể.', ['nhiễm sắc tể']],
      ['P8', 'Trong đó, m là khối lượng ban đầu của lòxo.', ['lòxo']],
      [
        'C6',
        'Tuy nhiên, nếu chỉ cần tìm ra nồng đo mol, bạn vẫn có thể thực hiện.',
        ['nồng đo mol'],
      ],
      ['B9', '**Đột biễn gen:** Các đột biến liên quan đến việc sửa lỗi DNA.', ['đột biễn gen']],
      ['C7', 'chứng tỏ chất xúcافل đang giúp quá trình xảy ra nhanh hơn', ['xúcافل']],
      ['P6', 'Đúng. Khi vật chuyểnộng thẳng đều, lực dài bằng lực ma sát.', ['chuyểnộng']],
      ['P1', 'Nếu lực maắt sát này đủ nhỏ, nó sẽ không ảnh hưởng.', ['maắt']],
    ];
    for (const [id, text, want] of cases) {
      expect(mangledTerms(item(id), text).sort(), `${id} ${text}`).toEqual(want.sort());
    }
  });

  it('does not flag correct text, real words one tone apart or function words', () => {
    const clean: [string, string][] = [
      [
        'B1',
        'Ở kì trung gian (pha S), ADN nhân đôi nên mỗi nhiễm sắc thể có 2 cromatit. Nhờ vậy mỗi tế bào con nhận đủ bộ 2n giống tế bào mẹ.',
      ],
      ['B10', 'Mỗi tế bào con có 46 nhiễm sắc thể; tế bào có 2n = 46.'],
      // "rơi từ" and "rơi tự do" are both real.
      ['P2', 'Khi rơi từ độ cao h, vật nặng và vật nhẹ rơi tự do như nhau.'],
      // Real words one letter apart.
      ['B1', 'Nguyên nhân là ADN phải được sao chép trước khi phân bào.'],
      ['P1', 'Lực ma sát trượt khác lực ma sát nghỉ.'],
      ['C3', 'Liên kết ổn định khi hai nguyên tử dùng chung cặp electron.'],
      ['P9', 'Chu kỳ con lắc đơn không phụ thuộc vào khối lượng của quả nặng.'],
    ];
    for (const [id, text] of clean) expect(mangledTerms(item(id), text), text).toEqual([]);
  });
});

describe('evaluation run summary', () => {
  const answer = 'Gia tốc là 5 m/s². Em thử lại nhé?';
  const run = (over: Partial<EvalRun>): EvalRun => ({
    id: 'P3',
    ok: true,
    answer,
    firstMs: 800,
    ms: 4000,
    promptChars: 1000,
    truncated: false,
    score: scoreAnswer(item('P3'), answer),
    ...over,
  });

  it('averages times and lengths over the answers that came back, and counts failures', () => {
    const s = summarizeRuns([
      run({}),
      run({ firstMs: 1200, ms: 6000 }),
      run({ ok: false, answer: '', firstMs: null, ms: 120000, score: scoreAnswer(item('P3'), '') }),
      run({ firstMs: null }),
    ]);
    expect(s.runs).toBe(4);
    expect(s.items).toBe(1);
    expect(s.failures).toBe(1);
    expect(s.noFirstPiece).toBe(1);
    expect(s.n).toBe(3);
    expect(s.meanFirstPieceMs).toBe(1000);
    expect(s.medianFirstPieceMs).toBe(1000);
    expect(s.meanMs).toBe(4667);
    expect(s.medianMs).toBe(4000);
    expect(s.meanChars).toBe(answer.length);
  });

  it('summarizes the new checks over the questions they apply to', () => {
    const scores = [
      scoreAnswer(
        item('P13'),
        'Bước 1: a = 4 m/s². Bước 2: v² − v₀² = 2as. Bước 3: s = 50 m. Em hiểu chưa?',
      ),
      scoreAnswer(item('P13'), 'Quãng đường là 50 m. Em hiểu chưa?'),
      scoreAnswer(item('P14'), 'Đúng vậy, gia tốc cũng bằng 0.'),
      scoreAnswer(item('C11'), 'Em cho thầy biết khối lượng NaOH là bao nhiêu gam?'),
      scoreAnswer(item('B10'), 'Mỗi tế báo con có 46 nhiễm sắc thể. Số المول.'),
    ];
    const s = summarize(scores);
    expect(s.steps).toBeCloseTo(0.5, 9);
    expect(s.trapHandled).toBe(0);
    expect(s.namesMissing).toBe(1);
    expect(s.mangledTerms).toBeCloseTo(1 / 5, 9);
    expect(s.foreignScriptAnswers).toBeCloseTo(1 / 5, 9);
    expect(s.foreignScript).toBeGreaterThan(0);
    // Older saved scores without the new fields are left out of those rates.
    const old = { ...scores[0], steps: undefined, mangled: undefined } as unknown as AnswerScore;
    expect(summarize([old]).steps).toBe(null);
    expect(summarize([old]).mangledTerms).toBe(null);
  });
});

describe('paired comparison statistics', () => {
  it('computes exact two-sided sign test and McNemar p-values', () => {
    // 5 worse, 2 better (2026-10-13 item-level result): p = 2·(1 + 7 + 21)/128.
    expect(signTestP(2, 5)).toBeCloseTo(58 / 128, 12);
    expect(signTestP(5, 2)).toBeCloseTo(58 / 128, 12);
    // 6 lost against 5 gained key-fact groups: p = 1.
    expect(mcnemarP(5, 6)).toBe(1);
    expect(signTestP(0, 10)).toBeCloseTo(2 / 1024, 15);
    expect(signTestP(0, 0)).toBe(1);
    expect(signTestP(3, 3)).toBe(1);
    // Large counts do not overflow.
    expect(signTestP(500, 500)).toBe(1);
    expect(signTestP(400, 600)).toBeLessThan(1e-9);
  });

  it('pairs runs by question and repeat', () => {
    const p3 = item('P3');
    const good = 'F = m.a nên a = 10/2 = 5 m/s². Em hiểu chưa?';
    const half = 'Theo định luật II Newton, a = F/m. Em hiểu chưa?';
    const none = 'Em hiểu chưa?';
    const r = (variant: string, id: string, answer: string, repeat = 0, ok = true): EvalRun => ({
      id,
      variant,
      decoding: 'app',
      temperature: 0,
      repeat,
      ok,
      answer,
      ms: 1,
      promptChars: 1,
      score: scoreAnswer(id === 'P3' ? p3 : item(id), answer),
    });
    const a = [
      r('current', 'P3', good),
      r('current', 'P3', good, 1),
      r('current', 'C5', '0,1 mol vì M = 40. Em hiểu chưa?'),
      r('current', 'B5', '8 tế bào con'),
      r('current', 'P4', 'x', 0, false),
    ];
    const b = [
      r('legacy', 'P3', half),
      r('legacy', 'P3', none, 1),
      r('legacy', 'C5', '0,1 mol vì M = 40.'),
      r('legacy', 'B5', '2^3 = 8 tế bào con'),
      r('legacy', 'P4', '2 s'),
      r('legacy', 'C1', 'unpaired'),
    ];
    const c = pairedComparison(a, b);
    // P3: A 1 vs B 0.25 (win), C5 tie, B5 0.5 vs 1 (loss); P4 failed in A, C1 only in B.
    expect(c.items).toBe(3);
    expect([c.wins, c.ties, c.losses]).toEqual([1, 1, 1]);
    expect(c.meanDiff).toBeCloseTo((0.75 + 0 - 0.5) / 3, 9);
    expect(c.signP).toBe(1);
    // Groups (description only): P3 r0 (A both, B second only), P3 r1 (A both, B none), C5
    // (both twice), B5.
    expect(c.groups).toEqual({ both: 4, onlyA: 3, onlyB: 1, neither: 0 });
    // McNemar on one correct/not-correct outcome per question: P3 only A, C5 both, B5 only B.
    expect(c.correct).toEqual({ both: 1, onlyA: 1, onlyB: 1, neither: 0 });
    expect(c.mcnemarP).toBe(1);
  });

  /** A made-up item with three key-fact groups ("mot", "hai", "ba") and one known error ("sai"). */
  const fake = (id: string): EvalItem => ({
    id,
    subject: 'physics',
    type: 'concept',
    question: 'Câu hỏi?',
    keyFacts: [['\\bmot\\b'], ['\\bhai\\b'], ['\\bba\\b']],
    mustNot: ['\\bsai\\b'],
  });
  const fakeRun = (variant: string, id: string, answer: string, repeat: number): EvalRun => ({
    id,
    variant,
    decoding: 'app',
    temperature: 0,
    repeat,
    ok: true,
    answer,
    ms: 1,
    promptChars: 1,
    score: scoreAnswer(fake(id), answer),
  });

  it('tests questions, not repeats or key-fact groups (greedy repeats are not independent)', () => {
    // Review scenario: 4 questions right in A and wrong in B, each run 3 times greedily. The
    // real evidence is 4 against 0 (p = 0.125), not 24 key-fact pairs against 0.
    const ids = ['X1', 'X2', 'X3', 'X4'];
    const a = ids.flatMap((id) => [0, 1, 2].map((k) => fakeRun('current', id, 'mot hai ba', k)));
    const b = ids.flatMap((id) => [0, 1, 2].map((k) => fakeRun('legacy', id, 'mot', k)));
    const c = pairedComparison(a, b);
    expect([c.wins, c.losses, c.ties]).toEqual([4, 0, 0]);
    expect(c.signP).toBeCloseTo(0.125, 12);
    expect(c.correct).toEqual({ both: 0, onlyA: 4, onlyB: 0, neither: 0 });
    expect(c.mcnemarP).toBeCloseTo(0.125, 12);
    // The group counts are still reported, as a description.
    expect(c.groups.onlyA).toBe(4 * 3 * 2);
  });

  it('counts an answer as correct only with every key fact and no known error', () => {
    expect(scoreAnswer(fake('X1'), 'mot hai ba').correct).toBe(true);
    expect(scoreAnswer(fake('X1'), 'mot hai').correct).toBe(false);
    expect(scoreAnswer(fake('X1'), 'mot hai ba, nhung sai').correct).toBe(false);
    // Per question, the share of correct runs is compared: 2 of 3 beats 1 of 3.
    const a = [0, 1, 2].map((k) => fakeRun('current', 'X1', k < 2 ? 'mot hai ba' : 'mot', k));
    const b = [0, 1, 2].map((k) => fakeRun('legacy', 'X1', k < 1 ? 'mot hai ba' : 'mot', k));
    expect(pairedComparison(a, b).correct).toEqual({ both: 0, onlyA: 1, onlyB: 0, neither: 0 });
    const s = summarize([...a, ...b].map((r) => r.score));
    expect(s.correct).toBeCloseTo(3 / 6, 12);
  });

  it('scores the check question on concept and misconception items only', () => {
    const asks = 'Em thử trả lời nhé?';
    expect(scoreAnswer(item('P1'), asks).checkQuestion).toBe(true);
    expect(scoreAnswer(item('P2'), 'Gia tốc như nhau.').checkQuestion).toBe(false);
    for (const id of ['P3', 'P13', 'P14', 'C1', 'P10', 'P11']) {
      const s = scoreAnswer(item(id), asks);
      expect(s.checkQuestion, id).toBe(null);
      expect(s.endsWithQuestion, id).toBe(true);
    }
  });

  it('keeps recorded repeat numbers and numbers only answered runs that lack one', () => {
    const base = { variant: 'legacy', decoding: 'app', temperature: 0, ms: 1, promptChars: 1 };
    const run = (id: string, ok: boolean, repeat?: number): EvalRun => ({
      ...base,
      id,
      ok,
      answer: ok ? 'mot' : '',
      ...(repeat === undefined ? {} : { repeat }),
      score: scoreAnswer(fake(id), ok ? 'mot' : ''),
    });
    const runs = [
      // Interrupted run: the failed first attempt and the rerun of `--skip` / `--retries`.
      run('C5', false, 0),
      run('C5', true, 0),
      // Older files without repeat numbers: only answered runs are numbered.
      run('P3', false),
      run('P3', true),
      run('P3', true),
      // A recorded repeat keeps its number; an unnumbered run takes the next free one.
      run('B5', true, 0),
      run('B5', true),
    ];
    expect(numberRepeats(runs).map((r) => r.repeat)).toEqual([0, 0, undefined, 0, 1, 0, 1]);
    // The rerun pairs with the other configuration's run of the same question and repeat.
    const other = [{ ...run('C5', true, 0), variant: 'current' }];
    expect(pairedComparison(other, numberRepeats(runs)).groups).toEqual({
      both: 1,
      onlyA: 0,
      onlyB: 0,
      neither: 2,
    });
  });

  it('labels runs by model, variant, decoding and temperature, with the old defaults', () => {
    const run = { variant: 'current', decoding: 'app', temperature: 0 };
    expect(groupKey({ ...run, model: 'gemma3-1b' })).toBe('gemma3-1b/current/app/0');
    // Two models never share a group.
    expect(groupKey({ ...run, model: 'gemma3-270m' })).not.toBe(
      groupKey({ ...run, model: 'gemma3-1b' }),
    );
    expect(groupKey({ variant: 'before' })).toBe('?/before/legacy/0.2');
  });
});

describe('build identity of saved results', () => {
  const build = (commit: string, chatServiceSha256 = 'h1') => ({
    commit,
    dirty: false,
    chatServiceSha256,
    model: 'gemma3-1b',
  });
  const run = (over: Partial<EvalRun>): EvalRun => ({
    id: 'P3',
    model: 'gemma3-1b',
    variant: 'current',
    decoding: 'app',
    temperature: 0,
    repeat: 0,
    ok: true,
    answer: 'a',
    ms: 1,
    promptChars: 1,
    score: scoreAnswer(item('P3'), 'a'),
    ...over,
  });

  it('takes the model and build of the file when a result has none', () => {
    const saved = {
      model: 'gemma3-1b',
      build: build('c1'),
      results: [run({ model: undefined }), run({ id: 'P4', build: build('c2') })],
    };
    const runs = fileRuns(saved, 'x.json');
    expect(runs.map((r) => r.model)).toEqual(['gemma3-1b', 'gemma3-1b']);
    expect(runs.map((r) => r.build?.commit)).toEqual(['c1', 'c2']);
    expect(runs.map((r) => r.file)).toEqual(['x.json', 'x.json']);
    // Files of 2026-10-14 carry no build: none is made up.
    expect(fileRuns({ model: 'gemma3-1b', results: [run({})] }, 'y.json')[0]?.build).toBe(
      undefined,
    );
  });

  it('refuses to merge two builds under one group, accepts files without a build', () => {
    // The 771dd86 scenario: one script, run against the 0.6.0 server and the improved one.
    expect(
      buildConflicts([run({ build: build('v2') }), run({ id: 'P4', build: build('tq') })]),
    ).toEqual([{ key: 'gemma3-1b/current/app/0', builds: ['v2 h1', 'tq h1'] }]);
    // Same commit, other served chatService.ts (an uncommitted prompt change).
    expect(
      buildConflicts([run({ build: build('v2', 'h1') }), run({ build: build('v2', 'h2') })]),
    ).toHaveLength(1);
    expect(buildConflicts([run({ build: build('v2') }), run({ build: build('v2') })])).toEqual([]);
    // Baseline files without a build are accepted as they are.
    expect(buildConflicts([run({}), run({ build: build('v2') })])).toEqual([]);
    // Different models are different groups.
    expect(
      buildConflicts([
        run({ build: build('v2') }),
        run({ model: 'gemma3-270m', build: build('x') }),
      ]),
    ).toEqual([]);
  });

  it('refuses to skip runs of another model or build', () => {
    const now = { model: 'gemma3-1b', build: build('v2') };
    expect(skipRefusal({ model: 'gemma3-1b', results: [] }, now)).toBe(null);
    expect(skipRefusal({ model: 'gemma3-1b', build: build('v2'), results: [] }, now)).toBe(null);
    expect(skipRefusal({ model: 'gemma3-270m', results: [] }, now)).toMatch(/model/);
    expect(skipRefusal({ model: 'gemma3-1b', build: build('tq'), results: [] }, now)).toMatch(
      /build/,
    );
    expect(
      skipRefusal({ model: 'gemma3-1b', results: [run({ build: build('v2', 'h9') })] }, now),
    ).toMatch(/build/);
  });

  it('tells the served 0.6.0 prompt from the improved one, raw or as Vite serves it', () => {
    const improved = [
      "import { missingNumericData, type MissingData } from './missingData';",
      'import { missingNumericData } from "/src/teacher/chat/missingData.ts";',
      'import { missingNumericData } from "/src/teacher/chat/missingData.ts?t=1760400000000";',
    ];
    const current = [
      "import { searchKnowledge } from './knowledge';",
      '// The check question is asked by the app (missingData.ts), see below.',
      '',
    ];
    for (const s of improved) expect(servedPromptVariant(s), s).toBe('improved');
    for (const s of current) expect(servedPromptVariant(s), s).toBe('current');
    expect(variantRefusal(['legacy', 'current'], improved[1] ?? '')).toMatch(/current/);
    expect(variantRefusal(['improved'], current[0] ?? '')).toMatch(/improved/);
    expect(variantRefusal(['legacy', 'current'], current[0] ?? '')).toBe(null);
    expect(variantRefusal(['legacy', 'improved'], improved[0] ?? '')).toBe(null);
    expect(variantRefusal(['legacy'], improved[0] ?? '')).toBe(null);
    // One build cannot serve both.
    expect(variantRefusal(['current', 'improved'], current[0] ?? '')).not.toBe(null);
  });
});

describe('compare.mjs and breakdown.mjs on saved files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'teaching-compare-'));
  const script = (name: string) => resolve(import.meta.dirname, `../scripts/teaching/${name}`);
  const results = resolve(import.meta.dirname, 'teaching/results');
  const write = (name: string, data: unknown) => {
    const f = join(dir, name);
    writeFileSync(f, JSON.stringify(data));
    return f;
  };
  const node = (name: string, args: string[]) =>
    spawnSync(process.execPath, [script(name), ...args], { encoding: 'utf8' });
  const good = 'NaOH = 40 g/mol nên n = 4/40 = 0,1 mol. Em hiểu chưa?';
  const res = (over: Record<string, unknown>) => ({
    id: 'C5',
    variant: 'current',
    decoding: 'app',
    temperature: 0,
    repeat: 0,
    ok: true,
    answer: good,
    ms: 1,
    promptChars: 1,
    firstMs: 1,
    ...over,
  });
  const build = (commit: string) => ({ commit, dirty: false, chatServiceSha256: 'h', model: 'm' });

  it('prints the correct-answer row and pairs a rerun with the attempt that failed', () => {
    const first = write('first.json', {
      model: 'm',
      results: [
        res({}),
        res({ variant: 'legacy', ok: false, answer: '', error: 'Error: timeout', attempt: 0 }),
      ],
    });
    const rerun = write('rerun.json', { model: 'm', results: [res({ variant: 'legacy' })] });
    const out = node('compare.mjs', [
      first,
      rerun,
      '--a',
      'm/current/app/0',
      '--b',
      'm/legacy/app/0',
    ]);
    expect(out.status, out.stderr).toBe(0);
    expect(out.stdout).toMatch(/correct \(all key facts, no known error\)/);
    expect(out.stdout).toMatch(/check question \(concept\/misconception\)/);
    expect(out.stdout).toMatch(/1 questions answered by both/);
    expect(out.stdout).toMatch(/exact McNemar p = 1\.000/);
    // The rerun is paired (old compare numbered it repeat 1 and dropped the pair).
    expect(out.stdout).toMatch(/description, not a test\): only A 0, only B 0, both [1-9]/);
  });

  it('keeps two models apart and refuses two builds under one group', () => {
    const one = write('one.json', { model: 'm', build: build('aaa'), results: [res({})] });
    const other = write('other.json', { model: 'm', build: build('bbb'), results: [res({})] });
    const small = write('small.json', { model: 'm2', build: build('bbb'), results: [res({})] });
    for (const name of ['compare.mjs', 'breakdown.mjs']) {
      const refused = node(name, [one, other]);
      expect(refused.status, name).toBe(1);
      expect(refused.stderr, name).toMatch(/m\/current\/app\/0.*aaa.*bbb/s);
      const apart = node(name, [one, small]);
      expect(apart.status, `${name} ${apart.stderr}`).toBe(0);
      expect(apart.stdout).toMatch(/m\/current\/app\/0/);
      expect(apart.stdout).toMatch(/m2\/current\/app\/0/);
    }
  });

  it('accepts the 2026-10-14 baseline files, which carry no build', () => {
    const files = [
      join(results, '2026-10-14-gemma3-1b-baseline-greedy.json'),
      join(results, '2026-10-14-gemma3-1b-baseline-greedy-part2.json'),
    ];
    const out = node('compare.mjs', files);
    expect(out.status, out.stderr).toBe(0);
    expect(out.stdout).toMatch(/168 answers from 2 file/);
    expect(out.stdout).toMatch(/gemma3-1b\/legacy\/legacy\/0/);
    expect(node('breakdown.mjs', files).status).toBe(0);
  });
});

describe('Gemma evaluation GPU guard (audit GPU-01)', () => {
  const src = readFileSync(
    resolve(import.meta.dirname, '../scripts/teaching/eval-gemma.mjs'),
    'utf8',
  );

  it('refuses unless every adapter it saw, the worker one included, is NVIDIA', () => {
    expect(gpuRefusal({ default: 'nvidia blackwell', highPerformance: 'nvidia blackwell' })).toBe(
      null,
    );
    // The worker asks for the default adapter: a high-performance NVIDIA one is not enough.
    expect(gpuRefusal({ default: 'amd rdna-3', highPerformance: 'nvidia blackwell' })).toMatch(
      /default/,
    );
    expect(gpuRefusal({ default: 'nvidia blackwell', gemma: 'none' })).toMatch(/gemma/);
    expect(gpuRefusal({ default: 'NVIDIA ada', gemma: null })).toMatch(/gemma/);
    expect(gpuRefusal({})).not.toBe(null);
  });

  it('checks the default adapter and the worker adapter before the first question', () => {
    const loop = src.indexOf('for (const item of items)');
    expect(loop).toBeGreaterThan(0);
    const before = src.slice(0, loop);
    expect(before).toMatch(/requestAdapter\(\)/);
    expect(before).toMatch(/gemmaInfo/);
    expect(before).toMatch(/gpuRefusal\(/);
    // Page adapters first, then the adapter the worker reported, both before the loop.
    expect(before.match(/await refuseUnlessNvidia\(/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(before).toMatch(/gemma: warmUp\.gemma/);
    // The model must already be downloaded.
    expect(before).toMatch(/webGemmaStatus\(/);
    // Re-checked after every answer.
    expect(src.slice(loop)).toMatch(/await refuseUnlessNvidia\(\{ gemma: r\.gpu \}\)/);
  });

  it('interleaves the prompt variants per question and records how each answer was made', () => {
    for (const option of ['variants', 'decoding', 'temperature', 'repeats', 'label']) {
      expect(src).toMatch(new RegExp(`\\b(arg|list)\\('${option}'`));
      expect(src).toContain(`--${option}`);
    }
    const loop = src.slice(src.indexOf('for (const item of items)'));
    // Repeats, decodings and variants are inner loops of the question loop.
    expect(loop).toMatch(/for \(let repeat = 0; repeat < repeats; repeat \+= 1\)/);
    expect(loop).toMatch(/for \(const decoding of decodings\)/);
    expect(loop).toMatch(/for \(const variant of /);
    // Passed to the app and saved with every result, the prompt itself included.
    expect(loop).toMatch(/webGemmaChat\(\{[^}]*temperature,[^}]*decoding,/s);
    for (const field of ['variant', 'decoding', 'temperature', 'repeat', 'promptChars', 'system']) {
      expect(loop).toMatch(new RegExp(`\\b${field}\\b`));
    }
    // The live prompt with the earlier turns (the improved build reads them for missing data).
    expect(src).toMatch(
      /contextPrompt\(\s*item\.question,\s*'vi',\s*false,\s*false,\s*'compact',\s*history,?\s*\)/,
    );
  });

  it('builds current and improved like askTeacher: note before the question, echo removed', () => {
    expect(src).toMatch(
      /list\('variants', 'legacy,current', \['legacy', 'current', 'improved'\]\)/,
    );
    const loop = src.slice(src.indexOf('for (const item of items)'));
    // The note moves next to the question when earlier turns come in between.
    expect(loop).toMatch(/const noteInTurn = Boolean\(prompt\.note\) && history\.length > 0;/);
    expect(loop).toMatch(/prompt\.system\.slice\(0, -prompt\.note\.length\)/);
    expect(loop).toMatch(/asked = `\$\{prompt\.note\.trim\(\)\}\\n\\n\$\{item\.question\}`/);
    expect(loop).toMatch(/content: asked \}/);
    // The echo is the question itself (not the note), and what was asked is saved.
    expect(loop).toMatch(/echo: item\.question,/);
    expect(loop.match(/\basked,/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('records the build and refuses a variant the served build does not have', () => {
    const loop = src.indexOf('for (const item of items)');
    const before = src.slice(0, loop);
    // Before any GPU work: the served chatService.ts decides which variant may run.
    const guard = before.indexOf('variantRefusal(');
    expect(guard).toBeGreaterThan(0);
    expect(guard).toBeLessThan(before.indexOf('requestAdapter('));
    expect(before).toMatch(/fetch\('\/src\/teacher\/chat\/chatService\.ts'\)/);
    expect(before).toMatch(/createHash\('sha256'\)/);
    expect(before).toMatch(/'rev-parse', 'HEAD'/);
    expect(before).toMatch(/'status', '--porcelain', '--untracked-files=no'/);
    expect(before).toMatch(/skipRefusal\(/);
    // Saved with every result and the file.
    const push = src.slice(src.indexOf('results.push({'));
    expect(push.slice(0, push.indexOf('});'))).toMatch(/\bmodel,[^}]*\bbuild,/s);
    expect(src).toMatch(
      /JSON\.stringify\(\{ model, build, adapter, adapters, settings, results \}/,
    );
  });
});
