import { describe, expect, it } from 'vitest';
import type { Game } from '../../game/Game';
import type { GameEvents } from '../../game/GameEvents';
import { bootTestGame, placePlayer, lookAt } from '../../game/testing';
import { BRIGADE_S, BURNING_KEY } from '../fire/FireSystem';
import { plusPost, minusPost, type BoardSpec, type MountedPart, nodeAt } from './board';
import { BROKEN_KEY, CIRCUIT_KEY } from './CircuitSystem';

// Phase E-2 in the real Physics Lab: what heat does to parts plugged in wrongly, and what fire
// does then — each case laid on the board through its saved state, then played in time.

const H = 1 / 60;
const BOARD = 'physics-lab/circuit-trainer';
const run = (game: Game, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / H); i++) game.update(H);
};

const part = (id: string, item: string, edge: number, setting = 0): MountedPart => ({
  id: `physics-lab/${id}`,
  item,
  edge,
  flip: false,
  setting,
  broken: false,
});

/** The lab with the board holding `parts` and `wires`, its supply at `volts`. */
async function lab(parts: MountedPart[], wires: [number, number][], volts: number) {
  const { game } = await bootTestGame();
  await game.newGame('researcher-male');
  game.state.world.entityStates[BOARD] = {
    [CIRCUIT_KEY]: JSON.stringify({ parts, wires, volts, burnt: false }),
  };
  await game.scenes.load('physics-lab');
  const incidents: GameEvents['CircuitIncident'][] = [];
  game.events.subscribe('CircuitIncident', (e) => incidents.push(e));
  const spec = game.world.entity(BOARD)?.item.circuitBoard as BoardSpec;
  const board = () => [...game.circuits.all()].find((b) => b.entity.id === BOARD)!;
  return { game, spec, board, incidents };
}

/** A grid of 7: edge 0 joins holes 0–1; from the supply's posts, + → 0 and 1 → −. */
const across0 = (spec: BoardSpec): [number, number][] => [
  [plusPost(spec), 0],
  [1, minusPost(spec)],
];
const SPEC = { cols: 7, rows: 4 } as BoardSpec;
const PLUS = 28;
const MINUS = 29;

describe('heat on the circuit bench', () => {
  it('a 0.25 W resistor of 10 Ω on 6 V (3.6 W) smokes, then catches fire', async () => {
    const { game, board, incidents } = await lab(
      [part('part-resistor-10-1', 'part-resistor-10', 0)],
      across0(SPEC),
      6,
    );
    // θ∞ = 3.6 W × 340 K/W ≈ 1220 K, τ = 340 × 0.06 ≈ 20 s: smoke (230 K) at ≈ 4.2 s,
    // fire (350 K) at ≈ 6.9 s.
    run(game, 3.9);
    expect(incidents).toEqual([]);
    run(game, 0.6);
    expect(incidents.map((i) => i.what)).toEqual(['smoke']);
    expect(incidents[0]!.watts).toBeGreaterThan(3.5); // 6²/10, less the leads and supply
    run(game, 2.2);
    expect(incidents.map((i) => i.what)).toEqual(['smoke']);
    run(game, 0.6);
    expect(incidents.map((i) => i.what)).toEqual(['smoke', 'fire']);
    expect(board().state.parts[0]!.broken).toBe(true); // burnt open: nothing flows
    expect(game.circuits.supply(board()).amps).toBeCloseTo(0, 9);
    expect(game.fires.burning(BOARD)).toBe(true);
  });

  it('an ammeter straight across a 4.5 V battery (≈ 7 A) blows its own 3.15 A fuse', async () => {
    const { game, board, incidents } = await lab(
      [part('part-cell-4v5-1', 'part-cell-4v5', 0), part('part-ammeter-1', 'part-ammeter', 6)],
      // the cell between holes 0 (+) and 1, the ammeter between 7 and 8: 0→7 and 1→8 close it.
      [
        [0, 7],
        [1, 8],
      ],
      0,
    );
    // 4.5 V on 0.5 Ω + 0.1 Ω + two leads: about 7 A, 2.2 × its fuse (it melts at 2 ×, τ 1 s).
    run(game, 3);
    expect(incidents.map((i) => [i.what, i.itemId])).toEqual([['failed', 'part-ammeter']]);
    expect(incidents[0]!.amps).toBeGreaterThan(6.5);
    expect(board().state.parts[1]!.broken).toBe(true);
  });

  it('a 2.5 V lamp on 12 V burns out at once (lamp life ∝ V^−16)', async () => {
    const { game, incidents } = await lab(
      [part('part-lamp-2v5-1', 'part-lamp-2v5', 0)],
      across0(SPEC),
      12,
    );
    run(game, 0.1);
    expect(incidents.map((i) => i.what)).toEqual(['burnt-out']);
  });

  it('a lead shorting the 12 V lead-acid battery smokes, burns and melts', async () => {
    const { game, board, incidents } = await lab(
      [part('part-battery-12v-1', 'part-battery-12v', 0)],
      [[0, 1]],
      0,
    );
    run(game, 2);
    expect(incidents.map((i) => i.what)).toEqual(['smoke', 'fire', 'melted']);
    expect(incidents[0]!.amps).toBeGreaterThan(200); // 12 V on about 0.04 Ω
    expect(board().state.wires).toHaveLength(0);
    expect(game.fires.burning(BOARD)).toBe(true);
  });
});

