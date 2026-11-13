import { describe, expect, it } from 'vitest';
import { createGameState } from '../game/GameState';
import { applySave } from '../persistence/SaveSystem';
import { parseSave } from '../persistence/saveData';
import {
  advance,
  ClockSystem,
  clockText,
  DAY_S,
  daylight,
  hourOf,
  NEW_GAME_S,
  sunDirection,
  twilight,
} from './clock';

const at = (hour: number) => (hour / 24) * DAY_S;

describe('the time of day', () => {
  it('a day is 15 minutes of play; a new game starts at 08:00', () => {
    expect(DAY_S).toBe(900);
    expect(clockText(NEW_GAME_S)).toBe('08:00');
    expect(createGameState().world.clockS).toBe(NEW_GAME_S);
    expect(hourOf(advance(at(23.5), at(1)))).toBeCloseTo(0.5); // past midnight, the next day
    expect(clockText(at(13.25))).toBe('13:15');
  });

  it('day, night, dawn and dusk', () => {
    expect(daylight(at(12))).toBe(1);
    expect(daylight(at(0))).toBe(0);
    expect(daylight(at(6))).toBeCloseTo(0.5);
    expect(daylight(at(18))).toBeCloseTo(0.5);
    expect(twilight(at(6))).toBe(1);
    expect(twilight(at(12))).toBe(0);
  });

  it('the sun rises in the east, stands south at noon, is below the horizon at night', () => {
    const sun: [number, number, number] = [0, 0, 0];
    sunDirection(at(12), sun);
    expect(sun[1]).toBeGreaterThan(0.8);
    expect(sun[2]).toBeGreaterThan(0);
    sunDirection(at(7), sun);
    expect(sun[0]).toBeGreaterThan(0.5); // east
    expect(sun[1]).toBeGreaterThan(0);
    sunDirection(at(17), sun);
    expect(sun[0]).toBeLessThan(-0.5); // west
    sunDirection(at(0), sun);
    expect(sun[1]).toBeLessThan(0);
    expect(Math.hypot(...sun)).toBeCloseTo(1);
  });

  it('moves on only while the game is played', () => {
    const state = createGameState();
    const clock = new ClockSystem(state);
    state.session.phase = 'menu';
    clock.update(10);
    expect(state.world.clockS).toBe(NEW_GAME_S);
    state.session.phase = 'playing';
    clock.update(10);
    expect(state.world.clockS).toBe(NEW_GAME_S + 10);
  });

  it('a save continues the same hour', () => {
    const save = {
      version: 9,
      savedAt: '2026-11-07T00:00:00.000Z',
      player: {
        characterId: 'researcher-male',
        sceneId: 'simlab-hub',
        position: [0, 0, 0],
        yaw: 0,
        pitch: 0,
        equipment: [],
        inventory: { stacks: [], selected: 0 },
      },
      world: { entityStates: {}, containers: {}, objects: {}, clockS: at(21) },
      progression: { completedExperiments: [], procedures: {}, tasks: { active: null, done: [] } },
    };
    const parsed = parseSave(JSON.stringify(save));
    if (!parsed.ok) throw new Error(parsed.error);
    const state = createGameState();
    applySave(state, parsed.value);
    expect(clockText(state.world.clockS)).toBe('21:00');
  });
});
