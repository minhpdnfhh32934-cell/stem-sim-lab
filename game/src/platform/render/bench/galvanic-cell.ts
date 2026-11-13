import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { HALF_CELLS, PAIRS } from '../../../simulation/models/galvanicCell';
import { Assembly, slab } from '../assembly';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';
import { nameGlass } from './glassNames';

// A galvanic cell (model `chemistry.galvanic-cell`, Phase X): two beakers, each with a metal strip
// standing in a solution of its own ions, joined by a salt bridge (an inverted U-tube), the strips
// wired to a voltmeter with a needle (0–3 V). The rig: each strip in its metal's colour and each
// solution in its ions' (copper(II) blue by its concentration, iron(II) pale green, the others
// colourless) for the dialled pair, and the needle at the model's `reading`. Real sizes in metres;
// the item's floor at y = −h/2.

const BASE = 0.015;
const BEAKER = { x: 0.11, radius: 0.04, height: 0.1 };
const STRIP = { width: 0.02, height: 0.13, thickness: 0.002 };
const METER = { x: 0, z: -0.08, width: 0.12, height: 0.09, depth: 0.05, y: 0.16 };
const FULL_SCALE = 3; // V
const SWEEP = (100 * Math.PI) / 180; // the needle's travel across the dial

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
  const white = own(new THREE.MeshStandardMaterial({ color: '#f2f2ee', ...LOOKS.matte }));
  const wire = own(new THREE.MeshStandardMaterial({ color: '#c0392b', ...LOOKS.rubber }));
  const black = own(new THREE.MeshStandardMaterial({ color: '#1f2328', ...LOOKS.rubber }));
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  for (const [s, name] of [
    [-1, 'left-beaker'],
    [1, 'right-beaker'],
  ] as const) {
    const beaker = mesh(
      keep(
        new THREE.CylinderGeometry(
          BEAKER.radius,
          BEAKER.radius,
          BEAKER.height,
          24,
          1,
          true,
        ).translate(0, BEAKER.height / 2, 0),
      ),
      glass,
    );
    beaker.name = name;
    beaker.position.set(s * BEAKER.x, BASE, 0);
    beaker.castShadow = false;
  }
  // The salt bridge: an inverted U of glass, its arms in both solutions.
  const bridge = new THREE.Group();
  bridge.name = 'salt-bridge';
  kit.group.add(bridge);
  const arm = keep(new THREE.CylinderGeometry(0.006, 0.006, 0.09, 12));
  for (const s of [-1, 1])
    mesh(arm, glass, bridge).position.set(s * (BEAKER.x - 0.02), BASE + 0.095, 0.015);
  mesh(
    keep(new THREE.CylinderGeometry(0.006, 0.006, 2 * (BEAKER.x - 0.02), 12).rotateZ(Math.PI / 2)),
    glass,
    bridge,
  ).position.set(0, BASE + 0.14, 0.015);
  mesh(keep(new THREE.CylinderGeometry(0.004, 0.004, 0.08, 8)), white, bridge).position.set(
    -(BEAKER.x - 0.02),
    BASE + 0.07,
    0.015,
  );
  // The voltmeter (its case in the item's colour: focus shows on it), its dial face.
  const meter = mesh(keep(new THREE.BoxGeometry(METER.width, METER.height, METER.depth)), painted);
  meter.name = 'voltmeter';
  meter.position.set(METER.x, BASE + METER.y, METER.z);
  mesh(keep(new THREE.PlaneGeometry(METER.width - 0.02, METER.height - 0.025)), white).position.set(
    METER.x,
    BASE + METER.y + 0.005,
    METER.z + METER.depth / 2 + 0.001,
  );
  // The leads: red from the right strip, black from the left, up to the meter's terminals.
  for (const [s, material] of [
    [-1, black],
    [1, wire],
  ] as const) {
    const lead = mesh(keep(new THREE.CylinderGeometry(0.0025, 0.0025, 0.12, 8)), material);
    lead.position.set(s * (BEAKER.x - 0.045), BASE + 0.15, -0.045);
    lead.rotation.z = s * 0.9;
    lead.castShadow = false;
  }
  nameGlass(kit.group, glass);
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const metal = [0, 1].map(() =>
    own(new THREE.MeshStandardMaterial({ ...LOOKS.metal, color: '#aaaaaa' })),
  );
  const liquid = [0, 1].map(() =>
    own(new THREE.MeshStandardMaterial({ ...LOOKS.glass, opacity: 0.6, color: '#d4ecf2' })),
  );
  const needleMaterial = own(new THREE.MeshBasicMaterial({ color: '#c0392b' }));
  [-1, 1].forEach((s, i) => {
    const strip = mesh(
      keep(
        new THREE.BoxGeometry(STRIP.width, STRIP.height, STRIP.thickness).translate(
          0,
          STRIP.height / 2,
          0,
        ),
      ),
      metal[i] as THREE.Material,
    );
    strip.name = i === 0 ? 'left-electrode' : 'right-electrode';
    strip.position.set(s * BEAKER.x - s * 0.012, BASE + 0.01, -0.01);
  });
  [-1, 1].forEach((s, i) => {
    const m = mesh(
      keep(
        new THREE.CylinderGeometry(
          BEAKER.radius - 0.003,
          BEAKER.radius - 0.003,
          0.07,
          22,
        ).translate(0, 0.035, 0),
      ),
      liquid[i] as THREE.Material,
    );
    m.name = i === 0 ? 'left-solution' : 'right-solution';
    m.castShadow = false;
    m.position.set(s * BEAKER.x, BASE + 0.003, 0);
  });
  const needle = mesh(
    keep(new THREE.BoxGeometry(0.002, 0.045, 0.001).translate(0, 0.0225, 0)),
    needleMaterial,
  );
  needle.name = 'needle';
  needle.position.set(METER.x, BASE + METER.y - 0.025, METER.z + METER.depth / 2 + 0.003);
  const blue = new THREE.Color('#2f78c4');
  const clear = new THREE.Color('#d4ecf2');
  const green = new THREE.Color('#c6e2b5');

  const pose = ({ parameters, sample }: BenchPose) => {
    const pair = PAIRS[Math.round(parameters.pair ?? 0)] ?? PAIRS[0];
    const concentrations = [parameters.leftConcentration ?? 1, parameters.rightConcentration ?? 1];
    pair?.forEach((index, i) => {
      const cell = HALF_CELLS[index];
      (metal[i] as THREE.MeshStandardMaterial).color.setHex(cell?.rgb ?? 0xaaaaaa);
      const c = concentrations[i] ?? 1;
      const tint = cell?.metal === 'Cu' ? blue : cell?.metal === 'Fe' ? green : clear;
      // Deeper with the concentration: 1 mol/L full, 0.0001 mol/L clear (by its lg).
      (liquid[i] as THREE.MeshStandardMaterial).color.lerpColors(
        clear,
        tint,
        Math.max(0, (Math.log10(c) + 4) / 4),
      );
    });
    const v = Number.isFinite(sample.reading) ? (sample.reading ?? 0) : 0;
    needle.rotation.z = SWEEP / 2 - (Math.min(Math.max(v, 0), FULL_SCALE) / FULL_SCALE) * SWEEP;
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const galvanicCell: BenchModel = {
  frame,
  rig,
  reads: ['reading'],
  fullScale: { reading: 3 },
};
