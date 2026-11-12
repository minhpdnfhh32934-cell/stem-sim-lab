/**
 * The orb glides between the two layouts (#234 step 4): talk (large, above the conversation) ↔
 * board (small, top-left corner). The page jumps to the new layout at once and the orb's box
 * plays the way back from where it was ("FLIP"): one transform, so the canvas is resized once
 * instead of every frame. Instant under reduced motion.
 */
import { useLayoutEffect, useRef, type RefObject } from 'react';
import { prefersReducedMotion } from '@/ui/three/availability';

export const GLIDE_MS = 500;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

interface Box {
  left: number;
  top: number;
  width: number;
}

/** The transform that puts a box drawn at `to` back where `from` was (origin: top-left). */
export function glideFrom(from: Box, to: Box): string | null {
  if (to.width <= 0 || from.width <= 0) return null;
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  const scale = from.width / to.width;
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(scale - 1) < 0.001) return null;
  return `translate(${String(dx)}px, ${String(dy)}px) scale(${String(scale)})`;
}

/** Glides `ref`'s element from its last box each time `key` changes. */
export function useGlide(ref: RefObject<HTMLElement | null>, key: string): void {
  const last = useRef<Box | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { left, top, width } = el.getBoundingClientRect();
    // shortcut: the start is the box saved at the last switch; after a window resize the first
    // glide starts from the old place (500 ms, looks only). Save on resize too if anyone notices.
    const from = last.current;
    last.current = { left, top, width };
    // jsdom has no Web Animations; with less motion the orb simply is in its new place.
    if (!from || typeof el.animate !== 'function' || prefersReducedMotion()) return;
    const transform = glideFrom(from, { left, top, width });
    if (!transform) return;
    el.animate(
      [
        { transformOrigin: '0 0', transform },
        { transformOrigin: '0 0', transform: 'none' },
      ],
      { duration: GLIDE_MS, easing: EASE },
    );
  }, [ref, key]);
}
