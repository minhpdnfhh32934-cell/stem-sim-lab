import { describe, expect, it } from 'vitest';
import { EventBus } from '../../core/EventBus';
import { ENGLISH } from '../../core/i18n';
import { Logger } from '../../core/Logger';
import type { Vec3 } from '../../core/math';
import type { GameEvents } from '../../game/GameEvents';
import {
  capsuleInBox,
  createYawBox,
  leafOffset,
  type SlidingPair,
  sweptBox,
} from '../../world/door';
import {
  AWAY_M,
  CLOSE_DOOR_ACTION,
  type DoorDriver,
  type DoorPair,
  type DoorPhase,
  DoorSystem,
  HOLD_S,
  LEAF_GAP_S,
  MARGIN_M,
  type NeighbourScenes,
  OPEN_DOOR_ACTION,
  APPROACH_M,
  ARM_S,
  PREPARE_M,
  PREPARE_RETRY_S,
  RELEASE_M,
  RETRY_S,
} from './DoorSystem';

const DT = 1 / 60;
const LEAF_OPEN_FRAMES = 48; // openS 0.8 s: one leaf
const LEAF_CLOSE_FRAMES = 48; // closeS 0.8 s: one leaf
const GAP_FRAMES = 12; // LEAF_GAP_S 0.2 s between the two leaves
/** The whole pair: the player's side, the gap, the other leaf. */
const OPEN_FRAMES = 2 * LEAF_OPEN_FRAMES + GAP_FRAMES;
const CLOSE_FRAMES = 2 * LEAF_CLOSE_FRAMES + GAP_FRAMES;
const HOLD_FRAMES = 90; // HOLD_S 1.5 s
const HUB_LEAF = 'hub/door-lab';
const LAB_LEAF = 'lab/door-hub';
/** The player on either side of the lab wall: [side, feet, the leaf on that side, the other]. */
const SIDES: [string, Vec3, string, string][] = [
  ['hub', [0, 0, 3], HUB_LEAF, LAB_LEAF],
  ['lab', [0, 0, -3], LAB_LEAF, HUB_LEAF],
];
const R = 0.3;
const HALF = 0.85;
const LEAF: Vec3 = [1, 2.1, 0.08];

/** Hub ⇄ lab on a wall along x. The lab is spawned 10.35 m north of the hub's origin. */
const LAB: DoorPair = {
  leaves: [
    { entityId: 'hub/door-lab', sceneId: 'hub', position: [0, 1.05, 0], size: LEAF },
    { entityId: 'lab/door-hub', sceneId: 'lab', position: [0, 1.05, 10], size: LEAF },
  ],
  rotationY: 0,
  travel: 1,
  openS: 0.8,
  closeS: 0.8,
  procedure: false,
};
/** Hub ⇄ bio on a wall along z: the bio room is spawned 11.25 m east. */
const BIO: DoorPair = {
  leaves: [
    { entityId: 'hub/door-bio', sceneId: 'hub', position: [5.95, 1.05, 0], size: LEAF },
    { entityId: 'bio/door-hub', sceneId: 'bio', position: [-4.95, 1.05, 0], size: LEAF },
  ],
  rotationY: Math.PI / 2,
  travel: 1,
  openS: 0.8,
  closeS: 0.8,
  procedure: false,
};
const OFFSETS: Readonly<Record<string, Vec3>> = {
  hub: [0, 0, 0],
  lab: [0, 0, -10.35],
  bio: [11.25, 0, 0],
};
/** LAB as it stands in the world: hub leaf at z 0, lab leaf at z −0.35, centre z −0.175. */
const LAB_WORLD: SlidingPair = {
  leaves: [
    { center: [0, 1.05, 0], size: LEAF },
    { center: [0, 1.05, -0.35], size: LEAF },
  ],
  rotationY: 0,
  travel: 1,
};

class FakeScenes implements NeighbourScenes {
  currentSceneId: string | null = 'hub';
  readonly resident = new Set(['hub']);
  readonly pending: { sceneId: string; resolve: (reason: string | null) => void }[] = [];
  readonly released: string[] = [];

  isResident(sceneId: string): boolean {
    return this.resident.has(sceneId);
  }
  offsetOf(sceneId: string): Readonly<Vec3> | null {
    return this.resident.has(sceneId) ? (OFFSETS[sceneId] ?? null) : null;
  }
  attach(sceneId: string): Promise<string | null> {
    return new Promise((resolve) => this.pending.push({ sceneId, resolve }));
  }
  release(sceneId: string): void {
    this.released.push(sceneId);
    this.resident.delete(sceneId);
  }
  /** Answers the oldest attach; on success the scene is resident first, as the scene manager does. */
  answer(reason: string | null): void {
    const next = this.pending.shift();
    if (!next) throw new Error('no attach is pending');
    if (reason === null) this.resident.add(next.sceneId);
    next.resolve(reason);
  }
}

class FakeDriver implements DoorDriver {
  readonly calls: [string, number][] = [];
  dynamic = false;
  /** The last box asked about, copied; and every array instance handed over. */
  last: { center: Vec3; halfExtents: Vec3; rotationY: number } | null = null;
  readonly arrays = new Set<Readonly<Vec3>>();

  setDoorOpening(entityId: string, f: number): void {
    this.calls.push([entityId, f]);
  }
  dynamicBodyIn(center: Readonly<Vec3>, halfExtents: Readonly<Vec3>, rotationY: number) {
    this.last = { center: [...center], halfExtents: [...halfExtents], rotationY };
    this.arrays.add(center).add(halfExtents);
    return this.dynamic;
  }
}

function setup(pairs: readonly DoorPair[] = [LAB], feet: Vec3 = [0, 0, 3], prepareAhead = false) {
  const events = new EventBus<GameEvents>(Logger.create('error', () => undefined));
  const scenes = new FakeScenes();
  const driver = new FakeDriver();
  const player: { position: Vec3; radius: number; halfHeight: number; yaw?: number } = {
    position: feet,
    radius: R,
    halfHeight: HALF,
  };
  const logs: string[] = [];
  const log = Logger.create('debug', (_level, _channel, message) => logs.push(message));
  const doors = new DoorSystem({
    pairs,
    scenes,
    driver,
    player,
    events,
    texts: ENGLISH,
    log,
    prepareAhead,
  });
  doors.init();
  const changes: (readonly [string, string, DoorPhase])[] = [];
  events.subscribe('DoorChanged', ({ doorIds, state }) => changes.push([...doorIds, state]));
  const blocked: GameEvents['ActionBlocked'][] = [];
  events.subscribe('ActionBlocked', (e) => blocked.push(e));
  return {
    events,
    scenes,
    driver,
    player,
    doors,
    logs,
    changes,
    blocked,
    states: () => changes.map(([, , state]) => state),
    request: (entityId: string) => events.publish('DoorRequested', { entityId }),
    run(frames: number, dt = DT) {
      for (let i = 0; i < frames; i++) doors.update(dt);
    },
  };
}

/** The lab pair, open, with the lab resident; the player 3 m from it (away). */
function openLab(feet: Vec3 = [0, 0, 3]) {
  const t = setup([LAB], feet);
  t.scenes.resident.add('lab');
  t.request('hub/door-lab');
  t.run(OPEN_FRAMES);
  expect(t.doors.state('hub/door-lab')).toBe('open');
  return t;
}

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** The lowest fraction whose remaining closing path (+ the margin) still meets the capsule. */
function lowestMeeting(feet: Readonly<Vec3>): number {
  const box = createYawBox();
  for (let i = 0; i <= 1000; i++) {
    if (capsuleInBox(sweptBox(LAB_WORLD, i / 1000, 0, MARGIN_M, box), feet, R, HALF)) {
      return i / 1000;
    }
  }
  return Infinity;
}

