import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardAction } from './teachscript';

/**
 * Item 3 on screen: the sheet is the board in board units scaled to the viewport (times the
 * learner's zoom). Rules stand only between regions in use; a resize or a zoom changes the scale
 * only (nothing written moves, the same part of the board stays in view, never a jump to the last
 * element); the learner's pen maps the pointer to board units at any scale.
 */
vi.mock('@/teacher/voice/speak', () => ({
  newVoiceSession: () => ({ skipped: null }),
  speak: () => Promise.resolve(),
  stopSpeaking: () => undefined,
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

const { Whiteboard } = await import('./Whiteboard');
const { useBoardStore } = await import('./boardStore');
const { emptyLayout, place, planFaces } = await import('./layout');
const { rescaleScroll } = await import('./minimap');

const measure = {
  text: (s: string, px: number) => s.length * px * 0.5,
  math: (tex: string, px: number) => ({ w: tex.length * px * 0.6, h: px * 1.3 }),
};

const write = (id: string, zone: 'steps' | 'side_notes' | 'title', text: string): BoardAction => ({
  kind: 'write',
  id,
  zone,
  role: zone === 'title' ? 'heading' : 'body',
  math: false,
  text,
  speed: 'normal',
});

/** A planned board, everything already written. */
function board(actions: BoardAction[], patch: Parameters<typeof setBoard>[1] = {}) {
  const layout = emptyLayout();
  planFaces(layout, actions);
  for (const a of actions) place(layout, a, measure);
  setBoard(layout, patch);
  return layout;
}

function setBoard(
  layout: ReturnType<typeof emptyLayout>,
  patch: Partial<ReturnType<typeof useBoardStore.getState>> = {},
) {
  const progress: Record<string, number> = {};
  for (const e of layout.elements) progress[e.id] = e.kind === 'text' ? e.length : 1;
  useBoardStore.getState().set({
    layout,
    progress,
    status: 'done',
    lessonId: null,
    face: 0,
    teacherFace: 0,
    follow: true,
    focus: null,
    pen: null,
    penMode: false,
    strokes: [],
    zoom: 1,
    ...patch,
  });
}

/** ResizeObservers of the page, called by hand (jsdom has none). */
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

interface Viewport {
  node: HTMLElement;
  scrolls: { top: number; left: number; behavior?: string }[];
  resize: (width: number, height?: number) => void;
  scrollBy: (top: number, left?: number) => void;
}

/** The board's viewport with a size, a scroll position and `scrollTo` (jsdom lays nothing out). */
function viewportOf(root: HTMLElement): Viewport {
  const node = root.querySelector<HTMLElement>('.board__viewport');
  const scaler = root.querySelector<HTMLElement>('.board__scaler');
  if (!node || !scaler) throw new Error('no viewport');
  let width = 0;
  let height = 400;
  let top = 0;
  let left = 0;
  const content = (side: 'width' | 'height') => parseFloat(scaler.style[side]) || 0;
  const clamp = (v: number, max: number) => Math.max(0, Math.min(Math.max(0, max), v));
  Object.defineProperties(node, {
    clientWidth: { configurable: true, get: () => width },
    clientHeight: { configurable: true, get: () => height },
    scrollHeight: { configurable: true, get: () => Math.max(height, content('height')) },
    scrollWidth: { configurable: true, get: () => Math.max(width, content('width')) },
    scrollTop: {
      configurable: true,
      get: () => top,
      set: (v: number) => {
        top = clamp(v, content('height') - height);
      },
    },
    scrollLeft: {
      configurable: true,
      get: () => left,
      set: (v: number) => {
        left = clamp(v, content('width') - width);
      },
    },
  });
  const scrolls: Viewport['scrolls'] = [];
  node.scrollTo = ((options: ScrollToOptions) => {
    scrolls.push({
      top: options.top ?? top,
      left: options.left ?? left,
      ...(options.behavior ? { behavior: options.behavior } : {}),
    });
    top = clamp(options.top ?? top, content('height') - height);
    left = clamp(options.left ?? left, content('width') - width);
  }) as typeof node.scrollTo;
  return {
    node,
    scrolls,
    resize(w, h = height) {
      width = w;
      height = h;
      act(() => {
        for (const o of observers) o();
      });
    },
    scrollBy(t, l = left) {
      top = clamp(t, content('height') - height);
      left = clamp(l, content('width') - width);
      act(() => {
        node.dispatchEvent(new Event('scroll'));
      });
    },
  };
}

const scaleOf = (root: HTMLElement) => {
  const sheet = root.querySelector<HTMLElement>('.board__sheet');
  return Number(/scale\(([\d.]+)\)/.exec(sheet?.style.transform ?? '')?.[1]);
};
const positions = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLElement>('[data-id]')].map((e) => ({
    id: e.dataset.id,
    left: e.style.left,
    top: e.style.top,
  }));
const rules = (root: HTMLElement) =>
  [...root.querySelectorAll('.board__rules line')].map((l) => Number(l.getAttribute('x1')));

const STEPS = [
  write('h', 'title', 'Rơi tự do'),
  ...Array.from({ length: 30 }, (_, i) =>
    write(`s${String(i)}`, 'steps', `bước số ${String(i)} của bài giải rơi tự do`),
  ),
];

beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
});
afterEach(() => {
  vi.unstubAllGlobals();
  useBoardStore.getState().set({ zoom: 1, penMode: false, strokes: [], status: 'idle' });
});

