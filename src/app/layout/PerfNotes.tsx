import { Gauge, Turtle } from 'lucide-react';
import { formatNumber, useT } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { usePerfStore } from '@/perf/perfStore';

/**
 * What the overload ladder did, said on the stage (MASTER_PROMPT §2.6: smoothness goes first,
 * never silently): slow motion with its factor, and a lower display quality (the numbers are
 * unchanged). The classic status bar said it; the bench has none (B8, #193). The factor changes
 * with every engine report (~10 Hz), so only a hidden line without it is live: a screen reader
 * hears a notice come or go, not every new factor (the HUD is not a live region).
 */
export function PerfNotes({ className }: { className?: string }) {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const timeScale = usePerfStore((s) => s.timeScale);
  const degraded = usePerfStore((s) => s.degraded);
  const slow = timeScale < 0.98;
  if (!slow && !degraded) return null;
  return (
    <span className={className}>
      <span className="sr-only" role="status">
        {[slow && t('quality.slowMotionSpoken'), degraded && t('perf.degraded')]
          .filter(Boolean)
          .join('. ')}
      </span>
      {slow && (
        <span className="stage__chip stage__chip--warn">
          <Turtle size={12} strokeWidth={2} aria-hidden="true" />
          {t('quality.slowMotion', {
            factor: formatNumber(locale, timeScale, { maximumFractionDigits: 2 }),
          })}
        </span>
      )}
      {degraded && (
        <span className="stage__chip stage__chip--warn">
          <Gauge size={12} strokeWidth={2} aria-hidden="true" />
          {t('perf.degraded')}
        </span>
      )}
    </span>
  );
}
