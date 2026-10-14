import { describe, expect, it } from 'vitest';
import golden from './pronounceGolden.json';
import bench from './ttsBenchSet.json';
import {
  MIN_CUT_WORDS,
  MMS_CHUNK_MAX,
  MMS_FIRST_CHUNK_MAX,
  PAUSE_MS,
  ROLE_PROSODY,
  SPEECH_ROLES,
  classifyRole,
  prepareSpeech,
  stripInternalMarkup,
  type SpeechPlan,
} from './speechPlan';
import { toSpeech } from './vietnameseText';

/**
 * The speech plan (speechPlan.ts): text prepared apart from any voice, cut into chunks with a
 * planned pause and a role. Pure: no audio, no model.
 */
const texts = (plan: SpeechPlan) => plan.chunks.map((c) => c.text);
const joined = (plan: SpeechPlan) => texts(plan).join(' ');
const flat = (s: string) => s.replace(/\s+/g, ' ').trim();

/** The phrase is said inside one chunk (never cut across two). */
function inOneChunk(plan: SpeechPlan, phrase: string): boolean {
  const f = phrase.toLowerCase();
  return plan.chunks.some((c) => c.text.toLowerCase().includes(f));
}

const SAMPLES = [
  ...(golden as { text: string }[]).map((g) => g.text),
  ...(bench as { text: string }[]).map((b) => b.text),
];

describe('the plan says the prepared text, word for word and in order', () => {
  it.each(SAMPLES.map((t) => [t.slice(0, 40), t]))('%s', (_name, text) => {
    const plan = prepareSpeech(text);
    expect(joined(plan)).toBe(flat(plan.text));
    expect(plan.chunks.every((c) => c.text === c.text.trim() && c.text !== '')).toBe(true);
  });

  it('is the reader’s text (without dictionary terms, the voice hears what toSpeech says)', () => {
    const text = 'Gia tốc g = 9,81 m/s². Vậy F = m·a.';
    expect(prepareSpeech(text).text).toBe(toSpeech(text));
  });

  it('is pure: the same text gives the same plan', () => {
    const text = (bench as { text: string }[])[4]?.text ?? '';
    expect(prepareSpeech(text)).toEqual(prepareSpeech(text));
  });

  it('cuts a very long answer at a sentence end', () => {
    const long = 'Đây là một câu khá dài để kiểm tra giới hạn độ dài của bài đọc. '.repeat(60);
    const plan = prepareSpeech(long);
    expect(plan.text.length).toBeLessThanOrEqual(2400);
    expect(plan.text.endsWith('.')).toBe(true);
  });
});

describe('pauses follow punctuation and structure', () => {
  it('orders the pauses: comma < semicolon/colon < sentence < paragraph or list item', () => {
    expect(PAUSE_MS.comma).toBeLessThan(PAUSE_MS.clause);
    expect(PAUSE_MS.clause).toBeLessThan(PAUSE_MS.sentence);
    expect(PAUSE_MS.sentence).toBeLessThan(PAUSE_MS.paragraph);
    expect(PAUSE_MS.emphasis).toBeLessThan(PAUSE_MS.comma);
    expect(PAUSE_MS.end).toBe(0);
  });

  it('plans each pause from what ends the chunk; the last chunk has none', () => {
    const plan = prepareSpeech(
      'Ta có hai lực tác dụng, lực kéo và lực ma sát; chúng ngược chiều nhau. Xét lực kéo trước.\nSau đó xét lực ma sát nhé.',
    );
    expect(plan.chunks.map((c) => [c.text, c.pauseMs])).toEqual([
      ['Ta có hai lực tác dụng,', PAUSE_MS.comma],
      ['lực kéo và lực ma sát;', PAUSE_MS.clause],
      ['chúng ngược chiều nhau.', PAUSE_MS.sentence],
      ['Xét lực kéo trước.', PAUSE_MS.paragraph],
      ['Sau đó xét lực ma sát nhé.', 0],
    ]);
  });

  it('list items end with the paragraph pause', () => {
    const plan = prepareSpeech('- Kì đầu: nhiễm sắc thể co xoắn.\n- Kì giữa: xếp thành một hàng.');
    expect(plan.chunks.find((c) => c.text.includes('co xoắn'))?.pauseMs).toBe(PAUSE_MS.paragraph);
  });

  it('joins a lone word to its neighbour instead of saying it alone', () => {
    const plan = prepareSpeech('Vậy, lực kéo bằng mười niu-tơn.');
    expect(texts(plan)).toEqual(['Vậy, lực kéo bằng mười niu-tơn.']);
    // A list keeps its pauses between items of two words or more.
    expect(texts(prepareSpeech('Có bốn kì: kì đầu, kì giữa, kì sau và kì cuối.'))).toEqual([
      'Có bốn kì:',
      'kì đầu,',
      'kì giữa,',
      'kì sau và kì cuối.',
    ]);
  });
});

