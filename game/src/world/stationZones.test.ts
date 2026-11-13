import { describe, expect, it } from 'vitest';
import { bundledContent } from '../content';
import scenesJson from '../content/scenes.json';
import { type ItemDefinition, ItemDefinitionSchema } from '../gameplay/item';
import { type Placement, RoomDefinitionSchema } from './definitions';

/** Every item and room, the lab pack's included. */
const itemsJson = bundledContent.items as unknown[];
const roomsJson = bundledContent.rooms as unknown[];

// The labs' experiment zones hold only what the stations need (Z3 §4.5): furniture or decoration
// added later must stay out of a projectile's flight, a swing, a drop, a spring, a bench apparatus
// and the places the e2e tests stand at. Coordinates are each scene's (the Physics Lab's three rooms
// share them).

type Zone = readonly [x0: number, x1: number, z0: number, z1: number, y0: number, y1: number];

/** A point the e2e specs stand a player at: the capsule plus 0.1 m, player height. */
const stand = (x: number, z: number): Zone => [x - 0.4, x + 0.4, z - 0.4, z + 0.4, 0, 2];

// Heights stop at the stations' working volume: the room's ceiling less StationSystem's 0.3 m
// margin (the ceiling lights above it are room fittings, not in any flight).
const ZONES: Record<string, { zone: Zone; holds: string[] }> = {
  'projectile lane (flight, trail, floor tape)': {
    zone: [-1.5, 21, 10.75, 12.75, 0, 5.7],
    holds: ['projectile-range/launcher', 'projectile-range/banner'],
  },
  'pendulum swing (frame and bob)': {
    zone: [-4.7, 4.7, -12.9, -11.3, 0, 4.2],
    holds: ['pendulum-bay/pendulum'],
  },
  'free-fall tower': { zone: [0.917, 2.017, -7.42, -6.45, 0, 3.2], holds: ['physics-lab/tower'] },
  'spring stand': { zone: [11.367, 12.367, -7.42, -6.45, 0, 3.2], holds: ['physics-lab/spring'] },
  'e2e stand at the projectile desk': { zone: stand(-1.2, 13.1), holds: [] },
  'e2e stand at the projectile monitor': { zone: stand(2.2, 14.1), holds: [] },
  'e2e stand at the cart': { zone: stand(-3.6, 10.4), holds: [] },
  // Through the range's door (Phase U): it opens as the player comes.
  'e2e walk to the range': {
    zone: [-3.3, -2, -2, 12.3, 0, 2], // the range 1.8 m further south (U-2)
    holds: [
      'physics-lab/door-range-frame',
      'physics-lab/door-range-leaf-b',
      'projectile-range/cart',
    ],
  },
  'e2e stand at the pendulum desk': { zone: stand(2.4, -8.4), holds: [] },
  'e2e stand at the pendulum monitor': { zone: stand(3.85, -10.1), holds: [] },
  'e2e stand at the free-fall desk': { zone: stand(2.017, -5.35), holds: [] },
  'e2e stand at the free-fall board': { zone: stand(-0.217, -4.624), holds: [] },
  'e2e stand at the spring desk': { zone: stand(12.417, -5.35), holds: [] },
  'e2e stand at the spring board': { zone: stand(11.517, -5.35), holds: [] },
  'buoyancy rig': {
    zone: [15.842, 16.292, -7.225, -6.975, 0.9, 1.52],
    holds: ['physics-lab/buoyancy'],
  },
  'e2e stand at the buoyancy desk': { zone: stand(16.067, -5.6), holds: [] },
  'e2e stand at the buoyancy board': { zone: stand(15.217, -5.6), holds: [] },
  'air track': { zone: [9.3, 11.1, -2.782, -2.482, 0.9, 1.2], holds: ['physics-lab/collision'] },
  'e2e stand at the collision desk': { zone: stand(10.2, -1.132), holds: [] },
  'e2e stand at the collision board': { zone: stand(9.35, -1.132), holds: [] },
  'energy track': { zone: [3.892, 5.842, 2.482, 2.782, 0.9, 1.52], holds: ['physics-lab/energy'] },
  'e2e stand at the energy desk': { zone: stand(4.867, 1.132), holds: [] },
  'e2e stand at the energy board': { zone: stand(5.717, 1.132), holds: [] },
  'inclined plane': {
    zone: [9.225, 11.175, 2.452, 2.812, 0.9, 2.55],
    holds: ['physics-lab/incline'],
  },
  'e2e stand at the incline desk': { zone: stand(10.2, 1.132), holds: [] },
  'e2e stand at the incline board': { zone: stand(11.05, 1.132), holds: [] },
  'circuit board': { zone: [2.433, 3.033, 6.9, 7.3, 0.9, 1.06], holds: ['physics-lab/circuit'] },
  'e2e stand at the circuit desk': { zone: stand(2.733, 5.6), holds: [] },
  'e2e stand at the circuit board': { zone: stand(3.583, 5.6), holds: [] },
  'power board': { zone: [5.84, 6.56, 6.89, 7.31, 0.9, 1.12], holds: ['physics-lab/power'] },
  'e2e stand at the power desk': { zone: stand(6.2, 5.6), holds: [] },
  'e2e stand at the power board': { zone: stand(7.05, 5.6), holds: [] },
  'whirling apparatus': {
    zone: [-4.95, -4.05, -14.65, -13.75, 0.9, 1.52],
    holds: ['pendulum-bay/whirl'],
  },
  'e2e stand at the whirl desk': { zone: stand(-2.95, -14.2), holds: [] },
  'e2e stand at the whirl board': { zone: stand(-2.95, -13.35), holds: [] },
  'refraction board': {
    zone: [28.66, 29.04, -2.49, -2.11, 0.9, 0.975],
    holds: ['waves-optics/refraction'],
  },
  'e2e stand at the refraction desk': { zone: stand(27.35, -2.3), holds: [] },
  'e2e stand at the refraction board': { zone: stand(27.35, -3.15), holds: [] },
  'mirror board': { zone: [28.66, 29.04, 2.11, 2.49, 0.9, 0.98], holds: ['waves-optics/mirror'] },
  'e2e stand at the mirror desk': { zone: stand(27.35, 2.3), holds: [] },
  'e2e stand at the mirror board': { zone: stand(27.35, 1.45), holds: [] },
  'optical bench': { zone: [25.6, 26.8, 5.22, 5.38, 0.9, 1.2], holds: ['waves-optics/lens'] },
  'e2e stand at the lens desk': { zone: stand(26.2, 3.8), holds: [] },
  'e2e stand at the lens board': { zone: stand(27.05, 3.8), holds: [] },
  'e2e walk in from the hub door': { zone: [-4.4, 18.8, -0.4, 0.4, 0, 2], holds: [] }, // to the optics door (U-2)
};

