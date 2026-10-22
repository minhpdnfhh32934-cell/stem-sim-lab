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
import { meiosisOptions } from '../meiosisOptions';
import { applyViewport } from '../mitosis3d/camera';
import { defaultDirection, defaultInsets, placeMeiosisCamera } from './camera';
import { buildMeiosisScene, type MeiosisPalette } from './scene';
import { buildMeiosisTimeline } from './timeline';

const PALETTE: MeiosisPalette = {
  maternal: 'rgb(213, 94, 0)',
  paternal: 'rgb(0, 114, 178)',
  centromere: 'rgb(23, 32, 51)',
  chiasma: 'rgb(0, 158, 115)',
  membrane: 'rgb(22, 128, 74)',
  envelope: 'rgb(86, 180, 233)',
  nucleolus: 'rgb(91, 74, 134)',
  spindle: 'rgb(138, 147, 165)',
  centrosome: 'rgb(204, 121, 167)',
  ring: 'rgb(240, 228, 66)',
  highlight: 'rgb(255, 210, 63)',
};

/** The stage at 1366 × 768 (canvas px) and a label's size there. */
const W = 808;
const H = 470;
const LABEL = { w: 130, h: 22 };

describe('meiosis 3D name labels (two cells)', () => {
  for (const pairs of [2, 3]) {
    it(`metaphase II (2n = ${String(2 * pairs)}, front view): labels stay on their own cell's side and never cover a chromosome`, () => {
      const tl = buildMeiosisTimeline(pairs, meiosisOptions(pairs, true, 1));
      const ms = buildMeiosisScene(tl, PALETTE, { segments: 12 });
      ms.update(tl.stateAt(tl.keyTime('metaphase2')));
      const insets = defaultInsets(H);
      const place = placeMeiosisCamera(ms.frame('overview'), W, H, defaultDirection(2), insets);
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
      // Two cells, and one box per chromatid of the model (n double chromosomes per cell).
      expect(cells).toHaveLength(2);
      const present = tl.stateAt(tl.keyTime('metaphase2')).chromatids.filter((c) => c.present);
      expect(chromosomes).toHaveLength(present.length);

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
      // The counted chromosome keeps its label.
      expect(placed.map((p) => p.id)).toContain('doubleChromosome');
      for (const p of placed) {
        for (const r of chromosomes) expect(boxCovers(p, LABEL, r), p.id).toBe(false);
        for (const c of cells) expect(leaderCrosses(p, c), p.id).toBe(false);
      }
      ms.dispose();
    });
  }
});
