/**
 * A continuous backbone tube through a strand's backbone points (one point per nucleotide, from
 * each view's layout): a uniform Catmull–Rom spline through the points, swept by a ring of
 * `radial` sides, `sub` rings per gap between two points. The points are the model's positions;
 * the tube only joins them smoothly (illustration). Rounded tips close the strand's ends.
 *
 * Built for moving strands without allocating: the buffers are sized once for `capacity` points,
 * `build(a, b)` rewrites only the rings of segments [a, b) (and uploads only those), and
 * `show(a, b)` draws a range of segments. A second geometry can share the same buffers with its
 * own draw range (`twin()`), so two meshes can draw two parts of one tube (each turned by its
 * own rotation).
 *
 * Ring frames do not twist: each ring's normal is the direction away from an axis along x (a
 * helix) or the projection of +y (a strand along a line), never the Frenet frame (which flips on
 * straight stretches). Two tubes that share a point with the same neighbours meet without a seam.
 */
import * as THREE from 'three';
import type { Vec3 } from './layout';

export interface StrandTubeOptions {
  /** Most points (nucleotides) the tube holds. */
  capacity: number;
  radius: number;
  /** Rings per gap between two points. */
  sub: number;
  /** Sides of each ring. */
  radial: number;
  /** Ring normals point away from this axis (a line along x at y, z); null: towards +y. */
  axis: { y: number; z: number } | null;
}

/** Share of the end segment the rounded tip takes. */
const TIP = 0.42;

export class StrandTube {
  readonly geometry: THREE.BufferGeometry;
  readonly capacity: number;
  /** Points in use (0 … count − 1); the tube runs through them. */
  count = 0;
  /** Rounded tips at the first / last point in use. */
  caps = { start: true, end: true };
  private readonly o: StrandTubeOptions;
  /** Points −1 … capacity (the two ghosts give the end tangents), xyz. */
  private readonly pts: Float32Array;
  private readonly pos: THREE.BufferAttribute;
  private readonly nor: THREE.BufferAttribute;
  private readonly cos: Float32Array;
  private readonly sin: Float32Array;
  private readonly ring: number;
  private readonly twins: THREE.BufferGeometry[] = [];

