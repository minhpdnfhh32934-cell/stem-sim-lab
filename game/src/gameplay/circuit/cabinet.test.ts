import { beforeAll, describe, expect, it } from 'vitest';
import type { Vec3 } from '../../core/math';
import type { Game } from '../../game/Game';
import type { GameEvents } from '../../game/GameEvents';
import { bootTestGame, lookAt, placePlayer } from '../../game/testing';
import type { Placement } from '../../world/definitions';
import { lampOhms } from '../../simulation/circuitSolver';
import {
  edgeNodes,
  LEAD_OHMS,
  minusPost,
  nodeAt,
  plusPost,
  RHEOSTAT_MIN_OHMS,
  SUPPLY_OHMS,
  SWITCH_OHMS,
  type BoardSpec,
  type PartSpec,
} from './board';

// Every part in the circuit bench's cabinet, as the content places it, used as a player would in
// the real Physics Lab (real Rapier): aimed at on its shelf in the open cabinet and taken, plugged
// into the board between holes 21 and 22 (the supply's posts led to them), worked if it can be,
// read against the circuit worked by hand, taken off and handed back into the cabinet.
// Round the loop outside the part: the supply (SUPPLY_OHMS) and two leads (LEAD_OHMS each); the
// parts of almost no resistance (switch, fuses, ammeters) in series with the 10 Ω 5 W resistor,
// since the supply's 0.5 V steps would drive them past their ratings alone.

const H = 1 / 60;
const LAB = 'physics-lab';
const BOARD = `${LAB}/circuit-trainer`;
const CABINET = `${LAB}/circuit-cabinet`;
const SERIES = `${LAB}/part-resistor-10-5w-1`;
/** The board's centre on the bench top, turned π; its top face 4 cm up. */
const AT: Vec3 = [0.98, 0.9, 6.98];
const TOP = 0.04;
/** The front row's first edge (holes 21–22) for the part tried; the next (22–23) for SERIES. */
const EDGE = 18;
const SERIES_EDGE = 19;
const LOOP = SUPPLY_OHMS + 2 * LEAD_OHMS;
/** Where the player stands to take a part: 1 m before the cabinet's open front (z 7.0). */
const STAND_Z = 6.0;
const LOW_OHMS = ['switch', 'fuse', 'ammeter'];

const world = ([x, z]: [number, number], over = 0): Vec3 => [
  AT[0] - x,
  AT[1] + TOP + over,
  AT[2] - z,
];

let game: Game;
let spec: BoardSpec;
const incidents: GameEvents['CircuitIncident'][] = [];
const board = () => [...game.circuits.all()].find((b) => b.entity.id === BOARD)!;
const aim = (point: Vec3) => {
  lookAt(game, point);
  game.update(H);
};
const middle = (edge: number): [number, number] => {
  const [a, b] = edgeNodes(spec, edge);
  const [ax, az] = nodeAt(spec, a);
  const [bx, bz] = nodeAt(spec, b);
  return [(ax + bx) / 2, (az + bz) / 2];
};
/** The part tried: the last one plugged in. */
const reading = () =>
  game.circuits.reading(board(), board().state.parts.length - 1, { volts: 0, amps: 0, watts: 0 });

function atBench(): void {
  placePlayer(game, [AT[0], 0, AT[2] - 0.75]);
  game.update(H);
}

/** The supply set on its panel, a 0.5 V step a press. */
function supply(volts: number): void {
  atBench();
  const [x0, z0, x1, z1] = spec.panel;
  aim(world([(x0 + x1) / 2, (z0 + z1) / 2]));
  for (let i = 0; i < 40 && board().state.volts < volts; i++)
    expect(game.interaction.perform(BOARD, 'raise-volts')).toBe(true);
  for (let i = 0; i < 40 && board().state.volts > volts; i++)
    expect(game.interaction.perform(BOARD, 'lower-volts')).toBe(true);
  expect(board().state.volts).toBe(volts);
}

/** A lead from node to node, by the player. */
function lead(from: number, to: number): void {
  aim(world(nodeAt(spec, from)));
  expect(game.interaction.perform(BOARD, 'lead')).toBe(true);
  aim(world(nodeAt(spec, to)));
  expect(game.interaction.perform(BOARD, 'lead')).toBe(true);
}

