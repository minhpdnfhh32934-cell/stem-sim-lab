/** Chips with the ecology lessons' key numbers, shared by the 2D and 3D views (same text). */
import { useLocalized } from '@/app/i18n/localized';
import { L } from '../common';
import { useFmt } from '../fmt';
import { useLogisticData, useLvData } from './data';
import { LV_DRIFT_WARN } from './ecology';
import { useLogistic } from './store';

export function LogisticChips() {
  const Lz = useLocalized();
  const fmt = useFmt();
  const st = useLogistic();
  const d = useLogisticData();
  return (
    <>
      <span className="chem-chip">
        {Lz(L('Sức chứa K', 'Carrying capacity K'))} = {fmt(st.K, 4)}
      </span>
      <span className="chem-chip">
        {Lz(L('Điểm uốn (N = K/2) tại t* = ', 'Inflection (N = K/2) at t* = '))}
        {Number.isFinite(d.tStar)
          ? fmt(d.tStar)
          : Lz(
              L(
                '— (N₀ ≥ K/2, không có điểm uốn khi t ≥ 0)',
                '— (N₀ ≥ K/2, no inflection for t ≥ 0)',
              ),
            )}
      </span>
      <span className="chem-chip">
        {Lz(L('Tốc độ tăng lớn nhất rK/4 = ', 'Maximum growth rate rK/4 = '))}
        {fmt((st.r * st.K) / 4)} {Lz(L('cá thể/đơn vị t', 'individuals/time unit'))}
      </span>
    </>
  );
}

export function LvChips() {
  const Lz = useLocalized();
  const fmt = useFmt();
  const { drift, eq } = useLvData();
  return (
    <>
      <span className="chem-chip">
        {Lz(L('Cân bằng', 'Equilibrium'))} (x*, y*) = ({fmt(eq.x)}; {fmt(eq.y)})
      </span>
      <span className="chem-chip">
        {Lz(L('Chu kì dao động nhỏ', 'Small-oscillation period'))} ≈ {fmt(eq.period)}
      </span>
      <span
        className={drift > LV_DRIFT_WARN ? 'chem-chip chem-chip--approx' : 'chem-chip'}
        title={Lz(L('Kiểm tra độ chính xác', 'Accuracy check'))}
        role={drift > LV_DRIFT_WARN ? 'status' : undefined}
      >
        {Lz(L('Sai lệch của đại lượng bảo toàn V', 'Drift of the conserved quantity V'))}:{' '}
        {fmt(drift, 2)}
        {drift > LV_DRIFT_WARN &&
          Lz(
            L(
              ' — sai số tích lũy lớn, đường đi kém tin cậy',
              ' — large accumulated error, the trajectory is less reliable',
            ),
          )}
      </span>
    </>
  );
}
