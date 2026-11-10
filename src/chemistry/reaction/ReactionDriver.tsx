import { ArrowRightLeft, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { EdgePlay, ModuleEdge } from '@/app/bench/DriverGrid';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { IconButton } from '@/ui/IconButton';
import { L } from '../common';
import { reactionById } from '../data/reactions';
import { useReactionStore } from './store';

const SPEEDS = [0.5, 1, 2] as const;

/**
 * The mechanism player on the bench edge (docs/BENCH_DESIGN.md §9.5): D0 Chạy, D1 Bước trước,
 * D2 Bước sau, D3 Đặt lại, "Bước i/n", the progress scrubber and "Dừng ở mỗi bước". The same
 * actions and names as the classic stage player; a reaction without a mechanism has none.
 */
export function ReactionDriver() {
  const Lz = useLocalized();
  const st = useReactionStore(
    useShallow((s) => ({ id: s.id, t: s.t, playing: s.playing, stepPause: s.stepPause })),
  );
  const mech = reactionById(st.id)?.mechanism ?? null;
  const speed = useReactionStore((s) => s.speed);
  const locale = useSettingsStore((s) => s.locale);
  const last = mech ? mech.frames.length - 1 : 0;
  const none = !mech;
  const step = Math.min(last, Math.floor(st.t)) + 1;
  const played = { '--pct': `${last > 0 ? (100 * st.t) / last : 0}%` } as CSSProperties;
  return (
    <ModuleEdge label={Lz(L('Điều khiển các bước', 'Step controls'))}>
      <EdgePlay
        playing={st.playing}
        disabled={none}
        onClick={() => {
          useReactionStore.setState((s) => ({ playing: !s.playing, t: s.t >= last ? 0 : s.t }));
        }}
      />
      <IconButton
        className="bench-edge__d1"
        icon={SkipBack}
        label={Lz(L('Bước trước', 'Previous step'))}
        tooltipSide="top"
        disabled={none || st.t <= 0}
        onClick={() => {
          useReactionStore.setState({ t: Math.max(0, Math.ceil(st.t) - 1), playing: false });
        }}
      />
      <IconButton
        className="bench-edge__d2"
        icon={SkipForward}
        label={Lz(L('Bước sau', 'Next step'))}
        tooltipSide="top"
        disabled={none || st.t >= last}
        onClick={() => {
          useReactionStore.setState({ t: Math.min(last, Math.floor(st.t) + 1), playing: false });
        }}
      />
      <IconButton
        className="bench-edge__d3"
        icon={RotateCcw}
        label={Lz(L('Đặt lại', 'Reset'))}
        tooltipSide="top"
        animation="spin"
        disabled={none}
        onClick={() => {
          useReactionStore.setState({ t: 0, playing: false });
        }}
      />
      <span className="bench-edge__readout" aria-hidden="true">
        {none ? '' : Lz(L(`Bước ${step}/${last + 1}`, `Step ${step}/${last + 1}`))}
      </span>
      <input
        type="range"
        className="bench-edge__scrubber"
        style={played}
        min={0}
        max={last}
        step={0.01}
        value={st.t}
        disabled={none}
        aria-label={Lz(L('Tiến trình phản ứng', 'Reaction progress'))}
        aria-valuetext={Lz(L(`Bước ${step}/${last + 1}`, `Step ${step}/${last + 1}`))}
        onChange={(e) => {
          useReactionStore.setState({ t: Number(e.target.value), playing: false });
        }}
      />
      <IconButton
        className="bench-edge__toggle"
        icon={ArrowRightLeft}
        label={Lz(L('Dừng ở mỗi bước khi phát', 'Pause on each step while playing'))}
        tooltipSide="top"
        active={st.stepPause}
        disabled={none}
        onClick={() => {
          useReactionStore.setState((s) => ({ stepPause: !s.stepPause }));
        }}
      />
      <fieldset className="bench-speed bench-speed--narrow" disabled={none}>
        <legend className="sr-only">{Lz(L('Tốc độ phát', 'Playback speed'))}</legend>
        {SPEEDS.map((v) => (
          <label key={v}>
            <input
              type="radio"
              name="mechanism-speed"
              checked={speed === v}
              onChange={() => {
                useReactionStore.setState({ speed: v });
              }}
            />
            <span>{`${formatNumber(locale, v)}×`}</span>
          </label>
        ))}
      </fieldset>
    </ModuleEdge>
  );
}
