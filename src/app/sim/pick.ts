import type { BodyDef, Params } from '@/physics/types';

/** A body is part of the scene unless its `active` predicate says otherwise. */
export const bodyActive = (b: BodyDef, p: Params): boolean => b.active?.(p) ?? true;

export interface PickHit {
  id: string;
  index: number;
  d: number;
}

/**
 * The active body nearest to the screen point (sx, sy) within its pick radius, or null.
 * Inactive bodies (e.g. body B in one-body mode) cannot be picked.
 */
export function pickBody(
  bodies: readonly BodyDef[],
  state: Float64Array,
  p: Params,
  toScreen: (x: number, y: number) => { sx: number; sy: number },
  scale: number,
  sx: number,
  sy: number,
): PickHit | null {
  let best: PickHit | null = null;
  bodies.forEach((b, index) => {
    if (!bodyActive(b, p)) return;
    const pos = b.position(state, p);
    const s = toScreen(pos.x, pos.y);
    const d = Math.hypot(s.sx - sx, s.sy - sy);
    const r = Math.max(14, b.radius(p) * scale + 6);
    if (d <= r && (!best || d < best.d)) best = { id: b.id, index, d };
  });
  return best;
}
