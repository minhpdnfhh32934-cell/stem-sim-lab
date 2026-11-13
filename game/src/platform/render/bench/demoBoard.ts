import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, at, slab, swaps } from '../assembly';
import { LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// The reference bench model, and the template for new ones (tests use it; no content does yet):
// the frame is a board the size of the item's box with a terminal strip and its two posts; the
// rig, standing at `bench.top`, a lamp lit while a run is in progress and a gauge whose bar shows
// the model variable `level` (0–1 of its full height; none without a run or a level).

const LAMP = 0.015; // the lamp's radius
const GAUGE = { width: 0.03, height: 0.2 }; // the bar at full scale
const POST = { radius: 0.008, height: 0.03, inset: 0.04 };
const STRIP = { depth: 0.04, height: 0.012 }; // the terminal strip along the board's back

/** Where the rig stands, in the item's frame (origin at the centre of its box): `bench.top`. */
function topOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/**
 * The board (the entity's mesh), the terminal strip along its back (painted: it shares the entity
 * material, so focus shows on it too) and the strip's two posts (one draw).
 */
function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh, copies } = kit;
  const steel = own(new THREE.MeshStandardMaterial({ color: '#b4bcc4', ...LOOKS.metal }));
  const body = keep(slab(w, d, h, Math.min(w, d) / 10, Math.min(h, 0.003)));
  body.translate(0, -h / 2, 0);
  const stripZ = POST.inset - d / 2;
  const strip = mesh(
    keep(new THREE.BoxGeometry(w - POST.inset, STRIP.height, STRIP.depth)),
    painted,
  );
  strip.name = 'strip';
  strip.position.set(0, h / 2 + STRIP.height / 2, stripZ);
  // Parts smaller than a shadow-map texel (~2 cm over the lab) cast no shadow: they would not show.
  copies(
    keep(new THREE.CylinderGeometry(POST.radius, POST.radius, POST.height, 8)),
    steel,
    [-1, 1].map((s) =>
      at(s * (w / 2 - POST.inset), h / 2 + STRIP.height + POST.height / 2, stripZ),
    ),
  ).castShadow = false;
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

/** The lamp and the gauge at `bench.top`; `pose` sets them from the station, allocating nothing. */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  const lit = own(new THREE.MeshBasicMaterial({ color: '#7bd88f' })); // reads at any light
  const dark = own(new THREE.MeshStandardMaterial({ color: '#2b2f36', ...LOOKS.plastic }));
  const amber = own(new THREE.MeshBasicMaterial({ color: '#f0b54a' }));
  kit.group.position.copy(topOf(item));
  const lamp = mesh(keep(new THREE.SphereGeometry(LAMP, 12, 8)), dark);
  swaps(lamp, lit);
  lamp.name = 'lamp';
  lamp.position.set(-0.08, LAMP, 0);
  lamp.castShadow = false;
  // A unit-high bar standing on the board, scaled to the level.
  const bar = mesh(
    keep(new THREE.BoxGeometry(GAUGE.width, 1, GAUGE.width).translate(0, 0.5, 0)),
    amber,
  );
  bar.name = 'gauge';
  bar.position.set(0.08, 0, 0);
  bar.castShadow = false;
  bar.visible = false;

  let running: boolean | null = null;
  let level = NaN;
  const pose = ({ status, sample }: BenchPose) => {
    const on = status === 'running';
    if (on !== running) {
      running = on;
      lamp.material = on ? lit : dark;
    }
    const next = sample.level ?? NaN;
    if (Object.is(next, level)) return;
    level = next;
    bar.visible = next > 0; // NaN: no run
    if (bar.visible) bar.scale.y = Math.min(next, 1) * GAUGE.height;
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const demoBoard: BenchModel = { frame, rig, reads: ['level'] };
