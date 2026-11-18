/**
 * The 3D scene of "Cường độ dòng điện" (three.js, on the biology scene kit): a see-through wire,
 * the ions (instanced, --chart-3 as in 2D), the free electrons (instanced, --chart-1) placed by
 * `current3d` from the engine's drift distance (moved by `setTime` / `tick`, never rebuilt), the
 * cross-section S as a disc, and the arrows of the current I and of the electrons' drift v.
 */
import * as THREE from 'three';
import type { Bio3DScene, SceneKit } from '@/biology/view3d/kit';
import { addArrow, type Vec3 } from '../view3d/arrow';
import { ELECTRONS, ION_COLS, ION_GRID, electronX, electronYZ, wireLength } from './current3d';
import { WR } from './engine';

export interface CurrentTexts {
  I: string;
  v: string;
  S: string;
}

export interface CurrentScene extends Bio3DScene {
  state(): { s: number; firstX: number; electrons: number; ions: number };
}

export function buildCurrentScene(
  kit: SceneKit,
  o: { d: number; texts: CurrentTexts; read: () => Float64Array | null },
): CurrentScene {
  const { d, texts } = o;
  const r = d / 2;
  const Lw = wireLength(d);
  const x = (v: number) => v - Lw / 2;

  // The wire: a see-through cylinder along x.
  const wire = kit.mesh(
    kit.cylinder(),
    kit.glass(kit.color('--text-muted'), { opacity: 0.16, side: THREE.DoubleSide }),
  );
  wire.rotation.z = Math.PI / 2;
  wire.scale.set(r, Lw, r);
  wire.name = 'cur-wire';

  // Fixed positive ions.
  const ionCount = ION_COLS * ION_GRID.length * ION_GRID.length;
  const ions = kit.instanced(kit.sphere(0.5), kit.solid(kit.color('--chart-3')), ionCount);
  ions.name = 'cur-ions';
  const m4 = new THREE.Matrix4();
  const one = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const ionSize = new THREE.Vector3().setScalar(d / 22);
  let k = 0;
  for (let i = 0; i < ION_COLS; i++)
    for (const gy of ION_GRID)
      for (const gz of ION_GRID) {
        pos.set(x(((i + 0.5) * Lw) / ION_COLS), gy * r, gz * r);
        ions.setMatrixAt(k++, m4.compose(pos, one, ionSize));
      }
  ions.instanceMatrix.needsUpdate = true;

  // Free electrons: moved each frame by the engine's drift distance s.
  const electrons = kit.instanced(kit.sphere(0.5), kit.solid(kit.color('--chart-1')), ELECTRONS);
  electrons.name = 'cur-electrons';
  const eSize = new THREE.Vector3().setScalar(d / 30);
  const across = Array.from({ length: ELECTRONS }, (_, j) => electronYZ(j, r));
  let s = 0;
  const place = () => {
    s = o.read()?.[WR.s] ?? 0;
    for (let j = 0; j < ELECTRONS; j++) {
      const yz = across[j] ?? [0, 0];
      pos.set(x(electronX(j, s, Lw)), yz[0], yz[1]);
      electrons.setMatrixAt(j, m4.compose(pos, one, eSize));
    }
    electrons.instanceMatrix.needsUpdate = true;
  };
  place();

  // The cross-section S in the middle.
  const disc = kit.mesh(
    kit.shared('disc', () => new THREE.CircleGeometry(1, kit.seg)),
    kit.glass(kit.color('--accent'), { opacity: 0.3, side: THREE.DoubleSide }),
  );
  disc.rotation.y = Math.PI / 2;
  disc.scale.setScalar(r);
  disc.name = 'cur-section';
  kit.label(texts.S, [0, r * 1.25, 0], 'strong');

  // The current to the right, the electrons' drift to the left (as in 2D).
  addArrow(kit, {
    from: [x(0.15 * Lw), 1.45 * r, 0],
    dir: [1, 0, 0],
    length: 0.25 * Lw,
    radius: d * 0.02,
    color: kit.color('--chart-3'),
    name: 'cur-I',
  });
  kit.label(texts.I, [x(0.42 * Lw), 1.45 * r, 0], 'strong');
  addArrow(kit, {
    from: [x(0.85 * Lw), -1.45 * r, 0],
    dir: [-1, 0, 0],
    length: 0.25 * Lw,
    radius: d * 0.02,
    color: kit.color('--chart-1'),
    name: 'cur-v',
  });
  kit.label(texts.v, [x(0.58 * Lw), -1.45 * r, 0], 'strong');

  const points: Vec3[] = [-1, 1].flatMap((sx) =>
    [-1, 1].flatMap((sy) => [-1, 1].map((sz): Vec3 => [(sx * Lw) / 2, sy * 1.7 * r, sz * r])),
  );
  return {
    kit,
    bounds: { center: [0, 0, 0], radius: Math.hypot(Lw / 2, 1.7 * r), points },
    setTime: place,
    tick: place,
    state: () => ({ s, firstX: electronX(0, s, Lw), electrons: ELECTRONS, ions: ionCount }),
  };
}
