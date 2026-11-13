/**
 * How a part on the circuit bench heats and what that does to it (pure, deterministic). A part is
 * one lumped body: its rise above the room, θ (K), follows C·dθ/dt = P − θ/R_th, stepped exactly
 * (θ∞ = P·R_th, τ = R_th·C), P the power it takes from the circuit. Past its thresholds it
 * smokes, fails (open) and, for what can burn, catches fire. A filament lamp wears instead by the
 * empirical lamp-life law, life ∝ V^−16: at its rated voltage it lasts its rated life, at twice
 * that 2^16 times less.
 *
 * The thermal constants of a part come from its data (`HeatSpec`); the thresholds are illustrative
 * values in the range of the materials named there (PVC insulation, resistor coatings), stated as
 * such in the bench's notes — not a fire-safety model.
 */
export interface HeatSpec {
  /** Heat capacity (J/K). */
  readonly capacity: number;
  /** Thermal resistance to the room (K/W). */
  readonly resistance: number;
  /** Rise at which it smokes (K). */
  readonly smoke?: number | undefined;
  /** Rise at which it fails open: a resistor burnt through, a fuse or wire melted (K). */
  readonly fail?: number | undefined;
  /** Rise at which it catches fire (K); absent: it does not burn. */
  readonly ignite?: number | undefined;
}

export interface LampWear {
  readonly volts: number;
  /** Rated life at the rated voltage (s). */
  readonly life: number;
}

/** θ after `dt` seconds at power `watts`, from `rise`. */
export function heatStep(spec: HeatSpec, rise: number, watts: number, dt: number): number {
  const target = watts * spec.resistance;
  return target + (rise - target) * Math.exp(-dt / (spec.resistance * spec.capacity));
}

/** The share of its life a lamp spends in `dt` seconds at `v` volts (it fails at 1 in all). */
export function lampWear(lamp: LampWear, v: number, dt: number): number {
  return (Math.pow(Math.abs(v) / lamp.volts, 16) * dt) / lamp.life;
}

export type HeatState = 'ok' | 'smoking' | 'failed' | 'burning';

/** What a part at rise `rise` does; a part once failed or burning stays so (the caller keeps it). */
export function heatState(spec: HeatSpec, rise: number): HeatState {
  if (spec.ignite !== undefined && rise >= spec.ignite) return 'burning';
  if (spec.fail !== undefined && rise >= spec.fail) return 'failed';
  if (spec.smoke !== undefined && rise >= spec.smoke) return 'smoking';
  return 'ok';
}
