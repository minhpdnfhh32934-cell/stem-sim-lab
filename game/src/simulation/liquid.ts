/**
 * Liquid bookkeeping for the physical lab, pure: what a container holds, by material id, in
 * integer microlitres — sums stay exact for every sequence of transfers (no float drift), so a
 * source loses exactly what its receiver gains. A container stores which materials and how much,
 * never a concentration or any model value: a material's meaning is its experiment's (its `sets`,
 * its hidden inputs), read where a run's inputs are built. No rule lives here (when a transfer is
 * allowed is the station's: `StationSystem`); no overflow or spill exists (no spec defines one).
 */

/** Volume (integer µL) by material id; a material with nothing left is not listed. */
export type Contents = Record<string, number>;

/** A container's state (`GameState.world.containers`, saved); `StationSystem` is its only writer. */
export interface ContainerState {
  contents: Contents;
  /** °C: 20 unless a run sets it (no model does yet); never invented. */
  temperatureC: number;
  /** Its stopper or cap is in (closable containers only). */
  closed: boolean;
  /** Turned over while closed since liquid last went in: a fact a step may ask for, no reaction. */
  mixed: boolean;
}

export const UL_PER_ML = 1000;
/** The temperature containers start at: the lab's, at which volumetric glassware is calibrated. */
export const ROOM_TEMPERATURE_C = 20;

/** An integer volume in µL (≥ 0) from mL; throws for a value that is not one. */
export function toUl(ml: number): number {
  const ul = Math.round(ml * UL_PER_ML);
  if (!Number.isFinite(ml) || ml < 0 || Math.abs(ul - ml * UL_PER_ML) > 1e-6) {
    throw new Error(`${ml} mL is not a whole number of µL`);
  }
  return ul;
}

/** Total volume (µL). */
export function totalUl(contents: Readonly<Contents>): number {
  let total = 0;
  for (const id in contents) total += contents[id] ?? 0;
  return total;
}

/** A container holding `ul` µL of `material` (none when `ul` is 0), at room temperature, open. */
export function containerOf(material: string | null, ul: number): ContainerState {
  checkUl(ul, 'fill');
  return {
    contents: material !== null && ul > 0 ? { [material]: ul } : {},
    temperatureC: ROOM_TEMPERATURE_C,
    closed: false,
    mixed: false,
  };
}

function checkUl(value: number, what: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${what} must be a whole number of µL ≥ 0, got ${value}`);
  }
}

/**
 * Moves t = min(want, total(src), limit − total(dst)) µL from `src` to `dst` in place and returns
 * t. One material moves as itself; several are split in proportion to what `src` holds, by largest
 * remainder (ties to the smaller material id), so every material is conserved exactly too. The
 * split is bookkeeping, not mixing chemistry. Allocates nothing. Throws for a volume that is not
 * a whole number of µL ≥ 0.
 */
export function transfer(src: Contents, dst: Contents, wantUl: number, limitUl: number): number {
  checkUl(wantUl, 'want');
  checkUl(limitUl, 'limit');
  const total = totalUl(src);
  const t = Math.max(0, Math.min(wantUl, total, limitUl - totalUl(dst)));
  if (t === 0) return 0;
  // Each material's floor of v·t/T; the r µL left go one each to the largest remainders.
  let n = 0;
  let r = t;
  for (const id in src) {
    const vt = (src[id] ?? 0) * t; // ≤ 250,000² for the largest flask: exact in a double
    ids[n] = id;
    shares[n] = Math.floor(vt / total);
    remainders[n] = vt % total;
    r -= shares[n] ?? 0;
    n++;
  }
  for (; r > 0; r--) {
    let best = -1;
    for (let k = 0; k < n; k++) {
      const rem = remainders[k] ?? -1;
      const top = best < 0 ? -1 : (remainders[best] ?? -1);
      if (rem > top || (rem === top && rem >= 0 && (ids[k] ?? '') < (ids[best] ?? ''))) best = k;
    }
    shares[best] = (shares[best] ?? 0) + 1;
    remainders[best] = -1; // one extra µL each, at most
  }
  for (let k = 0; k < n; k++) move(src, dst, ids[k] ?? '', shares[k] ?? 0);
  return t;
}

// Scratch for `transfer`'s split, reused (a container holds a handful of materials).
const ids: string[] = [];
const shares: number[] = [];
const remainders: number[] = [];

function move(src: Contents, dst: Contents, id: string, ul: number): void {
  if (ul <= 0) return;
  const left = (src[id] ?? 0) - ul;
  if (left > 0) src[id] = left;
  else Reflect.deleteProperty(src, id);
  dst[id] = (dst[id] ?? 0) + ul;
}

// ---- vessel levels (moved here from platform/labVisuals/chemistry.ts) ------------------------

/** An inner lathe profile: [radius, height] (m) from the bottom up. */
export type Profile = readonly (readonly [number, number])[];

/** mL held below each point of a profile: frusta π·Δy/3·(r₀² + r₀r₁ + r₁²). */
export function heldBelow(profile: Profile): Float64Array {
  const held = new Float64Array(profile.length);
  for (let i = 1; i < profile.length; i++) {
    const [r0, y0] = profile[i - 1] ?? [0, 0];
    const [r1, y1] = profile[i] ?? [0, 0];
    held[i] =
      (held[i - 1] ?? 0) + ((Math.PI * (y1 - y0)) / 3) * (r0 * r0 + r0 * r1 + r1 * r1) * 1e6;
  }
  return held;
}

/**
 * Where a profile's inside holds `ml`: the frustum solved for its height (clamped to the top),
 * written to `out`. For an upright vessel; a tilted one is drawn from it only as an approximation.
 */
export function levelIn(
  profile: Profile,
  held: Float64Array,
  ml: number,
  out: { y: number; r: number },
): void {
  const [rTop, yTop] = profile[profile.length - 1] ?? [0, 0];
  for (let i = 0; i + 1 < profile.length; i++) {
    if (ml > (held[i + 1] ?? 0)) continue;
    const [r0, y0] = profile[i] ?? [0, 0];
    const [r1, y1] = profile[i + 1] ?? [0, 0];
    const dv = Math.max(ml - (held[i] ?? 0), 0) * 1e-6;
    const k = (r1 - r0) / (y1 - y0);
    const h =
      Math.abs(k) < 1e-9
        ? dv / (Math.PI * r0 * r0)
        : (Math.cbrt(r0 ** 3 + (3 * k * dv) / Math.PI) - r0) / k;
    out.y = y0 + h;
    out.r = r0 + k * h;
    return;
  }
  out.y = yTop;
  out.r = rTop;
}