describe('chunks are sized for the on-device voice', () => {
  const long =
    'Theo nguyên lí Le Chatelier, khi tăng nồng độ chất phản ứng thì cân bằng chuyển dịch theo chiều làm giảm nồng độ chất đó và ngược lại khi giảm nồng độ thì cân bằng chuyển dịch theo chiều thuận để bù lại phần mất đi.';

  it('keeps every chunk under the limit, cutting before a conjunction', () => {
    const plan = prepareSpeech(long);
    for (const c of plan.chunks) expect(c.text.length).toBeLessThanOrEqual(MMS_CHUNK_MAX);
    expect(plan.chunks.some((c) => /^(?:và|thì|khi|để) /.test(c.text))).toBe(true);
    expect(plan.chunks.find((c) => c.boundary === 'phrase')?.pauseMs).toBe(PAUSE_MS.phrase);
  });

  it('starts with a short first chunk when a conjunction allows it (the voice starts sooner)', () => {
    const plan = prepareSpeech(
      'Khi một vật chuyển động thẳng đều thì quãng đường đi được tỉ lệ thuận với thời gian chuyển động.',
    );
    expect(plan.chunks[0]?.text.length).toBeLessThanOrEqual(MMS_FIRST_CHUNK_MAX);
    expect(plan.chunks).toHaveLength(2);
  });

  it('never cuts before "với": it binds to the words before it ("cùng hướng với")', () => {
    const plan = prepareSpeech(
      'Định luật hai Niu-tơn cho biết gia tốc của một vật cùng hướng với lực tác dụng lên vật.',
    );
    expect(plan.chunks.some((c) => c.text.startsWith('với'))).toBe(false);
  });

  it('never cuts inside a number with its unit, a formula, an equation or a name', () => {
    const tight = { maxChunkChars: 30, firstChunkChars: 30 };
    const quantity = prepareSpeech(
      'Một vật nhỏ đặt trên mặt bàn nằm ngang chịu lực kéo có độ lớn 1 234,5 N theo phương song song mặt bàn',
      tight,
    );
    expect(inOneChunk(quantity, 'một nghìn hai trăm ba mươi tư phẩy năm niu-tơn')).toBe(true);
    const formula = prepareSpeech(
      'Trong chuyển động nhanh dần đều ta luôn dùng công thức $v = v_0 + at$ để tìm vận tốc của vật',
      tight,
    );
    expect(inOneChunk(formula, toSpeech('$v = v_0 + at$'))).toBe(true);
    const equation = prepareSpeech(
      'Khi đốt cháy khí hiđro trong oxi ta có phương trình 2H2 + O2 → 2H2O và phản ứng tỏa nhiều nhiệt',
      tight,
    );
    expect(inOneChunk(equation, 'hai hát hai cộng ô hai tạo thành hai hát hai ô')).toBe(true);
    const name = prepareSpeech(
      'Khi hệ đang cân bằng mà bị tác động thì theo nguyên lí Le Chatelier hệ chuyển dịch để chống lại',
      tight,
    );
    expect(inOneChunk(name, 'Lơ Sa-tơ-li-ê')).toBe(true);
    for (const plan of [quantity, formula, equation, name]) {
      expect(joined(plan)).toBe(flat(plan.text));
    }
  });

  it('never cuts a time or a formula at its own colon or comma', () => {
    const plan = prepareSpeech('Lúc 10:30 thì $f(x, y) = x + y$, ta có kết quả.');
    expect(inOneChunk(plan, 'mười: ba mươi')).toBe(true);
    expect(inOneChunk(plan, 'ép (ích, i) bằng ích cộng i')).toBe(true);
  });

  it('a cut between words leaves enough words on each side', () => {
    const plan = prepareSpeech(
      'Một hai ba bốn năm sáu bảy tám chín mười mười một mười hai mười ba mười bốn mười lăm mười sáu',
      { maxChunkChars: 20 },
    );
    for (const c of plan.chunks.filter((x) => x.boundary === 'phrase')) {
      expect(c.text.split(' ').length).toBeGreaterThanOrEqual(MIN_CUT_WORDS);
    }
  });
});

