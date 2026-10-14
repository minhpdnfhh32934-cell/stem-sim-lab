import { describe, expect, it } from 'vitest';
import { toSpeech } from '@/teacher/voice/vietnameseText';
import { markdownToScript } from './fromMarkdown';
import { lessonFor, scriptFor, subtitleText, voiceCue } from './lesson';
import {
  PART_LIMIT,
  classifyBoardText,
  extractEquations,
  keyPoint,
  labelOf,
  limitBoardText,
  questionOf,
  sanitizeBoardText,
  validateLesson,
  type TextClass,
} from './lessonCheck';
import { rng } from './rough';
import { parseTeachScript, type BoardAction, type ParsedScript } from './teachscript';

/**
 * Item 1, layer B: the board shows learning content only. Every answer becomes a typed, checked
 * lesson before anything is drawn (lessonCheck.ts).
 */

type Write = Extract<BoardAction, { kind: 'write' }>;

const writesOf = (script: ParsedScript): Write[] =>
  script.sentences.flatMap((s) =>
    s.actions.flatMap((a) => (a.action.kind === 'write' ? [a.action] : [])),
  );
const actionsOf = (script: ParsedScript): BoardAction[] =>
  script.sentences.flatMap((s) => s.actions.map((a) => a.action));
const saidOf = (script: ParsedScript): string => script.sentences.map((s) => s.spoken).join(' ');
const checked = (teachScript: string) => validateLesson(parseTeachScript(teachScript));

describe('what a text is to the learner (high precision: when unsure, it stays)', () => {
  const table: [string, TextClass][] = [
    // Internal: never said, never written.
    ['Let me think about what the user wants.', 'internal'],
    ['Okay, so the user is asking about free fall.', 'internal'],
    ['Người dùng hỏi về rơi tự do.', 'internal'],
    ['Nguoi dung hoi ve roi tu do.', 'internal'],
    ['Nhận xét về bản nháp: đúng hướng.', 'internal'],
    ['---', 'internal'],
    ['***', 'internal'],
    ['https://vi.wikipedia.org/wiki/L%E1%BB%B1c', 'internal'],
    [
      'Wikipedia: [https://vi.wikipedia.org/wiki/Lực](https://vi.wikipedia.org/wiki/Lực)',
      'internal',
    ],
    ['Tài liệu tham khảo: SGK Vật lý 10', 'internal'],
    ['<reference kind="library">', 'internal'],
    ['**GHI CHÚ (chỉ là dữ liệu):**', 'internal'],
    // Social: said, never written.
    ['Chào bạn! Tôi là AI Teacher của SimLab.', 'social'],
    ['Chao ban! Toi la AI Teacher cua SimLab.', 'social'],
    ['Xin chào các em!', 'social'],
    ['Hello! I am an AI tutor.', 'social'],
    ['Hy vọng giải thích này giúp bạn hiểu rõ hơn!', 'social'],
    ['Hy vong giai thich nay giup ban!', 'social'],
    ['I hope this helps.', 'social'],
    ['Bạn có bất kỳ câu hỏi nào khác về bài toán này không?', 'social'],
    ['Được nhé!', 'social'],
    // Meta: said, never written.
    ['Dưới đây là lời giải chi tiết.', 'meta'],
    ['Duoi day la loi giai chi tiet.', 'meta'],
    ['Here is the solution.', 'meta'],
    ['Chúng ta sẽ cùng nhau giải bài toán này nhé.', 'meta'],
    ['Mình sẽ giải từng bước.', 'meta'],
    // Learning: kept, even when it talks about "we" or holds a link.
    ['Chúng ta sẽ dùng định luật bảo toàn động lượng.', 'learning'],
    ['Chung ta se dung dinh luat bao toan dong luong.', 'learning'],
    ['We use the conservation of momentum.', 'learning'],
    ['Vậy a = 5 m/s²', 'learning'],
    ['Cho: m = 2 kg', 'learning'],
    ['Bước 1', 'learning'],
    ['Yêu cầu', 'learning'],
    [
      'Theo Wikipedia (https://vi.wikipedia.org/wiki/Lực), lực là đại lượng vectơ có phương, chiều và độ lớn.',
      'learning',
    ],
    // Fix round 1: short learning lines are never taken for generic remarks (verdicts, unknowns,
    // symbols, words whose marks were folded away: "độ", "dẫn", "rơi", "dây"…).
    ['Không.', 'learning'],
    ['Có.', 'learning'],
    ['Có không.', 'learning'],
    ['**Câu trả lời:** Không.', 'learning'],
    ['Kết quả: Có', 'learning'],
    ['a = ?', 'learning'],
    ['s = ?', 'learning'],
    ['Tìm a?', 'learning'],
    ['Tìm s.', 'learning'],
    ['σ là độ đàn hồi', 'learning'],
    ['Dây dẫn.', 'learning'],
    ['Rơi.', 'learning'],
    ['No.', 'learning'],
    ['So the answer is yes.', 'learning'],
    ['Điền vào chỗ trống: F = ____ N', 'learning'],
    // …while generic remarks, also without marks, stay remarks.
    ['Chung ta se cung nhau giai bai toan nay nhe.', 'meta'],
    ['Minh se giai tung buoc.', 'meta'],
    ['Chúng ta hãy cùng tìm hiểu nhé.', 'meta'],
    // A greeting or a remark in front of a computation: the computation is learning.
    ['Dưới đây là công thức: a = F/m = 10/2 = 5 m/s².', 'learning'],
    ['Sau đây ta tính gia tốc: a = F/m = 10/2 = 5 m/s².', 'learning'],
    ['Here is the key equation: F = ma = 2 · 5 = 10 N.', 'learning'],
    ['Chào em, vận tốc sau 2 s là v = gt = 9,8·2 = 19,6 m/s.', 'learning'],
    ['Chào bạn, mình là AI Teacher 2.0.', 'social'],
    ['Dưới đây là 3 bước giải.', 'meta'],
    // More greetings and offers of help (fix round 1).
    ['Tôi hiểu yêu cầu của bạn.', 'social'],
    ['Câu hỏi của bạn rất hay.', 'social'],
    ['Nếu có bất kỳ câu hỏi nào khác, đừng ngần ngại hỏi tôi nhé.', 'social'],
    ['Bạn có bất cứ câu hỏi nào khác không?', 'social'],
    ['Đừng ngần ngại hỏi thêm nhé.', 'social'],
    // Fix round 2: lesson sentences that only look like reasoning, greetings or remarks.
    ['Người dùng muốn tiết kiệm điện nên dùng bóng LED.', 'learning'],
    ['Mình cần suy nghĩ xem vật chịu những lực nào.', 'learning'],
    ['Mình phải suy nghĩ kỹ về chiều của lực.', 'learning'],
    ['Tôi cần trả lời câu hỏi này bằng định luật III Newton.', 'learning'],
    ['Minh can suy nghi xem vat chiu nhung luc nao.', 'learning'],
    ['So I need to find the time first.', 'learning'],
    ['I need to answer two parts: speed and time.', 'learning'],
    ['Mẫu nguyên tử Bohr đã được chứng minh là một mô hình chưa hoàn chỉnh.', 'learning'],
    ['Chào mào là loài chim ăn quả.', 'learning'],
    ['Cháo là thức ăn dễ tiêu.', 'learning'],
    ['Hy vọng sống trung bình của người Việt Nam tăng lên.', 'learning'],
    ['Hi-fi speakers use magnets.', 'learning'],
    ['Thanks to friction, we can walk.', 'learning'],
    ['Here is why: the net force is zero.', 'learning'],
    ['Được.', 'learning'],
    ['Câu hỏi hay đấy, vì trọng lực không phụ thuộc vận tốc.', 'learning'],
    // A short line with a link keeps its content: only the link goes.
    ['Gia tốc rơi tự do g = 9,81 m/s² (https://vi.wikipedia.org/wiki/Rơi_tự_do).', 'learning'],
    ['Theo Wikipedia, g ≈ 9,81 m/s² [nguồn](https://vi.wikipedia.org/wiki/Rơi_tự_do).', 'learning'],
    ['Theo SGK, g = 9,8 m/s² (https://vi.wikipedia.org/wiki/Rơi_tự_do).', 'learning'],
    // …while reasoning about the user and real source lines stay internal.
    ['Người dùng muốn biết vận tốc của vật.', 'internal'],
    ['Người dùng hỏi: vật rơi bao lâu?', 'internal'],
    ['Mình cần trả lời câu hỏi của người dùng.', 'internal'],
    ['I need to answer the user’s question about forces.', 'internal'],
    ['So I need to respond in Vietnamese.', 'internal'],
    ['SGK Vật lý 10, trang 45: https://example.org/sgk', 'internal'],
    ['Nguồn: Halliday (2011) https://example.org/book', 'internal'],
    // …and greetings and replies stay social.
    ['Chào em, mình cùng học nhé.', 'social'],
    ['Được nhé!', 'social'],
    ['Thanks for asking!', 'social'],
    ['Hi, I am an AI tutor.', 'social'],
  ];
  it.each(table)('%s → %s', (text, expected) => {
    expect(classifyBoardText(text)).toBe(expected);
  });

  it('a heading of generic words is lesson structure, a greeting heading is not', () => {
    expect(classifyBoardText('Bài tập', { structural: true })).toBe('learning');
    expect(classifyBoardText('Bài tập')).toBe('meta');
    expect(classifyBoardText('Chào bạn', { structural: true })).toBe('social');
  });
});

