import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../core/math';
import type { Game } from '../../game/Game';
import { bootTestGame, lookAt, placePlayer } from '../../game/testing';
import { lampOhms } from '../../simulation/circuitSolver';
import { edgeNodes, minusPost, nodeAt, plusPost, type BoardSpec } from './board';
import { CIRCUIT_KEY } from './CircuitSystem';

// The circuit bench in the real Physics Lab (real Rapier): a lamp taken in hand, plugged into the
// board, joined to the supply's posts by two leads, the supply turned up to 6 V; the lamp's reading
// against the circuit worked by hand; then off the board again, into the hands.

const H = 1 / 60;
const BOARD = 'physics-lab/circuit-trainer';
const LAMP = 'physics-lab/part-lamp-6-1';
/** The board's placement: its centre on the bench top, turned π (its front faces −z). */
const AT: Vec3 = [0.98, 0.9, 6.98];
const TOP = 0.04;

const run = (game: Game, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / H); i++) game.update(H);
};

/** A point [x, z] of the board's top face, in the world. */
const world = ([x, z]: [number, number], over = 0): Vec3 => [
  AT[0] - x,
  AT[1] + TOP + over,
  AT[2] - z,
];

async function bench() {
  const { game } = await bootTestGame();
  await game.newGame('researcher-male');
  await game.scenes.load('physics-lab');
  run(game, 1); // the parts settle on the cabinet's shelves
  const spec = game.world.entity(BOARD)?.item.circuitBoard as BoardSpec;
  placePlayer(game, [AT[0], 0, AT[2] - 0.75]);
  const aim = (point: Vec3) => {
    lookAt(game, point);
    game.update(H);
  };
  const board = () => [...game.circuits.all()].find((b) => b.entity.id === BOARD)!;
  return { game, spec, aim, board };
}

describe('the circuit bench', () => {
  it('plugs a lamp in, leads it to the supply and reads it as the circuit gives it', async () => {
    const { game, spec, aim, board } = await bench();
    const lamp = game.world.entity(LAMP)!;
    expect(game.interaction.grab(lamp)).toBe(true);
    run(game, 0.3);
    // Holding it, aim between holes 0 and 1 (edge 0) and plug it in.
    const [a, b] = edgeNodes(spec, 0);
    const [ax, az] = nodeAt(spec, a);
    const [bx, bz] = nodeAt(spec, b);
    aim(world([(ax + bx) / 2, (az + bz) / 2]));
    expect(board().aim).toEqual({ kind: 'edge', edge: 0 });
    expect(game.interaction.perform(BOARD, 'plug-in')).toBe(true);
    expect(game.interaction.heldId).toBeNull();
    expect(game.world.entity(LAMP)).toBeUndefined(); // out of the world while on the board
    expect(game.circuits.holds(LAMP)).toBe(true);

    // Leads: + post → hole 0, hole 1 → − post.
    for (const [from, to] of [
      [plusPost(spec), a],
      [b, minusPost(spec)],
    ] as const) {
      aim(world(nodeAt(spec, from)));
      expect(game.interaction.perform(BOARD, 'lead')).toBe(true);
      aim(world(nodeAt(spec, to)));
      expect(game.interaction.perform(BOARD, 'lead')).toBe(true);
    }
    expect(board().state.wires).toHaveLength(2);

    // The supply to 6 V: twelve steps of 0.5 V.
    aim(world([(spec.panel[0] + spec.panel[2]) / 2, (spec.panel[1] + spec.panel[3]) / 2]));
    for (let i = 0; i < 12; i++) expect(game.interaction.perform(BOARD, 'raise-volts')).toBe(true);
    expect(board().state.volts).toBe(6);

    // By hand: 6 V behind 0.01 Ω of supply and two 0.02 Ω leads, the lamp at its own law.
    const reading = game.circuits.reading(board(), 0, { volts: 0, amps: 0, watts: 0 });
    const v = reading.volts;
    expect(reading.amps * (lampOhms(6, 3, v) + 0.05)).toBeCloseTo(6, 6);
    expect(v).toBeGreaterThan(5.9);
    expect(reading.watts).toBeCloseTo(3 * Math.pow(v / 6, 1.6), 4);
    // Saved on the board, in its entity state.
    const saved = JSON.parse(game.entityStates.get(BOARD, CIRCUIT_KEY) as string) as {
      parts: unknown[];
    };
    expect(saved.parts).toHaveLength(1);

    // Aimed at it, a click takes it off: back in the world, in the hands.
    aim(world([(ax + bx) / 2, (az + bz) / 2], 0.03)); // its top
    expect(board().aim).toEqual({ kind: 'part', index: 0 });
    expect(game.interaction.perform(BOARD, 'take-off')).toBe(true);
    expect(game.interaction.heldId).toBe(LAMP);
    expect(board().state.parts).toHaveLength(0);
    expect(game.circuits.holds(LAMP)).toBe(false);
  });

  it('keeps what is on the board when the lab is loaded again', async () => {
    const { game, spec, aim, board } = await bench();
    const sw = 'physics-lab/part-switch-1';
    expect(game.interaction.grab(game.world.entity(sw)!)).toBe(true);
    run(game, 0.3);
    const [a, b] = edgeNodes(spec, 7);
    const [ax, az] = nodeAt(spec, a);
    const [bx, bz] = nodeAt(spec, b);
    aim(world([(ax + bx) / 2, (az + bz) / 2]));
    expect(game.interaction.perform(BOARD, 'plug-in')).toBe(true);
    aim(world([(ax + bx) / 2, (az + bz) / 2], 0.03));
    expect(game.interaction.perform(BOARD, 'work')).toBe(true); // closed
    await game.scenes.load('physics-lab');
    expect(game.world.entity(sw)).toBeUndefined(); // not spawned on its shelf again
    expect(board().state.parts).toEqual([
      { id: sw, item: 'part-switch', edge: 7, flip: false, setting: 1, broken: false },
    ]);
  });
});
