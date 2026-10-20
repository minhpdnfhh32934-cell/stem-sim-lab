/**
 * Camera maths of the 3D views (pure: three.js maths only, no renderer, no DOM). The camera
 * orbits a target; a view frames a set of points by moving back along a direction until they
 * all fit the safe area (`frame.ts`: the canvas minus the controls over its edges). Zoom limits
 * keep the camera outside the subject and never cut a framed view. Placements can be tweened
 * (smoothly, or at once when the learner asked for reduced motion) and orbited from the keyboard.
 */
import * as THREE from 'three';

export type Vec3 = [number, number, number];

/** Visible extent of the safe area as tangents of the half-angles (left/right, up, down). */
export interface ViewTangents {
  h: number;
  up: number;
  down: number;
}

/** Margin around the subject inside the safe area. */
export const FIT_MARGIN = 1.08;

/** Right and up vectors of a camera looking along −dir (as `Object3D.lookAt` builds them). */
export function viewBasis(dir: Vec3): { right: Vec3; up: Vec3 } {
  const z = new THREE.Vector3(...dir).normalize();
  const x = new THREE.Vector3(0, 1, 0).cross(z);
  if (x.lengthSq() < 1e-12) x.set(1, 0, 0);
  x.normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  return { right: [x.x, x.y, x.z], up: [y.x, y.y, y.z] };
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Camera distance (along `dir`, from the target) at which every point (relative to the target)
 * is inside the safe area, times `margin`.
 */
export function fitDistance(
  points: readonly Vec3[],
  tan: ViewTangents,
  dir: Vec3,
  margin = FIT_MARGIN,
): number {
  const { right, up } = viewBasis(dir);
  let dist = 1;
  for (const p of points) {
    const x = Math.abs(dot(p, right));
    const y = dot(p, up);
    const need = dot(p, dir) + Math.max(x / tan.h, y >= 0 ? y / tan.up : -y / tan.down);
    dist = Math.max(dist, need);
  }
  return dist * margin;
}

export interface ZoomOptions {
  /** The camera never comes closer than this to the bounding sphere's surface. */
  gap?: number;
  /** Default zoom-out limit; raised when a frame needs more (very narrow canvases). */
  maxDistance?: number;
}

/**
 * Zoom limits around a target. Near: the camera stays outside a sphere of radius `bound` around
 * the origin (the whole subject, at every moment), so it can never enter it. Far: at least the
 * overview distance, so a framed view is never cut.
 */
export function zoomLimits(
  bound: number,
  target: Vec3,
  overviewDistance: number,
  o: ZoomOptions = {},
): { min: number; max: number } {
  const min = bound + Math.hypot(...target) + (o.gap ?? 0.5);
  return { min, max: Math.max(o.maxDistance ?? 80, overviewDistance * 1.25, min * 2) };
}

export interface CameraPlacement {
  target: Vec3;
  position: Vec3;
  distance: number;
  min: number;
  max: number;
}

/**
 * Where the camera goes to show `points` (relative to `center`): target, position along `dir`,
 * distance (the fit distance, within the zoom limits) and the limits for that target.
 */
export function placeCamera(
  center: Vec3,
  points: readonly Vec3[],
  tan: ViewTangents,
  dir: Vec3,
  limits: { min: number; max: number },
): CameraPlacement {
  const distance = Math.min(limits.max, Math.max(limits.min, fitDistance(points, tan, dir)));
  const [cx, cy, cz] = center;
  return {
    target: [cx, cy, cz],
    position: [cx + dir[0] * distance, cy + dir[1] * distance, cz + dir[2] * distance],
    distance,
    min: limits.min,
    max: limits.max,
  };
}

/** Smooth start and stop (0 → 0, 1 → 1). */
export function easeInOut(u: number): number {
  const x = Math.min(1, Math.max(0, u));
  return x * x * (3 - 2 * x);
}

/** Ease-in-out cubic (0 → 0, ½ → ½, 1 → 1): the camera's moves between stages and parts. */
export function easeInOutCubic(u: number): number {
  const x = Math.min(1, Math.max(0, u));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

/** A camera pose: where it looks and where it is. */
export interface CameraPose {
  target: Vec3;
  position: Vec3;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qa = new THREE.Quaternion();

/**
 * The pose a share `u` (0…1, eased) of the way from `from` to `to`: the target moves in a
 * straight line, the direction turns along the shorter arc (never through the subject) and the
 * distance changes geometrically (zooming feels even). u = 1 is exactly `to`.
 */
export function tweenCamera(from: CameraPose, to: CameraPose, u: number): CameraPose {
  if (u >= 1) return { target: [...to.target], position: [...to.position] };
  const k = easeInOutCubic(u);
  const target: Vec3 = [
    from.target[0] + (to.target[0] - from.target[0]) * k,
    from.target[1] + (to.target[1] - from.target[1]) * k,
    from.target[2] + (to.target[2] - from.target[2]) * k,
  ];
  _a.set(...from.position).sub(_c.set(...from.target));
  const d0 = Math.max(1e-6, _a.length());
  _b.set(...to.position).sub(_c.set(...to.target));
  const d1 = Math.max(1e-6, _b.length());
  _a.divideScalar(d0);
  _b.divideScalar(d1);
  // Rotation taking the start direction to the end one, applied a share k of the way.
  _q.setFromUnitVectors(_a, _b);
  _qa.identity().slerp(_q, k);
  _a.applyQuaternion(_qa);
  const dist = d0 * (d1 / d0) ** k;
  return {
    target,
    position: [target[0] + _a.x * dist, target[1] + _a.y * dist, target[2] + _a.z * dist],
  };
}

/** One arrow-key step of keyboard orbiting (radians). */
export const KEY_ORBIT_STEP = Math.PI / 24;

/**
 * Orbit angles for an arrow key (left/right turn around the vertical axis, up/down tilt), or
 * null for any other key. Positive `left` turns the camera to the left around the target.
 */
export function orbitForKey(key: string): { left: number; up: number } | null {
  switch (key) {
    case 'ArrowLeft':
      return { left: KEY_ORBIT_STEP, up: 0 };
    case 'ArrowRight':
      return { left: -KEY_ORBIT_STEP, up: 0 };
    case 'ArrowUp':
      return { left: 0, up: KEY_ORBIT_STEP };
    case 'ArrowDown':
      return { left: 0, up: -KEY_ORBIT_STEP };
    default:
      return null;
  }
}
