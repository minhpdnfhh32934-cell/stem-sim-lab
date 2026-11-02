/**
 * First-order ODE system y' = f(t, y), with y a flat Float64Array.
 * `f` writes the derivative into `dydt` and must not keep references to the arrays.
 */
export type OdeFn = (t: number, y: Float64Array, dydt: Float64Array) => void;

/** Scalar event function; an event fires when it crosses zero between two steps. */
export interface OdeEvent {
  id: string;
  g: (t: number, y: Float64Array) => number;
  /** +1: only rising crossings, -1: only falling, 0: both. */
  direction?: -1 | 0 | 1;
  /** Stop the integration at this event. */
  terminal?: boolean;
  /**
   * State components `g` reads. Declaring them turns on the search inside each accepted step
   * (dopri5): the step's interpolant of these components is sampled, at even points and at
   * their turning points (where a narrow excursion peaks; exact for constant acceleration), so
   * a crossing and the crossing back within one step are found. Leave it out for an event over
   * a large state whose steps stay short against its oscillation (a vibrating string): only the
   * step ends are compared then.
   */
  reads?: readonly number[];
}

export interface EventHit {
  id: string;
  t: number;
  y: Float64Array;
}

export interface IntegrationStats {
  steps: number;
  rejected: number;
  fEvals: number;
}

export class IntegrationError extends Error {
  override name = 'IntegrationError';
}

export function allFinite(y: ArrayLike<number>): boolean {
  for (let i = 0; i < y.length; i++) if (!Number.isFinite(y[i])) return false;
  return true;
}
