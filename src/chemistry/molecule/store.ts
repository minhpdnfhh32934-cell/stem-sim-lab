import { create } from 'zustand';

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
}

export const useMoleculeStore = create<MoleculeState>()(() => ({
  id: 'h2o',
  atoms: [],
  bond: null,
  lonePairs: false,
  labels: true,
  dipole: false,
  query: '',
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
