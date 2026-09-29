import { create } from 'zustand';
import { ELEMENTS, type ElementData } from '../data/elements';
import { L } from '../common';
import type { LocalizedText } from '@/core/data/dataset';

export type NumericProperty = 'en' | 'radius' | 'ie' | 'mass';
export type ColorBy = 'category' | 'block' | NumericProperty;

export const PROPERTIES: Record<
  NumericProperty,
  {
    label: LocalizedText;
    /** Short axis label. */
    short: string;
    unit: string;
    value: (e: ElementData) => number | null;
  }
> = {
  en: {
    label: L('Độ âm điện (Pauling)', 'Electronegativity (Pauling)'),
    short: 'χ',
    unit: '',
    value: (e) => e.en_pauling,
  },
  radius: {
    label: L('Bán kính cộng hóa trị', 'Covalent radius'),
    short: 'r',
    unit: 'pm',
    value: (e) => e.covalent_radius_pm,
  },
  ie: {
    label: L('Năng lượng ion hóa thứ nhất', 'First ionization energy'),
    short: 'I₁',
    unit: 'eV',
    value: (e) => e.ionization_energy_ev,
  },
  mass: {
    label: L('Nguyên tử khối', 'Atomic weight'),
    short: 'Ar',
    unit: '',
    value: (e) => (e.mass_number_only ? null : e.atomic_weight),
  },
};

export function isNumeric(c: ColorBy): c is NumericProperty {
  return c in PROPERTIES;
}

/** Range of a property over all elements that have it. */
export function propertyRange(p: NumericProperty): [number, number] {
  const vals = ELEMENTS.map(PROPERTIES[p].value).filter((v): v is number => v !== null);
  return [Math.min(...vals), Math.max(...vals)];
}

export interface PeriodicState {
  selected: number;
  colorBy: ColorBy;
  query: string;
}

/** Shared by the periodic table, electron configuration, Bohr and orbital modules. */
export const usePeriodicStore = create<PeriodicState>()(() => ({
  selected: 6,
  colorBy: 'category',
  query: '',
}));

export function selectElement(z: number): void {
  usePeriodicStore.setState({ selected: z });
}
