import { describe, expect, it } from 'vitest';
import { EventBus } from '../../core/EventBus';
import { Logger } from '../../core/Logger';
import type { Quat, Vec3 } from '../../core/math';
import type { GameEvents } from '../../game/GameEvents';
import { createGameState } from '../../game/GameState';
import { type ContainerState, containerOf, totalUl, transfer } from '../../simulation/liquid';
import type { World, WorldEntity } from '../../world/World';
import type { RayHit } from '../interaction/hold';
import type { ContainerDefinition, ItemDefinition } from '../item';
import { InputState } from '../player/InputState';
import { type LiquidRules, LiquidSystem } from './LiquidSystem';
import { pointOf } from './pour';

// LiquidSystem alone, with fakes: the held pose is set by the test (as physics writes it back),
// the ray hits what the test says, and the rules keep real integer contents (as StationSystem).

const DEG = Math.PI / 180;
const H = 1 / 60;
const aboutX = (angle: number): Quat => [Math.sin(angle / 2), 0, 0, Math.cos(angle / 2)];

const entity = (id: string, container: Partial<ContainerDefinition>, at: Vec3): WorldEntity => ({
  id,
  roomId: 'lab',
  params: {},
  pose: { position: [...at], rotation: [0, 0, 0, 1] },
  item: { id, container: { capacityMl: 500, closable: false, ...container } } as ItemDefinition,
});

function setup(trigger: 'squeeze' | 'tilt' = 'squeeze') {
  const log = Logger.create('error', () => {});
  const events = new EventBus<GameEvents>(log);
  const state = createGameState();
  state.session.phase = 'playing';
  const input = new InputState();
  const source = entity(
    'lab/source',
    {
      pour: { spout: [0, 0.1, 0], trigger, minTiltDeg: 70, fullTiltDeg: 115, rateMlPerS: 8 },
    },
    [0, 1.2, 0],
  );
  const flask = entity(
    'lab/flask',
    { fillLimitMl: 50, mouth: { center: [0, 0.07, 0], radius: 0.006, captureRadius: 0.02 } },
    [0, 0.97, 0],
  );
  const entities = new Map([source, flask].map((e) => [e.id, e]));
  const world = { entity: (id: string) => entities.get(id) } as unknown as World;
  const hit: RayHit = { distance: 0.1, entityId: flask.id, normal: [0, 1, 0] };
  let rayTarget: string | null = flask.id;
  const lineOfSight = {
    rays: 0,
    castRay(): RayHit | null {
      this.rays++;
      hit.entityId = rayTarget;
      return rayTarget ? hit : null;
    },
  };
  const containers = new Map<string, ContainerState>([
    [source.id, containerOf('water', 500_000)],
    [flask.id, containerOf('stock-20', 5000)],
  ]);
  const calls = { transfers: [] as number[], asked: 0, inverted: 0 };
  const flags = { refusal: null as string | null, invertRefusal: null as string | null };
  const rules: LiquidRules = {
    container: (id: string) => containers.get(id) ?? null,
    pourRefusal(): string | null {
      calls.asked++;
      const d = containers.get(flask.id);
      if (d && totalUl(d.contents) >= 50_000) return 'It is full to the mark.';
      return flags.refusal;
    },
    transfer(from: string, to: string, want: number) {
      const s = containers.get(from);
      const d = containers.get(to);
      if (!s || !d || flags.refusal) return 0;
      const moved = transfer(s.contents, d.contents, want, 50_000);
      calls.transfers.push(moved);
      return moved;
    },
    invert(): string | null {
      calls.inverted++;
      return flags.invertRefusal;
    },
  };
  let tiltFn: ((held: WorldEntity) => number) | null = null;
  const hands = {
    heldEntity: source as WorldEntity | null,
    setPourTilt(fn: (held: WorldEntity) => number) {
      tiltFn = fn;
      return () => (tiltFn = null);
    },
  };
  let steps = 1;
  const liquids = new LiquidSystem({
    state,
    input,
    events,
    world,
    lineOfSight,
    rules,
    hands,
    steps: () => steps,
    fixedStep: H,
  });
  liquids.init();
  const blocked: GameEvents['ActionBlocked'][] = [];
  const poured: GameEvents['LiquidPoured'][] = [];
  events.subscribe('ActionBlocked', (e) => blocked.push(e));
  events.subscribe('LiquidPoured', (e) => poured.push(e));
  const ul = (id: string) => totalUl(containers.get(id)?.contents ?? {});
  return {
    liquids,
    input,
    state,
    source,
    flask,
    rules,
    flags,
    hands,
    calls,
    blocked,
    poured,
    lineOfSight,
    ul,
    containers,
    tilt: () => tiltFn,
    setSteps: (n: number) => (steps = n),
    aim: (id: string | null) => (rayTarget = id),
  };
}

