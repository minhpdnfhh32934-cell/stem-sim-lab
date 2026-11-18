/** Playback controls of a lesson's 3D view (the clock itself: `playback.ts`). */
import { Pause, Play, RotateCcw } from 'lucide-react';
import { useLocalized } from '@/app/i18n/localized';
import { IconButton } from '@/ui/IconButton';
import { L } from '../common';
import type { Playback } from './playback';

/** Play / pause, replay, a time slider and the moment shown (formatted by the lesson). */
export function Player({
  playback,
  duration,
  label,
  readout,
}: {
  playback: Playback;
  duration: number;
  /** Name of the slider (the lesson's time quantity). */
  label: string;
  /** The moment shown, e.g. "t = 12,5 · N = 812". */
  readout: string;
}) {
  const Lz = useLocalized();
  return (
    <div className="bio3d__player">
      <IconButton
        icon={Play}
        altIcon={Pause}
        showAlt={playback.playing}
        size="lg"
        variant="solid"
        label={playback.playing ? Lz(L('Tạm dừng', 'Pause')) : Lz(L('Phát', 'Play'))}
        onClick={playback.toggle}
      />
      <IconButton
        icon={RotateCcw}
        size="lg"
        label={Lz(L('Phát lại từ đầu', 'Replay from the start'))}
        onClick={playback.replay}
      />
      <input
        type="range"
        aria-label={label}
        min={0}
        max={duration}
        step={duration / 400}
        value={playback.t}
        onChange={(e) => {
          playback.setT(Number(e.target.value));
        }}
      />
      <output aria-live="off">{readout}</output>
    </div>
  );
}
