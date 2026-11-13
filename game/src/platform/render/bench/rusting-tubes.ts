import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { TUBES } from '../../../simulation/models/corrosion';
import { Assembly, slab } from '../assembly';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';
import { nameGlass } from './glassNames';

// Conditions for rusting (model `chemistry.corrosion`, Phase X): a rack of six stoppered tubes,
// each an iron nail in its conditions — tap water, dry air over white calcium chloride, boiled
// water under a layer of oil, salt water, the nail wrapped in copper wire, the nail wrapped in
// zinc — and the dialled tube standing out at the front, larger. The rig: the front nail going
// from bright grey to rust brown by `rust`, its zinc wrap turning white by `zincCorroded`, and
// the front tube's contents those of the dialled conditions. Real sizes in metres.

const BASE = 0.015;
const RACK = { z: -0.07, width: 0.36, depth: 0.06, height: 0.06 };
const SLOT = (i: number) => -0.15 + i * 0.06;
const FRONT = { x: 0, z: 0.06, radius: 0.016, height: 0.15 };
const NAIL = { radius: 0.0022, length: 0.075 };

function originOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const glass = own(new THREE.MeshStandardMaterial({ color: '#d8eef4', ...GLASSWARE_LOOK }));
  const steel = own(new THREE.MeshStandardMaterial({ color: '#8f969c', ...LOOKS.metal }));
  const water = own(
    new THREE.MeshStandardMaterial({ color: '#d4e8f0', ...LOOKS.glass, opacity: 0.5 }),
  );
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  const rack = mesh(keep(new THREE.BoxGeometry(RACK.width, RACK.height, RACK.depth)), painted);
  rack.name = 'rack';
  rack.position.set(0, BASE + RACK.height / 2, RACK.z);
  // The six reference tubes in the rack, each with its nail (no run: as set up on day 0).
  const tube = keep(
    new THREE.CylinderGeometry(0.01, 0.01, 0.11, 14, 1, true).translate(0, 0.055, 0),
  );
  const nail = keep(new THREE.CylinderGeometry(0.0016, 0.0016, 0.06, 6).translate(0, 0.03, 0));
  const liquid = keep(new THREE.CylinderGeometry(0.0088, 0.0088, 0.05, 12).translate(0, 0.025, 0));
  TUBES.forEach((t, i) => {
    const x = SLOT(i);
    const g = mesh(tube, glass);
    g.position.set(x, BASE + 0.01, RACK.z);
    g.castShadow = false;
    mesh(nail, steel).position.set(x, BASE + 0.015, RACK.z);
    if (t.rate > 0 || t.zinc) {
      const l = mesh(liquid, water);
      l.position.set(x, BASE + 0.012, RACK.z);
      l.castShadow = false;
    }
  });
  const front = mesh(
    keep(
      new THREE.CylinderGeometry(FRONT.radius, FRONT.radius, FRONT.height, 22, 1, true).translate(
        0,
        FRONT.height / 2,
        0,
      ),
    ),
    glass,
  );
  front.name = 'test-tube';
  front.position.set(FRONT.x, BASE, FRONT.z);
  front.castShadow = false;
  nameGlass(kit.group, glass);
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const iron = own(new THREE.MeshStandardMaterial({ color: '#9aa1a8', ...LOOKS.metal }));
  const zinc = own(new THREE.MeshStandardMaterial({ color: '#c3c8cc', ...LOOKS.satin }));
  const copper = own(new THREE.MeshStandardMaterial({ color: '#b87333', ...LOOKS.metal }));
  const water = own(
    new THREE.MeshStandardMaterial({ color: '#d4e8f0', ...LOOKS.glass, opacity: 0.5 }),
  );
  const oil = own(
    new THREE.MeshStandardMaterial({ color: '#e8c860', ...LOOKS.glass, opacity: 0.7 }),
  );
  const drier = own(new THREE.MeshStandardMaterial({ color: '#f4f4f0', ...LOOKS.matte }));
  const nail = mesh(
    keep(
      new THREE.CylinderGeometry(NAIL.radius, NAIL.radius, NAIL.length, 8).translate(
        0,
        NAIL.length / 2,
        0,
      ),
    ),
    iron,
  );
  nail.name = 'nail';
  nail.position.set(FRONT.x, BASE + 0.02, FRONT.z);
  const wrap = mesh(
    keep(new THREE.TorusGeometry(NAIL.radius + 0.0015, 0.0012, 6, 14).rotateX(Math.PI / 2)),
    copper,
  );
  wrap.name = 'wrap';
  const wraps = [0.015, 0.025, 0.035].map((y) => {
    const m = mesh(wrap.geometry, copper);
    m.position.set(FRONT.x, BASE + 0.02 + y, FRONT.z);
    return m;
  });
  wrap.visible = false;
  const content = mesh(
    keep(
      new THREE.CylinderGeometry(FRONT.radius - 0.0015, FRONT.radius - 0.0015, 1, 18).translate(
        0,
        0.5,
        0,
      ),
    ),
    water,
  );
  content.name = 'conditions';
  content.castShadow = false;
  content.position.set(FRONT.x, BASE + 0.003, FRONT.z);
  const layer = mesh(
    keep(new THREE.CylinderGeometry(FRONT.radius - 0.0015, FRONT.radius - 0.0015, 0.008, 18)),
    oil,
  );
  layer.castShadow = false;
  const bright = new THREE.Color('#9aa1a8');
  const rusted = new THREE.Color('#8a4a22');
  const fresh = new THREE.Color('#c3c8cc');
  const white = new THREE.Color('#f2f2ee');

  const pose = ({ parameters, sample }: BenchPose) => {
    const t = TUBES[Math.round(parameters.tube ?? 0)] ?? TUBES[0];
    const ran = Number.isFinite(sample.rust);
    iron.color.lerpColors(bright, rusted, ran ? Math.min(1, sample.rust ?? 0) : 0);
    zinc.color.lerpColors(fresh, white, ran ? Math.min(1, sample.zincCorroded ?? 0) : 0);
    const metal = t.zinc ? zinc : copper;
    const wrapped = t.conditions.startsWith('wrapped');
    for (const m of wraps) {
      m.visible = wrapped;
      m.material = metal;
    }
    // The tube's contents: water (tap, salt, under the wraps), boiled water under oil, or the drier.
    const dry = t.conditions.startsWith('dry');
    content.material = dry ? drier : water;
    content.scale.y = dry ? 0.015 : 0.09;
    layer.visible = t.conditions.includes('oil');
    layer.position.set(FRONT.x, BASE + 0.003 + 0.09 + 0.004, FRONT.z);
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const rustingTubes: BenchModel = {
  frame,
  rig,
  reads: ['rust', 'zincCorroded'],
};
