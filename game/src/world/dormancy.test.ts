import { describe, expect, it } from 'vitest';
import { bundledContent } from '../content';
import { ItemDefinitionSchema } from '../gameplay/item';
import { RoomDefinitionSchema } from './definitions';
import { DORMANCY, awakeRooms, passagesBetween, type Passage } from './dormancy';

// Which rooms are drawn: the passages of the shipped Physics wing found with their sliding
// doors, and the rule — the player's room, what is seen through doorless openings and open doors,
// and what lies behind a closed door the player is near (with a gap before it sleeps again).

const rooms = (bundledContent.rooms as unknown[]).map((raw) => RoomDefinitionSchema.parse(raw));
const items = new Map(
  (bundledContent.items as unknown[]).map((raw) => {
    const item = ItemDefinitionSchema.parse(raw);
    return [item.id, item] as const;
  }),
);
const WING = ['physics-lab', 'pendulum-bay', 'waves-optics', 'projectile-range'];
const wing = rooms.filter((r) => WING.includes(r.id));
const sliders = wing.flatMap((room) =>
  room.placements
    .filter((p) => items.get(p.item)?.slider)
    .map((p) => ({ id: `${room.id}/${p.id}`, x: p.position[0], z: p.position[2] })),
);

describe('passages of the Physics wing', () => {
  const passages = passagesBetween(wing, sliders);

  it('joins the lab to the bay, the optics room and the range, each closed by its sliding door', () => {
    const pairs = passages.map((p) => [...p.rooms].sort().join(' – ')).sort();
    expect(pairs).toEqual([
      'pendulum-bay – physics-lab',
      'physics-lab – projectile-range',
      'physics-lab – waves-optics',
    ]);
    for (const p of passages) expect(p.closers.length, p.rooms.join(' – ')).toBeGreaterThan(0);
  });

  it('finds no passage between rooms that do not share a doorway', () => {
    expect(
      passagesBetween(
        wing.filter((r) => r.id !== 'physics-lab'),
        sliders,
      ),
    ).toEqual([]);
  });
});

const PASSAGES: Passage[] = [
  { rooms: ['lab', 'bay'], x: 0, z: -10, closers: ['bay-door'] },
  { rooms: ['lab', 'store'], x: 5, z: 0, closers: [] }, // a doorless opening
  { rooms: ['bay', 'yard'], x: 0, z: -20, closers: ['yard-door'] },
];
const ALL = ['lab', 'bay', 'store', 'yard'];
const shut = () => 0;
const at = (x: number, z: number, room: string | null = 'lab') => ({ x, z, room });

describe('awake rooms', () => {
  it('wakes the player’s room and what a doorless opening shows, not what a far shut door hides', () => {
    expect([...awakeRooms(ALL, PASSAGES, at(0, 0), shut, new Set())].sort()).toEqual([
      'lab',
      'store',
    ]);
  });

  it('wakes the room behind a shut door within wakeM of it, before the door can open', () => {
    const near = at(0, -10 + DORMANCY.wakeM - 0.01);
    expect(awakeRooms(ALL, PASSAGES, near, shut, new Set()).has('bay')).toBe(true);
    // Not the room behind the bay's own door, 17 m away.
    expect(awakeRooms(ALL, PASSAGES, near, shut, new Set()).has('yard')).toBe(false);
  });

  it('keeps it awake out to sleepM, then lets it sleep', () => {
    const between = at(0, -10 + (DORMANCY.wakeM + DORMANCY.sleepM) / 2);
    expect(awakeRooms(ALL, PASSAGES, between, shut, new Set()).has('bay')).toBe(false);
    expect(awakeRooms(ALL, PASSAGES, between, shut, new Set(['lab', 'bay'])).has('bay')).toBe(true);
    const beyond = at(0, -10 + DORMANCY.sleepM + 0.01);
    expect(awakeRooms(ALL, PASSAGES, beyond, shut, new Set(['lab', 'bay'])).has('bay')).toBe(false);
  });

  it('shows through an open door however far, and from the room beyond it', () => {
    const open = (id: string) => (id === 'bay-door' ? 0.5 : 0);
    expect(awakeRooms(ALL, PASSAGES, at(0, 30), open, new Set()).has('bay')).toBe(true);
    // In the bay: its room, the lab behind its door (near) and the yard 9.5 m away (asleep).
    const inBay = awakeRooms(ALL, PASSAGES, at(0, -10.5, 'bay'), shut, new Set());
    expect([...inBay].sort()).toEqual(['bay', 'lab', 'store']);
  });

  it('in a doorway: the rooms on both sides and those awake before, not every room', () => {
    const doorway = awakeRooms(ALL, PASSAGES, at(0, -10, null), shut, new Set(['lab', 'store']));
    expect([...doorway].sort()).toEqual(['bay', 'lab', 'store']); // the yard, 10 m on, sleeps
  });

  it('wakes everything when the player stands in no room and near no doorway (a load in a wall)', () => {
    expect(awakeRooms(ALL, PASSAGES, at(0, 0, null), shut, new Set()).size).toBe(4);
  });
});