describe('LiquidSystem: pour detection', () => {
  it('pours a squeezed source into the receiver under its spout, exactly, every step', () => {
    const t = setup();
    t.input.press('pour');
    for (let i = 0; i < 120; i++) {
      const [s, d] = [t.ul(t.source.id), t.ul(t.flask.id)];
      t.liquids.update();
      const moved = t.calls.transfers.at(-1) ?? 0;
      expect(t.ul(t.source.id)).toBe(s - moved);
      expect(t.ul(t.flask.id)).toBe(d + moved);
    }
    const total = t.calls.transfers.reduce((a, b) => a + b, 0);
    expect(Math.abs(total - 8 * 2 * 1000)).toBeLessThanOrEqual(1); // 8 mL/s for 2 s
    expect(t.ul(t.source.id) + t.ul(t.flask.id)).toBe(505_000);
    expect(t.liquids.pouringFrom).toBe(t.source.id);
    expect(t.liquids.pouringInto).toBe(t.flask.id);
    expect(t.calls.asked).toBe(1); // asked once for the pair, not each step
    expect(t.poured).toEqual([]); // nothing per step
    t.input.release('pour');
    t.liquids.update();
    expect(t.poured).toEqual([{ from: t.source.id, to: t.flask.id, volumeUl: total }]);
    expect(t.liquids.pouringFrom).toBeNull();
  });

  it('advances by exactly the fixed steps physics ran, so the frame rate changes nothing', () => {
    const totals: number[] = [];
    for (const grouping of [[1], [2], [6, 0, 3, 1, 2], [0, 5]]) {
      const t = setup();
      t.input.press('pour');
      let steps = 0;
      for (let i = 0; steps < 120; i++) {
        const n = Math.min(grouping[i % grouping.length] ?? 1, 120 - steps);
        t.setSteps(n);
        t.liquids.update();
        steps += n;
      }
      totals.push(t.ul(t.flask.id));
    }
    expect(new Set(totals).size).toBe(1);
  });

  it('moves nothing and says nothing over no receiver, or a spout outside the capture radius', () => {
    const t = setup();
    t.input.press('pour');
    t.aim(null); // over the bench
    for (let i = 0; i < 30; i++) t.liquids.update();
    t.aim(t.flask.id);
    t.flask.pose.position[0] = 0.021; // 2.1 cm off: outside the 2 cm capture radius
    for (let i = 0; i < 30; i++) t.liquids.update();
    expect(t.calls.transfers).toEqual([]);
    expect(t.calls.asked).toBe(0);
    expect(t.blocked).toEqual([]);
    expect(t.poured).toEqual([]);
    t.flask.pose.position[0] = 0.019;
    t.liquids.update();
    expect(t.calls.transfers.length).toBe(1);
  });

  it('says a refusal once for the pair and moves nothing until the pair changes', () => {
    const t = setup();
    t.flags.refusal = 'That is not part of this experiment.';
    t.input.press('pour');
    for (let i = 0; i < 60; i++) t.liquids.update();
    expect(t.blocked).toEqual([
      { entityId: t.flask.id, actionId: 'pour', reason: 'That is not part of this experiment.' },
    ]);
    expect(t.calls.transfers).toEqual([]);
    expect(t.ul(t.flask.id)).toBe(5000);
    expect(t.liquids.pouringFrom).toBeNull();
    expect(t.liquids.pouringOver).toBe(t.flask.id); // over a vessel: no "hold it over" hint
    t.input.release('pour'); // the pair breaks
    t.liquids.update();
    t.flags.refusal = null;
    t.input.press('pour');
    t.liquids.update();
    expect(t.ul(t.flask.id)).toBeGreaterThan(5000);
    expect(t.blocked.length).toBe(1);
  });

  it('stops at the mark exactly and says why once', () => {
    const t = setup();
    t.input.press('pour');
    for (let i = 0; i < 60 * 8; i++) t.liquids.update(); // 8 mL/s for 8 s: far past 45 mL
    expect(t.ul(t.flask.id)).toBe(50_000);
    expect(t.ul(t.source.id)).toBe(455_000);
    expect(t.blocked.map((b) => b.reason)).toEqual(['It is full to the mark.']);
  });

  it('tips a tilt source: nothing below its least tilt, the rate from the pose physics wrote', () => {
    const t = setup('tilt');
    t.input.press('pour'); // ignored by a tilt source: its pose decides
    t.source.pose.rotation.splice(0, 4, ...aboutX(60 * DEG));
    for (let i = 0; i < 30; i++) t.liquids.update();
    expect(t.calls.transfers).toEqual([]);
    expect(t.lineOfSight.rays).toBe(0); // no ray while it does not pour
    t.source.pose.rotation.splice(0, 4, ...aboutX(115 * DEG));
    t.liquids.update();
    expect(t.calls.transfers).toEqual([]); // the spout turned with it: no longer over the mouth
    const spout = pointOf(t.source.pose.position, t.source.pose.rotation, [0, 0.1, 0], [0, 0, 0]);
    t.flask.pose.position[2] = spout[2];
    for (let i = 0; i < 60; i++) t.liquids.update();
    expect(Math.abs(t.ul(t.flask.id) - 5000 - 8000)).toBeLessThanOrEqual(1);
  });

  it('pours nothing from an empty or closed source, nor while not playing', () => {
    const t = setup();
    t.input.press('pour');
    t.state.session.phase = 'menu';
    t.liquids.update();
    t.state.session.phase = 'playing';
    t.containers.get(t.source.id)!.closed = true;
    t.liquids.update();
    t.containers.get(t.source.id)!.closed = false;
    t.containers.get(t.source.id)!.contents = {};
    t.liquids.update();
    expect(t.calls.transfers).toEqual([]);
  });
});

