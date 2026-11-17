import { create } from 'zustand';
import { ELECTRODES, PAIRABLE } from './model';

export const EC_TABS = ['series', 'cell'] as const;
export type EcTab = (typeof EC_TABS)[number];

export interface ElectrochemState {
  tab: EcTab;
  /** Two couples of Bảng 15.1 to compare (the α rule). */
  a: string;
  b: string;
  /** Two metal electrodes of a Galvanic cell. */
  x: string;
  y: string;
}

/** Opens on the book's examples: Cu²⁺/Cu with Ag⁺/Ag (tr. 72), the Zn – Cu cell (tr. 73). */
export const useElectrochemStore = create<ElectrochemState>()(() => ({
  tab: 'series',
  a: 'Cu',
  b: 'Ag',
  x: 'Zn',
  y: 'Cu',
}));

const pick = (ids: readonly string[], v: unknown, keep: string): string =>
  typeof v === 'string' && ids.includes(v) ? v : keep;

export function setElectrochem(patch: Partial<Record<keyof ElectrochemState, unknown>>): void {
  const s = useElectrochemStore.getState();
  const pairable = PAIRABLE.map((c) => c.id);
  const electrodes = ELECTRODES.map((c) => c.id);
  useElectrochemStore.setState({
    tab: EC_TABS.includes(patch.tab as EcTab) ? (patch.tab as EcTab) : s.tab,
    a: pick(pairable, patch.a, s.a),
    b: pick(pairable, patch.b, s.b),
    x: pick(electrodes, patch.x, s.x),
    y: pick(electrodes, patch.y, s.y),
  });
}
