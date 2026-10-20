import { L } from '../../common';
import { Segmented } from '../../ui';
import { setDivisionState, stageIndexKind } from '../stageIndex';
import { useDivisionStore } from '../state';
import { meiosisIndex2dOf, meiosisStage3dOf, meiosisTimelineFor, useMeiosis3D } from './store';

/**
 * "3D / 2D" switch of the meiosis view. Switching keeps the stage the learner was looking at
 * (meiosis has its own index map): 3D telophase and cytokinesis I / II map to the 2D telophase I /
 * II pictures (daughter cells), and those map back to the end of cytokinesis.
 */
export function Meiosis3DSwitch() {
  const on = useDivisionStore((s) => s.meiosisView3d);
  return (
    <Segmented<'3d' | '2d'>
      label={L('Kiểu hiển thị', 'Display')}
      value={on ? '3d' : '2d'}
      options={[
        { id: '3d', label: L('3D', '3D') },
        { id: '2d', label: L('2D', '2D') },
      ]}
      onChange={(v) => {
        const d = useDivisionStore.getState();
        const tl = meiosisTimelineFor(d.pairs, d.crossover, d.seed);
        if (v === '2d' && d.meiosisView3d) {
          const ui = useMeiosis3D.getState();
          useMeiosis3D.setState({ playing: false });
          if (ui.active) {
            const index = meiosisIndex2dOf(tl.stageAt(ui.t).stage);
            setDivisionState('meiosis', { meiosisView3d: false, index, playing: false });
          } else {
            // The 2D fallback (low quality, no WebGL) is already on screen: keep its stage.
            useDivisionStore.setState({ meiosisView3d: false, playing: false });
          }
        } else if (v === '3d' && !d.meiosisView3d) {
          // An index left by the mitosis view is not a meiosis stage.
          const index = stageIndexKind() === 'mitosis' ? 0 : d.index;
          useMeiosis3D.setState({ t: tl.keyTime(meiosisStage3dOf(index)), playing: false });
          useDivisionStore.setState({ meiosisView3d: true, playing: false });
        }
      }}
    />
  );
}
