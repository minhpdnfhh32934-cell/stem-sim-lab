import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, slab } from '../assembly';
import { LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// Standing waves on a string: a vibration generator at the left, the string 1 m from its spindle
// over a pulley at the right, slotted masses hanging from it. The rig: the vibrating string drawn as
// the eye sees it, its envelope — ±A·|sin(nπx/L)|, n loops at the run's `amplitude` (a thin line
// without a run) — and the hanging masses for the dialled mass.

const BASE = 0.02;
const STRING = { from: -0.5, to: 0.5, y: 0.26 };
const POINTS = 161;
const SLOT = { mass: 0.1, radius: 0.025, height: 0.02 };
const MAX_SLOTS = 4;
const THREAD = 0.0007; // the band's least half-height: the string itself

function topOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/** The base (the entity's mesh), the generator, the pulley on its clamp. */
function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  const steel = own(new THREE.MeshStandardMaterial({ color: '#b4bcc4', ...LOOKS.metal }));
  const dark = own(new THREE.MeshStandardMaterial({ color: '#2b2f36', ...LOOKS.plastic }));
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  const y0 = -h / 2 + BASE;
  // The generator: its case in the item's colour, the spindle at the string's height.
  mesh(keep(slab(0.12, 0.12, STRING.y - 0.02, 0.01, 0.002)), painted).position.set(
    STRING.from - 0.07,
    y0,
    0,
  );
  mesh(keep(new THREE.CylinderGeometry(0.004, 0.004, 0.04, 8)), steel).position.set(
    STRING.from,
    y0 + STRING.y,
    0,
  );
  // The pulley on its clamp at the bench's edge.
  mesh(
    keep(new THREE.CylinderGeometry(0.025, 0.025, 0.012, 20).rotateX(Math.PI / 2)),
    steel,
  ).position.set(STRING.to + 0.025, y0 + STRING.y - 0.025, 0);
  mesh(keep(new THREE.BoxGeometry(0.02, STRING.y - 0.03, 0.02)), dark).position.set(
    STRING.to + 0.025,
    y0 + (STRING.y - 0.03) / 2,
    -0.02,
  );
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

/** The string's band and the hanging masses. */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(topOf(item));
  const y0 = BASE;
  const thread = own(
    new THREE.MeshStandardMaterial({ color: '#f2efe6', ...LOOKS.matte, side: THREE.DoubleSide }),
  );
  const brass = own(new THREE.MeshStandardMaterial({ color: '#c9a24a', ...LOOKS.metal }));
  // A strip of POINTS columns, two vertices each (top, bottom), in the x–y plane.
  const positions = new Float32Array(POINTS * 2 * 3);
  const index: number[] = [];
  for (let i = 0; i + 1 < POINTS; i++) {
    const [a, b, c, e] = [2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 3];
    index.push(a, b, c, b, e, c);
  }
  const geometry = keep(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(index);
  const band = mesh(geometry, thread);
  band.name = 'string';
  band.castShadow = false;
  band.position.set(0, y0 + STRING.y, 0);
  // The thread down from the pulley and the slotted masses on its hook.
  mesh(keep(new THREE.CylinderGeometry(0.0007, 0.0007, 0.1, 5)), thread).position.set(
    STRING.to + 0.05,
    y0 + STRING.y - 0.075,
    0,
  );
  const slots = Array.from({ length: MAX_SLOTS }, (_, k) => {
    const slot = mesh(
      keep(new THREE.CylinderGeometry(SLOT.radius, SLOT.radius, SLOT.height - 0.002, 18)),
      brass,
    );
    slot.position.set(STRING.to + 0.05, y0 + STRING.y - 0.135 - k * SLOT.height, 0);
    return slot;
  });

  let amplitude = NaN;
  let loops = NaN;
  let mass = NaN;
  const pose = ({ parameters, sample }: BenchPose) => {
    const n = parameters.loops ?? 2;
    const a = Number.isFinite(sample.amplitude) ? (sample.amplitude ?? 0) : 0;
    if (a !== amplitude || n !== loops) {
      amplitude = a;
      loops = n;
      const length = STRING.to - STRING.from;
      for (let i = 0; i < POINTS; i++) {
        const u = i / (POINTS - 1);
        const half = Math.max(a * Math.abs(Math.sin(n * Math.PI * u)), THREAD);
        const x = STRING.from + u * length;
        positions[i * 6] = x;
        positions[i * 6 + 1] = half;
        positions[i * 6 + 2] = 0;
        positions[i * 6 + 3] = x;
        positions[i * 6 + 4] = -half;
        positions[i * 6 + 5] = 0;
      }
      geometry.getAttribute('position').needsUpdate = true;
      geometry.computeBoundingSphere();
    }
    const m = parameters.hangingMass ?? 0.1;
    if (m !== mass) {
      mass = m;
      const shown = Math.round(m / SLOT.mass);
      for (let k = 0; k < slots.length; k++) {
        const slot = slots[k];
        if (slot) slot.visible = k < shown;
      }
    }
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const stringVibrator: BenchModel = {
  frame,
  rig,
  reads: ['amplitude'],
  fullScale: { amplitude: 0.012 },
};
