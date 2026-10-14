import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoiceStore } from '@/teacher/voice/voiceStore';
import { keyPoint, markdownToScript } from './fromMarkdown';
import type { Measure } from './layout';
import { parseTeachScript } from './teachscript';

/**
 * Audit BRD-01 / BRD-02: the teacher says what is being written, and a pause never loses the end
 * of a sentence. The voice is a fake that "speaks" for a moment and records what it was given.
 */
interface FakeSpeakOptions {
  rate?: number;
  role?: string;
  emphasis?: readonly string[];
  session?: unknown;
}
const voice = vi.hoisted(() => ({
  calls: [] as string[],
  rates: [] as number[],
  opts: [] as FakeSpeakOptions[],
  current: null as (() => void) | null,
}));
vi.mock('@/teacher/voice/speak', () => ({
  newVoiceSession: () => ({ skipped: null }),
  speak: async (text: string, opts?: FakeSpeakOptions) => {
    const { useVoiceStore: store } = await import('@/teacher/voice/voiceStore');
    voice.calls.push(text);
    voice.rates.push(opts?.rate ?? 1);
    voice.opts.push(opts ?? {});
    store.getState().setSpeaking(true);
    await new Promise<void>((resolve) => {
      const done = () => {
        if (voice.current === done) voice.current = null;
        store.getState().setSpeaking(false);
        resolve();
      };
      voice.current = done;
      setTimeout(done, 120);
    });
  },
  stopSpeaking: () => {
    voice.current?.();
  },
  toSpokenText: (text: string) => text,
}));

const { playLesson, pauseLesson, resumeLesson, stopLesson, lessonMetrics, voiceCue } =
  await import('./lesson');
const { useBoardStore } = await import('./boardStore');

const measure: Measure = {
  text: (s, px) => s.length * px * 0.5,
  math: (tex, px) => ({ w: tex.length * px * 0.6, h: px * 1.3 }),
};

const until = async (ok: () => boolean, ms = 5000) => {
  const end = Date.now() + ms;
  while (!ok()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 10));
  }
};

describe('what the teacher says while writing (BRD-01)', () => {
  const spoken = (script: string) => parseTeachScript(script).sentences.map((s) => s.spoken);

  it('reads the written words where their tag stands', () => {
    expect(
      spoken(
        'Hôm nay mình xét bài <write id="t1" zone="title" role="heading">Định luật II Newton</write> nhé.',
      ),
    ).toEqual(['Hôm nay mình xét bài Định luật II Newton nhé.']);
  });

  it('does not repeat the label the sentence already says ("Đề cho" + "Cho: …")', () => {
    expect(
      spoken(
        'Đề cho <write id="g1" zone="side_notes" role="note">Cho: m = 2 kg, F = 10 N</write>.',
      ),
    ).toEqual(['Đề cho m = 2 kg, F = 10 N.']);
  });

  it('puts formulas in $…$ for the speech reader and drops dangling punctuation', () => {
    const [a, b] = spoken(
      'Thay số vào, <write id="r1" zone="steps" role="result" math="true">a = \\frac{10}{2}</write><box target="r1"/>. Từ khóa là <write id="k1" zone="steps" role="keyword">gia tốc</write>.',
    );
    expect(a).toBe('Thay số vào, $a = \\frac{10}{2}$.');
    expect(b).toBe('Từ khóa là gia tốc.');
    for (const s of [a, b]) expect(s).not.toMatch(/[,:;]\.| \.$/);
  });

  it('never repeats what the sentence already says', () => {
    expect(
      spoken(
        'Gia tốc tỉ lệ thuận với lực <write id="k2" zone="steps">gia tốc tỉ lệ thuận với lực</write>.',
      ),
    ).toEqual(['Gia tốc tỉ lệ thuận với lực.']);
    // A markdown lesson already says its whole line: nothing is added.
    const md = markdownToScript('1. Bước 1: nhân đôi ADN ở pha S.');
    expect(md.sentences.map((s) => s.spoken)).toEqual(['1. Bước 1: nhân đôi ADN ở pha S.']);
  });

  it('writes only the key point of a long words-only step, and keeps steps with numbers whole', () => {
    const long =
      '2. Bước 2: nhiễm sắc thể kép co xoắn cực đại, xếp thành một hàng trên mặt phẳng xích đạo của thoi phân bào';
    const md = markdownToScript(long);
    const written = md.sentences[0]?.actions.find((a) => a.action.kind === 'write');
    const text = written?.action.kind === 'write' ? written.action.text : '';
    expect(text.length).toBeLessThanOrEqual(80);
    expect(text.endsWith('…')).toBe(true);
    expect(md.sentences[0]?.spoken).toContain('mặt phẳng xích đạo');
    const withNumbers = markdownToScript(
      '3. Bước 3: ta có 2n = 46 nên sau nguyên phân mỗi tế bào con có 46 nhiễm sắc thể đơn',
    );
    const w2 = withNumbers.sentences[0]?.actions.find((a) => a.action.kind === 'write');
    expect(w2?.action.kind === 'write' ? w2.action.text : '').toContain('46 nhiễm sắc thể đơn');
  });

  it('never cuts a key point inside a $…$ formula', () => {
    const line =
      'Theo định luật hai Newton thì gia tốc của vật được tính bằng $a = \\frac{F}{m}$ với F là hợp lực tác dụng lên vật';
    const point = keyPoint(line);
    expect(point.endsWith('…')).toBe(true);
    expect(point.split('$').length % 2).toBe(1);
    expect(point).toContain('$a = \\frac{F}{m}$');
  });

  it('says a written result whose number the sentence does not say', () => {
    const [s] = spoken(
      'Thay m bằng 2 kg và a bằng 3 ta được lực F <write id="r1" zone="steps" role="result">F = m a = 2 · 3 = 6 N</write>.',
    );
    expect(s).toContain('6 N');
  });
});

