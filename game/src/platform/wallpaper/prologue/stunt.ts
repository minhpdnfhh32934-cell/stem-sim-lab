import * as THREE from 'three';
import { STUNT } from './plan';

/*
 * What Khoa's part of the opening needs to know each frame (Phú 2026-11-18: in the rocket's cabin,
 * pressed to the window, the door opened, out and hanging from the bar over it, letting go over
 * the roof, landing, walking to Linh). The prologue fills it from the rocket; the cast turns it
 * into his movements (cast.ts, `khoaStunt`). World positions throughout.
 */

/** From the bar he hangs by to his feet (m): his arm stretched, a little bent. */
export const HANG = 2.12;
/** How far out from the hull he hangs (m, along the door's outward normal). */
export const HANG_OUT = 0.18;
/** How long his skid lasts after landing (s): his speed along the roof shed at a constant rate. */
export const SKID_S = 0.38;

export interface StuntFrame {
  /** The rocket's clock (s; 0 as he lets go). */
  tau: number;
  /** The cabin's turn (the rocket's), its axis (up in the cabin), its outward (the door's way). */
  readonly cabin: THREE.Quaternion;
  readonly up: THREE.Vector3;
  readonly out: THREE.Vector3;
  /** The rocket's own +x (the door slides that way); and the flight's way, level. */
  readonly side: THREE.Vector3;
  readonly ahead: THREE.Vector3;
  /** Where he stands in the cabin, his feet's spots there. */
  readonly stand: THREE.Vector3;
  readonly footL: THREE.Vector3;
  readonly footR: THREE.Vector3;
  /** The porthole and his palms either side of it (on the door, shut). */
  readonly porthole: THREE.Vector3;
  readonly palmL: THREE.Vector3;
  readonly palmR: THREE.Vector3;
  /** The door's handle (it slides with the door), the bar over the doorway. */
  readonly handle: THREE.Vector3;
  readonly grip: THREE.Vector3;
  /** The doorway's rear edge (his left hand braced for the yank) and front edge (held stepping out). */
  readonly frameRear: THREE.Vector3;
  readonly frameFront: THREE.Vector3;
  /** Where he stands at the doorway's edge, and his feet there. */
  readonly sill: THREE.Vector3;
  readonly sillL: THREE.Vector3;
  readonly sillR: THREE.Vector3;
  /** What he looks at out of the window: the roof ahead. */
  readonly view: THREE.Vector3;
  /** Where the rocket is (its centre of mass), for his look as it goes. */
  readonly rocket: THREE.Vector3;
  /** His flight: his feet as he lets go, his velocity then, where they land and where he stops. */
  readonly release: THREE.Vector3;
  readonly velocity: THREE.Vector3;
  readonly land: THREE.Vector3;
  readonly stop: THREE.Vector3;
  /** Where the camera waits low on the roof for his landing: he looks up at it. */
  readonly camera: THREE.Vector3;
}

export function makeStuntFrame(): StuntFrame {
  const v = () => new THREE.Vector3();
  return {
    tau: 0,
    cabin: new THREE.Quaternion(),
    up: v(),
    out: v(),
    side: v(),
    ahead: v(),
    stand: v(),
    footL: v(),
    footR: v(),
    porthole: v(),
    palmL: v(),
    palmR: v(),
    handle: v(),
    grip: v(),
    frameRear: v(),
    frameFront: v(),
    sill: v(),
    sillL: v(),
    sillR: v(),
    view: v(),
    rocket: v(),
    release: v(),
    velocity: v(),
    land: v(),
    stop: v(),
    camera: v(),
  };
}

/** Gravity (m/s², world). */
const G = 9.80665;

/**
 * His flight from the bar to the roof: ballistic from his feet at `release` to `land` in the time
 * the script gives (STUNT.release → STUNT.land); the velocity he needs (written into `velocity`),
 * and the skid after (`stop`, where it ends): his speed along the roof shed over `skidS` seconds
 * at a constant rate.
 */
export function flight(
  release: THREE.Vector3,
  land: THREE.Vector3,
  velocity: THREE.Vector3,
  stop: THREE.Vector3,
  skidS: number,
): void {
  const T = STUNT.land - STUNT.release;
  velocity
    .copy(land)
    .sub(release)
    .add(new THREE.Vector3(0, 0.5 * G * T * T, 0))
    .multiplyScalar(1 / T);
  const level = new THREE.Vector3(velocity.x, 0, velocity.z);
  // Constant deceleration from his landing speed to rest: half his speed times the time.
  stop.copy(land).addScaledVector(level, 0.5 * skidS);
}

/** Where his feet are in flight, `u` seconds after letting go (written into `out`). */
export function inFlight(
  release: THREE.Vector3,
  velocity: THREE.Vector3,
  u: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  out.copy(release).addScaledVector(velocity, u);
  out.y -= 0.5 * G * u * u;
  return out;
}
