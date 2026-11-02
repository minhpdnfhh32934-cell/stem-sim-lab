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
 * and shown on keyboard focus as well as hover. It is a manual popover, so it joins the top
 * layer above an open modal dialog (Settings, Update, the command palette…), whose icon-only
 * buttons have no other visible name; without popover support it stays a plain fixed layer.
 * WCAG 1.4.13: Esc hides it (a hover bubble takes that Esc for itself), and a bubble shown by
 * hover stays while the pointer is on it or crossing the gap to it. The bubble never takes the pointer (`pointer-events: none`), so
 * that is judged from the pointer's position, and a click always reaches what lies under it.
 */
export function TooltipLayer() {
  const [tip, setTip] = useState<TipState | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const bubble = useRef<HTMLDivElement>(null);
  /** The control whose bubble is on screen, and whether hover (not focus) showed it. */
  const shown = useRef<{ anchor: HTMLElement; hover: boolean } | null>(null);

  // Nudge the bubble back inside the window when it would overflow an edge.
  useLayoutEffect(() => {
    const el = bubble.current;
    if (!el) return;
    if (typeof el.showPopover === 'function' && !el.matches(':popover-open')) {
      try {
        el.showPopover();
      } catch {
        // Not connected or already shown: the fixed layer still draws it.
      }
    }
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
        shown.current = { anchor: el, hover: !immediate };
        setTip({ text, side, ...pos[side] });
      };
      if (immediate) open();
      else timer.current = window.setTimeout(open, SHOW_DELAY_MS);
    };

    // Takes the bubble away; a bubble waiting to open for another control still opens.
    const hideBubble = () => {
      shown.current = null;
      setTip(null);
    };
    const hide = () => {
      window.clearTimeout(timer.current);
      hideBubble();
    };
    // On the bubble or in the gap around it (the way from the control to the bubble).
    const near = (e: PointerEvent) => {
      const r = bubble.current?.getBoundingClientRect();
      return (
        !!r &&
        e.clientX >= r.left - GAP &&
        e.clientX <= r.right + GAP &&
        e.clientY >= r.top - GAP &&
        e.clientY <= r.bottom + GAP
      );
    };

    const onOver = (e: PointerEvent) => {
      if (shown.current?.hover && near(e)) {
        window.clearTimeout(timer.current);
        return;
      }
      const el = findTarget(e.target);
      if (!el) hide();
      else if (el !== shown.current?.anchor) {
        hideBubble();
        show(el, false);
      }
    };
    const onMove = (e: PointerEvent) => {
      const s = shown.current;
      const onAnchor = e.target instanceof Node && s?.anchor.contains(e.target);
      if (!s?.hover || onAnchor || near(e)) return;
      hideBubble();
      // The pointer left the bubble over another control (one the bubble covered, so it got no
      // pointerover of its own): its tooltip opens as if just entered.
      const el = findTarget(e.target);
      if (el) show(el, false);
    };
    // A hover bubble takes the first Esc for itself (the drawer or dialog closes on the next one).
    // A focus bubble only goes: the Esc still closes the dialog whose first control has a tip.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const hover = shown.current?.hover;
      hide();
      if (!hover) return;
      e.preventDefault();
      e.stopPropagation();
    };
    const onFocus = (e: FocusEvent) => {
      const el = findTarget(e.target);
      if (el && el.matches(':focus-visible')) show(el, true);
    };

    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', hide);
    document.addEventListener('pointerdown', hide);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', hide);
    return () => {
      window.clearTimeout(timer.current);
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('pointerdown', hide);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('blur', hide);
    };
  }, []);

  if (!tip) return null;
  return (
    <div
      ref={bubble}
      className={`tooltip tooltip--${tip.side}`}
      popover="manual"
      role="tooltip"
      style={{ left: tip.x, top: tip.y }}
    >
      {tip.text}
    </div>
  );
}
