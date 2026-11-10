/**
 * Stage stepping of the division lessons' 2D pictures: the previous / play / next buttons and the
 * chips (stage name, counts per cell, colour legend). The 3D views have their own playback.
 */
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';

import { EdgeSteps } from '@/app/bench/EdgeSteps';
import { useOnEdge } from '@/app/bench/edgeSlot';
import { useLocalized } from '@/app/i18n/localized';
import { IconButton } from '@/ui/IconButton';
import { L } from '../common';
import { countsOf, type Division, type StageState } from './division';
import { setDivisionState } from './stageIndex';
import { STAGE_NAME, useDivisionStore } from './state';
import { EdgePortal } from '@/app/bench/EdgePortal';

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
  const onEdge = useOnEdge();
  const s = stages[index];
  if (!s) return null;
  const c = countsOf(s);
  const go = (i: number) => {
    setDivisionState(kind, {
      index: Math.max(0, Math.min(stages.length - 1, i)),
      playing: false,
    });
  };
  const play = () => {
    const x = useDivisionStore.getState();
    setDivisionState(kind, {
      playing: !x.playing,
      index: x.index >= stages.length - 1 ? 0 : x.index,
    });
  };
  const where = `${Lz(STAGE_NAME[s.stage])} (${String(index + 1)}/${String(stages.length)})`;
  return (
    <>
      <EdgePortal>
        {onEdge ? (
          // The bench edge (§9.6): Chạy, the stages one by one, Đặt lại, "Kì giữa (4/7)" and
          // the stages on a stepped slider.
          <EdgeSteps
            play={{ playing, onClick: play }}
            prev={{
              label: Lz(L('Về kì trước', 'Previous stage')),
              disabled: index === 0,
              onClick: () => {
                go(index - 1);
              },
            }}
            next={{
              label: Lz(L('Sang kì tiếp', 'Next stage')),
              disabled: index >= stages.length - 1,
              onClick: () => {
                go(index + 1);
              },
            }}
            reset={{
              label: Lz(L('Đặt lại', 'Reset')),
              disabled: index === 0 && !playing,
              onClick: () => {
                go(0);
              },
            }}
            readout={where}
            scrub={{
              label: Lz(L('Các kì', 'Stages')),
              min: 0,
              max: stages.length - 1,
              step: 1,
              value: index,
              valueText: where,
              ticks: stages.map((x, i) => ({ at: i, label: Lz(STAGE_NAME[x.stage]) })),
              onChange: go,
            }}
          />
        ) : (
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
          </>
        )}
      </EdgePortal>
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