describe('roles and prosody', () => {
  it.each([
    ['Em hãy cho biết vận tốc sau hai giây là bao nhiêu?', 'check'],
    ['Chưa đúng rồi, em xem lại dấu của gia tốc nhé.', 'feedback'],
    ['Đúng rồi! Em làm rất tốt.', 'feedback'],
    ['Em làm rất tốt, cách lập luận rõ ràng.', 'feedback'],
    ['Các em giỏi lắm!', 'feedback'],
    ['Vậy ép bằng hai mươi niu-tơn.', 'result'],
    ['Gia tốc là đại lượng được gọi là tốc độ biến đổi vận tốc.', 'concept'],
    ['Bước hai, ta thay số vào công thức.', 'step'],
    ['một, Tính gia tốc.', 'step'],
    ['Hôm nay trời đẹp.', 'plain'],
  ])('"%s" is a %s sentence', (sentence, role) => {
    expect(classifyRole(sentence)).toBe(role);
  });

  it('gives every chunk the prosody of its role, within ±10 % of the voice’s pace', () => {
    for (const role of SPEECH_ROLES) {
      const p = ROLE_PROSODY[role];
      expect(p.rate).toBeGreaterThanOrEqual(0.9);
      expect(p.rate).toBeLessThanOrEqual(1.1);
      expect(p.noiseScale).toBeGreaterThanOrEqual(0.5);
      expect(p.noiseScale).toBeLessThanOrEqual(0.8);
      expect(p.noiseScaleDuration).toBeGreaterThanOrEqual(0.6);
      expect(p.noiseScaleDuration).toBeLessThanOrEqual(1);
    }
    const plan = prepareSpeech('Em tính được bao nhiêu? Vậy ép bằng hai mươi niu-tơn.');
    expect(plan.chunks.map((c) => [c.role, c.rate])).toEqual([
      ['check', ROLE_PROSODY.check.rate],
      ['result', ROLE_PROSODY.result.rate],
    ]);
    expect(ROLE_PROSODY.result.rate).toBeLessThan(ROLE_PROSODY.step.rate);
    expect(ROLE_PROSODY.concept.rate).toBeLessThan(ROLE_PROSODY.step.rate);
    expect(ROLE_PROSODY.feedback.rate).toBeLessThan(ROLE_PROSODY.step.rate);
  });

  it('the board’s heading or result wins; a question heard in a step is still a question', () => {
    expect(prepareSpeech('Định luật hai Niu-tơn.', { role: 'heading' }).chunks[0]?.role).toBe(
      'heading',
    );
    expect(prepareSpeech('Ta thay số vào.', { role: 'step' }).chunks[0]?.role).toBe('step');
    expect(prepareSpeech('Thay số được bao nhiêu?', { role: 'step' }).chunks[0]?.role).toBe(
      'check',
    );
    expect(prepareSpeech('Em tính được bao nhiêu?', { role: 'result' }).chunks[0]?.role).toBe(
      'result',
    );
  });

  it('a key term gets a short pause before it and a slower pace, not a louder voice', () => {
    const plan = prepareSpeech('Đại lượng đặc trưng cho sự biến đổi vận tốc là gia tốc của vật.', {
      emphasis: ['gia tốc'],
    });
    const i = plan.chunks.findIndex((c) => c.text.startsWith('gia tốc'));
    expect(i).toBeGreaterThan(0);
    expect(plan.chunks[i - 1]?.pauseMs).toBe(PAUSE_MS.emphasis);
    expect(plan.chunks[i]?.role).toBe('keyword');
    expect(plan.chunks[i]?.rate).toBe(ROLE_PROSODY.keyword.rate);
    expect(joined(plan)).toBe(flat(plan.text));
  });

  it('bold words are key terms; a bold label such as "**Bước 1:**" is not', () => {
    const plan = prepareSpeech('Ta gọi đại lượng này là **gia tốc** của vật.');
    expect(plan.chunks.some((c) => c.role === 'keyword' && c.text.startsWith('gia tốc'))).toBe(
      true,
    );
    const label = prepareSpeech('**Bước 1:** Tính gia tốc của vật trên mặt phẳng nghiêng.');
    expect(label.chunks.some((c) => c.role === 'keyword')).toBe(false);
  });
});

