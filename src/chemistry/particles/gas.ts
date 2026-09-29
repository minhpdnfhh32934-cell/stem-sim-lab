/**
 * Two-dimensional hard-disk gas (reduced units: particle mass m = 1, k_B·T = 1 at the
 * target temperature, lengths in disk diameters). Collisions are elastic, so total kinetic
 * energy and momentum are conserved; the speed distribution relaxes to the 2D
 * Maxwell–Boltzmann law f(v) = (v/σ²)·exp(−v²/2σ²), σ² = k_BT/m.
 *
 * Optional reaction A + B → C + D (and C + D → A + B when reversible) happens on a
 * collision when the relative kinetic energy along the line of centres is ≥ Eₐ
 * (line-of-centres model). Masses are equal and the reaction is thermoneutral, so the
 * dynamics stay exactly elastic.
 */

export const TYPE_A = 0;
export const TYPE_B = 1;
export const TYPE_C = 2;
export const TYPE_D = 3;

/** Deterministic PRNG (mulberry32) so runs and tests are reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GasOptions {
  n: number;
  /** Box side in disk diameters. */
  box: number;
  seed?: number;
  /** 'maxwell' samples the equilibrium distribution; 'equal' gives every particle speed √2. */
  start?: 'maxwell' | 'equal';
  /** Fraction of particles of type B (the rest are A). */
  fractionB?: number;
  /** Activation energy in units of k_BT; null = no reaction. */
  ea?: number | null;
  reversible?: boolean;
}

export class Gas2D {
  readonly n: number;
  readonly box: number;
  readonly radius = 0.5;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly vx: Float64Array;
  readonly vy: Float64Array;
  readonly type: Uint8Array;
  ea: number | null;
  reversible: boolean;
  time = 0;
  /** Reactive-pair collisions (A–B, plus C–D when reversible) and how many had E ≥ Eₐ. */
  pairCollisions = 0;
  energeticCollisions = 0;
  reactions = 0;
  private readonly cellSize: number;
  private readonly cells: number;
  private readonly head: Int32Array;
  private readonly next: Int32Array;

  constructor(o: GasOptions) {
    this.n = o.n;
    this.box = o.box;
    this.ea = o.ea ?? null;
    this.reversible = o.reversible ?? false;
    this.x = new Float64Array(o.n);
    this.y = new Float64Array(o.n);
    this.vx = new Float64Array(o.n);
    this.vy = new Float64Array(o.n);
    this.type = new Uint8Array(o.n);
    this.cellSize = 1;
    this.cells = Math.max(1, Math.floor(o.box / this.cellSize));
    this.head = new Int32Array(this.cells * this.cells);
    this.next = new Int32Array(o.n);
    const rand = rng(o.seed ?? 1);
    // Jittered lattice start (no overlaps).
    const per = Math.ceil(Math.sqrt(o.n));
    const spacing = o.box / per;
    if (spacing < 1.05) throw new RangeError('box too small for the number of disks');
    for (let i = 0; i < o.n; i++) {
      const gx = i % per;
      const gy = Math.floor(i / per);
      const j = (spacing - 1.02) / 2;
      this.x[i] = (gx + 0.5) * spacing + (rand() * 2 - 1) * j;
      this.y[i] = (gy + 0.5) * spacing + (rand() * 2 - 1) * j;
      this.type[i] = rand() < (o.fractionB ?? 0) ? TYPE_B : TYPE_A;
      if (o.start === 'equal') {
        const a = rand() * 2 * Math.PI;
        this.vx[i] = Math.SQRT2 * Math.cos(a);
        this.vy[i] = Math.SQRT2 * Math.sin(a);
      } else {
        // Box–Muller: each velocity component ~ N(0, 1) (k_BT/m = 1).
        const u = Math.max(1e-12, rand());
        const v = rand();
        const r = Math.sqrt(-2 * Math.log(u));
        this.vx[i] = r * Math.cos(2 * Math.PI * v);
        this.vy[i] = r * Math.sin(2 * Math.PI * v);
      }
    }
    // Zero net momentum, then scale so that the kinetic temperature is exactly 1.
    let px = 0;
    let py = 0;
    for (let i = 0; i < o.n; i++) {
      px += this.vx[i] ?? 0;
      py += this.vy[i] ?? 0;
    }
    for (let i = 0; i < o.n; i++) {
      this.vx[i] = (this.vx[i] ?? 0) - px / o.n;
      this.vy[i] = (this.vy[i] ?? 0) - py / o.n;
    }
    const s = Math.sqrt(1 / this.temperature());
    for (let i = 0; i < o.n; i++) {
      this.vx[i] = (this.vx[i] ?? 0) * s;
      this.vy[i] = (this.vy[i] ?? 0) * s;
    }
  }

  /** Total kinetic energy (m = 1). */
  kineticEnergy(): number {
    let e = 0;
    for (let i = 0; i < this.n; i++) e += 0.5 * ((this.vx[i] ?? 0) ** 2 + (this.vy[i] ?? 0) ** 2);
    return e;
  }

  /** Kinetic temperature in 2D: ⟨E_k⟩ = k_BT (two degrees of freedom). */
  temperature(): number {
    return this.kineticEnergy() / this.n;
  }

  speed(i: number): number {
    return Math.hypot(this.vx[i] ?? 0, this.vy[i] ?? 0);
  }

