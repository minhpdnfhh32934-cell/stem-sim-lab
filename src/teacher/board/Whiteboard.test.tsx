import { act, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoiceStore } from '@/teacher/voice/voiceStore';
import { useTeacherStore } from '@/teacher/teacherStore';
import { useChatStore } from '@/teacher/chat/chatStore';
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
const { stopLesson, playLesson } = await import('./lesson');
const { emptyLayout, place } = await import('./layout');

const SCRIPT =
  'Câu một <write id="a1" zone="steps">alpha</write>. Câu hai <write id="b1" zone="steps">beta</write>. Câu ba <write id="c1" zone="steps">gamma</write>.';
const SAID = ['Câu một alpha.', 'Câu hai beta.', 'Câu ba gamma.'];

/** Like TeacherScreen: re-renders on `speaking` and builds a new lesson object every render. */
function Page({
  id = 'answer-1',
  content = SCRIPT,
  reviewed = false,
  question = '',
}: {
  id?: string;
  content?: string;
  reviewed?: boolean;
  question?: string;
}) {
  useVoiceStore((s) => s.speaking);
  const lesson: LessonInput = { id, content, question, ...(reviewed ? { reviewed } : {}) };
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

  it('a Think lesson in one paragraph with a remark in front is taught whole, without the remark', async () => {
    const content =
      'Bản nháp đã đúng. Hôm nay mình xét bài <write id="t1" zone="title" role="heading">Rơi tự do</write>. Ta có <write id="s1" zone="steps">h = 20 m</write>, nên <write id="r1" zone="steps" role="result">v = 20 m/s</write>.';
    render(<Page id="answer-one-paragraph" content={content} reviewed />);
    await untilDone();
    expect(voice.said.join(' ')).not.toMatch(/nháp/u);
    expect(voice.said.join(' ')).toContain('Rơi tự do');
    const sources = useBoardStore
      .getState()
      .layout.elements.flatMap((e) => (e.kind === 'text' ? [e.source] : []));
    expect(sources).toEqual(['Rơi tự do', 'h = 20 m', 'v = 20 m/s']);
  });

  it("a Think answer to a question about the learner's own draft keeps the feedback", async () => {
    const content =
      'Bản nháp đúng hướng nhưng thiếu đơn vị.\n\n# Rơi tự do\n1. Vật chỉ chịu trọng lực.';
    render(
      <Page id="answer-own-draft" content={content} reviewed question="Xem giúp em bản nháp này" />,
    );
    await untilDone();
    expect(voice.said.join(' ')).toContain('Bản nháp đúng hướng');
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

/**
 * Item 5: the teacher's pen belongs to the face it writes on and to the lesson under way. The
 * page is open (`useTeacherStore.open`), as on the real teacher screen.
 */
const TWO_FACES =
  'Mở đầu <write id="a1" zone="steps">alpha beta</write>. Phần hai <newboard title="Phần 2"/> rồi <write id="b1" zone="steps">delta epsilon zeta eta theta iota kappa lambda</write>. Cuối <write id="c1" zone="steps">omega</write>.';
const NEXT =
  'Bài mới <write id="x1" zone="steps">xin chào các em</write>. Tiếp <write id="y1" zone="steps">yêu cầu</write>.';
const NEXT_SAID = ['Bài mới xin chào các em.', 'Tiếp yêu cầu.'];

const tab = (n: number) => screen.getByRole('tab', { name: new RegExp(`^Bảng ${String(n)}`) });
const penNode = (root: HTMLElement) => root.querySelector<HTMLElement>('.board__pen');
const writingOnFace2 = () =>
  useBoardStore.getState().teacherFace === 1 && (useBoardStore.getState().progress.b1 ?? 0) > 3;

async function advanceUntil(ok: () => boolean, limitMs = 60_000) {
  for (let t = 0; t < limitMs && !ok(); t += 50) await advance(50);
  if (!ok()) throw new Error('condition not reached');
}

const measure = {
  text: (s: string, px: number) => s.length * px * 0.5,
  math: (tex: string, px: number) => ({ w: tex.length * px * 0.6, h: px * 1.3 }),
};

describe('whiteboard: faces, layouts and the pen (item 5)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    voice.said.length = 0;
    fonts.ready = Promise.resolve();
    useVoiceStore.setState({ enabled: true, speaking: false });
    useBoardStore.getState().set({
      status: 'idle',
      lessonId: null,
      lessonContent: '',
      speed: 1,
      face: 0,
      teacherFace: 0,
      follow: true,
      penMode: false,
      strokes: [],
    });
    useTeacherStore.setState({ open: true, layout: 'board' });
  });
  afterEach(() => {
    // Closing the page stops whatever is left (also a lesson paused by an unmount).
    useTeacherStore.setState({ open: false, layout: 'talk' });
    stopLesson();
    useChatStore.setState({ answering: false });
    useVoiceStore.setState({ enabled: false, speaking: false });
    vi.useRealTimers();
  });

  it('S1/S3: another face hides the pen and pauses; back on the teacher’s face all is as it was', async () => {
    const view = render(<Page id="faces-1" content={TWO_FACES} />);
    await advanceUntil(() => writingOnFace2() && penNode(view.container) !== null);
    expect(tab(2)).toHaveAttribute('aria-selected', 'true');
    // Where the teacher writes is marked on its tab.
    expect(tab(2)).toHaveAccessibleName(/thầy đang viết ở mặt bảng này/);
    const pen = penNode(view.container);
    const at = { left: pen?.style.left, top: pen?.style.top };
    act(() => {
      useBoardStore.getState().addStroke({
        face: 0,
        points: [
          [10, 10],
          [20, 20],
        ],
      });
      useBoardStore.getState().addStroke({
        face: 1,
        points: [
          [30, 30],
          [40, 40],
        ],
      });
    });
    const progress = { ...useBoardStore.getState().progress };
    const said = [...voice.said];

    act(() => {
      fireEvent.click(tab(1));
    });
    expect(tab(1)).toHaveAttribute('aria-selected', 'true');
    expect(penNode(view.container)).toBeNull();
    expect(screen.getByRole('button', { name: 'Tiếp tục' })).toBeInTheDocument();
    await advance(1500);
    expect(tab(1)).toHaveAttribute('aria-selected', 'true');
    expect(penNode(view.container)).toBeNull();
    const board = useBoardStore.getState();
    expect(board.progress).toEqual(progress);
    const a1 = board.layout.elements.find((e) => e.id === 'a1');
    expect(board.progress.a1).toBe(a1?.kind === 'text' ? a1.length : -1);
    expect(view.container.querySelectorAll('.board__student polyline')).toHaveLength(1);

    act(() => {
      fireEvent.click(tab(2));
    });
    expect(useBoardStore.getState().status).toBe('paused');
    expect(useBoardStore.getState().progress).toEqual(progress);
    const back = penNode(view.container);
    expect({ left: back?.style.left, top: back?.style.top }).toEqual(at);
    expect(useBoardStore.getState().strokes).toHaveLength(2);
    expect(view.container.querySelectorAll('.board__student polyline')).toHaveLength(1);
    expect(voice.said).toEqual(said);

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    });
    await untilDone();
    expect(useBoardStore.getState().face).toBe(1);
    expect(penNode(view.container)).toBeNull();
    expect(screen.getByRole('button', { name: 'Giảng lại' })).toBeInTheDocument();
  });

  it('S4: "Tiếp tục" while looking at another face brings the view back to the teacher', async () => {
    const view = render(<Page id="faces-resume" content={TWO_FACES} />);
    await advanceUntil(writingOnFace2);
    act(() => {
      fireEvent.click(tab(1));
    });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    });
    expect(tab(2)).toHaveAttribute('aria-selected', 'true');
    expect(penNode(view.container)).not.toBeNull();
    await untilDone();
    expect(useBoardStore.getState().status).toBe('done');
  });

  it('S6: a new answer stops the old lesson at once, even while the learner browses', async () => {
    const view = render(<Page id="faces-old" content={TWO_FACES} />);
    await advanceUntil(writingOnFace2);
    act(() => {
      fireEvent.click(tab(1));
    });
    const oldRun = useBoardStore.getState().run;
    let release: () => void = () => undefined;
    fonts.ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    view.rerender(<Page id="faces-new" content={NEXT} />);
    expect(useBoardStore.getState().status).toBe('preparing');
    expect(useBoardStore.getState().pen).toBeNull();
    expect(penNode(view.container)).toBeNull();
    const progress = { ...useBoardStore.getState().progress };
    await advance(20_000);
    expect(useBoardStore.getState().progress).toEqual(progress);
    const said = voice.said.length;

    // Every board update once the new lesson has started.
    const pens: number[] = [];
    let oldIds = false;
    const watch = useBoardStore.subscribe((s) => {
      if (s.run <= oldRun) return;
      if (s.pen) pens.push(s.pen.run);
      if (s.layout.elements.some((e) => ['a1', 'b1', 'c1', 'board_title'].includes(e.id)))
        oldIds = true;
    });
    await act(async () => {
      release();
      await Promise.resolve();
    });
    await advance(50);
    const board = useBoardStore.getState();
    expect(board.status).toBe('playing');
    expect(board.face).toBe(0);
    expect(board.follow).toBe(true);
    expect(board.run).not.toBe(oldRun);
    expect(board.run).toBeGreaterThan(0);
    const run = board.run;
    await untilDone();
    watch();
    expect(oldIds).toBe(false);
    expect(new Set(pens)).toEqual(new Set([run]));
    expect(voice.said.slice(said)).toEqual(NEXT_SAID);
  });

  it('S8: the talk layout pauses the lesson; coming back shows it as it was with "Tiếp tục"', async () => {
    const view = render(<Page id="faces-talk" content={TWO_FACES} />);
    await advanceUntil(writingOnFace2);
    // "Trò chuyện": TeacherScreen unmounts the board, the page stays open.
    act(() => {
      useTeacherStore.setState({ layout: 'talk' });
    });
    view.unmount();
    expect(useBoardStore.getState().status).toBe('paused');
    const progress = { ...useBoardStore.getState().progress };
    await advance(5000);
    const said = [...voice.said];
    expect(vi.getTimerCount()).toBe(0);
    expect(useBoardStore.getState().progress).toEqual(progress);

    act(() => {
      useTeacherStore.setState({ layout: 'board' });
    });
    const again = render(<Page id="faces-talk" content={TWO_FACES} />);
    await advance(1000);
    expect(voice.said).toEqual(said);
    expect(useBoardStore.getState().progress).toEqual(progress);
    expect(penNode(again.container)).not.toBeNull();
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    });
    await untilDone();
    expect(useBoardStore.getState().status).toBe('done');
    const b1 = useBoardStore.getState().layout.elements.find((e) => e.id === 'b1');
    expect(useBoardStore.getState().progress.b1).toBe(b1?.kind === 'text' ? b1.length : -1);
  });

  it('S8: leaving the page stops the lesson; it shows "Giảng lại" when the board comes back', async () => {
    const view = render(<Page id="faces-left" content={TWO_FACES} />);
    await advanceUntil(writingOnFace2);
    act(() => {
      useTeacherStore.setState({ open: false });
    });
    view.unmount();
    expect(useBoardStore.getState().status).toBe('done');
    expect(useBoardStore.getState().pen).toBeNull();
    await advance(2000);
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      useTeacherStore.setState({ open: true });
    });
    const again = render(<Page id="faces-left" content={TWO_FACES} />);
    expect(screen.getByRole('button', { name: 'Giảng lại' })).toBeInTheDocument();
    expect(penNode(again.container)).toBeNull();
  });

  it('S5: shown and hidden many times while the fonts load, an answer is taught once', async () => {
    let release: () => void = () => undefined;
    fonts.ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    for (let i = 0; i < 10; i++) render(<Page id="faces-flicker" />).unmount();
    render(<Page id="faces-flicker" />);
    release();
    await untilDone();
    expect(voice.said).toEqual(SAID);
  });

  it('S5: of two answers in quick succession only the second is taught', async () => {
    let release: () => void = () => undefined;
    fonts.ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    const view = render(<Page id="faces-first" />);
    view.rerender(<Page id="faces-second" content={NEXT} />);
    release();
    await untilDone();
    expect(voice.said).toEqual(NEXT_SAID);
  });

  it('S10: clearing the chat while the teacher writes empties the board at once', async () => {
    const view = render(<Page id="faces-clear" content={TWO_FACES} />);
    await advanceUntil(writingOnFace2);
    view.rerender(<Whiteboard lesson={null} />);
    const board = useBoardStore.getState();
    expect(board.status).toBe('idle');
    expect(board.lessonId).toBeNull();
    expect(board.layout.elements).toEqual([]);
    expect(penNode(view.container)).toBeNull();
    expect(screen.getByText(/Hỏi AI Teacher một câu/)).toBeInTheDocument();
    let writes = 0;
    const watch = useBoardStore.subscribe(() => {
      writes += 1;
    });
    const said = voice.said.length;
    await advance(20_000);
    watch();
    expect(writes).toBe(0);
    expect(voice.said).toHaveLength(said);
  });

  it('the teacher stops to listen when the chat starts answering, and reads the cut sentence again', async () => {
    voice.ms = 1500;
    render(<Page id="faces-ask" />);
    await advanceUntil(
      () => useVoiceStore.getState().speaking && useBoardStore.getState().status === 'playing',
    );
    act(() => {
      useChatStore.setState({ answering: true });
    });
    expect(useBoardStore.getState().status).toBe('paused');
    act(() => {
      useChatStore.setState({ answering: false });
    });
    expect(useBoardStore.getState().status).toBe('paused');
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    });
    await untilDone();
    expect(voice.said).toEqual([SAID[0], SAID[0], SAID[1], SAID[2]]);
  });

  it('S9: once the board is gone it no longer listens to the chat, its observers or its scroll', async () => {
    const observers: { observe: number; disconnect: number; callback: () => void }[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        entry: { observe: number; disconnect: number; callback: () => void };
        constructor(callback: () => void) {
          this.entry = { observe: 0, disconnect: 0, callback };
          observers.push(this.entry);
        }
        observe() {
          this.entry.observe += 1;
        }
        disconnect() {
          this.entry.disconnect += 1;
        }
        unobserve() {
          return undefined;
        }
      },
    );
    const adds = vi.spyOn(HTMLElement.prototype, 'addEventListener');
    const removes = vi.spyOn(HTMLElement.prototype, 'removeEventListener');
    // The board's own viewport only (React also listens on its root).
    const scrolls = (spy: typeof adds) =>
      spy.mock.calls.filter(
        ([type], i) =>
          type === 'scroll' &&
          (spy.mock.contexts[i] as Element | undefined)?.classList.contains('board__viewport'),
      ).length;
    try {
      const view = render(<Page id="faces-gone" content={TWO_FACES} />);
      await advanceUntil(writingOnFace2);
      // A resize rescales the sheet; the pen keeps its board position on the teacher's face.
      const viewport = view.container.querySelector<HTMLElement>('.board__viewport');
      const scaler = view.container.querySelector<HTMLElement>('.board__scaler');
      const width = scaler?.style.width;
      if (viewport)
        Object.defineProperty(viewport, 'clientWidth', { value: 902, configurable: true });
      act(() => {
        for (const o of observers) o.callback();
      });
      expect(scaler?.style.width).not.toBe(width);
      const pen = useBoardStore.getState().pen;
      expect(pen?.face).toBe(useBoardStore.getState().face);
      expect(penNode(view.container)?.style.left).toBe(`${String(pen?.x)}px`);
      expect(penNode(view.container)?.style.top).toBe(`${String((pen?.y ?? 0) - 34)}px`);

      act(() => {
        useTeacherStore.setState({ open: false });
      });
      view.unmount();
      expect(observers.length).toBeGreaterThan(0);
      for (const o of observers) expect(o.disconnect).toBe(o.observe);
      expect(scrolls(adds)).toBeGreaterThan(0);
      expect(scrolls(removes)).toBe(scrolls(adds));
      // A lesson started without the board is not paused by the chat any more.
      useTeacherStore.setState({ open: true });
      const done = playLesson({ id: 'faces-api', content: SCRIPT, question: '' }, measure);
      useChatStore.setState({ answering: true });
      expect(useBoardStore.getState().status).toBe('playing');
      stopLesson();
      await advance(1000);
      await done;
    } finally {
      adds.mockRestore();
      removes.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});