describe('rules between regions', () => {
  it('none on an empty board, none across a wide face, one between the side and the steps', () => {
    setBoard(emptyLayout());
    const empty = render(<Whiteboard lesson={null} />);
    expect(rules(empty.container)).toEqual([]);
    empty.unmount();

    board(STEPS.slice(0, 4));
    const wide = render(<Whiteboard lesson={null} />);
    expect(rules(wide.container)).toEqual([]);
    wide.unmount();

    board([write('g', 'side_notes', 'Cho: h = 20 m'), ...STEPS.slice(1, 3)]);
    const two = render(<Whiteboard lesson={null} />);
    expect(rules(two.container)).toEqual([360]);
  });
});

describe('resize and zoom', () => {
  it('a resize changes the scale only: nothing written moves on the board', () => {
    board(STEPS);
    const view = render(<Whiteboard lesson={null} />);
    const vp = viewportOf(view.container);
    vp.resize(727);
    const scaler = view.container.querySelector<HTMLElement>('.board__scaler');
    expect(scaleOf(view.container)).toBeCloseTo(725 / 1200);
    expect(parseFloat(scaler?.style.width ?? '')).toBeCloseTo(725);
    const before = positions(view.container);
    expect(before.length).toBe(STEPS.length);
    vp.resize(1083);
    expect(scaleOf(view.container)).toBeCloseTo(1081 / 1200);
    expect(parseFloat(scaler?.style.width ?? '')).toBeCloseTo(1081);
    expect(positions(view.container)).toEqual(before);
  });

  it('after the lesson, a resize keeps the part the learner looks at (no jump to the last line)', () => {
    board(STEPS, { focus: 's29' });
    const view = render(<Whiteboard lesson={null} />);
    const vp = viewportOf(view.container);
    vp.resize(727);
    const s0 = scaleOf(view.container);
    vp.scrollBy(300);
    const row = (300 + 200) / s0;
    vp.resize(1083, 500);
    const s1 = scaleOf(view.container);
    const last = vp.scrolls.at(-1);
    expect(last?.behavior).toBe('instant');
    expect(last?.top).toBeCloseTo(
      rescaleScroll(300, 400, s0, s1, vp.node.scrollHeight, vp.node.clientHeight),
    );
    // The same board row is still in the middle of the view.
    expect(Math.abs((vp.node.scrollTop + 250) / s1 - row) * s1).toBeLessThan(1);
    // And back.
    vp.resize(727, 400);
    expect(Math.abs((vp.node.scrollTop + 200) / scaleOf(view.container) - row) * s0).toBeLessThan(
      1,
    );
  });

  it('while the teacher writes and the learner follows, the line being written stays in view', () => {
    const layout = board(STEPS, { status: 'playing', focus: 's25' });
    const view = render(<Whiteboard lesson={null} />);
    const vp = viewportOf(view.container);
    vp.resize(727);
    vp.scrollBy(0);
    vp.resize(1083);
    const s1 = scaleOf(view.container);
    const e = layout.elements.find((x) => x.id === 's25');
    if (!e) throw new Error('no element');
    expect(vp.node.scrollTop).toBeLessThanOrEqual(e.y * s1);
    expect(vp.node.scrollTop + 400).toBeGreaterThanOrEqual((e.y + e.h) * s1);
  });

  it('shown again (the board layout comes back), the board opens at its top, or on the teacher’s line', () => {
    // The viewport has its size from the first render (as in a browser).
    const sized = (node: Element, side: 'width' | 'height') => {
      const scaler = node.querySelector<HTMLElement>('.board__scaler');
      return parseFloat(scaler?.style[side] ?? '') || 0;
    };
    const top = { value: 0 };
    const scrolls: number[] = [];
    const props: Record<string, PropertyDescriptor> = {
      clientWidth: { get: () => 1083 },
      clientHeight: { get: () => 400 },
      scrollHeight: {
        get(this: Element) {
          return Math.max(400, sized(this, 'height'));
        },
      },
      scrollWidth: {
        get(this: Element) {
          return sized(this, 'width');
        },
      },
      scrollTop: {
        get: () => top.value,
        set: (v: number) => {
          top.value = v;
        },
      },
    };
    const saved = new Map<string, PropertyDescriptor | undefined>();
    for (const [name, d] of Object.entries(props)) {
      saved.set(name, Object.getOwnPropertyDescriptor(HTMLDivElement.prototype, name));
      Object.defineProperty(HTMLDivElement.prototype, name, { ...d, configurable: true });
    }
    Object.defineProperty(HTMLDivElement.prototype, 'scrollTo', {
      configurable: true,
      value: (o: ScrollToOptions) => {
        scrolls.push(o.top ?? 0);
        top.value = o.top ?? top.value;
      },
    });
    try {
      board(STEPS);
      const done = render(<Whiteboard lesson={null} />);
      expect(scaleOf(done.container)).toBeCloseTo(1081 / 1200);
      expect(top.value).toBe(0);
      expect(scrolls).toEqual([]);
      done.unmount();

      const layout = board(STEPS, { status: 'playing', focus: 's25' });
      const playing = render(<Whiteboard lesson={null} />);
      const s = scaleOf(playing.container);
      const e = layout.elements.find((x) => x.id === 's25');
      if (!e) throw new Error('no element');
      expect(top.value).toBeLessThanOrEqual(e.y * s);
      expect(top.value + 400).toBeGreaterThanOrEqual((e.y + e.h) * s);
    } finally {
      for (const [name, d] of saved) {
        if (d) Object.defineProperty(HTMLDivElement.prototype, name, d);
        else Reflect.deleteProperty(HTMLDivElement.prototype, name);
      }
      Reflect.deleteProperty(HTMLDivElement.prototype, 'scrollTo');
    }
  });

  it('zoom: larger steps, sideways scrolling inside the board, "Vừa khung" back to the width', () => {
    board(STEPS);
    const view = render(<Whiteboard lesson={null} />);
    const vp = viewportOf(view.container);
    vp.resize(727);
    const fit = scaleOf(view.container);
    const zoomOut = screen.getByRole('button', { name: 'Thu nhỏ bảng' });
    const zoomIn = screen.getByRole('button', { name: 'Phóng to bảng' });
    expect(zoomOut).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Vừa khung' })).toBeNull();
    for (const b of [zoomOut, zoomIn]) expect(b).toHaveClass('btn', 'board__icon-btn');
    vp.scrollBy(400);
    const row = (400 + 200) / fit;
    act(() => {
      fireEvent.click(zoomIn);
    });
    expect(useBoardStore.getState().zoom).toBe(1.25);
    expect(scaleOf(view.container)).toBeCloseTo(fit * 1.25);
    const scaler = view.container.querySelector<HTMLElement>('.board__scaler');
    expect(parseFloat(scaler?.style.width ?? '')).toBeCloseTo(1200 * fit * 1.25);
    expect(Math.abs((vp.node.scrollTop + 200) / (fit * 1.25) - row)).toBeLessThan(1);
    for (let i = 0; i < 4; i++)
      act(() => {
        fireEvent.click(zoomIn);
      });
    expect(useBoardStore.getState().zoom).toBe(2);
    expect(zoomIn).toBeDisabled();
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Vừa khung' }));
    });
    expect(useBoardStore.getState().zoom).toBe(1);
    expect(scaleOf(view.container)).toBeCloseTo(fit);
    expect(screen.queryByRole('button', { name: 'Vừa khung' })).toBeNull();
  });
});

