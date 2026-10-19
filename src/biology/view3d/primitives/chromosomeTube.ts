/**
 * A chromatid drawn as one smooth tube: rounded tips, arms of the model's lengths and a primary
 * constriction (narrower waist) at the centromere. Its centreline is written by the caller every
 * time the chromatid moves or condenses (no allocation: the buffers are made once), so a
 * decondensed thread can turn into a condensed rod in place. Colours are per segment along the
 * chromatid (one segment in mitosis; maternal/paternal pieces after a crossover in meiosis).
 *
 * Shape only — no banding pattern is drawn (bands would be invented anatomy). Sizes are
 * illustrative, not to scale.
 */
import * as THREE from 'three';

export interface TubeShape {
  /** Arm lengths from the centromere: arm A (u = 0 end) and arm B (u = 1 end). */
  armA: number;
  armB: number;
  /** Radius of a condensed arm. */
  radius: number;
  /** Vertices around the tube. */
  sides: number;
}

/** A coloured piece of the chromatid, as shares of its length from the arm A tip (0) to B (1). */
export interface ColourSegment {
  from: number;
  to: number;
  color: THREE.ColorRepresentation;
}

/** Waist at the centromere: radius share at its narrowest, and its half-width. */
export const CONSTRICTION = { depth: 0.38, halfWidth: 0.2 } as const;

/** Rings per unit length along an arm (between the tips and the waist). */
const RINGS_PER_UNIT = 7;
/** Rings across each rounded tip and across the waist. */
const TIP_RINGS = 6;
const WAIST_RINGS = 8;

/** Half-width of the waist (never more than 40 % of the shorter arm). */
function waistHalf(armA: number, armB: number): number {
  return Math.min(CONSTRICTION.halfWidth, 0.4 * Math.min(armA, armB));
}

/** Length of an arm's rounded tip (at most the radius, and it never reaches the waist). */
function tipLength(len: number, radius: number, w: number): number {
  return Math.max(1e-6, Math.min(radius, 0.45 * (len - w)));
}

/**
 * Where the rings sit along the chromatid, as signed distances from the centromere (−armA …
 * armB): close together over the rounded tips and the waist, evenly along the arms.
 */
export function ringStations(armA: number, armB: number, radius: number): Float32Array {
  const out: number[] = [];
  const w = waistHalf(armA, armB);
  const arm = (len: number, sign: -1 | 1) => {
    // From the waist edge (w) out to the tip (len): body rings, then the tip cap.
    const cap = tipLength(len, radius, w);
    const body = Math.max(0, len - w - cap);
    const n = Math.max(2, Math.ceil(body * RINGS_PER_UNIT));
    const pts: number[] = [];
    for (let i = 1; i <= n; i++) pts.push(w + (body * i) / n);
    for (let i = 1; i <= TIP_RINGS; i++) {
      const th = (Math.PI / 2) * (i / TIP_RINGS);
      pts.push(len - cap + cap * Math.sin(th));
    }
    return pts.map((d) => sign * d);
  };
  out.push(...arm(armA, -1).reverse());
  for (let i = 0; i <= WAIST_RINGS; i++) out.push(-w + (2 * w * i) / WAIST_RINGS);
  out.push(...arm(armB, 1));
  return Float32Array.from(out);
}

/**
 * Radius of a condensed chromatid at signed distance `s` from the centromere: full radius along
 * the arms, round tips (a hemisphere's profile) and the waist at the centromere. `waist` scales
 * the constriction (0 = none: a decondensed thread has no visible waist).
 */
export function rodRadius(
  s: number,
  armA: number,
  armB: number,
  radius: number,
  waist = 1,
): number {
  const w = waistHalf(armA, armB);
  const len = s < 0 ? armA : armB;
  const cap = tipLength(len, radius, w);
  const e = Math.min(1, Math.max(0, (len - Math.abs(s)) / cap));
  let r = radius * Math.sqrt(Math.max(0, 1 - (1 - e) * (1 - e)));
  const x = Math.min(1, Math.abs(s) / w);
  const smooth = x * x * (3 - 2 * x);
  r *= 1 - waist * CONSTRICTION.depth * (1 - smooth);
  return r;
}