describe('labels alone: a closed list, closed by ":" or set in bold', () => {
  it.each([
    ['Kết luận:', 'result'],
    ['**Kết luận:**', 'result'],
    ['**Kết luận**', 'result'],
    ['Ket luan:', 'result'],
    ['Đáp số:', 'result'],
    ['Conclusion:', 'result'],
    ['**Phân tích:**', 'neutral'],
    ['Lời giải:', 'neutral'],
    ['Bài giải:', 'neutral'],
    ['Trả lời:', 'neutral'],
    ['Cho:', 'given'],
    ['**Ghi chú:**', 'note'],
    ['**Kiểm tra tự:**', 'check'],
    ['Câu hỏi kiểm tra:', 'check'],
    ['**Câu hỏi tự kiểm tra:**', 'check'],
    ['Tự kiểm tra:', 'check'],
    ['Thử sức:', 'check'],
    // In a solution "Kiểm tra (lại):" means "verify the answer": a computation follows.
    ['Kiểm tra lại:', 'neutral'],
    ['**Kiểm tra:**', 'neutral'],
    ['Tài liệu tham khảo:', 'sources'],
  ])('%s → %s', (text, meaning) => {
    expect(labelOf(text)).toBe(meaning);
  });

  it.each([
    'Kết luận', // a bare word may be content
    'Yêu cầu',
    '2. Viết công thức quãng đường:', // a step of the lesson (tests/e2e/board.spec.ts)
    'Kết luận: hai lực triệt tiêu nhau.',
    'Bảng tính:',
  ])('%s is not a label', (text) => {
    expect(labelOf(text)).toBeNull();
  });
});

