import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoiceStore } from '@/teacher/voice/voiceStore';
import type { Measure } from './layout';

/**
 * Audit G5: the order of voice, subtitle and pen on the board, on fake time. The voice is a fake
 * that speaks for `voice.ms` and writes everything into one event log with the board's changes.
 */
const voice = vi.hoisted(() => ({
  ms: 1000,
  log: [] as { at: number; event: string }[],
  rates: [] as number[],
  sessions: [] as unknown[],
  current: null as (() => void) | null,
}));
vi.mock('@/teacher/voice/speak', () => ({
  speak: (text: string, opts?: { rate?: number; session?: unknown }) => {
    voice.log.push({ at: Date.now(), event: `speak:${text}` });
    voice.rates.push(opts?.rate ?? 1);
    voice.sessions.push(opts?.session);
    return import('@/teacher/voice/voiceStore').then(({ useVoiceStore: store }) => {
      store.getState().setSpeaking(true);
      return new Promise<void>((resolve) => {
        const done = () => {
          clearTimeout(timer);
          if (voice.current === done) voice.current = null;
          store.getState().setSpeaking(false);
          voice.log.push({ at: Date.now(), event: `end:${text}` });
          resolve();
        };
        const timer = setTimeout(done, voice.ms);
        voice.current = done;
      });
    });
  },
  stopSpeaking: () => {
    voice.log.push({ at: Date.now(), event: 'stop-voice' });
    voice.current?.();
  },
  toSpokenText: (text: string) => text,
}));

const lesson = await import('./lesson');
const { useBoardStore } = await import('./boardStore');

const measure: Measure = {
  text: (s, px) => s.length * px * 0.5,
  math: (tex, px) => ({ w: tex.length * px * 0.6, h: px * 1.3 }),
};

const SCRIPT =
  'Câu một <write id="a1" zone="steps">alpha</write>. Câu hai <write id="b1" zone="steps">beta</write>. Câu ba <write id="c1" zone="steps">gamma</write>.';
const SAID = ['Câu một alpha.', 'Câu hai beta.', 'Câu ba gamma.'];
const input = { id: 'lesson-1', content: SCRIPT, question: '' };

const log = (event: string) => voice.log.push({ at: Date.now(), event });
const events = () => voice.log.map((e) => e.event);
const first = (event: string) => events().indexOf(event);
const count = (event: string) => events().filter((e) => e === event).length;

let unsubscribe: () => void = () => undefined;

/** Board changes into the same log: subtitle, an element placed, the pen starting and ending. */
function watchBoard() {
  unsubscribe = useBoardStore.subscribe((state, prev) => {
    if (state.subtitle !== prev.subtitle && state.subtitle) log(`subtitle:${state.subtitle}`);
    if (state.status !== prev.status) log(`status:${state.status}`);
    for (const [id, value] of Object.entries(state.progress)) {
      const before = prev.progress[id];
      const element = state.layout.elements.find((e) => e.id === id);
      const length = element?.kind === 'text' ? element.length : 1;
      if (before === undefined) log(`place:${id}`);
      if (value > 0 && !((before ?? 0) > 0)) log(`pen:${id}`);
      if (value >= length && !((before ?? 0) >= length)) log(`written:${id}`);
    }
  });
}

/** Moves fake time on until `ok()` (or fails after `limitMs` of fake time). */
async function until(ok: () => boolean, limitMs = 60_000) {
  for (let t = 0; t <= limitMs && !ok(); t += 20) await vi.advanceTimersByTimeAsync(20);
  if (!ok()) throw new Error('condition not reached');
}

async function finish(done: Promise<void>) {
  let over = false;
  void done.then(() => {
    over = true;
  });
  await until(() => over, 120_000);
}

