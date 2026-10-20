/**
 * The light-weight side of the post-processing (no passes imported here, so the Medium tier
 * never loads them): what a scene asks of the chain (a highlight that blooms, refracting
 * glass), and the guard that turns costly parts off when animated frames are slow.
 */
import * as THREE from 'three';
import { FrameMonitor } from '@/perf/frameMonitor';

/** A material that glows in HDR on the High tier (`userData.bloom`, set by the recipes). */
export function marksBloom(material: THREE.Material): boolean {
  return material.userData.bloom === true;
}

/** Whether any visible mesh of the scene shows a blooming highlight now. */
export function sceneWantsBloom(scene: THREE.Object3D): boolean {
  let found = false;
  const visit = (o: THREE.Object3D) => {
    if (found || !o.visible) return;
    const m = (o as Partial<THREE.Mesh>).material;
    if (m && (Array.isArray(m) ? m.some(marksBloom) : marksBloom(m))) {
      found = true;
      return;
    }
    for (const c of o.children) visit(c);
  };
  visit(scene);
  return found;
}

/**
 * Turns refraction off in a scene (the guard's last step, or a scene built after it): every
 * transmissive material becomes the plain see-through look it has on the Medium tier.
 */
export function disableTransmission(scene: THREE.Object3D): void {
  scene.traverse((o) => {
    const m = (o as Partial<THREE.Mesh>).material;
    for (const x of Array.isArray(m) ? m : m ? [m] : []) {
      if (x instanceof THREE.MeshPhysicalMaterial && x.transmission > 0) {
        x.transmission = 0;
        x.transparent = true;
        x.opacity = Math.min(x.opacity, 0.35);
        x.needsUpdate = true;
      }
    }
  });
}

/** Frames slower than this (ms) count against the post-processing. */
export const SLOW_FRAME_MS = 20;
/** Consecutive slow animated frames before one part is turned off. */
export const SLOW_FRAMES = 30;
/** A gap longer than this (ms) is not an animation: the count starts again. */
const ANIMATION_GAP_MS = 250;

/**
 * Watches the time between frames drawn one after another (animation, orbit damping): 30
 * consecutive frames over 20 ms ask for one step down. Single on-demand frames never count.
 */
export class PostFxGuard {
  private last = Number.NEGATIVE_INFINITY;
  // FrameMonitor counts a frame as slow above budget × 1.2: 1/60 s × 1.2 = 20 ms.
  private readonly monitor = new FrameMonitor(SLOW_FRAME_MS / 1200, SLOW_FRAMES);

  /** Records a frame drawn at `now` (ms); true when a part should be turned off. */
  frame(now: number): boolean {
    const gap = now - this.last;
    this.last = now;
    if (gap <= 0 || gap > ANIMATION_GAP_MS) {
      this.monitor.resetOverload();
      return false;
    }
    this.monitor.record(gap / 1000);
    if (!this.monitor.overloaded) return false;
    this.monitor.resetOverload();
    return true;
  }
}
