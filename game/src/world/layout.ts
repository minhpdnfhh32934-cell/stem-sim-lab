import { containsXZ, type Vec3 } from '../core/math';
import type { ItemDefinition } from '../gameplay/item';
import { STAND_CLEARANCE } from './arrival';
import type { Opening, Placement, RoomDefinition, SceneDefinition } from './definitions';
import { leafPose } from './hinge';
import { leadsInto, roomSlabs, WALL_THICKNESS } from './roomGeometry';

// Layout rules the boot checks leave out: rooms closer than a wall, openings the player's capsule
// cannot pass, objects in walls or in a doorway's way, rooms nobody can walk into. Only tests use
// them for now; `buildContent` does not.

const T = WALL_THICKNESS;
/** Exact geometric equality in floating point (as in roomGeometry). */
export const EPS = 1e-6;
/**
 * How far (m) a solid may press into another or into its room: touching, resting and flush
 * placements pass, and Rapier resolves such a contact without a push-out (it allows 5 mm).
 */
export const CONTACT_TOLERANCE = 0.001;
/** Narrowest opening (m): the 0.6 m capsule with 0.1 m to spare on each side. */
export const MIN_OPENING_WIDTH = 2 * STAND_CLEARANCE;
/** Free height (m) an opening leaves above the tallest character. */
export const HEAD_CLEARANCE = 0.1;
/** How far (m) a doorway's passage reaches into each room: a capsule standing clear of the wall. */
export const PASSAGE_DEPTH = 2 * STAND_CLEARANCE;
/** How deep (m) an object without a body may sit in a wall, floor or ceiling (drawn T/2 thick). */
export const PANEL_EMBED = T / 2;

export interface LayoutInput {
  /** Scenes to check; menu scenes are skipped. */
  readonly scenes: readonly SceneDefinition[];
  readonly roomOf: (id: string) => RoomDefinition | undefined;
  readonly itemOf: (id: string) => ItemDefinition | undefined;
  /** Height (m) of the tallest character a player can play. */
  readonly maxCharacterHeight: number;
  /** Doors players come out of when they travel, as entity ids (`<room>/<placement>`). */
  readonly arrivals: readonly string[];
}

/**
 * A volume as a vertical prism over [y0, y1] standing on a footprint: a disc of radius r
 * (cylinders, and spheres by their circumscribing cylinder) or, with r 0, a rectangle of
 * half-extents hu × hv along its own x and z, turned by the yaw whose cosine and sine are c, s.
 */
interface Prism {
  readonly x: number;
  readonly z: number;
  readonly y0: number;
  readonly y1: number;
  readonly r: number;
  readonly hu: number;
  readonly hv: number;
  readonly c: number;
  readonly s: number;
}

/** A placement with a body, in one of its poses. */
interface Solid {
  /** Entity id. */
  readonly id: string;
  /** Content path. */
  readonly where: string;
  /** '' as placed, or ' when open' (a hinged leaf swung wide, or its openBox). */
  readonly pose: string;
  readonly prism: Prism;
  readonly dynamic: boolean;
  /** A hinged door closed: it stands in its passage by design (P5 checks its open leaves). */
  readonly closes: boolean;
}

const m = (v: number) => `${+v.toFixed(6)} m`;

