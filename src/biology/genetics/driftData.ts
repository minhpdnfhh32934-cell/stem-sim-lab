/** The drift lesson's Wright–Fisher runs, shared by the 2D and 3D views and their chips. */
import { useMemo } from 'react';
import { driftRuns } from './population';
import { useDrift } from './store';

export function useDriftRuns() {
  const st = useDrift();
  return useMemo(
    () =>
      driftRuns({ N: st.N, p0: st.p0, generations: st.generations, runs: st.runs, seed: st.seed }),
    [st.N, st.p0, st.generations, st.runs, st.seed],
  );
}
