/**
 * The 3D scene of the linkage testcross (three.js on the biology scene kit): the BV/bv bivalent —
 * four chromatids, BV parts in the maternal colour (--chart-4) and bv parts in the paternal one
 * (--chart-1) as in the division lessons — with the crossover between the inner non-sister
 * chromatids when f > 0, and four gamete columns as tall as the model's shares, each coloured by
 * where its B/b and V/v come from. Static: rebuilt on change.
 */
import * as THREE from 'three';
import type { Bio3DScene, SceneKit } from '@/biology/view3d/kit';
import { chromosome } from '@/biology/view3d/recipes';
import {
  CROSS_Y,
  LOCUS_B,
  LOCUS_V,
  chromatids,
  columns,
  gameteOrigin,
  type Origin,
  type Vec3,
} from './layout';

export interface LinkageScene extends Bio3DScene {
  state(): { crossover: boolean; heights: number[] };
}

const R = 0.28;
const TOP: [number, number] = [CROSS_Y, 3.6];
const BOTTOM: [number, number] = [-2.6, CROSS_Y];

export function buildLinkageScene(
  kit: SceneKit,
  o: { f: number; texts: { percent: (share: number) => string; crossover: string } },
): LinkageScene {
  const color: Record<Origin, string> = {
    maternal: kit.color('--chart-4'),
    paternal: kit.color('--chart-1'),
  };
  const part = (x: number, [y0, y1]: [number, number], origin: Origin) => {
    const len = y1 - y0 - 2 * R;
    const g = kit.shared(
      `linkage-part|${len.toFixed(3)}|${String(kit.seg)}`,
      () => new THREE.CapsuleGeometry(R, len, 6, Math.max(10, kit.seg)),
    );
    const m = kit.mesh(g, chromosome(kit, color[origin]));
    m.position.set(x, (y0 + y1) / 2, 0);
    return m;
  };
  const band = kit.shared(
    'linkage-band',
    () => new THREE.CylinderGeometry(R * 1.15, R * 1.15, 0.24, 24),
  );
  const bandMat = kit.solid(kit.color('--text'), { roughness: 0.5 });
  const cr = chromatids(o.f);
  for (const c of cr) {
    part(c.x, TOP, c.top);
    part(c.x, BOTTOM, c.bottom);
    for (const [y, upper, origin] of [
      [LOCUS_B, true, c.top],
      [LOCUS_V, false, c.bottom],
    ] as const) {
      const b = kit.mesh(band, bandMat);
      b.position.set(c.x, y, 0);
      const maternal = origin === 'maternal';
      kit.label(upper ? (maternal ? 'B' : 'b') : maternal ? 'V' : 'v', [c.x, y, 0.55], 'plain');
    }
  }
  // Sister chromatids held at their centromeres.
  const centro = kit.solid(kit.color('--text-muted'), { roughness: 0.6 });
  for (const [x0, x1] of [
    [cr[0]?.x ?? 0, cr[1]?.x ?? 0],
    [cr[2]?.x ?? 0, cr[3]?.x ?? 0],
  ] as const) {
    const c = kit.mesh(kit.sphere(), centro);
    c.scale.setScalar(R * 1.1);
    c.position.set((x0 + x1) / 2, 3.1, 0);
  }
  const crossover = o.f > 0;
  if (crossover) {
    const x = ((cr[1]?.x ?? 0) + (cr[2]?.x ?? 0)) / 2;
    const ring = kit.mesh(
      kit.shared('linkage-chiasma', () => new THREE.TorusGeometry(1, 0.06, 8, 32)),
      kit.solid(kit.color('--text'), { roughness: 0.5 }),
    );
    ring.name = 'linkage-crossover';
    ring.scale.setScalar(0.75);
    ring.position.set(x, CROSS_Y, 0);
    kit.label(o.texts.crossover, [x, CROSS_Y - 1.2, 0.6], 'plain');
  }

  // The gamete columns.
  const box = kit.shared('box', () => new THREE.BoxGeometry(1, 1, 1));
  const floor = kit.mesh(box, kit.solid(kit.color('--border'), { roughness: 0.9 }));
  floor.scale.set(9.6, 0.08, 2.2);
  floor.position.set(3.3, -2.64, 0);
  const cols = columns(o.f);
  for (const c of cols) {
    const og = gameteOrigin(c.gamete);
    const half = c.height / 2;
    if (c.height > 1e-9)
      for (const [origin, y0] of [
        [og.bottom, -2.6],
        [og.top, -2.6 + half],
      ] as const) {
        const m = kit.mesh(box, kit.solid(color[origin], { roughness: 0.55 }));
        m.name = `linkage-col-${c.gamete}`;
        m.scale.set(1.3, half, 1.3);
        m.position.set(c.x, y0 + half / 2, 0);
      }
    kit.label(c.gamete, [c.x, -3.3, 0.8], 'strong');
    kit.label(o.texts.percent(c.share), [c.x, -2.6 + c.height + 0.5, 0], 'plain');
  }

  const points: Vec3[] = [
    [-8.4, -3.8, 0],
    [8, -3.8, 0],
    [-8.4, 7.8, 0],
    [8, 7.8, 0],
    [0, 0, -1.2],
    [0, 0, 1.2],
  ];
  return {
    kit,
    bounds: { center: [-0.2, 2, 0], radius: 9, points },
    state: () => ({ crossover, heights: cols.map((c) => c.height) }),
  };
}
