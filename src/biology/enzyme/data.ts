/** The enzyme lesson's model data, shared by the 2D and 3D views and their chips. */
import { useMemo } from 'react';
import { L } from '../common';
import { apparent, rate, substrateAt, substrateNumeric, type Inhibition } from './enzyme';
import { useEnzyme, type EnzymeState } from './store';

export const KIND_NAME: Record<Inhibition, ReturnType<typeof L>> = {
  none: L('Không có chất ức chế', 'No inhibitor'),
  competitive: L('Ức chế cạnh tranh', 'Competitive'),
  noncompetitive: L('Ức chế không cạnh tranh', 'Non-competitive'),
  uncompetitive: L('Ức chế phi cạnh tranh (uncompetitive)', 'Uncompetitive'),
};

export const paramsOf = (st: EnzymeState) => ({
  vmax: st.vmax,
  km: st.km,
  inhibitor: st.inhibitor,
  ki: st.ki,
  kind: st.kind,
});
export const noInhibitor = (st: EnzymeState) => ({ ...paramsOf(st), kind: 'none' as const });

/** Highest [S] of the rate plot (and of the 3D view's [S] slider). */
export const sTopOf = (st: Pick<EnzymeState, 'km'>) => Math.max(10 * st.km, 20);

export function useEnzymeData() {
  const st = useEnzyme();
  const rateData = useMemo(() => {
    const top = sTopOf(st);
    const x = Array.from({ length: 301 }, (_, i) => (i * top) / 300);
    return {
      x,
      base: x.map((s) => rate(noInhibitor(st), s)),
      inh: x.map((s) => rate(paramsOf(st), s)),
    };
  }, [st]);

  const timeData = useMemo(() => {
    const p = paramsOf(st);
    const a = apparent(p);
    // Long enough to consume most of the substrate: S0/Vmax (zero order) + a few Km/Vmax.
    const tEnd = (st.s0 + 5 * a.km) / a.vmax;
    const x = Array.from({ length: 201 }, (_, i) => (i * tEnd) / 200);
    const s = x.map((t) => substrateAt(p, st.s0, t));
    return { x, s, p: s.map((v) => st.s0 - v), tEnd };
  }, [st]);

  // Cross-check of the closed form against DOPRI5 at the half-way point.
  const check = useMemo(() => {
    const p = paramsOf(st);
    const t = timeData.tEnd / 2;
    const exact = substrateAt(p, st.s0, t);
    const num = substrateNumeric(p, st.s0, t);
    return Math.abs(exact - num) / Math.max(1e-12, Math.abs(exact));
  }, [st, timeData.tEnd]);

  return { rateData, timeData, check };
}
