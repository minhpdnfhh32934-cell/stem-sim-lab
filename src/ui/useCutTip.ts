import { useLayoutEffect, useRef } from 'react';

/**
 * A one-line label cut to "…" (a long name, a large font) shows whole in the tooltip, on hover and
 * on keyboard focus (#205 A5): while it is cut it carries `data-tip` (TooltipLayer) and joins the
 * Tab order; once it fits again it is plain text. A screen reader always reads the whole text.
 */
export function useCutTip<T extends HTMLElement>(text: string) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      if (el.scrollWidth > el.clientWidth) {
        el.dataset.tip = text;
        el.tabIndex = 0;
      } else {
        delete el.dataset.tip;
        el.removeAttribute('tabindex');
      }
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [text]);
  return ref;
}
