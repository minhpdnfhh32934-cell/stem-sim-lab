import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoiceStore } from '@/teacher/voice/voiceStore';
import { useTeacherStore } from '@/teacher/teacherStore';
import { useChatStore } from '@/teacher/chat/chatStore';
import type { BoardAction } from './teachscript';
import type { LessonInput } from './lesson';
import type { Point } from './selection';

/**
 * "Khoanh để hỏi" on the board (item 2): the learner's loop becomes a selection (never ink), the
 * bar says what the app read there, the lesson pauses through the one pause path and goes on with
 * "Quay lại bài giảng" (the cut sentence read again). Letting the selection go changes nothing on
 * the board and never resumes by itself.
 */
const voice = vi.hoisted(() => ({ ms: 400, said: [] as string[], stops: 0 }));
vi.mock('@/teacher/voice/speak', () => ({
  newVoiceSession: () => ({ skipped: null }),
  speak: async (text: string) => {
    const { useVoiceStore: store } = await import('@/teacher/voice/voiceStore');
    voice.said.push(text);
    store.getState().setSpeaking(true);
    await new Promise<void>((resolve) => setTimeout(resolve, voice.ms));
    store.getState().setSpeaking(false);
  },
  stopSpeaking: () => {
    voice.stops += 1;
  },
  toSpokenText: (text: string) => text,
}));
vi.mock('./measure', () => ({
  prepareMeasure: () => Promise.resolve(),
  browserMeasure: {
    text: (s: string, px: number) => s.length * px * 0.5,
    math: (tex: string, px: number) => ({ w: tex.length * px * 0.6, h: px * 1.3 }),
  },
  renderMath: () => '',
}));
// The picture rule reads the engine: an API here (it never gets a picture).
vi.mock('@/app/ai/engineChoice', () => ({
  analysisEngine: () => Promise.resolve('cloud'),
  useAnalysisEngine: () => 'cloud',
}));

const { Whiteboard } = await import('./Whiteboard');
const { useBoardStore } = await import('./boardStore');
const { stopLesson } = await import('./lesson');
const { emptyLayout, place, planFaces } = await import('./layout');

const measure = {
  text: (s: string, px: number) => s.length * px * 0.5,
  math: (tex: string, px: number) => ({ w: tex.length * px * 0.6, h: px * 1.3 }),
};

const write = (id: string, zone: 'title' | 'steps' | 'side_notes', text: string, math = false) =>
  ({
    kind: 'write',
    id,
    zone,
    role: zone === 'title' ? 'heading' : 'body',
    math,
    text,
    speed: 'normal',
  }) as BoardAction;

const FORMULA = 's = \\frac{1}{2} g t^2';
const LESSON: BoardAction[] = [
  write('t1', 'title', 'Rơi tự do'),
  write('s1', 'steps', 'Viết công thức quãng đường'),
  write('f1', 'steps', FORMULA, true),
];

/** A board already written, as a finished lesson leaves it (the board's lesson is `LESSON_INPUT`). */
const LESSON_INPUT: LessonInput = { id: 'done-lesson', content: 'xong', question: '' };
function writtenBoard() {
  const layout = emptyLayout();
  planFaces(layout, LESSON);
  for (const a of LESSON) place(layout, a, measure);
  const progress: Record<string, number> = {};
  for (const e of layout.elements) progress[e.id] = e.kind === 'text' ? e.length : 1;
  useBoardStore.getState().set({
    layout,
    progress,
    erased: {},
    provenance: {},
    marks: [],
    status: 'done',
    lessonId: LESSON_INPUT.id,
    lessonContent: LESSON_INPUT.content,
    face: 0,
    teacherFace: 0,
    follow: true,
    focus: null,
    pen: null,
    penMode: false,
    askMode: false,
    selection: null,
    pausedForAsk: false,
    strokes: [
      {
        face: 0,
        points: [
          [900, 900],
          [950, 950],
        ],
      },
    ],
    zoom: 1,
  });
  return layout;
}

/** jsdom lays nothing out: a viewport 1202 px wide (scale 1) and the pen area at the origin. */
const observers: (() => void)[] = [];
class FakeResizeObserver {
  constructor(callback: () => void) {
    observers.push(callback);
  }
  observe() {
    return undefined;
  }
  unobserve() {
    return undefined;
  }
  disconnect() {
    return undefined;
  }
}
function sheetAtScale1(root: HTMLElement): SVGSVGElement {
  const node = root.querySelector<HTMLElement>('.board__viewport');
  const area = root.querySelector<SVGSVGElement>('.board__student');
  if (!node || !area) throw new Error('no board');
  Object.defineProperty(node, 'clientWidth', { configurable: true, get: () => 1202 });
  Object.defineProperty(node, 'clientHeight', { configurable: true, get: () => 600 });
  act(() => {
    for (const o of observers) o();
  });
  area.getBoundingClientRect = () => ({ left: 0, top: 0 }) as DOMRect;
  return area;
}

