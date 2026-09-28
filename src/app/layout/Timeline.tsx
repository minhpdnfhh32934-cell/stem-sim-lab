import { Pause, Play, RotateCcw, StepForward } from 'lucide-react';
import { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { formatNumber, useT } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { sim } from '@/app/sim/runtime';
import { useSimStore } from '@/app/sim/simStore';
import { PLAYBACK_SPEEDS, useWorkspaceStore, type PlaybackSpeed } from '@/app/workspaceStore';
import { IconButton } from '@/ui/IconButton';

/** Play / pause / step / reset, scrubber and speed (§7.1, bottom of the stage). */
export const Timeline = memo(function Timeline() {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const { playing, speed, setSpeed, simTime, hasSimulation } = useWorkspaceStore(
    useShallow((s) => ({
      playing: s.playing,
      speed: s.speed,
      setSpeed: s.setSpeed,
      simTime: s.simTime,
      hasSimulation: s.hasSimulation,
    })),
  );
  const { duration, scrubTime, invalid } = useSimStore(
    useShallow((s) => ({
      duration: s.duration,
      scrubTime: s.scrubTime,
      invalid: s.validation.length > 0,
    })),
  );
  const shown = scrubTime ?? simTime;
  const timeText = formatNumber(locale, shown, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
  const canRun = hasSimulation && !invalid;

  return (
    <div className="timeline" role="group" aria-label={t('timeline.regionLabel')}>
      <IconButton
        icon={playing ? Pause : Play}
        label={playing ? t('timeline.pause') : t('timeline.play')}
        variant="accent"
        tooltipSide="top"
        disabled={!canRun}
        onClick={() => {
          sim.togglePlay();
        }}
      />
      <IconButton
        icon={StepForward}
        label={t('timeline.step')}
        tooltipSide="top"
        disabled={!canRun}
        onClick={() => {
          sim.step();
        }}
      />
      <IconButton
        icon={RotateCcw}
        label={t('timeline.reset')}
        tooltipSide="top"
        animation="spin"
        disabled={!hasSimulation}
        onClick={() => {
          sim.reset();
        }}
      />

      <output className="timeline__time mono" aria-label={t('timeline.time')}>
        t = {timeText} s
      </output>

      <input
        type="range"
        className="timeline__scrubber"
        aria-label={t('timeline.scrubber')}
        aria-valuetext={`${timeText} s`}
        min={0}
        max={Math.max(duration, 1e-6)}
        step="any"
        value={Math.min(shown, Math.max(duration, 1e-6))}
        disabled={!hasSimulation || duration <= 0}
        onChange={(e) => {
          sim.scrub(Number(e.target.value));
        }}
      />

      <label className="timeline__speed">
        <span className="sr-only">{t('timeline.speed')}</span>
        <select
          value={speed}
          data-tip={t('timeline.speed')}
          data-tip-side="top"
          onChange={(e) => {
            setSpeed(Number(e.target.value) as PlaybackSpeed);
          }}
        >
          {PLAYBACK_SPEEDS.map((s) => (
            <option key={s} value={s}>
              ×{formatNumber(locale, s)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
});