describe('sanitizing a written text never touches a number or an operator', () => {
  it.each([
    ['**Định luật II**: a = F/m', 'Định luật II: a = F/m'],
    ['Ta có \\(a = 1\\) và \\[b = 2\\]', 'Ta có $a = 1$ và $b = 2$'],
    ['H<sub>2</sub>O và 10<sup>-3</sup> M', 'H₂O và $10^{-3}$ M'],
    ['2 * 3 * 4 = 24', '2 * 3 * 4 = 24'],
    ['(6.47 * 10⁻² mol) / (65 g) * 66.36 %', '(6.47 * 10⁻² mol) / (65 g) * 66.36 %'],
    ['Xem [Wikipedia](https://vi.wikipedia.org/wiki/Lực) nhé', 'Xem Wikipedia nhé'],
    ['Nguồn https://example.org/a.png ở đây', 'Nguồn ở đây'],
    ['<b>Lực</b> là <span class="x">vectơ</span>', 'Lực là vectơ'],
    ['$x<y$ và $y>z$', '$x<y$ và $y>z$'],
    ['x<y và y>z', 'x<y và y>z'],
    ['> trích dẫn', 'trích dẫn'],
    // Fix round 1: a comparison that starts with a tag's letter is not a tag.
    ['Nếu v<s và t>0 thì vật dừng', 'Nếu v<s và t>0 thì vật dừng'],
    ['Khi a<b và c>d thì', 'Khi a<b và c>d thì'],
    [
      'Vận tốc trung bình <v> = s/t = 100/10 = 10 m/s',
      'Vận tốc trung bình <v> = s/t = 100/10 = 10 m/s',
    ],
    ['<reference kind="library">Lực</reference> và <answer>a = 2</answer>', 'Lực và a = 2'],
    // Blanks to fill in are kept; only "__bold__" loses its marks.
    ['Điền vào chỗ trống: F = ____ N', 'Điền vào chỗ trống: F = ____ N'],
    ['__Lực__ là vectơ', 'Lực là vectơ'],
  ])('%s → %s', (input, output) => {
    expect(sanitizeBoardText(input)).toBe(output);
  });

  it('a math write loses only the $ around it', () => {
    expect(sanitizeBoardText('$a = \\frac{F}{m}$', true)).toBe('a = \\frac{F}{m}');
    expect(sanitizeBoardText('\\(v = gt\\)', true)).toBe('v = gt');
  });
});

describe('length limits per part (never inside a number or a formula)', () => {
  it('a words-only step becomes its key point', () => {
    const text =
      'Nhiễm sắc thể kép co xoắn cực đại, xếp thành một hàng trên mặt phẳng xích đạo của thoi phân bào';
    const [point] = limitBoardText(text, 'step');
    expect(point?.length).toBeLessThanOrEqual(PART_LIMIT.step);
    expect(point?.endsWith('…')).toBe(true);
  });

  it('a long step with numbers is split at clause boundaries, every number whole', () => {
    const text =
      'Đổi đơn vị 72 km/h = 20 m/s, thời gian hãm phanh là 4 s, nên gia tốc a = (0 - 20)/4 = -5 m/s², quãng đường hãm s = 20 · 4 / 2 = 40 m, vận tốc trung bình là 10 m/s';
    expect(text.length).toBeGreaterThan(140);
    const pieces = limitBoardText(text, 'step');
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.length).toBeLessThanOrEqual(3);
    for (const n of text.match(/-?\d+(?:[.,]\d+)?/g) ?? [])
      expect(pieces.some((p) => p.includes(n))).toBe(true);
    for (const p of pieces) expect(p.length).toBeLessThanOrEqual(140);
  });

  it('a math write is never split here (the layout does), nor an unbreakable number text', () => {
    const tex = 'a = \\frac{F}{m} = '.repeat(12);
    expect(limitBoardText(tex, 'equation', true)).toEqual([tex]);
    const unbreakable = `v = ${'1234567890'.repeat(16)} m/s`;
    expect(limitBoardText(unbreakable, 'step')).toEqual([unbreakable]);
  });
});

