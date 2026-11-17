import { create } from 'zustand';
import { ANIONS, IIA_SALT_METALS, TRANSITION, type Anion } from './model';

const one = <T extends string>(list: readonly T[], v: unknown, keep: T): T =>
  list.includes(v as T) ? (v as T) : keep;
const num = (v: unknown, lo: number, hi: number, keep: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : keep;

/* ───────── Group IA (Bài 24) ───────── */

export const IA_PROPS = ['radius', 'E', 'mp', 'bp', 'density', 'hardness'] as const;
export type IaProp = (typeof IA_PROPS)[number];

export interface IaState {
  prop: IaProp;
}

/** Opens on question 1 (tr. 109): the atomic radius down the group. */
export const useIaStore = create<IaState>()(() => ({ prop: 'radius' }));

export function setIa(patch: Partial<Record<keyof IaState, unknown>>): void {
  const s = useIaStore.getState();
  useIaStore.setState({ prop: one(IA_PROPS, patch.prop, s.prop) });
}

/* ───────── Group IIA (Bài 25) ───────── */

export const IIA_TABS = ['trends', 'solubility', 'thermal'] as const;
export type IiaTab = (typeof IIA_TABS)[number];
export const IIA_PROPS = ['radius', 'E', 'mp', 'bp', 'density'] as const;
export type IiaProp = (typeof IIA_PROPS)[number];
export const SALTS = ['carbonate', 'nitrate'] as const;
export type Salt = (typeof SALTS)[number];

export interface IiaState {
  tab: IiaTab;
  prop: IiaProp;
  /** The compound picked in the solubility table. */
  metal: (typeof IIA_SALT_METALS)[number];
  anion: Anion;
  salt: Salt;
}

/** Opens on CaSO₄ in the solubility table (the experiment of tr. 120). */
export const useIiaStore = create<IiaState>()(() => ({
  tab: 'trends',
  prop: 'radius',
  metal: 'Ca',
  anion: 'SO4',
  salt: 'carbonate',
}));

export function setIia(patch: Partial<Record<keyof IiaState, unknown>>): void {
  const s = useIiaStore.getState();
  useIiaStore.setState({
    tab: one(IIA_TABS, patch.tab, s.tab),
    prop: one(IIA_PROPS, patch.prop, s.prop),
    metal: one(IIA_SALT_METALS, patch.metal, s.metal),
    anion: one(ANIONS, patch.anion, s.anion),
    salt: one(SALTS, patch.salt, s.salt),
  });
}

/* ───────── Transition metals (Bài 27) ───────── */

export const TM_TABS = ['trends', 'ions', 'titration'] as const;
export type TmTab = (typeof TM_TABS)[number];
export const TM_PROPS = ['mp', 'density', 'conductivity', 'thermal', 'hardness'] as const;
export type TmProp = (typeof TM_PROPS)[number];
export const TM_IDS = TRANSITION.map((m) => m.id);

export interface TmState {
  tab: TmTab;
  prop: TmProp;
  metal: string;
  charge: number;
  /** Volume of KMnO₄ 0,02 M used (mL). */
  v: number;
}

/** Opens on the melting points (question 1a) and on Fe²⁺ (tr. 131). */
export const useTmStore = create<TmState>()(() => ({
  tab: 'trends',
  prop: 'mp',
  metal: 'Fe',
  charge: 2,
  v: 5,
}));

export function setTm(patch: Partial<Record<keyof TmState, unknown>>): void {
  const s = useTmStore.getState();
  useTmStore.setState({
    tab: one(TM_TABS, patch.tab, s.tab),
    prop: one(TM_PROPS, patch.prop, s.prop),
    metal: one(TM_IDS, patch.metal, s.metal),
    charge: Math.round(num(patch.charge, 1, 7, s.charge)),
    v: num(patch.v, 0, 25, s.v),
  });
}
