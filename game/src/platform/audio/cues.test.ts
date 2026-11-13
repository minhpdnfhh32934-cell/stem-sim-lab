import { describe, expect, it } from 'vitest';
import { Disposables } from '../../core/EventBus';
import type { Vec3 } from '../../core/math';
import { bootTestGame, placePlayer, untilIdle } from '../../game/testing';
import { handPoint } from '../../gameplay/action/handPoint';
import rawBank from '../../content/sounds.json';
import { parseBank } from './bank';
import { SoundCues, type SoundOut } from './cues';

const PREP = 'preparation-room';
const H = 1 / 60;

interface Played {
  id: string;
  at: Vec3 | null;
  delay: number;
  gain: number;
}

/** The game, its cues and what they asked the engine for. */
async function heard() {
  const { game } = await bootTestGame();
  const parsed = parseBank(rawBank);
  if (!('bank' in parsed)) throw new Error(parsed.problems);
  const played: Played[] = [];
  const rooms: { roomId: string; ambience: string | null; rt60: number }[] = [];
  const out: SoundOut = {
    play: (id, at, delay = 0, gain = 1) =>
      played.push({ id, at: at ? [at[0], at[1], at[2]] : null, delay, gain }),
    room: (roomId, ambience, rt60) => rooms.push({ roomId, ambience, rt60 }),
  };
  const cues = new SoundCues(game, parsed.bank, out);
  const subscriptions = new Disposables();
  cues.attach(subscriptions);
  const frame = (n = 1) => {
    for (let i = 0; i < n; i++) {
      game.update(H);
      cues.update();
    }
  };
  const ids = () => played.map((p) => p.id);
  return { game, cues, played, rooms, frame, ids, subscriptions };
}

