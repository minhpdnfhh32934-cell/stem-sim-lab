/**
 * A deterministic numeric model that an experiment runs. Models know nothing about the game:
 * state is a flat Float64Array whose slots are named by `variables`, so any domain (kinematics,
 * reaction kinetics, population dynamics) fits the same runtime, sampling and result pipeline.
 */
export interface SimulationModel {
  readonly id: string;
  /** Input ids the model reads; an experiment must supply each as a parameter or initial condition. */
  readonly inputs: readonly string[];
  /** Observable state variables, in state-array order. `time` is reserved for the runtime clock. */
  readonly variables: readonly string[];
  init(inputs: Readonly<Record<string, number>>, state: Float64Array): void;
  /**
   * Advances the state by at most `dt` seconds and returns the time actually advanced. Returning
   * less than `dt` lets a model stop exactly at an event (e.g. ground contact) instead of
   * overshooting by up to one step.
   */
  step(state: Float64Array, dt: number, inputs: Readonly<Record<string, number>>): number;
  /** True once the modelled process has naturally finished. */
  isComplete?(state: Float64Array, inputs: Readonly<Record<string, number>>): boolean;
  /** Ids of the closed-form predictions `predict` returns; results name them as their `theory`. */
  readonly predictions?: readonly string[];
  /** The theory: analytical values for these inputs, independent of stepping and sampling. */
  predict?(inputs: Readonly<Record<string, number>>): Record<string, number>;
  /**
   * Optional externally driven mode, for a process the player sets by hand in a physical lab (the
   * volume poured into a flask). `set` writes the model's state at drive value `x` (e.g. the volume
   * in mL) — pure, no allocation, a plain Error for a value it does not cover — and returns true
   * once the model has reached its own end (e.g. the flask at its mark).
   */
  readonly driven?: {
    /** What `x` is, for readers (a model variable's id). */
    readonly variable: string;
    set(state: Float64Array, inputs: Readonly<Record<string, number>>, x: number): boolean;
  };
}
