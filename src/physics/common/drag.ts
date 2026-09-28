/**
 * Mouse dragging uses a *spring constraint* between the pointer and the body instead of
 * teleporting it (MASTER_PROMPT §6.1): the body is pulled by a critically damped spring,
 * so it moves physically and keeps its velocity when released ("ném theo vận tốc kéo").
 *
 * Returns the acceleration (m/s²) to add along one coordinate.
 */
export const DRAG_OMEGA = 28; // rad/s — responsive yet stable with Δt = 1/240 s (ωΔt ≈ 0.12)

export function dragAccel(target: number, position: number, velocity: number): number {
  return DRAG_OMEGA * DRAG_OMEGA * (target - position) - 2 * DRAG_OMEGA * velocity;
}

/** Pointer target shared by engines; `null` when not dragging. */
export interface DragTarget {
  body: number;
  x: number;
  y: number;
}
