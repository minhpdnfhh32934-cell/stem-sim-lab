import { create } from 'zustand';
import { HALOGENS } from '../data/halogens';

/** Quantities the halogen trend chart can draw (F → I). */
export const HALOGEN_PROPERTIES = ['radius', 'en', 'ie', 'melting', 'boiling'] as const;
export type HalogenProperty = (typeof HALOGEN_PROPERTIES)[number];

/** Shared by "Nhóm halogen" and "Hydrogen halide · Muối halide": the halogen looked at. */
export const useHalogenStore = create<{ z: number; property: HalogenProperty }>(() => ({
  z: 17,
  property: 'radius',
}));

export function selectHalogen(z: unknown): void {
  if (typeof z === 'number' && HALOGENS.some((h) => h.z === z)) useHalogenStore.setState({ z });
}

export function selectHalogenProperty(p: unknown): void {
  if (HALOGEN_PROPERTIES.includes(p as HalogenProperty))
    useHalogenStore.setState({ property: p as HalogenProperty });
}
