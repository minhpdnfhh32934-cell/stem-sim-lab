import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../game/GameEvents';
import { captureLogger } from '../game/testing';
import { ItemDefinitionSchema } from '../gameplay/item';
import { PlacementSchema, type RoomDefinition } from './definitions';
import { entityFromPlacement, World } from './World';

const room = (id: string, minX: number, maxX: number): RoomDefinition => ({
  id,
  displayName: id,
  bounds: { min: [minX, 0, -2], max: [maxX, 3, 2] },
  floorColor: '#000000',
  wallColor: '#ffffff',
  floor: 'vinyl',
  style: 'plain',
  dark: false,
  openings: [],
  placements: [],
  lights: [],
});

const crate = ItemDefinitionSchema.parse({
  id: 'crate',
  displayName: 'Crate',
  category: 'material',
  physical: { massKg: 5 },
  visual: { shape: 'box', size: [0.4, 0.6, 0.4], color: '#aa8855' },
});

describe('World', () => {
  const world = () => new World(new EventBus<GameEvents>(captureLogger().log));

  it('finds the room containing a floor point', () => {
    const w = world();
    w.setRooms([room('a', 0, 5), room('b', 5, 10)]);
    expect(w.roomAt(2, 0)?.id).toBe('a');
    expect(w.roomAt(7, 0)?.id).toBe('b');
    expect(w.roomAt(11, 0)).toBeNull();
  });

  it('turns a placement into an entity posed at the centre of its box', () => {
    const placement = PlacementSchema.parse({
      id: 'c1',
      item: 'crate',
      position: [1, 0.9, -2],
      rotationY: Math.PI / 2,
    });
    const entity = entityFromPlacement('lab', placement, crate);
    expect(entity.id).toBe('lab/c1');
    expect(entity.pose.position).toEqual([1, 0.9 + 0.3, -2]);
    expect(entity.pose.rotation[1]).toBeCloseTo(Math.SQRT1_2, 12);
    expect(entity.pose.rotation[3]).toBeCloseTo(Math.SQRT1_2, 12);
  });

  it('publishes spawn/despawn and rejects duplicate entity ids', () => {
    const events = new EventBus<GameEvents>(captureLogger().log);
    const w = new World(events);
    const log: string[] = [];
    events.subscribe('EntitySpawned', ({ entity }) => log.push(`+${entity.id}`));
    events.subscribe('EntityDespawned', ({ entityId }) => log.push(`-${entityId}`));
    const entity = entityFromPlacement(
      'r',
      PlacementSchema.parse({ id: 'x', item: 'crate', position: [0, 0, 0] }),
      crate,
    );
    w.spawn(entity);
    expect(() => w.spawn(entity)).toThrow(/already exists/);
    expect(w.despawn('r/x')).toBe(true);
    expect(w.despawn('r/x')).toBe(false);
    expect(log).toEqual(['+r/x', '-r/x']);
  });
});
