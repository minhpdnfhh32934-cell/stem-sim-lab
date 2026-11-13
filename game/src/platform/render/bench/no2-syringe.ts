import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, slab } from '../assembly';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// Le Chatelier's principle with nitrogen dioxide (model `chemistry.no2-equilibrium`, Phase X): a
// sealed glass gas syringe lying in a glass water bath, a thermometer in the water. The rig: the
// plunger where the gas's `volume` puts it, the gas brown by [NO₂] (`no2Concentration`: what an
// eye sees through 3 cm of it, 1 − e^(−k·c)), and the bath's water tinted from icy blue to warm
// orange by its `temperature`. Real sizes in metres; the item's floor at y = −h/2.

const BASE = 0.015;
const BATH = { width: 0.36, depth: 0.16, height: 0.12 };
const SYRINGE = { radius: 0.015, length: 0.16, y: 0.065, x0: -0.11 };
/** One mL of gas in the barrel is this long (m). */
const ML = 1e-6 / (Math.PI * (SYRINGE.radius - 0.0015) ** 2);
/** How dark the gas looks per mol/L of NO₂ through the barrel (1/(mol/L)). */
const TINT = 30;

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
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  // The bath: a glass trough (four walls and a floor).
  const trough = mesh(keep(new THREE.BoxGeometry(BATH.width, BATH.height, BATH.depth)), glass);
  trough.name = 'bath';
  trough.position.set(0, BASE + BATH.height / 2, 0);
  trough.castShadow = false;
  // The syringe's barrel, lying along x, its sealed tip on the left.
  const barrel = mesh(
    keep(
      new THREE.CylinderGeometry(
        SYRINGE.radius,
        SYRINGE.radius,
        SYRINGE.length,
        24,
        1,
        true,
      ).rotateZ(Math.PI / 2),
    ),
    glass,
  );
  barrel.name = 'syringe';
  barrel.position.set(SYRINGE.x0 + SYRINGE.length / 2, BASE + SYRINGE.y, 0);
  barrel.castShadow = false;
  const tip = mesh(
    keep(new THREE.CylinderGeometry(0.004, SYRINGE.radius, 0.02, 16).rotateZ(Math.PI / 2)),
    painted,
  );
  tip.name = 'seal';
  tip.position.set(SYRINGE.x0 - 0.01, BASE + SYRINGE.y, 0);
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const gasMaterial = own(
    new THREE.MeshStandardMaterial({
      color: '#8a3a10',
      ...LOOKS.matte,
      transparent: true,
      depthWrite: false,
      opacity: 0.3,
    }),
  );
  const waterMaterial = own(
    new THREE.MeshStandardMaterial({
      color: '#cfe7f0',
      ...LOOKS.glass,
      opacity: 0.35,
      depthWrite: false,
    }),
  );
  const rubber = own(new THREE.MeshStandardMaterial({ color: '#2b2f36', ...LOOKS.rubber }));
  const steel = own(new THREE.MeshStandardMaterial({ color: '#b4bcc4', ...LOOKS.metal }));
  const water = mesh(
    keep(new THREE.BoxGeometry(BATH.width - 0.008, BATH.height * 0.8, BATH.depth - 0.008)),
    waterMaterial,
  );
  water.name = 'water';
  water.castShadow = false;
  water.position.set(0, BASE + 0.004 + BATH.height * 0.4, 0);
  const gas = mesh(
    keep(
      new THREE.CylinderGeometry(SYRINGE.radius - 0.0015, SYRINGE.radius - 0.0015, 1, 20)
        .rotateZ(Math.PI / 2)
        .translate(0.5, 0, 0),
    ),
    gasMaterial,
  );
  gas.name = 'gas';
  gas.castShadow = false;
  gas.position.set(SYRINGE.x0, BASE + SYRINGE.y, 0);
  const plunger = new THREE.Group();
  plunger.name = 'plunger';
  kit.group.add(plunger);
  mesh(
    keep(
      new THREE.CylinderGeometry(
        SYRINGE.radius - 0.0015,
        SYRINGE.radius - 0.0015,
        0.008,
        20,
      ).rotateZ(Math.PI / 2),
    ),
    rubber,
    plunger,
  );
  mesh(
    keep(
      new THREE.CylinderGeometry(0.003, 0.003, 0.2, 8).rotateZ(Math.PI / 2).translate(0.1, 0, 0),
    ),
    steel,
    plunger,
  );
  const cold = new THREE.Color('#9fd0f0');
  const warm = new THREE.Color('#f0b080');
  const neutral = new THREE.Color('#d4ecf2');

  const pose = ({ parameters, sample }: BenchPose) => {
    const ran = Number.isFinite(sample.volume);
    const mL = ran ? (sample.volume ?? 40) : (parameters.startVolume ?? 40);
    const length = mL * ML;
    gas.scale.x = Math.max(0.001, length);
    plunger.position.set(SYRINGE.x0 + length + 0.004, BASE + SYRINGE.y, 0);
    const c = ran ? (sample.no2Concentration ?? 0) : 0.0108; // ≈ the 25 °C, 40 mL equilibrium
    gasMaterial.opacity = Math.min(0.92, 1 - Math.exp(-TINT * c));
    const t = ran ? (sample.temperature ?? 25) : 25;
    if (t <= 25) waterMaterial.color.lerpColors(cold, neutral, Math.max(0, t) / 25);
    else waterMaterial.color.lerpColors(neutral, warm, Math.min(1, (t - 25) / 55));
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const no2Syringe: BenchModel = {
  frame,
  rig,
  reads: ['volume', 'no2Concentration', 'temperature'],
  fullScale: { volume: 80, no2Concentration: 0.05, temperature: 80 },
};
