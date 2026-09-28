/**
 * Science Card types (MASTER_PROMPT §2.3). The full card UI is built in Phase 1;
 * these types are shared already so badges and data files use the same vocabulary.
 */

/**
 * - `exact`: matches the analytic solution within a stated tolerance (green).
 * - `approx`: numerical integration with an estimated error (yellow).
 * - `qualitative`: illustrates a concept only; numbers must not be read from it (blue).
 */
export type ConfidenceLevel = 'exact' | 'approx' | 'qualitative';

export const CONFIDENCE_LEVELS: readonly ConfidenceLevel[] = ['exact', 'approx', 'qualitative'];

/** Every scientific data item carries a review status; `pending` shows a warning badge. */
export type ReviewStatus = 'pending' | 'verified';

/** A bibliographic source for a model, constant or data table. */
export interface SourceRef {
  id: string;
  /** Full human-readable citation, e.g. "CODATA 2022, NIST". */
  citation: string;
  url?: string;
}

/** Draft shape of a Science Card; finalized in Phase 1. */
export interface ScienceCardData {
  /** Model used, e.g. "point mass, no air resistance". */
  model: string;
  /** Equations as KaTeX source strings. */
  equations: string[];
  assumptions: string[];
  /** Range where the model is valid, e.g. "θ₀ ≲ 10°". */
  validity?: string;
  confidence: ConfidenceLevel;
  /** Estimated relative error when `confidence === 'approx'`. */
  estimatedError?: number;
  /** Set when the user intervened (dragged/threw an object) — §2.5. */
  userIntervened: boolean;
  sources: SourceRef[];
}
