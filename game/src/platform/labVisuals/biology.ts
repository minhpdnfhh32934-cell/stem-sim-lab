import { offspringGenotype } from '../../simulation/models/genetics';
import { TRANSPIRATION } from '../../simulation/models/transpiration';
import { FINE_PITCH, NOSEPIECE } from './specimenPicture';

/*
 * What the biology workspace pieces draw from the models' values: pure functions and the
 * apparatus' fixed sizes (no DOM, no three.js). Each maps a model value to a drawing and never
 * computes biology: a value that is NaN (no run) maps to the idle look.
 */

// ---- microscope -------------------------------------------------------------------------------

/** The nosepiece slot of the dialled objective (NOSEPIECE order), or -1. */
export function objectiveSlot(objective: number): number {
  return NOSEPIECE.findIndex((lens) => lens.magnification === objective);
}

/** Turns of the fine focus since the run started: (start − offset)/FINE_PITCH; 0 at its start and without a run. */
export function knobTurns(run: boolean, focusStart: number, offset: number): number {
  return run && Number.isFinite(offset) && Number.isFinite(focusStart)
    ? (focusStart - offset) / FINE_PITCH
    : 0;
}

/** A run exists while it is in progress, stopped or completed: the lamp is on. */
export const runExists = (status: string): boolean =>
  status === 'running' || status === 'stopped' || status === 'completed';

/**
 * The measure overlay's cell marks across the field's diameter: `n` ticks, one at the middle of
 * each of n equal parts (each FOV/n long), as x offsets from the centre in units of the radius
 * (−1…1). None unless the run completed and counted.
 */
export function countTicks(n: number, completed: boolean, out: number[]): number[] {
  out.length = 0;
  if (!completed || !(n >= 1)) return out;
  const count = Math.min(Math.floor(n), 500);
  for (let i = 0; i < count; i++) out.push(-1 + (2 * i + 1) / count);
  return out;
}

// ---- osmosis ----------------------------------------------------------------------------------

/** The potato cylinder's bore (m) and density (kg/m³), as the 3D rack has them. */
export const CYLINDER = { radius: 0.005, density: 1080 } as const;
/** A cylinder's length (m) per gram of mass: m/(ρ·π·r²). */
export const LENGTH_PER_GRAM = 1e-3 / (CYLINDER.density * Math.PI * CYLINDER.radius ** 2);
/** The water (m³) one gram of it fills: 1 g/mL, as the 3D rack has it. */
export const WATER_PER_GRAM = 1e-6;

/**
 * The cylinder's length (m) when its mass is `m` and it began at `m0` (g): it keeps its shape and
 * scales by k = ∛(v/v₀), v the volume it started with plus the water taken up (or less the water
 * given), as the 3D rack draws it. NaN for a mass that is not positive.
 */
export function cylinderLength(m: number, m0: number): number {
  if (!(m > 0) || !(m0 > 0)) return Number.NaN;
  const v0 = m0 * LENGTH_PER_GRAM * Math.PI * CYLINDER.radius ** 2; // m₀/ρ
  const v = v0 + (m - m0) * WATER_PER_GRAM;
  return m0 * LENGTH_PER_GRAM * Math.cbrt(Math.max(0, v) / v0);
}

/** The boiling tube's length (m): 25 × 150 mm. */
export const TUBE_LENGTH = 0.15;

/**
 * The membrane lens' arrow width (px) from the potential difference ΔΨ: 2 px at none up to 12 px at
 * `fullScale`, the difference a 1 mol/L solution makes at the run's temperature, R·T·C (kPa).
 */
export function arrowWidth(difference: number, fullScale: number): number {
  if (!Number.isFinite(difference) || !(fullScale > 0)) return 0;
  return 2 + 10 * Math.min(1, Math.abs(difference) / fullScale);
}

// ---- enzymes ----------------------------------------------------------------------------------

/** The gas syringe's scale (mL). */
export const GAS_SYRINGE_CAPACITY = 100;

// ---- plants -----------------------------------------------------------------------------------

/**
 * The graduated capillary on the funnel's stem (photosynthesis): bore radius and the length (m) the
 * gas can fill, as the 3D rig has it (its cap's gasTop − the capillary's bottom = 0.31 − 0.115).
 */
export const CAPILLARY = { bore: 0.0015, length: 0.195 } as const;
/** What the capillary holds (mL). */
export const CAPILLARY_ML = Math.PI * CAPILLARY.bore ** 2 * CAPILLARY.length * 1e6;

/** A fan blade's turning period (s) at air speed `u` (m/s); null (stopped) at the slowest `min`. */
export function fanPeriod(u: number, min: number): number | null {
  if (!Number.isFinite(u) || !(u > min)) return null;
  return Math.min(3, Math.max(0.25, 1.5 / u));
}

/** The stomatal pore's opening, 0 (closed) – 1 (fully open), from g_s; closed without a run. */
export function stomatalOpening(conductance: number): number {
  const { darkConductance: lo, maxStomatalConductance: hi } = TRANSPIRATION;
  if (!Number.isFinite(conductance)) return 0;
  return Math.min(1, Math.max(0, (conductance - lo) / (hi - lo)));
}

// ---- genetics ---------------------------------------------------------------------------------

const yAlleles = (code: number) => Math.floor(code / 10);
const rAlleles = (code: number) => code % 10;
const isGenotype = (code: number) =>
  Number.isInteger(code) && code >= 0 && code <= 22 && code % 10 <= 2;

/** A genotype code as letters: 22 → "YYRR", 11 → "YyRr", 0 → "yyrr". */
export function genotypeLetters(code: number): string {
  if (!isGenotype(code)) return '—';
  const y = yAlleles(code);
  const r = rAlleles(code);
  return `${y === 2 ? 'YY' : y === 1 ? 'Yy' : 'yy'}${r === 2 ? 'RR' : r === 1 ? 'Rr' : 'rr'}`;
}

/** The phenotype class of a genotype code: 0 yellow round, 1 yellow wrinkled, 2 green round, 3 green wrinkled; −1 for none. */
export function phenotypeClass(code: number): number {
  if (!isGenotype(code)) return -1;
  return (yAlleles(code) > 0 ? 0 : 2) + (rAlleles(code) > 0 ? 0 : 1);
}

/** The seed's colours by phenotype class, and whether it is drawn round. */
export const SEED = [
  { fill: '#e6c229', round: true },
  { fill: '#e6c229', round: false },
  { fill: '#5d9a3a', round: true },
  { fill: '#5d9a3a', round: false },
] as const;

/**
 * The 16 equally likely cells of the dihybrid Punnett square for two parents: the offspring genotype
 * code of each of the 16 bit patterns (row = parent 1's gamete bits 0–1, column = parent 2's bits
 * 2–3), by the model's own `offspringGenotype`. Parents that are not genotypes give none.
 */
export function punnettCells(parent1: number, parent2: number, out: number[]): number[] {
  out.length = 0;
  if (!isGenotype(parent1) || !isGenotype(parent2)) return out;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      out.push(offspringGenotype(parent1, parent2, row | (col << 2)));
    }
  }
  return out;
}

/** How many of the 16 Punnett cells are in each phenotype class (the expected share is count/16). */
export function classCells(cells: readonly number[], out: [number, number, number, number]): void {
  out.fill(0);
  for (const code of cells) {
    const i = phenotypeClass(code);
    if (i >= 0) out[i] = (out[i] ?? 0) + 1;
  }
}