describe('the learner’s pen at any scale', () => {
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

  it('maps the pointer to board units; a resize or a zoom never moves a stroke', () => {
    board(STEPS, { penMode: true });
    const view = render(<Whiteboard lesson={null} />);
    const vp = viewportOf(view.container);
    vp.resize(727);
    const area = view.container.querySelector<SVGSVGElement>('.board__student');
    if (!area) throw new Error('no pen area');
    // Where the (scaled, scrolled) pen area is on screen.
    area.getBoundingClientRect = () => ({ left: 100, top: -250 }) as DOMRect;
    const draw = (points: [number, number][]) => {
      const [first, ...rest] = points;
      if (!first) return;
      fireEvent.pointerDown(area, {
        pointerId: 1,
        clientX: first[0],
        clientY: first[1],
        buttons: 1,
      });
      for (const [x, y] of rest)
        fireEvent.pointerMove(area, { pointerId: 1, clientX: x, clientY: y, buttons: 1 });
      fireEvent.pointerUp(area, { pointerId: 1 });
    };
    const s = scaleOf(view.container);
    draw([
      [160, 50],
      [220, 110],
    ]);
    const stroke = useBoardStore.getState().strokes[0];
    expect(stroke?.points[0]?.[0]).toBeCloseTo(60 / s);
    expect(stroke?.points[0]?.[1]).toBeCloseTo(300 / s);
    expect(stroke?.points[1]?.[0]).toBeCloseTo(120 / s);
    const line = () =>
      view.container.querySelector('.board__student polyline')?.getAttribute('points');
    const drawn = line();
    vp.resize(1083);
    expect(line()).toBe(drawn);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Phóng to bảng' }));
    });
    expect(line()).toBe(drawn);
    // Drawn zoomed in, the point is still in board units.
    const zoomed = scaleOf(view.container);
    draw([
      [100 + 500, 0],
      [100 + 510, 10],
    ]);
    const second = useBoardStore.getState().strokes[1];
    expect(second?.points[0]?.[0]).toBeCloseTo(500 / zoomed);
    expect(second?.points[0]?.[1]).toBeCloseTo(250 / zoomed);
  });
});

