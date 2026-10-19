/**
 * Picking in a 3D view. `createTapTracker` tells a tap (select the part under it) from a drag
 * (orbit) or a pinch (zoom): fingers wobble more than a mouse, so the allowed movement depends on
 * the pointer type; any gesture that ever had two pointers down at once is never a tap.
 * `ndcFromEvent` turns a pointer position into the ray's screen coordinates, and `pickFirst`
 * chooses the part under the ray: visible, not faded out, inner parts before the containers
 * (membranes, glass) around them.
 */
import * as THREE from 'three';

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

/** Normalised device coordinates (−1…1, y up) of a pointer over an element, written to `out`. */
export function ndcFromEvent(
  e: { clientX: number; clientY: number },
  el: Element,
  out: THREE.Vector2,
): THREE.Vector2 {
  const rect = el.getBoundingClientRect();
  return out.set(
    ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
    -((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1,
  );
}

export interface PickOptions {
  /** Parts that hold other parts (membranes, glass): an inner part under the same ray wins. */
  isContainer?: (o: THREE.Object3D) => boolean;
  /** A see-through part fainter than this is not there to be picked. */
  minOpacity?: number;
}

/** Shown, with every parent shown too (a hidden group hides its children). */
function shown(o: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

function opaqueEnough(o: THREE.Object3D, minOpacity: number): boolean {
  const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
  if (!m) return true;
  const mats = Array.isArray(m) ? m : [m];
  // Faded out (blended or alphaHash): not there to be picked.
  return mats.some((x) => !(x.transparent || x.alphaHash) || x.opacity > minOpacity);
}

/**
 * Every hit of the ray on the pickable objects that can be seen now (nearest first): shown with
 * all its parents and not faded out. Instanced meshes report their `instanceId`.
 */
export function visibleHits(
  raycaster: THREE.Raycaster,
  pickables: readonly THREE.Object3D[],
  minOpacity = 0.05,
): THREE.Intersection[] {
  return raycaster
    .intersectObjects(pickables as THREE.Object3D[], false)
    .filter((h) => shown(h.object) && opaqueEnough(h.object, minOpacity));
}

/**
 * The part under the ray: the nearest visible inner part, otherwise the nearest container (null
 * when the ray hits nothing).
 */
export function pickFirst(
  raycaster: THREE.Raycaster,
  pickables: readonly THREE.Object3D[],
  o: PickOptions = {},
): THREE.Intersection | null {
  const hits = visibleHits(raycaster, pickables, o.minOpacity);
  const isContainer = o.isContainer ?? (() => false);
  return hits.find((h) => !isContainer(h.object)) ?? hits[0] ?? null;
}
