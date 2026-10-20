import { L } from '../../common';
import { Segmented } from '../../ui';
import { useMendel } from '../store';
import { useMendel3D } from './store';

/**
 * "3D / 2D" switch of "Di truyền Mendel" (no three.js here: the 2D page imports it). The choice
 * is the lesson store's `view3d`, saved in files.
 */
export function Mendel3DSwitch() {
  const on = useMendel((s) => s.view3d);
  return (
    <Segmented<'3d' | '2d'>
      label={L('Kiểu hiển thị', 'Display')}
      value={on ? '3d' : '2d'}
      options={[
        { id: '3d', label: L('3D', '3D') },
        { id: '2d', label: L('2D', '2D') },
      ]}
      onChange={(v) => {
        if (v === '2d') useMendel3D.setState({ selected: null, playing: false });
        useMendel.setState({ view3d: v === '3d' });
      }}
    />
  );
}
