import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../content';
import type { RawContent } from '../../game/content';
import { benchFixture } from '../../game/benchFixture';
import { ItemDefinitionSchema } from '../../gameplay/item';
import { RoomDefinitionSchema } from '../../world/definitions';
import { WALL_THICKNESS } from '../../world/roomGeometry';
import { entityFromPlacement, type WorldEntity } from '../../world/World';
import { benchModel } from './bench/registry';
import { buildSpringFrame } from './hookeModel';
import { buildLauncher } from './launcherModel';
import { buildPendulumFrame } from './pendulumModel';
import { buildTowerFrame } from './towerModel';

// Characterization: every apparatus placed in shipped content, drawn by its builder where
// WorldRenderer.addEntity puts it, stays in its room. The collider is only the item's box, and the
// drawn apparatus reaches well past it (a pendulum frame holds its pivot 3.6 m up over a 0.08 m
// box). A part may sink into the shell the renderer draws, half a wall thick (buildRooms), and no
// deeper. Only the frames are drawn here, not what ExperimentView adds (bob, carriage, hanger),
// except a bench's rig, at full scale; a bench by its registered model (bench/registry.test.ts:
// every one has one). The range's benches ship; the fixture's board is also checked on its own.

const PANEL_EMBED = WALL_THICKNESS / 2;
const DEG = Math.PI / 180;
// The launcher's barrel is drawn at the launch angle: 0–90° in 5° steps (experiments/projectile-motion.json).
const LAUNCH_ANGLES = Array.from({ length: 19 }, (_, i) => i * 5);

/** Every apparatus placed in this content, with its room's bounds. */
function apparatusOf(content: RawContent) {
  const items = new Map(
    (content.items as unknown[]).map((raw) => {
      const item = ItemDefinitionSchema.parse(raw);
      return [item.id, item] as const;
    }),
  );
  return (content.rooms as unknown[]).flatMap((raw) => {
    const room = RoomDefinitionSchema.parse(raw);
    return room.placements.flatMap((placement) => {
      const item = items.get(placement.item)!;
      const { launcher, pendulum, dropTower, springStand, bench } = item;
      if (!launcher && !pendulum && !dropTower && !springStand && !bench) return [];
      const entity = entityFromPlacement(room.id, placement, item);
      return [{ id: entity.id, bounds: room.bounds, entity }];
    });
  });
}

/** The world box of the apparatus as addEntity draws it, at every launch angle; then freed. */
function drawnBox({ item, pose }: WorldEntity): THREE.Box3 {
  const painted = new THREE.MeshStandardMaterial();
  const launcher = item.launcher ? buildLauncher(item, item.launcher, painted) : null;
  const frame =
    launcher ??
    (item.pendulum
      ? buildPendulumFrame(item, item.pendulum, painted)
      : item.springStand
        ? buildSpringFrame(item, item.springStand, painted)
        : item.bench
          ? benchModel(item.bench.model)!.frame(item, painted)
          : buildTowerFrame(item, item.dropTower!, painted));
  const group = new THREE.Group();
  group.position.fromArray(pose.position);
  group.quaternion.fromArray(pose.rotation);
  group.add(new THREE.Mesh(frame.body, painted), frame.parts);
  const bench = item.bench && benchModel(item.bench.model)!;
  const rig = bench ? (bench.rig?.(item) ?? null) : null;
  // Each variable the rig reads at its model's declared `fullScale`, else 1 (the demo board's 0–1
  // level). Full scale only where declared: a rig whose part can pass its frame declares it.
  const sample = Object.fromEntries(
    (bench ? (bench.reads ?? []) : []).map((v) => [v, bench?.fullScale?.[v] ?? 1]),
  );
  rig?.pose({ status: 'running', parameters: {}, sample }, 1 / 60);
  if (rig) group.add(rig.group);
  if (launcher) group.add(launcher.pivot);
  const box = new THREE.Box3();
  for (const deg of launcher ? LAUNCH_ANGLES : [0]) {
    if (launcher) launcher.pivot.rotation.z = deg * DEG;
    group.updateMatrixWorld(true);
    box.union(new THREE.Box3().setFromObject(group));
  }
  frame.dispose();
  rig?.dispose();
  painted.dispose();
  return box;
}