describe('faces and drawings', () => {
  it('each face shows its own elements, rules and strokes; positions stay when switching back', () => {
    board([
      write('h', 'title', 'Phần 1'),
      write('a', 'steps', 'bước một'),
      { kind: 'newboard', title: 'Phần 2' },
      write('g', 'side_notes', 'Cho: h = 20 m'),
      write('b', 'steps', 'bước hai'),
    ]);
    act(() => {
      useBoardStore.getState().addStroke({
        face: 1,
        points: [
          [1, 1],
          [2, 2],
        ],
      });
    });
    const view = render(<Whiteboard lesson={null} />);
    const ids = () => positions(view.container).map((p) => p.id);
    expect(ids()).toEqual(['h', 'a']);
    expect(rules(view.container)).toEqual([]);
    expect(view.container.querySelectorAll('.board__student polyline')).toHaveLength(0);
    const first = positions(view.container);
    act(() => {
      fireEvent.click(screen.getByRole('tab', { name: /^Bảng 2/ }));
    });
    expect(ids()).toEqual(['board_title', 'g', 'b']);
    expect(rules(view.container)).toEqual([360]);
    expect(view.container.querySelectorAll('.board__student polyline')).toHaveLength(1);
    act(() => {
      fireEvent.click(screen.getByRole('tab', { name: /^Bảng 1/ }));
    });
    expect(positions(view.container)).toEqual(first);
  });

  it('a table drawn smaller is scaled like its box', () => {
    const layout = emptyLayout();
    const cols = 16;
    place(
      layout,
      {
        kind: 'draw',
        id: 't',
        zone: 'diagram',
        type: 'table',
        spec: {
          header: Array.from({ length: cols }, (_, i) => `cột dài ${String(i)}`),
          rows: [Array.from({ length: cols }, () => 'ô')],
        },
      },
      measure,
    );
    const e = layout.elements[0];
    if (e?.kind !== 'draw') throw new Error('not placed');
    expect(e.scale).toBeLessThan(1);
    setBoard(layout);
    const view = render(<Whiteboard lesson={null} />);
    const wrapper = view.container.querySelector<HTMLElement>('.board__table-scale');
    expect(wrapper?.style.transform).toBe(`scale(${String(e.scale)})`);
  });
});
