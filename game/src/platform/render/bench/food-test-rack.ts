import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { COLOURS, TESTS } from '../../../simulation/models/foodTests';
import { Assembly, slab, swaps } from '../assembly';
import { GLASSWARE_LOOK, LOOKS } from '../looks';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

// Tests for biological molecules: on a base board, a rack of six stoppered sample bottles A–F
// (alike to the eye: what they hold is the student's to find), and a hot plate with a beaker of
// water in which the test tube stands. The rig is what the run and the desk change: the tube's
// liquid, from the reagent's own colour (`parameters.test`) to the outcome (`colour`) as the run's
// `development` goes from 0 to 1 — Benedict's through green, yellow and orange to brick red — the
// red-stained oily layer Sudan III shows on a lipid, rising as it develops, and the hot plate's
// ring glowing while the bath is on (`parameters.heated`).

const BASE = 0.02;
const RACK = { x: -0.24, w: 0.34, d: 0.1, h: 0.05 };
const BOTTLE = { radius: 0.018, h: 0.08, pitch: 0.054 };
const PLATE = { x: 0.2, w: 0.2, d: 0.2, h: 0.06 };
const BEAKER = { radius: 0.06, h: 0.12, water: 0.08 };
const TUBE = { radius: 0.011, h: 0.15, liquid: 0.05, layer: 0.012 };

/** The reagents' own colours, by `test` code: iodine, Benedict's, biuret, Sudan III. */
const REAGENT = ['#b98a2e', '#2f6fc2', '#5f8fd6', '#e6a1a1'] as const;
/** The colours each outcome passes through, by `colour` code (none keeps the reagent's). */
const STOPS: Readonly<Record<number, readonly string[]>> = {
  [COLOURS.blueBlack]: ['#b98a2e', '#1c1d33'],
  [COLOURS.brickRed]: ['#2f6fc2', '#4f9e5a', '#d6c53a', '#e08a2c', '#a8401f'],
  [COLOURS.violet]: ['#5f8fd6', '#7a3fa0'],
  [COLOURS.redLayer]: ['#e6a1a1', '#f1d9d4'], // the dye leaves the water for the oil
};

function topOf(item: ItemDefinition): THREE.Vector3 {
  const [x, y, z] = item.bench?.top ?? [0, 0, 0];
  return new THREE.Vector3(x, y - item.visual.size[1] / 2, z);
}

/** Geometries merged into one and the pieces freed. */
function merged(pieces: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(pieces);
  for (const piece of pieces) piece.dispose();
  return g;
}

const bottleX = (i: number) => RACK.x + (i - 2.5) * BOTTLE.pitch;

/** The base, the rack (in the item's colour) and its bottles, the hot plate, beaker and tube. */
function frame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  const glass = own(new THREE.MeshStandardMaterial({ color: '#d8ecf2', ...GLASSWARE_LOOK }));
  const sample = own(
    new THREE.MeshStandardMaterial({ color: '#e9eef0', ...LOOKS.glass, opacity: 0.7 }),
  );
  const water = own(
    new THREE.MeshStandardMaterial({ color: '#a9d6ea', ...LOOKS.glass, opacity: 0.45 }),
  );
  const dark = own(new THREE.MeshStandardMaterial({ color: '#2b2f36', ...LOOKS.plastic }));
  const body = keep(slab(w, d, BASE, 0.01, 0.002));
  body.translate(0, -h / 2, 0);
  const y0 = -h / 2 + BASE;
  mesh(keep(new THREE.BoxGeometry(RACK.w, RACK.h, RACK.d)), painted).position.set(
    RACK.x,
    y0 + RACK.h / 2,
    0,
  );
  const bottleY = y0 + RACK.h;
  const plateTop = y0 + PLATE.h;
  const glassware = mesh(
    keep(
      merged([
        ...Array.from({ length: 6 }, (_, i) =>
          new THREE.CylinderGeometry(BOTTLE.radius, BOTTLE.radius, BOTTLE.h, 16).translate(
            bottleX(i),
            bottleY + BOTTLE.h / 2,
            0,
          ),
        ),
        new THREE.CylinderGeometry(BEAKER.radius, BEAKER.radius, BEAKER.h, 24, 1, true).translate(
          PLATE.x,
          plateTop + BEAKER.h / 2,
          0,
        ),
        new THREE.CylinderGeometry(TUBE.radius, TUBE.radius, TUBE.h, 14, 1, true).translate(
          PLATE.x,
          plateTop + 0.01 + TUBE.h / 2,
          0,
        ),
      ]),
    ),
    glass,
  );
  glassware.name = 'glass'; // clear glassware: a sheen pass on High (quality.ts)
  // Every sample alike: the same pale liquid in each bottle, a dark cap on each.
  mesh(
    keep(
      merged(
        Array.from({ length: 6 }, (_, i) =>
          new THREE.CylinderGeometry(
            BOTTLE.radius - 0.002,
            BOTTLE.radius - 0.002,
            0.05,
            14,
          ).translate(bottleX(i), bottleY + 0.027, 0),
        ),
      ),
    ),
    sample,
  ).castShadow = false;
  mesh(
    keep(
      merged([
        new THREE.BoxGeometry(PLATE.w, PLATE.h, PLATE.d).translate(PLATE.x, y0 + PLATE.h / 2, 0),
        ...Array.from({ length: 6 }, (_, i) =>
          new THREE.CylinderGeometry(BOTTLE.radius, BOTTLE.radius, 0.015, 14).translate(
            bottleX(i),
            bottleY + BOTTLE.h + 0.0075,
            0,
          ),
        ),
      ]),
    ),
    dark,
  );
  // The bath's water, round the tube.
  mesh(
    keep(
      new THREE.CylinderGeometry(BEAKER.radius - 0.003, BEAKER.radius - 0.003, BEAKER.water, 24),
    ),
    water,
  ).position.set(PLATE.x, plateTop + BEAKER.water / 2 + 0.002, 0);
  return { body, parts: kit.group, dispose: () => kit.dispose() };
}

