import { L } from '../../common';
import { Segmented } from '../../ui';
import { useDivisionStore } from '../state';
import { setDivisionState, stageIndexKind } from '../stageIndex';
import { index2dOf, stage3dOf, timelineFor, useMitosis3D } from './store';

/**
 * "3D / 2D" switch of the mitosis view. Switching keeps the stage the learner was looking at:
 * 3D telophase and cytokinesis map to the 2D telophase picture (two daughter cells), and the
 * 2D telophase maps back to the end of cytokinesis.
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
          const ui = useMitosis3D.getState();
          useMitosis3D.setState({ playing: false });
          if (ui.active) {
            const index = index2dOf(tl.stageAt(ui.t).stage);
            setDivisionState('mitosis', { view3d: false, index, playing: false });
          } else {
            // The 2D fallback (low quality, no WebGL) is already on screen: keep its stage.
            useDivisionStore.setState({ view3d: false, playing: false });
          }
        } else if (v === '3d' && !d.view3d) {
          // An index left by the meiosis view is not a mitosis stage.
          const index = stageIndexKind() === 'meiosis' ? 0 : d.index;
          useMitosis3D.setState({ t: tl.keyTime(stage3dOf(index)), playing: false });
          useDivisionStore.setState({ view3d: true, playing: false });
        }
      }}
    />
  );
}
