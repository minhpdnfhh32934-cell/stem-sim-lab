import { Pause, Play, RotateCcw, StepForward } from 'lucide-react';
import { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { formatNumber, useT } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { PLAYBACK_SPEEDS, useWorkspaceStore, type PlaybackSpeed } from '@/app/workspaceStore';
import { IconButton } from '@/ui/IconButton';

/** Play / pause / step / reset, scrubber and speed (§7.1, bottom of the stage). */
export const Timeline = memo(function Timeline() {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const { playing, togglePlaying, resetSimulation, speed, setSpeed, simTime, hasSimulation } =
    useWorkspaceStore(
      useShallow((s) => ({
        playing: s.playing,
        togglePlaying: s.togglePlaying,
        resetSimulation: s.resetSimulation,
        speed: s.speed,
        setSpeed: s.setSpeed,
        simTime: s.simTime,
        hasSimulation: s.hasSimulation,
      })),
    );

  const timeText = formatNumber(locale, simTime, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });

  return (
    <div className="timeline" role="group" aria-label={t('timeline.regionLabel')}>
      <IconButton
        icon={playing ? Pause : Play}
        label={playing ? t('timeline.pause') : t('timeline.play')}
        variant="accent"
        tooltipSide="top"
        disabled={!hasSimulation}
        onClick={togglePlaying}
      />
      <IconButton
        icon={StepForward}
        label={t('timeline.step')}
        tooltipSide="top"
        disabled={!hasSimulation}
      />
      <IconButton
        icon={RotateCcw}
        label={t('timeline.reset')}
        tooltipSide="top"
        animation="spin"
        disabled={!hasSimulation}
        onClick={resetSimulation}
      />

      <output className="timeline__time mono" aria-label={t('timeline.time')}>
        t = {timeText} s
      </output>

      <input
        type="range"
        className="timeline__scrubber"
        aria-label={t('timeline.scrubber')}
        min={0}
        max={1}
        step={0.001}
        value={0}
        disabled={!hasSimulation}
        readOnly
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
