/** The osmosis model's inputs and results, shared by the 2D and 3D views and their chips. */
import { useMemo } from 'react';
import { C } from '@/core/constants';
import { useTransport, type TransportState } from './store';
import { osmosisEquilibrium, osmosisTrajectory, type OsmosisParams } from './transport';

/** Water density (kg/m³) and membrane permeance — the latter only sets the time scale. */
export const RHO = 1000;
export const LP = 5e-6;

export const osmosisParams = (st: OsmosisInputs): OsmosisParams => ({
  c0: st.c0,
  i: st.i,
  T: st.tC + 273.15,
  h0: st.h0,
  rho: RHO,
  g: C.gn,
  lp: LP,
});

/** The lesson's osmosis inputs (its store). */
export type OsmosisInputs = Pick<TransportState, 'c0' | 'i' | 'tC' | 'h0'>;

/** Parameters, equilibrium, Π₀, the chart's time range and its 240-sample trajectory (pure). */
export function osmosisData(st: OsmosisInputs) {
  const p = osmosisParams(st);
  const eq = osmosisEquilibrium(p);
  const pi0 = p.i * p.c0 * C.R * p.T;
  // Relaxation rate of the linearised equation → about 6 time constants.
  const k = LP * (2 * RHO * C.gn + pi0 / p.h0);
  const tEnd = 6 / k;
  const traj = osmosisTrajectory(p, tEnd, 240);
  return { p, eq, pi0, tEnd, traj };
}

export function useOsmosis() {
  const c0 = useTransport((s) => s.c0);
  const i = useTransport((s) => s.i);
  const tC = useTransport((s) => s.tC);
  const h0 = useTransport((s) => s.h0);
  return useMemo(() => osmosisData({ c0, i, tC, h0 }), [c0, i, tC, h0]);
}
