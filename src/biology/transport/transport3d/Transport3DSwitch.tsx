import { L } from '../../common';
import { Segmented } from '../../ui';
import { useTransport } from '../store';
import { useTransport3D } from './store';

/**
 * "3D / 2D" switch of "Khuếch tán & thẩm thấu" (no three.js here: the 2D page imports it). The
 * choice is the lesson store's `view3d`, saved in files.
 */
export function Transport3DSwitch() {
  const on = useTransport((s) => s.view3d);
  return (
    <Segmented<'3d' | '2d'>
      label={L('Kiểu hiển thị', 'Display')}
      value={on ? '3d' : '2d'}
      options={[
        { id: '3d', label: L('3D', '3D') },
        { id: '2d', label: L('2D', '2D') },
      ]}
      onChange={(v) => {
        if (v === '2d') useTransport3D.setState({ selected: null, playing: false });
        useTransport.setState({ view3d: v === '3d' });
      }}
    />
  );
}