describe('fire', () => {
  /** A fire started by a burning resistor, the player standing before the bench. */
  async function burning() {
    const setup = await lab(
      [part('part-resistor-10-1', 'part-resistor-10', 0), part('part-lamp-6-1', 'part-lamp-6', 21)],
      across0(SPEC),
      12,
    );
    run(setup.game, 5);
    expect(setup.game.fires.burning(BOARD)).toBe(true);
    return setup;
  }

  it('never goes out by itself: it grows, ruins the board and spreads to the bench', async () => {
    const { game, board } = await burning();
    run(game, 60);
    expect(game.fires.burning(BOARD)).toBe(true);
    expect(board().state.burnt).toBe(true); // all its parts broken, its leads gone
    expect(board().state.parts.every((p) => p.broken)).toBe(true);
    expect(board().state.wires).toHaveLength(0);
    expect(game.fires.burning('physics-lab/circuit-table')).toBe(true);
    expect(game.entityStates.get(BOARD, 'charred')).toBe(true);
    // Saved: a load brings it back burning.
    expect(game.entityStates.get(BOARD, BURNING_KEY)).toBeGreaterThan(0.5);
    await game.scenes.load('physics-lab');
    expect(game.fires.burning(BOARD)).toBe(true);
  });

  it('the CO₂ extinguisher, held and sprayed at it, puts a young fire out', async () => {
    const { game } = await burning();
    placePlayer(game, [0.98, 0, 6.3]);
    const extinguisher = game.world.entity('physics-lab/co2-extinguisher')!;
    expect(game.interaction.grab(extinguisher)).toBe(true);
    const fire = game.fires.list[0]!;
    lookAt(game, fire.position);
    game.input.press('throw');
    run(game, 3);
    game.input.release('throw');
    expect(game.fires.burning(BOARD)).toBe(false);
    expect(game.entityStates.get(extinguisher.id, 'charge')).toBeLessThan(15);
  });

  it('114 sends the brigade, who put every fire out when they arrive; a call with no fire is a false alarm', async () => {
    const { game, board } = await burning();
    expect(game.fires.call('114')).toBe('dispatched');
    expect(game.fires.call('114')).toBe('already-coming');
    run(game, BRIGADE_S - 1);
    expect(game.fires.burning(BOARD)).toBe(true);
    run(game, 2);
    expect(game.fires.list).toHaveLength(0);
    expect(game.fires.call('114')).toBe('false-alarm');
    expect(game.fires.call('115')).toBe('other-service');
    expect(game.fires.call('0909')).toBe('no-answer');
    // The burnt board replaced, its parts back in the cabinet sound.
    placePlayer(game, [0.98, 0, 6.3]);
    lookAt(game, [0.98, 0.94, 6.98]);
    game.update(H);
    expect(board().state.burnt).toBe(true); // burning 36 s: past half its size
    expect(game.interaction.perform(BOARD, 'replace-board')).toBe(true);
    expect(board().state.parts).toHaveLength(0);
    expect(game.world.entity('physics-lab/part-resistor-10-1')).toBeDefined();
    expect(game.entityStates.get('physics-lab/part-resistor-10-1', BROKEN_KEY)).toBe(false);
    expect(game.entityStates.get(BOARD, 'charred')).toBe(false);
  });

  it('a broken part handed back at the cabinet comes back sound on its shelf', async () => {
    const { game, board } = await lab(
      [part('part-lamp-2v5-1', 'part-lamp-2v5', 0)],
      [
        [PLUS, 0],
        [1, MINUS],
      ],
      12,
    );
    run(game, 0.2);
    expect(board().state.parts[0]!.broken).toBe(true);
    // Take it off (aimed at its top), then hand it in.
    placePlayer(game, [0.98, 0, 6.3]);
    const [x, z] = nodeAt(board().spec, 0);
    const [x1, z1] = nodeAt(board().spec, 1);
    lookAt(game, [0.98 - (x + x1) / 2, 0.97, 6.98 - (z + z1) / 2]);
    game.update(H);
    expect(game.interaction.perform(BOARD, 'take-off')).toBe(true);
    const lamp = 'physics-lab/part-lamp-2v5-1';
    expect(game.entityStates.get(lamp, BROKEN_KEY)).toBe(true);
    expect(game.interaction.perform('physics-lab/circuit-cabinet', 'return-part')).toBe(true);
    expect(game.interaction.heldId).toBeNull();
    expect(game.entityStates.get(lamp, BROKEN_KEY)).toBe(false);
    expect(game.world.entity(lamp)).toBeDefined();
  });
});
