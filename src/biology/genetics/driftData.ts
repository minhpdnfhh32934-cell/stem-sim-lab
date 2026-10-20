/** The drift lesson's Wright–Fisher runs, shared by the 2D and 3D views and their chips. */
import { useMemo } from 'react';
import { wrightFisher } from './population';
import { rng } from './stats';
import { useDrift } from './store';

export function useDriftRuns() {
  const st = useDrift();
  return useMemo(() => {
    const rand = rng(st.seed);
    return Array.from({ length: st.runs }, () => wrightFisher(st.N, st.p0, st.generations, rand));
  }, [st.N, st.p0, st.generations, st.runs, st.seed]);
}
