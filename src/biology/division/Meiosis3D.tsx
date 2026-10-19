/**
 * Meiosis in 3D: the stage of the lesson's model (same stage index, controls and chips as the 2D
 * picture), its cells and chromosomes in the textbook arrangement, maternal and paternal
 * segments in their colours (crossing over where the model put it).
 */
import { useMemo } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { L, usePublishCard } from '../common';
import { Bio3DView, type SceneSpec } from '../view3d/Bio3DView';
import { ILLUSTRATION } from '../view3d/texts';
import { DivisionControls } from './controls';
import { countsOf } from './division';
import { buildMeiosisScene } from './meiosisScene';
import { STAGE_NAME, STAGE_NOTE, cardFor, useDivisionStore, useStages } from './state';
import { useDivisionPlay } from './useDivisionPlay';

export function Meiosis3D() {
  const Lz = useLocalized();
  const card = useMemo(() => cardFor('meiosis'), []);
  usePublishCard(card);
  const stages = useStages('meiosis');
  const index = useDivisionStore((s) => s.index);
  const st = useDivisionStore();
  useDivisionPlay('meiosis', stages.length);
  const i = Math.min(index, stages.length - 1);
  const s = stages[i];
  if (!s) return null;
  const c = countsOf(s);
  const scene: SceneSpec = {
    build: (kit) => buildMeiosisScene(kit, s),
    buildKey: JSON.stringify([st.pairs, st.crossover, st.seed, i]),
    label: Lz(
      L(
        `${STAGE_NAME[s.stage].vi}: ${String(c.cells)} tế bào, mỗi tế bào ${String(c.chromosomes)} NST ${c.state === 'double' ? 'kép' : 'đơn'}.`,
        `${STAGE_NAME[s.stage].en}: ${String(c.cells)} cell(s), ${String(c.chromosomes)} ${c.state} chromosomes each.`,
      ),
    ),
    viewDir: [0.55, 0.3, 1],
    aspect: 2.2,
  };
  return (
    <Bio3DView
      lesson="meiosis"
      scene={scene}
      top={<DivisionControls kind="meiosis" stages={stages} index={i} />}
      caption={`${Lz(STAGE_NOTE[s.stage])} ${Lz(ILLUSTRATION)}`}
    />
  );
}
