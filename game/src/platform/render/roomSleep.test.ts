import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { RoomDefinition } from '../../world/definitions';
import { ASLEEP_LAYER, RoomSleep, type RoomSleepDeps } from './roomSleep';

// Rooms out of sight: what a room asleep becomes (its layer, its GPU resources freed unless shared
// with a room awake), how it wakes (warmed first, then its layers back), a door opening on a room
// still waking, the setting off. Real three objects; the renderer's warm-up is a promise here.

const room = (id: string, x0: number, x1: number, openings: RoomDefinition['openings']) =>
  ({
    id,
    bounds: { min: [x0, 0, -5], max: [x1, 3, 5] },
    openings,
  }) as unknown as RoomDefinition;
// Two rooms side by side, a door between (x = 10.125), the lab 0–10, the bay 10.25–20.
const ROOMS = [
  room('lab', 0, 10, [{ wall: 'east', center: 0, width: 2, height: 2.4 }]),
  room('bay', 10.25, 20, [{ wall: 'west', center: 0, width: 2, height: 2.4 }]),
];

function setup() {
  const scene = new THREE.Scene();
  const shared = new THREE.BoxGeometry();
  const own = new THREE.BoxGeometry();
  const map = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({ map });
  const labMesh = new THREE.Mesh(shared, new THREE.MeshStandardMaterial());
  const bayShared = new THREE.Mesh(shared, material);
  const bayOwn = new THREE.Mesh(own, material);
  bayOwn.layers.enable(3); // a layer of its own besides 0, kept through the sleep
  const sheen = new THREE.Mesh(own, material); // a child drawn with its parent
  bayOwn.add(sheen);
  scene.add(labMesh, bayShared, bayOwn);
  let open = 0;
  let release: () => void = () => undefined;
  const deps: RoomSleepDeps = {
    on: vi.fn(() => true),
    rooms: () => ROOMS,
    closers: () => [{ id: 'door', x: 10.125, z: 0 }],
    opening: () => open,
    roomAt: (x) => (x < 10 ? 'lab' : x > 10.25 ? 'bay' : null),
    objectsOf: (id) => (id === 'bay' ? [bayShared, bayOwn] : [labMesh]),
    scene,
    warm: vi.fn(
      (objects: THREE.Object3D[]) =>
        new Promise<void>((done) => {
          for (const o of objects) o.layers.set(31); // pending, as the renderer's warm-up does
          release = done;
        }),
    ),
    hurry: vi.fn(() => release()),
    changed: vi.fn(),
  };
  const disposed = new Set<string>();
  for (const [name, r] of [
    ['shared', shared],
    ['own', own],
    ['map', map],
  ] as const) {
    r.addEventListener('dispose', () => disposed.add(name));
  }
  return {
    deps,
    sleep: new RoomSleep(deps),
    labMesh,
    bayShared,
    bayOwn,
    sheen,
    disposed,
    setOpen: (f: number) => (open = f),
    finishWarm: () => release(),
  };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('room sleep', () => {
  it('lays a room far behind a shut door to sleep, its own GPU buffers freed, shared ones kept', () => {
    const t = setup();
    t.sleep.judge(1, 0); // in the lab, 9 m from the door
    expect(t.sleep.rooms).toEqual({ asleep: ['bay'], waking: [] });
    for (const o of [t.bayShared, t.bayOwn, t.sheen]) expect(o.layers.mask).toBe(1 << ASLEEP_LAYER);
    expect(t.labMesh.layers.mask).toBe(1);
    // Its own box freed; the box the lab draws too, and the texture, kept.
    expect([...t.disposed].sort()).toEqual(['own']);
    expect(t.deps.changed).toHaveBeenCalledTimes(1);
  });

  it('wakes it near the door, shut: warmed first, then its layers as they were', async () => {
    const t = setup();
    t.sleep.judge(1, 0);
    t.sleep.judge(4, 0); // 6.1 m from the door: within wakeM
    expect(t.sleep.rooms).toEqual({ asleep: [], waking: ['bay'] });
    expect(t.bayOwn.layers.isEnabled(31) && !t.bayOwn.layers.isEnabled(0)).toBe(true); // pending
    t.finishWarm();
    await settle();
    expect(t.sleep.rooms).toEqual({ asleep: [], waking: [] });
    expect(t.bayShared.layers.mask).toBe(1);
    expect(t.bayOwn.layers.mask).toBe(1 | (1 << 3));
    expect(t.sheen.layers.mask).toBe(1);
  });

  it('puts it back to sleep if the player turns away while it wakes', async () => {
    const t = setup();
    t.sleep.judge(1, 0);
    t.sleep.judge(4, 0);
    t.sleep.judge(0.5, 0); // 9.6 m: past sleepM
    t.finishWarm();
    await settle();
    expect(t.sleep.rooms).toEqual({ asleep: ['bay'], waking: [] });
    expect(t.bayOwn.layers.mask).toBe(1 << ASLEEP_LAYER);
    // And when it wakes for good, its own layers come back.
    t.sleep.judge(4, 0);
    t.finishWarm();
    await settle();
    expect(t.bayOwn.layers.mask).toBe(1 | (1 << 3));
  });

  it('hurries the warm-up when the door opens on a room still waking', () => {
    const t = setup();
    t.sleep.judge(1, 0);
    t.sleep.judge(4, 0);
    t.setOpen(0.2);
    t.sleep.judge(8.5, 0);
    expect(t.deps.hurry).toHaveBeenCalled();
  });

  it('keeps every room drawn with the setting off, and wakes those asleep when it is turned off', () => {
    const t = setup();
    t.sleep.judge(1, 0);
    vi.mocked(t.deps.on).mockReturnValue(false);
    t.sleep.judge(1, 0);
    expect(t.sleep.rooms.waking).toEqual(['bay']);
    expect(t.deps.warm).toHaveBeenCalledTimes(1);
  });

  it('puts what is spawned in a room asleep to sleep with it', () => {
    const t = setup();
    t.sleep.judge(1, 0);
    const late = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    t.sleep.adopt('bay', late);
    expect(late.layers.mask).toBe(1 << ASLEEP_LAYER);
    const here = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    t.sleep.adopt('lab', here);
    expect(here.layers.mask).toBe(1);
  });

  it('judges only every quarter second', () => {
    const t = setup();
    t.sleep.update(0.1, 1, 0);
    expect(t.sleep.rooms.asleep).toEqual([]);
    t.sleep.update(0.2, 1, 0);
    expect(t.sleep.rooms.asleep).toEqual(['bay']);
  });
});

describe('room sleep beside a scene being attached', () => {
  it('keeps what an object will be, not the warm-up layer it borrows, and says what it holds', async () => {
    const t = setup();
    // A neighbour scene just attached: its objects pending (layer 31) while it is warmed.
    for (const o of [t.bayShared, t.bayOwn, t.sheen]) o.layers.set(31);
    t.sleep.judge(1, 0);
    expect(t.sleep.holds(t.bayOwn)).toBe(true);
    expect(t.sleep.holds(t.labMesh)).toBe(false);
    t.sleep.judge(4, 0);
    expect(t.sleep.holds(t.bayOwn)).toBe(false); // waking: the scene's warm-up may show it
    t.finishWarm();
    await settle();
    for (const o of [t.bayShared, t.bayOwn, t.sheen]) expect(o.layers.mask).toBe(1); // drawn
  });
});
