/**
 * Where everything of the enzyme 3D view stands (pure maths, scene units, y up): a glass
 * reaction volume (a box centred on the origin) holding the ENZYMES_DRAWN enzymes on a jittered
 * 6 × 2 × 2 grid, their active sites turned roughly towards the viewer, and two pools of
 * particle places (substrate/product, inhibitor) clear of the enzymes.
 *
 * Every size, place, shape and the particles' drift is illustration (seeded, the same on every
 * machine and tier); no length here carries a number of the model.
 */
import { rng } from '../../genetics/stats';
import { ENZYMES_DRAWN, PARTICLE_CAP } from './binding';

export type Vec3 = [number, number, number];

export const LAYOUT = {
  /** Half sizes of the reaction volume. */
  hx: 8.4,
  hy: 4.2,
  hz: 4.2,
  /** Enzyme radius (the blob's size before its squash and lumps, which add up to 20 %). */
  enzymeR: 0.8,
  /** Radius of a substrate, product or inhibitor particle. */
  particleR: 0.27,
  /** Active-site pocket: half-angle (rad) and depth (fraction of the radius). */
  notchHalf: 0.46,
  notchDepth: 0.36,
  /** Illustrative drift of a free particle around its place (scene units). */
  drift: 0.15,
} as const;

const L = LAYOUT;

const unit = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

/**
 * Direction of the second binding site ("vị trí khác"), in the enzyme's own frame where the
 * active site points along +y: on the side, away from the active site.
 */
export const ALLO_DIR: Vec3 = unit([-0.95, -0.2, 0.25]);

export interface EnzymePlace {
  center: Vec3;
  /** Unit direction of the active site in the scene. */
  site: Vec3;
  /** Turn about the active site's axis (rad): the lumps differ from enzyme to enzyme. */
  spin: number;
}

/** Places of the drawn enzymes (index = enzyme number − 1). */
export const ENZYME_PLACES: readonly EnzymePlace[] = (() => {
  const rand = rng(424242);
  const jit = () => rand() * 2 - 1;
  const out: EnzymePlace[] = [];
  for (let k = 0; k < ENZYMES_DRAWN; k++) {
    const i = k % 6;
    const j = Math.floor(k / 6) % 2;
    const z = Math.floor(k / 12) % 2;
    const center: Vec3 = [
      -6.75 + i * 2.7 + 0.15 * jit(),
      (j === 0 ? -2.1 : 2.1) + 0.5 * jit(),
      (z === 0 ? 2.1 : -2.1) + 0.4 * jit(),
    ];
    // Up and towards the viewer, tilted at random: the camera (front, above) looks into the
    // pocket at an angle, so its rim and hollow show.
    const site = unit([0.8 * jit(), 1 + 0.4 * jit(), 0.9]);
    out.push({ center, site, spin: rand() * Math.PI * 2 });
  }
  return out;
})();

/** Closest a particle's place comes to an enzyme's centre. */
const CLEAR = L.enzymeR * 1.2 + L.particleR + L.drift * Math.sqrt(3) + 0.03;

function pool(seed: number): Vec3[] {
  const rand = rng(seed);
  const m = L.particleR + L.drift + 0.12;
  const out: Vec3[] = [];
  let tries = 0;
  while (out.length < PARTICLE_CAP) {
    tries++;
    const p: Vec3 = [
      (rand() * 2 - 1) * (L.hx - m),
      (rand() * 2 - 1) * (L.hy - m),
      (rand() * 2 - 1) * (L.hz - m),
    ];
    // After many tries (never in practice) the last places may come closer to an enzyme.
    const clear =
      tries > 200_000 ||
      ENZYME_PLACES.every(
        (e) => Math.hypot(p[0] - e.center[0], p[1] - e.center[1], p[2] - e.center[2]) >= CLEAR,
      );
    if (clear) out.push(p);
  }
  return out;
}

/** Places of the substrate/product pool (the k-th place turns from S into P in the time view). */
export const SP_PLACES: readonly Vec3[] = pool(7);
/** Places of the inhibitor pool. */
export const I_PLACES: readonly Vec3[] = pool(13);

/** Per-particle drift frequencies and phases (seeded, illustration). */
function driftOf(seed: number): Float32Array {
  const rand = rng(seed);
  const out = new Float32Array(PARTICLE_CAP * 6);
  for (let i = 0; i < out.length; i += 6) {
    for (let a = 0; a < 3; a++) {
      out[i + a] = 0.6 + rand() * 0.9;
      out[i + 3 + a] = rand() * Math.PI * 2;
    }
  }
  return out;
}
const SP_DRIFT = driftOf(71);
const I_DRIFT = driftOf(131);

/** Where the k-th particle of a pool is at drift phase `phase` (writes `out`, no allocation). */
export function particleAt(which: 'sp' | 'i', k: number, phase: number, out: Vec3): Vec3 {
  const base = (which === 'sp' ? SP_PLACES : I_PLACES)[k] ?? [0, 0, 0];
  const d = which === 'sp' ? SP_DRIFT : I_DRIFT;
  const o = k * 6;
  for (let a = 0; a < 3; a++) {
    const f = d[o + a] ?? 1;
    const ph = d[o + 3 + a] ?? 0;
    out[a] = (base[a] ?? 0) + L.drift * (Math.sin(f * phase + ph) - Math.sin(ph));
  }
  return out;
}

/** Corners of the reaction volume (camera framing). */
export function boxCorners(): Vec3[] {
  const out: Vec3[] = [];
  for (const x of [-L.hx, L.hx])
    for (const y of [-L.hy, L.hy]) for (const z of [-L.hz, L.hz]) out.push([x, y, z]);
  return out;
}
