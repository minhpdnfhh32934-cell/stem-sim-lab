import { useEffect } from 'react';
import { MoleculePanel } from './MoleculePanel';
import { MoleculeStage } from './MoleculeStage';
import { configureFor, consumePendingMolecule, selectMolecule, type MoleculeTopic } from './store';

const START: Record<MoleculeTopic, string> = {
  molecule3d: 'c2h5oh',
  vsepr: 'nh3',
  bondPolarity: 'h2o',
};

function useTopic(topic: MoleculeTopic) {
  useEffect(() => {
    configureFor(topic);
    selectMolecule(consumePendingMolecule() ?? START[topic]);
  }, [topic]);
}

export function Molecule3dStage() {
  useTopic('molecule3d');
  return <MoleculeStage topic="molecule3d" />;
}
export function VseprStage() {
  useTopic('vsepr');
  return <MoleculeStage topic="vsepr" />;
}
export function PolarityStage() {
  useTopic('bondPolarity');
  return <MoleculeStage topic="bondPolarity" />;
}
export const Molecule3dPanel = () => <MoleculePanel topic="molecule3d" />;
export const VseprPanel = () => <MoleculePanel topic="vsepr" />;
export const PolarityPanel = () => <MoleculePanel topic="bondPolarity" />;