const leafBox = createYawBox();
const shift: Vec3 = [0, 0, 0];
/** A capsule at `feet` overlaps (or touches) a lab-pair leaf: the hub's at fHub, the lab's at fLab. */
function overlapsLeaves(feet: Readonly<Vec3>, fHub: number, fLab = fHub): boolean {
  for (const [k, leaf] of LAB_WORLD.leaves.entries()) {
    leafOffset(LAB_WORLD.rotationY, LAB_WORLD.travel, k === 0 ? fHub : fLab, shift);
    for (let i = 0; i < 3; i++) {
      leafBox.center[i] = leaf.center[i]! + shift[i]!;
      leafBox.halfExtents[i] = leaf.size[i]! / 2;
    }
    if (capsuleInBox(leafBox, feet, R, HALF)) return true;
  }
  return false;
}

/** One frame as the driver and the doors saw it. */
interface Frame {
  /** The driver calls made during the frame. */
  calls: [string, number][];
  state: DoorPhase | null;
}

/** Runs `count` frames of 1/60 s, one at a time, recording each. */
function record(t: ReturnType<typeof setup>, count: number): Frame[] {
  const frames: Frame[] = [];
  for (let i = 0; i < count; i++) {
    const from = t.driver.calls.length;
    t.run(1);
    frames.push({ calls: t.driver.calls.slice(from), state: t.doors.state(HUB_LEAF) });
  }
  return frames;
}

/**
 * Each frame moves leaf `id` alone, one driver call, by an equal step from `from`; the last frame
 * reaches `to` (exactly, at a leaf's end).
 */
function expectSlide(frames: readonly Frame[], id: string, from: number, to: number): void {
  frames.forEach(({ calls }, k) => {
    expect(calls, `frame ${k}`).toHaveLength(1);
    const [who, f] = calls[0]!;
    expect(who, `frame ${k}`).toBe(id);
    expect(f, `frame ${k}`).toBeCloseTo(from + ((to - from) * (k + 1)) / frames.length, 12);
    if (k === frames.length - 1 && (to === 0 || to === 1)) expect(f).toBe(to);
  });
}

/** Frames of the gap between the leaves: nothing moves, the pair stays in `state`. */
function expectGap(frames: readonly Frame[], state: DoorPhase): void {
  expect(frames).toHaveLength(GAP_FRAMES);
  for (const frame of frames) expect(frame).toEqual({ calls: [], state });
}

/** Every frame but the last is in `during`; the last is in `end`. */
function expectStates(frames: readonly Frame[], during: DoorPhase, end: DoorPhase): void {
  expect(frames.slice(0, -1).filter((f) => f.state !== during)).toEqual([]);
  expect(frames.at(-1)?.state).toBe(end);
}

/** Player positions on both sides of the lab doorway, in it, and in the pockets. */
function* around(): Generator<Vec3> {
  for (let i = 0; i <= 20; i++) {
    for (let k = 0; k <= 12; k++) yield [-1.2 + i * 0.15, 0, -1 + k * 0.15];
  }
}