describe('subtitles', () => {
  it('turn LaTeX into readable text (no "rightarrow", "^2" or "\\ ")', async () => {
    const { subtitleText } = await import('./lesson');
    expect(subtitleText('Thay số vào, $a = \\frac{10}{2} = 5\\ \\text{m/s}^2$.')).toBe(
      'Thay số vào, a = 10/2 = 5 m/s².',
    );
    expect(subtitleText('Ví dụ: $2H_2 + O_2 \\rightarrow 2H_2O$.')).toBe('Ví dụ: 2H₂ + O₂ → 2H₂O.');
  });

  it('raise or lower only what LaTeX raises or lowers', async () => {
    const { subtitleText } = await import('./lesson');
    expect(subtitleText('$a^2+b^2=c^2$')).toBe('a²+b²=c²');
    expect(subtitleText('$v^2-v_0^2=2as$')).toBe('v²-v₀²=2as');
    expect(subtitleText('$e^{-kt}$')).toBe('e^(-kt)');
    expect(subtitleText('$x^{2n}$')).toBe('x^(2n)');
    expect(subtitleText('$10^{-3}$ và $Fe^{3+}$')).toBe('10⁻³ và Fe³⁺');
    expect(subtitleText('$x_{2n}$ và $x_{12}$')).toBe('x_(2n) và x₁₂');
    expect(subtitleText('$V_{max}$')).toBe('V_max');
  });
});

describe('pause and resume (BRD-02)', () => {
  beforeEach(() => {
    voice.calls.length = 0;
    voice.rates.length = 0;
    useVoiceStore.setState({ enabled: true, speaking: false });
    useBoardStore.getState().set({ speed: 1.5 });
  });
  afterEach(() => {
    useVoiceStore.setState({ enabled: false });
    useBoardStore.getState().set({ speed: 1 });
  });

  it('reads the cut sentence again once after "Tiếp tục", then goes on', async () => {
    const script =
      'Câu một <write id="a1" zone="steps">một</write>. Câu hai cần nghe hết <write id="b1" zone="steps">hai</write>. Câu ba kết thúc.';
    const done = playLesson({ id: 'p1', content: script, question: '' }, measure);
    await until(() => voice.calls.some((c) => c.startsWith('Câu hai')));
    pauseLesson();
    expect(useBoardStore.getState().status).toBe('paused');
    await new Promise((r) => setTimeout(r, 200));
    const whilePaused = voice.calls.length;
    resumeLesson();
    await done;
    expect(voice.calls.slice(0, whilePaused).filter((c) => c.startsWith('Câu hai'))).toHaveLength(
      1,
    );
    expect(voice.calls.filter((c) => c.startsWith('Câu hai'))).toHaveLength(2);
    expect(voice.calls.filter((c) => c.startsWith('Câu một'))).toHaveLength(1);
    expect(voice.calls.at(-1)).toBe('Câu ba kết thúc.');
    // The board's speed sets the voice's pace (BRD-03).
    expect(new Set(voice.rates)).toEqual(new Set([1.5]));
    // Timing kept for diagnostics: every sentence measured, the first word heard.
    const m = lessonMetrics();
    expect(m?.sentences).toHaveLength(3);
    expect(m?.firstSpeechMs).not.toBeNull();
  });

  it('stops a lesson paused mid-sentence without an unhandled rejection', async () => {
    const rejections: unknown[] = [];
    const onRejection = (reason: unknown) => {
      rejections.push(reason);
    };
    process.on('unhandledRejection', onRejection);
    try {
      const script =
        'Câu đang viết <write id="w1" zone="steps">một dòng chữ khá dài để cây bút viết lâu hơn giọng đọc</write>. Câu sau.';
      const done = playLesson({ id: 'p2', content: script, question: '' }, measure);
      // Paused while the voice speaks and the pen writes, then stopped (a new question, unmount).
      await until(
        () => useVoiceStore.getState().speaking && (useBoardStore.getState().progress.w1 ?? 0) > 0,
      );
      pauseLesson();
      await new Promise((r) => setTimeout(r, 50));
      stopLesson();
      await done;
      await new Promise((r) => setTimeout(r, 50));
      expect(rejections).toEqual([]);
    } finally {
      process.off('unhandledRejection', onRejection);
    }
  });
});