// The Chemistry Lab's bench stations: each apparatus' own box above the island, bench or desk it
// stands on, the e2e stand points, and the way in from the hub door (doors.spec.ts walks it).
const CHEMISTRY_ZONES: Record<string, { zone: Zone; holds: string[] }> = {
  // Phase B: the retort stand's foot and rod (its burette clamped later, above its tile).
  'titration stand': {
    zone: [-5.814, -5.614, -2.038, -1.768, 0.9, 1.66],
    holds: ['chemistry-lab/titration'],
  },
  colorimeter: {
    zone: [-6.454, -5.504, -10.7, -10.3, 0.9, 1.16],
    holds: ['chemistry-lab/kinetics'],
  },
  'hot plate': {
    zone: [7.523, 7.863, -7.328, -7.078, 0.9, 1.36],
    holds: ['chemistry-lab/heating'],
  },
  'e2e stand at the titration stand': { zone: stand(-5.714, -0.453), holds: [] },
  'e2e stand at the titration board': { zone: stand(-5.357, 3.45), holds: [] },
  'e2e stand at the colorimeter': { zone: stand(-5.979, -9.5), holds: [] },
  'e2e stand at the reaction-rate board': { zone: stand(-4.379, -9.9), holds: [] },
  'e2e stand at the hot plate': { zone: stand(7.543, -6.203), holds: [] },
  'e2e stand at the heating board': { zone: stand(8.55, -7.303), holds: [] },
  'e2e walk in from the hub door': { zone: [-0.4, 0.4, 1.2, 3.8, 0, 2], holds: [] },
  // The dilution slice (physical-lab.spec.ts): in front of the main bench, in front of the reagent
  // cabinet (clear of its doors' swing), and behind the bench at the results monitor.
  'e2e stand at the dilution bench': { zone: stand(-0.4, -6.679), holds: [] },
  'e2e stand at the reagent cabinet': { zone: stand(3.286, -9.5), holds: [] },
  'e2e stand at the dilution monitor': { zone: stand(-0.6, -9.184), holds: [] },
};

