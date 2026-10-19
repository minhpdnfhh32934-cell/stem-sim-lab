import { CircleCheck, Clock3 } from 'lucide-react';
import { useT } from '@/app/i18n';
import type { ReviewStatus } from '@/science-card/types';

/** Teaching text that no teacher has checked yet says so, next to where it is shown. */
export function ReviewNote({ status }: { status: ReviewStatus }) {
  const t = useT();
  const Icon = status === 'verified' ? CircleCheck : Clock3;
  return (
    <p className={`studio-review studio-review--${status}`}>
      <Icon size={14} aria-hidden="true" />
      {t(`studio.review.${status}`)}
    </p>
  );
}