/** The tube's liquid, the oily layer and the hot plate's ring, posed from the station. */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  kit.group.position.copy(topOf(item));
  const plateTop = BASE + PLATE.h;
  const reagents = REAGENT.map((c) => new THREE.Color(c));
  const iodine = new THREE.Color(REAGENT[0]);
  const stops: Record<number, THREE.Color[]> = {};
  for (const [code, list] of Object.entries(STOPS)) {
    stops[Number(code)] = list.map((c) => new THREE.Color(c));
  }
  const tint = own(new THREE.MeshStandardMaterial({ color: REAGENT[0], ...LOOKS.satin }));
  const liquid = mesh(
    keep(new THREE.CylinderGeometry(TUBE.radius - 0.0015, TUBE.radius - 0.0015, TUBE.liquid, 14)),
    tint,
  );
  liquid.name = 'liquid';
  liquid.castShadow = false;
  liquid.position.set(PLATE.x, plateTop + 0.012 + TUBE.liquid / 2, 0);
  const oil = mesh(
    keep(
      new THREE.CylinderGeometry(
        TUBE.radius - 0.0015,
        TUBE.radius - 0.0015,
        TUBE.layer,
        14,
      ).translate(0, TUBE.layer / 2, 0),
    ),
    own(new THREE.MeshStandardMaterial({ color: '#c0262b', ...LOOKS.satin })),
  );
  oil.name = 'layer';
  oil.castShadow = false;
  oil.position.set(PLATE.x, plateTop + 0.012 + TUBE.liquid, 0);
  oil.visible = false;
  const cold = own(new THREE.MeshStandardMaterial({ color: '#3a3f46', ...LOOKS.metal }));
  const hot = own(
    new THREE.MeshStandardMaterial({ color: '#ff6a3a', emissive: '#ff4a1a', emissiveIntensity: 1 }),
  );
  const ring = mesh(keep(new THREE.TorusGeometry(0.05, 0.006, 6, 28).rotateX(Math.PI / 2)), cold);
  ring.name = 'ring';
  ring.castShadow = false;
  swaps(ring, hot);
  ring.position.set(PLATE.x, plateTop + 0.001, 0);

  const pose = ({ parameters, sample }: BenchPose) => {
    const reagent = reagents[parameters.test ?? TESTS.iodine] ?? iodine;
    const d = Number.isFinite(sample.development) ? (sample.development ?? 0) : 0;
    const path = Number.isFinite(sample.colour) ? stops[sample.colour ?? 0] : undefined;
    if (!path || d <= 0) tint.color.copy(reagent);
    else {
      const at = Math.min(1, d) * (path.length - 1);
      const i = Math.min(path.length - 2, Math.floor(at));
      const from = path[i];
      const to = path[i + 1];
      if (from && to) tint.color.copy(from).lerp(to, at - i);
    }
    const layer = sample.colour === COLOURS.redLayer && d > 0;
    oil.visible = layer;
    if (layer) oil.scale.y = Math.min(1, d);
    ring.material = parameters.heated === 1 ? hot : cold;
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const foodTestRack: BenchModel = {
  frame,
  rig,
  reads: ['development', 'colour'],
  fullScale: { development: 1, colour: COLOURS.redLayer },
};
