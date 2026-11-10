/**
 * The 3D view of "Tế bào nhân sơ và nhân thực" (three.js side, loaded with this module): the
 * biology kit's stage with the cell of `scene.ts`. A tap on a part selects it (the same selection
 * as the part list in the Inspector, which shows its name and function).
 */
import type { ReactNode } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { Bio3DView } from '../../view3d/Bio3DView';
import type { SceneKit } from '../../view3d/kit';
import { CELL_ILLUSTRATION } from '../card';
import { CELL_KIND_NAME, PARTS, partsFor, type PartId } from '../parts';
import { useCell } from '../store';
import { buildCellScene } from './scene';

const isPart = (id: string | null): id is PartId => id !== null && id in PARTS;

export function Cell3DView({ tools, showNames }: { tools?: ReactNode; showNames: boolean }) {
  const Lz = useLocalized();
  const kind = useCell((s) => s.kind);
  const selected = useCell((s) => s.selected);
  const names = showNames
    ? Object.fromEntries(partsFor(kind).map((id) => [id, Lz(PARTS[id].name)]))
    : null;
  const nameKey = names ? Object.values(names).join('|') : '';
  return (
    <Bio3DView
      lesson="cellStructure"
      className="cell3d"
      scene={{
        build: (kit: SceneKit) => buildCellScene(kit, { kind, names }),
        buildKey: `${kind}|${nameKey}`,
        label: Lz(CELL_KIND_NAME[kind]),
        onPick: (id) => {
          useCell.setState({ selected: isPart(id) && partsFor(kind).includes(id) ? id : null });
        },
        selected,
      }}
      tools={tools}
      caption={Lz(CELL_ILLUSTRATION)}
    />
  );
}
