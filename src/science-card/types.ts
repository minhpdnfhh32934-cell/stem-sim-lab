/**
 * Science Card types (MASTER_PROMPT §2.3). Every simulation publishes one of these;
 * the card is shown in the Inspector and in presentation mode.
 */
import type { LocalizedText, Source } from '@/core/data/dataset';

export type { LocalizedText, Source } from '@/core/data/dataset';

/**
 * - `exact`: matches the analytic solution within a stated tolerance (green).
 * - `approx`: numerical integration with an estimated error (yellow).
 * - `qualitative`: illustrates a concept only; numbers must not be read from it (blue).
 */
export type ConfidenceLevel = 'exact' | 'approx' | 'qualitative';

export const CONFIDENCE_LEVELS: readonly ConfidenceLevel[] = ['exact', 'approx', 'qualitative'];

/** Every scientific data item carries a review status; `pending` shows a warning badge. */
export type ReviewStatus = 'pending' | 'verified';

export interface EquationSpec {
  /** KaTeX source. */
  tex: string;
  label?: LocalizedText;
}

export interface ScienceCardData {
  title: LocalizedText;
  /** Model used, e.g. "chất điểm, bỏ qua lực cản không khí". */
  model: LocalizedText;
  equations: EquationSpec[];
  assumptions: LocalizedText[];
  /** Range where the model is valid, e.g. "θ₀ ≲ 10°". */
  validity?: LocalizedText;
  confidence: ConfidenceLevel;
  /** How the confidence was established (tolerance, method). */
  confidenceNote?: LocalizedText;
  /** Estimated relative error when `confidence === 'approx'`. */
  estimatedError?: number;
  /** Set when the user intervened (dragged/threw an object) — §2.5. */
  userIntervened: boolean;
  /** Numerical method, e.g. "Velocity Verlet, Δt = 1/240 s". */
  method?: LocalizedText;
  sources: Source[];
  /** Review status of the data the scene depends on, when applicable. */
  reviewStatus?: ReviewStatus;
}

/**
 * Applies the intervention rule (§2.5): once the user drags or throws an object the
 * analytic solution no longer applies, so an `exact` card becomes `approx`.
 */
export function withIntervention(card: ScienceCardData, intervened: boolean): ScienceCardData {
  if (!intervened) return card;
  return {
    ...card,
    userIntervened: true,
    confidence: card.confidence === 'exact' ? 'approx' : card.confidence,
  };
}
