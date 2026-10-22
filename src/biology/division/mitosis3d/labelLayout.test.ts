import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { screenRect } from '@/ui/three/labelLayer';
import {
  boxCovers,
  layoutLabels,
  leaderCrosses,
  type LabelAnchor,
  type Rect,
} from '@/ui/three/labels';
import { applyViewport, defaultInsets, placeCamera } from './camera';
import { buildMitosisScene, type ScenePalette } from './scene';
import { buildTimeline } from './timeline';

const PALETTE: ScenePalette = {
  maternal: 'rgb(213, 94, 0)',
  paternal: 'rgb(0, 114, 178)',
  centromere: 'rgb(23, 32, 51)',
  membrane: 'rgb(22, 128, 74)',
  envelope: 'rgb(47, 98, 216)',
  nucleolus: 'rgb(86, 180, 233)',
  wall: 'rgb(154, 107, 0)',
  spindle: 'rgb(138, 147, 165)',
  centrosome: 'rgb(204, 121, 167)',
  plate: 'rgb(0, 158, 115)',
  ring: 'rgb(230, 159, 0)',
  highlight: 'rgb(47, 98, 216)',
};

/** The stage at 1366 × 768 (canvas px) and a label's size there. */
const W = 808;
const H = 470;
const LABEL = { w: 130, h: 22 };

describe('mitosis 3D name labels', () => {
  for (const stage of ['metaphase', 'cytokinesis'] as const) {
    it(`animal cell, ${stage}: no label covers a chromosome; after the split no leader crosses the other daughter`, () => {
      const tl = buildTimeline(2, 'animal');
      const ms = buildMitosisScene(tl, PALETTE, { segments: 12 });
      const st = tl.stateAt(tl.keyTime(stage));
      ms.update(st);
      const insets = defaultInsets(H);
      const place = placeCamera(ms.frame('overview'), 'animal', W, H, undefined, insets);
      const cam = new THREE.PerspectiveCamera();
      applyViewport(cam, W, H, insets);
      cam.position.set(...place.position);
      cam.lookAt(...place.target);
      cam.updateMatrixWorld();

      const obstacles = ms.labelObstacles();
      const rects = (hulls: typeof obstacles.avoid) =>
        (hulls ?? []).map((h) => screenRect(h, cam, W, H)).filter((r): r is Rect => !!r);
      const cells = rects(obstacles.regions);
      const chromosomes = rects(obstacles.avoid);
      expect(cells).toHaveLength(stage === 'cytokinesis' ? 2 : 0);
      if (stage === 'metaphase')
        expect(chromosomes).toHaveLength(st.chromatids.filter((c) => c.present).length);

      const v = new THREE.Vector3();
      const anchors: LabelAnchor[] = ms.labelAnchors().map((a) => {
        v.set(...a.point).project(cam);
        return {
          id: a.id,
          x: ((v.x + 1) / 2) * W,
          y: ((1 - v.y) / 2) * H,
          visible: true,
          ...LABEL,
        };
      });
      const safe = {
        left: insets.left,
        top: insets.top,
        right: W - insets.right,
        bottom: H - insets.bottom,
      };
      const placed = layoutLabels(anchors, safe, { cap: 8, avoid: chromosomes, regions: cells });
      expect(placed.length).toBeGreaterThanOrEqual(Math.min(anchors.length, 4));
      for (const p of placed) {
        for (const r of chromosomes) expect(boxCovers(p, LABEL, r), p.id).toBe(false);
        for (const c of cells) expect(leaderCrosses(p, c), p.id).toBe(false);
      }
      ms.dispose();
    });
  }
});
