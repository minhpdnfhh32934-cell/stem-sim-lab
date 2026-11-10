import { useContext } from 'react';
import { BenchContext } from '@/app/bench/shellMode';
import { useLocalized } from '@/app/i18n/localized';
import { chosenTier, usePerfStore } from '@/perf/perfStore';
import { L } from '../common';

/**
 * Why the 2D picture shows instead of the 3D view (the notice of `useNo3dNotice`). On the bench
 * (docs/BENCH_DESIGN.md §9.6) it adds "Thử lại 3D" when the app chose 2D by itself after an
 * overload: the same as opening the topic again (the overload is forgotten; the numbers never
 * depended on it). A lost GPU context or the Low setting has nothing to retry here.
 */
export function No3dNotice({ text }: { text: string }) {
  const Lz = useLocalized();
  const bench = useContext(BenchContext);
  const overload = usePerfStore((s) => s.degraded && chosenTier(s) !== 'low');
  return (
    <span className="chem-chip chem-chip--qual">
      {text}
      {bench && overload && (
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => {
            usePerfStore.setState({ degraded: false });
          }}
        >
          {Lz(L('Thử lại 3D', 'Try 3D again'))}
        </button>
      )}
    </span>
  );
}
