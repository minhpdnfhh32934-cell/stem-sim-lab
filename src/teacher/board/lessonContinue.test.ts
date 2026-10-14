import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoiceStore } from '@/teacher/voice/voiceStore';
import fixtures from './boardFixtures.json';
import type { Measure } from './layout';

/**
 * "Viết tiếp" (item 1, fix round 1): an answer cut at the output limit and then continued leaves
 * the board exactly as if the whole answer had been taught at once: no stump of a line cut
 * mid-word, inside "**", in a line that grew past the board's length, that became a label, or
 * that was the final check before the answer went on. Lessons run instantly ("Viết nhanh").
 */
vi.mock('@/teacher/voice/speak', () => ({
  newVoiceSession: () => ({ skipped: null }),
  speak: () => Promise.resolve(),
  stopSpeaking: () => undefined,
  toSpokenText: (text: string) => text,
}));

const lesson = await import('./lesson');
const { useBoardStore } = await import('./boardStore');

const measure: Measure = {
  text: (s, px) => s.length * px * 0.5,
  math: (tex, px) => ({ w: tex.length * px * 0.6, h: px * 1.3 }),
};

/** What the learner sees: the texts not erased, in board order, and the marks by kind. */
function seen(): { texts: string[]; marks: string[] } {
  const { layout, erased, marks } = useBoardStore.getState();
  return {
    texts: layout.elements.flatMap((e) =>
      e.kind === 'text' && !erased[e.id] ? [`${e.role}|${e.source}`] : [],
    ),
    marks: marks.map((m) => m.kind).sort(),
  };
}

async function fresh(content: string) {
  const done = lesson.playLesson({ id: 'fresh', content, question: '' }, measure);
  lesson.finishNow();
  await done;
  return seen();
}

async function continued(part: string, full: string) {
  const first = lesson.playLesson({ id: 'cut', content: part, question: '' }, measure);
  lesson.finishNow();
  await first;
  const rest = lesson.continueLesson({ id: 'cut', content: full, question: '' }, measure);
  lesson.finishNow();
  await rest;
  return seen();
}

beforeEach(() => {
  useVoiceStore.setState({ enabled: false, speaking: false });
});
afterEach(() => {
  lesson.stopLesson();
  useBoardStore.getState().set({ speed: 1 });
});

describe('"Viết tiếp" equals teaching the whole answer at once', () => {
  it.each([
    [
      'a markdown line cut mid-word',
      '# Rơi tự do\n1. Vật rơi từ độ',
      '# Rơi tự do\n1. Vật rơi từ độ cao 20 m.\n2. Thời gian rơi là 2 s.',
    ],
    [
      'a cut inside "**"',
      '# Nguyên phân\nVậy, tế bào sẽ tạo ra **3 tế bào*',
      '# Nguyên phân\nVậy, tế bào sẽ tạo ra **3 tế bào** con.\n\nĐó là kết quả.',
    ],
    [
      'a line that grows past the board length',
      '# Lực\nDữ liệu cho thấy tốc độ này liên',
      `# Lực\nDữ liệu cho thấy tốc độ này liên tục tăng ${'khi lực kéo tác dụng lên vật lớn dần theo thời gian và '.repeat(2)}ta có a = F/m = 10/2 = 5 m/s².\n\nXong.`,
    ],
    [
      'a stump that becomes a label',
      '# Gia tốc\n**Tí',
      '# Gia tốc\n**Tính toán:**\n\na = F/m = 10/2 = 5 m/s².',
    ],
    [
      'a final check that is a step once the answer goes on',
      '# Bài toán\nMột ô tô chạy 72 km/h. Tính quãng đường?',
      '# Bài toán\nMột ô tô chạy 72 km/h. Tính quãng đường?\n1. Đổi 72 km/h = 20 m/s.',
    ],
    [
      'a final check followed by words only, then by more steps',
      '# Quang hợp\n1. Tại sao cây xanh cần ánh sáng?\n\nChúng ta hãy cùng tìm hiểu nhé.',
      '# Quang hợp\n1. Tại sao cây xanh cần ánh sáng?\n\nChúng ta hãy cùng tìm hiểu nhé.\n\nTuy nhiên, cây cần cả nước.',
    ],
    [
      'a symbol cut before its subscript',
      '# Pha loãng\n- V',
      '# Pha loãng\n- V₁ là thể tích dung dịch.\n- C₁ = 2 mol/L.',
    ],
    [
      'a TeachScript write cut inside its text',
      'Ta có <write id="s1" zone="steps">v = g',
      'Ta có <write id="s1" zone="steps">v = gt = 20 m/s</write>.<box target="s1"/> Xong.',
    ],
    [
      'a result whose box comes after the cut',
      'Vậy <write id="r1" zone="steps" role="result">a = 5',
      'Vậy <write id="r1" zone="steps" role="result">a = 5 m/s²</write>.<box target="r1"/> Hết.',
    ],
  ])('%s', async (_name, part, full) => {
    expect(full.startsWith(part)).toBe(true);
    const whole = await fresh(full);
    expect(await continued(part, full)).toEqual(whole);
  });

  const answers = [...fixtures.answers, ...fixtures.synthetic].map((f) => f.answer);
  it.each(answers.flatMap((answer, i) => [0.35, 0.6, 0.85].map((at) => [i, at, answer] as const)))(
    'fixture %i cut at %f',
    async (_i, at, answer) => {
      const part = answer.slice(0, Math.floor(answer.length * at));
      const whole = await fresh(answer);
      expect(await continued(part, answer)).toEqual(whole);
    },
  );
});

describe('"Viết tiếp" after a lesson that was stopped part way', () => {
  it('teaches what the stopped run never reached, once', async () => {
    useBoardStore.getState().set({ speed: 2 });
    const part =
      '# Rơi tự do\n1. Chọn chiều dương hướng xuống.\n2. Gốc thời gian lúc thả vật.\n3. Vật rơi từ độ cao';
    const full = `${part} 20 m.\n4. Thời gian rơi là 2 s.`;
    const whole = await fresh(full);
    const first = lesson.playLesson({ id: 'stopped', content: part, question: '' }, measure);
    // Stopped while the first step is being written (the voice is off: the pen is slow).
    const end = Date.now() + 5000;
    while ((useBoardStore.getState().progress.s1 ?? 0) === 0 && Date.now() < end)
      await new Promise((r) => setTimeout(r, 5));
    lesson.stopLesson();
    await first;
    const rest = lesson.continueLesson({ id: 'stopped', content: full, question: '' }, measure);
    lesson.finishNow();
    await rest;
    expect(seen()).toEqual(whole);
  });
});
