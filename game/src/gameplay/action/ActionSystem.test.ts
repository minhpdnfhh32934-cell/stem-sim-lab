import { describe, expect, it } from 'vitest';
import { bootTestGame, placePlayer, untilIdle } from '../../game/testing';
import { ActionSequenceSchema, type HandSample, sampleHand, sampleLean } from './action';

const H = 1 / 60;
const PREP = 'preparation-room';

const SEQUENCE = ActionSequenceSchema.parse({
  id: 'test',
  on: { action: 'open' },
  seconds: 1,
  keys: [
    { t: 0.4, right: { offset: [0.1, 0.5, 0.3] }, lean: 0.4 },
    { t: 0.6, right: { offset: [0.2, 0.6, 0.3], fingers: 'fist' } },
  ],
});
const sample = (): HandSample => ({
  from: { at: 'body', offset: [0, 0, 0], palm: 'down', fingers: 'open' },
  to: { at: 'body', offset: [0, 0, 0], palm: 'down', fingers: 'open' },
  along: 0,
  weight: 0,
});

describe('an action acted out, sampled (action.ts)', () => {
  it('eases a hand in to its first key, along its keys, and out after its last', () => {
    const s = sample();
    expect(sampleHand(SEQUENCE, 'left', 0.5, s)).toBe(false); // this hand is not in it
    expect(sampleHand(SEQUENCE, 'right', 0, s)).toBe(true);
    expect(s.weight).toBe(0); // from its own pose at the start
    sampleHand(SEQUENCE, 'right', 0.2, s);
    expect(s.weight).toBeCloseTo(0.5, 9); // halfway to its first key (0.4 s)
    sampleHand(SEQUENCE, 'right', 0.4, s);
    expect([s.weight, s.along, s.from.offset[0]]).toEqual([1, 0, 0.1]);
    sampleHand(SEQUENCE, 'right', 0.5, s);
    expect(s.along).toBeCloseTo(0.5, 9); // halfway between the keys (eased: the middle is the middle)
    expect([s.from.offset[0], s.to.fingers]).toEqual([0.1, 'fist']);
    sampleHand(SEQUENCE, 'right', 0.8, s);
    expect(s.weight).toBeCloseTo(0.5, 9); // halfway back, over the time left after its last key
    sampleHand(SEQUENCE, 'right', 1, s);
    expect(s.weight).toBe(0);
  });

  it('leans as its keys ask, back upright by its end', () => {
    expect(sampleLean(SEQUENCE, 0)).toBe(0);
    expect(sampleLean(SEQUENCE, 0.4)).toBeCloseTo(0.4, 9);
    expect(sampleLean(SEQUENCE, 0.7)).toBeCloseTo(0.2, 9);
    expect(sampleLean(SEQUENCE, 1)).toBeCloseTo(0, 9);
  });

  it('refuses keys out of order, moments past its end, a start that is both or neither', () => {
    const bad = (data: object) =>
      ActionSequenceSchema.safeParse({ id: 'x', on: { action: 'open' }, seconds: 1, ...data })
        .success;
    const key = (t: number) => ({ t, right: { offset: [0, 0.5, 0.2] } });
    expect(bad({ keys: [key(0.2), key(0.6)] })).toBe(true);
    expect(bad({ keys: [key(0.6), key(0.2)] })).toBe(false);
    expect(bad({ keys: [key(1.2)] })).toBe(false);
    expect(bad({ keys: [key(0.2)], swap: 2 })).toBe(false);
    expect(bad({ keys: [key(0.2)], carry: [0.5, 0.4] })).toBe(false);
    expect(
      ActionSequenceSchema.safeParse({
        id: 'x',
        on: { action: 'open', released: 'throw' },
        seconds: 1,
        keys: [key(0.2)],
      }).success,
    ).toBe(false);
  });
});

