import { CircleCheck, Clock3, Eye, Sigma, Waves } from 'lucide-react';
import { useT } from '@/app/i18n';
import type { ConfidenceLevel, ReviewStatus } from '@/science-card/types';

const CONFIDENCE_ICON = { exact: Sigma, approx: Waves, qualitative: Eye } as const;

/** Colored label for a Science Card confidence level (§2.3). Color is never the only cue: text + icon. */
export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const t = useT();
  const Icon = CONFIDENCE_ICON[level];
  return (
    <span className={`badge badge--${level}`}>
      <Icon size={13} strokeWidth={2} aria-hidden="true" />
      {t(`confidence.${level}`)}
    </span>
  );
}

/** Shows whether a data item has been checked by a teacher (§2.4). */
export function ReviewBadge({ status }: { status: ReviewStatus }) {
  const t = useT();
  const Icon = status === 'verified' ? CircleCheck : Clock3;
  return (
    <span className={`badge badge--review-${status}`}>
      <Icon size={13} strokeWidth={2} aria-hidden="true" />
      {t(`review.${status}`)}
    </span>
  );
}