/** Aimed at a plugged-in part (its top) and an action done there. */
function onPart(action: string, edge = EDGE): void {
  aim(world(middle(edge), 0.03));
  expect(board().aim?.kind).toBe('part');
  expect(game.interaction.perform(BOARD, action)).toBe(true);
}

/** Taken from its shelf (aimed at from a step back), within reach. */
function take(id: string): void {
  const entity = game.world.entity(id);
  expect(entity, id).toBeDefined();
  const [x, y, z] = entity!.pose.position;
  placePlayer(game, [x, 0, STAND_Z]);
  game.update(H);
  aim([x, y, z]);
  expect(game.interaction.focused?.id, `${id} in view`).toBe(id);
  expect(game.interaction.grab(entity!), id).toBe(true);
  game.update(H);
}

/** Holding a part, plugged in on the edge aimed at: out of the hands and the world. */
function plug(edge = EDGE): void {
  const held = game.interaction.heldEntity;
  expect(held).not.toBeNull();
  const before = board().state.parts.length;
  atBench();
  aim(world(middle(edge)));
  expect(board().aim).toEqual({ kind: 'edge', edge });
  expect(game.interaction.perform(BOARD, 'plug-in')).toBe(true);
  expect(game.interaction.heldId).toBeNull();
  expect(game.world.entity(held!.id)).toBeUndefined();
  expect(board().state.parts).toHaveLength(before + 1);
}

/** Taken off the board into the hands, then handed back into the cabinet: on its shelf again. */
function handBack(id: string, edge = EDGE): void {
  onPart('take-off', edge);
  expect(game.interaction.heldId).toBe(id);
  const home = game.content.rooms.get(LAB).placements.find((p) => `${LAB}/${p.id}` === id)!;
  placePlayer(game, [home.position[0], 0, STAND_Z]);
  game.update(H);
  aim([home.position[0], 1.2, 7.46]); // its back, between the third shelf and the top one
  expect(game.interaction.focused?.id).toBe(CABINET);
  expect(game.interaction.perform(CABINET, 'return-part')).toBe(true);
  expect(game.interaction.heldId).toBeNull();
  expect(game.world.entity(id), id).toBeDefined();
}

/** The supply's voltage for each kind: within its ratings (a lamp at its own); a cell drives. */
function supplyFor(part: PartSpec): number {
  switch (part.kind) {
    case 'lamp':
      return part.volts ?? 1;
    case 'voltmeter':
      return 6;
    case 'cell':
      return 0;
    default:
      return 1;
  }
}

/**
 * Plugged in, worked and read against the loop worked by hand; `outside` is the resistance round
 * the loop outside the part (Ω).
 */
function check(part: PartSpec, outside: number): void {
  const v = supplyFor(part);
  plug();
  const r = reading();
  switch (part.kind) {
    case 'resistor':
    case 'fuse':
    case 'ammeter':
      // Ohm's law round a series loop: I = V / (R + R_outside).
      expect(r.amps).toBeCloseTo(v / ((part.ohms ?? 0) + outside), 9);
      if (part.kind === 'ammeter') {
        // Turned round, it reads the same current the other way (−).
        onPart('work');
        expect(reading().amps).toBeCloseTo(-v / ((part.ohms ?? 0) + outside), 9);
      }
      return;
    case 'voltmeter': {
      // A divider: V_m = V·R_m / (R_m + R_outside); turned round, −V_m.
      const rm = part.ohms ?? 1;
      expect(r.volts).toBeCloseTo((v * rm) / (rm + outside), 9);
      onPart('work');
      expect(reading().volts).toBeCloseTo((-v * rm) / (rm + outside), 9);
      return;
    }
    case 'lamp':
      // At its rated voltage: I·(R_lamp(v) + R_outside) = V, P = P_rated·(v/V_rated)^1.6.
      expect(r.amps * (lampOhms(v, part.watts ?? 1, r.volts) + outside)).toBeCloseTo(v, 6);
      expect(r.watts).toBeCloseTo((part.watts ?? 1) * Math.pow(r.volts / v, 1.6), 4);
      expect(r.volts).toBeGreaterThan(0.95 * v);
      return;
    case 'switch':
      // Plugged in open: no current. Closed: I = V / (R_contact + R_outside). Open again: none.
      expect(r.amps).toBe(0);
      onPart('work');
      expect(reading().amps).toBeCloseTo(v / (SWITCH_OHMS + outside), 9);
      onPart('work');
      expect(reading().amps).toBe(0);
      return;
    case 'rheostat': {
      // In at its whole track, then slid down five tenths and up one: I = V / (k·R + R_outside).
      const track = part.ohms ?? 1;
      expect(r.amps).toBeCloseTo(v / (track + outside), 9);
      for (let i = 0; i < 5; i++) onPart('work-down');
      expect(board().state.parts.at(-1)?.setting).toBe(0.5);
      expect(reading().amps).toBeCloseTo(
        v / (Math.max(RHEOSTAT_MIN_OHMS, 0.5 * track) + outside),
        9,
      );
      onPart('work');
      expect(reading().amps).toBeCloseTo(v / (0.6 * track + outside), 9);
      return;
    }
    case 'cell': {
      // The supply at 0 V is a 0.01 Ω path: I = E / (r + R_outside) out of its + terminal, and
      // its terminal voltage V = E − I·r.
      const e = part.volts ?? 0;
      const i = e / ((part.ohms ?? 0) + outside);
      expect(r.amps).toBeCloseTo(-i, 6);
      expect(r.volts).toBeCloseTo(e - i * (part.ohms ?? 0), 6);
      return;
    }
  }
}

