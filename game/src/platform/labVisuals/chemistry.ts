/*
 * Chemistry colours and vessel levels, pure numbers shared by the 3D bench renderers and any 2D
 * workspace (no three.js, no DOM). Drawings of the model's values, never measurements.
 */

import { PRECIPITATES } from '../../simulation/models/precipitation';

export type Rgb = readonly [number, number, number];
type Profile = readonly (readonly [r: number, y: number])[];

// ---- acid-base indicators ---------------------------------------------------------------------

/**
 * Indicators: the acid–base equilibrium HIn ⇌ H⁺ + In⁻, so the fraction in the base form at a pH
 * is 1/(1 + 10^(pK_In − pH)); pK_In ≈ 3.47 (methyl orange) and ≈ 9.4 (phenolphthalein), as in
 * standard indicator tables, whose visual ranges are 3.1–4.4 and 8.2–10. `acid` and `base` are
 * each form's transmittance (linear RGB) at the flask's few drops: the colour mixes as absorbance
 * does, T_acid^(1−f)·T_base^f, so phenolphthalein's 6 % at pH 8.2 already reads faint pink.
 */
export const INDICATORS = [
  { pK: 3.47, range: [3.1, 4.4], acid: [0.8, 0.04, 0.05], base: [0.95, 0.6, 0.02] },
  { pK: 9.4, range: [8.2, 10], acid: [1, 1, 1], base: [0.78, 0.03, 0.35] },
] as const;
export type Indicator = (typeof INDICATORS)[number];
/** The clear solutions' own tint. */
export const WATER: Rgb = [0.93, 0.96, 0.97];

/** The indicator whose colour change the endpoint pH sits in (or nearest to). */
export function indicatorFor(endpointPH: number): Indicator {
  const off = ({ range: [lo, hi] }: Indicator) => Math.max(lo - endpointPH, endpointPH - hi, 0);
  return INDICATORS.reduce((a, b) => (off(b) < off(a) ? b : a));
}

/** The base form's fraction at `pH`; none without a run (the acid alone, pH ≈ 1). */
export function baseFraction(indicator: Indicator, pH: number): number {
  return Number.isNaN(pH) ? 0 : 1 / (1 + 10 ** (indicator.pK - pH));
}

/** Transmittance per channel, mixed as absorbance: T_acid^(1-f)·T_base^f, through the water. */
export function indicatorTransmittance(
  indicator: Indicator,
  f: number,
  out: [number, number, number],
): void {
  const { acid: a, base: b } = indicator;
  out[0] = a[0] ** (1 - f) * b[0] ** f * WATER[0];
  out[1] = a[1] ** (1 - f) * b[1] ** f * WATER[1];
  out[2] = a[2] ** (1 - f) * b[2] ** f * WATER[2];
}

/**
 * Universal indicator by pH, 0-14 (sRGB): red through orange and yellow to green at 7, then blue
 * to violet. A guide to about 1 pH, as the charts sold with it (manufacturers' colours differ); the
 * drawing interpolates between whole pH values. Never a measurement: the model's pH drives it.
 */
export const INDICATOR_CHART = [
  '#c0152b',
  '#c9202b',
  '#d8382a',
  '#e65f2a',
  '#ee8a2a',
  '#f2b02f',
  '#efd33a',
  '#5aae45',
  '#2f9a74',
  '#2b7cb6',
  '#3657a8',
  '#4a3f9c',
  '#56308f',
  '#5b2784',
  '#58207a',
] as const;

/** Where `pH` falls on the chart: chip `i` and the fraction `t` towards chip i+1 (clamped to 0-14), written to `out`. */
export function chartPosition(pH: number, out: { i: number; t: number }): void {
  const x = Math.min(Math.max(pH, 0), 14);
  out.i = Math.min(Math.floor(x), 13);
  out.t = x - out.i;
}

// ---- crystal violet ---------------------------------------------------------------------------

export const CLEAR_TINT = '#dfeaf0';
export const CRYSTAL_VIOLET = '#6a1fa8';

/** The dye's depth 1 - T, T = 10^-A the light a cuvette lets through; none for no reading. */
export function violetDepth(absorbance: number): number {
  return Number.isFinite(absorbance) ? 1 - 10 ** -Math.max(absorbance, 0) : 0;
}

/** The liquid's opacity at a depth. */
export const violetOpacity = (depth: number): number => 0.3 + 0.6 * depth;

