/**
 * A card that scrolls says so: `data-more` is set on the scrolling box while part of its content
 * lies below its bottom edge (the stylesheet then fades the last line out), and cleared once the
 * learner has scrolled to the end or everything fits.
 */
import { useLayoutEffect, type RefObject } from 'react';

export function useScrollMore(ref: RefObject<HTMLElement | null>, contentKey: string): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const more = el.scrollHeight - el.scrollTop - el.clientHeight > 2;
      if (more) el.dataset.more = '';
      else delete el.dataset.more;
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    ro?.observe(el);
    for (const child of Array.from(el.children)) ro?.observe(child);
    return () => {
      el.removeEventListener('scroll', update);
      ro?.disconnect();
    };
  }, [ref, contentKey]);
}