function loop(around: { x: number; y: number; w: number; h: number }, pad = 14): Point[] {
  const cx = around.x + around.w / 2;
  const cy = around.y + around.h / 2;
  return Array.from({ length: 36 }, (_, i) => {
    const a = (2 * Math.PI * i) / 36;
    return [cx + (around.w / 2 + pad) * Math.cos(a), cy + (around.h / 2 + pad) * Math.sin(a)];
  });
}

function draw(area: Element, points: Point[]) {
  const [first, ...rest] = points;
  if (!first) return;
  fireEvent.pointerDown(area, { pointerId: 1, clientX: first[0], clientY: first[1], buttons: 1 });
  for (const [x, y] of rest)
    fireEvent.pointerMove(area, { pointerId: 1, clientX: x, clientY: y, buttons: 1 });
  fireEvent.pointerUp(area, { pointerId: 1 });
}

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
  observers.length = 0;
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  useTeacherStore.setState({ open: true, layout: 'board' });
});
afterEach(() => {
  vi.unstubAllGlobals();
  useTeacherStore.setState({ open: false, layout: 'talk' });
  stopLesson();
  useChatStore.setState({ answering: false });
  useBoardStore
    .getState()
    .set({ askMode: false, penMode: false, selection: null, pausedForAsk: false, strokes: [] });
});