describe('actions acted out in the game (ActionSystem)', () => {
  async function prep() {
    const { game } = await bootTestGame();
    await game.newGame('researcher-male');
    // The cleanroom entry's first step (its rules: read before the PPE), then the wardrobe.
    expect(game.interaction.perform(`${PREP}/notice-board`, 'inspect')).toBe(true);
    expect(game.interaction.perform(`${PREP}/wardrobe`, 'open')).toBe(true);
    untilIdle(game);
    return game;
  }

  it('plays the coat taken off for its seconds: the player stands, the look of it changes later', async () => {
    const game = await prep();
    expect(game.interaction.perform(`${PREP}/lab-coat`, 'wear')).toBe(true);
    expect(game.actions.current?.sequence.id).toBe('coat-on');
    expect(game.equipment.isWearing('lab-coat')).toBe(true); // the rules see it at once
    untilIdle(game);
    expect(game.interaction.perform(`${PREP}/lab-coat`, 'take-off')).toBe(true);
    const playing = game.actions.current!;
    expect(playing.sequence.id).toBe('coat-off');
    expect(playing.target.id).toBe(`${PREP}/lab-coat`);
    // Walking while it plays: the player stays where they are, looking around is free.
    const at = [...game.state.player.position];
    game.input.press('moveForward');
    for (let t = 0; t < 1; t += H) game.update(H);
    game.input.release('moveForward');
    expect(game.state.player.position[0]).toBeCloseTo(at[0]!, 3);
    expect(game.state.player.position[2]).toBeCloseTo(at[2]!, 3);
    expect(game.actions.busy).toBe(true);
    untilIdle(game);
    expect(game.actions.busy).toBe(false); // its seconds in all (4 s)
    expect(game.equipment.isWearing('lab-coat')).toBe(false);
  });

  it('crouches to pick something up off the floor; nothing plays for an action it has no sequence for', async () => {
    const game = await prep();
    const lamp = game.world.entity(`${PREP}/desk-lamp`)!;
    placePlayer(game, [lamp.pose.position[0], 0, lamp.pose.position[2] + 1]);
    expect(game.interaction.perform(lamp.id, 'grab')).toBe(true);
    expect(game.actions.current).toBeNull(); // on the desk: picked up at once
    // Turned round to the open floor (south, away from the desk), then let go there.
    game.state.player.yaw = Math.PI;
    game.state.player.pitch = -0.5;
    for (let t = 0; t < 0.5; t += H) game.update(H);
    game.interaction.drop();
    untilIdle(game);
    for (let t = 0; t < 2; t += H) game.update(H); // it falls to the floor
    expect(lamp.pose.position[1]).toBeLessThan(0.45);
    expect(game.interaction.perform(lamp.id, 'grab')).toBe(true);
    expect(game.actions.current?.sequence.id).toBe('pick-up-from-floor');
    // Phú (2026-11-05): the body bends down and the hand reaches out to it, then takes it. A step
    // up to it first if it is out of reach; the eyes go down to it; it lies there until the hand
    // grips it (0.85 s), then comes up in the hand.
    expect(game.interaction.heldId).toBeNull();
    for (let i = 0; i < 300 && (game.actions.current?.t ?? 1) < 0.8; i++) game.update(H);
    expect(game.actions.lean).toBeGreaterThan(0.6);
    expect(game.state.player.lean).toBeGreaterThan(0.3); // the eye goes down with the crouch
    expect(game.actions.glance).toBeLessThan(0); // looking down at it
    expect(lamp.pose.position[1]).toBeLessThan(0.45); // still on the floor
    expect(game.interaction.heldId).toBeNull();
    for (let i = 0; i < 60 && game.interaction.heldId === null; i++) game.update(H);
    expect(game.interaction.heldId).toBe(lamp.id); // taken as the fingers close
    expect(game.actions.current?.t).toBeGreaterThanOrEqual(0.85);
    for (let i = 0; i < 120 && game.actions.current; i++) game.update(H);
    expect(game.actions.current).toBeNull();
    expect(game.actions.lean).toBe(0);
  });
});

describe('the rest of the list (H8): taps that do not hold, a hand that steadies', () => {
  it('lists a sequence for every action the contract names, each started by an action or a release', async () => {
    const { game } = await bootTestGame();
    await game.loadLab(); // the actions come with the lab pack, never with the menu
    expect(game.content.actions.all().length).toBeGreaterThan(0);
    const on = game.content.actions.all().map((s) => s.on.action ?? `released:${s.on.released}`);
    for (const action of [
      'wear',
      'take-off',
      'discard',
      'grab',
      'released:set-down',
      'released:throw',
      'fill',
      'deliver',
      'drops',
      'open-tap',
      'close-tap',
      'raise',
      'lower',
      'run',
      'reset',
      'open',
      'close',
      'travel',
      'activate',
      'water-on',
    ]) {
      expect(on, action).toContain(action);
    }
    // A step up to the target never chases one that moves with the hands: a pick-up steps in
    // only when it takes the object at its effect (it lies still until the hand is there).
    for (const s of game.content.actions.all()) {
      if (s.stepIn && s.on.action === 'grab') expect(s.effect, s.id).toBeDefined();
      if (s.stepIn) expect(s.on.released, s.id).toBeUndefined();
    }
    // Pressed again and again, a dial's and a station button's taps never hold the player.
    for (const sequence of game.content.actions.all()) {
      const tap = ['raise', 'lower', 'run', 'stop', 'reset', 'clear'].includes(
        sequence.on.action ?? '',
      );
      expect(sequence.waits, sequence.id).toBe(!tap);
      expect(sequence.seconds, sequence.id).toBeLessThanOrEqual(6);
    }
    game.dispose();
  });
});
