/**
 * The 3D view of "Từ tế bào đến DNA" (three.js side, loaded with this module): the biology kit's
 * stage with the level's scene. "Phóng to" glides the camera into the ring around the next
 * level's spot (its own framing, `zoomFrame`) while the chips say the picture is not to scale;
 * then the next level's scene replaces this one and is framed whole. With reduced motion the
 * level changes at once.
 */
import type { ReactNode } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { Bio3DView } from '../../view3d/Bio3DView';
import type { SceneKit } from '../../view3d/kit';
import { levelCaption } from './card';
import { LEVEL_NAME, levelInfo } from './levels';
import { buildZoomScene, zoomFrame } from './scene';
import { useCellZoom } from './store';
import { useLength, useNames } from './hooks';
import { ZoomButtons, ZoomChips } from './ZoomViews';

export function Zoom3DView({ tools }: { tools?: ReactNode }) {
  const Lz = useLocalized();
  const level = useCellZoom((s) => s.level);
  const moving = useCellZoom((s) => s.moving);
  const names = useNames(level);
  const bar = useLength()(levelInfo(level).barNm);
  const id = levelInfo(level).id;
  const nameKey = names ? Object.values(names).join('|') : '';
  return (
    <Bio3DView
      lesson="cellToDna"
      className="zoom3d"
      scene={{
        build: (kit: SceneKit) => buildZoomScene(kit, { level, barText: bar, names }),
        buildKey: `${String(level)}|${bar}|${nameKey}`,
        label: Lz(LEVEL_NAME[id]),
        ...(moving ? { view: zoomFrame(level) } : {}),
      }}
      top={<ZoomChips />}
      tools={tools}
      bottom={<ZoomButtons glide />}
      caption={Lz(levelCaption(id))}
    />
  );
}
