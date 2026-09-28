import { useEffect, useLayoutEffect, useRef, useState } from 'react';

type Side = 'top' | 'bottom' | 'left' | 'right';

interface TipState {
  text: string;
  x: number;
  y: number;
  side: Side;
}

const SHOW_DELAY_MS = 350;
const GAP = 8;
/** Minimum distance between the tooltip and the window edge. */
const EDGE = 6;

/**
 * One global tooltip for every element with a `data-tip` attribute.
 * Rendered with `position: fixed` so it is never clipped by scrolling panels,
 * and shown on keyboard focus as well as hover.
 */
export function TooltipLayer() {
  const [tip, setTip] = useState<TipState | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const bubble = useRef<HTMLDivElement>(null);

  // Nudge the bubble back inside the window when it would overflow an edge.
  useLayoutEffect(() => {
    const el = bubble.current;
    if (!el) return;
    el.style.translate = '0 0';
    const r = el.getBoundingClientRect();
    const dx =
      r.left < EDGE
        ? EDGE - r.left
        : r.right > window.innerWidth - EDGE
          ? window.innerWidth - EDGE - r.right
          : 0;
    const dy =
      r.top < EDGE
        ? EDGE - r.top
        : r.bottom > window.innerHeight - EDGE
          ? window.innerHeight - EDGE - r.bottom
          : 0;
    el.style.translate = `${dx}px ${dy}px`;
  }, [tip]);

  useEffect(() => {
    const findTarget = (node: EventTarget | null): HTMLElement | null =>
      node instanceof Element ? node.closest<HTMLElement>('[data-tip]') : null;

    const show = (el: HTMLElement, immediate: boolean) => {
      window.clearTimeout(timer.current);
      const open = () => {
        const text = el.dataset.tip;
        if (!text) return;
        const r = el.getBoundingClientRect();
        const side = (el.dataset.tipSide as Side | undefined) ?? 'bottom';
        const pos: Record<Side, { x: number; y: number }> = {
          top: { x: r.left + r.width / 2, y: r.top - GAP },
          bottom: { x: r.left + r.width / 2, y: r.bottom + GAP },
          left: { x: r.left - GAP, y: r.top + r.height / 2 },
          right: { x: r.right + GAP, y: r.top + r.height / 2 },
        };
        setTip({ text, side, ...pos[side] });
      };
      if (immediate) open();
      else timer.current = window.setTimeout(open, SHOW_DELAY_MS);
    };

    const hide = () => {
      window.clearTimeout(timer.current);
      setTip(null);
    };

    const onOver = (e: PointerEvent) => {
      const el = findTarget(e.target);
      if (el) show(el, false);
      else hide();
    };
    const onFocus = (e: FocusEvent) => {
      const el = findTarget(e.target);
      if (el && el.matches(':focus-visible')) show(el, true);
    };

    document.addEventListener('pointerover', onOver);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', hide);
    document.addEventListener('pointerdown', hide);
    window.addEventListener('blur', hide);
    return () => {
      window.clearTimeout(timer.current);
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('pointerdown', hide);
      window.removeEventListener('blur', hide);
    };
  }, []);

  if (!tip) return null;
  return (
    <div
      ref={bubble}
      className={`tooltip tooltip--${tip.side}`}
      role="tooltip"
      style={{ left: tip.x, top: tip.y }}
    >
      {tip.text}
    </div>
  );
}
