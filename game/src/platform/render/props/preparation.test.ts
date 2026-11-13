import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import coreItems from '../../../content/core-items.json';
import labItems from '../../../content/items.json';
import rooms from '../../../content/rooms.json';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { RoomDefinitionSchema } from '../../../world/definitions';
import type { PropPart } from './parts';
import { PREPARATION_PROPS } from './preparation';
import { bounds, EPSILON, expectProp, triangles } from './testing';

/** Every shipped item: the core's and the lab pack's (the preparation area's are the core's). */
const items = [...coreItems, ...labItems];

// The preparation area's props at the size their items ship (UX2), and at 0.8 × that; then what
// the hand-wash station, the doorway casing and the wall fittings promise in the corridor.

/** The props as their items carry them: prop, item shape, size, triangles a copy may draw. */
const SHIPPED = [
  ['ppe-cabinet', 'box', [1.2, 2, 0.6], 600], // wardrobe
  ['bed-frame', 'box', [1, 0.5, 2], 600], // bed
  ['desk-drawer', 'box', [1.2, 0.75, 0.6], 300], // desk
  ['chair-frame', 'box', [0.45, 0.9, 0.45], 700], // chair
  ['notice-board', 'box', [0.9, 0.6, 0.04], 150], // notice-board
  ['sign-standoff', 'box', [1.2, 0.42, 0.03], 200], // sign-clean-area and the other signs
  ['locker-bank', 'box', [1.8, 1.9, 0.5], 1500], // locker
  ['gowning-bench', 'box', [0.4, 0.45, 1.6], 600], // gowning-bench
  ['ppe-shelf', 'box', [1.2, 1.8, 0.4], 2500], // ppe-shelf
  ['hand-wash-sink', 'box', [0.6, 0.9, 0.5], 500], // wash-basin
  ['wall-faucet', 'box', [0.2, 0.12, 0.08], 600], // faucet
  ['liquid-dispenser', 'box', [0.08, 0.2, 0.12], 300], // soap-dispenser, hand-sanitizer
  ['towel-dispenser', 'box', [0.1, 0.3, 0.28], 300], // paper-towels
  ['glove-dispenser', 'box', [0.12, 0.14, 0.26], 400], // nitrile-gloves
  ['pedal-bin', 'box', [0.3, 0.45, 0.3], 600], // pedal-bin
  ['wall-rail', 'box', [1.6, 0.14, 0.035], 300], // corridor-wall-rail
  ['architrave', 'box', [1.4, 2.3, 0.04], 300], // prep-architrave
  // UX3.1 PPE
  ['coat-on-hanger', 'box', [0.5, 1, 0.12], 800], // lab-coat
  ['safety-goggles', 'box', [0.18, 0.07, 0.1], 500], // safety-goggles
  ['face-shield', 'box', [0.26, 0.3, 0.18], 650], // face-shield
] as const;

const finish = (parts: readonly PropPart[], name: PropPart['finish']) => {
  const found = parts.find((p) => p.finish === name);
  expect(found, name).toBeDefined();
  return bounds(found!.geometry);
};

describe('preparation props', () => {
  it('cover every preparation builder', () => {
    expect(new Set(SHIPPED.map(([prop]) => prop))).toEqual(new Set(Object.keys(PREPARATION_PROPS)));
  });

  describe.each(SHIPPED.flatMap((row) => [1, 0.8].map((scale) => [...row, scale] as const)))(
    '%s (%s %j, ≤ %d triangles) × %d',
    (prop, shape, size, budget, scale) => {
      it('is sound and inside its box', () => {
        const scaled = size.map((v) => v * scale);
        expectProp(PREPARATION_PROPS[prop](scaled), shape, scaled);
      });

      if (scale === 1) {
        it('stays within its triangle budget', () => {
          expect(triangles(PREPARATION_PROPS[prop](size))).toBeLessThanOrEqual(budget);
        });
      }
    },
  );

  it('keep the doorway inside the casing empty', () => {
    const [w, h] = [1.4, 2.3];
    const [jamb, top] = [0.1, -h / 2 + 2.2]; // the opening: 1.2 m wide, 2.2 m high
    for (const { geometry } of PREPARATION_PROPS.architrave([w, h, 0.04])) {
      const position = geometry.getAttribute('position');
      for (let i = 0; i < position.count; i++) {
        const inside = Math.abs(position.getX(i)) < w / 2 - jamb - EPSILON;
        expect(inside && position.getY(i) < top - EPSILON).toBe(false);
      }
    }
  });

  it('set the basin’s bowl under the wall faucet, in a countertop at the box’s top', () => {
    const [w, h, d] = [0.6, 0.9, 0.5];
    const parts = PREPARATION_PROPS['hand-wash-sink']([w, h, d]);
    expect(finish(parts, 'stone').max.y).toBeCloseTo(h / 2, 6);
    // The faucet's stream falls 0.1 m from the wall (rooms.json: x −1.4 over a basin from −1.5).
    const bowl = finish(parts, 'steel');
    expect(bowl.min.z).toBeLessThan(-d / 2 + 0.1);
    expect(bowl.max.z).toBeGreaterThan(-d / 2 + 0.1);
    expect(bowl.min.y).toBeLessThan(h / 2 - 0.1); // a real bowl, not a dish
  });

  it('mount the basin’s wall fittings with their backs on the west wall (−x)', () => {
    for (const [prop, size] of [
      ['liquid-dispenser', [0.08, 0.2, 0.12]],
      ['towel-dispenser', [0.1, 0.3, 0.28]],
      ['glove-dispenser', [0.12, 0.14, 0.26]],
      ['wall-faucet', [0.2, 0.12, 0.08]],
    ] as const) {
      const parts = PREPARATION_PROPS[prop](size);
      const plate = finish(
        parts,
        prop === 'glove-dispenser' || prop === 'wall-faucet' ? 'steel' : 'aluminium',
      );
      expect(plate.min.x, prop).toBeCloseTo(-size[0] / 2, 6);
    }
  });

  it('let the faucet’s outlet end at the bottom centre, where its stream hangs', () => {
    const body = PREPARATION_PROPS['wall-faucet']([0.2, 0.12, 0.08]).find(
      (p) => p.finish === 'body',
    )!.geometry;
    const position = body.getAttribute('position');
    let lowest = { x: 0, y: Infinity };
    for (let i = 0; i < position.count; i++)
      if (position.getY(i) < lowest.y) lowest = { x: position.getX(i), y: position.getY(i) };
    expect(lowest.y).toBeCloseTo(-0.06, 6);
    expect(Math.abs(lowest.x)).toBeLessThan(0.02);
  });
});

