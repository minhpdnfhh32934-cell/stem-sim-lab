import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, at, slab } from '../assembly';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// The speed of sound: a glass tube 80 cm tall in a stand with a scale beside it (0 at the top), a
// tuning fork held over its mouth, a hose from its foot to a water reservoir on a slide. The rig:
// the water in the tube up to `column` below the top, the reservoir at the same level (as the
// student lowers it), all from the run's `column`.

const BASE = 0.02;
const TUBE = { x: -0.05, radius: 0.018, from: 0.12, length: 0.8 };
const RESERVOIR = { x: 0.15, radius: 0.04, height: 0.12 };

function topOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/** The base (the entity's mesh), the stand, the glass tube, its scale, the fork and its clamp, the slide. */
function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh, copies } = kit;
  const glass = own(new THREE.MeshStandardMaterial({ color: '#cfe8f0', ...GLASSWARE_LOOK }));
  const steel = own(new THREE.MeshStandardMaterial({ color: '#b4bcc4', ...LOOKS.metal }));
  const white = own(new THREE.MeshStandardMaterial({ color: '#f2f2ee', ...LOOKS.matte }));
  const ink = own(new THREE.MeshStandardMaterial({ color: '#1d2731', ...LOOKS.matte }));
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  const y0 = -h / 2 + BASE;
  const top = y0 + TUBE.from + TUBE.length;
  // The stand behind the tube (in the item's colour: focus shows on it), the slide beside it.
  mesh(keep(new THREE.BoxGeometry(0.03, top - y0 + 0.02, 0.03)), painted).position.set(
    TUBE.x,
    y0 + (top - y0 + 0.02) / 2,
    -0.06,
  );
  mesh(keep(new THREE.BoxGeometry(0.02, top - y0, 0.02)), painted).position.set(
    RESERVOIR.x + 0.06,
    y0 + (top - y0) / 2,
    -0.04,
  );
  const tube = mesh(
    keep(new THREE.CylinderGeometry(TUBE.radius, TUBE.radius, TUBE.length, 20, 1, true)),
    glass,
  );
  tube.name = 'glass';
  tube.position.set(TUBE.x, y0 + TUBE.from + TUBE.length / 2, 0);
  // The scale: 0 at the tube's mouth, a tick each centimetre down.
  mesh(keep(new THREE.BoxGeometry(0.03, TUBE.length, 0.004)), white).position.set(
    TUBE.x - 0.045,
    y0 + TUBE.from + TUBE.length / 2,
    0.01,
  );
  const ticks: THREE.Matrix4[] = [];
  for (let cm = 0; cm <= 80; cm++) {
    const m = at(TUBE.x - 0.035, top - cm / 100, 0.0125);
    if (cm % 5 !== 0) m.scale(new THREE.Vector3(0.5, 1, 1));
    ticks.push(m);
  }
  copies(keep(new THREE.BoxGeometry(0.018, 0.0012, 0.001)), ink, ticks).castShadow = false;
  // The fork over the mouth, held on a clamp from the stand.
  for (const s of [-1, 1]) {
    mesh(keep(new THREE.BoxGeometry(0.007, 0.11, 0.007)), steel).position.set(
      TUBE.x + s * 0.009,
      top + 0.075,
      0,
    );
  }
  mesh(keep(new THREE.CylinderGeometry(0.004, 0.004, 0.05, 8)), steel).position.set(
    TUBE.x,
    top + 0.155,
    0,
  );
  mesh(keep(new THREE.BoxGeometry(0.01, 0.01, 0.06)), steel).position.set(
    TUBE.x,
    top + 0.17,
    -0.03,
  );
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

/** The water in the tube, the reservoir at the same level, the hose between them. */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(topOf(item));
  const y0 = BASE;
  const water = own(
    new THREE.MeshStandardMaterial({ color: '#7fb8d8', ...LOOKS.glass, opacity: 0.6 }),
  );
  const glass = own(new THREE.MeshStandardMaterial({ color: '#cfe8f0', ...GLASSWARE_LOOK }));
  const rubber = own(new THREE.MeshStandardMaterial({ color: '#3a3f46', ...LOOKS.rubber }));
  const column = mesh(
    keep(
      new THREE.CylinderGeometry(TUBE.radius - 0.002, TUBE.radius - 0.002, 1, 16).translate(
        0,
        0.5,
        0,
      ),
    ),
    water,
  );
  column.name = 'water';
  column.castShadow = false;
  column.position.set(TUBE.x, y0 + TUBE.from, 0);
  const reservoir = new THREE.Group();
  reservoir.name = 'reservoir';
  kit.group.add(reservoir);
  mesh(
    keep(
      new THREE.CylinderGeometry(RESERVOIR.radius, RESERVOIR.radius, RESERVOIR.height, 20, 1, true),
    ),
    glass,
    reservoir,
  ).name = 'vessel';
  mesh(
    keep(
      new THREE.CylinderGeometry(
        RESERVOIR.radius - 0.003,
        RESERVOIR.radius - 0.003,
        RESERVOIR.height / 2,
        16,
      ).translate(0, -RESERVOIR.height / 4, 0),
    ),
    water,
    reservoir,
  ).castShadow = false;
  // A hose down from the tube's foot to the bench, then up to the reservoir's foot (fixed length).
  mesh(keep(new THREE.CylinderGeometry(0.005, 0.005, TUBE.from, 8)), rubber).position.set(
    TUBE.x,
    y0 + TUBE.from / 2,
    0,
  );
  const hose = mesh(
    keep(new THREE.CylinderGeometry(0.005, 0.005, 1, 8).translate(0, 0.5, 0)),
    rubber,
  );
  hose.position.set(RESERVOIR.x, y0, 0);

  let l = NaN;
  const pose = ({ sample }: BenchPose) => {
    const next = Number.isFinite(sample.column) ? (sample.column ?? 0) : 0.05;
    if (next === l) return;
    l = next;
    const level = TUBE.from + TUBE.length - l; // the water's surface above the base
    column.scale.y = Math.max(level - TUBE.from, 0.001);
    reservoir.position.set(RESERVOIR.x, y0 + level, 0); // its water's surface at the same height
    hose.scale.y = Math.max(level - RESERVOIR.height / 2, 0.01);
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const resonanceTubeRig: BenchModel = {
  frame,
  rig,
  reads: ['column'],
  fullScale: { column: 0.8 },
};
