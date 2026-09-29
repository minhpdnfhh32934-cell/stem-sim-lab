import { create } from 'zustand';
import {
  SYSTEMS,
  equilibriumConstant,
  integrate,
  quotient,
  speciesOf,
  type EquilibriumSystem,
  type Kinetics,
} from './equilibrium';

export interface EqEvent {
  t: number;
  label: { vi: string; en: string };
}

export interface EqState {
  systemId: string;
  kinetics: Kinetics;
  T: number;
  initial: Record<string, number>;
  /** Live concentrations and time. */
  c: Record<string, number>;
  t: number;
  running: boolean;
  history: { t: number[]; c: Record<string, number[]> };
  events: EqEvent[];
  version: number;
}

const DEFAULT_KINETICS: Kinetics = { kf0: 1, kr0: 0.25, eaf: 50e3, ear: 70e3, T0: 298.15 };

export function systemOf(id: string): EquilibriumSystem {
  return SYSTEMS.find((s) => s.id === id) ?? (SYSTEMS[0] as EquilibriumSystem);
}

function initialFor(s: EquilibriumSystem): Record<string, number> {
  return Object.fromEntries(
    speciesOf(s).map((sp) => [sp, s.reactants.some((r) => r.species === sp) ? 1 : 0]),
  );
}

const emptyHistory = (s: EquilibriumSystem, c: Record<string, number>) => ({
  t: [0],
  c: Object.fromEntries(speciesOf(s).map((sp) => [sp, [c[sp] ?? 0]])),
});

export const useEqStore = create<EqState>()(() => {
  const s = systemOf('a+b-c');
  const init = initialFor(s);
  return {
    systemId: s.id,
    kinetics: DEFAULT_KINETICS,
    T: 298.15,
    initial: init,
    c: { ...init },
    t: 0,
    running: true,
    history: emptyHistory(s, init),
    events: [],
    version: 0,
  };
});

export function resetEq(
  patch: Partial<Pick<EqState, 'systemId' | 'kinetics' | 'T' | 'initial'>> = {},
) {
  const st = useEqStore.getState();
  const systemId = patch.systemId ?? st.systemId;
  const s = systemOf(systemId);
  const initial = patch.initial ?? (patch.systemId ? initialFor(s) : st.initial);
  useEqStore.setState({
    ...patch,
    systemId,
    initial,
    c: { ...initial },
    t: 0,
    history: emptyHistory(s, initial),
    events: [],
    version: st.version + 1,
    running: true,
  });
}

/** Advances the kinetics by `dt` (seconds of simulated time). */
export function stepEq(dt: number): void {
  const st = useEqStore.getState();
  const s = systemOf(st.systemId);
  const r = integrate(s, st.kinetics, st.T, st.c, st.t, dt, dt);
  const t = st.t + dt;
  const history = st.history;
  history.t.push(t);
  for (const sp of speciesOf(s)) (history.c[sp] ??= []).push(r.final[sp] ?? 0);
  if (history.t.length > 3000) {
    history.t.splice(0, 1);
    for (const arr of Object.values(history.c)) arr.splice(0, 1);
  }
  useEqStore.setState({ c: r.final, t, version: st.version + 1 });
}

/** Le Chatelier disturbances (applied instantly, recorded on the timeline). */
export function disturb(
  kind: 'add' | 'remove' | 'heat' | 'cool' | 'compress' | 'expand',
  species?: string,
) {
  const st = useEqStore.getState();
  const c = { ...st.c };
  let T = st.T;
  let label = { vi: '', en: '' };
  if (kind === 'add' && species) {
    c[species] = (c[species] ?? 0) + 0.5;
    label = { vi: `Thêm ${species}`, en: `Add ${species}` };
  } else if (kind === 'remove' && species) {
    c[species] = (c[species] ?? 0) * 0.5;
    label = { vi: `Lấy bớt ½ ${species}`, en: `Remove ½ of ${species}` };
  } else if (kind === 'heat' || kind === 'cool') {
    T = Math.min(800, Math.max(200, T + (kind === 'heat' ? 25 : -25)));
    label =
      kind === 'heat' ? { vi: 'Tăng nhiệt độ', en: 'Heat' } : { vi: 'Giảm nhiệt độ', en: 'Cool' };
  } else if (kind === 'compress' || kind === 'expand') {
    const f = kind === 'compress' ? 2 : 0.5;
    for (const k of Object.keys(c)) c[k] = (c[k] ?? 0) * f;
    label =
      kind === 'compress'
        ? { vi: 'Nén: thể tích ½ (áp suất ×2)', en: 'Compress: ½ volume (×2 pressure)' }
        : { vi: 'Giãn: thể tích ×2', en: 'Expand: ×2 volume' };
  }
  const s = systemOf(st.systemId);
  st.history.t.push(st.t);
  for (const sp of speciesOf(s)) (st.history.c[sp] ??= []).push(c[sp] ?? 0);
  useEqStore.setState({
    c,
    T,
    events: [...st.events, { t: st.t, label }],
    version: st.version + 1,
  });
}

export function currentQK(): { Q: number; K: number } {
  const st = useEqStore.getState();
  const s = systemOf(st.systemId);
  return { Q: quotient(s, st.c), K: equilibriumConstant(st.kinetics, st.T) };
}