/** A point given in a placement's own frame, from its base centre, in world coordinates. */
function onPlacement(p: Placement, [lx, ly, lz]: Readonly<Vec3>): Vec3 {
  const c = Math.cos(p.rotationY);
  const s = Math.sin(p.rotationY);
  const [x, y, z] = p.position;
  return [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
}

/** A solid box of a placement: its base point, size and yaw, and when it is there. */
type Pose = [pose: string, base: Vec3, size: Readonly<Vec3>, yaw: number];

/**
 * A placement's solid boxes: the whole box as placed (a hinged item closed), and each hinged leaf
 * swung wide open (UX3.1), or its openBox while open.
 */
function posesOf(p: Placement, item: ItemDefinition): Pose[] {
  const placed: Pose = ['', p.position, item.visual.size, p.rotationY];
  const [, h] = item.visual.size;
  const { hinged } = item;
  if (hinged) {
    const centre: Vec3 = [p.position[0], p.position[1] + h / 2, p.position[2]];
    const angle = (hinged.angleDeg * Math.PI) / 180;
    // A cabinet is hollow: what stands on its shelves is checked against its carcass and its
    // closed doors, not against the whole box. A hinged item without a carcass (a door) is its box.
    const box = ({ center: [cx, cy, cz], size }: { center: Vec3; size: Vec3 }): Pose => [
      '',
      onPlacement(p, [cx, h / 2 + cy - size[1] / 2, cz]),
      size,
      p.rotationY,
    ];
    return [
      ...(hinged.carcass.length > 0 ? [...hinged.carcass, ...hinged.leaves].map(box) : [placed]),
      ...hinged.leaves.map((leaf): Pose => {
        const at: Vec3 = [0, 0, 0];
        const yaw = leafPose(centre, p.rotationY, leaf, leaf.opens * angle, at);
        return [' when open', [at[0], at[1] - leaf.size[1] / 2, at[2]], leaf.size, yaw];
      }),
    ];
  }
  // A sliding door's leaf (Phase U): closed in its doorway, open slid along its own +x into the wall.
  const { slider } = item;
  if (slider) {
    const [x, y, z] = p.position;
    const along = slider.travel;
    const openAt: Vec3 = [x + along * Math.cos(p.rotationY), y, z - along * Math.sin(p.rotationY)];
    return [placed, [' when open', openAt, item.visual.size, p.rotationY]];
  }
  const open = item.visual.openBox;
  // Dynamic bodies keep their whole collider.
  if (!open || item.physical.body === 'dynamic') return [placed];
  const [cx, cy, cz] = open.center;
  const base = onPlacement(p, [cx, cy + h / 2 - open.size[1] / 2, cz]);
  return [placed, [' when open', base, open.size, p.rotationY]];
}

function prismOf(
  item: ItemDefinition,
  [x, y, z]: Readonly<Vec3>,
  yaw: number,
  [w, h, d]: Readonly<Vec3> = item.visual.size,
): Prism {
  // shortcut: a sphere is its circumscribing cylinder, which over-reports near its rim; check
  // spheres exactly once one rests against a wall or in a corner.
  const r = item.visual.shape === 'box' ? 0 : w / 2;
  return { x, z, y0: y, y1: y + h, r, hu: w / 2, hv: d / 2, c: Math.cos(yaw), s: Math.sin(yaw) };
}

/** An axis-aligned box (a shell slab, a passage, a point) from its centre and half-extents. */
const aligned = ([x, y, z]: Readonly<Vec3>, [hx, hy, hz]: Readonly<Vec3>): Prism => ({
  x,
  z,
  y0: y - hy,
  y1: y + hy,
  r: 0,
  hu: hx,
  hv: hz,
  c: 1,
  s: 0,
});

/** How far (m) `p` keeps inside the bounds; negative: how far it reaches out of them. */
function clearance(p: Prism, { min, max }: RoomDefinition['bounds']): number {
  const ex = p.r > 0 ? p.r : p.hu * Math.abs(p.c) + p.hv * Math.abs(p.s);
  const ez = p.r > 0 ? p.r : p.hu * Math.abs(p.s) + p.hv * Math.abs(p.c);
  return Math.min(
    p.x - ex - min[0],
    max[0] - p.x - ex,
    p.z - ez - min[2],
    max[2] - p.z - ez,
    p.y0 - min[1],
    max[1] - p.y1,
  );
}

/** Half the width of rectangle `p` seen along the unit direction (kx, kz). */
const reach = (p: Prism, kx: number, kz: number) =>
  p.hu * Math.abs(p.c * kx - p.s * kz) + p.hv * Math.abs(p.s * kx + p.c * kz);

/** Signed distance (m) from (x, z) to rectangle `p`'s footprint; negative inside it. */
function distance(p: Prism, x: number, z: number): number {
  const dx = x - p.x;
  const dz = z - p.z;
  const qu = Math.abs(dx * p.c - dz * p.s) - p.hu;
  const qv = Math.abs(dx * p.s + dz * p.c) - p.hv;
  return Math.hypot(Math.max(qu, 0), Math.max(qv, 0)) + Math.min(Math.max(qu, qv), 0);
}

/**
 * How deep (m) two prisms interpenetrate: the smaller of their overlaps in height and in
 * footprint. Zero: they touch; negative: the gap between them along a separating axis.
 */
function penetration(a: Prism, b: Prism): number {
  const height = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  let footprint = Infinity;
  if (a.r > 0 && b.r > 0) footprint = a.r + b.r - Math.hypot(b.x - a.x, b.z - a.z);
  else if (a.r > 0) footprint = a.r - distance(b, a.x, a.z);
  else if (b.r > 0) footprint = b.r - distance(a, b.x, b.z);
  else {
    // Two rectangles: the separating axes are their edge directions.
    for (const [kx, kz] of [
      [a.c, -a.s],
      [a.s, a.c],
      [b.c, -b.s],
      [b.s, b.c],
    ] as const) {
      const centres = Math.abs((b.x - a.x) * kx + (b.z - a.z) * kz);
      footprint = Math.min(footprint, reach(a, kx, kz) + reach(b, kx, kz) - centres);
    }
  }
  return Math.min(height, footprint);
}

/**
 * Where a player walks through `opening`: as wide and high as it, from PASSAGE_DEPTH in front of
 * its wall, through the wall, to PASSAGE_DEPTH into the room behind it.
 */
function passage(room: RoomDefinition, opening: Opening): Prism {
  const { min, max } = room.bounds;
  const { wall, center, width, height } = opening;
  const outward = wall === 'west' || wall === 'north' ? -1 : 1;
  const face = { west: min[0], east: max[0], north: min[2], south: max[2] }[wall];
  const across = face + (outward * T) / 2;
  const half = PASSAGE_DEPTH + T / 2;
  const y = min[1] + height / 2;
  return wall === 'north' || wall === 'south'
    ? aligned([center, y, across], [width / 2, height / 2, half])
    : aligned([across, y, center], [half, height / 2, width / 2]);
}

/**
 * Every layout problem of the world scenes, one line each, starting with its rule (P1, P2, P3a,
 * P3b, P3c, P4, P5 or P8) and naming its scene, room, opening or placement. `tightest` receives
 * the tightest value each measured rule found (m; negative: within its allowance).
 */
export function layoutProblems(
  input: LayoutInput,
  tightest: Record<string, number> = {},
): string[] {
  const problems: string[] = [];
  /** `measure` (m) is a problem below −allowance. */
  const check = (rule: string, measure: number, allowance: number, where: string, what: string) => {
    tightest[rule] = Math.min(tightest[rule] ?? Infinity, measure);
    if (measure < -allowance) problems.push(`${rule} ${where}: ${what}`);
  };
  const arrivalRooms = new Set(input.arrivals.map((id) => id.slice(0, id.indexOf('/'))));
  const headroom = input.maxCharacterHeight + HEAD_CLEARANCE;

  for (const scene of input.scenes) {
    if (scene.kind !== 'world') continue;
    const rooms = scene.rooms.flatMap((id) => input.roomOf(id) ?? []);
    const solids: Solid[] = [];

    // P1: two rooms are at least a wall apart (a doorway pair exactly) along some axis.
    rooms.forEach((a, i) => {
      for (const b of rooms.slice(i + 1)) {
        const gap = (k: 0 | 1 | 2) =>
          Math.max(b.bounds.min[k] - a.bounds.max[k], a.bounds.min[k] - b.bounds.max[k]);
        const apart = Math.max(gap(0), gap(1), gap(2));
        check(
          'P1',
          apart - T,
          EPS,
          `scenes.${scene.id}`,
          `rooms "${a.id}" and "${b.id}" are ${m(apart)} apart, less than a wall (${m(T)})`,
        );
      }
    });

    for (const room of rooms) {
      const { min, max } = room.bounds;
      // P2: the tallest character's capsule passes every opening and fits in the room behind it.
      room.openings.forEach((o, i) => {
        const where = `rooms.${room.id}.openings.${i}`;
        const depth = o.wall === 'north' || o.wall === 'south' ? max[2] - min[2] : max[0] - min[0];
        check(
          'P2 width',
          o.width - MIN_OPENING_WIDTH,
          EPS,
          where,
          `${m(o.width)} wide, less than ${m(MIN_OPENING_WIDTH)}`,
        );
        check(
          'P2 height',
          o.height - headroom,
          EPS,
          where,
          `${m(o.height)} high, less than ${m(headroom)} (the tallest character + ${m(HEAD_CLEARANCE)})`,
        );
        check(
          'P2 depth',
          depth - PASSAGE_DEPTH,
          EPS,
          where,
          `the room is ${m(depth)} deep behind it, less than ${m(PASSAGE_DEPTH)}`,
        );
      });

      for (const p of room.placements) {
        const item = input.itemOf(p.item);
        if (!item) continue;
        const where = `rooms.${room.id}.placements.${p.id}`;
        const { body } = item.physical;
        // P3a: solids stay inside their room; P3b: objects without a body may sit in its shell — a
        // door between two rooms (Phase U) and its frame stand in the wall by design: its leaves
        // closed in the doorway, open in the wall; its frame through the wall.
        const doorway = !containsXZ(room.bounds, p.position[0], p.position[2]);
        for (const [pose, base, size, yaw] of posesOf(p, item)) {
          const prism = prismOf(item, base, yaw, size);
          const clear = clearance(prism, room.bounds);
          if (body === 'none') {
            check(
              'P3b',
              clear,
              doorway ? WALL_THICKNESS + PANEL_EMBED : PANEL_EMBED,
              where,
              `${m(-clear)} outside the room${pose}, deeper than ${m(PANEL_EMBED)}`,
            );
            continue;
          }
          if (!item.slider) {
            check('P3a', clear, CONTACT_TOLERANCE, where, `${m(-clear)} outside the room${pose}`);
          }
          solids.push({
            id: `${room.id}/${p.id}`,
            where,
            pose,
            prism,
            dynamic: body === 'dynamic',
            closes: (item.hinged !== undefined || item.slider !== undefined) && pose === '',
          });
        }
        // P3c: an apparatus' working points (outside its own box) stay inside the room.
        const anchors = {
          'launcher.muzzle': item.launcher?.muzzle,
          'pendulum.pivot': item.pendulum?.pivot,
          'dropTower.landing': item.dropTower?.landing,
          'springStand.hook': item.springStand?.hook,
          'bench.top': item.bench?.top,
        };
        for (const [name, local] of Object.entries(anchors)) {
          if (!local) continue;
          const clear = clearance(aligned(onPlacement(p, local), [0, 0, 0]), room.bounds);
          check(
            'P3c',
            clear,
            CONTACT_TOLERANCE,
            where,
            `its ${name} is ${m(-clear)} outside the room`,
          );
        }
      }
    }

    // P4: a dynamic body starts free of every other solid (each pair once) and of the room shells.
    solids.forEach((d, i) => {
      if (!d.dynamic) return;
      solids.forEach((s, j) => {
        if (s.id === d.id || (s.dynamic && j < i)) return;
        const depth = penetration(d.prism, s.prism);
        check('P4', -depth, CONTACT_TOLERANCE, d.where, `overlaps ${s.id}${s.pose} by ${m(depth)}`);
      });
      for (const room of rooms) {
        for (const slab of roomSlabs(room)) {
          const depth = penetration(d.prism, aligned(slab.center, slab.halfExtents));
          check(
            'P4 shell',
            -depth,
            CONTACT_TOLERANCE,
            d.where,
            `overlaps the ${slab.part} of room "${room.id}" by ${m(depth)}`,
          );
        }
      }
    });

    // P5: no solid stands in the passage of an opening into another room of the scene — a hinged
    // door's leaves open, and a sliding door's, that is (closed, it shuts its passage on purpose).
    const links: [string, string][] = [];
    for (const room of rooms) {
      room.openings.forEach((o, i) => {
        const next = rooms.find((other) => other !== room && leadsInto(room, o, other));
        if (!next) return; // an opening into no room is a boot error
        links.push([room.id, next.id]);
        const box = passage(room, o);
        for (const s of solids) {
          if (s.closes) continue;
          const depth = penetration(s.prism, box);
          check(
            'P5',
            -depth,
            CONTACT_TOLERANCE,
            `rooms.${room.id}.openings.${i}`,
            `${s.id}${s.pose} reaches ${m(depth)} into its passage`,
          );
        }
      });
    }

    // P8: every room is walked into through openings from where players appear in the scene.
    const [x, , z] = scene.spawn.position;
    const spawnRoom = rooms.find((r) => containsXZ(r.bounds, x, z));
    const reached = new Set(
      rooms.filter((r) => r === spawnRoom || arrivalRooms.has(r.id)).map((r) => r.id),
    );
    // A Set's iteration also visits what is added while it runs.
    for (const id of reached) {
      for (const [a, b] of links) {
        if (a === id) reached.add(b);
        if (b === id) reached.add(a);
      }
    }
    for (const room of rooms) {
      if (reached.has(room.id)) continue;
      problems.push(
        `P8 scenes.${scene.id}: room "${room.id}" is reached from neither the spawn nor an arrival door`,
      );
    }
  }
  return problems;
}
