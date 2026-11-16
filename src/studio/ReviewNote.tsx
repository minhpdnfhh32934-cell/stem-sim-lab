import { CircleCheck, Clock3 } from 'lucide-react';
import { useT } from '@/app/i18n';
import type { ReviewStatus } from '@/science-card/types';

/**
 * Teaching text that no teacher has checked yet says so, next to where it is shown. A descriptive
 * lesson (`guided`) has no simulation, so its note does not mention one.
 */
export function ReviewNote({ status, guided = false }: { status: ReviewStatus; guided?: boolean }) {
  const t = useT();
  const Icon = status === 'verified' ? CircleCheck : Clock3;
  return (
    <p className={`studio-review studio-review--${status}`}>
      <Icon size={14} aria-hidden="true" />
      {t(guided ? `studio.guided.review.${status}` : `studio.review.${status}`)}
    </p>
  );
}