describe('when the game makes which sound, and where (SoundCues)', () => {
  it('a new game: silent while the scene loads, then the room’s air and its reverb', async () => {
    const { game, played, rooms, frame } = await heard();
    await game.newGame('researcher-male');
    frame();
    expect(played).toEqual([]); // the room's switches and doors set on load: no clicks
    expect(rooms.at(-1)).toMatchObject({ roomId: PREP, ambience: 'air-quiet' });
    expect(rooms.at(-1)?.rt60).toBeGreaterThan(0.2);
    expect(rooms.at(-1)?.rt60).toBeLessThan(1);
  });

  it('walking: a footstep on the room’s floor at each foot, left and right, none standing', async () => {
    const { game, played, frame, ids } = await heard();
    await game.newGame('researcher-male');
    frame(30);
    placePlayer(game, [0, 0, 1], 0);
    frame(30);
    played.length = 0;
    game.input.press('moveForward');
    frame(120); // 2 s at 2.2 m/s: about 6 steps of 0.7 m
    game.input.release('moveForward');
    const steps = ids().filter((id) => id === 'step-vinyl');
    expect(steps.length).toBeGreaterThanOrEqual(4);
    expect(steps.length).toBeLessThanOrEqual(8);
    // At the feet: one to each side, by turns.
    const xs = played.filter((p) => p.id === 'step-vinyl').map((p) => p.at?.[0] ?? 0);
    const centre = xs.reduce((a, b) => a + b, 0) / xs.length;
    for (let i = 1; i < xs.length; i++) {
      expect(Math.sign((xs[i] ?? 0) - centre)).not.toBe(Math.sign((xs[i - 1] ?? 0) - centre));
    }
    frame(60); // slowing down
    played.length = 0;
    frame(120);
    expect(played).toEqual([]); // standing still
  });

  it('the wardrobe: the latch as it opens, and as its door meets the frame after its swing', async () => {
    const { game, played, frame } = await heard();
    await game.newGame('researcher-male');
    frame();
    expect(game.interaction.perform(`${PREP}/notice-board`, 'inspect')).toBe(true);
    untilIdle(game);
    played.length = 0;
    expect(game.interaction.perform(`${PREP}/wardrobe`, 'open')).toBe(true);
    for (let i = 0; i < 600 && game.actions.busy; i++) frame();
    const open = played.find((p) => p.id === 'hinge-open');
    const wardrobe = game.world.entity(`${PREP}/wardrobe`)!;
    expect(open?.at).toEqual([...wardrobe.pose.position]);
    placePlayer(game, [-1.4, 0, -1.5]); // stepped back, as the wardrobe asks to close it
    played.length = 0;
    expect(game.interaction.perform(wardrobe.id, 'close')).toBe(true);
    for (let i = 0; i < 600 && game.actions.busy; i++) frame();
    const close = played.find((p) => p.id === 'hinge-close');
    expect(close?.delay).toBe(wardrobe.item.hinged?.swingS);
  });

  it('a walk-through door: the reader beeps where the card is tapped, the leaf slides where it is', async () => {
    const { game, played, frame, ids } = await heard();
    await game.newGame('researcher-male');
    frame();
    const door = [...game.world.allEntities()].find((e) => e.item.door)!;
    const reader = handPoint(door, game.world, [0, 0, 0]);
    const doorIds = [door.id, 'elsewhere/door'] as const;
    game.events.publish('DoorChanged', { doorIds, state: 'preparing' });
    game.events.publish('DoorChanged', { doorIds, state: 'opening' });
    game.events.publish('DoorChanged', { doorIds, state: 'open' });
    game.events.publish('DoorChanged', { doorIds, state: 'closing' });
    game.events.publish('DoorChanged', { doorIds, state: 'closed' });
    expect(ids()).toEqual(['card-accepted', 'door-opening', 'door-closing', 'door-closed']);
    expect(played[0]?.at).toEqual([...reader]);
    expect(played[1]?.at).toEqual([...door.pose.position]);
    // Refused (the entry's rules): the reader's refusal, not the interface's.
    played.length = 0;
    game.events.publish('ActionBlocked', { entityId: door.id, actionId: 'travel', reason: 'x' });
    game.events.publish('ActionBlocked', {
      entityId: `${PREP}/lab-coat`,
      actionId: 'wear',
      reason: 'x',
    });
    expect(ids()).toEqual(['card-refused', 'ui-refused']);
    expect(played[1]?.at).toBeNull();
  });

  it('the teacher at a shut door: his reader beeps, the door slides, his steps are heard', async () => {
    const { game, played, frame, ids } = await heard();
    await game.newGame('researcher-male');
    await game.scenes.load('physics-lab');
    frame(2);
    const door = 'physics-lab/door-hub';
    const reader = handPoint(game.world.entity(door)!, game.world, [0, 0, 0]);
    // A lecture at the drop tower, ended: he walks back to the hall through the shut door.
    game.npcs.lectureAt('teacher', 'physics-lab/tower');
    frame(60 * 5);
    game.explain.close();
    played.length = 0;
    for (let i = 0; i < 60 * 30 && game.doors.state(door) === 'closed'; i++) frame();
    // Each foot heard on the lab's floor, where he walks; then the card on his side's reader.
    const steps = played.filter((p) => p.id.startsWith('step-'));
    expect(steps.length).toBeGreaterThan(4);
    const view = game.npcs.view('teacher')!;
    const last = steps.at(-1)?.at ?? [0, 0, 0];
    expect(Math.hypot(last[0] - view.x, last[2] - view.z)).toBeLessThan(0.6);
    const beep = played.find((p) => p.id === 'card-accepted');
    expect(beep?.at).toEqual([...reader]);
    expect(ids().filter((id) => !id.startsWith('step-'))).toEqual(['card-accepted']);
    for (let i = 0; i < 60 && game.doors.state(door) !== 'opening'; i++) {
      frame();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(ids()).toContain('door-opening');
  }, 20_000);

  it('a task step and a task done chime; a click of the interface clicks', async () => {
    const { game, cues, frame, ids } = await heard();
    await game.newGame('researcher-male');
    frame();
    game.events.publish('TaskStepCompleted', { taskId: 't', stepId: 's', next: 1 });
    game.events.publish('TaskCompleted', { taskId: 't' });
    cues.click();
    expect(ids()).toEqual(['ui-step', 'ui-task', 'ui-click']);
  });

  it('an object striking something knocks where it struck, as its look sounds, louder the harder', async () => {
    const { game, played, frame } = await heard();
    await game.newGame('researcher-male');
    const entity = [...game.world.allEntities()][0]!;
    const impact = (speed: number) =>
      game.events.publish('Impact', { entityId: entity.id, speed, position: [1, 0.5, -2] });
    impact(3); // the scene not yet settled: silent
    expect(played).toEqual([]);
    frame();
    impact(3);
    impact(0.75);
    impact(12);
    const sound = (rawBank.impacts as Record<string, string>)[entity.item.visual.material];
    expect(played).toEqual([
      { id: sound, at: [1, 0.5, -2], delay: 0, gain: 1 }, // 3 m/s: its own volume
      { id: sound, at: [1, 0.5, -2], delay: 0, gain: 0.25 },
      { id: sound, at: [1, 0.5, -2], delay: 0, gain: 1.3 }, // the hardest, no louder
    ]);
  });

  it('a run starting beeps at its station, once the scene has settled', async () => {
    const { game, played, frame } = await heard();
    await game.newGame('researcher-male');
    const station = [...game.world.allEntities()][0]!;
    const started = (sessionId: string) =>
      game.events.publish('ExperimentStarted', { runId: 'r', experimentId: 'e', sessionId });
    started(station.id); // still loading: silent
    expect(played).toEqual([]);
    frame();
    started(station.id);
    started('nowhere/station'); // not in the world: heard where the player is
    const [x, y, z] = station.pose.position;
    expect(played).toEqual([
      { id: 'run-start', at: [x, y, z], delay: 0, gain: 1 },
      { id: 'run-start', at: null, delay: 0, gain: 1 },
    ]);
  });

  it('a sliding door hisses once as its two leaves part, and once as they shut', async () => {
    const { game, played, frame } = await heard();
    await game.newGame('researcher-male');
    frame();
    const slid = (entityId: string, open: boolean) =>
      game.events.publish('DoorSlid', { entityId, open, position: [13.125, 1.3, 0] });
    slid('lab/leaf-a', true);
    slid('lab/leaf-b', true); // the same frame, the same door
    frame();
    slid('lab/leaf-a', false);
    slid('lab/leaf-b', false);
    expect(played.map((p) => [p.id, p.at])).toEqual([
      ['slide-open', [13.125, 1.3, 0]],
      ['slide-close', [13.125, 1.3, 0]],
    ]);
  });
});
