import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, slab } from '../assembly';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';
import { nameGlass } from './glassNames';

// The enthalpy of neutralisation (model `chemistry.neutralisation`, Phase X): a polystyrene cup
// nested in a beaker for support, a lid with a thermometer and a stirrer through it, and two
// measuring cylinders — the acid's (red label) and the base's (blue label). The rig: the
// cylinders full to their volumes before the run and empty after mixing, the cup's liquid at the
// mixture's volume once mixed, and the thermometer's red column between 10 and 50 °C at the
// model's `temperature`. Real sizes in metres; the item's floor at y = −h/2.

const BASE = 0.015;
const CUP = { x: -0.04, radius: 0.045, height: 0.11 };
const CYLINDER = { radius: 0.017, height: 0.2, x: [0.13, 0.2] as const };
/** 1 mL in a cylinder, and in the cup (taken straight-sided), this tall (m). */
const ML_CYLINDER = 1e-6 / (Math.PI * (CYLINDER.radius - 0.002) ** 2);
const ML_CUP = 1e-6 / (Math.PI * (CUP.radius - 0.003) ** 2);
const THERMO = { from: 10, to: 50, length: 0.2 };

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
  const foam = own(new THREE.MeshStandardMaterial({ color: '#f7f7f4', ...LOOKS.matte }));
  const red = own(new THREE.MeshStandardMaterial({ color: '#c8402f', ...LOOKS.matte }));
  const blue = own(new THREE.MeshStandardMaterial({ color: '#2f6fb3', ...LOOKS.matte }));
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  // The beaker holding the cup (in the item's colour would hide it: glass), the cup, its lid.
  mesh(
    keep(
      new THREE.CylinderGeometry(
        CUP.radius + 0.012,
        CUP.radius + 0.012,
        CUP.height * 0.7,
        24,
        1,
        true,
      ).translate(0, CUP.height * 0.35, 0),
    ),
    glass,
  ).position.set(CUP.x, BASE, 0);
  const cup = mesh(
    keep(
      new THREE.CylinderGeometry(CUP.radius, CUP.radius - 0.008, CUP.height, 24, 1, true).translate(
        0,
        CUP.height / 2,
        0,
      ),
    ),
    foam,
  );
  cup.name = 'cup';
  cup.position.set(CUP.x, BASE + 0.004, 0);
  const lid = mesh(
    keep(new THREE.CylinderGeometry(CUP.radius + 0.003, CUP.radius + 0.003, 0.008, 24)),
    painted,
  );
  lid.name = 'lid';
  lid.position.set(CUP.x, BASE + 0.004 + CUP.height + 0.004, 0);
  // The stirrer through the lid.
  mesh(keep(new THREE.CylinderGeometry(0.002, 0.002, CUP.height + 0.06, 8)), glass).position.set(
    CUP.x - 0.02,
    BASE + CUP.height / 2 + 0.04,
    0.01,
  );
  // The two measuring cylinders and their labels.
  CYLINDER.x.forEach((x, i) => {
    const c = mesh(
      keep(
        new THREE.CylinderGeometry(
          CYLINDER.radius,
          CYLINDER.radius,
          CYLINDER.height,
          20,
          1,
          true,
        ).translate(0, CYLINDER.height / 2, 0),
      ),
      glass,
    );
    c.name = i === 0 ? 'acid-cylinder' : 'base-cylinder';
    c.position.set(x, BASE + 0.008, 0);
    mesh(keep(new THREE.CylinderGeometry(0.028, 0.03, 0.008, 20)), glass).position.set(
      x,
      BASE + 0.004,
      0,
    );
    mesh(keep(new THREE.BoxGeometry(0.02, 0.03, 0.002)), i === 0 ? red : blue).position.set(
      x,
      BASE + 0.15,
      CYLINDER.radius + 0.001,
    );
  });
  nameGlass(kit.group, glass);
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const acidMaterial = own(
    new THREE.MeshStandardMaterial({ color: '#f1d9cf', ...LOOKS.glass, opacity: 0.6 }),
  );
  const baseMaterial = own(
    new THREE.MeshStandardMaterial({ color: '#d4e3f1', ...LOOKS.glass, opacity: 0.6 }),
  );
  const mixMaterial = own(
    new THREE.MeshStandardMaterial({ color: '#e6eef2', ...LOOKS.glass, opacity: 0.6 }),
  );
  const glass = own(new THREE.MeshStandardMaterial({ color: '#e8f4f8', ...GLASSWARE_LOOK }));
  const column = own(new THREE.MeshBasicMaterial({ color: '#d33b2c' }));
  const level = (radius: number, material: THREE.Material, name: string) => {
    const m = mesh(
      keep(new THREE.CylinderGeometry(radius, radius, 1, 18).translate(0, 0.5, 0)),
      material,
    );
    m.name = name;
    m.castShadow = false;
    return m;
  };
  const acid = level(CYLINDER.radius - 0.002, acidMaterial, 'acid');
  acid.position.set(CYLINDER.x[0], BASE + 0.008, 0);
  const base = level(CYLINDER.radius - 0.002, baseMaterial, 'base');
  base.position.set(CYLINDER.x[1], BASE + 0.008, 0);
  const mixture = level(CUP.radius - 0.004, mixMaterial, 'mixture');
  mixture.position.set(CUP.x, BASE + 0.006, 0);
  const thermometer = new THREE.Group();
  thermometer.name = 'thermometer';
  thermometer.position.set(CUP.x + 0.015, BASE + 0.02, 0);
  kit.group.add(thermometer);
  mesh(
    keep(
      new THREE.CylinderGeometry(0.004, 0.004, THERMO.length + 0.04, 10).translate(
        0,
        (THERMO.length + 0.04) / 2,
        0,
      ),
    ),
    glass,
    thermometer,
  ).castShadow = false;
  const red = mesh(
    keep(new THREE.CylinderGeometry(0.0016, 0.0016, 1, 6).translate(0, 0.5, 0)),
    column,
    thermometer,
  );
  red.castShadow = false;
  red.position.y = 0.012;

  const pose = ({ parameters, sample }: BenchPose) => {
    const mixed = Number.isFinite(sample.temperature);
    const va = parameters.acidVolume ?? 50;
    const vb = parameters.baseVolume ?? 50;
    acid.visible = !mixed;
    base.visible = !mixed;
    acid.scale.y = Math.max(0.001, va * ML_CYLINDER);
    base.scale.y = Math.max(0.001, vb * ML_CYLINDER);
    mixture.visible = mixed;
    mixture.scale.y = Math.max(0.001, Math.min(CUP.height - 0.01, (va + vb) * ML_CUP));
    const t = mixed ? (sample.temperature ?? 20) : 20;
    const share =
      (Math.min(Math.max(t, THERMO.from), THERMO.to) - THERMO.from) / (THERMO.to - THERMO.from);
    red.scale.y = 0.005 + share * (THERMO.length - 0.005);
  };
  nameGlass(kit.group, glass);
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const neutralisationCup: BenchModel = {
  frame,
  rig,
  reads: ['temperature'],
  fullScale: { temperature: 50 },
};
