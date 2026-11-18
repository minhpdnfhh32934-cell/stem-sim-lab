/**
 * The 3D scene of "Giao thoa sóng hai nguồn" (three.js, on the biology scene kit): the water
 * surface of `interference3d` (raised parts --chart-1, lowered --chart-4, as in 2D), recomputed
 * at the engine's time by `setTime` / `tick` into the same buffers (no allocation), the two
 * sources and point M. Model coordinates (x, y) lie in the world's x–z plane (z = −y); the world's
 * y is the (exaggerated) displacement.
 */
import * as THREE from 'three';
import type { Bio3DScene, SceneKit } from '@/biology/view3d/kit';
import type { Vec3 } from '../view3d/arrow';
import type { WorldBounds } from '../types';
import { IF } from './engine';
import { RELIEF, heightAt, surfaceGrid, type Grid } from './interference3d';
import type { Source } from './model';

/** Grid points per side the tier may draw. */
export const MAX_CELLS = { high: 320, medium: 200, low: 120 } as const;

export interface InterferenceScene extends Bio3DScene {
  state(): { t: number; grid: Grid | null; hM: number | null };
}

export function buildInterferenceScene(
  kit: SceneKit,
  o: {
    sources: [Source, Source];
    view: WorldBounds;
    lambdaMin: number;
    m: { x: number; y: number } | null;
    texts: { S1: string; S2: string; M: string };
    read: () => Float64Array | null;
  },
): InterferenceScene {
  const [s1, s2] = o.sources;
  const v = o.view;
  const width = v.xMax - v.xMin;
  const H = RELIEF * width;
  const grid = surfaceGrid(v, o.lambdaMin, MAX_CELLS[kit.tier]);
  const crest = new THREE.Color(kit.color('--chart-1'));
  const trough = new THREE.Color(kit.color('--chart-4'));
  const calm = new THREE.Color(kit.color('--bio3d-water'));

  let pos: THREE.BufferAttribute | null = null;
  let col: THREE.BufferAttribute | null = null;
  let geo: THREE.BufferGeometry | null = null;
  if (grid) {
    geo = kit.geometry(
      new THREE.PlaneGeometry(grid.nx * grid.step, grid.ny * grid.step, grid.nx, grid.ny),
    );
    // Lay the plane in x–z, its corner on the view's corner.
    geo.rotateX(-Math.PI / 2);
    geo.translate(v.xMin + (grid.nx * grid.step) / 2, 0, -(v.yMin + (grid.ny * grid.step) / 2));
    pos = geo.getAttribute('position') as THREE.BufferAttribute;
    col = new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3);
    geo.setAttribute('color', col);
    const water = kit.mesh(
      geo,
      kit.own(
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.35,
          metalness: 0,
          side: THREE.DoubleSide,
        }),
      ),
    );
    water.name = 'if-water';
  }

  // The sources (posts) and point M.
  const post = kit.solid(kit.color('--chart-2'));
  [s1, s2].forEach((s, i) => {
    const m = kit.mesh(kit.cylinder(), post);
    m.scale.set(width * 0.008, H * 2.4, width * 0.008);
    m.position.set(s.x, 0, -s.y);
    kit.label(i === 0 ? o.texts.S1 : o.texts.S2, [s.x, H * 1.6, -s.y], 'strong');
  });
  const mDot = o.m ? kit.mesh(kit.sphere(), kit.solid(kit.color('--chart-5'))) : null;
  if (mDot) mDot.scale.setScalar(width * 0.01);
  const mLabel = o.m ? kit.label(o.texts.M, [0, 0, 0], 'strong') : null;

  const tmp = new THREE.Color();
  let t = 0;
  let hM: number | null = null;
  const place = () => {
    t = o.read()?.[IF.t] ?? 0;
    if (pos && col && geo) {
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = -pos.getZ(i);
        const u = heightAt(s1, s2, x, y, t);
        pos.setY(i, H * u);
        tmp.copy(calm).lerp(u >= 0 ? crest : trough, Math.min(1, Math.abs(u)));
        col.setXYZ(i, tmp.r, tmp.g, tmp.b);
      }
      pos.needsUpdate = true;
      col.needsUpdate = true;
      geo.computeVertexNormals();
    }
    if (o.m && mDot && mLabel) {
      hM = heightAt(s1, s2, o.m.x, o.m.y, t);
      mDot.position.set(o.m.x, H * hM, -o.m.y);
      mLabel.position.set(o.m.x, H * hM + width * 0.04, -o.m.y);
    }
  };
  place();

  const points: Vec3[] = [];
  for (const x of [v.xMin, v.xMax])
    for (const z of [-v.yMin, -v.yMax]) for (const y of [-H, 2 * H]) points.push([x, y, z]);
  return {
    kit,
    bounds: {
      center: [(v.xMin + v.xMax) / 2, 0, -(v.yMin + v.yMax) / 2],
      radius: Math.hypot(width / 2, (v.yMax - v.yMin) / 2),
      points,
    },
    setTime: place,
    tick: place,
    state: () => ({ t, grid, hM }),
  };
}