describe('board timing: voice, subtitle and pen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    voice.ms = 1000;
    voice.log.length = 0;
    voice.rates.length = 0;
    voice.sessions.length = 0;
    voice.current = null;
    useVoiceStore.setState({ enabled: true, speaking: false });
    useBoardStore.getState().set({ speed: 1, status: 'idle', lessonId: null, lessonContent: '' });
    watchBoard();
  });
  afterEach(() => {
    lesson.stopLesson();
    unsubscribe();
    useVoiceStore.setState({ enabled: false, speaking: false });
    useBoardStore.getState().set({ speed: 1 });
    vi.useRealTimers();
  });

  it('shows the subtitle before the voice says the sentence', async () => {
    await finish(lesson.playLesson(input, measure));
    for (const said of SAID) {
      expect(first(`subtitle:${said}`)).toBeGreaterThanOrEqual(0);
      expect(first(`subtitle:${said}`)).toBeLessThan(first(`speak:${said}`));
    }
  });

  it('starts writing a sentence only after the voice finished the one before', async () => {
    voice.ms = 5000; // the voice is slower than the pen
    await finish(lesson.playLesson(input, measure));
    expect(first('written:a1')).toBeLessThan(first(`end:${SAID[0]}`));
    expect(first(`end:${SAID[0]}`)).toBeLessThan(first('place:b1'));
    expect(first(`end:${SAID[1]}`)).toBeLessThan(first('place:c1'));
    // …and the next sentence is not spoken before the pen finished the one before.
    voice.ms = 10;
    voice.log.length = 0;
    await finish(lesson.playLesson(input, measure));
    expect(first('written:a1')).toBeLessThan(first(`speak:${SAID[1]}`));
    expect(first('written:b1')).toBeLessThan(first(`speak:${SAID[2]}`));
  });

  it('says nothing while paused and reads the cut sentence again exactly once', async () => {
    voice.ms = 5000;
    const done = lesson.playLesson(input, measure);
    await until(() => first('written:a1') >= 0);
    lesson.pauseLesson();
    expect(useBoardStore.getState().status).toBe('paused');
    const atPause = voice.log.length;
    await vi.advanceTimersByTimeAsync(20_000);
    const whilePaused = events().slice(atPause);
    expect(whilePaused.filter((e) => e.startsWith('speak:') || e.startsWith('pen:'))).toEqual([]);
    lesson.resumeLesson();
    await finish(done);
    expect(count(`speak:${SAID[0]}`)).toBe(2);
    expect(count(`speak:${SAID[1]}`)).toBe(1);
    expect(count(`speak:${SAID[2]}`)).toBe(1);
    expect(events().filter((e) => e.startsWith('speak:'))).toEqual([
      `speak:${SAID[0]}`,
      `speak:${SAID[0]}`,
      `speak:${SAID[1]}`,
      `speak:${SAID[2]}`,
    ]);
  });

  it('pauses the pen when the voice is off', async () => {
    useVoiceStore.setState({ enabled: false });
    const done = lesson.playLesson(input, measure);
    await until(() => first('pen:b1') >= 0);
    lesson.pauseLesson();
    expect(useBoardStore.getState().status).toBe('paused');
    const progress = { ...useBoardStore.getState().progress };
    await vi.advanceTimersByTimeAsync(20_000);
    expect(useBoardStore.getState().progress).toEqual(progress);
    lesson.resumeLesson();
    await finish(done);
    expect(count('written:c1')).toBe(1);
    expect(events().some((e) => e.startsWith('speak:'))).toBe(false);
    expect(useBoardStore.getState().status).toBe('done');
  });

  it('stopping while the board is still preparing never starts that lesson later', () => {
    // The whiteboard marks the new answer and waits for its fonts (Whiteboard.tsx).
    useBoardStore.getState().set({ lessonId: 'next', lessonContent: SCRIPT, status: 'preparing' });
    lesson.stopLesson();
    expect(useBoardStore.getState().status).toBe('idle');
    // The pending start compares this with its answer and gives up.
    expect(useBoardStore.getState().lessonContent).not.toBe(SCRIPT);
    expect(events().some((e) => e.startsWith('speak:'))).toBe(false);
  });

  it('"Giảng lại" clears the board and starts again from the first sentence', async () => {
    await finish(lesson.playLesson(input, measure));
    const firstLesson = voice.sessions[0];
    expect(new Set(voice.sessions).size).toBe(1);
    voice.log.length = 0;
    voice.sessions.length = 0;
    lesson.replayLesson();
    const board = useBoardStore.getState();
    expect(board.layout.elements).toEqual([]);
    expect(board.progress).toEqual({});
    expect(board.subtitle).toBe('');
    await until(() => useBoardStore.getState().status === 'done' && count(`end:${SAID[2]}`) === 1);
    expect(events().filter((e) => e.startsWith('speak:'))).toEqual(SAID.map((s) => `speak:${s}`));
    expect(first('place:a1')).toBeLessThan(first('place:b1'));
    // A replay is a new lesson: the cloud voice is tried again.
    expect(new Set(voice.sessions).size).toBe(1);
    expect(voice.sessions[0]).not.toBe(firstLesson);
  });

  it('"Viết nhanh" stops the voice, writes the rest at once and reads nothing again', async () => {
    voice.ms = 5000;
    const done = lesson.playLesson(input, measure);
    await until(() => first(`speak:${SAID[0]}`) >= 0);
    lesson.finishNow();
    await finish(done);
    expect(first('stop-voice')).toBeGreaterThanOrEqual(0);
    expect(events().filter((e) => e.startsWith('speak:'))).toEqual([`speak:${SAID[0]}`]);
    expect(useBoardStore.getState().status).toBe('done');
    for (const e of useBoardStore.getState().layout.elements)
      expect(useBoardStore.getState().progress[e.id]).toBe(e.kind === 'text' ? e.length : 1);
  });

  it('"Viết nhanh" during a pause does not read the cut sentence again', async () => {
    voice.ms = 5000;
    const done = lesson.playLesson(input, measure);
    await until(() => first('written:a1') >= 0);
    lesson.pauseLesson();
    lesson.finishNow();
    await finish(done);
    expect(count(`speak:${SAID[0]}`)).toBe(1);
    expect(events().filter((e) => e.startsWith('speak:'))).toHaveLength(1);
  });

  it('the speed sets both the voice pace and the pen', async () => {
    voice.ms = 10;
    const penTime = () => {
      const start = voice.log.find((e) => e.event === 'pen:a1')?.at ?? 0;
      const end = voice.log.find((e) => e.event === 'written:a1')?.at ?? 0;
      return end - start;
    };
    await finish(lesson.playLesson(input, measure));
    const normal = penTime();
    expect(new Set(voice.rates)).toEqual(new Set([1]));
    voice.log.length = 0;
    voice.rates.length = 0;
    useBoardStore.getState().set({ speed: 2 });
    await finish(lesson.playLesson(input, measure));
    expect(new Set(voice.rates)).toEqual(new Set([2]));
    expect(normal).toBeGreaterThan(0);
    expect(penTime()).toBeGreaterThan(normal * 0.4);
    expect(penTime()).toBeLessThan(normal * 0.6);
  });
});
