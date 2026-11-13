import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, slab, swaps } from '../assembly';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import { nameGlass } from './glassNames';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// Making soap (model `chemistry.saponification`, Phase X): a beaker on a hot plate holding the
// fat (a pale yellow layer on top) over sodium hydroxide solution, a glass stirring rod, and a
// dish of salt beside it for salting out. The rig: the plate glowing while it heats, the fat layer
// thinning by `fatLeft`, and a cloudy white layer of soap growing by `soap` (drawn by mass, as a
// loose curd). Real sizes in metres; the item's floor at y = −h/2.

const BASE = 0.015;
const PLATE = { x: -0.05, size: 0.17, height: 0.06 };
const BEAKER = { radius: 0.05, height: 0.12 };
const INNER = BEAKER.radius - 0.003;
const AREA = Math.PI * INNER * INNER;
/** Fat ≈ 0.9 g/cm³, the curd of soap ≈ 0.5 g/cm³ (loose): their layers' heights per gram (m). */
const FAT_PER_G = 1e-6 / 0.9 / AREA;
const SOAP_PER_G = 1e-6 / 0.5 / AREA;

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
  const salt = own(new THREE.MeshStandardMaterial({ color: '#f6f6f2', ...LOOKS.matte }));
  const china = own(new THREE.MeshStandardMaterial({ color: '#ededea', ...LOOKS.satin }));
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  const plate = mesh(keep(new THREE.BoxGeometry(PLATE.size, PLATE.height, PLATE.size)), painted);
  plate.name = 'hot-plate';
  plate.position.set(PLATE.x, BASE + PLATE.height / 2, 0);
  const beaker = mesh(
    keep(
      new THREE.CylinderGeometry(
        BEAKER.radius,
        BEAKER.radius,
        BEAKER.height,
        26,
        1,
        true,
      ).translate(0, BEAKER.height / 2, 0),
    ),
    glass,
  );
  beaker.name = 'beaker';
  beaker.position.set(PLATE.x, BASE + PLATE.height + 0.004, 0);
  beaker.castShadow = false;
  const rod = mesh(keep(new THREE.CylinderGeometry(0.003, 0.003, 0.2, 8)), glass);
  rod.position.set(PLATE.x + 0.02, BASE + PLATE.height + 0.1, 0.01);
  rod.rotation.z = -0.25;
  const dish = mesh(keep(new THREE.CylinderGeometry(0.045, 0.035, 0.02, 20)), china);
  dish.name = 'salt-dish';
  dish.position.set(0.14, BASE + 0.01, 0.02);
  mesh(
    keep(new THREE.SphereGeometry(0.03, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.4, 1)),
    salt,
  ).position.set(0.14, BASE + 0.02, 0.02);
  nameGlass(kit.group, glass);
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const top = BASE + PLATE.height;
  const cold = own(new THREE.MeshStandardMaterial({ color: '#30353c', ...LOOKS.satin }));
  const hot = own(
    new THREE.MeshStandardMaterial({
      color: '#5a2a1a',
      emissive: '#ff5a1e',
      emissiveIntensity: 0.8,
    }),
  );
  const lye = own(
    new THREE.MeshStandardMaterial({ color: '#dceef4', ...LOOKS.glass, opacity: 0.55 }),
  );
  const fat = own(new THREE.MeshStandardMaterial({ color: '#f1e3a8', ...LOOKS.satin }));
  const curd = own(new THREE.MeshStandardMaterial({ color: '#f8f8f2', ...LOOKS.matte }));
  const element = mesh(keep(new THREE.CylinderGeometry(0.065, 0.065, 0.004, 28)), cold);
  element.name = 'element';
  swaps(element, hot);
  element.position.set(PLATE.x, top + 0.002, 0);
  const layer = (material: THREE.Material, name: string) => {
    const m = mesh(
      keep(new THREE.CylinderGeometry(INNER, INNER, 1, 22).translate(0, 0.5, 0)),
      material,
    );
    m.name = name;
    m.castShadow = false;
    return m;
  };
  const solution = layer(lye, 'hydroxide');
  solution.scale.y = 0.04;
  solution.position.set(PLATE.x, top + 0.006, 0);
  const soap = layer(curd, 'soap');
  const oil = layer(fat, 'fat');

  const pose = ({ status, parameters, sample }: BenchPose) => {
    element.material = status === 'running' ? hot : cold;
    const ran = Number.isFinite(sample.fatLeft);
    const fatG = ran ? (sample.fatLeft ?? 0) : (parameters.fatMass ?? 10);
    const soapG = ran ? (sample.soap ?? 0) : 0;
    const y0 = top + 0.006 + solution.scale.y;
    soap.visible = soapG > 0.01;
    soap.scale.y = Math.max(0.0005, soapG * SOAP_PER_G);
    soap.position.set(PLATE.x, y0, 0);
    oil.visible = fatG > 0.01;
    oil.scale.y = Math.max(0.0005, fatG * FAT_PER_G);
    oil.position.set(PLATE.x, y0 + (soap.visible ? soap.scale.y : 0), 0);
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const soapPot: BenchModel = {
  frame,
  rig,
  reads: ['fatLeft', 'soap'],
  fullScale: { fatLeft: 20, soap: 20 },
};
