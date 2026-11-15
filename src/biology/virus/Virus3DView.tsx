/**
 * The 3D view of "Khái quát về virus" (three.js side, loaded with this module): the biology kit's
 * stage with the virus of `scene.ts`. A tap on a part selects it (the same selection as the part
 * list in the Inspector, which shows its name and what it is).
 */
import type { ReactNode } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { Bio3DView } from '../view3d/Bio3DView';
import type { SceneKit } from '../view3d/kit';
import { VIRUS_ILLUSTRATION } from './card';
import { isVirusPart, partsShown } from './parts';
import { buildVirusScene } from './scene';
import { useVirus } from './store';

export function Virus3DView({
  tools,
  names,
  label,
}: {
  tools?: ReactNode;
  names: Readonly<Record<string, string>> | null;
  label: string;
}) {
  const Lz = useLocalized();
  const enveloped = useVirus((s) => s.enveloped);
  const selected = useVirus((s) => s.selected);
  const nameKey = names ? Object.values(names).join('|') : '';
  return (
    <Bio3DView
      lesson="virusStructure"
      scene={{
        build: (kit: SceneKit) => buildVirusScene(kit, { enveloped, names }),
        buildKey: `${String(enveloped)}|${nameKey}`,
        label,
        onPick: (id) => {
          useVirus.setState({
            selected: isVirusPart(id) && partsShown(enveloped).includes(id) ? id : null,
          });
        },
        selected,
      }}
      tools={tools}
      caption={Lz(VIRUS_ILLUSTRATION)}
    />
  );
}
