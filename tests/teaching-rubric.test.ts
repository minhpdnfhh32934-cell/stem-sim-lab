import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  asksForMissingData,
  endsWithQuestion,
  gpuRefusal,
  scoreAnswer,
  summarize,
  summarizeRuns,
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

describe('teaching evaluation set', () => {
  it('covers three subjects and every question type, at least 30 items', () => {
    expect(set.items.length).toBeGreaterThanOrEqual(30);
    for (const subject of ['physics', 'chemistry', 'biology'] as const) {
      expect(set.items.filter((i) => i.subject === subject).length).toBeGreaterThanOrEqual(10);
    }
    const types = new Set(set.items.map((i) => i.type));
    for (const t of ['concept', 'problem', 'missing-data', 'misconception', 'followup', 'tool']) {
      expect(types).toContain(t);
    }
    expect(new Set(set.items.map((i) => i.id)).size).toBe(set.items.length);
    // Every pattern compiles.
    for (const i of set.items) for (const p of [...i.keyFacts.flat(), ...i.mustNot]) new RegExp(p);
    expect(set.review_status).toBe('pending');
  });

  it('scores a good answer above a wrong one', () => {
    const item = set.items.find((i) => i.id === 'B1');
    if (!item) throw new Error('B1 missing');
    const good =
      'Ở kì trung gian (pha S), ADN nhân đôi nên mỗi nhiễm sắc thể có 2 cromatit. Nhờ vậy mỗi tế bào con nhận đủ bộ 2n giống tế bào mẹ. Lỗi hay gặp: nghĩ ADN nhân đôi trong kì đầu. Em thử trả lời: pha nào ADN nhân đôi?';
    const wrong = 'ADN nhân đôi xảy ra ở pha M rồi chia đều cho các tế bào.';
    const a = scoreAnswer(item, good);
    const b = scoreAnswer(item, wrong);
    expect(a.keyFacts).toBe(1);
    expect(a.noKnownErrors).toBe(true);
    expect(a.checkQuestion).toBe(true);
    expect(b.noKnownErrors).toBe(false);
    expect(b.keyFacts).toBeLessThan(1);
  });

  it('expects a clarifying question when data is missing', () => {
    const item = set.items.find((i) => i.id === 'P5');
    if (!item) throw new Error('P5 missing');
    expect(scoreAnswer(item, 'Quãng đường là 100 m.').asksClarification).toBe(false);
    expect(
      scoreAnswer(item, 'Em cho thầy biết vận tốc và thời gian chuyển động là bao nhiêu nhé?')
        .asksClarification,
    ).toBe(true);
    expect(summarize([scoreAnswer(item, 'Em cho biết vận tốc là bao nhiêu?')]).n).toBe(1);
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

describe('evaluation run summary', () => {
  const answer = 'Gia tốc là 5 m/s². Em thử lại nhé?';
  const run = (over: Partial<EvalRun>): EvalRun => ({
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
    expect(s.failures).toBe(1);
    expect(s.noFirstPiece).toBe(1);
    expect(s.n).toBe(3);
    expect(s.meanFirstPieceMs).toBe(1000);
    expect(s.medianFirstPieceMs).toBe(1000);
    expect(s.meanMs).toBe(4667);
    expect(s.meanChars).toBe(answer.length);
  });
});

describe('Gemma evaluation GPU guard (audit GPU-01)', () => {
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
    const src = readFileSync(
      resolve(import.meta.dirname, '../scripts/teaching/eval-gemma.mjs'),
      'utf8',
    );
    const loop = src.indexOf('for (const item of items)');
    expect(loop).toBeGreaterThan(0);
    const before = src.slice(0, loop);
    expect(before).toMatch(/requestAdapter\(\)/);
    expect(before).toMatch(/gemmaInfo/);
    expect(before).toMatch(/gpuRefusal\(/);
    // Page adapters first, then the adapter the worker reported, both before the loop.
    expect(before.match(/await refuseUnlessNvidia\(/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(before).toMatch(/gemma: warmUp\.gemma/);
  });
});
