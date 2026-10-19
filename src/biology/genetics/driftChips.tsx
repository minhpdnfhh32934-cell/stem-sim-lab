/** Controls and chips over the drift lesson's 2D and 3D pictures (the same text in both). */
import { Dices } from 'lucide-react';
import { useLocalized } from '@/app/i18n/localized';
import { L } from '../common';
import { useFmt } from '../fmt';
import { useDriftRuns } from './driftData';
import { useDrift } from './store';

export function DriftChips() {
  const Lz = useLocalized();
  const fmt = useFmt();
  const st = useDrift();
  const runs = useDriftRuns();
  const fixed = runs.filter((r) => r.at(-1) === 1).length;
  const lost = runs.filter((r) => r.at(-1) === 0).length;
  return (
    <>
      <button
        type="button"
        className="btn btn--accent"
        onClick={() => {
          useDrift.setState((s) => ({ seed: s.seed + 1 }));
        }}
      >
        <Dices size={15} aria-hidden="true" /> {Lz(L('Chạy lại', 'Run again'))}
      </button>
      <span className="chem-chip">
        {Lz(L('Cố định A', 'A fixed'))}: {fixed} · {Lz(L('mất A', 'A lost'))}: {lost} ·{' '}
        {Lz(L('còn đa hình', 'still polymorphic'))}: {runs.length - fixed - lost}
      </span>
      <span className="chem-chip">
        {Lz(
          L('Lí thuyết: xác suất cố định A = p₀ = ', 'Theory: fixation probability of A = p₀ = '),
        )}
        {fmt(st.p0)}
      </span>
    </>
  );
}
