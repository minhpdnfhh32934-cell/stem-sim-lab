import { L } from '../../common';
import { Segmented } from '../../ui';
import { useDogmaStore } from '../state';
import { stepAt, syncedTime } from './binding';
import { currentCoding, dogma3dFor, useDogma3D } from './store';

/**
 * "3D / 2D" switch of "ADN → mARN → Protein" (no three.js here: the 2D page imports it).
 * Switching keeps the codon being translated — the dogma store's `step`, which the 3D clock
 * writes while it plays; 3D opens at that step's moment unless it already shows it (a place in
 * transcription is kept).
 */
export function Dogma3DSwitch() {
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
        const d = useDogmaStore.getState();
        const coding = currentCoding();
        const clock = coding ? dogma3dFor(coding).clock : null;
        if (v === '2d' && d.view3d) {
          const ui = useDogma3D.getState();
          useDogma3D.setState({ playing: false });
          useDogmaStore.setState({
            view3d: false,
            playing: false,
            ...(ui.active && clock ? { step: stepAt(clock, ui.t) } : {}),
          });
        } else if (v === '3d' && !d.view3d) {
          if (clock)
            useDogma3D.setState((s) => ({ t: syncedTime(clock, s.t, d.step), playing: false }));
          useDogmaStore.setState({ view3d: true, playing: false });
        }
      }}
    />
  );
}
