import { useT } from '@/app/i18n';

/** "Bước i/n" over a strip of n segments, the first i filled (bench first run, §9.2). */
export function StepStrip({ i, n }: { i: number; n: number }) {
  const t = useT();
  return (
    <div className="step-strip">
      <p className="onboarding__step">{t('onboarding.step', { i, n })}</p>
      <span className="step-strip__bar" aria-hidden="true">
        {Array.from({ length: n }, (_, k) => (
          <span key={k} data-done={k < i || undefined} />
        ))}
      </span>
    </div>
  );
}