/** Each apparatus's smallest margin to its room's faces; each checked against PANEL_EMBED. */
function smallestMargins(content: RawContent): Record<string, string> {
  const smallest: Record<string, string> = {};
  for (const { id, bounds, entity } of apparatusOf(content)) {
    const box = drawnBox(entity);
    const { min, max } = bounds;
    const margins = {
      west: box.min.x - min[0],
      east: max[0] - box.max.x,
      floor: box.min.y - min[1],
      ceiling: max[1] - box.max.y,
      north: box.min.z - min[2],
      south: max[2] - box.max.z,
    };
    const [face, margin] = Object.entries(margins).reduce((a, b) => (b[1] < a[1] ? b : a));
    expect(margin, id).toBeGreaterThanOrEqual(-PANEL_EMBED);
    // To the mm, as content is authored (the geometry is float32); rounded first, so a margin a
    // hair below 0 reads 0.000, not -0.000.
    smallest[id] = `${(Math.round(margin * 1000) / 1000).toFixed(3)} m (${face})`;
  }
  return smallest;
}

describe('drawn apparatus extents (characterization)', () => {
  it('keeps every apparatus in shipped content inside its room, sunk no deeper than PANEL_EMBED', () => {
    // Measured at a1ca48c (the wing's at Phase T-1a): the smallest margin of each, to its room's faces.
    expect(smallestMargins(bundledContent)).toEqual({
      'physics-lab/tower': '0.000 m (floor)',
      'physics-lab/spring': '0.000 m (floor)',
      'projectile-range/launcher': '0.000 m (floor)',
      'pendulum-bay/pendulum': '0.000 m (floor)',
      'pendulum-bay/resonance': '0.300 m (north)', // T-3: on the bay's north wall bench
      'physics-lab/emf': '0.250 m (south)', // T-3: the south wall's planned benches
      'physics-lab/rc': '0.250 m (south)',
      'waves-optics/sound': '0.250 m (south)', // T-3: the optics room's planned benches
      'waves-optics/string': '0.300 m (north)',
      'waves-optics/tube': '0.250 m (south)',
      'waves-optics/young': '0.250 m (north)',
      'waves-optics/ripple': '0.125 m (north)',
      'waves-optics/field': '0.900 m (floor)', // an island: on its bench
      'physics-lab/calorimeter': '0.250 m (east)', // T-4: the east wall's planned benches
      'physics-lab/ice': '0.250 m (east)',
      'physics-lab/boyle': '0.250 m (east)',
      'physics-lab/charles': '0.250 m (east)',
      'physics-lab/balance': '0.250 m (south)', // T-4: on the south wall, west of its planned bench
      'physics-lab/induction': '0.900 m (floor)', // T-4: on its island
      'pendulum-bay/decay': '0.250 m (north)', // T-4: on the bay's north wall bench
      // Phase T-1a: each bench station on its own bench in the rebuilt wing — the lab's wall
      // benches to their wall, its islands' apparatus on their benches (the floor), the whirl's
      // guard 0.05 m over its bench's back by the bay's west wall, the optics room's three.
      'physics-lab/buoyancy': '0.340 m (north)',
      'physics-lab/circuit': '0.200 m (south)',
      'physics-lab/power': '0.190 m (south)',
      'physics-lab/collision': '0.900 m (floor)',
      'physics-lab/energy': '0.900 m (floor)',
      'physics-lab/incline': '0.900 m (floor)',
      'physics-lab/speed': '0.900 m (floor)', // T-2: the photogate rail on its island
      'physics-lab/newton': '0.013 m (floor)', // the air track's hanging mass, its fall's end, just above the floor
      'physics-lab/atwood': '0.900 m (floor)', // the Atwood machine on its island
      'physics-lab/forces': '0.340 m (north)', // T-2: the force board on the north wall's bench
      'physics-lab/lever': '0.340 m (north)', // T-2: the lever balance beside it
      'physics-lab/pressure': '0.900 m (floor)', // T-2: the pressure tank on its island
      'pendulum-bay/whirl': '0.053 m (west)',
      'waves-optics/refraction': '0.210 m (east)',
      'waves-optics/mirror': '0.210 m (east)',
      'waves-optics/lens': '0.322 m (south)',
      // The Chemistry Lab's: titration on the west island, heating on its bench, the colorimeter
      // on the north wall's bench, the dilution bench (physical lab) on the main bench.
      'chemistry-lab/titration': '0.900 m (floor)',
      'chemistry-lab/dilution': '0.900 m (floor)',
      'chemistry-lab/kinetics': '0.330 m (north)',
      'chemistry-lab/heating': '0.900 m (floor)',
      'chemistry-lab/solubility': '0.900 m (floor)', // T-5: on its island
      // Phase X: the practice room's stations, on its north wall's benches.
      'chemistry-annex/ph': '0.240 m (north)',
      'chemistry-annex/ions': '0.250 m (north)',
      'chemistry-annex/separation': '0.250 m (north)',
      'chemistry-annex/neutralisation': '0.275 m (north)',
      'chemistry-annex/equilibrium': '0.900 m (floor)',
      'chemistry-annex/galvanic': '0.900 m (floor)',
      'chemistry-annex/electrolysis': '0.900 m (floor)',
      'chemistry-annex/halogens': '0.900 m (floor)',
      'chemistry-annex/corrosion': '0.899 m (floor)',
      'chemistry-annex/soap': '0.900 m (floor)',
      'chemistry-annex/gas-speeds': '0.175 m (south)',
      'chemistry-annex/collisions-table': '0.175 m (south)',
      'chemistry-annex/atom-table': '0.250 m (south)',
      'chemistry-annex/orbital-table': '0.230 m (south)',
      'chemistry-annex/shapes-table': '0.240 m (west)',
      'chemistry-annex/balance-table': '0.240 m (west)',
      'biology-annex/division-table': '0.240 m (north)',
      'biology-annex/gene-table': '0.240 m (north)',
      'biology-annex/drift-table': '0.240 m (north)',
      'biology-annex/growth-table': '0.240 m (north)',
      'biology-annex/meadow-table': '0.240 m (south)',
      'biology-annex/agar-table': '0.240 m (south)',
      'biology-annex/cell-table': '0.240 m (south)',
      'biology-annex/yeast-table': '0.240 m (south)',
      'biology-annex/heart-table': '0.900 m (floor)',
      'biology-annex/seedling-table': '0.900 m (floor)',
      'biology-annex/dna-table': '0.900 m (floor)',
      'biology-annex/karyotype-table': '0.240 m (west)',
      'pendulum-bay/generator': '0.240 m (east)', // Phase X
      // The Biology Lab's: osmosis on the west wall's bench, enzyme on the north wall's bench,
      // photosynthesis on the lab bench, the microscope on its desk by the south wall.
      'biology-lab/osmosis': '0.255 m (west)',
      'biology-lab/enzyme': '0.370 m (north)',
      'biology-lab/photosynthesis': '0.900 m (floor)',
      'biology-lab/digital-microscope': '0.232 m (south)',
      'biology-lab/transpiration': '0.900 m (floor)', // T-6: the potometer on its island
      'biology-lab/respiration': '0.900 m (floor)', // T-6b: the respirometer
      'biology-lab/pea-cross': '0.900 m (floor)', // T-6b: the seed tray
      'biology-lab/mark-recapture': '0.900 m (floor)', // T-6b: the bean jar
      'biology-lab/food-tests': '0.900 m (floor)', // T-6b: the food-test rack
    });
  });

  it('keeps the fixture bench, its rig at full scale, inside the Physics Lab', () => {
    expect(smallestMargins(benchFixture())['physics-lab/demo-board-station']).toBe(
      '0.900 m (floor)',
    );
  });
});
