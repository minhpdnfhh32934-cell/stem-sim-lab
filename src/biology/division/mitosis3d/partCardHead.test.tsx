import { act, render } from '@testing-library/react';
import { useLayoutEffect, useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fitCardHead,
  headStays,
  measureCard,
  MIN_LINES_UNDER_HEAD,
  useCardHeadFit,
} from './partCardHead';

/** Line height of the part's text: --text-content (15 px) × 1.45. */
const LINE = 21.75;
/** Borders (1 + 1) and the bottom padding (--space-3, 12 px). */
const FRAME = 14;

describe('part card: does the head stay in view?', () => {
  it('stays in a tall row (1366×768: about 240 px, head on one line)', () => {
    expect(headStays({ room: 242, head: 55, frame: FRAME, line: LINE })).toBe(true);
    // Measured with a wide UI font (Verdana, as wide as the Linux font): the row is shorter.
    expect(headStays({ room: 225, head: 55, frame: FRAME, line: LINE })).toBe(true);
  });

  it('scrolls with the text in a short row, where it would cover the text', () => {
    expect(headStays({ room: 63, head: 55, frame: FRAME, line: LINE })).toBe(false);
    expect(headStays({ room: 0, head: 55, frame: FRAME, line: LINE })).toBe(false);
  });

  it('counts the head as it is: a head wrapped in a narrow card needs a taller row', () => {
    // 1024 px wide, wide font: the head takes three lines (100 px). A fixed 9rem (126 px) row
    // would have kept it, leaving 20 px under it, and the last line could never be read.
    expect(headStays({ room: 134, head: 100, frame: FRAME, line: LINE })).toBe(false);
    expect(headStays({ room: 164, head: 100, frame: FRAME, line: LINE })).toBe(true);
    // The same row with the head on one line keeps it.
    expect(headStays({ room: 134, head: 55, frame: FRAME, line: LINE })).toBe(true);
  });

  it('needs room for two full lines under the head, the last line above the bottom padding', () => {
    expect(MIN_LINES_UNDER_HEAD).toBe(2);
    const room = 55 + FRAME + 2 * LINE;
    expect(headStays({ room, head: 55, frame: FRAME, line: LINE })).toBe(true);
    expect(headStays({ room: room - 1, head: 55, frame: FRAME, line: LINE })).toBe(false);
  });

  it('a size that could not be measured never keeps the head (the text is never hidden)', () => {
    expect(headStays({ room: 300, head: 55, frame: FRAME, line: 0 })).toBe(false);
    expect(headStays({ room: 300, head: 55, frame: FRAME, line: Number.NaN })).toBe(false);
    expect(headStays({ room: Number.NaN, head: 55, frame: FRAME, line: LINE })).toBe(false);
  });
});

/** Gives an element a fixed height for `getBoundingClientRect()` (jsdom lays nothing out). */
function setHeight(el: HTMLElement, height: () => number) {
  el.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 300,
      bottom: height(),
      width: 300,
      height: height(),
    }) as DOMRect;
}

/** The card's DOM: slot > card (border, padding) > head + text. */
function card(lineHeight = '21px') {
  const slot = document.createElement('div');
  const box = document.createElement('aside');
  box.style.borderTop = '1px solid';
  box.style.borderBottom = '2px solid';
  box.style.paddingBottom = '12px';
  const head = document.createElement('div');
  const text = document.createElement('p');
  text.style.fontSize = '15px';
  text.style.lineHeight = lineHeight;
  text.textContent = 'Nơi hai crômatit chị em dính nhau.';
  box.append(head, text);
  slot.append(box);
  return { slot, box, head };
}

describe('part card: measuring', () => {
  it('reads the row, the head, the borders with the bottom padding, and the line height', () => {
    const { slot, box, head } = card();
    setHeight(slot, () => 200);
    setHeight(head, () => 55);
    expect(measureCard(slot, box, head)).toEqual({ room: 200, head: 55, frame: 15, line: 21 });
  });

  it('`line-height: normal` counts as 1.45 times the font size, as in base.css', () => {
    const { slot, box, head } = card('normal');
    expect(measureCard(slot, box, head).line).toBeCloseTo(21.75, 5);
  });

  it('marks the card for bio.css: data-head="stays" or "scrolls"', () => {
    const { slot, box, head } = card();
    let room = 200;
    setHeight(slot, () => room);
    setHeight(head, () => 55);
    expect(fitCardHead(slot, box, head)).toBe(true);
    expect(box.dataset.head).toBe('stays');
    room = 80;
    expect(fitCardHead(slot, box, head)).toBe(false);
    expect(box.dataset.head).toBe('scrolls');
  });
});

/** Row height the harness's slot reports. */
let room = 200;

function Harness() {
  const slotRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  // Before the hook's own layout effect (same component: declaration order).
  useLayoutEffect(() => {
    if (slotRef.current) setHeight(slotRef.current, () => room);
    if (headRef.current) setHeight(headRef.current, () => 55);
  }, []);
  useCardHeadFit(slotRef, cardRef, headRef);
  return (
    <div ref={slotRef}>
      <aside ref={cardRef} data-testid="card">
        <div ref={headRef} />
        <p style={{ fontSize: '15px', lineHeight: '21px' }}>Nơi hai crômatit chị em dính nhau.</p>
      </aside>
    </div>
  );
}

describe('part card: kept fitted', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    room = 200;
  });

  it('is fitted before the first frame is drawn', () => {
    const view = render(<Harness />);
    expect(view.getByTestId('card')).toHaveAttribute('data-head', 'stays');
  });

  it('a shorter row or a taller head is fitted on the next frame; leaving stops listening', () => {
    const observers: { callback: () => void; observed: number; disconnected: number }[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        entry: { callback: () => void; observed: number; disconnected: number };
        constructor(callback: () => void) {
          this.entry = { callback, observed: 0, disconnected: 0 };
          observers.push(this.entry);
        }
        observe() {
          this.entry.observed += 1;
        }
        unobserve() {
          return undefined;
        }
        disconnect() {
          this.entry.disconnected += 1;
        }
      },
    );
    const frames = new Map<number, () => void>();
    let next = 0;
    vi.stubGlobal('requestAnimationFrame', (run: () => void) => {
      next += 1;
      frames.set(next, run);
      return next;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      frames.delete(id);
    });
    const runFrames = () => {
      const pending = [...frames.values()];
      frames.clear();
      for (const run of pending) run();
    };

    const view = render(<Harness />);
    const box = view.getByTestId('card');
    expect(box).toHaveAttribute('data-head', 'stays');
    // The row and the head are both watched (a narrower card wraps the head).
    expect(observers).toHaveLength(1);
    expect(observers[0]!.observed).toBe(2);
    room = 60;
    act(() => {
      for (const o of observers) o.callback();
    });
    // Not inside the observer: on the next frame.
    expect(box).toHaveAttribute('data-head', 'stays');
    runFrames();
    expect(box).toHaveAttribute('data-head', 'scrolls');

    // A frame still waiting when the card goes away is dropped.
    act(() => {
      for (const o of observers) o.callback();
    });
    view.unmount();
    expect(frames.size).toBe(0);
    for (const o of observers) expect(o.disconnected).toBe(1);
  });
});