  constructor(o: StrandTubeOptions) {
    this.o = o;
    this.capacity = Math.max(2, Math.floor(o.capacity));
    const rings = (this.capacity - 1) * o.sub + 1;
    this.ring = o.radial + 1;
    this.pts = new Float32Array((this.capacity + 2) * 3);
    const g = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(rings * this.ring * 3), 3);
    this.nor = new THREE.BufferAttribute(new Float32Array(rings * this.ring * 3), 3);
    this.pos.setUsage(THREE.DynamicDrawUsage);
    this.nor.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.pos);
    g.setAttribute('normal', this.nor);
    // Faces in three.js's TubeGeometry order (outward winding); one segment's faces are
    // contiguous, so a draw range selects whole segments.
    const quads = (rings - 1) * o.radial;
    const index =
      rings * this.ring > 65535 ? new Uint32Array(quads * 6) : new Uint16Array(quads * 6);
    let k = 0;
    for (let r = 1; r < rings; r++)
      for (let j = 1; j <= o.radial; j++) {
        const a = this.ring * (r - 1) + (j - 1);
        const b = this.ring * r + (j - 1);
        const c = this.ring * r + j;
        const d = this.ring * (r - 1) + j;
        index[k++] = a;
        index[k++] = b;
        index[k++] = d;
        index[k++] = b;
        index[k++] = c;
        index[k++] = d;
      }
    g.setIndex(new THREE.BufferAttribute(index, 1));
    g.setDrawRange(0, 0);
    this.geometry = g;
    this.cos = new Float32Array(this.ring);
    this.sin = new Float32Array(this.ring);
    for (let j = 0; j < this.ring; j++) {
      const v = (j / o.radial) * Math.PI * 2;
      this.sin[j] = Math.sin(v);
      this.cos[j] = -Math.cos(v);
    }
  }

  /** Point k (−1 and `count` are the ghosts that give the end tangents). */
  set(k: number, p: Readonly<Vec3>): void {
    const i = (k + 1) * 3;
    if (k < -1 || i + 2 >= this.pts.length) return;
    this.pts[i] = p[0];
    this.pts[i + 1] = p[1];
    this.pts[i + 2] = p[2];
  }

  /** The ghost before the first point, mirrored through it (a tube that simply starts there). */
  extrapolateStart(): void {
    if (this.count < 2) return;
    const p = this.pts;
    for (let c = 0; c < 3; c++) p[c] = 2 * (p[3 + c] ?? 0) - (p[6 + c] ?? 0);
  }

  /** The ghost after the last point, mirrored through it (a tube that simply stops there). */
  extrapolateEnd(): void {
    const n = this.count;
    if (n < 2) return;
    const p = this.pts;
    for (let c = 0; c < 3; c++)
      p[(n + 1) * 3 + c] = 2 * (p[n * 3 + c] ?? 0) - (p[(n - 1) * 3 + c] ?? 0);
  }

  /** A geometry drawing the same buffers with its own draw range (freed by its owner too). */
  twin(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', this.pos);
    g.setAttribute('normal', this.nor);
    g.setIndex(this.geometry.getIndex());
    g.setDrawRange(0, 0);
    this.twins.push(g);
    return g;
  }

  /** Draws segments [a, b) (segment k joins point k and k + 1) of `g` (default: own geometry). */
  show(a: number, b: number, g: THREE.BufferGeometry = this.geometry): void {
    const lo = Math.max(0, Math.min(this.count - 1, Math.floor(a)));
    const hi = Math.max(lo, Math.min(this.count - 1, Math.floor(b)));
    const per = this.o.sub * this.o.radial * 6;
    g.setDrawRange(lo * per, (hi - lo) * per);
  }

  /** Rewrites the rings of segments [a, b) from the points (only those are uploaded). */
  build(a = 0, b = this.count - 1): void {
    const lo = Math.max(0, Math.floor(a));
    const hi = Math.min(this.count - 1, Math.floor(b));
    if (hi <= lo) return;
    const { sub, radius, axis } = this.o;
    const p = this.pts;
    const pos = this.pos.array as Float32Array;
    const nor = this.nor.array as Float32Array;
    const last = this.count - 2;
    for (let k = lo; k < hi; k++) {
      // Control points k − 1 … k + 2 (stored one place up).
      const i0 = k * 3;
      const i1 = i0 + 3;
      const i2 = i0 + 6;
      const i3 = i0 + 9;
      const end = k === last;
      for (let s = 0; s <= (end ? sub : sub - 1); s++) {
        const u = s / sub;
        const u2 = u * u;
        const u3 = u2 * u;
        let px = 0;
        let py = 0;
        let pz = 0;
        let tx = 0;
        let ty = 0;
        let tz = 0;
        for (let c = 0; c < 3; c++) {
          const q0 = p[i0 + c] ?? 0;
          const q1 = p[i1 + c] ?? 0;
          const q2 = p[i2 + c] ?? 0;
          const q3 = p[i3 + c] ?? 0;
          const b1 = -q0 + q2;
          const b2 = 2 * q0 - 5 * q1 + 4 * q2 - q3;
          const b3 = -q0 + 3 * q1 - 3 * q2 + q3;
          const v = 0.5 * (2 * q1 + b1 * u + b2 * u2 + b3 * u3);
          const d = 0.5 * (b1 + 2 * b2 * u + 3 * b3 * u2);
          if (c === 0) {
            px = v;
            tx = d;
          } else if (c === 1) {
            py = v;
            ty = d;
          } else {
            pz = v;
            tz = d;
          }
        }
        let tl = Math.hypot(tx, ty, tz) || 1;
        tx /= tl;
        ty /= tl;
        tz /= tl;
        // Normal: away from the axis (or +y), made perpendicular to the tangent.
        let rx = 0;
        let ry = axis ? py - axis.y : 1;
        let rz = axis ? pz - axis.z : 0;
        if (Math.hypot(ry, rz) < 1e-6) {
          ry = 1;
          rz = 0;
        }
        let dot = rx * tx + ry * ty + rz * tz;
        rx -= dot * tx;
        ry -= dot * ty;
        rz -= dot * tz;
        tl = Math.hypot(rx, ry, rz);
        if (tl < 1e-6) {
          // Tangent along the reference: use z instead.
          rx = 0;
          ry = 0;
          rz = 1;
          dot = tz;
          rx -= dot * tx;
          ry -= dot * ty;
          rz -= dot * tz;
          tl = Math.hypot(rx, ry, rz) || 1;
        }
        const nx = rx / tl;
        const ny = ry / tl;
        const nz = rz / tl;
        // B = T × N.
        const bx = ty * nz - tz * ny;
        const by = tz * nx - tx * nz;
        const bz = tx * ny - ty * nx;
        // Rounded tips: the radius closes to 0 at the strand's first / last point.
        let f = 1;
        let lean = 0;
        if (this.caps.start && k === 0 && u < TIP) {
          const w = (TIP - u) / TIP;
          f = Math.sqrt(Math.max(0, 1 - w * w));
          lean = -(1 - f);
        } else if (this.caps.end && end && u > 1 - TIP) {
          const w = (u - (1 - TIP)) / TIP;
          f = Math.sqrt(Math.max(0, 1 - w * w));
          lean = 1 - f;
        }
        const r = radius * f;
        let v = (k * sub + s) * this.ring * 3;
        for (let j = 0; j < this.ring; j++) {
          const cs = this.cos[j] ?? 0;
          const sn = this.sin[j] ?? 0;
          let ox = cs * nx + sn * bx;
          let oy = cs * ny + sn * by;
          let oz = cs * nz + sn * bz;
          pos[v] = px + r * ox;
          pos[v + 1] = py + r * oy;
          pos[v + 2] = pz + r * oz;
          if (lean !== 0) {
            ox = ox * f + tx * lean;
            oy = oy * f + ty * lean;
            oz = oz * f + tz * lean;
            const l = Math.hypot(ox, oy, oz) || 1;
            ox /= l;
            oy /= l;
            oz /= l;
          }
          nor[v] = ox;
          nor[v + 1] = oy;
          nor[v + 2] = oz;
          v += 3;
        }
      }
    }
    const from = lo * sub * this.ring * 3;
    const to = (hi === this.count - 1 ? hi * sub + 1 : hi * sub) * this.ring * 3;
    this.pos.addUpdateRange(from, to - from);
    this.nor.addUpdateRange(from, to - from);
    this.pos.needsUpdate = true;
    this.nor.needsUpdate = true;
    for (const g of [this.geometry, ...this.twins]) {
      g.boundingSphere = null;
      g.boundingBox = null;
    }
  }
}

/** Rings per segment and sides per ring of a tier (long windows draw coarser tubes). */
export function tubeDetail(
  tier: 'low' | 'medium' | 'high',
  points: number,
): {
  sub: number;
  radial: number;
} {
  const high = tier === 'high';
  const sub = points > 400 ? 3 : high ? 6 : 4;
  return { sub, radial: high ? 12 : 8 };
}
