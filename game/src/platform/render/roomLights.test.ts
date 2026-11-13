import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { RoomLight } from '../../world/lighting';
import { RoomLightPool } from './roomLights';

const light = (roomId: string, role: RoomLight['role'], x: number): RoomLight => ({
  roomId,
  role,
  position: [x, 3, 0],
  target: [x, 0, 0],
  color: '#ffffff',
  intensity: 10,
  angle: 1,
  penumbra: 0.5,
  range: 8,
});

describe('the room light pool', () => {
  it('keeps a light in its slot while rooms wake and sleep around it (no map moved)', () => {
    const pool = new RoomLightPool(new THREE.Scene());
    const lab = [light('lab', 'key', 0), light('lab', 'fill', 1)];
    const bay = [light('bay', 'key', 10), light('bay', 'fill', 11)];
    const slotOf = (l: RoomLight) =>
      pool.slots.findIndex((s) => s.intensity > 0 && s.position.x === l.position[0]);
    pool.assign([...lab, ...bay]);
    const before = [...lab, ...bay].map(slotOf);
    expect(before.every((i) => i >= 0)).toBe(true);
    // The bay goes to sleep: the lab's lights stay where they were; the bay's slots go dark.
    pool.assign(lab);
    expect(lab.map(slotOf)).toEqual(before.slice(0, 2));
    expect(bay.map(slotOf)).toEqual([-1, -1]);
    // It wakes, listed first this time: still the same slots for the lab.
    pool.assign([...bay, ...lab]);
    expect(lab.map(slotOf)).toEqual(before.slice(0, 2));
    expect(pool.slots.filter((s) => s.intensity > 0)).toHaveLength(4);
    expect(pool.dropped).toBe(0);
  });

  it('more lights than slots: assigned in order, the first ones lit, the rest left out', () => {
    const pool = new RoomLightPool(new THREE.Scene());
    const keys = Array.from({ length: 6 }, (_, i) => light(`room-${i}`, 'key', i));
    pool.assign(keys);
    expect(pool.dropped).toBe(2);
    const lit = pool.slots.filter((s) => s.castShadow && s.intensity > 0).map((s) => s.position.x);
    expect(lit.sort()).toEqual([0, 1, 2, 3]);
  });
});
