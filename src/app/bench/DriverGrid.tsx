import { Pause, Play, RotateCcw, StepForward } from 'lucide-react';
import type { ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { formatNumber, useT } from '@/app/i18n';
import { useLayoutStore } from '@/app/layout/layoutStore';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { sim } from '@/app/sim/runtime';
import { useSimStore } from '@/app/sim/simStore';
import { PLAYBACK_SPEEDS, useWorkspaceStore, type PlaybackSpeed } from '@/app/workspaceStore';
import { useModuleStore } from '@/modules/moduleStore';
import { ConfidenceBadge } from '@/ui/Badges';
import { IconButton } from '@/ui/IconButton';

/**
 * The bench edge (docs/BENCH_DESIGN.md §8): the same slots on every screen. D0 is the screen's main
 * action, then step, a free slot, reset, the time readout, the scrubber, the speed and the
 * confidence chip, which is always visible. A module's own driver joins in B4/B5.
 */
export function DriverGrid() {
  const moduleShown = useModuleStore((s) => s.active !== null || s.loading);
  return moduleShown ? (
    <div className="bench-edge">
      <ConfidenceChip />
    </div>
  ) : (
    <TimeDriver />
  );
}

/** The one filled control of the screen (D0): never in a menu, never moves. */
export function MainActionSlot({ children }: { children: ReactNode }) {
  return <div className="bench-edge__main">{children}</div>;
}

function TimeDriver() {
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
    <div className="bench-edge" role="group" aria-label={t('timeline.regionLabel')}>
      <MainActionSlot>
        <button
          type="button"
          className="bench-play"
          aria-label={playing ? t('timeline.pause') : t('timeline.play')}
          disabled={!canRun}
          onClick={() => {
            sim.togglePlay();
          }}
        >
          {playing ? (
            <Pause size={18} strokeWidth={2} aria-hidden="true" />
          ) : (
            <Play size={18} strokeWidth={2} aria-hidden="true" />
          )}
          <span aria-hidden="true">{playing ? t('bench.pause') : t('bench.play')}</span>
          <kbd aria-hidden="true">Space</kbd>
        </button>
      </MainActionSlot>
      <IconButton
        icon={StepForward}
        label={t('timeline.step')}
        tooltipSide="top"
        disabled={!canRun}
        onClick={() => {
          sim.step();
        }}
      />
      {/* D2: "Ghim lần chạy này để so sánh" moves here from the stage tool bar in B2. */}
      <span className="bench-edge__free" aria-hidden="true" />
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
      {/* Not a live region: the time changes every frame (the scrubber's aria-valuetext has it). */}
      <span className="bench-edge__readout mono" aria-hidden="true">
        t = {timeText} s
      </span>
      <input
        type="range"
        className="bench-edge__scrubber"
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
      <label className="bench-edge__speed">
        <span className="sr-only">{t('timeline.speed')}</span>
        <select
          value={speed}
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
      <ConfidenceChip />
    </div>
  );
}

/** Confidence of the open model, always on the edge; it opens "Thẻ khoa học". */
function ConfidenceChip() {
  const t = useT();
  const card = useWorkspaceStore((s) => s.scienceCard);
  const intervened = useSimStore((s) => s.intervened);
  if (!card) return <span className="bench-chip bench-chip--empty" aria-hidden="true" />;
  return (
    <button
      type="button"
      className="bench-chip"
      aria-describedby="bench-chip-hint"
      onClick={() => {
        const layout = useLayoutStore.getState();
        layout.setNotebookTab(useWorkspaceStore.getState().subject, 'science');
        layout.setNotebookOpen(true);
      }}
    >
      <ConfidenceBadge level={card.confidence} />
      {intervened && <small className="bench-chip__note">{t('science.intervened')}</small>}
      <span id="bench-chip-hint" className="sr-only">
        {t('bench.openScience')}
      </span>
    </button>
  );
}
