import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoiceStore } from '@/teacher/voice/voiceStore';
import type { Measure } from './layout';

/**
 * Item 5 (pen-switch): the teacher's pen and the lesson run belong to one face and one run. The
 * learner may open another face while the teacher writes, the chat may be cleared, the screen
 * closed or a new answer arrive: the pen never moves on a face it does not write on, and a run
 * that is over never writes again. Fake time; the voice is a fake that speaks for `voice.ms`
 * and logs into the same event log as the board's changes.
 */
const voice = vi.hoisted(() => ({
  ms: 1000,
  log: [] as { at: number; event: string }[],
  current: null as (() => void) | null,
}));
vi.mock('@/teacher/voice/speak', () => ({
  newVoiceSession: () => ({ skipped: null }),
  speak: (text: string) => {
    voice.log.push({ at: Date.now(), event: `speak:${text}` });
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
const { useTeacherStore } = await import('@/teacher/teacherStore');
const { useChatStore } = await import('@/teacher/chat/chatStore');

const measure: Measure = {
  text: (s, px) => s.length * px * 0.5,
  math: (tex, px) => ({ w: tex.length * px * 0.6, h: px * 1.3 }),
};

/** Face 0: a1. Then a new face ("Phần 2", its title element) with b1 and c1, and a mark on a1. */
const TWO_FACES =
  'Mở đầu <write id="a1" zone="steps">alpha beta</write>. Phần hai <newboard title="Phần 2"/> rồi <write id="b1" zone="steps">delta epsilon zeta eta theta iota</write>. Cuối <write id="c1" zone="steps">omega</write>.';
const SAID = [
  'Mở đầu alpha beta.',
  'Phần hai rồi delta epsilon zeta eta theta iota.',
  'Cuối omega.',
];
const A = { id: 'lesson-a', content: TWO_FACES, question: '' };
const B = {
  id: 'lesson-b',
  content:
    'Bài mới <write id="x1" zone="steps">xin chào các em</write>. Tiếp <write id="y1" zone="steps">yêu cầu</write>.',
  question: '',
};
const A_IDS = ['a1', 'b1', 'c1', 'board_title'];

const board = () => useBoardStore.getState();
const log = (event: string) => voice.log.push({ at: Date.now(), event });
const events = () => voice.log.map((e) => e.event);
const count = (event: string, from = 0) =>
  events()
    .slice(from)
    .filter((e) => e === event).length;
const said = (from = 0) =>
  events()
    .slice(from)
    .filter((e) => e.startsWith('speak:'));

let unsubscribe: () => void = () => undefined;

function watchBoard() {
  unsubscribe = useBoardStore.subscribe((state, prev) => {
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

/** The teacher is writing b1, on the second face. */
const writingOnFace2 = () => board().teacherFace === 1 && (board().progress.b1 ?? 0) > 2;

/** What may not change while nobody is teaching. */
function snapshot() {
  const s = board();
  return {
    progress: { ...s.progress },
    pen: s.pen,
    focus: s.focus,
    face: s.face,
    teacherFace: s.teacherFace,
    elements: s.layout.elements.length,
    marks: s.marks.map((m) => `${m.key}:${String(m.shown)}`),
    subtitle: s.subtitle,
  };
}

function textOf(id: string) {
  const e = board().layout.elements.find((x) => x.id === id);
  if (!e || e.kind !== 'text') throw new Error(`no text element ${id}`);
  return e;
}

describe('the pen and the lesson belong to one face and one run', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    voice.ms = 1000;
    voice.log.length = 0;
    voice.current = null;
    useVoiceStore.setState({ enabled: true, speaking: false });
    board().set({
      speed: 1,
      status: 'idle',
      lessonId: null,
      lessonContent: '',
      face: 0,
      teacherFace: 0,
      follow: true,
    });
    watchBoard();
  });
  afterEach(() => {
    lesson.stopLesson();
    unsubscribe();
    useVoiceStore.setState({ enabled: false, speaking: false });
    useTeacherStore.setState({ open: false, layout: 'talk' });
    vi.useRealTimers();
  });

  it('S1: opening another face while the teacher writes pauses the lesson; the pen stays on its face', async () => {
    const done = lesson.playLesson(A, measure);
    await until(writingOnFace2);
    expect(board().face).toBe(1);
    const at = voice.log.length;
    lesson.showFace(0);
    const s = board();
    expect(s.status).toBe('paused');
    expect(s.face).toBe(0);
    expect(s.follow).toBe(false);
    expect(s.teacherFace).toBe(1);
    expect(s.pen?.face).toBe(1);
    expect(s.pen?.run).toBe(s.run);
    expect(count('stop-voice', at)).toBe(1);
    lesson.stopLesson();
    await finish(done);
  });

  it('S2: after the switch nothing moves on either face, and the view stays where the learner looks', async () => {
    const done = lesson.playLesson(A, measure);
    await until(writingOnFace2);
    lesson.showFace(0);
    const before = snapshot();
    const at = voice.log.length;
    await vi.advanceTimersByTimeAsync(20_000);
    expect(snapshot()).toEqual(before);
    expect(
      events()
        .slice(at)
        .filter((e) => e.startsWith('speak:') || e.startsWith('pen:') || e.startsWith('place:')),
    ).toEqual([]);
    lesson.stopLesson();
    await finish(done);
  });

  it('S2: a switch while a correction strikes out its line, or while a new face opens, does not pull the view back', async () => {
    // During the strike's two waits: the correction is not written, the view stays on face 0.
    const withCorrection = {
      id: 'lesson-fix',
      content: `${TWO_FACES} Sửa lại <correct target="b1">delta sửa</correct>.`,
      question: '',
    };
    let done = lesson.playLesson(withCorrection, measure);
    await until(() => board().marks.some((m) => m.kind === 'strike'));
    lesson.showFace(0);
    let before = snapshot();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(snapshot()).toEqual(before);
    expect(board().face).toBe(0);
    expect(board().layout.elements.some((e) => e.id === 'b1_fix')).toBe(false);
    lesson.stopLesson();
    await finish(done);

    // During the wait after <newboard>: the new face's title is not written while paused.
    done = lesson.playLesson(A, measure);
    await until(() => board().teacherFace === 1);
    expect(board().progress.board_title).toBe(0);
    lesson.showFace(0);
    before = snapshot();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(snapshot()).toEqual(before);
    expect(board().face).toBe(0);
    lesson.stopLesson();
    await finish(done);
  });

  it("S4: 'Tiếp tục' from another face brings the view back and finishes every element once", async () => {
    voice.ms = 5000; // the cut sentence is still being spoken when the learner looks away
    const progress: number[] = [];
    const watch = useBoardStore.subscribe((s, p) => {
      const v = s.progress.b1;
      if (v !== undefined && v !== p.progress.b1) progress.push(v);
    });
    const done = lesson.playLesson(A, measure);
    await until(writingOnFace2);
    lesson.showFace(0);
    await vi.advanceTimersByTimeAsync(3000);
    lesson.resumeLesson();
    const s = board();
    expect(s.status).toBe('playing');
    expect(s.face).toBe(s.teacherFace);
    expect(s.face).toBe(1);
    expect(s.follow).toBe(true);
    await finish(done);
    watch();
    expect(board().status).toBe('done');
    expect(board().pen).toBeNull();
    for (const id of A_IDS) expect(count(`place:${id}`)).toBe(1);
    for (const e of board().layout.elements)
      expect(board().progress[e.id]).toBe(e.kind === 'text' ? e.length : 1);
    // The pen never went back: every value of b1 is larger than the one before.
    for (let i = 1; i < progress.length; i++)
      expect(progress[i]).toBeGreaterThan(progress[i - 1] ?? 0);
    // The cut sentence is read again once; the others once each, in order.
    expect(said()).toEqual([
      `speak:${SAID[0]}`,
      `speak:${SAID[1]}`,
      `speak:${SAID[1]}`,
      `speak:${SAID[2]}`,
    ]);
  });

  it('S5: flipping faces quickly pauses once, says nothing and keeps the run', async () => {
    // The run's waits listen on its abort signal: every listener put on is taken off again.
    const adds = vi.spyOn(AbortSignal.prototype, 'addEventListener');
    const removes = vi.spyOn(AbortSignal.prototype, 'removeEventListener');
    const aborts = (spy: typeof adds) => spy.mock.calls.filter(([type]) => type === 'abort').length;
    try {
      const done = lesson.playLesson(A, measure);
      await until(writingOnFace2);
      const run = board().run;
      const at = voice.log.length;
      for (let i = 0; i < 30; i++) {
        lesson.showFace(i % 2);
        await vi.advanceTimersByTimeAsync(10);
      }
      expect(board().status).toBe('paused');
      expect(board().run).toBe(run);
      expect(count('stop-voice', at)).toBe(1);
      expect(said(at)).toEqual([]);
      const ids = board().layout.elements.map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
      // Once the step under way is over, thirty flips leave no timer behind (0.7 test gap).
      await vi.advanceTimersByTimeAsync(5000);
      expect(vi.getTimerCount()).toBe(0);
      lesson.resumeLesson();
      await finish(done);
      expect(count('status:done')).toBe(1);
      for (const id of A_IDS) expect(count(`place:${id}`)).toBe(1);
      expect(vi.getTimerCount()).toBe(0);
      expect(aborts(adds)).toBeGreaterThan(0);
      expect(aborts(removes)).toBe(aborts(adds));
    } finally {
      adds.mockRestore();
      removes.mockRestore();
    }
  });

  it('S7: a pause holds the pen where it is; "Tiếp tục" goes on from that letter', async () => {
    const done = lesson.playLesson(A, measure);
    await until(writingOnFace2);
    lesson.pauseLesson();
    const at = board().progress.b1 ?? 0;
    const pen = board().pen;
    await vi.advanceTimersByTimeAsync(20_000);
    expect(board().progress.b1).toBe(at);
    expect(board().pen).toEqual(pen);
    // Once the step under way is over, nothing waits on a timer while paused.
    expect(vi.getTimerCount()).toBe(0);
    lesson.resumeLesson();
    await finish(done);
    expect(board().progress.b1).toBe(textOf('b1').length);
    expect(count('written:b1')).toBe(1);
  });

  it.each([
    ['voice off', false],
    ['voice on', true],
  ])(
    'S7: a pause after the last line is written holds the end of the lesson too (%s, 0.7 fix)',
    async (_name, on) => {
      useVoiceStore.setState({ enabled: on });
      voice.ms = 10;
      const done = lesson.playLesson(A, measure);
      // The last line is written and said: only the lesson's closing wait is left.
      const c1Written = () => {
        const c1 = board().layout.elements.find((e) => e.id === 'c1');
        return c1?.kind === 'text' && (board().progress.c1 ?? 0) >= c1.length;
      };
      await until(() => c1Written() && !useVoiceStore.getState().speaking);
      expect(board().status).toBe('playing');
      lesson.showFace(0);
      lesson.pauseForAsk();
      const before = snapshot();
      expect(board().status).toBe('paused');
      await vi.advanceTimersByTimeAsync(20_000);
      expect(board().status).toBe('paused');
      expect(board().pausedForAsk).toBe(true);
      expect(snapshot()).toEqual(before);
      expect(count('status:done')).toBe(0);
      lesson.resumeLesson();
      await finish(done);
      expect(count('status:done')).toBe(1);
      expect(board().pausedForAsk).toBe(false);
      expect(board().pen).toBeNull();
    },
  );

  it('S7/S9: a stop ends every write and every timer at once', async () => {
    const adds = vi.spyOn(AbortSignal.prototype, 'addEventListener');
    const removes = vi.spyOn(AbortSignal.prototype, 'removeEventListener');
    const aborts = (spy: typeof adds) => spy.mock.calls.filter(([type]) => type === 'abort').length;
    try {
      // A whole lesson leaves no listener on its signal.
      await finish(lesson.playLesson(A, measure));
      expect(aborts(adds)).toBeGreaterThan(0);
      expect(aborts(removes)).toBe(aborts(adds));
      // Stopped while the pen moves: nothing more, no timer, no pen.
      const done = lesson.playLesson(A, measure);
      await until(writingOnFace2);
      lesson.stopLesson();
      let writes = 0;
      const watch = useBoardStore.subscribe(() => {
        writes += 1;
      });
      await vi.advanceTimersByTimeAsync(20_000);
      watch();
      expect(writes).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
      expect(board().pen).toBeNull();
      expect(board().run).toBe(0);
      expect(board().status).toBe('done');
      await finish(done);
      expect(aborts(removes)).toBe(aborts(adds));
    } finally {
      adds.mockRestore();
      removes.mockRestore();
    }
  });

  it('S7: a run stopped in the same tick as a new one starts never writes on the new lesson', async () => {
    for (const end of [lesson.stopLesson, lesson.finishNow]) {
      const a = lesson.playLesson(A, measure);
      await until(writingOnFace2);
      const states: ReturnType<typeof board>[] = [];
      end();
      const b = lesson.playLesson(B, measure);
      const run = board().run;
      const watch = useBoardStore.subscribe((s) => states.push(s));
      await finish(b);
      await finish(a);
      watch();
      expect(states.length).toBeGreaterThan(0);
      for (const s of states) {
        expect(s.layout.elements.map((e) => e.id).filter((id) => A_IDS.includes(id))).toEqual([]);
        if (s.pen) expect(s.pen.run).toBe(run);
      }
      expect(board().status).toBe('done');
    }
  });

  it('S7: "Viết nhanh" while the learner looks at another face writes everything, in view', async () => {
    const done = lesson.playLesson(A, measure);
    await until(writingOnFace2);
    lesson.showFace(0);
    lesson.finishNow();
    expect(board().face).toBe(1);
    expect(board().follow).toBe(true);
    await finish(done);
    for (const e of board().layout.elements)
      expect(board().progress[e.id]).toBe(e.kind === 'text' ? e.length : 1);
    expect(board().face).toBe(board().teacherFace);
  });

  it('S10: a mark on an older face takes the teacher (and a following view) there and back', async () => {
    voice.ms = 10;
    const marked = {
      id: 'lesson-mark',
      content: TWO_FACES.replace('Cuối', 'Nhìn lại <underline target="a1"/> rồi cuối'),
      question: '',
    };
    const faces: number[] = [];
    const pens: number[] = [];
    const watch = useBoardStore.subscribe((s, p) => {
      if (s.face !== p.face) faces.push(s.face);
      if (s.pen && s.pen.face !== p.pen?.face) pens.push(s.pen.face);
    });
    await finish(lesson.playLesson(marked, measure));
    watch();
    // Face 0 (a1), face 1 (b1), back to face 0 for the mark, face 1 for c1.
    expect(faces).toEqual([1, 0, 1]);
    expect(pens).toEqual([0, 1, 0, 1]);
    const underline = board().marks.find((m) => m.kind === 'underline');
    expect(underline?.face).toBe(0);
    expect(underline?.shown).toBe(true);
    expect(underline?.box.y).toBe(textOf('a1').y);
  });

  it('S10: a view that does not follow the teacher is never moved by the lesson', async () => {
    voice.ms = 10;
    const done = lesson.playLesson(A, measure);
    await until(() => (board().progress.a1 ?? 0) > 0);
    // The learner reads face 0 while the teacher goes on (no browsing pause: same face).
    board().set({ follow: false });
    const faces: number[] = [];
    const watch = useBoardStore.subscribe((s, p) => {
      if (s.face !== p.face) faces.push(s.face);
    });
    await finish(done);
    watch();
    expect(faces).toEqual([]);
    expect(board().teacherFace).toBe(1);
  });

  it('"Viết tiếp": the marks of the new part land on its own elements, never on the old ones with the same id', async () => {
    voice.ms = 10;
    // A markdown answer is read whole again (item 1): the new result is the answer's second
    // one, "r2", and its box goes around it.
    const first = { id: 'lesson-more', content: 'Vậy a = 1 m.', question: '' };
    await finish(lesson.playLesson(first, measure));
    const more = { ...first, content: `${first.content}\n\nVậy b = 2 m.` };
    await finish(lesson.continueLesson(more, measure));
    expect(board().layout.elements.map((e) => e.id)).toEqual(['r1', 'r2']);
    let boxes = board().marks.filter((m) => m.kind === 'box');
    expect(boxes).toHaveLength(2);
    expect(boxes[0]?.box.y).toBe(textOf('r1').y);
    expect(boxes[1]?.box.y).toBe(textOf('r2').y);

    // The AI reuses an id in the new part: it is placed as "r1_2", and its box goes there.
    const script = {
      id: 'lesson-more-script',
      content: 'Ta có <write id="r1" zone="steps" role="result">a = 1 m</write>.<box target="r1"/>',
      question: '',
    };
    await finish(lesson.playLesson(script, measure));
    await finish(
      lesson.continueLesson(
        {
          ...script,
          content: `${script.content} Tiếp <write id="r1" zone="steps" role="result">b = 2 m</write>.<box target="r1"/>`,
        },
        measure,
      ),
    );
    expect(board().layout.elements.map((e) => e.id)).toEqual(['r1', 'r1_2']);
    boxes = board().marks.filter((m) => m.kind === 'box');
    expect(boxes).toHaveLength(2);
    expect(boxes[0]?.box.y).toBe(textOf('r1').y);
    // Without the run's id map this box went around the first result again.
    expect(boxes[1]?.box.y).toBe(textOf('r1_2').y);
    expect(boxes[1]?.box.y).not.toBe(textOf('r1').y);
  });

  it('closing the teacher screen stops a lesson left paused while the board was hidden', async () => {
    useTeacherStore.setState({ open: true, layout: 'talk' });
    const done = lesson.playLesson(A, measure);
    await until(writingOnFace2);
    lesson.pauseLesson();
    useTeacherStore.setState({ open: false });
    expect(board().status).toBe('done');
    expect(board().pen).toBeNull();
    const at = voice.log.length;
    lesson.resumeLesson(); // nothing left to resume
    await vi.advanceTimersByTimeAsync(20_000);
    expect(said(at)).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
    await finish(done);
  });

  it('clearing the chat ends the lesson and empties the board, also while the board is hidden', async () => {
    useChatStore.setState({ messages: [{ id: 'q', role: 'user', content: 'Hỏi' }] });
    const done = lesson.playLesson(A, measure);
    await until(writingOnFace2);
    useChatStore.setState({ messages: [] });
    const s = board();
    expect(s.status).toBe('idle');
    expect(s.lessonId).toBeNull();
    expect(s.layout.elements).toEqual([]);
    expect(s.pen).toBeNull();
    let writes = 0;
    const watch = useBoardStore.subscribe(() => {
      writes += 1;
    });
    const at = voice.log.length;
    await vi.advanceTimersByTimeAsync(20_000);
    watch();
    expect(writes).toBe(0);
    expect(said(at)).toEqual([]);
    await finish(done);
  });

  it('a start cancelled while preparing never leaves a frozen pen', () => {
    board().set({ status: 'preparing', pen: { run: 7, face: 0, x: 10, y: 10 }, run: 7 });
    lesson.reserveStart();
    lesson.cancelPendingStart();
    lesson.stopLesson();
    expect(board().status).toBe('idle');
    expect(board().pen).toBeNull();
    expect(board().run).toBe(0);
  });
});