// UX3.1: the PPE cabinet's shelves and rail against where rooms.json puts the PPE (a placement's y
// is its item's bottom, World.ts), so the two cannot drift apart again.
describe('the PPE cabinet and the PPE it holds', () => {
  interface Placed {
    id: string;
    position: number[];
    rotationY?: number;
  }
  const placements = (rooms as unknown as { id: string; placements: Placed[] }[]).find(
    (room) => room.id === 'preparation-room',
  )!.placements;
  const sizeOf = (id: string) =>
    (items as unknown as { id: string; visual: { size: number[] } }[]).find((i) => i.id === id)!
      .visual.size as [number, number, number];
  const placed = (id: string) => placements.find((p) => p.id === id)!;
  const cabinet = placed('wardrobe');
  const [cw, ch, cd] = sizeOf('wardrobe');
  const theta = cabinet.rotationY ?? 0;
  const parts = PREPARATION_PROPS['ppe-cabinet']([cw, ch, cd]);
  const body = parts.find((p) => p.finish === 'body' && !p.hinge)!.geometry;
  const rail = finish(
    parts.filter((p) => !p.hinge),
    'steel',
  );
  const face = Math.min(...parts.filter((p) => p.hinge).map((p) => bounds(p.geometry).min.z));

  /** An item's box in the cabinet's frame (turned with the cabinet, so the axes are shared). */
  const inCabinet = (id: string) => {
    const p = placed(id);
    const [w, h, d] = sizeOf(id);
    expect(p.rotationY, id).toBe(theta);
    const [dx, dz] = [
      (p.position[0] ?? 0) - (cabinet.position[0] ?? 0),
      (p.position[2] ?? 0) - (cabinet.position[2] ?? 0),
    ];
    const [x, z] = [
      dx * Math.cos(theta) - dz * Math.sin(theta),
      dx * Math.sin(theta) + dz * Math.cos(theta),
    ];
    const y = (p.position[1] ?? 0) + h / 2 - ((cabinet.position[1] ?? 0) + ch / 2);
    return { x, y, z, w, h, d, size: [w, h, d] as const };
  };

  it.each(['safety-goggles', 'face-shield'] as const)('stands the %s on a shelf', (id) => {
    const { x, y, z, w, h, d, size } = inCabinet(id);
    const position = body.getAttribute('position');
    const shelf = new THREE.Box3();
    for (let i = 0; i < position.count; i++)
      if (Math.abs(position.getY(i) - (y - h / 2)) < EPSILON)
        shelf.expandByPoint(new THREE.Vector3(position.getX(i), 0, position.getZ(i)));
    expect(shelf.isEmpty(), `a shelf top at the ${id}'s bottom`).toBe(false);
    expect(shelf.min.x).toBeLessThanOrEqual(x - w / 2);
    expect(shelf.max.x).toBeGreaterThanOrEqual(x + w / 2);
    expect(shelf.min.z).toBeLessThanOrEqual(z - d / 2);
    expect(shelf.max.z).toBeGreaterThanOrEqual(z + d / 2);
    // …and the model touches it: its lowest point is its box's bottom.
    const lowest = Math.min(...PREPARATION_PROPS[id](size).map((p) => bounds(p.geometry).min.y));
    expect(lowest).toBeCloseTo(-h / 2, 6);
  });

  it('hangs the coat by its hook from the rail, just under the coat’s top', () => {
    const { x, y, z, w, h, size } = inCabinet('lab-coat');
    const top = y + h / 2;
    expect(rail.max.y).toBeLessThanOrEqual(top);
    expect(rail.max.y).toBeGreaterThan(top - 0.02);
    expect(rail.min.x).toBeLessThanOrEqual(x - w / 2);
    expect(rail.max.x).toBeGreaterThanOrEqual(x + w / 2);
    const coat = PREPARATION_PROPS['coat-on-hanger'](size);
    // The hook rises over the rail without touching it (the rail's axis in the coat's frame).
    const [ay, az, radius] = [
      (rail.min.y + rail.max.y) / 2 - y,
      (rail.min.z + rail.max.z) / 2 - z,
      (rail.max.y - rail.min.y) / 2,
    ];
    const hook = coat.find((p) => p.finish === 'steel')!.geometry;
    expect(bounds(hook).max.y).toBeGreaterThan(rail.max.y - y);
    const position = hook.getAttribute('position');
    for (let i = 0; i < position.count; i++)
      expect(Math.hypot(position.getY(i) - ay, position.getZ(i) - az)).toBeGreaterThan(radius);
    // The cloth hangs below the rail.
    for (const p of coat.filter((p) => p.finish !== 'steel'))
      expect(bounds(p.geometry).max.y, p.finish).toBeLessThan(rail.min.y - y);
  });

  it.each(['lab-coat', 'safety-goggles', 'face-shield'] as const)(
    'keeps the %s in front of the open cabinet’s back and behind its closed doors',
    (id) => {
      const { z, d } = inCabinet(id);
      const open = (
        items as unknown as {
          id: string;
          visual: { openBox?: { center: number[]; size: number[] } };
        }[]
      ).find((i) => i.id === 'wardrobe')!.visual.openBox!;
      expect(z - d / 2).toBeGreaterThanOrEqual(
        (open.center[2] ?? 0) + (open.size[2] ?? 0) / 2 - 1e-4,
      );
      expect(z + d / 2).toBeLessThan(face);
    },
  );
});