export class ChromosomeTube {
  readonly geometry = new THREE.BufferGeometry();
  /** Signed distance of each ring from the centromere (static). */
  readonly stations: Float32Array;
  /** Index of the ring at the centromere. */
  readonly centromereRing: number;
  readonly rings: number;
  readonly sides: number;
  readonly shape: TubeShape;
  private readonly pos: THREE.BufferAttribute;
  private readonly nor: THREE.BufferAttribute;
  private readonly col: THREE.BufferAttribute;
  // Cosines and sines around the tube.
  private readonly around: Float32Array;

  constructor(shape: TubeShape) {
    this.shape = shape;
    this.sides = Math.max(3, Math.round(shape.sides));
    this.stations = ringStations(shape.armA, shape.armB, shape.radius);
    this.rings = this.stations.length;
    let c = 0;
    for (let i = 1; i < this.rings; i++)
      if (Math.abs(this.stations[i] ?? 0) < Math.abs(this.stations[c] ?? 0)) c = i;
    this.centromereRing = c;
    this.around = new Float32Array(2 * this.sides);
    for (let a = 0; a < this.sides; a++) {
      const phi = (2 * Math.PI * a) / this.sides;
      this.around[2 * a] = Math.cos(phi);
      this.around[2 * a + 1] = Math.sin(phi);
    }
    const n = this.rings * this.sides;
    this.pos = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
    this.nor = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
    this.col = new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3);
    this.pos.setUsage(THREE.DynamicDrawUsage);
    this.nor.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.pos);
    this.geometry.setAttribute('normal', this.nor);
    this.geometry.setAttribute('color', this.col);
    const index: number[] = [];
    const m = this.sides;
    for (let r = 0; r < this.rings - 1; r++) {
      for (let a = 0; a < m; a++) {
        const i0 = r * m + a;
        const i1 = r * m + ((a + 1) % m);
        const j0 = i0 + m;
        const j1 = i1 + m;
        // Counter-clockwise seen from outside (front faces point outwards).
        index.push(i0, i1, j0, i1, j1, j0);
      }
    }
    this.geometry.setIndex(index);
  }

  /** Share of the chromatid's length (0 = arm A tip, 1 = arm B tip) at ring `i`. */
  shareAt(i: number): number {
    const s = this.stations[i] ?? 0;
    const u = (s + this.shape.armA) / (this.shape.armA + this.shape.armB);
    return Math.min(1, Math.max(0, u));
  }

  /** Paints the chromatid piece by piece (rings outside every segment keep their colour). */
  setColours(segments: readonly ColourSegment[]): void {
    const c = new THREE.Color();
    const arr = this.col.array as Float32Array;
    for (let r = 0; r < this.rings; r++) {
      const u = this.shareAt(r);
      const seg = segments.find((g) => u >= g.from - 1e-9 && u <= g.to + 1e-9);
      if (!seg) continue;
      c.set(seg.color);
      for (let a = 0; a < this.sides; a++) {
        const k = 3 * (r * this.sides + a);
        arr[k] = c.r;
        arr[k + 1] = c.g;
        arr[k + 2] = c.b;
      }
    }
    this.col.needsUpdate = true;
  }

  /** Colour (r, g, b) of ring `i`. */
  colourAt(i: number): [number, number, number] {
    const arr = this.col.array as Float32Array;
    const k = 3 * i * this.sides;
    return [arr[k] ?? 0, arr[k + 1] ?? 0, arr[k + 2] ?? 0];
  }

  /**
   * Writes the tube around a centreline: `centre` holds one point per ring (x, y, z), `radii` one
   * radius per ring. Frames are carried along the line (no twisting); normals follow the radius
   * changes (round tips, waist).
   */
  write(centre: ArrayLike<number>, radii: ArrayLike<number>): void {
    const p = this.pos.array as Float32Array;
    const nn = this.nor.array as Float32Array;
    const m = this.sides;
    const R = this.rings;
    const around = this.around;
    // Frame carried from ring to ring: tangent (t) and normal (n).
    let tx = 1;
    let ty = 0;
    let tz = 0;
    let nx = 0;
    let ny = 1;
    let nz = 0;
    for (let r = 0; r < R; r++) {
      const a = r > 0 ? r - 1 : 0;
      const b = r < R - 1 ? r + 1 : R - 1;
      const dx = (centre[3 * b] as number) - (centre[3 * a] as number);
      const dy = (centre[3 * b + 1] as number) - (centre[3 * a + 1] as number);
      const dz = (centre[3 * b + 2] as number) - (centre[3 * a + 2] as number);
      const tl = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (tl > 1e-9) {
        tx = dx / tl;
        ty = dy / tl;
        tz = dz / tl;
      }
      if (r === 0) {
        // Any direction across the tangent: start from the axis it leans on least.
        const ax = Math.abs(tx) < 0.9 ? 1 : 0;
        const ay = 1 - ax;
        nx = ay * tz;
        ny = -ax * tz;
        nz = ax * ty - ay * tx;
      }
      // The previous normal, made perpendicular to the new tangent (parallel transport).
      const d = nx * tx + ny * ty + nz * tz;
      nx -= d * tx;
      ny -= d * ty;
      nz -= d * tz;
      let nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (nl < 1e-9) {
        // The line turned onto the old normal: pick a fresh one.
        const ax = Math.abs(tx) < 0.9 ? 1 : 0;
        const ay = 1 - ax;
        nx = ay * tz;
        ny = -ax * tz;
        nz = ax * ty - ay * tx;
        nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      }
      nx /= nl;
      ny /= nl;
      nz /= nl;
      const bx = ty * nz - tz * ny;
      const by = tz * nx - tx * nz;
      const bz = tx * ny - ty * nx;
      // Radius slope along the line: normals lean along the tangent where the tube narrows.
      // The radial direction is a unit vector across t, so |radial − slope·t| = √(1 + slope²).
      const span = tl > 1e-6 ? tl : 1e-6;
      let slope = ((radii[b] as number) - (radii[a] as number)) / span;
      slope = slope > 12 ? 12 : slope < -12 ? -12 : slope;
      const inv = 1 / Math.sqrt(1 + slope * slope);
      const st = slope * inv;
      const rad = radii[r] as number;
      const cx = centre[3 * r] as number;
      const cy = centre[3 * r + 1] as number;
      const cz = centre[3 * r + 2] as number;
      let k = 3 * r * m;
      for (let s = 0; s < m; s++) {
        const co = around[2 * s] as number;
        const si = around[2 * s + 1] as number;
        const rx = co * nx + si * bx;
        const ry = co * ny + si * by;
        const rz = co * nz + si * bz;
        p[k] = cx + rad * rx;
        p[k + 1] = cy + rad * ry;
        p[k + 2] = cz + rad * rz;
        nn[k] = rx * inv - st * tx;
        nn[k + 1] = ry * inv - st * ty;
        nn[k + 2] = rz * inv - st * tz;
        k += 3;
      }
    }
    this.pos.needsUpdate = true;
    this.nor.needsUpdate = true;
    // Measured again only when a ray needs it (picking), not on every write.
    this.geometry.boundingSphere = null;
  }

  /** Ring of a triangle (`faceIndex` of a ray hit). */
  ringOfFace(face: number): number {
    return Math.min(this.rings - 1, Math.floor(face / (2 * this.sides)));
  }

  dispose(): void {
    this.geometry.dispose();
  }
}
