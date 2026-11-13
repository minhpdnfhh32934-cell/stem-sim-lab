import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, slab } from '../assembly';
import { LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// Radioactive decay (a simulation): a sealed source in its holder facing a Geiger–Müller tube on a
// clamp, the tube's lead to a counter. The rig is the counter's lamp, lit with the run's last
// `countRate`.

const BASE = 0.02;
const FULL_RATE = 50; // counts per second that light the lamp fully

function topOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  const y0 = -h / 2 + BASE;
  const steel = own(new THREE.MeshStandardMaterial({ color: '#c9ced3', ...LOOKS.metal }));
  const dark = own(new THREE.MeshStandardMaterial({ color: '#2b2f36', ...LOOKS.plastic }));
  const lead = own(new THREE.MeshStandardMaterial({ color: '#6d727a', ...LOOKS.satin }));
  const screen = own(
    new THREE.MeshStandardMaterial({
      color: '#1f3b2c',
      emissive: '#3fae6a',
      emissiveIntensity: 0.6,
    }),
  );
  // The source holder: a lead block with the sealed source facing +x.
  mesh(keep(new THREE.BoxGeometry(0.06, 0.08, 0.06)), lead).position.set(-0.17, y0 + 0.04, 0);
  mesh(
    keep(new THREE.CylinderGeometry(0.01, 0.01, 0.012, 16).rotateZ(Math.PI / 2)),
    steel,
  ).position.set(-0.134, y0 + 0.06, 0);
  // The clamp stand (the item's colour) and the GM tube, its window towards the source.
  mesh(keep(new THREE.BoxGeometry(0.02, 0.14, 0.02)), painted).position.set(
    -0.04,
    y0 + 0.07,
    -0.06,
  );
  mesh(keep(new THREE.BoxGeometry(0.012, 0.012, 0.06)), steel).position.set(
    -0.04,
    y0 + 0.06,
    -0.03,
  );
  mesh(
    keep(new THREE.CylinderGeometry(0.011, 0.011, 0.1, 16).rotateZ(Math.PI / 2)),
    steel,
  ).position.set(-0.06, y0 + 0.06, 0);
  // The counter (scaler) and its display.
  mesh(keep(new THREE.BoxGeometry(0.16, 0.09, 0.12)), dark).position.set(0.14, y0 + 0.045, 0);
  mesh(keep(new THREE.BoxGeometry(0.1, 0.025, 0.002)), screen).position.set(0.14, y0 + 0.06, 0.061);
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  kit.group.position.copy(topOf(item));
  const glow = kit.own(
    new THREE.MeshStandardMaterial({ color: '#5a1d16', emissive: '#ff4a2e', emissiveIntensity: 0 }),
  );
  const lamp = kit.mesh(kit.keep(new THREE.SphereGeometry(0.008, 12, 8)), glow);
  lamp.name = 'lamp';
  lamp.castShadow = false;
  lamp.position.set(0.19, BASE + 0.03, 0.06);
  let r = NaN;
  const pose = ({ sample }: BenchPose) => {
    const next = Number.isFinite(sample.countRate) ? (sample.countRate ?? 0) : 0;
    if (next === r) return;
    r = next;
    glow.emissiveIntensity = Math.min(r / FULL_RATE, 1) * 1.5;
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

/** The radioactivity station: a source, a GM tube and a counter. */
export const decayCounterBench: BenchModel = {
  frame,
  rig,
  reads: ['countRate'],
  fullScale: { countRate: 50 },
};
