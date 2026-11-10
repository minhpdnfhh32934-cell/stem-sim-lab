import { create } from 'zustand';

import type { FunctionalGroup } from './groups';

export type MoleculeTopic = 'molecule3d' | 'vsepr' | 'bondPolarity';

export interface MoleculeState {
  id: string;
  /** Picked atoms (up to 3: distance with 2, angle with 3). */
  atoms: number[];
  bond: number | null;
  lonePairs: boolean;
  labels: boolean;
  dipole: boolean;
  query: string;
  /** Functional group chosen in "Lọc theo nhóm chức" (Phân tử 3D), or none. */
  group: FunctionalGroup | null;
  /** The bench's "Tự xoay": the camera turns slowly around the molecule (never saved). */
  spin: boolean;
}

export const useMoleculeStore = create<MoleculeState>()(() => ({
  id: 'h2o',
  atoms: [],
  bond: null,
  lonePairs: false,
  labels: true,
  dipole: false,
  query: '',
  group: null,
  spin: false,
}));

/** Topic-specific defaults when a molecule topic opens. */
export function configureFor(topic: MoleculeTopic): void {
  useMoleculeStore.setState({
    atoms: [],
    bond: null,
    lonePairs: topic === 'vsepr',
    dipole: topic === 'bondPolarity',
  });
}

export function selectMolecule(id: string): void {
  useMoleculeStore.setState({ id, atoms: [], bond: null });
}

export function pickAtom(i: number, additive: boolean): void {
  const { atoms } = useMoleculeStore.getState();
  if (!additive) {
    useMoleculeStore.setState({
      atoms: atoms.length === 1 && atoms[0] === i ? [] : [i],
      bond: null,
    });
    return;
  }
  const next = atoms.includes(i) ? atoms.filter((a) => a !== i) : [...atoms, i].slice(-3);
  useMoleculeStore.setState({ atoms: next, bond: null });
}

export function pickBond(b: number): void {
  useMoleculeStore.setState({ bond: b, atoms: [] });
}

/** Molecule to show when a molecule topic opens next (e.g. from the reaction library). */
let pending: string | null = null;
export function requestMolecule(id: string): void {
  pending = id;
}
export function consumePendingMolecule(): string | null {
  const p = pending;
  pending = null;
  return p;
}

/** Molecules offered as quick picks for each topic. */
export const QUICK_MOLECULES: Record<MoleculeTopic, string[]> = {
  molecule3d: ['h2o', 'nh3', 'ch4', 'co2', 'c2h4', 'c2h2', 'c6h6', 'c2h5oh', 'ch3cooh', 'glucose'],
  vsepr: [
    'becl2',
    'co2',
    'bf3',
    'so2',
    'ch4',
    'nh3',
    'h2o',
    'pcl5',
    'sf4',
    'clf3',
    'xef2',
    'sf6',
    'xef4',
  ],
  bondPolarity: [
    'h2',
    'hcl',
    'h2o',
    'co2',
    'nh3',
    'ch4',
    'ccl4',
    'chcl3',
    'bf3',
    'so2',
    'hcn',
    'c2h5oh',
  ],
};
