/**
 * An animal cell membrane that divides: a surface of revolution about the spindle axis (local x)
 * whose profile is the union of two circles — one sphere (offset 0) → a furrow → two daughter
 * spheres (offset ≥ radius). One buffer, written in place (no allocation per frame); the mesh
 * that shows it is moved, turned and stretched by the scene. Shapes are illustrative.
 */
import * as THREE from 'three';

export class TwoSphereProfile {
  readonly geometry = new THREE.BufferGeometry();
  private readonly pos: Float32Array;
  private readonly nor: Float32Array;
  private readonly posAttr: THREE.BufferAttribute;
  private readonly norAttr: THREE.BufferAttribute;
  /** Cosines and sines around the axis (fixed): a new profile costs no trigonometry per vertex. */
  private readonly cos: Float32Array;
  private readonly sin: Float32Array;
  /** Profile rows per half, segments around the axis. */
  private readonly H: number;
  private readonly A: number;
  private offset = Number.NaN;
  private radius = Number.NaN;

  constructor(segments: number) {
    const H = segments;
    const A = segments * 2;
    this.H = H;
    this.A = A;
    const rows = 2 * (H + 1);
    this.pos = new Float32Array(rows * (A + 1) * 3);
    this.nor = new Float32Array(rows * (A + 1) * 3);
    this.posAttr = new THREE.BufferAttribute(this.pos, 3);
    this.norAttr = new THREE.BufferAttribute(this.nor, 3);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.norAttr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.posAttr);
    this.geometry.setAttribute('normal', this.norAttr);
    const index: number[] = [];
    for (let r = 0; r < rows - 1; r++) {
      for (let a = 0; a < A; a++) {
        const i0 = r * (A + 1) + a;
        const i1 = i0 + 1;
        const j0 = i0 + (A + 1);
        const j1 = j0 + 1;
        // Counter-clockwise seen from outside (front faces point outwards).
        index.push(i0, i1, j0, i1, j1, j0);
      }
    }
    this.geometry.setIndex(index);
    this.cos = new Float32Array(A + 1);
    this.sin = new Float32Array(A + 1);
    for (let a = 0; a <= A; a++) {
      this.cos[a] = Math.cos((2 * Math.PI * a) / A);
      this.sin[a] = Math.sin((2 * Math.PI * a) / A);
    }
  }

  /** Writes the profile of two circles centred at ±offset (local x) with this radius. */
  write(offset: number, radius: number): void {
    if (Math.abs(offset - this.offset) < 5e-5 && Math.abs(radius - this.radius) < 5e-5) return;
    this.offset = offset;
    this.radius = radius;
    const { H, A, pos, nor } = this;
    const rows = 2 * (H + 1);
    const phiEnd = offset < radius ? Math.acos(offset / radius) : 0;
    let k = 0;
    for (let r = 0; r < rows; r++) {
      const left = r <= H;
      const i = left ? r : r - (H + 1);
      // Left circle: angle π → phiEnd; right circle: π − phiEnd → 0 (both measured from +x).
      const phi = left
        ? Math.PI + ((phiEnd - Math.PI) * i) / H
        : Math.PI - phiEnd - ((Math.PI - phiEnd) * i) / H;
      const cx = left ? -offset : offset;
      const cp = Math.cos(phi);
      const sp = Math.sin(phi);
      const x = cx + radius * cp;
      const rr = radius * sp;
      for (let a = 0; a <= A; a++) {
        const c = this.cos[a] ?? 1;
        const s = this.sin[a] ?? 0;
        pos[k] = x;
        pos[k + 1] = rr * c;
        pos[k + 2] = rr * s;
        nor[k] = cp;
        nor[k + 1] = sp * c;
        nor[k + 2] = sp * s;
        k += 3;
      }
    }
    this.posAttr.needsUpdate = true;
    this.norAttr.needsUpdate = true;
    // The two circles' union fits a sphere of radius offset + radius about the middle.
    const sphere = (this.geometry.boundingSphere ??= new THREE.Sphere());
    sphere.center.set(0, 0, 0);
    sphere.radius = offset + radius;
  }

  dispose(): void {
    this.geometry.dispose();
  }
}