describe('whiteboard: the learner’s pen ("Bút của em")', () => {
  // jsdom has no pointer capture.
  const hadCapture = 'setPointerCapture' in Element.prototype;
  beforeAll(() => {
    if (!hadCapture)
      Object.defineProperty(Element.prototype, 'setPointerCapture', {
        value: () => undefined,
        configurable: true,
        writable: true,
      });
  });
  afterAll(() => {
    if (!hadCapture) Reflect.deleteProperty(Element.prototype, 'setPointerCapture');
  });
  beforeEach(() => {
    useBoardStore.getState().set({
      status: 'idle',
      lessonId: null,
      lessonContent: '',
      layout: emptyLayout(),
      progress: {},
      face: 0,
      teacherFace: 0,
      follow: true,
      focus: null,
      penMode: true,
      strokes: [],
    });
  });
  afterEach(() => {
    useBoardStore.getState().set({ penMode: false, strokes: [], status: 'idle' });
  });

  const student = (root: HTMLElement) => {
    const node = root.querySelector('.board__student');
    if (!node) throw new Error('no pen area');
    return node;
  };

  it('a stroke stays on the face where it began when the face changes mid-stroke', () => {
    const layout = emptyLayout();
    place(layout, { kind: 'newboard' }, measure);
    useBoardStore.getState().set({ layout });
    const view = render(<Whiteboard lesson={null} />);
    const area = student(view.container);
    fireEvent.pointerDown(area, { pointerId: 1, clientX: 10, clientY: 10, buttons: 1 });
    fireEvent.pointerMove(area, { pointerId: 1, clientX: 20, clientY: 20, buttons: 1 });
    // The teacher's view moves to face 2 while the learner is still drawing.
    act(() => {
      useBoardStore.getState().set({ face: 1 });
    });
    fireEvent.pointerMove(area, { pointerId: 1, clientX: 30, clientY: 30, buttons: 1 });
    fireEvent.pointerUp(area, { pointerId: 1 });
    const strokes = useBoardStore.getState().strokes;
    expect(strokes).toHaveLength(1);
    expect(strokes[0]?.face).toBe(0);
    expect(strokes[0]?.points).toHaveLength(2);
    // Nothing of it is drawn on face 2.
    expect(view.container.querySelectorAll('.board__student polyline')).toHaveLength(0);
  });

  it('a cancelled pointer ends the stroke, and moves without a pressed button draw nothing', () => {
    const view = render(<Whiteboard lesson={null} />);
    const area = student(view.container);
    fireEvent.pointerDown(area, { pointerId: 1, clientX: 10, clientY: 10, buttons: 1 });
    fireEvent.pointerMove(area, { pointerId: 1, clientX: 20, clientY: 20, buttons: 0 });
    fireEvent.pointerMove(area, { pointerId: 1, clientX: 30, clientY: 30, buttons: 1 });
    fireEvent.pointerCancel(area, { pointerId: 1 });
    expect(useBoardStore.getState().strokes.map((s) => s.points.length)).toEqual([2]);
    // After the cancel, moving does not continue (or start) a stroke.
    fireEvent.pointerMove(area, { pointerId: 1, clientX: 40, clientY: 40, buttons: 1 });
    fireEvent.pointerUp(area, { pointerId: 1 });
    expect(useBoardStore.getState().strokes.map((s) => s.points.length)).toEqual([2]);
    expect(view.container.querySelectorAll('.board__student polyline')).toHaveLength(1);
  });

  it('the camera does not move under the learner’s pen, and follows again after the stroke', () => {
    const layout = emptyLayout();
    const { element } = place(
      layout,
      {
        kind: 'write',
        id: 'far',
        zone: 'steps',
        role: 'body',
        math: false,
        text: 'xa',
        speed: 'normal',
      },
      measure,
    );
    if (!element) throw new Error('not placed');
    element.y = 3000;
    const face0 = layout.faces[0];
    if (face0) face0.height = 3200;
    useBoardStore.getState().set({ layout, status: 'playing', follow: true });
    const view = render(<Whiteboard lesson={null} />);
    const viewport = view.container.querySelector<HTMLElement>('.board__viewport');
    if (!viewport) throw new Error('no viewport');
    const tops: number[] = [];
    Object.defineProperty(viewport, 'clientHeight', { value: 400, configurable: true });
    Object.defineProperty(viewport, 'scrollTop', {
      configurable: true,
      get: () => tops.at(-1) ?? 0,
      set: (v: number) => tops.push(v),
    });
    const area = student(view.container);
    fireEvent.pointerDown(area, { pointerId: 1, clientX: 10, clientY: 10, buttons: 1 });
    act(() => {
      useBoardStore.getState().set({ focus: 'far' });
    });
    expect(tops).toEqual([]);
    fireEvent.pointerMove(area, { pointerId: 1, clientX: 20, clientY: 20, buttons: 1 });
    fireEvent.pointerUp(area, { pointerId: 1 });
    expect(tops.length).toBeGreaterThan(0);
  });
});