/** A precipitate's 0xRRGGBB by the model's product index (1-based into `PRECIPITATES`); none for 0. */
export function precipitateRgb(product: number): number | null {
  return PRECIPITATES[product - 1]?.rgb ?? null;
}

// ---- vessel levels ----------------------------------------------------------------------------

/** Height (m) of `ml` in a cone of bottom radius R, inward slope k per metre, drawn up to `max`. */
export function coneLevel(R: number, k: number, max: number, ml: number): number {
  const r = Math.cbrt(Math.max(R ** 3 - (3 * k * (ml > 0 ? ml : 0) * 1e-6) / Math.PI, 0));
  return Math.min((R - r) / k, max);
}

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

/** Where a profile's inside holds `ml`: the frustum solved for its height (clamped to the top), written to `out`. */
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

// ---- colour spaces ----------------------------------------------------------------------------

/** One sRGB channel (0-1) in linear light. */
export const srgbToLinear = (c: number): number =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

/** One linear channel (0-1) as sRGB, clamped. */
export function linearToSrgb(c: number): number {
  const x = Math.min(Math.max(c, 0), 1);
  return x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055;
}

/** A 0xRRGGBB or '#rrggbb' colour as linear RGB, written to `out`. */
export function hexToLinear(hex: number | string, out: [number, number, number]): void {
  const n = typeof hex === 'number' ? hex : parseInt(hex.slice(1), 16);
  out[0] = srgbToLinear(((n >> 16) & 255) / 255);
  out[1] = srgbToLinear(((n >> 8) & 255) / 255);
  out[2] = srgbToLinear((n & 255) / 255);
}

/** Linear RGB as a CSS '#rrggbb' (what a 2D drawing paints; the 3D renderer converts on output). */
export function linearCss(rgb: Rgb): string {
  const h = (c: number) => Math.round(linearToSrgb(c) * 255);
  return `#${((1 << 24) | (h(rgb[0]) << 16) | (h(rgb[1]) << 8) | h(rgb[2])).toString(16).slice(1)}`;
}

const linearOf = (hex: number | string): [number, number, number] => {
  const out: [number, number, number] = [0, 0, 0];
  hexToLinear(hex, out);
  return out;
};

/** The indicator's colour at `pH` through the flask's water: linear RGB written to `out`. */
export function indicatorTint(
  indicator: Indicator,
  pH: number,
  out: [number, number, number],
): void {
  indicatorTransmittance(indicator, baseFraction(indicator, pH), out);
}

const CLEAR_LINEAR = linearOf(CLEAR_TINT);
const VIOLET_LINEAR = linearOf(CRYSTAL_VIOLET);

/**
 * The dye's colour at absorbance A (linear RGB, the clear tint to violet by the depth 1 - 10^-A)
 * written to `out`; returns the liquid's opacity.
 */
export function violetLinear(absorbance: number, out: [number, number, number]): number {
  const depth = violetDepth(absorbance);
  for (let i = 0; i < 3; i++) {
    out[i] = (CLEAR_LINEAR[i] ?? 0) + ((VIOLET_LINEAR[i] ?? 0) - (CLEAR_LINEAR[i] ?? 0)) * depth;
  }
  return violetOpacity(depth);
}

const CHART_LINEAR = INDICATOR_CHART.map(linearOf);
const AT = { i: 0, t: 0 };

/** The universal indicator's colour at `pH` (clamped to the chart: a drawing clamp only), linear RGB. */
export function chartLinear(pH: number, out: [number, number, number]): void {
  chartPosition(pH, AT);
  const a = CHART_LINEAR[AT.i] ?? CLEAR_LINEAR;
  const b = CHART_LINEAR[AT.i + 1] ?? a;
  for (let i = 0; i < 3; i++) out[i] = (a[i] ?? 0) + ((b[i] ?? 0) - (a[i] ?? 0)) * AT.t;
}

/** The chart's colour family at `pH`, for a text name: 0 red, 1 orange, 2 yellow, 3 green, 4 blue, 5 violet. */
const CHART_FAMILY = [0, 0, 0, 1, 1, 1, 2, 3, 3, 4, 4, 5, 5, 5, 5] as const;
export function chartFamily(pH: number): number {
  chartPosition(pH, AT);
  return CHART_FAMILY[AT.t >= 0.5 ? Math.min(AT.i + 1, 14) : AT.i] ?? 0;
}

/** A precipitate's opacity in the liquid: the share of the test ion that has come out (0-100 %). */
export function precipitateOpacity(percent: number): number {
  return Number.isFinite(percent) ? (0.9 * Math.min(Math.max(percent, 0), 100)) / 100 : 0;
}

