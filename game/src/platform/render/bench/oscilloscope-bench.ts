import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, at, slab } from '../assembly';
import { LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// Measuring a sound's frequency: a tuning fork on its wooden resonance box, a microphone on a
// stand in front of it, a cable to an oscilloscope whose green screen shows the tone over 10
// divisions of its time base. The rig: the trace — the model's own signal, sin(2πft) across the
// screen at the dialled time base (redrawn only when f or the time base changes), its height with
// the run's `envelope` (flat without a run).

const BASE = 0.02;
const SCOPE = { x: 0.12, width: 0.36, height: 0.22, depth: 0.28 };
const SCREEN = { width: 0.2, height: 0.16, divisions: 10, rows: 8 };
const TRACE_POINTS = 600;
const V0 = 2; // the signal's amplitude at the strike (V): its peaks reach 2 of the screen's 4 half-rows

function topOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/** The base (the entity's mesh), the scope's case and screen grid, the fork, its box, the microphone. */
function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh, copies } = kit;
  const dark = own(new THREE.MeshStandardMaterial({ color: '#2b2f36', ...LOOKS.plastic }));
  const screen = own(new THREE.MeshBasicMaterial({ color: '#0f2a1c' })); // reads at any light
  const grid = own(new THREE.MeshBasicMaterial({ color: '#2f5c43' }));
  const steel = own(new THREE.MeshStandardMaterial({ color: '#c9ced3', ...LOOKS.metal }));
  const wood = own(new THREE.MeshStandardMaterial({ color: '#b08a5a', ...LOOKS.matte }));
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  const y0 = -h / 2 + BASE;
  // The scope: its case in the item's colour (focus shows), the screen on its front.
  mesh(keep(slab(SCOPE.width, SCOPE.depth, SCOPE.height, 0.012, 0.003)), painted).position.set(
    SCOPE.x,
    y0,
    0,
  );
  const front = SCOPE.depth / 2 + 0.001;
  const sy = y0 + SCOPE.height / 2 + 0.02;
  const sx = SCOPE.x - 0.05;
  const face = mesh(keep(new THREE.PlaneGeometry(SCREEN.width, SCREEN.height)), screen);
  face.position.set(sx, sy, front);
  face.castShadow = false;
  const lines: THREE.Matrix4[] = [];
  for (let i = 0; i <= SCREEN.divisions; i++) {
    const m = at(sx - SCREEN.width / 2 + (i * SCREEN.width) / SCREEN.divisions, sy, front + 0.0005);
    m.scale(new THREE.Vector3(1, SCREEN.height, 1));
    lines.push(m);
  }
  for (let j = 0; j <= SCREEN.rows; j++) {
    const m = at(
      sx,
      sy - SCREEN.height / 2 + (j * SCREEN.height) / SCREEN.rows,
      front + 0.0005,
      0,
      0,
      Math.PI / 2,
    );
    m.scale(new THREE.Vector3(1, SCREEN.width, 1));
    lines.push(m);
  }
  copies(keep(new THREE.PlaneGeometry(0.0008, 1)), grid, lines).castShadow = false;
  // Its knobs beside the screen.
  const knobs: THREE.Matrix4[] = [0, 1, 2, 3].map((i) =>
    at(SCOPE.x + 0.11, sy + 0.05 - i * 0.035, front + 0.006, Math.PI / 2, 0, 0),
  );
  copies(keep(new THREE.CylinderGeometry(0.011, 0.011, 0.012, 14)), dark, knobs);
  // The fork on its resonance box, and the microphone on its stand facing it.
  mesh(keep(new THREE.BoxGeometry(0.18, 0.07, 0.08)), wood).position.set(-0.24, y0 + 0.035, 0);
  for (const s of [-1, 1]) {
    mesh(keep(new THREE.BoxGeometry(0.008, 0.13, 0.008)), steel).position.set(
      -0.24 + s * 0.01,
      y0 + 0.07 + 0.09,
      0,
    );
  }
  mesh(keep(new THREE.CylinderGeometry(0.004, 0.004, 0.03, 8)), steel).position.set(
    -0.24,
    y0 + 0.085,
    0,
  );
  mesh(keep(new THREE.CylinderGeometry(0.004, 0.004, 0.16, 8)), dark).position.set(
    -0.08,
    y0 + 0.08,
    0.05,
  );
  mesh(keep(new THREE.CapsuleGeometry(0.012, 0.04, 4, 10).rotateZ(Math.PI / 2)), dark).position.set(
    -0.11,
    y0 + 0.16,
    0.05,
  );
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

/** The trace on the screen. */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own } = kit;
  kit.group.position.copy(topOf(item));
  const green = own(new THREE.LineBasicMaterial({ color: '#7dffb0' }));
  const positions = new Float32Array(TRACE_POINTS * 3);
  const geometry = keep(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const trace = new THREE.Line(geometry, green);
  trace.name = 'trace';
  trace.position.set(SCOPE.x - 0.05, BASE + SCOPE.height / 2 + 0.02, SCOPE.depth / 2 + 0.003);
  trace.castShadow = false;
  kit.group.add(trace);

  let f = NaN;
  let base = NaN;
  let level = NaN;
  const pose = ({ parameters, sample }: BenchPose) => {
    const nf = parameters.frequency ?? 440;
    const nb = parameters.timeBase ?? 0.0005;
    if (nf !== f || nb !== base) {
      f = nf;
      base = nb;
      const span = SCREEN.divisions * base; // the screen's time (s)
      for (let i = 0; i < TRACE_POINTS; i++) {
        const u = i / (TRACE_POINTS - 1);
        positions[i * 3] = (u - 0.5) * SCREEN.width;
        positions[i * 3 + 1] = Math.sin(2 * Math.PI * f * u * span);
        positions[i * 3 + 2] = 0;
      }
      const attribute = geometry.getAttribute('position');
      attribute.needsUpdate = true;
      geometry.computeBoundingSphere();
    }
    const env = Number.isFinite(sample.envelope) ? (sample.envelope ?? 0) : 0;
    if (env !== level) {
      level = env;
      // Without a run, a flat line; during one, the peaks at env/V0 of the screen's upper half.
      trace.scale.y = Math.max((env / V0) * (SCREEN.height / 4), 1e-4);
    }
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const oscilloscopeBench: BenchModel = {
  frame,
  rig,
  reads: ['envelope'],
  fullScale: { envelope: 2 },
};
