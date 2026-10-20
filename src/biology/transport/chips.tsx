/** Controls and chips over the 2D and 3D pictures of "Khuếch tán & thẩm thấu" (same text). */
import { RotateCcw } from 'lucide-react';
import { useLocalized } from '@/app/i18n/localized';
import { C } from '@/core/constants';
import { L } from '../common';
import { useFmt } from '../fmt';
import { Segmented } from '../ui';
import { RHO, useOsmosis } from './osmosisData';
import { useTransport } from './store';

export function TransportChips() {
  const Lz = useLocalized();
  const fmt = useFmt();
  const st = useTransport();
  const { eq, pi0 } = useOsmosis();
  return (
    <>
      <Segmented
        label={L('Hiện tượng', 'Process')}
        value={st.mode}
        options={[
          { id: 'diffusion', label: L('Khuếch tán', 'Diffusion') },
          { id: 'osmosis', label: L('Thẩm thấu', 'Osmosis') },
        ]}
        onChange={(mode) => {
          useTransport.setState({ mode });
        }}
      />
      <button
        type="button"
        className="btn"
        onClick={() => {
          useTransport.setState((s) => ({ run: s.run + 1 }));
        }}
      >
        <RotateCcw size={15} aria-hidden="true" /> {Lz(L('Chạy lại', 'Restart'))}
      </button>
      {st.mode === 'osmosis' && (
        <>
          <span className="chem-chip">Π₀ = iC₀RT = {fmt(pi0 / 1000)} kPa</span>
          {eq.dry ? (
            <span className="chem-chip chem-chip--approx" role="status">
              {Lz(
                L(
                  'Nhánh nước cạn trước khi Π được cân bằng',
                  'The water arm runs dry before Π is balanced',
                ),
              )}
              : Δh = {fmt(eq.dh * 100)} cm · ρgΔh = {fmt((RHO * C.gn * eq.dh) / 1000)} kPa &lt; Π ={' '}
              {fmt(eq.pi / 1000)} kPa
            </span>
          ) : (
            <span className="chem-chip">
              {Lz(L('Cân bằng', 'Equilibrium'))}: Δh = {fmt(eq.dh * 100)} cm · Π ={' '}
              {fmt(eq.pi / 1000)} kPa
            </span>
          )}
        </>
      )}
    </>
  );
}