// ---- apparatus maps ---------------------------------------------------------------------------

/** A drop from a burette tip (mL). */
export const DROP_ML = 0.05;

/** What a burette's meniscus is drawn at: the mL delivered, none without a run (the 0 mark). */
export const deliveredShown = (ml: number): number => (ml > 0 ? ml : 0);

/** The 250 mL conical flask (outside, m): foot and neck radius, where the cone meets the neck, height, glass. */
export const CONICAL_FLASK_250 = {
  base: 0.0425,
  neck: 0.017,
  shoulder: 0.104,
  height: 0.14,
  wall: 0.0015,
};
/** Its liquid: a frustum inside the cone's wall, drawn at most up to `ref` (above what it holds here). */
export const CONICAL_LIQUID_250 = {
  radius: CONICAL_FLASK_250.base - CONICAL_FLASK_250.wall - 0.0004,
  slope:
    (CONICAL_FLASK_250.base - CONICAL_FLASK_250.neck) /
    (CONICAL_FLASK_250.shoulder - CONICAL_FLASK_250.wall),
  ref: 0.03,
};

/** Liquid height (m above the flask's inside bottom) of `ml` in the 250 mL conical flask. */
export function conicalFlaskLevel(ml: number): number {
  const { radius, slope, ref } = CONICAL_LIQUID_250;
  return coneLevel(radius, slope, ref, ml);
}

/**
 * What a timer of resolution d counts: whole steps of d while running (a stopwatch never runs
 * ahead), the nearest step once stopped; the time itself without a usable d.
 */
export function timerShown(t: number, d: number, running: boolean): number {
  const time = Number.isFinite(t) ? t : 0; // a reset timer reads 0
  if (!(d > 0)) return time;
  return (running ? Math.floor(time / d + 1e-9) : Math.round(time / d)) * d;
}

/** A column's height as a fraction of its scale (0-1) for `celsius` between `from` and `to`. */
export function thermometerFraction(celsius: number, from: number, to: number): number {
  return Number.isFinite(celsius) ? Math.min(Math.max((celsius - from) / (to - from), 0), 1) : 0;
}

// ---- volumetric flasks ------------------------------------------------------------------------

/** The glass of a volumetric flask (m). */
export const FLASK_GLASS = 0.0015;
const NECK_SHARE = 0.05; // the share of a flask's nominal volume above its shoulder: the mark sits in the neck
const NECK_ABOVE_MARK = 0.03;
/** A volumetric flask's bulb inside, bottom up, in units of its radius R; the neck closes at 2.25 R. */
const BULB: Profile = [
  [0.55, 0],
  [0.85, 0.15],
  [0.98, 0.45],
  [1, 0.75],
  [0.95, 1.1],
  [0.8, 1.45],
  [0.55, 1.8],
  [0.3, 2.05],
];
const SHOULDER = 2.25;

/** A volumetric flask: its inside (r, y) from its floor, and the mL held below each point. */
export interface Flask {
  readonly ml: number;
  /** The neck's inside radius. */
  readonly neck: number;
  /** The bulb's inside radius R. */
  readonly radius: number;
  /** The neck's top and the mark (where the inside holds `ml`), above the floor. */
  readonly top: number;
  readonly mark: number;
  /** The rim's height above the tile: where the stopper sits. */
  readonly rim: number;
  readonly profile: Profile;
  readonly held: Float64Array;
}

const inside = (R: number, neck: number, top: number): Profile => [
  ...BULB.map(([r, y]): readonly [number, number] => [r * R, y * R]),
  [neck, SHOULDER * R],
  [neck, top],
];

const FLASK_LEVEL = { y: 0, r: 0 };

/** The height (m above its floor) at which a flask holds `ml`. */
export function flaskLevel(flask: Flask, ml: number): number {
  levelIn(flask.profile, flask.held, ml, FLASK_LEVEL);
  return FLASK_LEVEL.y;
}