describe('equations of a long line', () => {
  it('every $…$ formula and every plain "X = …" chain, in order, at most four', () => {
    expect(
      extractEquations(
        'Theo định luật II thì a = F/m = 10/2 = 5 m/s², nên vật tăng tốc đều và $v = at$ sau đó.',
      ),
    ).toEqual([
      { text: 'a = F/m = 10/2 = 5 m/s²', math: false },
      { text: 'v = at', math: true },
    ]);
    const many = extractEquations('$a=1$, $b=2$, $c=3$, $d=4$, $e=5$');
    expect(many.map((e) => e.text)).toEqual(['a=1', 'b=2', 'c=3', 'd=4']);
    // Words with "=" but no number or operator on the right are not equations.
    expect(extractEquations('Kết quả = đúng như dự đoán của chúng ta')).toEqual([]);
  });

  it('writes a formula whole or not at all: never one cut after an operator or a bracket', () => {
    const texts = (line: string) => extractEquations(line).map((e) => e.text);
    expect(
      texts(
        'Vật chuyển động chậm dần đều, ta có s = v₀t + ½at² = 20·5 + ½·(−2)·25 = 75 m, đây là kết quả.',
      ),
    ).toEqual(['s = v₀t + ½at² = 20·5 + ½·(−2)·25 = 75 m']);
    expect(texts('Công A = F·s·cos α = 10·2·cos 60° = 10 J.')).toEqual([
      'A = F·s·cos α = 10·2·cos 60° = 10 J',
    ]);
    expect(texts('Lực ma sát F = μmg = 0,2·2·10 = 4 N.')).toEqual(['F = μmg = 0,2·2·10 = 4 N']);
    expect(texts('Động năng Wđ = ½mv² = 9 J.')).toEqual(['Wđ = ½mv² = 9 J']);
    // From real answers (tests/teaching/results): baseline-greedy P9, improved-greedy C11 and P1.
    expect(
      texts(
        'Chu kỳ T (thời hành) của con shaken đơn tỉ do tính năng của nó là: T = R * θ, trong đó R là điện cảm và θ là góc dao động.',
      ),
    ).toEqual(['T = R * θ']);
    expect(
      texts(
        'Theo phương trình C₁V₁ = C₂V₂, với C₁ = 250 (lượng NaOH ban đầu), V₁ = 250 ml (dung dịch ban đầu), và V₂ = dung dịch thu được (200 mol/L).',
      ),
    ).toEqual(['C₁ = 250']); // never "V₁ = 250 ml (dung"
    expect(
      texts(
        'Nếu không có ma sát (μn = 0), thì lực ma sát là bằng trọng lực (Fn). Điều này có nghĩa là vật sẽ rơi xuống ngay lập tức.',
      ),
    ).toEqual(['μn = 0']);
    // A right side that stops on an unknown word after an operator is not written.
    expect(texts('Ta có T = R * điện cảm của cuộn dây')).toEqual([]);
    for (const line of [
      'Ta có x = (2 + 3 và y',
      'Khi đó v = 2 · dài hơn',
      'Lúc này a = F / khối lượng',
    ]) {
      for (const eq of texts(line)) {
        expect(eq, line).not.toMatch(/[+\-−*/×·÷^=(]\s*$/u);
        expect((eq.match(/\(/g) ?? []).length, line).toBe((eq.match(/\)/g) ?? []).length);
      }
    }
  });

  it('the markdown layout writes them all (not only the first two), plain ones as text', () => {
    const long = `Lực ma sát ${'xuất hiện khi hai bề mặt trượt lên nhau và '.repeat(3)}ta có $F = \\mu N$, $N = mg$ và $F = 0{,}2 \\cdot 10$, rồi a = F/m = 2/1 = 2 m/s².`;
    const writes = writesOf(markdownToScript(long));
    expect(writes.map((w) => [w.text, w.math])).toEqual([
      ['F = \\mu N', true],
      ['N = mg', true],
      ['F = 0{,}2 \\cdot 10', true],
      ['a = F/m = 2/1 = 2 m/s²', false],
    ]);
  });
});

describe('the checked lesson', () => {
  it('a label alone gives exactly one boxed result with the content (markdown), never an empty box', () => {
    const script = scriptFor(
      '# Hai lực\n**Kết luận:**\n\nHai lực này triệt tiêu nhau, do đó hợp lực bằng 0.',
    );
    const writes = writesOf(script);
    expect(writes.map((w) => w.text)).toEqual([
      'Hai lực',
      'Hai lực này triệt tiêu nhau, do đó hợp lực bằng 0.',
    ]);
    const result = writes[1];
    expect(result?.role).toBe('result');
    const boxes = actionsOf(script).filter((a) => a.kind === 'mark' && a.mark === 'box');
    expect(boxes).toEqual([{ kind: 'mark', mark: 'box', target: result?.id }]);
    // The label is said with its line.
    expect(saidOf(script)).toContain('Kết luận: Hai lực này triệt tiêu nhau');
  });

  it('a label alone in TeachScript: not written, its box moves to the next write', () => {
    const { script, outline } = checked(
      'Cuối cùng <write id="l1" zone="steps">Kết luận:</write><box target="l1"/> ta được <write id="s1" zone="steps">hợp lực bằng 0</write>.',
    );
    expect(writesOf(script).map((w) => [w.id, w.role])).toEqual([['s1', 'result']]);
    expect(actionsOf(script).filter((a) => a.kind === 'mark')).toEqual([
      { kind: 'mark', mark: 'box', target: 's1' },
    ]);
    expect(outline.parts.map((p) => p.kind)).toEqual(['result']);
    expect(outline.dropped).toContainEqual({ reason: 'label', count: 1 });
  });

  it('greetings are said, not written; reasoning is neither; marks on them go', () => {
    const { script, outline } = checked(
      '<write id="g1" zone="steps">Chào các em!</write><underline target="g1"/> <write id="x1" zone="steps">Let me think about the user</write><circle target="x1"/> Ta có <write id="s1" zone="steps">a = 2 m/s²</write>.<arrow from="g1" to="s1"/>',
    );
    expect(writesOf(script).map((w) => w.id)).toEqual(['s1']);
    expect(actionsOf(script).filter((a) => a.kind !== 'write')).toEqual([]);
    const said = saidOf(script);
    expect(said).toContain('Chào các em!');
    expect(said).not.toMatch(/think|user/u);
    expect(outline.dropped).toEqual(
      expect.arrayContaining([
        { reason: 'social', count: 1 },
        { reason: 'internal', count: 1 },
        { reason: 'orphan', count: 3 },
      ]),
    );
  });

  it('a duplicate write is dropped and its mark goes to the first one', () => {
    const { script } = checked(
      'Ta có <write id="s1" zone="steps">a = 2 m/s²</write>. Nhắc lại <write id="s2" zone="steps">a = 2 m/s²</write><underline target="s2"/>.',
    );
    expect(writesOf(script).map((w) => w.id)).toEqual(['s1']);
    expect(actionsOf(script)).toContainEqual({ kind: 'mark', mark: 'underline', target: 's1' });
  });

  it('a long step with numbers is split into pieces whose ids never look like layout ids', () => {
    const { script } = checked(
      'Ta tính <write id="s1" zone="steps">Đổi đơn vị 72 km/h = 20 m/s, thời gian hãm phanh là 4 s, nên gia tốc a = (0 - 20)/4 = -5 m/s², quãng đường hãm s = 20 · 4 / 2 = 40 m, vận tốc trung bình là 10 m/s</write>.<box target="s1"/>',
    );
    const ids = writesOf(script).map((w) => w.id);
    expect(ids.length).toBeGreaterThan(1);
    expect(ids[0]).toBe('s1');
    for (const id of ids.slice(1)) expect(id).toMatch(/^s1_p\d+$/);
    // layout.freeId renames to "<id>_<n>": a piece never takes that form.
    for (const id of ids) expect(id).not.toMatch(/_\d+$/);
    // The box goes around the last piece; the whole step is still said.
    expect(actionsOf(script)).toContainEqual({ kind: 'mark', mark: 'box', target: ids.at(-1) });
    expect(saidOf(script)).toContain('quãng đường hãm s = 20 · 4 / 2 = 40 m');
  });

  it('a step cut to its key point is still said whole', () => {
    const long =
      'nhiễm sắc thể kép co xoắn cực đại, xếp thành một hàng trên mặt phẳng xích đạo của thoi phân bào';
    const { script } = checked(`Ở kì giữa <write id="s1" zone="steps">${long}</write>.`);
    expect(writesOf(script)[0]?.text.length).toBeLessThanOrEqual(PART_LIMIT.step);
    expect(saidOf(script)).toContain(long);
  });

  it('tables, flows and new-board titles are capped (numbers whole)', () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      Array.from({ length: 7 }, (_, j) => (j === 0 ? `${'chữ '.repeat(15)}${String(i)}` : 'ô')),
    );
    const long = 'một tiêu đề mặt bảng rất dài vượt quá bốn mươi ký tự cho phép';
    const spec = JSON.stringify({ header: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], rows });
    const flow = JSON.stringify({
      steps: Array.from({ length: 8 }, (_, i) => `bước ${'x'.repeat(50)} ${String(i)}`),
    });
    const { script } = checked(
      `<draw id="t1" type="table" spec='${spec}'/> <draw id="f1" type="flow" spec='${flow}'/> <newboard title="${long}"/> Xong.`,
    );
    const [table, flowDraw, board] = actionsOf(script);
    if (table?.kind !== 'draw' || flowDraw?.kind !== 'draw' || board?.kind !== 'newboard')
      throw new Error('missing actions');
    const header = table.spec.header as string[];
    const body = table.spec.rows as string[][];
    expect(header).toHaveLength(5);
    expect(body).toHaveLength(8);
    for (const row of body) expect(row).toHaveLength(5);
    // A cell with a number is kept whole; the others fit 40 characters.
    expect(body[0]?.[0]).toContain('0');
    expect((flowDraw.spec.steps as string[]).length).toBe(6);
    expect(board.title?.length).toBeLessThanOrEqual(40);
  });

  it('a sentence left with nothing to say or do goes, and its pause moves on', () => {
    const { script } = checked(
      'Let me think about the user question.<pause ms="500"/> Ta có <write id="s1" zone="steps">a = 2</write>.',
    );
    expect(script.sentences).toHaveLength(1);
    expect(script.sentences[0]?.pauseMs).toBe(500);
  });

  it('the voice keeps the role of what is written (a carried result is read as a result)', () => {
    const { script } = checked(
      '<write id="l1" zone="steps">Đáp số:</write> <write id="s1" zone="steps">v = 20 m/s</write>.',
    );
    const [sentence] = script.sentences;
    if (!sentence) throw new Error('no sentence');
    expect(voiceCue(sentence).role).toBe('result');
  });

  it('a check label puts the question in the side notes as kind "check"', () => {
    const { script, outline } = checked(
      '<write id="l1" zone="steps">Câu hỏi kiểm tra:</write> <write id="q1" zone="steps">Nếu thả từ 45 m thì sau bao lâu vật chạm đất?</write>.',
    );
    expect(writesOf(script).map((w) => [w.zone, w.role])).toEqual([['side_notes', 'note']]);
    expect(outline.parts.map((p) => p.kind)).toEqual(['check']);
  });

  it('the final check question of a markdown lesson is a short side note', () => {
    const script = scriptFor(
      '# Động năng\n1. $W_đ = \\frac{1}{2}mv^2$\n**Kiểm tra tự:**\n\nNếu vận tốc tăng gấp đôi thì động năng thay đổi thế nào? Hãy thử tính với m = 2 kg.',
    );
    const last = writesOf(script).at(-1);
    expect([last?.zone, last?.role]).toEqual(['side_notes', 'note']);
    // The asking sentence is written, and a sentence with numbers is never dropped (fix round
    // 1: "m = 2 kg" is data the learner needs); the whole check is said.
    expect(last?.text).toBe(
      'Nếu vận tốc tăng gấp đôi thì động năng thay đổi thế nào? Hãy thử tính với m = 2 kg.',
    );
    expect(saidOf(script)).toContain('Hãy thử tính với m = 2 kg.');
    const plain = scriptFor('# Rơi tự do\n1. Vật rơi tự do.\n2. Vậy vật rơi bao lâu?');
    expect(writesOf(plain).at(-1)?.zone).toBe('side_notes');
  });

  it('"append" gives a continuation no second title', () => {
    const script = parseTeachScript(
      'Phần tiếp <write id="t2" zone="title" role="heading">Phần hai</write>.',
    );
    expect(writesOf(validateLesson(script).script)[0]?.zone).toBe('title');
    const appended = writesOf(validateLesson(script, { append: true }).script)[0];
    expect([appended?.zone, appended?.role]).toEqual(['steps', 'heading']);
  });

  it('keeps each sentence’s place in the source', () => {
    const lesson = lessonFor('Câu một. Câu hai <write id="a1" zone="steps">x = 1</write>.');
    expect(lesson.script.sentences.map((s) => [s.start, s.end])).toEqual([
      [0, 8],
      [9, lesson.source.length],
    ]);
  });
});

