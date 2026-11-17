import { create } from 'zustand';
import {
  EXAMPLES,
  GASES,
  K_OFFSET_BOOK,
  K_OFFSET_EXACT,
  PROCESSES,
  UNKNOWNS,
  solveState,
  type GasState,
  type Process,
  type Quantity,
} from './model';

export const TABS = ['process', 'data', 'molecules'] as const;
export type Tab = (typeof TABS)[number];
export const DATA_SETS = ['boyle', 'charles'] as const;
export type DataSet = (typeof DATA_SETS)[number];
export const OFFSETS = ['book', 'exact'] as const;
export type Offset = (typeof OFFSETS)[number];
/** Worked questions the panel can load (the others need two unknowns at once). */
export const LOADABLE = ['boyle', 'ball', 'pump'] as const;
export type Loadable = (typeof LOADABLE)[number];

export interface GasLessonState {
  tab: Tab;
  process: Process;
  unknown: Quantity;
  /** State 1 and what is given of state 2: Pa, m³, °C. */
  p1: number;
  V1: number;
  t1: number;
  p2: number;
  V2: number;
  t2: number;
  /** °C → K: + 273 as the book does in Chương II, or + 273,15. */
  offset: Offset;
  dataSet: DataSet;
  /** Molecules tab: the gas, its temperature (K) and pressure (Pa). */
  gasId: string;
  T: number;
  p: number;
}

/** Opens on the worked example of Bài 11 (tr. 45–46): 100 cm³, 27 °C, 10⁵ Pa → 20 cm³, 39 °C. */
export const useGasStore = create<GasLessonState>()(() => ({
  tab: 'process',
  process: 'general',
  unknown: 'p',
  p1: 1e5,
  V1: 100e-6,
  t1: 27,
  p2: 1e5,
  V2: 20e-6,
  t2: 39,
  offset: 'book',
  dataSet: 'boyle',
  gasId: 'oxygen',
  T: 273,
  p: 1e5,
}));

export const offsetOf = (o: Offset) => (o === 'book' ? K_OFFSET_BOOK : K_OFFSET_EXACT);

const num = (v: unknown, lo: number, hi: number, old: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : old;
const pick = <T extends string>(v: unknown, all: readonly T[], old: T): T =>
  all.includes(v as T) ? (v as T) : old;

/** Applies saved or chosen values; temperatures stay above absolute zero on either offset. */
export function setGas(patch: Partial<Record<keyof GasLessonState, unknown>>): void {
  const s = useGasStore.getState();
  const process = pick(patch.process, PROCESSES, s.process);
  const wanted = pick(patch.unknown, ['p', 'V', 'T'] as const, s.unknown);
  const offset = pick(patch.offset, OFFSETS, s.offset);
  // −272 °C is above 0 K with either offset.
  const tLo = -272;
  useGasStore.setState({
    tab: pick(patch.tab, TABS, s.tab),
    process,
    unknown: UNKNOWNS[process].includes(wanted) ? wanted : (UNKNOWNS[process][0] ?? 'p'),
    p1: num(patch.p1, 1, 1e9, s.p1),
    V1: num(patch.V1, 1e-9, 1e3, s.V1),
    t1: num(patch.t1, tLo, 1e5, s.t1),
    p2: num(patch.p2, 1, 1e9, s.p2),
    V2: num(patch.V2, 1e-9, 1e3, s.V2),
    t2: num(patch.t2, tLo, 1e5, s.t2),
    offset,
    dataSet: pick(patch.dataSet, DATA_SETS, s.dataSet),
    gasId: pick(
      patch.gasId,
      GASES.map((g) => g.id),
      s.gasId,
    ),
    T: num(patch.T, 1, 1e5, s.T),
    p: num(patch.p, 1, 1e9, s.p),
  });
}

/** Loads one of the book's worked questions (inputs only; the app computes the answer). */
export function loadExample(id: Loadable): void {
  const ex = EXAMPLES.find((e) => e.id === id);
  if (!ex) return;
  const get = (k: string) => (typeof ex[k] === 'number' ? ex[k] : undefined);
  const base = { tab: 'process', offset: 'book' } as const;
  if (id === 'boyle')
    setGas({
      ...base,
      process: 'isothermal',
      unknown: 'V',
      p1: get('p1'),
      V1: get('V1'),
      p2: get('p2'),
    });
  else if (id === 'ball')
    setGas({
      ...base,
      process: 'isothermal',
      unknown: 'p',
      p1: get('p1'),
      V1: get('V1'),
      V2: get('V2'),
    });
  else
    setGas({
      ...base,
      process: 'general',
      unknown: 'p',
      p1: get('p1'),
      V1: get('V1'),
      t1: get('t1'),
      V2: get('V2'),
      t2: get('t2'),
    });
}

/** States 1 and 2 in SI (K), or state 2 null when the inputs give no physical state. */
export function statesOf(s: GasLessonState): { s1: GasState; s2: GasState | null } {
  const off = offsetOf(s.offset);
  const s1 = { p: s.p1, V: s.V1, T: s.t1 + off };
  const given = { p: s.p2, V: s.V2, T: s.t2 + off };
  return { s1, s2: solveState(s.process, s.unknown, s1, given) };
}
