/**
 * An animal cell membrane that divides: a surface of revolution about the spindle axis (local x)
 * whose profile is the union of two circles — one sphere (offset 0) → a furrow → two daughter
 * spheres (offset ≥ radius). One buffer, written in place (no allocation per frame); the mesh
 * that shows it is moved, turned and stretched by the scene. Shapes are illustrative.
 *
 * Optionally the surface undulates a little (`amplitude`, a share of the radius; seeded low-
 * frequency waves, illustration only): always inwards, so the membrane never leaves the two
 * circles' union (camera frames, bounds and "every chromosome inside" stay as they were). The
 * waves are mirror-symmetric across the furrow, so the two halves still meet there.
 */
import * as THREE from 'three';

export interface ProfileOptions {
  /** Depth of the undulation as a share of the radius (0 = smooth spheres; 0.01–0.02 suits). */
  amplitude?: number;
  /** Seed of the waves (cells of one scene get different seeds). */
  seed?: number;
}

/** Low-frequency waves on the unit sphere: three seeded plane waves (frequency 1.8–3.2). */
function waves(seed: number): { f: [number, number, number]; phase: number }[] {
  let s = (Math.abs(Math.round(seed)) % 2147483646) + 1;
  const r = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  return [0, 1, 2].map(() => {
    const z = 2 * r() - 1;
    const t = 2 * Math.PI * r();
    const q = Math.sqrt(1 - z * z);
    const k = 1.8 + 1.4 * r();
    return { f: [k * q * Math.cos(t), k * q * Math.sin(t), k * z], phase: 2 * Math.PI * r() };
  });
}

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
  /**
   * Undulation table over (polar angle, angle around the axis): radius share g ≤ 1 and the
   * displaced surface's normal, sampled PHI_STEPS × H times between the poles (null: smooth).
   */
  private readonly table: Float32Array | null;
  private readonly P: number;

  constructor(segments: number, o: ProfileOptions = {}) {
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
    const amp = Math.min(0.05, Math.max(0, o.amplitude ?? 0));
    this.P = 4 * H;
    this.table = amp > 0 ? this.undulation(amp, o.seed ?? 1) : null;
  }

  /**
   * The undulation for every sampled direction d = (cos φ, sin φ cos θ, sin φ sin θ) about a
   * circle's centre: g(d) = 1 − amp·(½ + ½·u(d)) with u ∈ [−1, 1] a sum of three plane waves in
   * (2dx² − 1, dy, dz) — symmetric in dx, so both halves agree at the furrow — and the normal of
   * the surface g(d)·d: g·d − ∇ₛg (∇ₛ: the gradient along the sphere).
   */
  private undulation(amp: number, seed: number): Float32Array {
    const { A, P } = this;
    const w = waves(seed);
    const out = new Float32Array((P + 1) * (A + 1) * 4);
    let k = 0;
    for (let j = 0; j <= P; j++) {
      const phi = (Math.PI * j) / P;
      const cp = Math.cos(phi);
      const sp = Math.sin(phi);
      for (let a = 0; a <= A; a++) {
        const dx = cp;
        const dy = sp * (this.cos[a] ?? 1);
        const dz = sp * (this.sin[a] ?? 0);
        const qx = 2 * dx * dx - 1;
        let u = 0;
        let gx = 0;
        let gy = 0;
        let gz = 0;
        for (const { f, phase } of w) {
          const arg = f[0] * qx + f[1] * dy + f[2] * dz + phase;
          u += Math.sin(arg) / 3;
          const c = Math.cos(arg) / 3;
          gx += c * f[0] * 4 * dx;
          gy += c * f[1];
          gz += c * f[2];
        }
        const g = 1 - amp * (0.5 + 0.5 * u);
        // ∇ₛg = −½·amp·(∇u − (∇u·d)·d); normal ∝ g·d − ∇ₛg.
        const dot = gx * dx + gy * dy + gz * dz;
        const h = 0.5 * amp;
        let nx = g * dx + h * (gx - dot * dx);
        let ny = g * dy + h * (gy - dot * dy);
        let nz = g * dz + h * (gz - dot * dz);
        const l = Math.hypot(nx, ny, nz) || 1;
        nx /= l;
        ny /= l;
        nz /= l;
        out[k] = g;
        out[k + 1] = nx;
        out[k + 2] = ny;
        out[k + 3] = nz;
        k += 4;
      }
    }
    return out;
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
      const table = this.table;
      if (table) {
        // Between two sampled polar angles (linear; the normals are normalised by the shader).
        const fj = (Math.min(Math.PI, Math.max(0, phi)) / Math.PI) * this.P;
        const j0 = Math.min(this.P - 1, Math.floor(fj));
        const t = fj - j0;
        const row0 = j0 * (A + 1) * 4;
        const row1 = row0 + (A + 1) * 4;
        for (let a = 0; a <= A; a++) {
          const i0 = row0 + 4 * a;
          const i1 = row1 + 4 * a;
          const g = (table[i0] ?? 1) + t * ((table[i1] ?? 1) - (table[i0] ?? 1));
          const c = this.cos[a] ?? 1;
          const s = this.sin[a] ?? 0;
          pos[k] = cx + radius * g * cp;
          pos[k + 1] = rr * g * c;
          pos[k + 2] = rr * g * s;
          for (let m = 1; m <= 3; m++) {
            const n0 = table[i0 + m] ?? 0;
            nor[k + m - 1] = n0 + t * ((table[i1 + m] ?? 0) - n0);
          }
          k += 3;
        }
        continue;
      }
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
    // The two circles' union fits a sphere of radius offset + radius about the middle (the
    // undulation only goes inwards).
    const sphere = (this.geometry.boundingSphere ??= new THREE.Sphere());
    sphere.center.set(0, 0, 0);
    sphere.radius = offset + radius;
  }

  dispose(): void {
    this.geometry.dispose();
  }
}
