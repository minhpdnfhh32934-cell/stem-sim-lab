import type { SetupStep } from '../../simulation/experiment';

/**
 * The workspace setup gate, pure: which step comes next and why a step cannot be done now. The
 * StationSystem owns the progress (entity states `setup.<step>`) and turns these into texts.
 * Steps name only earlier steps in `after` (the schema checks it), so the definition's order is
 * an order they can be done in.
 */

/** Why a step is refused: unknown, done already, waiting for an earlier step, or for a run. */
export type SetupRefusal =
  | { readonly kind: 'unknown' }
  | { readonly kind: 'done' }
  | { readonly kind: 'waits'; readonly step: SetupStep }
  | { readonly kind: 'needs-run' };

/** The first before-run step not done (RUN waits for it), or null when RUN may go. */
export function pendingBeforeRun(
  steps: readonly SetupStep[],
  done: (stepId: string) => boolean,
): SetupStep | null {
  return steps.find((s) => s.phase === 'before-run' && !done(s.id)) ?? null;
}

/** Why step `stepId` cannot be done now, or null; after-run steps need a completed run. */
export function setupRefusal(
  steps: readonly SetupStep[],
  stepId: string,
  done: (stepId: string) => boolean,
  completed: boolean,
): SetupRefusal | null {
  const step = steps.find((s) => s.id === stepId);
  if (!step) return { kind: 'unknown' };
  if (done(step.id)) return { kind: 'done' };
  // Every step it waits for, also through others; the earliest not done is the reason.
  const needed = new Set(step.after);
  for (let i = steps.indexOf(step) - 1; i >= 0; i--) {
    const s = steps[i];
    if (s && needed.has(s.id)) for (const id of s.after) needed.add(id);
  }
  const waiting = steps.find((s) => needed.has(s.id) && !done(s.id));
  if (waiting) return { kind: 'waits', step: waiting };
  if (step.phase === 'after-run' && !completed) {
    // A before-run step still missing is the better reason (no run without it).
    const pending = pendingBeforeRun(steps, done);
    return pending ? { kind: 'waits', step: pending } : { kind: 'needs-run' };
  }
  return null;
}

/** Whether a step applies to the current settings: always, or while its `when` matches. */
export const stepApplies = (step: SetupStep, parameters: Readonly<Record<string, number>>) =>
  !step.when || step.when.values.includes(parameters[step.when.parameter] ?? NaN);
