import { useCallback, useRef } from 'react';

/** True while part of `el`'s content is below its visible area (2 px of slack for rounding). */
export const moreBelow = (el: HTMLElement) => el.scrollTop + el.clientHeight < el.scrollHeight - 2;

/**
 * Ref callback for a scroll container: sets `data-more-below` while content is hidden below,
 * so CSS can show a fade at the bottom edge (`.scroll-cue`). Follows scrolling, resizing and
 * content changes (a tab switch, a formula that renders late).
 */
export function useScrollCue() {
  const cleanup = useRef<(() => void) | null>(null);
  return useCallback((el: HTMLElement | null) => {
    cleanup.current?.();
    cleanup.current = null;
    if (!el) return;
    const update = () => {
      el.toggleAttribute('data-more-below', moreBelow(el));
    };
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const mo = new MutationObserver(update);
    mo.observe(el, { childList: true, subtree: true });
    el.addEventListener('scroll', update, { passive: true });
    update();
    cleanup.current = () => {
      ro.disconnect();
      mo.disconnect();
      el.removeEventListener('scroll', update);
    };
  }, []);
}