describe('fix round 1: short lines, computations after a greeting, checks, pieces, boxes', () => {
  const written = (answer: string) => writesOf(scriptFor(answer)).map((w) => w.text);

  it('short learning lines are written (verdicts, unknowns, symbols)', () => {
    expect(written('Không.\n\nVật chuyển động tròn đều có gia tốc hướng tâm.')).toEqual([
      'Không.',
      'Vật chuyển động tròn đều có gia tốc hướng tâm.',
    ]);
    expect(written('**Tóm tắt:**\n- m = 2 kg\n- a = ?')).toEqual(['m = 2 kg', 'a = ?']);
    // Real answer (baseline-greedy P8): σ is written like F, and said in its place.
    const script = scriptFor('Trong đó:\n* σ là độ đàn hồi\n* F là lực nén');
    expect(writesOf(script).map((w) => w.text)).toEqual(['σ là độ đàn hồi', 'F là lực nén']);
    expect(script.sentences.map((s) => s.spoken)).toEqual([
      'Trong đó: σ là độ đàn hồi',
      'F là lực nén',
    ]);
    const example = writesOf(scriptFor('Ví dụ:\n\nDây dẫn.'));
    expect(example.map((w) => [w.text, w.zone])).toEqual([['Dây dẫn.', 'example']]);
  });

  it('a computation after a greeting or a remark is written, without the greeting', () => {
    expect(written('Dưới đây là công thức: a = F/m = 10/2 = 5 m/s².')).toEqual([
      'a = F/m = 10/2 = 5 m/s².',
    ]);
    expect(written('Here is the key equation: F = ma = 2 · 5 = 10 N.')).toEqual([
      'F = ma = 2 · 5 = 10 N.',
    ]);
    const greeting = scriptFor('Chào em, vận tốc sau 2 s là v = gt = 9,8·2 = 19,6 m/s.');
    expect(writesOf(greeting).map((w) => w.text)).toEqual([
      'vận tốc sau 2 s là v = gt = 9,8·2 = 19,6 m/s.',
    ]);
    expect(saidOf(greeting)).toContain('Chào em');
    const { script } = checked(
      'Ta xét <write id="g1" zone="steps">Sau đây ta tính gia tốc: a = F/m = 10/2 = 5 m/s²</write>.',
    );
    expect(writesOf(script).map((w) => w.text)).toEqual(['a = F/m = 10/2 = 5 m/s²']);
  });

  it('a question in the lesson is written whole; only the final check is shortened', () => {
    const problem = written(
      '# Bài toán\nMột ô tô chạy 72 km/h thì hãm phanh, sau 10 s dừng. Tính quãng đường?\n1. Đổi 72 km/h = 20 m/s.',
    );
    expect(problem).toContain(
      'Một ô tô chạy 72 km/h thì hãm phanh, sau 10 s dừng. Tính quãng đường?',
    );
    const { script, outline } = checked(
      'Đề bài: <write id="d1" zone="steps">Một ô tô chạy 72 km/h thì hãm phanh, sau 10 s dừng. Tính quãng đường?</write> Ta giải. <write id="s1" zone="steps">v = 20 m/s</write>.',
    );
    expect(writesOf(script)[0]?.text).toContain('72 km/h');
    expect(outline.parts.map((p) => p.kind)).toEqual(['step', 'step']);
    // "Kiểm tra lại:" verifies the answer: its computation is written.
    const verify = written(
      '**Kiểm tra lại:**\n\nThay vào: F = m·a = 2·5 = 10 N. Khớp với đề bài.',
    ).join(' ');
    expect(verify).toContain('F = m·a = 2·5 = 10 N');
    // The final check keeps a sentence with numbers; a words-only lead goes (it is said).
    const check = scriptFor(
      '# Rơi tự do\n1. $h = \\frac{1}{2}gt^2$\n**Câu hỏi kiểm tra:**\n\nHãy suy nghĩ kỹ nhé. Nếu thả từ 45 m thì sau bao lâu vật chạm đất?',
    );
    expect(writesOf(check).at(-1)?.text).toBe('Nếu thả từ 45 m thì sau bao lâu vật chạm đất?');
    expect(saidOf(check)).toContain('Hãy suy nghĩ kỹ nhé.');
    const final = checked(
      'Ta có <write id="s1" zone="steps">a = 2 m/s²</write>. Thử nhé: <write id="q1" zone="steps">Em đã hiểu chưa. Với m = 4 kg thì F bằng bao nhiêu?</write>',
    );
    expect(writesOf(final.script).at(-1)?.text).toBe('Với m = 4 kg thì F bằng bao nhiêu?');
    expect(final.outline.parts.at(-1)?.kind).toBe('check');
  });

  it('a correction on a split write strikes every piece and stands after the last', () => {
    const { script } = checked(
      'Ta tính <write id="s3" zone="steps">Quãng đường đi được trong giai đoạn đầu là s1 = 20·5 = 100 m, quãng đường đi được trong giai đoạn sau là s2 = 15·5 = 75 m, nên tổng quãng đường là s = 175 m</write>. À nhầm. <correct target="s3">s = 150 m</correct>.',
    );
    const ids = writesOf(script).map((w) => w.id);
    expect(ids.length).toBeGreaterThan(1);
    const correct = actionsOf(script).find((a) => a.kind === 'correct');
    expect(correct).toEqual({
      kind: 'correct',
      target: ids.at(-1),
      text: 's = 150 m',
      strike: ids.slice(0, -1),
    });
    // An underline of the whole write goes under every piece.
    const underlined = checked(
      'Ta tính <write id="s3" zone="steps">Quãng đường đi được trong giai đoạn đầu là s1 = 20·5 = 100 m, quãng đường đi được trong giai đoạn sau là s2 = 15·5 = 75 m, nên tổng quãng đường là s = 175 m</write>.<underline target="s3"/>',
    );
    expect(
      actionsOf(underlined.script).flatMap((a) => (a.kind === 'mark' ? [a.target] : [])),
    ).toEqual(writesOf(underlined.script).map((w) => w.id));
  });

  it('a result boxed in a later sentence is boxed once', () => {
    const { script } = checked(
      'Cuối cùng. <write id="k" zone="steps">Kết luận:</write> <write id="r1" zone="steps" role="result">a = 5 m/s²</write>. Đây là đáp số. <box target="r1"/>',
    );
    const boxes = actionsOf(script).filter((a) => a.kind === 'mark' && a.mark === 'box');
    expect(boxes).toEqual([{ kind: 'mark', mark: 'box', target: 'r1' }]);
  });
});

