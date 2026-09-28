import { CircleCheck, Gauge, MonitorCog } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { useT } from '@/app/i18n';
import { getAppInfo, type AppInfo } from '@/app/tauri';

export const StatusBar = memo(function StatusBar() {
  const t = useT();
  const [info, setInfo] = useState<AppInfo | null>(null);

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
        {t('status.quality')}: {t('status.qualityNotMeasured')}
      </span>
      <span className="statusbar__item mono">
        <Gauge size={12} strokeWidth={2} aria-hidden="true" />
        {t('status.fps')}: —
      </span>
      <span className="statusbar__spacer" />
      <span className="statusbar__item">
        {t('status.version')} {info ? info.version : '…'}
        {info && !info.native && ` (${t('status.browserMode')})`}
      </span>
    </footer>
  );
});
