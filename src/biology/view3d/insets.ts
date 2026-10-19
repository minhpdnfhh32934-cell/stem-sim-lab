/**
 * Measuring the controls drawn over a 3D canvas (elements marked `data-inset` inside the view's
 * HUD): the camera keeps the picture out from under them (`frame.ts`).
 *
 * - `data-inset="top" | "bottom" | "right"`: a bar along that edge.
 * - `data-inset="corner"`: a box in the top-right corner, counted from the top or from the
 *   right, whichever leaves the larger picture for a subject of the given aspect.
 */
import type { Insets } from './frame';

/** Gap kept between the picture and a control. */
const GAP = 8;

export function measureInsets(
  host: HTMLElement,
  hud: HTMLElement | null,
  fallback: Insets,
  aspect = 1.6,
): Insets {
  const box = host.getBoundingClientRect();
  if (!hud || box.width === 0 || box.height === 0) return fallback;
  const out: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const corners: DOMRect[] = [];
  for (const el of hud.querySelectorAll<HTMLElement>('[data-inset]')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    switch (el.dataset.inset) {
      case 'top':
        out.top = Math.max(out.top, r.bottom - box.top + GAP);
        break;
      case 'bottom':
        out.bottom = Math.max(out.bottom, box.bottom - r.top + GAP);
        break;
      case 'right':
        out.right = Math.max(out.right, box.right - r.left + GAP);
        break;
      case 'corner':
        corners.push(r);
        break;
    }
  }
  for (const r of corners) {
    const asTop = { ...out, top: Math.max(out.top, r.bottom - box.top + GAP) };
    const asRight = { ...out, right: Math.max(out.right, box.right - r.left + GAP) };
    const score = (i: Insets) =>
      Math.min((box.width - i.left - i.right) / aspect, box.height - i.top - i.bottom);
    Object.assign(out, score(asRight) > score(asTop) ? asRight : asTop);
  }
  return out;
}

export const sameInsets = (a: Insets, b: Insets): boolean =>
  Math.abs(a.top - b.top) < 2 &&
  Math.abs(a.right - b.right) < 2 &&
  Math.abs(a.bottom - b.bottom) < 2 &&
  Math.abs(a.left - b.left) < 2;