describe('the voice knows each sentence’s role and key terms (natural teacher voice)', () => {
  const sentences = (script: string) => parseTeachScript(script).sentences;

  it('takes the role from what the sentence writes, and the key terms from keywords and marks', () => {
    const [heading, step, keyword, result, note, plain] = sentences(
      [
        'Hôm nay ta học <write id="h1" zone="title" role="heading">Định luật II Newton</write>.',
        'Đầu tiên ta viết <write id="s1" zone="steps">các lực tác dụng</write>.',
        'Từ khóa là <write id="k1" zone="steps" role="keyword">gia tốc</write><underline target="k1"/>.',
        'Vậy <write id="r1" zone="steps" role="result" math="true">F = 6\\ N</write>.',
        'Ghi nhớ <write id="n1" zone="side_notes" role="note">đơn vị niu-tơn</write>.',
        'Em đã hiểu chưa?',
      ].join(' '),
    );
    expect(heading && voiceCue(heading)).toEqual({ role: 'heading', emphasis: [] });
    expect(step && voiceCue(step)).toEqual({ role: 'step', emphasis: [] });
    expect(keyword && voiceCue(keyword)).toEqual({ role: 'step', emphasis: ['gia tốc'] });
    expect(result && voiceCue(result)).toEqual({ role: 'result', emphasis: [] });
    expect(note && voiceCue(note)).toEqual({ role: 'note', emphasis: [] });
    // No board role: the voice guesses from the words (here, a check question).
    expect(plain && voiceCue(plain)).toEqual({ emphasis: [] });
    const md = markdownToScript('Ta gọi đại lượng này là **gia tốc** của vật.');
    const [line] = md.sentences;
    expect(line && voiceCue(line).emphasis).toEqual(['gia tốc']);
  });

  describe('in a lesson', () => {
    beforeEach(() => {
      voice.calls.length = 0;
      voice.opts.length = 0;
      useVoiceStore.setState({ enabled: true, speaking: false });
      useBoardStore.getState().set({ speed: 2 });
    });
    afterEach(() => {
      stopLesson();
      useVoiceStore.setState({ enabled: false });
      useBoardStore.getState().set({ speed: 1 });
    });

    it('one voice call per sentence, in order, with its role, in one session per lesson', async () => {
      const script =
        'Hôm nay ta học <write id="h1" zone="title" role="heading">lực ma sát</write>. Từ khóa là <write id="k1" zone="steps" role="keyword">ma sát nghỉ</write>. Vậy <write id="r1" zone="steps" role="result">F = 2 N</write>.';
      await playLesson({ id: 'cue1', content: script, question: '' }, measure);
      expect(voice.calls).toEqual(sentences(script).map((s) => s.spoken));
      expect(voice.opts.map((o) => [o.role, o.emphasis])).toEqual([
        ['heading', []],
        ['step', ['ma sát nghỉ']],
        ['result', []],
      ]);
      const [first] = voice.opts;
      expect(voice.opts.every((o) => o.session === first?.session)).toBe(true);
      // "Giảng lại": a new lesson gets a new session (the chosen voice is tried again).
      await playLesson({ id: 'cue1', content: script, question: '' }, measure);
      expect(voice.opts.at(-1)?.session).not.toBe(first?.session);
    });
  });
});
