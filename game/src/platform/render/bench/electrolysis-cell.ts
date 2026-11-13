import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, slab } from '../assembly';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// Electrolysis of copper(II) sulfate (model `chemistry.electrolysis`, Phase X): a beaker of blue
// copper sulfate solution with two copper plates on an insulating bar — the cathode on the left
// (to the supply's −), the anode on the right (+) — and a DC supply with an ammeter. The rig: the
// cathode's fresh salmon-pink copper growing by `cathodeGain`, the anode thinning by `anodeLoss`
// (both drawn thicker than true, 1 mm per 0.1 g, so the change shows), and the ammeter's needle
// at the dialled current while the run goes. Real sizes in metres; the item's floor at y = −h/2.

const BASE = 0.015;
const BEAKER = { x: -0.06, radius: 0.06, height: 0.13 };
const PLATE = { width: 0.035, height: 0.11, thickness: 0.0015, gap: 0.05 };
const SUPPLY = { x: 0.16, width: 0.14, height: 0.09, depth: 0.12 };
/** The plates' change drawn this thick per gram (m/g): far thicker than true, to be seen. */
const SHOWN_PER_G = 0.01;
const FULL_SCALE = 2; // A
const SWEEP = (100 * Math.PI) / 180;

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
  const solution = own(
    new THREE.MeshStandardMaterial({ color: '#3f86c9', ...LOOKS.glass, opacity: 0.6 }),
  );
  const bar = own(new THREE.MeshStandardMaterial({ color: '#2b2f36', ...LOOKS.plastic }));
  const white = own(new THREE.MeshStandardMaterial({ color: '#f2f2ee', ...LOOKS.matte }));
  const red = own(new THREE.MeshStandardMaterial({ color: '#c0392b', ...LOOKS.rubber }));
  const black = own(new THREE.MeshStandardMaterial({ color: '#1f2328', ...LOOKS.rubber }));
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  const beaker = mesh(
    keep(
      new THREE.CylinderGeometry(
        BEAKER.radius,
        BEAKER.radius,
        BEAKER.height,
        28,
        1,
        true,
      ).translate(0, BEAKER.height / 2, 0),
    ),
    glass,
  );
  beaker.name = 'beaker';
  beaker.position.set(BEAKER.x, BASE, 0);
  beaker.castShadow = false;
  const liquid = mesh(
    keep(
      new THREE.CylinderGeometry(BEAKER.radius - 0.003, BEAKER.radius - 0.003, 0.1, 24).translate(
        0,
        0.05,
        0,
      ),
    ),
    solution,
  );
  liquid.name = 'solution';
  liquid.castShadow = false;
  liquid.position.set(BEAKER.x, BASE + 0.003, 0);
  mesh(keep(new THREE.BoxGeometry(0.15, 0.012, 0.02)), bar).position.set(
    BEAKER.x,
    BASE + BEAKER.height + 0.012,
    0,
  );
  // The supply (its case in the item's colour: focus shows on it), its meter face.
  const supply = mesh(
    keep(new THREE.BoxGeometry(SUPPLY.width, SUPPLY.height, SUPPLY.depth)),
    painted,
  );
  supply.name = 'supply';
  supply.position.set(SUPPLY.x, BASE + SUPPLY.height / 2, 0);
  mesh(keep(new THREE.PlaneGeometry(0.08, 0.05)), white).position.set(
    SUPPLY.x,
    BASE + SUPPLY.height * 0.62,
    SUPPLY.depth / 2 + 0.001,
  );
  // Leads: black (−) to the cathode on the left, red (+) to the anode on the right.
  for (const [x, material] of [
    [-PLATE.gap / 2, black],
    [PLATE.gap / 2, red],
  ] as const) {
    const lead = mesh(
      keep(new THREE.CylinderGeometry(0.0025, 0.0025, 0.2, 8).rotateZ(Math.PI / 2)),
      material,
    );
    lead.position.set(
      (BEAKER.x + x + SUPPLY.x) / 2,
      BASE + BEAKER.height + 0.03 + (x > 0 ? 0.01 : 0),
      0.01,
    );
    lead.castShadow = false;
  }
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const copper = own(new THREE.MeshStandardMaterial({ color: '#b87333', ...LOOKS.metal }));
  const fresh = own(new THREE.MeshStandardMaterial({ color: '#e8957a', ...LOOKS.matte }));
  const needleMaterial = own(new THREE.MeshBasicMaterial({ color: '#c0392b' }));
  const plate = keep(
    new THREE.BoxGeometry(1, PLATE.height, PLATE.width).translate(0, PLATE.height / 2, 0),
  );
  const cathode = mesh(plate, copper);
  cathode.name = 'cathode';
  cathode.scale.x = PLATE.thickness;
  cathode.position.set(BEAKER.x - PLATE.gap / 2, BASE + 0.03, 0);
  const deposit = mesh(plate, fresh);
  deposit.name = 'deposit';
  deposit.castShadow = false;
  const anode = mesh(plate, copper);
  anode.name = 'anode';
  anode.position.set(BEAKER.x + PLATE.gap / 2, BASE + 0.03, 0);
  const needle = mesh(
    keep(new THREE.BoxGeometry(0.0018, 0.035, 0.001).translate(0, 0.0175, 0)),
    needleMaterial,
  );
  needle.name = 'ammeter';
  needle.position.set(SUPPLY.x, BASE + SUPPLY.height * 0.62 - 0.02, SUPPLY.depth / 2 + 0.003);

  const pose = ({ status, parameters, sample }: BenchPose) => {
    const ran = Number.isFinite(sample.cathodeGain);
    const gained = ran ? (sample.cathodeGain ?? 0) : 0;
    const lost = ran ? (sample.anodeLoss ?? 0) : 0;
    // The deposit on the cathode's face towards the anode; the anode thinner on its face.
    const layer = Math.max(0.0001, gained * SHOWN_PER_G);
    deposit.visible = gained > 0;
    deposit.scale.x = layer;
    deposit.position.set(
      BEAKER.x - PLATE.gap / 2 + PLATE.thickness / 2 + layer / 2,
      BASE + 0.03,
      0,
    );
    anode.scale.x = Math.max(0.0003, PLATE.thickness + 0.004 - lost * SHOWN_PER_G);
    const current = status === 'running' ? (parameters.current ?? 0) : 0;
    needle.rotation.z = SWEEP / 2 - (Math.min(current, FULL_SCALE) / FULL_SCALE) * SWEEP;
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const electrolysisCell: BenchModel = {
  frame,
  rig,
  reads: ['cathodeGain', 'anodeLoss'],
  fullScale: { cathodeGain: 0.6, anodeLoss: 0.6 },
};
