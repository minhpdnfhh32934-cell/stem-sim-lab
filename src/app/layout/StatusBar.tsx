import { CircleCheck, Gauge, MonitorCog, Turtle } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { formatNumber, useT } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { effectiveTier, usePerfStore } from '@/perf/perfStore';
import { getAppInfo, type AppInfo } from '@/app/tauri';

export const StatusBar = memo(function StatusBar() {
  const t = useT();
  const [info, setInfo] = useState<AppInfo | null>(null);
  const locale = useSettingsStore((s) => s.locale);
  const preference = usePerfStore((s) => s.preference);
  const tier = usePerfStore(effectiveTier);
  const benchmarking = usePerfStore((s) => s.benchmarking);
  const hasBenchmark = usePerfStore((s) => s.benchmark !== null);
  const fps = usePerfStore((s) => s.fps);
  const timeScale = usePerfStore((s) => s.timeScale);
  const tierText = benchmarking
    ? t('quality.measuring')
    : preference === 'auto'
      ? hasBenchmark
        ? t('quality.autoWith', { tier: t(`quality.${tier}`) })
        : t('status.qualityNotMeasured')
      : t(`quality.${tier}`);

  useEffect(() => {
    let alive = true;
    void getAppInfo().then((i) => {
      if (alive) setInfo(i);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <footer className="statusbar">
      <span className="statusbar__item">
        <CircleCheck size={12} strokeWidth={2} aria-hidden="true" />
        {t('status.ready')}
      </span>
      <span className="statusbar__item">
        <MonitorCog size={12} strokeWidth={2} aria-hidden="true" />
        {t('status.quality')}: {tierText}
      </span>
      <span className="statusbar__item mono">
        <Gauge size={12} strokeWidth={2} aria-hidden="true" />
        {t('status.fps')}: {fps === null ? '—' : Math.round(fps)}
      </span>
      {timeScale < 0.98 && (
        <span className="statusbar__item statusbar__item--warn" role="status">
          <Turtle size={12} strokeWidth={2} aria-hidden="true" />
          {t('quality.slowMotion', {
            factor: formatNumber(locale, timeScale, { maximumFractionDigits: 2 }),
          })}
        </span>
      )}
      <span className="statusbar__spacer" />
      <span className="statusbar__item">
        {t('status.version')} {info ? info.version : '…'}
        {info && !info.native && ` (${t('status.browserMode')})`}
      </span>
    </footer>
  );
});
