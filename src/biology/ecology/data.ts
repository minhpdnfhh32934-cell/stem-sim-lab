/** The ecology lessons' model data, shared by the 2D and 3D views and their chips. */
import { useMemo } from 'react';
import {
  exponential,
  logistic,
  logisticInflection,
  lotkaVolterra,
  lvDrift,
  lvEquilibrium,
} from './ecology';
import { useLogistic, useLv } from './store';

export function useLogisticData() {
  const st = useLogistic();
  return useMemo(() => {
    const n = 300;
    const t = Array.from({ length: n + 1 }, (_, i) => (i * st.tEnd) / n);
    const logi = t.map((x) => logistic(st.N0, st.r, st.K, x));
    // The exponential curve leaves the chart quickly; cut it above 1.3 K so the axis stays readable.
    const expo = t.map((x) => {
      const v = exponential(st.N0, st.r, x);
      return v > 1.3 * st.K ? null : v;
    });
    const tStar = logisticInflection(st.N0, st.r, st.K);
    return { t, logi, expo, tStar };
  }, [st.N0, st.r, st.K, st.tEnd]);
}

export function useLvData() {
  const st = useLv();
  return useMemo(() => {
    const p = { alpha: st.alpha, beta: st.beta, delta: st.delta, gamma: st.gamma };
    const traj = lotkaVolterra(p, st.x0, st.y0, st.tEnd, 800);
    return { p, traj, drift: lvDrift(p, traj), eq: lvEquilibrium(p) };
  }, [st.alpha, st.beta, st.delta, st.gamma, st.x0, st.y0, st.tEnd]);
}