describe('fix round 2: nothing the learner needs is lost', () => {
  const written = (script: ParsedScript) => writesOf(script).map((w) => w.text);
  const boxes = (script: ParsedScript) =>
    actionsOf(script).flatMap((a) => (a.kind === 'mark' && a.mark === 'box' ? [a.target] : []));

  it('a result repeated in parts a and b is written, boxed and said in both', () => {
    const { script } = lessonFor(
      'Ở câu a, <write id="r1" role="result">v = 20 m/s</write><box target="r1"/>. Ở câu b, vận tốc cũng là <write id="r2" role="result">v = 20 m/s</write><box target="r2"/>.',
    );
    expect(writesOf(script).map((w) => w.id)).toEqual(['r1', 'r2']);
    expect(boxes(script)).toEqual(['r1', 'r2']);
    expect(script.sentences[1]?.spoken).toBe('Ở câu b, vận tốc cũng là v = 20 m/s.');
  });

  it('a formula repeated on a new face is written there, with its own mark', () => {
    for (const answer of [
      'Bài 1: áp dụng <write id="f1" zone="steps">a = F/m</write> ta được <write id="r1" zone="steps">a = 2 m/s²</write>. <newboard title="Bài 2"/> Bài 2 cũng áp dụng <write id="f2" zone="steps">a = F/m</write><circle target="f2"/> ta được <write id="r2" zone="steps">a = 3 m/s²</write>.',
      'Ta áp dụng <write id="f1" zone="steps">a = F/m</write>. <newboard title="Ví dụ"/>Lại áp dụng <write id="f2" zone="steps">a = F/m</write><circle target="f2"/>.',
    ]) {
      const { script } = lessonFor(answer);
      expect(writesOf(script).map((w) => w.id)).toContain('f2');
      expect(actionsOf(script)).toContainEqual({ kind: 'mark', mark: 'circle', target: 'f2' });
      expect(saidOf(script)).toMatch(/áp dụng a = F\/m/u);
    }
  });

  it('a step repeated in parts a) and b) of a markdown answer is written in both', () => {
    const md =
      '# Rơi tự do\n\n**a)** Tính vận tốc sau 2 s.\n\n1. Áp dụng công thức v = v₀ + at\n2. v = 0 + 10·2 = 20 m/s\n\n**b)** Tính vận tốc sau 3 s.\n\n1. Áp dụng công thức v = v₀ + at\n2. v = 0 + 10·3 = 30 m/s';
    expect(written(scriptFor(md)).filter((t) => t.includes('v = v₀ + at'))).toHaveLength(2);
  });

  it('two texts that differ only by Vietnamese marks are both written', () => {
    const { script } = lessonFor(
      'So sánh: <write id="a1" zone="steps">Vật rơi</write> và <write id="a2" zone="steps">Vật rời</write>.',
    );
    expect(written(script)).toEqual(['Vật rơi', 'Vật rời']);
  });

  it('a glitch repeat in the next sentence is written once, still said, never boxed twice', () => {
    const { script } = checked(
      'Ta có <write id="s1" zone="steps">a = 2 m/s²</write><box target="s1"/>. Nhắc lại <write id="s2" zone="steps">a = 2 m/s²</write><box target="s2"/>.',
    );
    expect(writesOf(script).map((w) => w.id)).toEqual(['s1']);
    expect(boxes(script)).toEqual(['s1']);
    expect(script.sentences[1]?.spoken).toBe('Nhắc lại a = 2 m/s².');
  });

  it('a short line with a link keeps its formula or quantity; only the link goes', () => {
    const md = scriptFor(
      'Tốc độ ánh sáng trong chân không là c ≈ 3·10⁸ m/s (https://vi.wikipedia.org/wiki/Tốc_độ_ánh_sáng).\n\nVậy ánh sáng đi 1 m mất khoảng 3,3 ns.',
    );
    expect(written(md)).toContain('Tốc độ ánh sáng trong chân không là c ≈ 3·10⁸ m/s.');
    expect(saidOf(md)).toContain('c ≈ 3·10⁸ m/s.');
    const cited = scriptFor(
      'Theo Wikipedia, g ≈ 9,81 m/s² [nguồn](https://vi.wikipedia.org/wiki/Rơi_tự_do).',
    );
    expect(written(cited)).toEqual(['Theo Wikipedia, g ≈ 9,81 m/s².']);
    const ts = scriptFor(
      'Theo SGK, g = 9,8 m/s² (https://vi.wikipedia.org/wiki/Rơi_tự_do). Khi đó <write id="s1" zone="steps">t = 2 s</write>.',
    );
    expect(saidOf(ts)).toContain('Theo SGK, g = 9,8 m/s².');
    for (const s of [md, cited, ts]) expect(saidOf(s)).not.toMatch(/https?:|\(\s*\)/u);
    // A real source line is still neither said nor written.
    const source = scriptFor(
      '# Lực\n\nLực là đại lượng vectơ.\n\nWikipedia: https://vi.wikipedia.org/wiki/Lực',
    );
    expect(saidOf(source)).not.toMatch(/Wikipedia/u);
  });

  it('a write with a formula but no digit is never cut to a key point', () => {
    for (const text of [
      'Định luật II Newton: gia tốc của vật tỉ lệ thuận với lực tác dụng và tỉ lệ nghịch với khối lượng, a = F/m.',
      'Phản ứng trung hòa giữa axit và bazơ tạo thành muối và nước: HCl + NaOH → NaCl + H₂O.',
      'Động lượng của một vật là tích của khối lượng và vận tốc của vật, kí hiệu p = mv, đơn vị kg·m/s.',
    ]) {
      expect(text.length).toBeGreaterThan(PART_LIMIT.step);
      const { script } = lessonFor(`Ta nhớ <write id="s1">${text}</write>`);
      expect(written(script).join(' ')).toBe(text);
    }
    // A key point never cuts a formula away: it ends after it.
    expect(
      keyPoint(
        'Động lượng của một vật là tích của khối lượng và vận tốc, kí hiệu là p = mv, nó là một đại lượng vectơ cùng hướng với vận tốc',
      ),
    ).toContain('p = mv');
  });

  it('a last line the teacher answers is a step, not a check; "≠" is data of a check', () => {
    const md = scriptFor(
      '# Rơi tự do\n\n1. Vật rơi với gia tốc g.\n2. Vì sao vật rơi nhanh dần? Vì trọng lực không đổi nên gia tốc không đổi.',
    );
    const last = writesOf(md).at(-1);
    expect([last?.zone, last?.role]).toEqual(['steps', 'body']);
    expect(last?.text).toContain('Vì trọng lực không đổi');
    const ts = checked(
      'Ta có <write id="s1" zone="steps">a = g</write>. <write id="q1" zone="steps">Vì sao vật rơi nhanh dần? Vì trọng lực không đổi.</write>',
    );
    expect(writesOf(ts.script).at(-1)?.text).toBe(
      'Vì sao vật rơi nhanh dần? Vì trọng lực không đổi.',
    );
    expect(ts.outline.parts.at(-1)?.kind).toBe('step');
    // A hint after the question keeps it a check; a sentence with "≠" in it is data.
    expect(questionOf('Hai lực này có cân bằng không? Ta thấy F ≠ P.')).toBe(
      'Hai lực này có cân bằng không? Ta thấy F ≠ P.',
    );
  });

  it('markup the reader drops is never said, shown or written', () => {
    const ts = lessonFor(
      '<step>Bước 1: Đổi đơn vị.</step> <write id="s1" zone="steps">v = 72 km/h = 20 m/s</write>.',
    );
    for (const s of ts.script.sentences) {
      expect(subtitleText(s.spoken)).not.toMatch(/<\/?step>/u);
      expect(toSpeech(s.spoken)).not.toMatch(/lớn hơn|nhỏ hơn/u);
    }
    expect(saidOf(lessonFor('<say>Chào em, mình cùng học nhé.</say>').script)).toBe(
      'Chào em, mình cùng học nhé.',
    );
    for (const md of [
      '# Pha loãng\n\n<note>Lưu ý: đổi 500 ml = 0,5 L</note>\n\n1. C₁V₁ = C₂V₂',
      '# Pha loãng\n\n<note>\nLưu ý: đổi 500 ml = 0,5 L\n</note>\n\n1. C₁V₁ = C₂V₂',
    ]) {
      const notes = writesOf(scriptFor(md)).filter((w) => w.zone === 'side_notes');
      expect(notes.map((w) => [w.role, w.text])).toEqual([['note', 'Lưu ý: đổi 500 ml = 0,5 L']]);
      expect(written(scriptFor(md)).join(' ')).not.toMatch(/<\/?note>/u);
    }
    const inWrite = scriptFor(
      'Ta có <write id="s1" zone="steps"><note>đổi 500 ml = 0,5 L</note></write>.',
    );
    expect(written(inWrite)).toEqual(['đổi 500 ml = 0,5 L']);
  });

  it('a power written with <sup> keeps its digits for the voice, the subtitle and the board', () => {
    const md = scriptFor('Một mol chứa 6,02·10<sup>23</sup> hạt.');
    const spoken = md.sentences[0]?.spoken ?? '';
    expect(spoken).toBe('Một mol chứa 6,02·$10^{23}$ hạt.');
    expect(subtitleText(spoken)).toBe('Một mol chứa 6,02·10²³ hạt.');
    expect(toSpeech(spoken)).not.toMatch(/nghìn không trăm hai mươi ba/u);
    expect(
      written(scriptFor('Có <write id="r1" zone="steps">1,2·10<sup>24</sup> nguyên tử</write>.')),
    ).toEqual(['1,2·$10^{24}$ nguyên tử']);
    const avogadro = scriptFor('Số Avogadro N_A = 6,02·10<sup>23</sup> mol<sup>-1</sup>.');
    expect(written(avogadro)).toEqual(['Số Avogadro N_A = 6,02·$10^{23}$ mol⁻¹.']);
    expect(toSpeech(avogadro.sentences[0]?.spoken ?? '')).not.toMatch(
      /nghìn không trăm hai mươi ba/u,
    );
  });
});

