import { L } from '../../common';
import { Segmented } from '../../ui';
import { useDogmaStore } from '../state';
import { useMutation3D } from './store';

/**
 * "3D / 2D" switch of "Đột biến điểm" (no three.js here: the 2D page imports it). The choice is
 * the dogma store's `view3d`, shared with "ADN → mARN → Protein" and saved in files.
 */
export function Mutation3DSwitch() {
  const on = useDogmaStore((s) => s.view3d);
  return (
    <Segmented<'3d' | '2d'>
      label={L('Kiểu hiển thị', 'Display')}
      value={on ? '3d' : '2d'}
      options={[
        { id: '3d', label: L('3D', '3D') },
        { id: '2d', label: L('2D', '2D') },
      ]}
      onChange={(v) => {
        if (v === '2d') useMutation3D.setState({ selected: null });
        useDogmaStore.setState({ view3d: v === '3d', playing: false });
      }}
    />
  );
}