describe('DoorSystem', () => {
  it('opens one leaf at a time in openS each, holds HOLD_S once the player is away and closes the same way', () => {
    const t = setup();
    t.scenes.resident.add('lab');
    t.request('hub/door-lab');
    expect(t.doors.state('hub/door-lab')).toBe('opening');
    t.run(LEAF_OPEN_FRAMES / 2); // the hub leaf (the player's side) first, alone
    expect(t.doors.fraction(HUB_LEAF)).toBeCloseTo(0.5, 12);
    expect(t.doors.fraction(LAB_LEAF)).toBe(0);
    t.run(LEAF_OPEN_FRAMES / 2);
    expect(t.doors.fraction(HUB_LEAF)).toBe(1);
    expect(t.doors.fraction(LAB_LEAF)).toBe(0);
    t.run(GAP_FRAMES); // the gap: nothing moves
    expect(t.doors.state('hub/door-lab')).toBe('opening');
    expect(t.doors.fraction(LAB_LEAF)).toBe(0);
    t.run(LEAF_OPEN_FRAMES - 1);
    expect(t.doors.state('hub/door-lab')).toBe('opening');
    expect(t.doors.fraction(LAB_LEAF)).toBeCloseTo(47 / 48, 12);
    t.run(1);
    expect(t.doors.state('hub/door-lab')).toBe('open');
    expect(t.doors.fraction('hub/door-lab')).toBe(1);
    expect(t.doors.fraction(LAB_LEAF)).toBe(1);
    t.run(HOLD_FRAMES - 1);
    expect(t.doors.state('hub/door-lab')).toBe('open');
    t.run(1);
    expect(t.doors.state('hub/door-lab')).toBe('closing');
    t.run(LEAF_CLOSE_FRAMES - 1); // the hub leaf first again
    expect(t.doors.fraction('hub/door-lab')).toBeCloseTo(1 / 48, 12);
    expect(t.doors.fraction(LAB_LEAF)).toBe(1);
    t.run(1);
    expect(t.doors.fraction(HUB_LEAF)).toBe(0);
    t.run(GAP_FRAMES);
    expect(t.doors.state('hub/door-lab')).toBe('closing');
    expect(t.doors.fraction(LAB_LEAF)).toBe(1);
    t.run(LEAF_CLOSE_FRAMES - 1);
    expect(t.doors.state('hub/door-lab')).toBe('closing');
    expect(t.doors.fraction(LAB_LEAF)).toBeCloseTo(1 / 48, 12);
    t.run(1);
    expect(t.doors.state('hub/door-lab')).toBe('closed');
    expect(t.doors.fraction('hub/door-lab')).toBe(0);
    expect(t.doors.fraction(LAB_LEAF)).toBe(0);
    // (0.8 + 0.2 + 0.8) + 1.5 + (0.8 + 0.2 + 0.8) s = 306 frames of 1/60 s.
    expect(GAP_FRAMES * DT).toBeCloseTo(LEAF_GAP_S, 12);
    expect((OPEN_FRAMES + HOLD_FRAMES + CLOSE_FRAMES) * DT).toBeCloseTo(
      0.8 + LEAF_GAP_S + 0.8 + HOLD_S + 0.8 + LEAF_GAP_S + 0.8,
      12,
    );

    expect(t.changes).toEqual([
      ['hub/door-lab', 'lab/door-hub', 'opening'],
      ['hub/door-lab', 'lab/door-hub', 'open'],
      ['hub/door-lab', 'lab/door-hub', 'closing'],
      ['hub/door-lab', 'lab/door-hub', 'closed'],
    ]);
    // The driver hears every change of f, of the leaf that moves alone, and nothing else.
    const slide = (id: string) => Array<string>(LEAF_OPEN_FRAMES).fill(id);
    expect(t.driver.calls.map(([id]) => id)).toEqual([
      ...slide(HUB_LEAF),
      ...slide(LAB_LEAF),
      ...slide(HUB_LEAF),
      ...slide(LAB_LEAF),
    ]);
    const f = t.driver.calls.map(([, value]) => value);
    for (let k = 1; k <= LEAF_OPEN_FRAMES; k++) {
      expect(f[k - 1]).toBeCloseTo(k / 48, 12); // hub opening
      expect(f[LEAF_OPEN_FRAMES + k - 1]).toBeCloseTo(k / 48, 12); // lab opening
      expect(f[2 * LEAF_OPEN_FRAMES + k - 1]).toBeCloseTo(1 - k / 48, 12); // hub closing
      expect(f[3 * LEAF_OPEN_FRAMES + k - 1]).toBeCloseTo(1 - k / 48, 12); // lab closing
    }
    expect([47, 95, 143, 191].map((i) => f[i])).toEqual([1, 1, 0, 0]); // the ends, exactly
    expect(t.scenes.released).toEqual(['lab']); // the player stayed in the hub
  });

  it('stays open while the player is near, without telling the driver anything', () => {
    const t = openLab([0, 0, 1]);
    const calls = t.driver.calls.length;
    t.run(1000);
    expect(t.doors.state('hub/door-lab')).toBe('open');
    expect(t.driver.calls).toHaveLength(calls);
  });

  it('counts HOLD_S from when the player went farther than AWAY_M', () => {
    const centreZ = -0.175;
    const near: Vec3 = [0, 0, centreZ + AWAY_M - 0.01];
    const far: Vec3 = [0, 0, centreZ + AWAY_M + 0.01];
    const t = openLab(near);
    t.run(600);
    expect(t.doors.state('hub/door-lab')).toBe('open');
    t.player.position = far;
    t.run(HOLD_FRAMES - 6);
    t.player.position = near; // back for one frame: the hold starts again
    t.run(1);
    t.player.position = far;
    t.run(HOLD_FRAMES - 1);
    expect(t.doors.state('hub/door-lab')).toBe('open');
    t.run(1);
    expect(t.doors.state('hub/door-lab')).toBe('closing');
  });

  it("closes a procedure's entrance or exit as soon as the player is away", () => {
    const t = setup([{ ...LAB, procedure: true }], [0, 0, 1]);
    t.scenes.resident.add('lab');
    t.request('hub/door-lab');
    t.run(OPEN_FRAMES + 600);
    expect(t.doors.state('hub/door-lab')).toBe('open'); // near: it waits for the player
    t.player.position = [0, 0, 3];
    t.run(1);
    expect(t.doors.state('hub/door-lab')).toBe('closing');
    t.run(CLOSE_FRAMES);
    expect(t.doors.state('hub/door-lab')).toBe('closed');
  });

  it("waits HOLD_S for a player who opened a procedure's door from afar, then closes", () => {
    // Within reach of its leaf, farther than AWAY_M from its centre: never near yet.
    const t = setup([{ ...LAB, procedure: true }], [0, 0, 2.1]);
    t.scenes.resident.add('lab');
    t.request('hub/door-lab');
    t.run(OPEN_FRAMES + HOLD_FRAMES - 1);
    expect(t.doors.state('hub/door-lab')).toBe('open'); // time to walk up to it
    t.run(1);
    expect(t.doors.state('hub/door-lab')).toBe('closing');
    // Opened again, the player comes to it: leaving now closes it at once.
    t.run(CLOSE_FRAMES);
    t.scenes.resident.add('lab'); // released once closed: here again
    t.request('hub/door-lab');
    t.run(OPEN_FRAMES);
    t.player.position = [0, 0, 1];
    t.run(1);
    t.player.position = [0, 0, 3];
    t.run(1);
    expect(t.doors.state('hub/door-lab')).toBe('closing');
  });

  it('keeps the leaves shut until the far scene is resident', async () => {
    const t = setup();
    t.request('hub/door-lab');
    expect(t.doors.state('hub/door-lab')).toBe('preparing');
    expect(t.doors.isOpen('hub/door-lab')).toBe(false);
    t.request('hub/door-lab'); // asked again while preparing: one attach
    expect(t.scenes.pending.map((p) => p.sceneId)).toEqual(['lab']);
    t.run(120);
    expect(t.driver.calls).toEqual([]);
    expect(t.doors.fraction('hub/door-lab')).toBe(0);

    t.scenes.answer(null);
    await settle();
    expect(t.doors.state('hub/door-lab')).toBe('opening');
    t.run(1);
    expect(t.doors.fraction('hub/door-lab')).toBeCloseTo(1 / 48, 12);
    expect(t.states()).toEqual(['preparing', 'opening']);
  });

  it('attaches the scene behind the leaf that was not asked', () => {
    const t = setup();
    t.scenes.currentSceneId = 'lab';
    t.scenes.resident.clear();
    t.scenes.resident.add('lab');
    t.request('lab/door-hub');
    expect(t.scenes.pending.map((p) => p.sceneId)).toEqual(['hub']);
  });

  it('stays closed with the reason when the far scene cannot be prepared, then retries', async () => {
    const t = setup();
    t.request('hub/door-lab');
    t.scenes.answer('physics could not load');
    await settle();
    expect(t.doors.state('hub/door-lab')).toBe('closed');
    expect(t.blocked).toEqual([
      {
        entityId: 'hub/door-lab',
        actionId: OPEN_DOOR_ACTION,
        reason: 'The way is not ready: physics could not load',
      },
    ]);
    t.run(60);
    expect(t.driver.calls).toEqual([]);
    expect(t.scenes.released).toEqual([]);

    t.request('hub/door-lab');
    expect(t.doors.state('hub/door-lab')).toBe('preparing');
    t.scenes.answer(null);
    await settle();
    t.run(OPEN_FRAMES);
    expect(t.doors.state('hub/door-lab')).toBe('open');
    expect(t.states()).toEqual(['preparing', 'closed', 'preparing', 'opening', 'open']);
  });

  it('treats an attach that rejects or throws as not ready', async () => {
    const t = setup();
    t.scenes.attach = () => Promise.reject(new Error('a scene is loading'));
    t.request('hub/door-lab');
    await settle();
    expect(t.doors.state('hub/door-lab')).toBe('closed');
    expect(t.blocked.at(-1)?.reason).toBe('The way is not ready: a scene is loading');
    t.scenes.attach = () => {
      throw new Error('no such scene');
    };
    t.request('hub/door-lab');
    await settle();
    expect(t.doors.state('hub/door-lab')).toBe('closed');
    expect(t.blocked.at(-1)?.reason).toBe('The way is not ready: no such scene');
  });

  it('never closes onto a player standing in the doorway', () => {
    const t = openLab();
    const feet: Vec3 = [0, 0, -0.175]; // in the tunnel, mid-wall
    t.player.position = feet;
    const meeting = lowestMeeting(feet);
    expect(meeting).toBeCloseTo(0.1, 2); // the remaining path (+ margin) reaches the capsule from f 0.1
    t.request('hub/door-lab');
    let lowest = 1;
    for (let i = 0; i < 300; i++) {
      t.run(1);
      lowest = Math.min(lowest, t.doors.fraction('hub/door-lab'), t.doors.fraction(LAB_LEAF));
    }
    expect(lowest).toBeGreaterThanOrEqual(meeting);
    expect(lowest).toBe(1);
    expect(t.doors.state('hub/door-lab')).toBe('open');
    expect(t.states()).toEqual(['opening', 'open', 'closing', 'blocked', 'open']);
    expect(t.blocked).toEqual([
      {
        entityId: 'hub/door-lab',
        actionId: CLOSE_DOOR_ACTION,
        reason: 'The doorway is not clear.',
      },
    ]);
    expect(t.driver.last).toBeNull(); // the player alone decided it
  });

  it('stops closing the moment the player steps into what is left of the doorway', () => {
    const t = openLab();
    t.run(HOLD_FRAMES + LEAF_CLOSE_FRAMES / 2); // the hub leaf half shut, the lab leaf open
    expect(t.doors.state('hub/door-lab')).toBe('closing');
    const entry = t.doors.fraction('hub/door-lab');
    expect(entry).toBeCloseTo(0.5, 12);
    expect(t.doors.fraction(LAB_LEAF)).toBe(1);
    const feet: Vec3 = [-0.2, 0, 0.36]; // before the still open half, clear of the hub leaf
    expect(overlapsLeaves(feet, entry, 1)).toBe(false);
    expect(lowestMeeting(feet)).toBeLessThanOrEqual(entry);
    t.player.position = feet;
    let lowest = entry;
    for (let i = 0; i < 300; i++) {
      t.run(1);
      lowest = Math.min(lowest, t.doors.fraction('hub/door-lab'));
    }
    expect(lowest).toBe(entry);
    expect(t.doors.fraction(LAB_LEAF)).toBe(1); // the far leaf never moved
    expect(t.doors.state('hub/door-lab')).toBe('open'); // reopened, and the player is near
    expect(t.states()).toEqual(['opening', 'open', 'closing', 'blocked', 'opening', 'open']);
    expect(t.blocked).toEqual([]); // it closed on its own: no notice
  });

  it('checks only a motion that remains', () => {
    // Held open by a player near a jamb in the tunnel: open again, not blocked for good.
    const t = openLab();
    t.player.position = [0.15, 0, -0.175];
    t.request('hub/door-lab');
    t.run(2);
    expect(t.doors.state('hub/door-lab')).toBe('open');
    // Asked to close before the leaves moved, with the player beside the other jamb: closed.
    const u = setup([LAB], [-0.75, 0, 0.3]);
    u.scenes.resident.add('lab');
    u.request('hub/door-lab');
    u.request('hub/door-lab');
    u.run(1);
    expect(u.doors.state('hub/door-lab')).toBe('closed');
    expect(u.driver.calls).toEqual([]);
  });

  it('waits while the player stands where the leaves slide to', () => {
    const t = setup([LAB], [1, 0, 0.3]); // against the wall beside the doorway
    t.scenes.resident.add('lab');
    t.request('hub/door-lab');
    t.run(30);
    expect(t.doors.state('hub/door-lab')).toBe('blocked');
    expect(t.doors.isOpen('hub/door-lab')).toBe(true);
    expect(t.driver.calls).toEqual([]);
    t.player.position = [1, 0, 1.2];
    t.run(OPEN_FRAMES);
    expect(t.doors.state('hub/door-lab')).toBe('open');
    expect(t.states()).toEqual(['opening', 'blocked', 'opening', 'open']);
    expect(t.blocked).toEqual([]);
  });

  it('never slides a leaf into a player standing around the doorway while closing', () => {
    let closed = 0;
    let held = 0;
    for (const feet of around()) {
      if (overlapsLeaves(feet, 1)) continue; // nobody stands inside an open leaf
      const t = openLab();
      t.player.position = feet;
      t.request('hub/door-lab');
      for (let i = 0; i < 2 * CLOSE_FRAMES; i++) {
        t.run(1);
        const [hub, lab] = [t.doors.fraction(HUB_LEAF), t.doors.fraction(LAB_LEAF)];
        expect(overlapsLeaves(feet, hub, lab)).toBe(false);
      }
      if (t.doors.state('hub/door-lab') === 'closed') closed++;
      else held++;
    }
    expect(closed).toBeGreaterThan(50);
    expect(held).toBeGreaterThan(50);
  });

  it('never slides a leaf into a player standing around the doorway while opening', () => {
    let opened = 0;
    let waited = 0;
    for (const feet of around()) {
      if (overlapsLeaves(feet, 0)) continue; // nobody stands inside a closed leaf
      const t = setup([LAB], feet);
      t.scenes.resident.add('lab');
      t.request('hub/door-lab');
      for (let i = 0; i < 2 * OPEN_FRAMES; i++) {
        t.run(1);
        const [hub, lab] = [t.doors.fraction(HUB_LEAF), t.doors.fraction(LAB_LEAF)];
        expect(overlapsLeaves(feet, hub, lab)).toBe(false);
      }
      if (t.doors.state('hub/door-lab') === 'open') opened++;
      else waited++;
    }
    expect(opened).toBeGreaterThan(50);
    expect(waited).toBeGreaterThan(20);
  });

  it('stays open while a dynamic body is in the closing path, then closes once it is clear', () => {
    const t = openLab();
    t.driver.dynamic = true;
    t.run(HOLD_FRAMES);
    expect(t.doors.state('hub/door-lab')).toBe('open'); // due to close, but not clear: it waits
    expect(t.doors.fraction('hub/door-lab')).toBe(1);
    // It asked about the whole rest of the closing path: both leaves, the tunnel and the margin.
    const asked = t.driver.last!;
    const expected = sweptBox(LAB_WORLD, 1, 0, MARGIN_M, createYawBox());
    for (let i = 0; i < 3; i++) {
      expect(asked.center[i]).toBeCloseTo(expected.center[i]!, 12);
      expect(asked.halfExtents[i]).toBeCloseTo(expected.halfExtents[i]!, 12);
    }
    expect(asked.rotationY).toBe(0);
    t.run(60);
    expect(t.doors.state('hub/door-lab')).toBe('open');
    expect(t.states()).toEqual(['opening', 'open']);
    expect(t.blocked).toEqual([]); // closing on its own: no notice

    t.request('lab/door-hub'); // asked to close: refused with a notice
    t.run(1);
    expect(t.blocked).toEqual([
      {
        entityId: 'lab/door-hub',
        actionId: CLOSE_DOOR_ACTION,
        reason: 'The doorway is not clear.',
      },
    ]);
    // One box, filled in place every time.
    expect(t.driver.arrays.size).toBe(2);

    t.driver.dynamic = false; // the object is taken away: it closes on its own, a hold later
    t.run(1 + HOLD_FRAMES + CLOSE_FRAMES);
    expect(t.doors.state('hub/door-lab')).toBe('closed');
    expect(t.states()).toEqual([
      'opening',
      'open',
      'closing',
      'blocked',
      'open',
      'closing',
      'closed',
    ]);
  });

  it('does not churn while an object holds a procedure pair open: no events, few queries', () => {
    // Hold 0 and the player away: due to close on every frame, yet the doorway is not clear.
    const t = setup([{ ...LAB, procedure: true }], [0, 0, 1]);
    t.scenes.resident.add('lab');
    t.request('hub/door-lab');
    t.run(OPEN_FRAMES);
    t.driver.dynamic = true;
    t.player.position = [0, 0, 3];
    let queries = 0;
    const query = t.driver.dynamicBodyIn.bind(t.driver);
    t.driver.dynamicBodyIn = (center, halfExtents, rotationY) => {
      queries++;
      return query(center, halfExtents, rotationY);
    };
    const changes = t.changes.length;
    let flips = 0;
    let open = t.doors.isOpen('hub/door-lab');
    for (let i = 0; i < 600; i++) {
      t.run(1);
      if (t.doors.isOpen('hub/door-lab') !== open) flips++;
      open = t.doors.isOpen('hub/door-lab');
    }
    expect(t.changes.length - changes).toBe(0); // 600 frames, not one DoorChanged
    expect(flips).toBe(0); // the prompt does not switch between its actions
    expect(t.doors.state('hub/door-lab')).toBe('open');
    expect(queries).toBeLessThanOrEqual(Math.ceil((600 * DT) / RETRY_S) + 1); // 4 a second
    t.driver.dynamic = false;
    t.run(Math.ceil(RETRY_S / DT) + 1);
    expect(t.doors.state('hub/door-lab')).toBe('closing');
  });

  it('opens past a player pressed against the closed leaf by its leading edge', () => {
    // Feet radius + skin in front of the hub leaf's face (z 0.04), 0.2 m from its leading edge.
    for (const x of [0, 0.3, 0.45, 0.5]) {
      const t = setup([LAB], [x, 0, 0.04 + R + 0.01]);
      t.scenes.resident.add('lab');
      t.request('hub/door-lab');
      t.run(OPEN_FRAMES);
      expect(t.doors.state('hub/door-lab'), `x ${x}`).toBe('open');
      expect(t.states(), `x ${x}`).toEqual(['opening', 'open']);
    }
  });

  it('lets a leaf push dynamic bodies out of its pocket while opening', () => {
    const t = setup();
    t.scenes.resident.add('lab');
    t.driver.dynamic = true;
    t.request('hub/door-lab');
    t.run(OPEN_FRAMES);
    expect(t.doors.state('hub/door-lab')).toBe('open');
    expect(t.driver.last).toBeNull();
  });

  it('opens a closing pair again and closes an opening one when asked', () => {
    const t = setup();
    t.scenes.resident.add('lab');
    t.request('hub/door-lab');
    t.run(12);
    t.request('lab/door-hub');
    expect(t.doors.state('hub/door-lab')).toBe('closing');
    t.run(6);
    expect(t.doors.fraction('hub/door-lab')).toBeCloseTo(0.125, 12);
    t.request('hub/door-lab');
    expect(t.doors.state('hub/door-lab')).toBe('opening');
    t.run(42); // the hub leaf back to open; the lab leaf follows after the gap
    expect(t.doors.fraction(HUB_LEAF)).toBe(1);
    expect(t.doors.fraction(LAB_LEAF)).toBe(0);
    expect(t.doors.state('hub/door-lab')).toBe('opening');
    t.run(GAP_FRAMES + LEAF_OPEN_FRAMES);
    expect(t.doors.state('hub/door-lab')).toBe('open');
  });

  it('releases the scene the player left behind, never the current one', () => {
    const t = openLab();
    t.scenes.currentSceneId = 'lab'; // the player walked through
    t.player.position = [0, 0, -3];
    t.run(HOLD_FRAMES + CLOSE_FRAMES);
    expect(t.doors.state('hub/door-lab')).toBe('closed');
    expect(t.scenes.released).toEqual(['hub']);
  });

  it('keeps a scene that another door not yet closed still joins', () => {
    const t = setup([LAB, BIO]);
    t.scenes.resident.add('lab').add('bio');
    t.request('hub/door-lab');
    t.run(OPEN_FRAMES);
    t.request('hub/door-bio');
    t.scenes.currentSceneId = 'lab'; // the player walks into the lab, away from both doors
    t.player.position = [0, 0, -5];
    t.run(HOLD_FRAMES + CLOSE_FRAMES);
    expect(t.doors.state('hub/door-lab')).toBe('closed');
    expect(t.doors.state('hub/door-bio')).toBe('closing');
    expect(t.scenes.released).toEqual([]); // the hub stays behind the bio door
    t.run(CLOSE_FRAMES);
    expect(t.doors.state('hub/door-bio')).toBe('closed');
    expect(t.scenes.released).toEqual(['hub', 'bio']);
  });

  it('runs several pairs at once, each on its own', async () => {
    const t = setup([LAB, BIO]);
    t.scenes.resident.add('lab');
    t.request('hub/door-lab');
    t.request('hub/door-bio');
    t.run(24);
    expect(t.doors.fraction('hub/door-lab')).toBeCloseTo(0.5, 12);
    expect(t.doors.state('hub/door-bio')).toBe('preparing');
    expect(t.doors.fraction('bio/door-hub')).toBe(0);
    t.scenes.answer(null);
    await settle();
    t.run(24);
    // The lab pair's hub leaf is open, its lab leaf waits; the bio pair's hub leaf (the player's
    // side) is half open, its bio leaf shut.
    expect(t.doors.fraction('hub/door-lab')).toBe(1);
    expect(t.doors.fraction('lab/door-hub')).toBe(0);
    expect(t.doors.state('hub/door-lab')).toBe('opening');
    expect(t.doors.fraction('hub/door-bio')).toBeCloseTo(0.5, 12);
    expect(t.doors.fraction('bio/door-hub')).toBe(0);
    t.run(GAP_FRAMES + LEAF_OPEN_FRAMES);
    expect(t.doors.state('hub/door-lab')).toBe('open');
    expect(t.doors.state('hub/door-bio')).toBe('opening');
    expect(t.changes).toEqual([
      ['hub/door-lab', 'lab/door-hub', 'opening'],
      ['hub/door-bio', 'bio/door-hub', 'preparing'],
      ['hub/door-bio', 'bio/door-hub', 'opening'],
      ['hub/door-lab', 'lab/door-hub', 'open'],
    ]);
  });

  it('closes every pair at once on SceneUnloaded and ignores a late attach', async () => {
    const t = setup([LAB, BIO]);
    t.scenes.resident.add('lab');
    t.request('hub/door-lab');
    t.request('hub/door-bio'); // preparing
    t.run(24);
    t.events.publish('SceneUnloaded', { sceneId: 'hub' });
    expect(t.doors.state('hub/door-lab')).toBe('closed');
    expect(t.doors.state('hub/door-bio')).toBe('closed');
    expect(t.doors.fraction('lab/door-hub')).toBe(0);
    expect(t.doors.fraction('hub/door-lab')).toBe(0);
    // Only the leaf that had moved hears it: the lab leaf was still shut.
    expect(t.driver.calls).toHaveLength(24 + 1);
    expect(t.driver.calls.slice(-2)).toEqual([
      ['hub/door-lab', expect.closeTo(0.5, 12)],
      ['hub/door-lab', 0],
    ]);
    expect(t.driver.calls.filter(([id]) => id !== 'hub/door-lab')).toEqual([]);
    expect(t.scenes.released).toEqual([]); // the scene manager tears everything down itself
    const calls = t.driver.calls.length;
    const changes = t.changes.length;

    t.scenes.answer(null); // the attach asked before the reset
    await settle();
    t.run(60);
    expect(t.doors.state('hub/door-bio')).toBe('closed');
    expect(t.driver.calls).toHaveLength(calls);
    expect(t.changes).toHaveLength(changes);

    // Preparing again: only the new attach counts, however late the old one answers.
    t.scenes.resident.delete('bio');
    t.request('hub/door-bio');
    t.request('hub/door-lab');
    t.events.publish('SceneUnloaded', { sceneId: 'hub' });
    t.request('hub/door-bio');
    expect(t.scenes.pending).toHaveLength(2);
    t.scenes.answer('superseded by a load'); // the one from before the reset
    await settle();
    expect(t.doors.state('hub/door-bio')).toBe('preparing');
    expect(t.blocked).toEqual([]);
    t.scenes.answer(null);
    await settle();
    expect(t.doors.state('hub/door-bio')).toBe('opening');
  });

  it('moves nothing and runs no timer while paused (dt 0)', () => {
    const t = setup([{ ...LAB, procedure: true }], [0, 0, 1]);
    t.scenes.resident.add('lab');
    t.request('hub/door-lab');
    t.run(30, 0);
    expect(t.doors.fraction('hub/door-lab')).toBe(0);
    expect(t.driver.calls).toEqual([]);
    t.run(OPEN_FRAMES);
    t.player.position = [0, 0, 3];
    t.run(30, 0); // away after coming near, no hold: it would close on the next real frame
    expect(t.doors.state('hub/door-lab')).toBe('open');
    t.run(1);
    expect(t.doors.state('hub/door-lab')).toBe('closing');
  });

  it('reads the state, fraction and openness of both leaves', () => {
    const t = setup();
    t.scenes.resident.add('lab');
    expect(t.doors.state('hub/door-lab')).toBe('closed');
    expect(t.doors.state('hub/table')).toBeNull();
    expect(t.doors.isOpen('hub/table')).toBe(false);
    expect(t.doors.fraction('hub/table')).toBe(0);
    t.request('lab/door-hub');
    t.run(12);
    for (const id of ['hub/door-lab', 'lab/door-hub']) {
      expect(t.doors.state(id)).toBe('opening');
      expect(t.doors.isOpen(id)).toBe(true);
    }
    // Each leaf its own fraction: the one on the player's side moves first, whichever was asked.
    expect(t.doors.fraction('hub/door-lab')).toBeCloseTo(0.25, 12);
    expect(t.doors.fraction('lab/door-hub')).toBe(0);
    t.run(36);
    expect(t.doors.isOpen('hub/door-lab')).toBe(true);
    t.request('hub/door-lab');
    expect(t.doors.isOpen('hub/door-lab')).toBe(false); // closing: it offers to go through again
  });

  describe('one leaf at a time', () => {
    it.each(SIDES)(
      "opens the leaf on the player's side first (%s side), then after the gap the other",
      (_side, feet, near, far) => {
        const t = setup([LAB], feet);
        t.scenes.resident.add('lab');
        t.request(far); // whichever leaf is asked, the player's side moves first
        const frames = record(t, OPEN_FRAMES);
        expectSlide(frames.slice(0, LEAF_OPEN_FRAMES), near, 0, 1);
        expectGap(frames.slice(LEAF_OPEN_FRAMES, LEAF_OPEN_FRAMES + GAP_FRAMES), 'opening');
        expectSlide(frames.slice(LEAF_OPEN_FRAMES + GAP_FRAMES), far, 0, 1);
        expectStates(frames, 'opening', 'open');
        expect(t.states()).toEqual(['opening', 'open']);
      },
    );

    it.each(SIDES)(
      "closes the leaf on the player's side first (%s side); closed and released once both are shut",
      (_side, feet, near, far) => {
        const t = openLab(feet);
        t.run(HOLD_FRAMES);
        expect(t.doors.state(HUB_LEAF)).toBe('closing');
        const first = record(t, LEAF_CLOSE_FRAMES + GAP_FRAMES);
        expectSlide(first.slice(0, LEAF_CLOSE_FRAMES), near, 1, 0);
        expectGap(first.slice(LEAF_CLOSE_FRAMES), 'closing');
        expect(t.scenes.released).toEqual([]); // one leaf is still open
        const second = record(t, LEAF_CLOSE_FRAMES);
        expectSlide(second, far, 1, 0);
        expectStates([...first, ...second], 'closing', 'closed');
        expect(t.scenes.released).toEqual(['lab']); // the player is in the hub
        expect(t.states()).toEqual(['opening', 'open', 'closing', 'closed']);
      },
    );

    /** Every frame: at most one leaf between its ends and one driver call, of a leaf that changed. */
    function expectOneAtATime(
      t: ReturnType<typeof setup>,
      count: number,
      before = (_i: number) => {},
    ) {
      const f = new Map([HUB_LEAF, LAB_LEAF].map((id) => [id, t.doors.fraction(id)]));
      for (let i = 0; i < count; i++) {
        before(i);
        const frame = record(t, 1)[0]!;
        expect(frame.calls.length, `frame ${i}`).toBeLessThanOrEqual(1);
        const moving = [HUB_LEAF, LAB_LEAF].filter((id) => {
          const now = t.doors.fraction(id);
          return now > 0 && now < 1;
        });
        expect(moving.length, `frame ${i}`).toBeLessThanOrEqual(1);
        for (const [id, value] of frame.calls) {
          expect(value).not.toBe(f.get(id)); // only a change is told
          expect(value).toBe(t.doors.fraction(id));
        }
        for (const id of f.keys()) f.set(id, t.doors.fraction(id));
      }
    }

    it('never moves both leaves: a whole cycle and a burst of requests', () => {
      const t = setup();
      t.scenes.resident.add('lab');
      t.request(HUB_LEAF);
      expectOneAtATime(t, OPEN_FRAMES + HOLD_FRAMES + CLOSE_FRAMES);
      expect(t.doors.state(HUB_LEAF)).toBe('closed');
      expect(t.driver.calls).toHaveLength(2 * (LEAF_OPEN_FRAMES + LEAF_CLOSE_FRAMES));

      // Requests from either leaf at uneven times (in a leaf, in a gap, while open or shut), the
      // player now on one side of the wall, now on the other.
      const u = setup();
      u.scenes.resident.add('lab');
      const sides: Vec3[] = [
        [0, 0, 3],
        [0, 0, -3],
      ];
      expectOneAtATime(u, 1200, (i) => {
        if (i % 200 === 0) u.player.position = sides[(i / 200) % 2]!;
        if (i % 17 === 0 || i % 29 === 0 || [50, 51, 55, 110, 113].includes(i)) {
          u.scenes.resident.add('lab'); // back at once once released
          u.request(i % 2 === 0 ? HUB_LEAF : LAB_LEAF);
        }
      });
      const states = new Set(u.states());
      for (const state of ['opening', 'closing', 'closed'] as const)
        expect(states).toContain(state);
      const ids = new Set(u.driver.calls.map(([id]) => id));
      expect([...ids].sort()).toEqual([HUB_LEAF, LAB_LEAF]);
    });

    it('reverses the first leaf when asked to close during it: the other never moves', () => {
      const t = setup();
      t.scenes.resident.add('lab');
      t.request(HUB_LEAF);
      t.run(12);
      t.request(HUB_LEAF);
      const frames = record(t, 12);
      expectSlide(frames, HUB_LEAF, 0.25, 0);
      expectStates(frames, 'closing', 'closed');
      expect(t.driver.calls.filter(([id]) => id === LAB_LEAF)).toEqual([]);
      expect(t.states()).toEqual(['opening', 'closing', 'closed']);
      expect(t.scenes.released).toEqual(['lab']);
    });

    it('closes the first leaf at once when asked during the gap', () => {
      const t = setup();
      t.scenes.resident.add('lab');
      t.request(HUB_LEAF);
      t.run(LEAF_OPEN_FRAMES + GAP_FRAMES / 2);
      expect([t.doors.fraction(HUB_LEAF), t.doors.fraction(LAB_LEAF)]).toEqual([1, 0]);
      t.request(LAB_LEAF);
      const frames = record(t, LEAF_CLOSE_FRAMES);
      expectSlide(frames, HUB_LEAF, 1, 0); // from the very next frame: no gap
      expectStates(frames, 'closing', 'closed');
      expect(t.driver.calls.filter(([id]) => id === LAB_LEAF)).toEqual([]);
    });

    it('reverses the second leaf when asked during it, then the gap, then the first', () => {
      const t = setup();
      t.scenes.resident.add('lab');
      t.request(HUB_LEAF);
      t.run(LEAF_OPEN_FRAMES + GAP_FRAMES + 12);
      expect(t.doors.fraction(LAB_LEAF)).toBeCloseTo(0.25, 12);
      t.request(HUB_LEAF);
      const frames = record(t, 12 + GAP_FRAMES + LEAF_CLOSE_FRAMES);
      expectSlide(frames.slice(0, 12), LAB_LEAF, 0.25, 0);
      expectGap(frames.slice(12, 12 + GAP_FRAMES), 'closing');
      expectSlide(frames.slice(12 + GAP_FRAMES), HUB_LEAF, 1, 0);
      expectStates(frames, 'closing', 'closed');
    });

    it('opens a closing pair again with the leaf in mid-travel first', () => {
      // The first leaf half shut: it opens again, and that is all.
      const t = openLab();
      t.run(HOLD_FRAMES + LEAF_CLOSE_FRAMES / 2);
      t.request(HUB_LEAF);
      const frames = record(t, LEAF_CLOSE_FRAMES / 2);
      expectSlide(frames, HUB_LEAF, 0.5, 1);
      expectStates(frames, 'opening', 'open');
      // Since it stood open: the hub leaf half shut and back, the lab leaf never.
      const since = t.driver.calls.slice(2 * LEAF_OPEN_FRAMES);
      expect(since).toHaveLength(LEAF_CLOSE_FRAMES);
      expect(since.filter(([id]) => id !== HUB_LEAF)).toEqual([]);

      // The second leaf (the lab's) a quarter shut: it opens first, though the player is in the hub.
      const u = openLab();
      u.run(HOLD_FRAMES + LEAF_CLOSE_FRAMES + GAP_FRAMES + 12);
      expect(u.doors.fraction(HUB_LEAF)).toBe(0);
      expect(u.doors.fraction(LAB_LEAF)).toBeCloseTo(0.75, 12);
      u.request(LAB_LEAF);
      const again = record(u, 12 + GAP_FRAMES + LEAF_OPEN_FRAMES);
      expectSlide(again.slice(0, 12), LAB_LEAF, 0.75, 1);
      expectGap(again.slice(12, 12 + GAP_FRAMES), 'opening');
      expectSlide(again.slice(12 + GAP_FRAMES), HUB_LEAF, 0, 1);
      expectStates(again, 'opening', 'open');

      // Asked in the closing gap: the leaf just shut opens again at once.
      const v = openLab();
      v.run(HOLD_FRAMES + LEAF_CLOSE_FRAMES + GAP_FRAMES / 2);
      expect([v.doors.fraction(HUB_LEAF), v.doors.fraction(LAB_LEAF)]).toEqual([0, 1]);
      v.request(HUB_LEAF);
      const reopened = record(v, LEAF_OPEN_FRAMES);
      expectSlide(reopened, HUB_LEAF, 0, 1);
      expectStates(reopened, 'opening', 'open');
    });

    it("waits for a player in the second leaf's closing path, opens again, and closes once clear", () => {
      const t = openLab();
      t.run(HOLD_FRAMES + LEAF_CLOSE_FRAMES + GAP_FRAMES / 2); // the hub leaf shut, in the gap
      const feet: Vec3 = [0, 0, -0.6]; // on the lab side, before the doorway
      expect(overlapsLeaves(feet, 0, 1)).toBe(false);
      expect(lowestMeeting(feet)).toBeLessThan(1); // in what the lab leaf still sweeps
      t.player.position = feet;
      const gap = record(t, GAP_FRAMES / 2);
      for (const frame of gap) expect(frame).toEqual({ calls: [], state: 'closing' });
      const [blocked] = record(t, 1);
      expect(blocked).toEqual({ calls: [], state: 'blocked' }); // the lab leaf never moved
      // Opens again: the hub leaf, the one not open (the pocket beside it is clear of the player).
      const reopened = record(t, LEAF_OPEN_FRAMES);
      expectSlide(reopened, HUB_LEAF, 0, 1);
      expectStates(reopened, 'opening', 'open');
      expect(t.doors.fraction(LAB_LEAF)).toBe(1);

      t.player.position = [0, 0, -3]; // walks off into the lab: it closes, the lab leaf first
      t.run(HOLD_FRAMES);
      const closing = record(t, CLOSE_FRAMES);
      expectSlide(closing.slice(0, LEAF_CLOSE_FRAMES), LAB_LEAF, 1, 0);
      expectGap(closing.slice(LEAF_CLOSE_FRAMES, LEAF_CLOSE_FRAMES + GAP_FRAMES), 'closing');
      expectSlide(closing.slice(LEAF_CLOSE_FRAMES + GAP_FRAMES), HUB_LEAF, 1, 0);
      expectStates(closing, 'closing', 'closed');
      expect(t.states()).toEqual([
        'opening',
        'open',
        'closing',
        'blocked',
        'opening',
        'open',
        'closing',
        'closed',
      ]);
      expect(t.blocked).toEqual([]); // it closed on its own: no notice
    });

    it('waits for a dynamic body in the doorway while the second leaf closes', () => {
      const t = openLab();
      t.run(HOLD_FRAMES + LEAF_CLOSE_FRAMES + GAP_FRAMES + 12);
      const at = t.doors.fraction(LAB_LEAF);
      expect(at).toBeCloseTo(0.75, 12);
      t.driver.dynamic = true;
      const [blocked] = record(t, 1);
      expect(blocked).toEqual({ calls: [], state: 'blocked' });
      // It asked about the rest of the pair's closing path from the moving leaf's fraction.
      const asked = t.driver.last!;
      const expected = sweptBox(LAB_WORLD, at, 0, MARGIN_M, createYawBox());
      for (let i = 0; i < 3; i++) {
        expect(asked.center[i]).toBeCloseTo(expected.center[i]!, 12);
        expect(asked.halfExtents[i]).toBeCloseTo(expected.halfExtents[i]!, 12);
      }
      // Opens again, the leaf in mid-travel first (a leaf pushes bodies while opening).
      const frames = record(t, 12 + GAP_FRAMES + LEAF_OPEN_FRAMES);
      expectSlide(frames.slice(0, 12), LAB_LEAF, at, 1);
      expectGap(frames.slice(12, 12 + GAP_FRAMES), 'opening');
      expectSlide(frames.slice(12 + GAP_FRAMES), HUB_LEAF, 0, 1);
      expectStates(frames, 'opening', 'open');
      expect(t.blocked).toEqual([]);
    });

    it("finishes a sequence the player left, then closes from the player's new side", () => {
      const t = setup();
      t.scenes.resident.add('lab');
      t.request(HUB_LEAF);
      t.run(LEAF_OPEN_FRAMES / 2);
      t.player.position = [0, 0, -3]; // now on the lab side
      t.scenes.currentSceneId = 'lab';
      const opening = record(t, OPEN_FRAMES - LEAF_OPEN_FRAMES / 2);
      expectSlide(opening.slice(0, LEAF_OPEN_FRAMES / 2), HUB_LEAF, 0.5, 1); // it finishes first
      expectGap(opening.slice(LEAF_OPEN_FRAMES / 2, LEAF_OPEN_FRAMES / 2 + GAP_FRAMES), 'opening');
      expectSlide(opening.slice(LEAF_OPEN_FRAMES / 2 + GAP_FRAMES), LAB_LEAF, 0, 1);
      expectStates(opening, 'opening', 'open');
      t.run(HOLD_FRAMES);
      const closing = record(t, CLOSE_FRAMES);
      expectSlide(closing.slice(0, LEAF_CLOSE_FRAMES), LAB_LEAF, 1, 0);
      expectGap(closing.slice(LEAF_CLOSE_FRAMES, LEAF_CLOSE_FRAMES + GAP_FRAMES), 'closing');
      expectSlide(closing.slice(LEAF_CLOSE_FRAMES + GAP_FRAMES), HUB_LEAF, 1, 0);
      expectStates(closing, 'closing', 'closed');
      expect(t.scenes.released).toEqual(['hub']);
    });

    it('shuts both leaves on SceneUnloaded in the gap, and opens afresh after', () => {
      const t = setup();
      t.scenes.resident.add('lab');
      t.request(HUB_LEAF);
      t.run(LEAF_OPEN_FRAMES + GAP_FRAMES / 2);
      t.events.publish('SceneUnloaded', { sceneId: 'hub' });
      for (const id of [HUB_LEAF, LAB_LEAF]) {
        expect(t.doors.state(id)).toBe('closed');
        expect(t.doors.fraction(id)).toBe(0);
      }
      expect(t.driver.calls.at(-1)).toEqual([HUB_LEAF, 0]);
      expect(t.driver.calls.filter(([id]) => id === LAB_LEAF)).toEqual([]);
      expect(t.states()).toEqual(['opening', 'closed']);
      expect(t.scenes.released).toEqual([]);

      t.request(HUB_LEAF); // the lab is still resident: no gap left over
      const frames = record(t, OPEN_FRAMES);
      expectSlide(frames.slice(0, LEAF_OPEN_FRAMES), HUB_LEAF, 0, 1);
      expectGap(frames.slice(LEAF_OPEN_FRAMES, LEAF_OPEN_FRAMES + GAP_FRAMES), 'opening');
      expectSlide(frames.slice(LEAF_OPEN_FRAMES + GAP_FRAMES), LAB_LEAF, 0, 1);
      expectStates(frames, 'opening', 'open');
    });

    it('runs no gap while paused (dt 0)', () => {
      const t = setup();
      t.scenes.resident.add('lab');
      t.request(HUB_LEAF);
      t.run(LEAF_OPEN_FRAMES);
      const before = record(t, GAP_FRAMES / 2); // half the gap
      const calls = t.driver.calls.length;
      t.run(120, 0);
      expect(t.driver.calls).toHaveLength(calls);
      expect(t.doors.state(HUB_LEAF)).toBe('opening');
      expect([t.doors.fraction(HUB_LEAF), t.doors.fraction(LAB_LEAF)]).toEqual([1, 0]);
      // The other half is still to come: the lab leaf starts after it, not before.
      expectGap([...before, ...record(t, GAP_FRAMES / 2)], 'opening');
      expect(record(t, 1)[0]!.calls).toEqual([[LAB_LEAF, expect.closeTo(1 / 48, 12)]]);
    });

    it("reads each leaf's own fraction and one state for the pair", () => {
      const t = setup();
      t.scenes.resident.add('lab');
      t.request(LAB_LEAF);
      const last = new Map<string, number>();
      for (let i = 0; i < OPEN_FRAMES + HOLD_FRAMES + CLOSE_FRAMES; i++) {
        const [frame] = record(t, 1);
        for (const [id, f] of frame!.calls) last.set(id, f);
        expect(t.doors.state(LAB_LEAF), `frame ${i}`).toBe(t.doors.state(HUB_LEAF));
        expect(t.doors.isOpen(LAB_LEAF), `frame ${i}`).toBe(t.doors.isOpen(HUB_LEAF));
        for (const id of [HUB_LEAF, LAB_LEAF]) {
          expect(t.doors.fraction(id), `frame ${i}`).toBe(last.get(id) ?? 0);
        }
        if (i === LEAF_OPEN_FRAMES + GAP_FRAMES + LEAF_OPEN_FRAMES / 2 - 1) {
          expect(t.doors.fraction(HUB_LEAF)).toBe(1);
          expect(t.doors.fraction(LAB_LEAF)).toBeCloseTo(0.5, 12);
        }
      }
      expect(t.doors.state(HUB_LEAF)).toBe('closed');
    });
  });

  it('ignores a request for anything that is not a walk-through door', () => {
    const t = setup();
    t.request('hub/table');
    expect(t.changes).toEqual([]);
    expect(t.logs).toContain('"hub/table" is not a walk-through door');
  });

  it('refuses a leaf in two pairs', () => {
    expect(() => setup([LAB, { ...BIO, leaves: [LAB.leaves[0], BIO.leaves[1]] }])).toThrow(
      'Door leaf "hub/door-lab" belongs to two pairs',
    );
  });

  it('releases its listeners on dispose and then ignores a late attach', async () => {
    const t = setup();
    t.request('hub/door-lab');
    t.doors.dispose();
    expect(t.events.listenerCount('DoorRequested')).toBe(0);
    expect(t.events.listenerCount('SceneUnloaded')).toBe(0);
    t.scenes.answer(null);
    await settle();
    t.run(10);
    expect(t.doors.state('hub/door-lab')).toBe('preparing');
    expect(t.driver.calls).toEqual([]);
  });

  it('opens the far leaf past a player standing in the tunnel, even towards its pocket', () => {
    // Found in review (UX3.1): the far leaf slides along its own face into its own pocket, so a
    // player in the tunnel in front of it is never in its way — it must not wait for them.
    const t = setup([LAB], [0, 0, 3]);
    t.scenes.resident.add('lab');
    t.request('hub/door-lab');
    t.run(LEAF_OPEN_FRAMES); // the hub leaf open
    t.player.position = [0.12, 0, -0.175]; // in the tunnel, off centre towards the pocket (+x)
    t.run(GAP_FRAMES + LEAF_OPEN_FRAMES);
    expect(t.doors.fraction('lab/door-hub')).toBe(1);
    expect(t.doors.state('hub/door-lab')).toBe('open');
    expect(t.states()).not.toContain('blocked');
  });

  describe('attaching ahead (prepareAhead; Phú 2026-11-09: a lab door stalled as it opened)', () => {
    it('attaches the scene behind a closed pair as the player walks up; a request opens it at once', async () => {
      const t = setup([LAB], [0, 0, PREPARE_M + 3], true);
      t.run(Math.ceil(ARM_S / DT) + 1);
      expect(t.scenes.pending).toEqual([]); // too far yet
      t.player.position = [0, 0, PREPARE_M - 0.5];
      t.run(5);
      expect(t.scenes.pending.map((p) => p.sceneId)).toEqual(['lab']); // one attach, not one a frame
      t.scenes.answer(null);
      await settle();
      expect(t.doors.state(HUB_LEAF)).toBe('closed'); // resident behind it, still shut
      t.request(HUB_LEAF);
      expect(t.doors.state(HUB_LEAF)).toBe('opening'); // no preparing
      expect(t.scenes.pending).toEqual([]);
    });

    /** From beyond PREPARE_M to 3 m from the pair: the scene behind is being attached ahead. */
    function walkUp(t: ReturnType<typeof setup>) {
      t.run(Math.ceil(ARM_S / DT) + 1);
      t.player.position = [0, 0, 3];
      t.run(1);
      expect(t.scenes.pending.map((p) => p.sceneId)).toEqual(['lab']);
    }

    it('not when the player starts beside it: the scene behind waits for a request', () => {
      const t = setup([LAB], [0, 0, 3], true);
      t.run(10);
      expect(t.scenes.pending).toEqual([]);
      t.request(HUB_LEAF);
      expect(t.doors.state(HUB_LEAF)).toBe('preparing');
    });

    it('not while the player walks up with their back to it (backing across a small room)', () => {
      const t = setup([LAB], [0, 0, PREPARE_M + 3], true);
      t.player.yaw = Math.PI; // facing +z, away from the pair at the origin
      t.run(Math.ceil(ARM_S / DT) + 1);
      t.player.position = [0, 0, 3];
      t.run(5);
      expect(t.scenes.pending).toEqual([]);
      t.player.yaw = 0.3; // turned to it
      t.run(1);
      expect(t.scenes.pending.map((p) => p.sceneId)).toEqual(['lab']);
    });

    it('not for a step or two at the edge of PREPARE_M: only once the player comes APPROACH_M closer', () => {
      const t = setup([LAB], [0, 0, PREPARE_M + 0.2], true);
      t.run(Math.ceil(ARM_S / DT) + 1);
      t.player.position = [0, 0, PREPARE_M + 0.2 - APPROACH_M + 0.1];
      t.run(10);
      expect(t.scenes.pending).toEqual([]);
      t.player.position = [0, 0, PREPARE_M + 0.2 - APPROACH_M - 0.1];
      t.run(1);
      expect(t.scenes.pending.map((p) => p.sceneId)).toEqual(['lab']);
    });

    it('a request while it is being attached ahead waits for that same attach', async () => {
      const t = setup([LAB], [0, 0, PREPARE_M + 3], true);
      walkUp(t);
      t.request(HUB_LEAF);
      expect(t.doors.state(HUB_LEAF)).toBe('preparing');
      expect(t.scenes.pending).toHaveLength(1);
      t.scenes.answer(null);
      await settle();
      expect(t.doors.state(HUB_LEAF)).toBe('opening');
    });

    it('stays while the player is near, goes beyond RELEASE_M; a failed attach is tried again later', async () => {
      const t = setup([LAB], [0, 0, PREPARE_M + 3], true);
      walkUp(t);
      t.scenes.answer(null);
      await settle();
      t.player.position = [0, 0, RELEASE_M - 1];
      t.run(5);
      expect(t.scenes.released).toEqual([]);
      t.player.position = [0, 0, RELEASE_M + 1];
      t.run(1);
      expect(t.scenes.released).toEqual(['lab']);
      // Back near it while a load is under way: refused, tried again PREPARE_RETRY_S later.
      t.player.position = [0, 0, 3];
      t.run(1);
      t.scenes.answer('Another scene is loading.');
      await settle();
      t.run(Math.round((PREPARE_RETRY_S - 0.2) / DT));
      expect(t.scenes.pending).toEqual([]);
      t.run(Math.round(0.4 / DT));
      expect(t.scenes.pending.map((p) => p.sceneId)).toEqual(['lab']);
    });

    it('a pair that opened releases the scene behind as it closes, attached again only after being away', async () => {
      const t = setup([LAB], [0, 0, PREPARE_M + 3], true);
      walkUp(t);
      t.scenes.answer(null);
      await settle();
      t.request(HUB_LEAF);
      t.run(OPEN_FRAMES + HOLD_FRAMES + CLOSE_FRAMES + 10);
      expect(t.doors.state(HUB_LEAF)).toBe('closed');
      expect(t.scenes.released).toEqual(['lab']); // as without attaching ahead
      t.run(10);
      expect(t.scenes.pending).toEqual([]); // 3 m away, not attached again at once
      t.player.position = [0, 0, PREPARE_M + 1];
      walkUp(t);
    });
  });
});