/** The flask of nominal `ml`: R such that bulb and shoulder hold (1 − NECK_SHARE)·ml. */
function flaskOf(ml: number, neck: number): Flask {
  const shoulderMl = (R: number) => heldBelow(inside(R, neck, SHOULDER * R + 1))[BULB.length] ?? 0;
  let lo = 0.005;
  let hi = 0.1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (shoulderMl(mid) < (1 - NECK_SHARE) * ml) lo = mid;
    else hi = mid;
  }
  const R = (lo + hi) / 2;
  const mark = SHOULDER * R + (NECK_SHARE * ml * 1e-6) / (Math.PI * neck * neck);
  const top = mark + NECK_ABOVE_MARK;
  const profile = inside(R, neck, top);
  const held = heldBelow(profile);
  levelIn(profile, held, ml, FLASK_LEVEL);
  return {
    ml,
    neck,
    radius: R,
    top,
    mark: FLASK_LEVEL.y,
    rim: top + FLASK_GLASS + 0.002,
    profile,
    held,
  };
}

/** The four volumetric flasks (necks of 9–14 mm inside diameter), smallest first. */
export const FLASKS: readonly [Flask, Flask, Flask, Flask] = [
  flaskOf(25, 0.0045),
  flaskOf(50, 0.005),
  flaskOf(100, 0.0055),
  flaskOf(250, 0.007),
];

// ---- the 250 mL beaker ------------------------------------------------------------------------

/** The 250 mL low-form beaker (m): outer radius, wall, height, base thickness. */
export const BEAKER_250 = { radius: 0.034, wall: 0.0016, height: 0.095, base: 0.0025 } as const;
/** kg/m³: a level is drawn from the water's mass. */
export const WATER_DENSITY = 1000;
/** Floating ice's share under water: its density (917 kg/m³) over water's. */
export const ICE_SUBMERGED = 917 / WATER_DENSITY;
const BEAKER_AREA = Math.PI * (BEAKER_250.radius - BEAKER_250.wall) ** 2;
/** The highest level the glass can show (a full beaker). */
const BEAKER_BRIM = BEAKER_250.height - BEAKER_250.base - 0.004;

/** The water's level above the beaker's inside bottom (m): its volume over the inside area. */
export const waterLevel = (waterKg: number): number =>
  Math.min(BEAKER_BRIM, waterKg / WATER_DENSITY / BEAKER_AREA);

/** The height (m) a pile of `iceKg` of ice makes in the beaker (917 kg/m³), at most the brim. */
export const iceHeight = (iceKg: number): number =>
  Math.min(BEAKER_BRIM, iceKg / 917 / BEAKER_AREA);

// ---- thermometer scales -----------------------------------------------------------------------

/** The laboratory thermometer of the heating curve: -30 to 110 °C. */
export const LAB_THERMOMETER = { low: -30, high: 110 };
/** The water bath's thermometer: 10 to 60 °C. */
export const BATH_THERMOMETER = { from: 10, to: 60 };

// ---- the solubility beaker --------------------------------------------------------------------

/** The water in the beaker (g) when no run exists to say: the definition's `waterMass`. */
export const WATER_MASS = 50;
/** Crystal densities (g/cm³) by the `solute` index: KNO₃, NaCl, KCl. */
export const DENSITY = [2.11, 2.17, 1.99] as const;
/** A poured bed's packing fraction (look only): bulk = m/(PACKING·ρ). */
export const PACKING = 0.6;
/** A dissolved salt's apparent volume in solution (mL per g): look only, the level's rise. */
export const APPARENT = 0.35;
/** The bed: 80 grains stand for the largest bed the dials allow (120 g of KCl, the least dense). */
export const BED_GRAINS = 80;
const BED_MAX = 120 / (PACKING * DENSITY[2]); // cm³

/** Grains drawn for a bed's bulk volume (cm³): at least one while any solid is left. */
export const bedGrains = (cm3: number): number =>
  cm3 > 0 ? Math.min(BED_GRAINS, Math.max(1, Math.round((BED_GRAINS * cm3) / BED_MAX))) : 0;

/** The bed's share (0-1) of the fullest one, for `grams` undissolved of the `solute` (an index): 0 where unknown. */
export const bedShare = (grams: number, solute: number): number => {
  const rho = DENSITY[solute];
  return rho === undefined ? 0 : bedGrains(grams / (PACKING * rho)) / BED_GRAINS;
};

/** The solution's level (m) over the beaker's floor: the water, the dissolved solid's apparent volume and the crystals' own. */
export function solutionLevel(
  waterG: number,
  dissolved: number,
  undissolved: number,
  solute: number,
): number {
  const rho = DENSITY[solute] ?? Number.NaN;
  const crystals = undissolved > 0 ? undissolved / rho : 0;
  return waterLevel(
    (waterG + (Number.isFinite(dissolved) ? APPARENT * dissolved : 0) + crystals) * 1e-3,
  );
}
