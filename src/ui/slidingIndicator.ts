/**
 * Sliding selection indicator for every segmented control in the app (gallery pattern 039).
 *
 * One installer watches the whole document: for each `.segmented`, `.subject-switch` (pill) and
 * `.tabs__list` (underline) it measures the checked item and writes its position into CSS
 * variables on the container (`--ind-x`, `--ind-y`, `--ind-w`, `--ind-h`) plus the class
 * `has-indicator`. The CSS draws the pill/underline from those variables and lets it glide;
 * without them (no script, jsdom) the controls keep their plain checked style.
 */

const CONTAINERS = '.segmented, .subject-switch, .tabs__list';
const ACTIVE = '[aria-checked="true"], [aria-selected="true"]';

/** Position of the active item inside its container, in CSS pixels (pure; tested). */
export function indicatorBox(
  container: { left: number; top: number },
  item: { left: number; top: number; width: number; height: number },
  scroll: { left: number; top: number } = { left: 0, top: 0 },
): { x: number; y: number; w: number; h: number } {
  return {
    x: item.left - container.left + scroll.left,
    y: item.top - container.top + scroll.top,
    w: item.width,
    h: item.height,
  };
}

function place(container: HTMLElement): void {
  const items = Array.from(container.children) as HTMLElement[];
  const active = items.find((el) => el.matches(ACTIVE));
  if (!active || active.offsetParent === null) {
    container.classList.remove('has-indicator');
    return;
  }
  const c = container.getBoundingClientRect();
  const a = active.getBoundingClientRect();
  if (a.width === 0) return;
  const box = indicatorBox(c, a, { left: container.scrollLeft, top: container.scrollTop });
  const style = container.style;
  const first = !container.classList.contains('has-indicator');
  if (first) container.classList.add('no-indicator-motion');
  style.setProperty('--ind-x', `${String(box.x)}px`);
  style.setProperty('--ind-y', `${String(box.y)}px`);
  style.setProperty('--ind-w', `${String(box.w)}px`);
  style.setProperty('--ind-h', `${String(box.h)}px`);
  container.classList.add('has-indicator');
  // The first placement appears in place; later changes glide.
  if (first) {
    requestAnimationFrame(() => {
      container.classList.remove('no-indicator-motion');
    });
  }
}

/** Starts watching the document. Returns a function that stops it. */
export function installSlidingIndicators(root: HTMLElement = document.body): () => void {
  if (typeof MutationObserver === 'undefined' || typeof ResizeObserver === 'undefined') {
    return () => undefined;
  }
  let frame = 0;
  const watched = new Set<HTMLElement>();
  const resize = new ResizeObserver(() => {
    schedule();
  });
  const update = () => {
    frame = 0;
    for (const el of root.querySelectorAll<HTMLElement>(CONTAINERS)) {
      if (!watched.has(el)) {
        watched.add(el);
        resize.observe(el);
      }
      place(el);
    }
    for (const el of watched) {
      if (!el.isConnected) {
        resize.unobserve(el);
        watched.delete(el);
      }
    }
  };
  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }
  // Only mutations that touch a selection control matter (not the whiteboard or the chat).
  const relevant = (records: MutationRecord[]) =>
    records.some((r) => {
      if (r.type === 'attributes') return r.target.parentElement?.matches(CONTAINERS) === true;
      return Array.from(r.addedNodes).some(
        (n) =>
          n instanceof Element && (n.matches(CONTAINERS) || n.querySelector(CONTAINERS) !== null),
      );
    });
  const mutations = new MutationObserver((records) => {
    if (relevant(records)) schedule();
  });
  mutations.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['aria-checked', 'aria-selected'],
  });
  window.addEventListener('resize', schedule);
  // Font scale changes resize the items without any mutation inside the control.
  document.fonts.addEventListener('loadingdone', schedule);
  schedule();
  return () => {
    mutations.disconnect();
    resize.disconnect();
    window.removeEventListener('resize', schedule);
    document.fonts.removeEventListener('loadingdone', schedule);
    if (frame) cancelAnimationFrame(frame);
  };
}