describe('the corridor faucet’s water (items.json, rooms.json)', () => {
  const item = (id: string) => ItemDefinitionSchema.parse(items.find((i) => i.id === id));
  const corridor = RoomDefinitionSchema.parse(rooms.find((r) => r.id === 'cleanroom-corridor'));
  const placed = (id: string) => {
    const found = corridor.placements.find((p) => p.id === id);
    expect(found, id).toBeDefined();
    return found!;
  };
  const Y = new THREE.Vector3(0, 1, 0);
  /** A placement's item centre and its yaw (World.entityFromPlacement). */
  const pose = (id: string, height: number) => {
    const { position, rotationY } = placed(id);
    const [x, y, z] = position;
    return { centre: new THREE.Vector3(x, y + height / 2, z), yaw: rotationY };
  };

  it('falls from the spout’s mouth onto the hand-wash bowl’s floor, inside the bowl', () => {
    const faucet = item('faucet');
    const stream = faucet.visual.stream!;
    const tap = pose('faucet', faucet.visual.size[1]);
    const mouth = new THREE.Vector3(...(stream.from ?? [0, -faucet.visual.size[1] / 2, 0]))
      .applyAxisAngle(Y, tap.yaw)
      .add(tap.centre);
    // Down from the mouth through the basin's own parts, in the basin's frame.
    const basin = item(placed('wash-basin').item);
    expect(basin.visual.prop).toBe('hand-wash-sink');
    const sink = pose('wash-basin', basin.visual.size[1]);
    const local = mouth.clone().sub(sink.centre).applyAxisAngle(Y, -sink.yaw);
    const meshes = PREPARATION_PROPS['hand-wash-sink'](basin.visual.size).map((p) => {
      const mesh = new THREE.Mesh(p.geometry);
      mesh.name = p.finish;
      return mesh;
    });
    const [hit] = new THREE.Raycaster(local, new THREE.Vector3(0, -1, 0)).intersectObjects(meshes);
    expect(hit, 'something under the mouth').toBeDefined();
    // The bowl's steel floor, below the countertop: not the counter, the drain or the rim.
    expect(hit!.object.name).toBe('steel');
    expect(hit!.point.y).toBeLessThan(basin.visual.size[1] / 2 - 0.1);
    const gap = local.y - stream.length - hit!.point.y; // its end above the floor
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThan(0.005);
  });

  it('starts at the outlet the faucet’s prop draws (its lowest point)', () => {
    const faucet = item('faucet');
    const [x, y, z] = faucet.visual.stream!.from!;
    expect(y).toBeCloseTo(-faucet.visual.size[1] / 2, 6); // the outlet test above: y −0.06
    expect(Math.hypot(x, z)).toBeLessThan(0.002);
  });
});
