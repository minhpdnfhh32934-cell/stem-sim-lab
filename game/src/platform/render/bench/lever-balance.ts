import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, at, slab } from '../assembly';
import { LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// Moment of a force: a lever balance. On a base, a post carries the pivot; a bar 0.62 m long with
// a hole every 5 cm turns on it, a pointer below the pivot against a scale, and two rubber stops
// under the bar's ends. The rig: the bar at the run's `tilt`; two hangers on it at the dialled
// distances, each with its stack of 50 g slotted masses, hanging plumb as the bar turns.

const BASE = 0.02;
const PIVOT = 0.4; // the pivot's height above the base
const BAR = { length: 0.62, height: 0.025, depth: 0.012 };
const SLOT = { mass: 0.05, radius: 0.022, height: 0.012 };
const HANGER = { drop: 0.05, rod: 0.002 };
const MAX_SLOTS = 4; // 200 g at most on a hanger
const DEG = Math.PI / 180;

function topOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/** The base (the entity's mesh), the post and its foot, the scale behind the pointer, the stops. */
function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  const steel = own(new THREE.MeshStandardMaterial({ color: '#b4bcc4', ...LOOKS.metal }));
  const white = own(new THREE.MeshStandardMaterial({ color: '#f2f2ee', ...LOOKS.matte }));
  const rubber = own(new THREE.MeshStandardMaterial({ color: '#2b2e32', ...LOOKS.rubber }));
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  const y0 = -h / 2 + BASE;
  mesh(keep(new THREE.BoxGeometry(0.03, PIVOT, 0.03)), painted).position.set(
    0,
    y0 + PIVOT / 2,
    -0.03,
  );
  mesh(
    keep(new THREE.CylinderGeometry(0.006, 0.006, 0.06, 12).rotateX(Math.PI / 2)),
    steel,
  ).position.set(0, y0 + PIVOT, -0.005);
  // The scale: a white arc plate behind the pointer's tip, below the pivot.
  const scale = mesh(
    keep(new THREE.RingGeometry(0.1, 0.13, 24, 1, -Math.PI / 2 - 0.3, 0.6)),
    white,
  );
  scale.position.set(0, y0 + PIVOT, -0.0145);
  scale.castShadow = false;
  // Stops under the bar's ends, where a 10° tilt brings them down.
  for (const s of [-1, 1]) {
    const x = s * 0.27;
    const y = y0 + PIVOT - Math.tan(10 * DEG) * 0.27 - BAR.height / 2 - 0.015;
    mesh(keep(new THREE.BoxGeometry(0.03, 0.03, 0.03)), rubber).position.set(x, y, -0.03);
    mesh(keep(new THREE.BoxGeometry(0.02, y - y0, 0.02)), painted).position.set(
      x,
      y0 + (y - y0) / 2 - 0.015,
      -0.03,
    );
  }
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

/** The bar with its holes and pointer, the two hangers and their slotted masses. */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh, copies } = kit;
  kit.group.position.copy(topOf(item));
  const y0 = BASE;
  const wood = own(new THREE.MeshStandardMaterial({ color: '#c9a36a', ...LOOKS.matte }));
  const dark = own(new THREE.MeshStandardMaterial({ color: '#2b2f36', ...LOOKS.plastic }));
  const brass = own(new THREE.MeshStandardMaterial({ color: '#c9a24a', ...LOOKS.metal }));
  const steel = own(new THREE.MeshStandardMaterial({ color: '#c9ced3', ...LOOKS.metal }));
  const bar = new THREE.Group();
  bar.name = 'bar';
  bar.position.set(0, y0 + PIVOT, 0);
  kit.group.add(bar);
  mesh(keep(new THREE.BoxGeometry(BAR.length, BAR.height, BAR.depth)), wood, bar);
  const holes: THREE.Matrix4[] = [];
  for (let k = -6; k <= 6; k++)
    holes.push(at(k * 0.05, 0, BAR.depth / 2 + 0.0004, Math.PI / 2, 0, 0));
  copies(
    keep(new THREE.CircleGeometry(0.003, 10).rotateX(-Math.PI / 2)),
    dark,
    holes,
    bar,
  ).castShadow = false;
  const pointer = mesh(
    keep(new THREE.BoxGeometry(0.003, 0.12, 0.002).translate(0, -0.06, 0)),
    dark,
    bar,
  );
  pointer.position.z = -0.012;
  pointer.castShadow = false;
  // A hanger: a hook rod down from the bar and a stack of slotted masses, kept plumb.
  const hangers = [0, 1].map((i) => {
    const g = new THREE.Group();
    g.name = `hanger-${i + 1}`;
    kit.group.add(g);
    mesh(
      keep(
        new THREE.CylinderGeometry(HANGER.rod, HANGER.rod, HANGER.drop, 6).translate(
          0,
          -HANGER.drop / 2,
          0,
        ),
      ),
      steel,
      g,
    ).castShadow = false;
    const slots = Array.from({ length: MAX_SLOTS }, (_, k) => {
      const slot = mesh(
        keep(new THREE.CylinderGeometry(SLOT.radius, SLOT.radius, SLOT.height - 0.001, 18)),
        brass,
        g,
      );
      slot.position.y = -HANGER.drop - SLOT.height / 2 - k * SLOT.height;
      return slot;
    });
    return { group: g, slots };
  });

  let tilt = NaN;
  const drawn = { d1: NaN, d2: NaN, m1: NaN, m2: NaN };
  const place = () => {
    const theta = -tilt * DEG; // + tilt: right end down
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    for (let i = 0; i < hangers.length; i++) {
      const x = i === 0 ? -drawn.d1 : drawn.d2;
      hangers[i]?.group.position.set(
        x * c,
        y0 + PIVOT + x * s - BAR.height / 2,
        BAR.depth / 2 + 0.006,
      );
    }
  };
  const pose = ({ parameters, sample }: BenchPose) => {
    const next = Number.isFinite(sample.tilt) ? (sample.tilt ?? 0) : 0;
    const d1 = parameters.distance1 ?? 0.15;
    const d2 = parameters.distance2 ?? 0.3;
    const m1 = parameters.mass1 ?? 0.1;
    const m2 = parameters.mass2 ?? 0.05;
    let moved = false;
    if (next !== tilt) {
      tilt = next;
      bar.rotation.z = -tilt * DEG;
      moved = true;
    }
    if (d1 !== drawn.d1 || d2 !== drawn.d2) {
      drawn.d1 = d1;
      drawn.d2 = d2;
      moved = true;
    }
    if (moved) place();
    if (m1 !== drawn.m1 || m2 !== drawn.m2) {
      drawn.m1 = m1;
      drawn.m2 = m2;
      for (let i = 0; i < hangers.length; i++) {
        const n = Math.round((i === 0 ? m1 : m2) / SLOT.mass);
        const slots = hangers[i]?.slots ?? [];
        for (let k = 0; k < slots.length; k++) {
          const slot = slots[k];
          if (slot) slot.visible = k < n;
        }
      }
    }
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const leverBalance: BenchModel = {
  frame,
  rig,
  reads: ['tilt'],
  fullScale: { tilt: 10 },
};
