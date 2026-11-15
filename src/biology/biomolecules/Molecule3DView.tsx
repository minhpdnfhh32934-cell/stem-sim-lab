/**
 * The 3D view of "Các phân tử sinh học" (three.js side, loaded with this module): the biology
 * kit's stage with the molecule of `scene.ts`. A tap on an atom picks its part of the monomer (the
 * same selection as the part list in the Inspector).
 */
import type { ReactNode } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { Bio3DView } from '../view3d/Bio3DView';
import type { SceneKit } from '../view3d/kit';
import { MOLECULE_CAPTION } from './card';
import { PART_NAME, type Biomolecule, type PartId } from './data';
import { buildMoleculeScene } from './scene';
import { useBiomolecules } from './store';

export function Molecule3DView({
  molecule,
  tools,
  showNames,
}: {
  molecule: Biomolecule;
  tools?: ReactNode;
  showNames: boolean;
}) {
  const Lz = useLocalized();
  const part = useBiomolecules((s) => s.part);
  const names = showNames
    ? Object.fromEntries(molecule.parts.map((p) => [p.id, Lz(PART_NAME[p.id])]))
    : null;
  const nameKey = names ? Object.values(names).join('|') : '';
  return (
    <Bio3DView
      lesson="biomolecules"
      scene={{
        build: (kit: SceneKit) => buildMoleculeScene(kit, { molecule, names }),
        buildKey: `${molecule.id}|${nameKey}`,
        label: Lz(molecule.name),
        onPick: (id) => {
          useBiomolecules.setState({
            part: molecule.parts.some((p) => p.id === id) ? (id as PartId) : null,
          });
        },
        selected: part,
      }}
      tools={tools}
      caption={Lz(MOLECULE_CAPTION)}
    />
  );
}