  count(t: number): number {
    let c = 0;
    for (let i = 0; i < this.n; i++) if (this.type[i] === t) c++;
    return c;
  }

  /** Advances by `dt` (reduced time), splitting into sub-steps so no disk moves > 0.2 diameters. */
  advance(dt: number): void {
    let vmax = 0;
    for (let i = 0; i < this.n; i++) vmax = Math.max(vmax, this.speed(i));
    const sub = Math.max(1, Math.ceil((dt * vmax) / 0.2));
    const h = dt / sub;
    for (let s = 0; s < sub; s++) this.step(h);
  }

  private step(h: number): void {
    const { n, box, radius } = this;
    const x = this.x;
    const y = this.y;
    const vx = this.vx;
    const vy = this.vy;
    for (let i = 0; i < n; i++) {
      let xi = (x[i] ?? 0) + (vx[i] ?? 0) * h;
      let yi = (y[i] ?? 0) + (vy[i] ?? 0) * h;
      // Specular reflection at the walls.
      if (xi < radius) {
        xi = 2 * radius - xi;
        vx[i] = Math.abs(vx[i] ?? 0);
      } else if (xi > box - radius) {
        xi = 2 * (box - radius) - xi;
        vx[i] = -Math.abs(vx[i] ?? 0);
      }
      if (yi < radius) {
        yi = 2 * radius - yi;
        vy[i] = Math.abs(vy[i] ?? 0);
      } else if (yi > box - radius) {
        yi = 2 * (box - radius) - yi;
        vy[i] = -Math.abs(vy[i] ?? 0);
      }
      x[i] = xi;
      y[i] = yi;
    }
    // Cell list
    const cells = this.cells;
    this.head.fill(-1);
    const cellOf = (v: number) => Math.min(cells - 1, Math.max(0, Math.floor(v / (box / cells))));
    for (let i = 0; i < n; i++) {
      const c = cellOf(y[i] ?? 0) * cells + cellOf(x[i] ?? 0);
      this.next[i] = this.head[c] ?? -1;
      this.head[c] = i;
    }
    for (let cy = 0; cy < cells; cy++) {
      for (let cx = 0; cx < cells; cx++) {
        for (let i = this.head[cy * cells + cx] ?? -1; i >= 0; i = this.next[i] ?? -1) {
          for (let dy = -1; dy <= 1; dy++) {
            const ny = cy + dy;
            if (ny < 0 || ny >= cells) continue;
            for (let dx = -1; dx <= 1; dx++) {
              const nx = cx + dx;
              if (nx < 0 || nx >= cells) continue;
              for (let j = this.head[ny * cells + nx] ?? -1; j >= 0; j = this.next[j] ?? -1) {
                if (j <= i) continue;
                this.collide(i, j);
              }
            }
          }
        }
      }
    }
    this.time += h;
  }

  private collide(i: number, j: number): void {
    const dx = (this.x[j] ?? 0) - (this.x[i] ?? 0);
    const dy = (this.y[j] ?? 0) - (this.y[i] ?? 0);
    const d2 = dx * dx + dy * dy;
    if (d2 >= 1 || d2 === 0) return; // diameter = 1
    const d = Math.sqrt(d2);
    const nx = dx / d;
    const ny = dy / d;
    const un =
      ((this.vx[j] ?? 0) - (this.vx[i] ?? 0)) * nx + ((this.vy[j] ?? 0) - (this.vy[i] ?? 0)) * ny;
    if (un >= 0) return; // already separating
    // Equal masses: exchange the normal velocity components (elastic).
    this.vx[i] = (this.vx[i] ?? 0) + un * nx;
    this.vy[i] = (this.vy[i] ?? 0) + un * ny;
    this.vx[j] = (this.vx[j] ?? 0) - un * nx;
    this.vy[j] = (this.vy[j] ?? 0) - un * ny;
    if (this.ea === null) return;
    const ti = this.type[i] ?? 0;
    const tj = this.type[j] ?? 0;
    const forward = (ti === TYPE_A && tj === TYPE_B) || (ti === TYPE_B && tj === TYPE_A);
    const backward =
      this.reversible && ((ti === TYPE_C && tj === TYPE_D) || (ti === TYPE_D && tj === TYPE_C));
    if (!forward && !backward) return;
    this.pairCollisions++;
    // Relative kinetic energy along the line of centres: ½·μ·u_n², μ = m/2.
    const en = 0.25 * un * un;
    if (en >= this.ea) {
      this.energeticCollisions++;
      this.reactions++;
      const map = [TYPE_C, TYPE_D, TYPE_A, TYPE_B];
      this.type[i] = map[ti] ?? ti;
      this.type[j] = map[tj] ?? tj;
    }
  }
}

/** 2D Maxwell–Boltzmann speed density with σ² = k_BT/m. */
export function mb2d(v: number, sigma2 = 1): number {
  return (v / sigma2) * Math.exp((-v * v) / (2 * sigma2));
}

/** 3D Maxwell–Boltzmann speed density (textbook form) with σ² = k_BT/m. */
export function mb3d(v: number, sigma2 = 1): number {
  return Math.sqrt(2 / Math.PI) * ((v * v) / sigma2 ** 1.5) * Math.exp((-v * v) / (2 * sigma2));
}
