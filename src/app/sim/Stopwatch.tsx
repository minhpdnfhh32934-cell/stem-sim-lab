import { Flag, Pause, Play, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { formatNumber, useT } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { IconButton } from '@/ui/IconButton';
import { sim } from './runtime';

/**
 * Stopwatch measuring *simulated* time (so it stays correct in slow motion).
 * Laps are kept so students can time several events (e.g. apex and landing).
 */
export function Stopwatch() {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const simTime = useWorkspaceStore((s) => s.simTime);
  const [start, setStart] = useState<number | null>(null);
  const [accum, setAccum] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);
  const running = start !== null;
  /** Exact simulated time of the latest frame (the store value is throttled). */
  const nowT = () => sim.latest?.t ?? simTime;
  const elapsed = accum + (running ? Math.max(0, simTime - start) : 0);
  const fmt = (v: number) =>
    `${formatNumber(locale, v, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} s`;

  return (
    <div className="stopwatch" role="group" aria-label={t('stage.tools.stopwatch')}>
      <output className="stopwatch__time mono">{fmt(elapsed)}</output>
      <div className="stopwatch__buttons">
        <IconButton
          icon={running ? Pause : Play}
          size="sm"
          label={running ? t('stopwatch.stop') : t('stopwatch.start')}
          onClick={() => {
            if (running) {
              setAccum(accum + Math.max(0, nowT() - start));
              setStart(null);
            } else {
              setStart(nowT());
            }
          }}
        />
        <IconButton
          icon={Flag}
          size="sm"
          label={t('stopwatch.lap')}
          disabled={!running}
          onClick={() => {
            const lap = accum + (start !== null ? Math.max(0, nowT() - start) : 0);
            setLaps((l) => [...l, lap].slice(-5));
          }}
        />
        <IconButton
          icon={RotateCcw}
          size="sm"
          label={t('stopwatch.reset')}
          onClick={() => {
            setStart(null);
            setAccum(0);
            setLaps([]);
          }}
        />
      </div>
      {laps.length > 0 && (
        <ol className="stopwatch__laps mono">
          {laps.map((l, i) => (
            <li key={`${i}-${l}`}>{fmt(l)}</li>
          ))}
        </ol>
      )}
      <p className="stopwatch__hint">{t('stopwatch.simTimeHint')}</p>
    </div>
  );
}
