import { L } from '../../common';
import { Segmented } from '../../ui';
import { useEnzyme } from '../store';
import { useEnzyme3D } from './store';

/**
 * "3D / 2D" switch of "Động học enzyme" (no three.js here: the 2D page imports it). The choice is
 * the lesson store's `view3d`, saved in files.
 */
export function Enzyme3DSwitch() {
  const on = useEnzyme((s) => s.view3d);
  return (
    <Segmented<'3d' | '2d'>
      label={L('Kiểu hiển thị', 'Display')}
      value={on ? '3d' : '2d'}
      options={[
        { id: '3d', label: L('3D', '3D') },
        { id: '2d', label: L('2D', '2D') },
      ]}
      onChange={(v) => {
        if (v === '2d') useEnzyme3D.setState({ selected: null, playing: false });
        useEnzyme.setState({ view3d: v === '3d' });
      }}
    />
  );
}
