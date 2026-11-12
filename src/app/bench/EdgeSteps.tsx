import { RotateCcw, SkipBack, SkipForward, type LucideIcon } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useT } from '@/app/i18n';
import { IconButton } from '@/ui/IconButton';
import { EdgePlay, MainActionSlot } from './DriverGrid';
import { namedTicks } from './edgeTicks';

interface StepButton {
  label: string;
  /** The slot's own icon unless the step says otherwise (e.g. "Tới t*"). */
  icon?: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
}

export interface EdgeScrub {
  /** The slider's name (the lesson's time or stage quantity). */
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  /** What a screen reader says for the value, e.g. "Kì giữa (3/6)". */
  valueText: string;
  onChange: (value: number) => void;
  /** Marks along the track (stages); a name shows under a mark only where it has room. */
  ticks?: readonly { at: number; label: string }[];
}

/**
 * Which tick names fit on the track, measured after layout and again whenever the track or a name
 * changes size (window, panels, the font size setting).
 */
function useTickNames(ticks: EdgeScrub['ticks']) {
  const ref = useRef<HTMLOListElement>(null);
  const [shown, setShown] = useState<readonly boolean[]>([]);
  const names = ticks?.map((k) => `${String(k.at)}:${k.label}`).join('|') ?? '';
  useLayoutEffect(() => {
    const ol = ref.current;
    if (!ol) return;
    const spans = [...ol.querySelectorAll('span')];
    const fit = () => {
      setShown(
        namedTicks(
          spans.map((s) => (s.parentElement?.offsetLeft ?? 0) + s.offsetLeft),
          spans.map((s) => s.offsetWidth),
          ol.clientWidth,
        ),
      );
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit);
    ro.observe(ol);
    for (const s of spans) ro.observe(s);
    return () => {
      ro.disconnect();
    };
  }, [names]);
  return { ref, shown };
}

/**
 * A biology lesson's player laid out on the bench edge's slots (docs/BENCH_DESIGN.md §8, §9.6):
 * D0 Chạy, D1 previous, D2 next, D3 Đặt lại, the readout, the scrubber with named ticks and the
 * lesson's own speed control in the speed slot. The lesson keeps its own state and actions; this
 * only places them (`display: contents` inside the edge's module slot, a subgrid).
 */
export function EdgeSteps({
  play,
  main,
  prev,
  next,
  reset,
  readout,
  scrub,
  track,
  children,
}: {
  play?: { playing: boolean; onClick: () => void; disabled?: boolean };
  /** D0 when the lesson's main action is not Chạy (e.g. "Phóng to"): a labelled button. */
  main?: { icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean };
  prev?: StepButton;
  next?: StepButton;
  reset?: StepButton;
  readout?: string;
  scrub?: EdgeScrub;
  /** A lesson's own slider in the scrubber's slot instead (one drawn over its curve). */
  track?: ReactNode;
  /** The speed slot: the lesson's own speed control, if it has one. */
  children?: ReactNode;
}) {
  const t = useT();
  const span = scrub ? scrub.max - scrub.min : 0;
  const pct = (v: number) => (span > 0 ? (100 * (v - (scrub?.min ?? 0))) / span : 0);
  const { ref: ticksRef, shown } = useTickNames(scrub?.ticks);
  return (
    <div className="edge-steps">
      {play && (
        <EdgePlay playing={play.playing} disabled={play.disabled ?? false} onClick={play.onClick} />
      )}
      {main && (
        <MainActionSlot>
          <button
            type="button"
            className="bench-play"
            disabled={main.disabled}
            onClick={main.onClick}
          >
            <main.icon size={18} strokeWidth={2} aria-hidden="true" />
            <span className="bench-play__label">{main.label}</span>
          </button>
        </MainActionSlot>
      )}
      {prev && (
        <IconButton
          className="bench-edge__d1"
          icon={prev.icon ?? SkipBack}
          label={prev.label}
          tooltipSide="top"
          disabled={prev.disabled}
          onClick={prev.onClick}
        />
      )}
      {next && (
        <IconButton
          className="bench-edge__d2"
          icon={next.icon ?? SkipForward}
          label={next.label}
          tooltipSide="top"
          disabled={next.disabled}
          onClick={next.onClick}
        />
      )}
      {reset && (
        <IconButton
          className="bench-edge__d3"
          icon={RotateCcw}
          label={reset.label || t('bench.reset')}
          tooltipSide="top"
          animation="spin"
          disabled={reset.disabled}
          onClick={reset.onClick}
        />
      )}
      {readout !== undefined && (
        // The slider's value text says it too: the readout is not read twice.
        <output className="bench-edge__readout edge-steps__readout" aria-hidden="true">
          {readout}
        </output>
      )}
      {scrub && (
        <div className="edge-steps__scrub">
          <input
            type="range"
            className="bench-edge__scrubber"
            style={{ '--pct': `${pct(scrub.value)}%` } as CSSProperties}
            min={scrub.min}
            max={scrub.max}
            step={scrub.step}
            value={scrub.value}
            aria-label={scrub.label}
            aria-valuetext={scrub.valueText}
            onChange={(e) => {
              scrub.onChange(Number(e.target.value));
            }}
          />
          {scrub.ticks && (
            <ol ref={ticksRef} className="edge-steps__ticks" aria-hidden="true">
              {scrub.ticks.map((k, i) => (
                <li key={k.at} style={{ left: `${String(pct(k.at))}%` }}>
                  {/* Every name is laid out (to be measured); only those with room are seen. */}
                  <span className={shown[i] ? undefined : 'is-unnamed'}>{k.label}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
      {track && <div className="edge-steps__scrub">{track}</div>}
      {children && <div className="edge-steps__speed">{children}</div>}
    </div>
  );
}
