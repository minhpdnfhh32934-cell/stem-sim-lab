import type { Vec3 } from '../../../core/math';

/** A world point on screen: pixels from the top left, and whether it is in front of the eye. */
export interface ScreenPoint {
  x: number;
  y: number;
  /** In front of the camera and inside the viewport (a margin of `margin` px). */
  visible: boolean;
}

/**
 * Projects a world point to the screen with the game camera's own pose, without three.js: the eye
 * at `eye`, looking by `yaw` and `pitch` (the camera rotates about Y then X, `rotation.order`
 * YXZ), a vertical field of view `fov` (degrees) over a `width` × `height` viewport. The result is
 * written into `out` (no allocation per call). The workspace holds the camera still, so the
 * `bench-embedded` callouts are placed once on open and on a resize.
 */
export function projectToScreen(
  eye: Readonly<Vec3>,
  yaw: number,
  pitch: number,
  fov: number,
  width: number,
  height: number,
  point: Readonly<Vec3>,
  out: ScreenPoint,
  margin = 0,
): ScreenPoint {
  const dx = point[0] - eye[0];
  const dy = point[1] - eye[1];
  const dz = point[2] - eye[2];
  const sy = Math.sin(yaw);
  const cy = Math.cos(yaw);
  const sp = Math.sin(pitch);
  const cp = Math.cos(pitch);
  // Camera axes: forward = R·(0,0,−1), right = R·(1,0,0), up = R·(0,1,0), with R = Ry(yaw)·Rx(pitch).
  const depth = dx * -cp * sy + dy * sp + dz * -cp * cy;
  const right = dx * cy + dz * -sy;
  const up = dx * sp * sy + dy * cp + dz * sp * cy;
  const focal = height / 2 / Math.tan((fov * Math.PI) / 360);
  if (depth <= 1e-6) {
    out.x = Number.NaN;
    out.y = Number.NaN;
    out.visible = false;
    return out;
  }
  out.x = width / 2 + (right / depth) * focal;
  out.y = height / 2 - (up / depth) * focal;
  out.visible =
    out.x >= margin && out.x <= width - margin && out.y >= margin && out.y <= height - margin;
  return out;
}