const placements = (): Placement[] =>
  game.content.rooms
    .get(LAB)
    .placements.filter((p) => game.content.items.tryGet(p.item)?.circuit !== undefined);
const kindOf = (p: Placement) => game.content.items.get(p.item).circuit!;

describe('every part in the circuit cabinet', () => {
  beforeAll(async () => {
    ({ game } = await bootTestGame());
    await game.newGame('researcher-male');
    game.state.world.entityStates[CABINET] = { open: true };
    await game.scenes.load(LAB);
    for (let i = 0; i < 60; i++) game.update(H); // the parts settle on the shelves
    spec = game.world.entity(BOARD)?.item.circuitBoard as BoardSpec;
    game.events.subscribe('CircuitIncident', (e) => incidents.push(e));
  }, 60_000);

  it('places 38 parts of the eight kinds the circuit computes', () => {
    const kinds = new Set(placements().map((p) => kindOf(p).kind));
    expect(placements()).toHaveLength(38);
    expect([...kinds].sort()).toEqual(
      ['ammeter', 'cell', 'fuse', 'lamp', 'resistor', 'rheostat', 'switch', 'voltmeter'].sort(),
    );
  });

  it('takes, plugs in, works, reads and hands back each one', () => {
    const [a, b] = edgeNodes(spec, EDGE);
    const [, c] = edgeNodes(spec, SERIES_EDGE);
    // Alone across the supply: + → 21, 22 → −.
    atBench();
    lead(plusPost(spec), a);
    lead(b, minusPost(spec));
    const alone = placements().filter((p) => !LOW_OHMS.includes(kindOf(p).kind));
    for (const p of alone) {
      const id = `${LAB}/${p.id}`;
      supply(supplyFor(kindOf(p)));
      take(id);
      check(kindOf(p), LOOP);
      handBack(id);
    }

    // In series with the 10 Ω 5 W resistor (22–23): + → 21, 23 → −.
    supply(0);
    take(SERIES);
    plug(SERIES_EDGE);
    aim(world(nodeAt(spec, b)));
    expect(game.interaction.perform(BOARD, 'unlead')).toBe(true);
    lead(c, minusPost(spec));
    const outside = LOOP + (game.content.items.get('part-resistor-10-5w').circuit?.ohms ?? 0);
    for (const p of placements().filter((q) => LOW_OHMS.includes(kindOf(q).kind))) {
      const id = `${LAB}/${p.id}`;
      supply(supplyFor(kindOf(p)));
      take(id);
      check(kindOf(p), outside);
      handBack(id);
    }
    handBack(SERIES, SERIES_EDGE);
    // Used within their ratings: nothing smoked, failed or burnt.
    expect(incidents).toEqual([]);
  }, 120_000);
});
