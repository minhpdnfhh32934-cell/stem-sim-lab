import { act, render } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoiceStore } from '@/teacher/voice/voiceStore';
import type { LessonInput } from './lesson';

/**
 * The whiteboard as the teacher page uses it: the page re-renders whenever the voice starts or
 * stops (the face follows `speaking`) and hands the board a new lesson object each time. A new
 * answer must still be taught to its last sentence, and a page closed while the board waits for
 * its fonts must never start the voice. The voice is a fake that speaks for `voice.ms`.
 */
const voice = vi.hoisted(() => ({ ms: 400, said: [] as string[] }));
vi.mock('@/teacher/voice/speak', () => ({
  newVoiceSession: () => ({ skipped: null }),
  speak: async (text: string) => {
    const { useVoiceStore: store } = await import('@/teacher/voice/voiceStore');
    voice.said.push(text);
    store.getState().setSpeaking(true);
    await new Promise<void>((resolve) => setTimeout(resolve, voice.ms));
    store.getState().setSpeaking(false);
  },
  stopSpeaking: () => undefined,
  toSpokenText: (text: string) => text,
}));

/** The board's fonts: ready at once unless a test holds them. */
const fonts = vi.hoisted(() => ({ ready: Promise.resolve() }));
vi.mock('./measure', () => ({
  prepareMeasure: () => fonts.ready,
  browserMeasure: {
    text: (s: string, px: number) => s.length * px * 0.5,
    math: (tex: string, px: number) => ({ w: tex.length * px * 0.6, h: px * 1.3 }),
  },
  renderMath: () => '',
}));

const { Whiteboard } = await import('./Whiteboard');
const { useBoardStore } = await import('./boardStore');
const { stopLesson } = await import('./lesson');

const SCRIPT =
  'Câu một <write id="a1" zone="steps">alpha</write>. Câu hai <write id="b1" zone="steps">beta</write>. Câu ba <write id="c1" zone="steps">gamma</write>.';
const SAID = ['Câu một alpha.', 'Câu hai beta.', 'Câu ba gamma.'];

/** Like TeacherScreen: re-renders on `speaking` and builds a new lesson object every render. */
function Page({
  id = 'answer-1',
  content = SCRIPT,
  reviewed = false,
}: {
  id?: string;
  content?: string;
  reviewed?: boolean;
}) {
  useVoiceStore((s) => s.speaking);
  const lesson: LessonInput = { id, content, question: '', ...(reviewed ? { reviewed } : {}) };
  return <Whiteboard lesson={lesson} />;
}

async function advance(ms: number) {
  for (let t = 0; t < ms; t += 50) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
  }
}

async function untilDone(limitMs = 60_000) {
  for (let t = 0; t < limitMs && useBoardStore.getState().status !== 'done'; t += 50)
    await advance(50);
}

describe('whiteboard: a new answer with the voice on', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    voice.said.length = 0;
    fonts.ready = Promise.resolve();
    useVoiceStore.setState({ enabled: true, speaking: false });
    useBoardStore.getState().set({ status: 'idle', lessonId: null, lessonContent: '', speed: 1 });
  });
  afterEach(() => {
    stopLesson();
    useVoiceStore.setState({ enabled: false, speaking: false });
    vi.useRealTimers();
  });

  it('teaches every sentence although the page re-renders while the teacher speaks', async () => {
    render(<Page />);
    await untilDone();
    expect(voice.said).toEqual(SAID);
    const board = useBoardStore.getState();
    expect(board.status).toBe('done');
    for (const e of board.layout.elements)
      expect(board.progress[e.id]).toBe(e.kind === 'text' ? e.length : 1);
  });

  it('starts the lesson once in React StrictMode (development)', async () => {
    render(
      <StrictMode>
        <Page id="answer-strict" />
      </StrictMode>,
    );
    await untilDone();
    expect(voice.said).toEqual(SAID);
  });

  it('a page closed while the board waits for its fonts never starts the voice', async () => {
    let release: () => void = () => undefined;
    fonts.ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    const view = render(<Page id="answer-closed" />);
    expect(useBoardStore.getState().status).toBe('preparing');
    view.unmount();
    release();
    await advance(5000);
    expect(voice.said).toEqual([]);
    expect(useBoardStore.getState().status).not.toBe('playing');
    // Shown again later, the same answer is taught from its start.
    fonts.ready = Promise.resolve();
    render(<Page id="answer-closed" />);
    await untilDone();
    expect(voice.said).toEqual(SAID);
  });

  it("teaches only the lesson: hidden reasoning, the reviewer's notes and echoed labels are neither said nor written", async () => {
    const content =
      '<think>tính nháp 7 kg</think>Nhận xét về bản nháp: đúng hướng.\n\nBản đã sửa:\n**GHI CHÚ:**\n# Rơi tự do\n1. Vật chỉ chịu trọng lực.\n2. Vậy s = 20 m.<think>kiểm tra lại';
    const view = render(<Page id="answer-clean" content={content} reviewed />);
    await untilDone();
    const banned = /nháp|7 kg|Nhận xét|Bản đã sửa|GHI CHÚ|kiểm tra lại|think/u;
    expect(voice.said.length).toBeGreaterThan(0);
    expect(voice.said.filter((s) => banned.test(s))).toEqual([]);
    const elements = useBoardStore.getState().layout.elements;
    const sources = elements.flatMap((e) => (e.kind === 'text' ? [e.source] : []));
    expect(sources[0]).toBe('Rơi tự do');
    expect(sources.join(' ')).toContain('Vậy s = 20 m.');
    expect(sources.filter((s) => banned.test(s))).toEqual([]);
    const shown = [...view.container.querySelectorAll('.board__el')].map((e) => e.textContent);
    expect(shown.length).toBe(elements.length);
    expect(shown.filter((s) => banned.test(s))).toEqual([]);
  });

  it('a TeachScript lesson with reasoning between sentences says each sentence once, without it', async () => {
    const content =
      'Câu một <write id="a1" zone="steps">alpha</write>. <think>nháp riêng</think>Câu hai <write id="b1" zone="steps">beta</write>. Câu ba <write id="c1" zone="steps">gamma</write>.';
    render(<Page id="answer-script-think" content={content} />);
    await untilDone();
    expect(voice.said).toEqual(SAID);
  });

  it('a page closed while "Viết tiếp" waits for the fonts never starts the voice either', async () => {
    const view = render(<Page id="answer-more" />);
    await untilDone();
    expect(voice.said).toEqual(SAID);
    let release: () => void = () => undefined;
    fonts.ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    const more = `${SCRIPT} Câu bốn <write id="d1" zone="steps">delta</write>.`;
    view.rerender(<Page id="answer-more" content={more} />);
    view.unmount();
    release();
    await advance(5000);
    expect(voice.said).toEqual(SAID);
  });
});