describe('circling part of the board', () => {
  it('a loop around the formula selects it: outlined, read back in the bar, never kept as ink', () => {
    const layout = writtenBoard();
    const view = render(<Whiteboard lesson={LESSON_INPUT} />);
    const area = sheetAtScale1(view.container);
    const tool = screen.getByRole('button', { name: 'Khoanh để hỏi' });
    expect(tool).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(tool);
    expect(tool).toHaveAttribute('aria-pressed', 'true');
    const f1 = layout.elements.find((e) => e.id === 'f1');
    if (!f1) throw new Error('no formula');
    draw(area, loop(f1));
    const selection = useBoardStore.getState().selection;
    expect(selection?.status).toBe('ok');
    expect(selection?.hits.map((h) => h.id)).toEqual(['f1']);
    expect(selection?.hits[0]?.text).toBe(FORMULA);
    expect(view.container.querySelectorAll('.board__hit')).toHaveLength(1);
    expect(view.container.querySelectorAll('.board__lasso')).toHaveLength(1);
    const bar = screen.getByRole('group', { name: 'Chỗ em khoanh trên bảng' });
    expect(bar).toHaveTextContent('Em khoanh:');
    expect(bar).toHaveTextContent('s = 1/2 g t²');
    expect(screen.getByRole('button', { name: 'Hỏi thầy chỗ này' })).toBeEnabled();
    // The loop is not ink: the learner's strokes are as they were.
    expect(useBoardStore.getState().strokes).toHaveLength(1);
  });

  it('"Bỏ chọn" lets it go and changes nothing on the board; "Khoanh lại" circles anew', () => {
    const layout = writtenBoard();
    const view = render(<Whiteboard lesson={LESSON_INPUT} />);
    const area = sheetAtScale1(view.container);
    fireEvent.click(screen.getByRole('button', { name: 'Khoanh để hỏi' }));
    const before = useBoardStore.getState();
    const snapshot = JSON.stringify([
      before.layout,
      before.marks,
      before.progress,
      before.strokes,
      before.status,
    ]);
    const [s1, f1] = ['s1', 'f1'].map((id) => layout.elements.find((e) => e.id === id));
    if (!s1 || !f1) throw new Error('no elements');
    draw(area, loop(s1, 10));
    expect(useBoardStore.getState().selection?.hits.map((h) => h.id)).toEqual(['s1']);
    fireEvent.click(screen.getByRole('button', { name: 'Khoanh lại' }));
    expect(useBoardStore.getState().selection).toBeNull();
    expect(useBoardStore.getState().askMode).toBe(true);
    draw(area, loop(f1));
    expect(useBoardStore.getState().selection?.hits.map((h) => h.id)).toEqual(['f1']);
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ chọn' }));
    const after = useBoardStore.getState();
    expect(after.selection).toBeNull();
    expect(screen.queryByRole('group', { name: 'Chỗ em khoanh trên bảng' })).toBeNull();
    expect(
      JSON.stringify([after.layout, after.marks, after.progress, after.strokes, after.status]),
    ).toBe(snapshot);
  });

  it('a loop on an empty part of the board: the app says so, and nothing is asked', () => {
    writtenBoard();
    const asked = vi.fn();
    window.addEventListener('stemsim:board-ask', asked);
    const view = render(<Whiteboard lesson={LESSON_INPUT} />);
    const area = sheetAtScale1(view.container);
    fireEvent.click(screen.getByRole('button', { name: 'Khoanh để hỏi' }));
    draw(area, loop({ x: 400, y: 1200, w: 200, h: 80 }));
    expect(useBoardStore.getState().selection?.status).toBe('none');
    expect(screen.getByRole('group', { name: 'Chỗ em khoanh trên bảng' })).toHaveTextContent(
      'Mình chưa thấy em khoanh vào chữ hay hình nào trên bảng',
    );
    expect(screen.queryByRole('button', { name: 'Hỏi thầy chỗ này' })).toBeNull();
    expect(asked).not.toHaveBeenCalled();
    window.removeEventListener('stemsim:board-ask', asked);
  });

  it('only handwriting circled, with an AI that cannot read pictures: say so, ask to type', () => {
    writtenBoard();
    const view = render(<Whiteboard lesson={LESSON_INPUT} />);
    const area = sheetAtScale1(view.container);
    fireEvent.click(screen.getByRole('button', { name: 'Khoanh để hỏi' }));
    draw(area, loop({ x: 880, y: 880, w: 90, h: 90 }, 10));
    expect(useBoardStore.getState().selection?.status).toBe('picture');
    expect(screen.getByRole('group', { name: 'Chỗ em khoanh trên bảng' })).toHaveTextContent(
      'AI em đang dùng chưa đọc được hình vẽ hay nét viết tay',
    );
    expect(screen.queryByRole('button', { name: 'Hỏi thầy chỗ này' })).toBeNull();
  });

  it('zoomed in and scrolled, the loop still selects what is under it', () => {
    const layout = writtenBoard();
    const view = render(<Whiteboard lesson={LESSON_INPUT} />);
    const area = sheetAtScale1(view.container);
    fireEvent.click(screen.getByRole('button', { name: 'Phóng to bảng' }));
    const sheet = view.container.querySelector<HTMLElement>('.board__sheet');
    const scale = Number(/scale\(([\d.]+)\)/.exec(sheet?.style.transform ?? '')?.[1]);
    expect(scale).toBeCloseTo(1.25);
    // The sheet is scrolled 300 px left and 200 px up inside the viewport.
    area.getBoundingClientRect = () => ({ left: -300, top: -200 }) as DOMRect;
    fireEvent.click(screen.getByRole('button', { name: 'Khoanh để hỏi' }));
    const f1 = layout.elements.find((e) => e.id === 'f1');
    if (!f1) throw new Error('no formula');
    const onScreen = loop(f1).map(([x, y]) => [x * scale - 300, y * scale - 200] as const);
    draw(area, onScreen);
    expect(useBoardStore.getState().selection?.hits.map((h) => h.id)).toEqual(['f1']);
  });

  it('"Hỏi thầy chỗ này" asks the chat once', () => {
    const layout = writtenBoard();
    const asked = vi.fn();
    window.addEventListener('stemsim:board-ask', asked);
    const view = render(<Whiteboard lesson={LESSON_INPUT} />);
    const area = sheetAtScale1(view.container);
    fireEvent.click(screen.getByRole('button', { name: 'Khoanh để hỏi' }));
    const f1 = layout.elements.find((e) => e.id === 'f1');
    if (!f1) throw new Error('no formula');
    draw(area, loop(f1));
    fireEvent.click(screen.getByRole('button', { name: 'Hỏi thầy chỗ này' }));
    expect(asked).toHaveBeenCalledTimes(1);
    window.removeEventListener('stemsim:board-ask', asked);
  });

  it('a cancelled pointer drops the loop; the pen and the circling tool never draw together', () => {
    writtenBoard();
    const view = render(<Whiteboard lesson={LESSON_INPUT} />);
    const area = sheetAtScale1(view.container);
    const tool = screen.getByRole('button', { name: 'Khoanh để hỏi' });
    const pen = screen.getByRole('button', { name: 'Bút của em' });
    fireEvent.click(pen);
    fireEvent.click(tool);
    expect(useBoardStore.getState()).toMatchObject({ askMode: true, penMode: false });
    fireEvent.pointerDown(area, { pointerId: 1, clientX: 400, clientY: 200, buttons: 1 });
    fireEvent.pointerMove(area, { pointerId: 1, clientX: 500, clientY: 260, buttons: 1 });
    fireEvent.pointerCancel(area, { pointerId: 1 });
    expect(useBoardStore.getState().selection).toBeNull();
    expect(useBoardStore.getState().strokes).toHaveLength(1);
    expect(view.container.querySelectorAll('.board__lasso')).toHaveLength(0);
    fireEvent.click(pen);
    expect(useBoardStore.getState()).toMatchObject({ askMode: false, penMode: true });
  });
});

