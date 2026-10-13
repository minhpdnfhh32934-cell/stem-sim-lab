/**
 * Tells a tap on the 3D view (select the part under it) from a drag (orbit) or a pinch (zoom).
 * Fingers wobble more than a mouse, so the allowed movement depends on the pointer type; any
 * gesture that ever had two pointers down at once is never a tap.
 */

/** How far (CSS pixels) a pointer may move between down and up and still count as a tap. */
export const TAP_TOLERANCE = { mouse: 4, pen: 6, touch: 10 } as const;

export function tapTolerance(pointerType: string): number {
  return pointerType === 'touch'
    ? TAP_TOLERANCE.touch
    : pointerType === 'pen'
      ? TAP_TOLERANCE.pen
      : TAP_TOLERANCE.mouse;
}

/** The fields of a PointerEvent the tracker reads. */
export interface PointerLike {
  pointerId: number;
  pointerType: string;
  clientX: number;
  clientY: number;
}

export interface TapTracker {
  down(e: PointerLike): void;
  /** True when this pointer-up ends a tap (one pointer only, moved no more than its tolerance). */
  up(e: PointerLike): boolean;
  /** The pointer was cancelled (the browser took the gesture): never a tap. */
  cancel(e: PointerLike): void;
}

export function createTapTracker(): TapTracker {
  const active = new Map<number, { x: number; y: number; type: string }>();
  /** Two or more pointers were down together during the current gesture. */
  let multi = false;
  const release = (id: number) => {
    active.delete(id);
    const wasMulti = multi;
    if (active.size === 0) multi = false;
    return wasMulti;
  };
  return {
    down(e) {
      active.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
      if (active.size > 1) multi = true;
    },
    up(e) {
      const start = active.get(e.pointerId);
      const wasMulti = release(e.pointerId);
      if (!start || wasMulti) return false;
      const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      return moved <= tapTolerance(start.type);
    },
    cancel(e) {
      release(e.pointerId);
    },
  };
}
