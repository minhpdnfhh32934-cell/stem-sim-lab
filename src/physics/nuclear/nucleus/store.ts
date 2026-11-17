import { create } from 'zustand';
import { BOOK_MASSES, TABLE_21_1 } from '../data';
import { BOOK_REACTIONS } from '../nucleusModel';

export const TABS = ['structure', 'reactions', 'binding'] as const;
export type Tab = (typeof TABS)[number];
/** The book's reactions and the two-step question of tr. 97. */
export const REACTIONS = [...BOOK_REACTIONS.map((r) => r.id), 'question'] as const;

export interface NucleusState {
  tab: Tab;
  /** A row of Bảng 21.1 (its symbol). */
  symbol: string;
  reaction: string;
  /** A nucleus whose mass the book gives (He, O). */
  massOf: string;
  /** Fuel of the fission question (kg of ²³⁵U). */
  fuelKg: number;
}

/** Opens on gold, the nucleus of Rutherford's experiment. */
export const useNucleusStore = create<NucleusState>()(() => ({
  tab: 'structure',
  symbol: 'Au',
  reaction: 'rutherford',
  massOf: 'He',
  fuelKg: 1,
}));

export function setNucleus(patch: Partial<Record<keyof NucleusState, unknown>>): void {
  const s = useNucleusStore.getState();
  const pick = <T extends string>(v: unknown, all: readonly T[], old: T): T =>
    all.includes(v as T) ? (v as T) : old;
  useNucleusStore.setState({
    tab: pick(patch.tab, TABS, s.tab),
    symbol: pick(
      patch.symbol,
      TABLE_21_1.map((r) => r.symbol),
      s.symbol,
    ),
    reaction: pick(patch.reaction, REACTIONS as readonly string[], s.reaction),
    massOf: pick(
      patch.massOf,
      BOOK_MASSES.map((m) => m.symbol),
      s.massOf,
    ),
    fuelKg:
      typeof patch.fuelKg === 'number' && Number.isFinite(patch.fuelKg)
        ? Math.min(1e6, Math.max(1e-9, patch.fuelKg))
        : s.fuelKg,
  });
}
