/**
 * Stage stepping of the division lessons, shared by the 2D picture and the meiosis 3D view: the
 * previous / play / next buttons and the chips (stage name, counts per cell, colour legend).
 */
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { useLocalized } from '@/app/i18n/localized';
import { IconButton } from '@/ui/IconButton';
import { L } from '../common';
import { countsOf, type Division, type StageState } from './division';
import { setDivisionState } from './stageIndex';
import { STAGE_NAME, useDivisionStore } from './state';

export function DivisionControls({
  kind,
  stages,
  index,
}: {
  kind: Division;
  stages: StageState[];
  index: number;
}) {
  const Lz = useLocalized();
  const playing = useDivisionStore((s) => s.playing);
  const s = stages[index];
  if (!s) return null;
  const c = countsOf(s);
  return (
    <>
      <IconButton
        icon={ChevronLeft}
        label={Lz(L('Bước trước', 'Previous step'))}
        disabled={index === 0}
        onClick={() => {
          setDivisionState(kind, { index: Math.max(0, index - 1), playing: false });
        }}
      />
      <IconButton
        icon={playing ? Pause : Play}
        label={playing ? Lz(L('Tạm dừng', 'Pause')) : Lz(L('Phát', 'Play'))}
        variant="solid"
        onClick={() => {
          const x = useDivisionStore.getState();
          setDivisionState(kind, {
            playing: !x.playing,
            index: x.index >= stages.length - 1 ? 0 : x.index,
          });
        }}
      />
      <IconButton
        icon={ChevronRight}
        label={Lz(L('Bước tiếp theo', 'Next step'))}
        disabled={index >= stages.length - 1}
        onClick={() => {
          setDivisionState(kind, {
            index: Math.min(stages.length - 1, index + 1),
            playing: false,
          });
        }}
      />
      <span className="chem-chip">
        <strong>{Lz(STAGE_NAME[s.stage])}</strong>
      </span>
      <span className="chem-chip">
        {c.cells} {Lz(L('tế bào', c.cells > 1 ? 'cells' : 'cell'))} · {c.chromosomes}{' '}
        {Lz(
          L(
            c.state === 'double' ? 'NST kép' : 'NST đơn',
            c.state === 'double' ? 'double chromosomes' : 'single chromosomes',
          ),
        )}
        {Lz(L(' / tế bào', ' / cell'))}
      </span>
      <span className="chem-chip bio-legend">
        {Lz(L('NST nguồn gốc', 'Chromosomes from'))}
        <span className="rx-swatch bio-swatch--m" /> {Lz(L('từ mẹ', 'the mother'))}
        <span className="rx-swatch bio-swatch--p" /> {Lz(L('từ bố', 'the father'))}
      </span>
    </>
  );
}
