/**
 * Contract between a simulation model and the runtime (worker or in-process).
 * Engines are deterministic: same params + same inputs → same states.
 */
export type EngineInput =
  | { kind: 'dragStart'; body: number; x: number; y: number }
  | { kind: 'dragMove'; x: number; y: number }
  | { kind: 'dragEnd' }
  | { kind: 'setParam'; name: string; value: number };

export interface EngineDiagnostics {
  /** Named conserved quantities (e.g. mechanical energy), if the model has any. */
  invariants?: Record<string, number>;
}

export interface SimulationEngine<P = unknown> {
  readonly id: string;
  /** Length of the flat state vector returned by `readState`. */
  readonly stateSize: number;
  /** Fixed physics step in seconds. */
  dt: number;
  reset(params: P): void;
  /** Advances exactly one fixed step `dt`. */
  step(): void;
  time(): number;
  readState(out: Float64Array): void;
  /** Restores a state previously produced by `readState` (used after a NaN). */
  writeState(state: Float64Array, t: number): void;
  diagnostics?(): EngineDiagnostics;
  /** Mouse interaction; returns true if the input changed the physics (an intervention). */
  input?(msg: EngineInput): boolean;
  /** Optional end condition (e.g. the projectile landed). */
  finished?(): boolean;
}

export type EngineFactory = () => SimulationEngine;

const registry = new Map<string, () => Promise<EngineFactory>>();

/** Registers a lazily loaded engine. */
export function registerEngine(id: string, load: () => Promise<EngineFactory>): void {
  registry.set(id, load);
}

export async function createEngine(id: string): Promise<SimulationEngine> {
  const load = registry.get(id);
  if (!load) throw new Error(`Unknown simulation engine "${id}"`);
  const factory = await load();
  return factory();
}

export function registeredEngines(): string[] {
  return [...registry.keys()];
}
