import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { ORBITALS, radial } from '../../../simulation/models/orbitals';
import { Assembly, slab } from '../assembly';
import { LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// Atomic orbitals of hydrogen (model `chemistry.orbitals`, Phase X): a simulation table whose
// display holds the chosen orbital as a cloud of points — dense where the electron is likely to
// be (|ψ|², from the exact radial function and the orbital's angular part: s round, p_z two lobes,
// d_xy four), each point blue where ψ is positive and orange where it is negative, and a small
// nucleus at the centre. The cloud is drawn once per orbital (a fixed sequence: the same picture
// every time), scaled so the orbital's extent fits the display; a sphere marks the scan's radius r.

const BASE = 0.03;
const CENTRE_Y = 0.3;
const DISPLAY = 0.17; // the cloud's half-width (m)
const POINTS = 2400;
/** How far (a₀) each orbital is drawn: where almost all its electron density lies. */
const EXTENT = [5, 14, 12, 26, 26, 22] as const;

function originOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/** ψ (unnormalised in angle) at a point (a₀) for orbital `code`. */
function psi(code: number, x: number, y: number, z: number): number {
  const { n, l } = ORBITALS[code] ?? ORBITALS[0];
  const r = Math.hypot(x, y, z) || 1e-9;
  const angular = l === 0 ? 1 : l === 1 ? z / r : (x * y) / (r * r);
  return radial(n, l, r) * angular;
}

function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const dark = own(new THREE.MeshStandardMaterial({ color: '#141a22', ...LOOKS.satin }));
  const red = own(
    new THREE.MeshStandardMaterial({ color: '#d0402c', emissive: '#6a1a10', ...LOOKS.satin }),
  );
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  mesh(keep(new THREE.BoxGeometry(0.3, 0.04, 0.2)), painted).position.set(0, BASE + 0.02, 0);
  mesh(keep(new THREE.BoxGeometry(0.46, 0.46, 0.01)), dark).position.set(0, CENTRE_Y, -0.12);
  const nucleus = mesh(keep(new THREE.SphereGeometry(0.006, 12, 8)), red);
  nucleus.name = 'nucleus';
  nucleus.position.set(0, CENTRE_Y, 0);
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(originOf(item));
  const positions = new Float32Array(POINTS * 3);
  const colours = new Float32Array(POINTS * 3);
  const geometry = keep(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  const cloud = new THREE.Points(
    geometry,
    own(new THREE.PointsMaterial({ size: 0.004, vertexColors: true })),
  );
  cloud.name = 'cloud';
  cloud.position.set(0, CENTRE_Y, 0);
  cloud.frustumCulled = false;
  kit.group.add(cloud);
  const shell = mesh(
    keep(new THREE.SphereGeometry(1, 24, 16)),
    own(
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        wireframe: true,
        transparent: true,
        opacity: 0.25,
      }),
    ),
  );
  shell.name = 'radius';
  shell.castShadow = false;
  shell.position.set(0, CENTRE_Y, 0);
  const plus = new THREE.Color('#5aa8ff');
  const minus = new THREE.Color('#ff9a3c');
  let shown = -1;
  let scale = 1;

  const draw = (code: number) => {
    const extent = EXTENT[code] ?? 10;
    scale = DISPLAY / extent;
    let seed = 777 + code;
    const next = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
    // The densest |ψ|² on a coarse grid sets the rejection's ceiling (with a margin).
    let ceiling = 0;
    for (let i = 0; i < 4000; i++) {
      const v = psi(code, next() * extent, next() * extent, next() * extent);
      ceiling = Math.max(ceiling, v * v);
    }
    ceiling *= 1.5;
    let k = 0;
    for (let tries = 0; tries < 2_000_000 && k < POINTS; tries++) {
      const x = next() * extent;
      const y = next() * extent;
      const z = next() * extent;
      const v = psi(code, x, y, z);
      if (((next() + 1) / 2) * ceiling > v * v) continue;
      positions.set([x * scale, z * scale, y * scale], k * 3); // the p_z lobes upright
      const c = v >= 0 ? plus : minus;
      colours.set([c.r, c.g, c.b], k * 3);
      k++;
    }
    geometry.setDrawRange(0, k);
    (geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    geometry.computeBoundingSphere();
  };

  const pose = ({ parameters, sample }: BenchPose) => {
    const code = Math.round(parameters.orbital ?? 0);
    if (code !== shown) {
      shown = code;
      draw(code);
    }
    const r = Number.isFinite(sample.radius) ? (sample.radius ?? 0) / 52.9177210903 : 0;
    shell.visible = r > 0;
    shell.scale.setScalar(Math.max(1e-4, Math.min(r, EXTENT[code] ?? 10) * scale));
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const orbitalCloud: BenchModel = {
  frame,
  rig,
  reads: ['radius'],
  fullScale: { radius: 1000 },
};
