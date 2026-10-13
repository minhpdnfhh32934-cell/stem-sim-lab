import { L } from '../../common';
import { Segmented } from '../../ui';
import { STAGES } from '../division';
import { useDivisionStore } from '../state';
import { timelineFor, useMitosis3D } from './store';
import { MODEL_STAGE, STAGES_3D } from './timeline';

/**
 * "3D / 2D" switch of the mitosis view. Switching keeps the stage the learner was looking at
 * (cytokinesis maps to the 2D telophase picture, which already shows two daughter cells).
 */
export function Mitosis3DSwitch() {
  const view3d = useDivisionStore((s) => s.view3d);
  return (
    <Segmented<'3d' | '2d'>
      label={L('Kiểu hiển thị', 'Display')}
      value={view3d ? '3d' : '2d'}
      options={[
        { id: '3d', label: L('3D', '3D') },
        { id: '2d', label: L('2D', '2D') },
      ]}
      onChange={(v) => {
        const d = useDivisionStore.getState();
        const tl = timelineFor(d.pairs, d.cellType);
        if (v === '2d' && d.view3d) {
          const stage = tl.stageAt(useMitosis3D.getState().t).stage;
          const index = Math.max(0, STAGES.mitosis.indexOf(MODEL_STAGE[stage]));
          useMitosis3D.setState({ playing: false });
          useDivisionStore.setState({ view3d: false, index, playing: false });
        } else if (v === '3d' && !d.view3d) {
          const stage2d = STAGES.mitosis[d.index] ?? 'g1';
          const stage = STAGES_3D.find((s) => MODEL_STAGE[s] === stage2d) ?? 'g1';
          useMitosis3D.setState({ t: tl.keyTime(stage), playing: false });
          useDivisionStore.setState({ view3d: true, playing: false });
        }
      }}
    />
  );
}