describe('numbers in = numbers out (property)', () => {
  const UNITS = ['m', 'kg', 'm/s', 'm/s²', 'N', 'J', 's', 'mol', '%', ''];
  const FILLER = [
    'Ta có',
    'vì vậy',
    'nên',
    'khi đó',
    'theo định luật',
    'vật chuyển động',
    'lực tác dụng',
    'Chào bạn!',
    'Hy vọng điều này giúp bạn.',
    'Dưới đây là lời giải.',
    'tổng hợp lại',
    // Fix round 2: citations and markup around the numbers.
    '(https://vi.wikipedia.org/wiki/Lực)',
    '[nguồn](https://vi.wikipedia.org/wiki/Lực)',
    'trung bình <v>',
  ];
  const numbers = (s: string) => s.match(/\d+(?:[.,]\d+)?/g) ?? [];

  it('every number of a random answer is written or said, whole; words-only parts fit', () => {
    const r = rng(7);
    const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)] as T;
    const number = () => {
      const n = (r() * 1000).toFixed(Math.floor(r() * 3));
      const shown = r() < 0.5 ? n.replace('.', ',') : n;
      // A power written as HTML ("6,02·10<sup>23</sup>"): its digits are never lost.
      return r() < 0.1 ? `${shown}·10<sup>${String(Math.floor(r() * 30) - 5)}</sup>` : shown;
    };
    for (let round = 0; round < 150; round++) {
      const lines: string[] = [];
      const count = 2 + Math.floor(r() * 8);
      for (let i = 0; i < count; i++) {
        const words = Array.from({ length: 1 + Math.floor(r() * 14) }, () =>
          r() < 0.35 ? `${number()} ${pick(UNITS)}`.trim() : pick(FILLER),
        );
        if (r() < 0.25) words.unshift(`${pick(['a', 'v', 'F', 's', 'm'])} =`);
        const line = words.join(r() < 0.5 ? ', ' : ' ');
        const shape = r();
        lines.push(
          shape < 0.15
            ? `# ${line}`
            : shape < 0.3
              ? `${String(i + 1)}. ${line}`
              : shape < 0.4
                ? `**Kết luận:**\n${line}`
                : shape < 0.5
                  ? `<write id="w${String(i)}" zone="steps">${line}</write>.`
                  : shape < 0.55
                    ? `<step>${line}</step>`
                    : line,
        );
      }
      const answer = lines.join('\n');
      const lesson = lessonFor(answer);
      const shown = [
        ...lesson.script.sentences.map((s) => s.spoken),
        ...writesOf(lesson.script).map((w) => w.text),
      ].join(' \n ');
      // Numbers of the answer's text (not of its tags' ids).
      for (const n of numbers(answer.replace(/<[^>]*>/g, ' '))) {
        expect(shown, `${n} lost from:\n${answer}`).toMatch(
          new RegExp(`(?<![\\d.,])${n.replace(/[.,]/g, '[.,]')}(?![\\d])`),
        );
      }
      // A words-only part fits its limit; one with a number or a formula ("=", "→", "H₂O") is
      // split at clause boundaries or kept whole, never cut.
      for (const part of lesson.outline.parts) {
        if (!part.math && !/[\d$=≈≤≥≠→⇌⟶⇄↔₀-₉⁰-⁹²³¹]/u.test(part.text))
          expect(
            part.text.length,
            `${part.kind}: ${part.text}\nin:\n${answer}`,
          ).toBeLessThanOrEqual(PART_LIMIT[part.kind]);
      }
    }
  });
});