describe('what is not meant to be heard', () => {
  it('drops hidden reasoning, references, tags (also with ">" in an attribute) and emoji', () => {
    const text =
      '<think>tính nhẩm 2 + 2</think>Xin chào 👋 các em! <draw id="d1" type="flow" spec=\'{"steps":["a > b"]}\'/> <write id="t1" zone="title" role="heading">Lực</write>\n---\n<reference kind="web">bỏ qua</reference>Hết.';
    const cleaned = stripInternalMarkup(text);
    expect(cleaned).not.toMatch(/think|tính nhẩm|draw|steps|reference|bỏ qua|👋|---|<|>/u);
    expect(cleaned).toContain('Lực');
    const plan = prepareSpeech(text);
    expect(plan.text).not.toMatch(/[<>{}"]/);
    expect(plan.text).toContain('Xin chào các em!');
  });

  it('keeps arrows and symbols that are also emoji characters (↔ ↗ ✔ ™), drops real emoji', () => {
    const text = 'A ↔ B, giá ↗, đúng ✔, SimLab™ ✅ 😀 \u{2b06}\u{fe0f} ↑ ↓ → ⇌';
    expect(stripInternalMarkup(text)).toBe('A ↔ B, giá ↗, đúng ✔, SimLab™    ↑ ↓ → ⇌');
  });

  it('reads "0,2 M" as mol per litre although the dictionary changed "enzyme" (context as written)', () => {
    const text = 'Enzyme catalase bị ức chế ở 0,2 M';
    expect(prepareSpeech(text).text).toBe(
      'En-zim catalase bị ức chế ở không phẩy hai mol trên lít',
    );
    // Any reading the dictionary gives: the context is taken before it.
    const dictionary = [
      {
        term: 'enzyme',
        reading: 'en-dim',
        subject: 'biology' as const,
        review_status: 'pending' as const,
      },
    ];
    expect(prepareSpeech(text, { dictionary }).text).toBe(
      'En-dim catalase bị ức chế ở không phẩy hai mol trên lít',
    );
  });

  it('applies the pronunciation dictionary and keeps a reading in one chunk', () => {
    const plan = prepareSpeech('Tần số đo bằng Hertz, theo Mendeleev.');
    expect(plan.text).toBe('Tần số đo bằng Héc, theo Men-đê-lê-ép.');
  });

  it('an empty or markup-only text has nothing to say', () => {
    expect(prepareSpeech('  ').chunks).toEqual([]);
    expect(prepareSpeech('<think>chỉ nghĩ</think>').chunks).toEqual([]);
  });
});
