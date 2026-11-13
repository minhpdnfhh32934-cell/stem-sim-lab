import { describe, expect, it } from 'vitest';
import { EventBus } from '../../core/EventBus';
import { directionFromYawPitch, type Vec3 } from '../../core/math';
import { createTexts } from '../../core/i18n';
import { Logger } from '../../core/Logger';
import type { GameEvents } from '../../game/GameEvents';
import { createGameState } from '../../game/GameState';
import type { WorldEntity } from '../../world/World';
import { InputState } from '../player/InputState';
import { ExplainSystem } from './ExplainSystem';
import type { StationView } from './StationSystem';

const EXPLAIN = {
  summary: 'A bob swings.',
  parts: [{ id: 'bob', name: 'Bob', role: 'It swings.', anchor: { part: 'bob' } }],
  steps: [
    { text: 'One.', parts: ['bob'] },
    { text: 'Two.', parts: [] },
    { text: 'Three.', parts: [] },
  ],
};

/**
 * A station 'room/pendulum' at (0, 0) with an explanation, and 'room/bare' at (1, 0) without; the
 * crosshair on `focus` (an interactable), the first solid along the view `hit`.
 */
function setup() {
  const state = createGameState();
  state.session.phase = 'playing';
  const events = new EventBus<GameEvents>(Logger.create('error', () => undefined));
  const input = new InputState();
  const station = (id: string, explain: unknown) =>
    ({ id, definition: { name: id, explain } }) as unknown as StationView;
  const stations = new Map([
    ['room/pendulum', station('room/pendulum', EXPLAIN)],
    ['room/bare', station('room/bare', undefined)],
  ]);
  const positions: Record<string, [number, number, number]> = {
    'room/pendulum': [0, 0, 0],
    'room/bare': [1, 0, 0],
  };
  let focus: string | null = 'room/pendulum';
  let hit: { entityId: string | null; distance: number } | null = null;
  const system = new ExplainSystem({
    state,
    events,
    input,
    texts: createTexts({}, () => 'en'),
    world: {
      entity: (id) =>
        positions[id]
          ? ({ pose: { position: positions[id] } } as unknown as WorldEntity)
          : undefined,
    },
    stations: {
      view: (id) => stations.get(id) ?? null,
      stationOf: (id) => stations.get(id) ?? null,
      stationNear: (x, z, radius) => {
        const near = Object.entries(positions).find(
          ([, p]) => Math.hypot(p[0] - x, p[2] - z) <= radius,
        );
        return near ? (stations.get(near[0]) ?? null) : null;
      },
      stationAlong: () => null,
    },
    interaction: {
      get focused() {
        return focus ? { id: focus } : null;
      },
    },
    lineOfSight: { castRay: () => hit },
  });
  system.init();
  const seen: string[] = [];
  events.subscribe('ExplainOpened', ({ stationId }) => seen.push(`open ${stationId}`));
  events.subscribe('ExplainStepChanged', ({ step }) => seen.push(`step ${step}`));
  events.subscribe('ExplainClosed', ({ stationId }) => seen.push(`close ${stationId}`));
  events.subscribe('ActionBlocked', ({ reason }) => seen.push(`blocked ${reason}`));
  const pressH = () => {
    input.press('explain');
    system.update();
    input.endFrame();
    input.release('explain');
  };
  return {
    state,
    system,
    seen,
    pressH,
    events,
    setFocus: (id: string | null) => (focus = id),
    setHit: (h: typeof hit) => (hit = h),
  };
}

describe('ExplainSystem', () => {
  it('H opens the station the crosshair is on, in reach, at step 1 and closes it again', () => {
    const { state, system, seen, pressH } = setup();
    state.player.position = [2, 0, 1];
    pressH();
    expect(state.session.explain).toEqual({ stationId: 'room/pendulum', step: 0 });
    expect(system.explain?.summary).toBe('A bob swings.');
    pressH();
    expect(state.session.explain).toBeNull();
    expect(seen).toEqual(['open room/pendulum', 'step 0', 'close room/pendulum']);
  });

  it('out of reach, at a station without an explanation, or looking away: why, and nothing', () => {
    const { state, system, seen, pressH, setFocus } = setup();
    state.player.position = [4, 0, 3]; // 5 m away
    pressH();
    expect(state.session.explain ?? null).toBeNull();
    setFocus('room/bare');
    state.player.position = [1, 0, 1];
    pressH();
    expect(state.session.explain ?? null).toBeNull();
    // Beside the pendulum, looking at nothing of it: no hint, H opens nothing.
    setFocus(null);
    state.player.position = [0, 0, 1];
    expect(system.aimed()).toBeNull();
    pressH();
    expect(state.session.explain ?? null).toBeNull();
    expect(seen).toEqual([
      'blocked Look at an experiment to have it explained.',
      'blocked Look at an experiment to have it explained.',
      'blocked Look at an experiment to have it explained.',
    ]);
  });

  it('the bench under an apparatus counts; the floor beside it does not', () => {
    const { state, system, setFocus, setHit } = setup();
    setFocus(null);
    state.player.position = [0, 0, 1.5];
    state.player.yaw = 0; // facing −z, towards the pendulum at the origin
    state.player.pitch = -0.5;
    const dir: Vec3 = [0, 0, 0];
    directionFromYawPitch(0, -0.5, dir);
    const eye = state.player.eyeHeight;
    // The ray meets the bench top (0.9 m) a little in front of the apparatus.
    setHit({ entityId: 'room/bench', distance: (0.9 - eye) / dir[1] });
    expect(system.aimed()?.id).toBe('room/pendulum');
    // Further, it meets the floor: not the bench.
    setHit({ entityId: 'room/floor', distance: (0.1 - eye) / dir[1] });
    expect(system.aimed()).toBeNull();
    // A piece of the apparatus itself (no interaction of its own) counts wherever it is hit.
    setHit({ entityId: 'room/pendulum', distance: 1 });
    expect(system.aimed()?.id).toBe('room/pendulum');
  });

  it('steps stay in range; a scene change or a workspace closes it', () => {
    const { state, system, seen, events } = setup();
    expect(system.open('room/pendulum')).toBeNull();
    system.show(5);
    expect(state.session.explain?.step).toBe(2);
    system.show(-1);
    expect(state.session.explain?.step).toBe(0);
    events.publish('WorkspaceOpened', { stationId: 'room/pendulum' });
    expect(state.session.explain).toBeNull();
    system.open('room/pendulum');
    events.publish('SceneLoading', { sceneId: 'next' });
    expect(state.session.explain).toBeNull();
    expect(seen.filter((s) => s.startsWith('close'))).toHaveLength(2);
    expect(system.open('room/bare')).toBe('This experiment has no explanation yet.');
  });

  it('paused, H does not open it', () => {
    const { state, pressH } = setup();
    state.session.paused = true;
    pressH();
    expect(state.session.explain ?? null).toBeNull();
  });
});