// The Biology Lab's bench stations: each apparatus' own box above the bench it stands on (osmosis
// turned a quarter to face east, the microscope a half to face north), the e2e stand points in
// front of each (their workspaces open from the apparatus: no desk, no wall monitor), and the way in
// from the hub door (doors.spec.ts walks it).
const BIOLOGY_ZONES: Record<string, { zone: Zone; holds: string[] }> = {
  'osmosis rack': {
    zone: [-14.775, -14.425, 0.039, 0.739, 0.9, 1.06],
    holds: ['biology-lab/osmosis'],
  },
  'enzyme rig': { zone: [0.6, 1.4, -7.15, -6.85, 0.9, 1.26], holds: ['biology-lab/enzyme'] },
  'pondweed and lamp': {
    zone: [-9.146, -8.306, -3.561, -3.281, 0.9, 1.36],
    holds: ['biology-lab/photosynthesis'],
  },
  'digital microscope': {
    zone: [0.24, 0.66, 7.03, 7.27, 0.9, 1.25],
    holds: ['biology-lab/digital-microscope'],
  },
  'e2e stand at the osmosis rack': { zone: stand(-13.2, 0.389), holds: [] },
  'e2e stand at the osmosis board': { zone: stand(-14, -1.211), holds: [] },
  'e2e stand at the enzyme rig': { zone: stand(1, -5.9), holds: [] },
  'e2e stand at the enzyme board': { zone: stand(3.2, -6.5), holds: [] },
  'e2e stand at the photosynthesis apparatus': { zone: stand(-8.786, -2.321), holds: [] },
  'e2e stand at the photosynthesis board': { zone: stand(-9.386, -5.521), holds: [] },
  'e2e stand at the microscope': { zone: stand(0.5, 6.1), holds: [] },
  'e2e stand at the microscope board': { zone: stand(-1, 6.4), holds: [] },
  'e2e walk in from the hub door': { zone: [2.2, 4.6, -0.4, 0.4, 0, 2], holds: [] },
};

const items = new Map(
  itemsJson.map((raw) => {
    const item = ItemDefinitionSchema.parse(raw);
    return [item.id, item] as const;
  }),
);
const rooms = roomsJson.map((raw) => RoomDefinitionSchema.parse(raw));

/** A placement's box as x, z and y ranges (its footprint turned by a quarter turn or none). */
function extent(p: Placement, item: ItemDefinition): Zone {
  const [w, h, d] = item.visual.size;
  const turned = Math.abs(Math.sin(p.rotationY)) > 0.5;
  const [hx, hz] = turned ? [d / 2, w / 2] : [w / 2, d / 2];
  const [x, y, z] = p.position;
  return [x - hx, x + hx, z - hz, z + hz, y, y + h];
}

const overlaps = (a: Zone, b: Zone) =>
  a[0] < b[1] && b[0] < a[1] && a[2] < b[3] && b[2] < a[3] && a[4] < b[5] && b[4] < a[5];

/** Each zone holds exactly its station's own fittings among every placement of `sceneId`. */
function checkZones(
  sceneId: string,
  count: number,
  zones: Record<string, { zone: Zone; holds: string[] }>,
) {
  const scene = scenesJson.find((s) => s.id === sceneId);
  const placed = (scene?.rooms ?? []).flatMap((id) => {
    const room = rooms.find((r) => r.id === id);
    return (room?.placements ?? []).map((p) => ({ id: `${id}/${p.id}`, p }));
  });

  it('are checked against every placement of its scene', () => {
    expect(placed.length).toBe(count);
    for (const { p } of placed) {
      // Quarter turns only: the extents above are exact for them.
      const turns = (p.rotationY / (Math.PI / 2)) % 1;
      expect(Math.min(Math.abs(turns), 1 - Math.abs(turns))).toBeLessThan(1e-4);
    }
  });

  it.each(Object.entries(zones))(
    '%s holds only the station’s own fittings',
    (_, { zone, holds }) => {
      const inside = placed
        .filter(({ p }) => {
          const item = items.get(p.item);
          return item !== undefined && overlaps(extent(p, item), zone);
        })
        .map(({ id }) => id);
      expect(inside).toEqual(holds);
    },
  );
}

describe('the Physics Lab’s experiment zones', () => checkZones('physics-lab', 569, ZONES)); // Phase T-1a: the wing's four rooms; T-2: four stations; T-3: seven; T-4: seven; the ripple tank and the electric field; the air track and the Atwood machine; Phase X: the AC generator (12); Phase E: the circuit bench (40 + 2)

describe('the Chemistry Lab’s experiment zones', () =>
  checkZones('chemistry-lab', 295, CHEMISTRY_ZONES)); // Y-3: the board; + the light switch, the titration bench's 16, 3 lights + housings, T-5's solubility station (13); Phase X: the practice room's 3 lights and its stations (13 each)

describe('the Biology Lab’s experiment zones', () => checkZones('biology-lab', 251, BIOLOGY_ZONES)); // Y-3: the board; + 3 lights + housings, the enzyme bench, T-6's transpiration station (13), T-6b's stations (respiration and pea cross 13 each, mark and recapture and food tests 12: three dials); Phase X: the practice room's 3 lights and its twelve stations
