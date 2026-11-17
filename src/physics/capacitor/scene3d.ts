/**
 * The 3D scene of "Tụ điện" (three.js, on the biology scene kit): the capacitors of
 * `capacitor3d` as pairs of plates (+ --chart-3, − --chart-1, as in 2D) joined by wires, and the
 * charge on them as dots (two instanced meshes: + and −), recounted from the engine's state by
 * `setTime` / `tick` without allocating.
 */
import * as THREE from 'three';
import type { Bio3DScene, SceneKit } from '@/biology/view3d/kit';
import { addLine, type Vec3 } from '../view3d/arrow';
import { DOTS_MAX, GAP, capLayout, dotSpot, dotsFor, largestCharge } from './capacitor3d';
import { CP } from './engine';
import { MODE, type Bank } from './model';

export interface CapacitorScene extends Bio3DScene {
  state(): { dots: number[] };
}

export function buildCapacitorScene(
  kit: SceneKit,
  o: { bank: Bank; names: string[]; read: () => Float64Array | null },
): CapacitorScene {
  const { bank } = o;
  const caps = capLayout(bank);
  const plus = kit.color('--chart-3');
  const minus = kit.color('--chart-1');
  const box = kit.shared('box', () => new THREE.BoxGeometry(1, 1, 1));
  const wire = kit.color('--text-muted');

  caps.forEach((c, i) => {
    const [x, y, z] = c.center;
    for (const [dx, color] of [
      [-GAP / 2, plus],
      [GAP / 2, minus],
    ] as const) {
      // Half see-through: the charge on the inner faces shows from every side.
      const plate = kit.mesh(box, kit.glass(color, { opacity: 0.55 }));
      plate.scale.set(0.05, c.side, c.side);
      plate.position.set(x + dx, y, z);
    }
    kit.label(o.names[i] ?? '', [x, y + c.side / 2 + 0.3, z], 'strong');
  });

  // Wires: a chain (series) or two rails (parallel); leads to the source on both ends.
  const reach = Math.max(...caps.map((c) => c.side)) / 2 + 0.45;
  if (bank.mode === MODE.series) {
    const first = caps[0]?.center ?? [0, 0, 0];
    const last = caps[caps.length - 1]?.center ?? [0, 0, 0];
    addLine(
      kit,
      [
        [first[0] - GAP / 2 - 0.6, 0, 0],
        [last[0] + GAP / 2 + 0.6, 0, 0],
      ],
      wire,
      'cap-wire',
    );
  } else {
    const z0 = caps[0]?.center[2] ?? 0;
    const z1 = caps[caps.length - 1]?.center[2] ?? 0;
    for (const sx of [-1, 1])
      addLine(
        kit,
        [
          [sx * (GAP / 2 + 0.6), 0, z0],
          [sx * (GAP / 2 + 0.6), 0, z1],
        ],
        wire,
        'cap-rail',
      );
    for (const c of caps)
      addLine(
        kit,
        [
          [-(GAP / 2 + 0.6), 0, c.center[2]],
          [GAP / 2 + 0.6, 0, c.center[2]],
        ],
        wire,
      );
  }

  // The charge: + dots on the + plates, − dots on the − plates.
  const total = DOTS_MAX * caps.length;
  const dot = kit.sphere(0.5);
  const plusDots = kit.instanced(dot, kit.solid(plus), total);
  const minusDots = kit.instanced(dot, kit.solid(minus), total);
  plusDots.name = 'cap-plus';
  minusDots.name = 'cap-minus';
  const m4 = new THREE.Matrix4();
  const one = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const size = new THREE.Vector3().setScalar(0.045);
  const qMax = largestCharge(bank);
  const dots = caps.map(() => 0);
  const spots = caps.map((c) => Array.from({ length: DOTS_MAX }, (_, j) => dotSpot(j, c.side)));
  // Every frame while charging: no allocation.
  const place = () => {
    const s = o.read();
    let k = 0;
    caps.forEach((c, i) => {
      const n = Math.min(DOTS_MAX, dotsFor(c.C, s?.[CP.U1 + i] ?? 0, qMax));
      dots[i] = n;
      for (let j = 0; j < n; j++) {
        const [dy, dz] = spots[i]?.[j] ?? [0, 0];
        // On the inner faces, where the charge sits (facing each other across the gap).
        pos.set(c.center[0] - GAP / 2 + 0.07, c.center[1] + dy, c.center[2] + dz);
        plusDots.setMatrixAt(k, m4.compose(pos, one, size));
        pos.set(c.center[0] + GAP / 2 - 0.07, c.center[1] + dy, c.center[2] + dz);
        minusDots.setMatrixAt(k, m4.compose(pos, one, size));
        k++;
      }
    });
    plusDots.count = k;
    minusDots.count = k;
    plusDots.instanceMatrix.needsUpdate = true;
    minusDots.instanceMatrix.needsUpdate = true;
  };
  place();

  const xs = caps.map((c) => c.center[0]);
  const zs = caps.map((c) => c.center[2]);
  const points: Vec3[] = [];
  for (const x of [Math.min(...xs) - GAP / 2 - 0.6, Math.max(...xs) + GAP / 2 + 0.6])
    for (const y of [-reach, reach])
      for (const z of [Math.min(...zs) - reach, Math.max(...zs) + reach]) points.push([x, y, z]);
  return {
    kit,
    bounds: {
      center: [0, 0, 0],
      radius: Math.hypot(
        Math.max(...xs.map(Math.abs)) + 1,
        reach,
        Math.max(...zs.map(Math.abs)) + reach,
      ),
      points,
    },
    setTime: place,
    tick: place,
    state: () => ({ dots: [...dots] }),
  };
}