describe('circling while the teacher teaches', () => {
  const SCRIPT =
    'Câu một <write id="a1" zone="steps">alpha</write>. Câu hai <write id="b1" zone="steps">beta</write>. Câu ba <write id="c1" zone="steps">gamma</write>.';
  const SAID = ['Câu một alpha.', 'Câu hai beta.', 'Câu ba gamma.'];

  async function advance(ms: number) {
    for (let t = 0; t < ms; t += 50) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });
    }
  }
  async function advanceUntil(done: () => boolean, limitMs = 30_000) {
    for (let t = 0; t < limitMs && !done(); t += 50) await advance(50);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    voice.ms = 1500;
    voice.said.length = 0;
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
      askMode: false,
      selection: null,
      pausedForAsk: false,
      strokes: [],
      zoom: 1,
    });
  });
  afterEach(() => {
    useVoiceStore.setState({ enabled: false, speaking: false });
    vi.useRealTimers();
    voice.ms = 400;
  });

  it('starting a loop pauses the lesson; an answer about it leaves the board; going back re-reads the cut sentence', async () => {
    const lesson: LessonInput = { id: 'teaching', content: SCRIPT, question: '' };
    const view = render(<Whiteboard lesson={lesson} />);
    await advanceUntil(
      () => useVoiceStore.getState().speaking && useBoardStore.getState().status === 'playing',
    );
    const area = sheetAtScale1(view.container);
    fireEvent.click(screen.getByRole('button', { name: 'Khoanh để hỏi' }));
    const a1 = useBoardStore.getState().layout.elements.find((e) => e.id === 'a1');
    if (!a1) throw new Error('no element');
    const layoutBefore = JSON.stringify(useBoardStore.getState().layout);
    // The press alone pauses the lesson (the one pause path), before the loop is finished.
    fireEvent.pointerDown(area, {
      pointerId: 1,
      clientX: a1.x - 10,
      clientY: a1.y - 10,
      buttons: 1,
    });
    expect(useBoardStore.getState()).toMatchObject({ status: 'paused', pausedForAsk: true });
    for (const [x, y] of loop(a1, 10))
      fireEvent.pointerMove(area, { pointerId: 1, clientX: x, clientY: y, buttons: 1 });
    fireEvent.pointerUp(area, { pointerId: 1 });
    expect(useBoardStore.getState().selection?.status).toBeDefined();
    expect(screen.getByRole('button', { name: 'Quay lại bài giảng' })).toBeInTheDocument();
    // The chat answers in its own voice meanwhile; the same lesson stays on the board.
    await advance(3000);
    view.rerender(<Whiteboard lesson={{ ...lesson }} />);
    expect(useBoardStore.getState().status).toBe('paused');
    expect(JSON.stringify(useBoardStore.getState().layout)).toBe(layoutBefore);
    // Letting the selection go does not resume.
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ chọn' }));
    expect(useBoardStore.getState().status).toBe('paused');
    const stopsBefore = voice.stops;
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại bài giảng' }));
    // Whatever the chat was reading aloud stops before the lesson speaks again.
    expect(voice.stops).toBeGreaterThan(stopsBefore);
    expect(useBoardStore.getState()).toMatchObject({
      status: 'playing',
      pausedForAsk: false,
      askMode: false,
      selection: null,
    });
    await advanceUntil(() => useBoardStore.getState().status === 'done', 60_000);
    // The sentence the pause cut is said again, then every sentence after it.
    expect(voice.said).toEqual([SAID[0], SAID[0], SAID[1], SAID[2]]);
  });

  it('a lesson already paused is still marked as paused to ask (its button says so)', async () => {
    const lesson: LessonInput = { id: 'teaching-2', content: SCRIPT, question: '' };
    const view = render(<Whiteboard lesson={lesson} />);
    await advanceUntil(() => useBoardStore.getState().status === 'playing');
    fireEvent.click(screen.getByRole('button', { name: 'Tạm dừng' }));
    expect(screen.getByRole('button', { name: 'Tiếp tục' })).toBeInTheDocument();
    const area = sheetAtScale1(view.container);
    fireEvent.click(screen.getByRole('button', { name: 'Khoanh để hỏi' }));
    draw(area, loop({ x: 400, y: 1000, w: 100, h: 60 }));
    expect(useBoardStore.getState().pausedForAsk).toBe(true);
    expect(screen.getByRole('button', { name: 'Quay lại bài giảng' })).toBeInTheDocument();
  });
});
