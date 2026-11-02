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
