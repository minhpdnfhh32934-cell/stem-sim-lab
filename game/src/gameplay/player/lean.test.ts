import { describe, expect, it } from 'vitest';
import { EventBus } from '../../core/EventBus';
import { Logger } from '../../core/Logger';
import { GameConfigSchema } from '../../core/config';
import type { Vec3 } from '../../core/math';
import type { GameEvents } from '../../game/GameEvents';
import { createGameState } from '../../game/GameState';
import type { World } from '../../world/World';
import {
  HOLD_PITCH_LIMIT,
  holdReach,
  type LineOfSight,
  type RayHit,
  STOOP,
} from '../interaction/hold';
import { InputState } from './InputState';
import {
  easeLean,
  eyeOf,
  HEAD_CLEAR,
  HELD_CLEAR,
  LEAN_EASE_S,
  LEAN_IN,
  leanTarget,
  POUR_LEAN,
  pourLean,
} from './lean';
import { PlayerSystem } from './PlayerSystem';

const HOLD = 0.45; // config player.holdDistance

describe('the hold within reach (holdReach)', () => {
  it('is the hold distance looking ahead, further looking down, nearer looking up', () => {
    expect(holdReach(0, HOLD)).toBeCloseTo(HOLD, 9);
    expect(holdReach(-HOLD_PITCH_LIMIT, HOLD)).toBeCloseTo(HOLD + 0.1 + STOOP, 9);
    expect(holdReach(-1.4, HOLD)).toBeCloseTo(HOLD + 0.1 + STOOP, 9); // past the hold's limit: as at it
    expect(holdReach(HOLD_PITCH_LIMIT, HOLD)).toBeCloseTo(HOLD - 0.1, 9);
    let last = Infinity;
    for (let p = -HOLD_PITCH_LIMIT; p <= HOLD_PITCH_LIMIT; p += 0.01) {
      const d = holdReach(p, HOLD);
      expect(d).toBeLessThanOrEqual(last + 1e-12); // nearer as the view comes up
      last = d;
    }
  });
});

describe('leaning in (lean.ts)', () => {
  it('leans in to work, stoops to what it holds low, never too close to it', () => {
    expect(leanTarget(0, HOLD, { working: false, holding: false })).toBe(0);
    expect(leanTarget(-0.5, HOLD, { working: true, holding: false })).toBe(LEAN_IN);
    // Holding it ahead: the eye stops HELD_CLEAR short of it.
    expect(leanTarget(0, HOLD, { working: true, holding: true })).toBeCloseTo(HOLD - HELD_CLEAR, 9);
    // Holding it low: the stoop, working or not.
    expect(leanTarget(-HOLD_PITCH_LIMIT, HOLD, { working: false, holding: true })).toBeCloseTo(
      STOOP,
      9,
    );
    expect(leanTarget(-0.2, HOLD, { working: false, holding: true })).toBe(0);
  });

  it('eases at the same pace at any frame rate, and the eye moves along the view, never up', () => {
    const at = (dt: number) => {
      let lean = 0;
      for (let n = Math.round(0.1 / dt); n > 0; n--) lean = easeLean(lean, 0.25, dt);
      return lean;
    };
    expect(at(1 / 60)).toBeCloseTo(0.25 * (1 - Math.exp(-0.1 / LEAN_EASE_S)), 4);
    expect(at(1 / 300)).toBeCloseTo(at(1 / 60), 3);
    const state = createGameState();
    Object.assign(state.player, {
      position: [1, 0, 2],
      eyeHeight: 1.6,
      yaw: 0,
      pitch: -0.5,
      lean: 0.2,
    });
    const eye = eyeOf(state.player, [0, 0, 0]);
    expect(eye[0]).toBeCloseTo(1, 9);
    expect(eye[1]).toBeCloseTo(1.6 - 0.2 * Math.sin(0.5), 9);
    expect(eye[2]).toBeCloseTo(2 - 0.2 * Math.cos(0.5), 9);
    state.player.pitch = 0.6; // looking up: forward only
    expect(eyeOf(state.player, [0, 0, 0])[1]).toBeCloseTo(1.6, 9);
  });

  /** A player system in play, with a wall `wall` m ahead of the eye along any ray (or none). */
  function player(wall: number | null, holding = false) {
    const state = createGameState();
    state.session.phase = 'playing';
    Object.assign(state.player, { eyeHeight: 1.6, pitch: -0.3 });
    const input = new InputState();
    const hit: RayHit = { distance: 0, entityId: null, normal: [0, 0, 1] };
    const lineOfSight: LineOfSight = {
      castRay: (_o: Readonly<Vec3>, _d: Readonly<Vec3>, max: number) =>
        wall !== null && wall <= max ? Object.assign(hit, { distance: wall }) : null,
    };
    const system = new PlayerSystem({
      state,
      input,
      world: { roomAt: () => null } as unknown as World,
      events: new EventBus<GameEvents>(Logger.create('error', () => undefined)),
      config: GameConfigSchema.parse({}),
      holding: () => holding,
      lineOfSight,
    });
    const run = (seconds: number) => {
      for (let t = 0; t < seconds - 1e-9; t += 1 / 60) system.update(1 / 60);
    };
    return { state, input, run };
  }

  it('leans while C is held, back up when let go; the head stops short of a wall', () => {
    const open = player(null);
    open.input.press('inspect');
    open.run(1);
    expect(open.state.player.lean).toBeCloseTo(LEAN_IN, 4);
    open.input.release('inspect');
    open.run(1);
    expect(open.state.player.lean).toBe(0);

    const walled = player(0.3);
    walled.input.press('inspect');
    walled.run(1);
    expect(walled.state.player.lean).toBeCloseTo(0.3 - HEAD_CLEAR, 4);
    const close = player(0.1);
    close.input.press('inspect');
    close.run(1);
    expect(close.state.player.lean).toBe(0);
  });

  it('leans to pour only with something in hand; upright at once outside play', () => {
    const empty = player(null);
    empty.input.press('pour');
    empty.run(1);
    expect(empty.state.player.lean).toBe(0);
    const holding = player(null, true);
    holding.input.press('pour');
    holding.run(1);
    expect(holding.state.player.lean).toBeCloseTo(HOLD - HELD_CLEAR, 4);
    holding.state.session.workspace = 'somewhere';
    holding.run(1 / 60);
    expect(holding.state.player.lean).toBe(0);
  });
});

describe('leaning after a hand reaching to pour (pourLean)', () => {
  it('brings the eye to an arm’s length of the spout, within LEAN_IN … POUR_LEAN', () => {
    expect(pourLean(0.9)).toBeCloseTo(0.4, 9); // 0.9 − 0.5
    expect(pourLean(0.6)).toBe(LEAN_IN); // near: as working
    expect(pourLean(1.5)).toBe(POUR_LEAN); // far: no further
    expect(pourLean(0.3)).toBeCloseTo(0.3 - HELD_CLEAR, 9); // never onto it
  });
});