describe('LiquidSystem: held tilt and inversion', () => {
  it('asks to tilt a closed vessel towards 165°, a tipping one to its full tilt, a squeezed one not', () => {
    const t = setup('tilt');
    const tilt = t.tilt();
    expect(tilt?.(t.source)).toBeCloseTo(115 * DEG, 12);
    t.containers.get(t.source.id)!.closed = true;
    expect(tilt?.(t.source)).toBeCloseTo(165 * DEG, 12);
    expect(setup('squeeze').tilt()?.(t.flask)).toBe(0);
    t.liquids.dispose();
    expect(t.tilt()).toBeNull();
  });

  it('counts one inversion when a closed vessel passes 150° and comes back below 30°', () => {
    const t = setup('tilt');
    t.containers.get(t.source.id)!.closed = true;
    for (const deg of [0, 60, 120, 149, 100, 20]) {
      t.source.pose.rotation.splice(0, 4, ...aboutX(deg * DEG));
      t.liquids.update();
    }
    expect(t.calls.inverted).toBe(0); // never past 150°
    for (const deg of [140, 155, 165, 90, 31]) {
      t.source.pose.rotation.splice(0, 4, ...aboutX(deg * DEG));
      t.liquids.update();
    }
    expect(t.calls.inverted).toBe(0); // not back upright yet
    t.source.pose.rotation.splice(0, 4, ...aboutX(10 * DEG));
    t.liquids.update();
    t.liquids.update();
    expect(t.calls.inverted).toBe(1);
    expect(t.calls.transfers).toEqual([]); // closed: nothing flows
    t.flags.invertRefusal = 'Fill to the mark first.';
    for (const deg of [160, 5]) {
      t.source.pose.rotation.splice(0, 4, ...aboutX(deg * DEG));
      t.liquids.update();
    }
    expect(t.blocked).toEqual([
      { entityId: t.source.id, actionId: 'invert', reason: 'Fill to the mark first.' },
    ]);
  });
});
