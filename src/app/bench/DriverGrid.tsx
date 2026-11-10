import { Pause, Pin, PinOff, Play, RotateCcw, StepForward } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { formatNumber, useT } from '@/app/i18n';
import { useLayoutStore } from '@/app/layout/layoutStore';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { sim } from '@/app/sim/runtime';
import { togglePin, useCompareStore } from '@/app/sim/compare';
import { useSimStore } from '@/app/sim/simStore';
import { runLockedPrediction, usePoeRun } from '@/learn/poeRun';
import { PLAYBACK_SPEEDS, useWorkspaceStore, type PlaybackSpeed } from '@/app/workspaceStore';
import { useModuleStore } from '@/modules/moduleStore';
import { ConfidenceBadge } from '@/ui/Badges';
import { IconButton } from '@/ui/IconButton';
import { basicSteps } from './speeds';

/**
 * The bench edge (docs/BENCH_DESIGN.md §8): the same slots on every screen. D0 is the screen's main
 * action, then step, a free slot, reset, the time readout, the scrubber, the speed and the
 * confidence chip, which is always visible. A module's own driver joins in B4/B5.
 */
export function DriverGrid() {
  const moduleShown = useModuleStore((s) => s.active !== null || s.loading);
  return moduleShown ? (
    <div className="bench-edge" data-surface="frame">
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
  const basic = useSettingsStore((s) => s.uiMode === 'basic');
  const { playing, speed, suggested, setSpeed, simTime, hasSimulation } = useWorkspaceStore(
    useShallow((s) => ({
      playing: s.playing,
      speed: s.speed,
      suggested: s.suggestedSpeed,
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
  const scene = useSimStore((s) => s.scene);
  const pinned = useCompareStore((s) => s.ghost !== null && s.ghost.sceneId === scene?.id);
  // A locked prediction ("Chốt dự đoán") makes the main action its run: "Chạy để kiểm tra".
  const check = usePoeRun((s) => s.run !== null) && !playing;
  const shown = scrubTime ?? simTime;
  const timeText = formatNumber(locale, shown, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
  const canRun = hasSimulation && !invalid;
  // The lesson's own speed is a step of its own (speeds.ts keeps Basic's speed on the steps).
  const steps = basicSteps(suggested);
  const end = Math.max(duration, 1e-6);
  const played = { '--pct': `${(100 * Math.min(shown, end)) / end}%` } as CSSProperties;

  return (
    <div
      className="bench-edge"
      data-surface="frame"
      role="group"
      aria-label={t('timeline.regionLabel')}
    >
      <MainActionSlot>
        <button
          type="button"
          className="bench-play"
          aria-label={
            check ? t('learn.observe') : playing ? t('timeline.pause') : t('timeline.play')
          }
          aria-keyshortcuts="Space"
          data-tip={check ? t('learn.observe') : playing ? t('timeline.pause') : t('timeline.play')}
          data-tip-side="top"
          data-check={check || undefined}
          disabled={!canRun}
          onClick={() => {
            if (!runLockedPrediction()) sim.togglePlay();
          }}
        >
          {playing ? (
            <Pause size={18} strokeWidth={2} aria-hidden="true" />
          ) : (
            <Play size={18} strokeWidth={2} aria-hidden="true" />
          )}
          <span className="bench-play__label" aria-hidden="true">
            {check ? t('learn.observe') : playing ? t('bench.pause') : t('bench.play')}
          </span>
        </button>
      </MainActionSlot>
      <IconButton
        className="bench-edge__d1"
        icon={StepForward}
        label={t('timeline.step')}
        tooltipSide="top"
        disabled={!canRun}
        onClick={() => {
          sim.step();
        }}
      />
      {/* D2: "Ghim lần chạy này để so sánh" (a scene with a trail), else an empty slot. */}
      {scene?.trail ? (
        <IconButton
          className="bench-edge__d2"
          icon={pinned ? PinOff : Pin}
          label={t(pinned ? 'stage.tools.unpinCompare' : 'stage.tools.pinCompare')}
          tooltipSide="top"
          active={pinned}
          disabled={!hasSimulation}
          onClick={() => {
            togglePin(sim.history);
          }}
        />
      ) : (
        <span className="bench-edge__d2" aria-hidden="true" />
      )}
      <IconButton
        className="bench-edge__d3"
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
        style={played}
        min={0}
        max={end}
        step="any"
        value={Math.min(shown, end)}
        disabled={!hasSimulation || duration <= 0}
        onChange={(e) => {
          sim.scrub(Number(e.target.value));
        }}
      />
      {basic ? (
        <fieldset className="bench-speed">
          <legend className="sr-only">{t('timeline.speed')}</legend>
          {steps.map((s) => (
            <label key={s}>
              <input
                type="radio"
                name="bench-speed"
                checked={speed === s}
                onChange={() => {
                  setSpeed(s);
                }}
              />
              <span>{formatNumber(locale, s)}×</span>
            </label>
          ))}
        </fieldset>
      ) : (
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
      )}
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
      data-surface="paper"
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
