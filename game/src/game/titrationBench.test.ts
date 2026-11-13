import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../core/math';
import { bundledContent } from '../content';
import type { BenchView } from '../gameplay/experiment/StationSystem';
import { POUR_GAP } from '../gameplay/interaction/hold';
import { pointOf } from '../gameplay/lab/pour';
import { totalUl } from '../simulation/liquid';
import type { RunRecord } from '../simulation/RunRecord';
import { titrationModel } from '../simulation/models/titration';
import type { Game } from './Game';
import type { GameEvents } from './GameEvents';
import { bootTestGame, lookAt, placePlayer, untilIdle } from './testing';

// The shipped titration bench (Phase B, docs/phase-b-chemistry-contract.md), played by hand with the
// real game and real Rapier on the Chemistry Lab's west island: the burette into the stand's clamp,
// NaOH poured into its mouth, the HCl pipetted into the conical flask, the indicator's drops, the
// flask on the tile under the tip, the tap opened, closed at the colour change, the reading
// recorded (D1: the player ends the run). Every number is the model's, fed the volume that ran out.

const H = 1 / 60;
const LAB = 'chemistry-lab';
const at = (id: string) => `${LAB}/${id}`;
const STATION = at('titration');
/** In front of the west island, pressed against it: its front edge z −1.453 + capsule 0.3 + skin. */
const FRONT_Z = -1.143;
/** c_a, the definition's hidden initial condition: the test may know it, no surface may show it. */
const CA = 0.085;
const RATE = 0.25; // mL/s, the definition's flowRate

const frames = (game: Game, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / H); i++) game.update(H);
};
const ul = (game: Game, id: string) => totalUl(game.stations.container(at(id))?.contents ?? {});
const view = (game: Game): BenchView => {
  const v = game.stations.view(STATION);
  if (v?.kind !== 'bench') throw new Error('no bench station');
  return v;
};
const done = (game: Game, step: string) => game.entityStates.get(STATION, `setup.${step}`);
const centre = (game: Game, id: string): Vec3 => [...game.world.entity(at(id))!.pose.position];

async function lab() {
  const booted = await bootTestGame({ content: bundledContent });
  await booted.game.newGame('researcher-male');
  await booted.game.scenes.load(LAB);
  const blocked: string[] = [];
  booted.game.events.subscribe('ActionBlocked', ({ reason }) => blocked.push(reason));
  frames(booted.game, 1.5); // everything settles on the bench
  return { ...booted, blocked };
}

/** Stands at the island front (between the stools) and looks at the item. */
function face(game: Game, id: string): void {
  const [x, y, z] = centre(game, id);
  placePlayer(game, [Math.min(-5.414, Math.max(-6.014, x)), 0, FRONT_Z]);
  lookAt(game, [x, y, z]);
  game.update(H);
}

function take(game: Game, id: string): void {
  face(game, id);
  expect(game.interaction.focused?.id, `${id} in focus`).toBe(at(id));
  expect(game.interaction.perform(at(id), 'grab'), `${id} grabbed`).toBe(true);
  untilIdle(game); // off the floor: crouched to, taken once the hand is there
  // Lifted, as a player looks up after taking it: held at the hold distance, clear of the bench.
  game.state.player.pitch = -0.2;
  frames(game, 0.8);
}

/** Aims at an item and presses E (or F): it must be the item in focus. */
function use(game: Game, id: string, secondary = false): boolean {
  face(game, id);
  expect(game.interaction.focused?.id, `${id} in focus`).toBe(at(id));
  return game.interaction.interact(secondary);
}

/** Sets the held item down on the island at `spot`, from its front. */
function setDownAt(game: Game, spot: Readonly<Vec3>): boolean {
  placePlayer(game, [Math.min(-5.414, Math.max(-6.014, spot[0])), 0, FRONT_Z]);
  lookAt(game, spot);
  frames(game, 0.4);
  const ok = game.interaction.setDown();
  frames(game, 1.5);
  return ok;
}

/** A point of an entity, in the world. */
const worldOf = (game: Game, id: string, local: Readonly<Vec3>): Vec3 => {
  const e = game.world.entity(at(id))!;
  return pointOf(e.pose.position, e.pose.rotation, local, [0, 0, 0]);
};
const tileOf = (game: Game) =>
  worldOf(game, 'titration', game.world.entity(STATION)!.item.seats![0]!.center);

/** Where the burette stands on the floor to be filled: south of the island, clear of its stools. */
const FLOOR_SPOT: Vec3 = [-5.714, 0, -0.353];

/** The held burette stood upright on the floor (Phú: its mouth 0.6 m up, easy to pour into). */
function standOnFloor(game: Game): void {
  placePlayer(game, [FLOOR_SPOT[0], 0, FLOOR_SPOT[2] + 1.2]);
  lookAt(game, FLOOR_SPOT);
  frames(game, 0.4);
  expect(game.interaction.setDown(), 'stood on the floor').toBe(true);
  frames(game, 1.5);
}

/** The filled burette taken up again and clamped on the stand (E at the clamp). */
function clampBurette(game: Game): void {
  take(game, 'burette');
  face(game, 'titration');
  expect(game.interaction.perform(STATION, 'clamp'), 'clamped').toBe(true);
  frames(game, 0.3);
  expect(done(game, 'clamp')).toBe(true);
}

/** The burette's mouth (world), wherever it stands. */
const buretteMouth = (game: Game): Vec3 =>
  worldOf(game, 'burette', game.world.entity(at('burette'))!.item.container!.mouth!.center);

/**
 * Pours the held bottle into the burette's mouth (on the floor: 0.6 m up) as a player does: from
 * about half a metre, looking roughly at the mouth (8 cm aside), R held — the hand reaches the lip
 * over it (the pour assist), the player leaning in.
 */
function fillBurette(game: Game, bottle: string, seconds: number): void {
  const mouth = buretteMouth(game);
  placePlayer(game, [mouth[0] + 0.1, 0, mouth[2] + 0.45]);
  lookAt(game, [mouth[0] + 0.08, mouth[1], mouth[2]]);
  frames(game, 0.6);
  expect(game.interaction.heldId).toBe(at(bottle));
  game.input.press('pour');
  frames(game, seconds);
  game.input.release('pour');
  frames(game, 0.5);
}

/** The bench set up by hand, up to the flask on the tile under the tip. */
function setUp(
  game: Game,
  { naoh = 'naoh-01', pipette = 'titration-pipette-25', indicator = 'phenolphthalein' } = {},
  onTile = true,
) {
  take(game, 'burette');
  standOnFloor(game);
  take(game, naoh);
  fillBurette(game, naoh, 12);
  expect(setDownAt(game, [-6.614, 0.9, -2.053])).toBe(true);
  clampBurette(game);
  take(game, pipette);
  expect(use(game, 'hcl'), 'filled from the HCl').toBe(true);
  expect(use(game, 'conical-flask'), 'delivered').toBe(true);
  expect(setDownAt(game, [-5.514, 0.9, -2.153])).toBe(true);
  take(game, indicator);
  expect(use(game, 'conical-flask'), 'drops').toBe(true);
  expect(setDownAt(game, [-6.214, 0.9, -2.103])).toBe(true);
  if (!onTile) return;
  take(game, 'conical-flask');
  expect(setDownAt(game, tileOf(game))).toBe(true);
}

/** A completed run's record (fails the test otherwise). */
function completed(record: RunRecord | undefined) {
  if (record?.status !== 'completed') throw new Error(`no completed run: ${record?.status}`);
  return record;
}

/** The model's endpoint for the bench as set, with the hidden c_a the test may know. */
const endpointOf = (game: Game) =>
  titrationModel.predict!({
    ...view(game).session.parameters,
    acidConcentration: CA,
    kw: 1e-14,
    flowRate: RATE,
  }).endpointVolume!;

/** Runs with the tap open until V reaches `volume`, then closes it (E) and records (F). */
function titrateTo(game: Game, volume: number) {
  expect(use(game, 'titration'), 'tap opened').toBe(true);
  expect(game.stations.tapOpen(at('burette'))).toBe(true);
  for (let i = 0; i < 100_000 && (view(game).session.run?.value('volume') ?? 0) < volume; i++) {
    game.update(H);
  }
  expect(use(game, 'titration'), 'tap closed').toBe(true);
  expect(game.stations.tapOpen(at('burette'))).toBe(false);
  frames(game, 1);
  expect(view(game).session.state, 'still running: the reading is not recorded').toBe('running');
  // E opens the tap again (a few more drops); F records the reading.
  expect(use(game, 'titration', true), 'reading recorded').toBe(true);
  frames(game, 0.2);
  return view(game).session;
}

describe('the titration bench, shipped content (Phase B)', () => {
  it('is set up by hand in the definition’s order, each step by its own world action', async () => {
    const { game, blocked } = await lab();
    // Before the clamp, the tap cannot be opened, nor the burette filled.
    expect(game.entityStates.get(at('burette'), 'clamp') ?? '').toBe('');
    setUp(game);
    for (const step of ['fill-01', 'clamp', 'aspirate', 'dispense', 'indicator-pp', 'tile']) {
      expect([step, done(game, step)]).toEqual([step, true]);
    }
    expect(ul(game, 'burette')).toBe(50_000); // to its 0 mark
    expect(ul(game, 'conical-flask')).toBe(25_000 + 150); // the sample and three drops
    expect(view(game).session.parameters).toMatchObject({
      acidVolume: 25,
      baseConcentration: 0.1,
      endpointPH: 8.2,
    });
    // The burette hangs in the clamp, its tip over the flask on the tile.
    const tip = worldOf(
      game,
      'burette',
      game.world.entity(at('burette'))!.item.container!.tap!.tip,
    );
    const mouth = worldOf(
      game,
      'conical-flask',
      game.world.entity(at('conical-flask'))!.item.container!.mouth!.center,
    );
    expect(Math.hypot(tip[0] - mouth[0], tip[2] - mouth[2])).toBeLessThan(0.01);
    expect(tip[1] - mouth[1]).toBeGreaterThan(0.005);
    expect(tip[1] - mouth[1]).toBeLessThan(0.05);
    // Pouring on at the mark is refused with its reason, and nothing else was.
    expect(new Set(blocked)).toEqual(new Set(['It is full to the mark.']));
  });

  it('closed at the colour change: V_end is the model’s endpoint, to within two ticks of flow', async () => {
    const { game } = await lab();
    setUp(game);
    const end = endpointOf(game);
    const session = titrateTo(game, end);
    expect(session.state).toBe('completed');
    const record = completed(session.history.at(-1));
    expect(record.endReason).toBe('player');
    const vEnd = record.results['endpoint-volume']!;
    // Closed in the frame after it is reached, plus the frame the aim at the stand takes: 2 ticks.
    expect(vEnd).toBeGreaterThanOrEqual(end);
    expect(vEnd - end).toBeLessThan(2 * RATE * H + 1e-9);
    // What ran out of the burette is what the model was fed.
    expect(50_000 - ul(game, 'burette')).toBe(Math.round(vEnd * 1000));
    expect(ul(game, 'conical-flask')).toBe(25_150 + Math.round(vEnd * 1000));
    const ca = record.results['acid-concentration']!;
    expect(ca).toBeCloseTo((0.1 * vEnd) / 25, 12);
  });

  it('overshot by the player: a larger reading, a pH past the endpoint, nothing adjusted', async () => {
    const { game } = await lab();
    setUp(game);
    const end = endpointOf(game);
    const record = completed(titrateTo(game, end + 1).history.at(-1));
    const vEnd = record.results['endpoint-volume']!;
    const pH = record.results['endpoint-pH']!;
    expect(vEnd).toBeGreaterThan(end + 1 - 1e-9);
    expect(pH).toBeGreaterThan(10); // well past phenolphthalein's 8.2
  });

  it('refuses the tap before the flask is under it, and the burette out of the clamp mid-run', async () => {
    const { game, blocked } = await lab();
    setUp(game, {}, false); // filled and clamped, the flask not yet under the tip
    const before = blocked.length;
    expect(use(game, 'titration')).toBe(false); // E: open the tap, refused
    expect(blocked.length).toBe(before + 1);
    take(game, 'conical-flask');
    expect(setDownAt(game, tileOf(game))).toBe(true);
    expect(use(game, 'titration'), 'tap opened').toBe(true);
    frames(game, 1);
    expect(use(game, 'titration', true)).toBe(false); // F: out of the clamp, refused mid-run
    expect(blocked.at(-1)).toBe('Wait until the run has finished.');
  });

  it('keeps c_a off every surface: contents, states and the save hold no acid concentration', async () => {
    const { game } = await lab();
    setUp(game);
    const world = JSON.stringify(game.state.world);
    expect(world).not.toContain('acidConcentration');
    expect(world).not.toMatch(/[":,]0\.085[,}\]]/);
    for (const id of ['hcl', 'conical-flask', 'titration-pipette-25']) {
      const text = `${game.texts.of(game.world.entity(at(id))!.item, 'displayName')} ${game.texts.of(game.world.entity(at(id))!.item, 'description')}`;
      expect(text).not.toMatch(/0[.,]085/);
    }
  });

  it('clears the bench: the burette out of the clamp and home, the glass refilled as placed', async () => {
    const { game } = await lab();
    setUp(game);
    face(game, 'titration-clear');
    expect(game.interaction.perform(at('titration-clear'), 'clear')).toBe(true);
    frames(game, 1);
    expect(game.entityStates.get(at('burette'), 'clamp')).toBe('');
    expect(ul(game, 'burette')).toBe(0);
    expect(ul(game, 'conical-flask')).toBe(0);
    expect(done(game, 'clamp')).toBe(false);
  });
});

describe('the Chemistry Lab’s guided tasks, step by step (Phase B)', () => {
  it('leads the heating curve through each setting the player makes, to its results', async () => {
    const { game } = await lab();
    const HEAT = at('heating');
    const step = () => game.tasks.active?.step.id;
    expect(game.tasks.start('heating-curve')).toBe(true);
    expect(game.interaction.perform(at('heating-instructions'), 'inspect')).toBe(true);
    const set = (parameter: string, value: number) =>
      game.events.publish('ExperimentCommand', {
        stationId: HEAT,
        command: 'set',
        parameter,
        value,
      });
    expect(step()).toBe('mass');
    set('mass', 0.05);
    expect(step()).toBe('start-temperature');
    set('startTemperature', -20);
    expect(step()).toBe('power');
    set('power', 800);
    expect(step()).toBe('run');
    game.events.publish('ExperimentCommand', { stationId: HEAT, command: 'run' });
    for (let i = 0; i < 60 * 120 && step() === 'run'; i++) game.update(H);
    expect(step()).toBe('results');
    game.events.publish('ExperimentCommand', { stationId: HEAT, command: 'view' });
    expect(game.tasks.isDone('heating-curve')).toBe(true);
  });

  it('leads the reaction rate through its workspace’s own setup, to its results', async () => {
    const { game } = await lab();
    const RATE_ID = at('kinetics');
    const step = () => game.tasks.active?.step.id;
    const send = (command: Omit<GameEvents['ExperimentCommand'], 'stationId'>) =>
      game.events.publish('ExperimentCommand', { stationId: RATE_ID, ...command });
    expect(game.tasks.start('reaction-rate')).toBe(true);
    expect(game.interaction.perform(at('kinetics-instructions'), 'inspect')).toBe(true);
    expect(step()).toBe('temperature');
    send({ command: 'set', parameter: 'temperature', value: 35 });
    expect(step()).toBe('dye');
    send({ command: 'setup', step: 'dye-10' });
    expect(step()).toBe('naoh');
    send({ command: 'setup', step: 'naoh-020' });
    expect(step()).toBe('cuvette');
    send({ command: 'setup', step: 'cuvette' });
    expect(step()).toBe('run');
    send({ command: 'run' });
    for (let i = 0; i < 60 * 600 && step() === 'run'; i++) game.update(H);
    expect(step()).toBe('results');
    send({ command: 'view' });
    expect(game.tasks.isDone('reaction-rate')).toBe(true);
  });

  it('outlines an object for every step of every task, each one placed in its lab', async () => {
    const { game } = await lab();
    const tasks = game.tasks.offered(LAB);
    expect(tasks.length).toBeGreaterThanOrEqual(6);
    for (const task of tasks) {
      for (const s of task.steps) {
        expect([task.id, s.id, s.objects.length > 0]).toEqual([task.id, s.id, true]);
        for (const id of s.objects) {
          expect([task.id, s.id, id, game.world.entity(at(id)) !== undefined]).toEqual([
            task.id,
            s.id,
            id,
            true,
          ]);
        }
      }
    }
  });
});

describe('the burette filled on the floor (Phú: the clamp was too high to pour into)', () => {
  it('stands on the floor, its mouth 0.6 m up; clamped only once filled, at its working height', async () => {
    const { game, blocked } = await lab();
    const mouthY = () =>
      worldOf(game, 'burette', game.world.entity(at('burette'))!.item.container!.mouth!.center)[1];
    take(game, 'burette');
    // Clamping it empty: refused with the fill's own reason.
    face(game, 'titration');
    expect(game.interaction.perform(STATION, 'clamp')).toBe(false);
    expect(blocked.at(-1)).toMatch(/NaOH/);
    standOnFloor(game);
    expect(mouthY()).toBeCloseTo(0.6, 2); // upright on the floor (a 0.6 m burette)
    take(game, 'naoh-01');
    fillBurette(game, 'naoh-01', 12);
    expect(ul(game, 'burette')).toBe(50_000);
    expect(setDownAt(game, [-6.614, 0.9, -2.053])).toBe(true);
    clampBurette(game);
    expect(mouthY()).toBeCloseTo(0.9 + 0.38 + 0.1 + 0.3, 3); // the clamp's one height: tip over the tile
    // The clamp no longer slides.
    expect(game.interaction.perform(STATION, 'raise-clamp')).toBe(false);
    expect(game.interaction.perform(STATION, 'lower-clamp')).toBe(false);
  });
});

describe('the pour assist (Phú: the hand reaches to pour, no aiming to the centimetre)', () => {
  it('fills the burette where it stands on the bench, from the bench front: no floor needed', async () => {
    const { game, blocked } = await lab();
    const mouth = buretteMouth(game);
    expect(mouth[2]).toBeGreaterThan(-1.453 - 0.3); // a quarter metre in from the island’s front edge (z −1.453)
    take(game, 'naoh-01');
    // In front of it at the bench (where the stools let the player stand), then looking at it.
    placePlayer(game, [mouth[0], 0, FRONT_Z]);
    frames(game, 0.5);
    lookAt(game, mouth);
    frames(game, 0.6);
    game.input.press('pour');
    frames(game, 12);
    game.input.release('pour');
    frames(game, 0.5);
    expect(ul(game, 'burette')).toBe(50_000);
    expect(blocked).toEqual(['It is full to the mark.']); // held on past the mark: stopped there
    expect(done(game, 'fill-01')).toBe(true);
  });

  it('takes the lip over a mouth near the view and leans in; looking away, it stays in hand', async () => {
    const { game } = await lab();
    take(game, 'burette');
    standOnFloor(game);
    take(game, 'naoh-01');
    const mouth = buretteMouth(game);
    // Looking well aside of the mouth: tipped in the hand where it is held, nothing poured.
    placePlayer(game, [mouth[0] + 0.1, 0, mouth[2] + 0.45]);
    lookAt(game, [mouth[0] + 0.5, mouth[1] + 0.3, mouth[2]]);
    frames(game, 0.6);
    game.input.press('pour');
    frames(game, 1.5);
    expect(game.interaction.pourGoal).toBeNull();
    expect(ul(game, 'burette')).toBe(0);
    game.input.release('pour');
    frames(game, 0.6);
    // Looking roughly at it: the lip goes POUR_GAP over the mouth, the eye leans towards it.
    lookAt(game, [mouth[0] + 0.08, mouth[1], mouth[2]]);
    frames(game, 0.4);
    game.input.press('pour');
    frames(game, 1.5);
    const goal = game.interaction.pourGoal!;
    const now = buretteMouth(game); // where it stands (Rapier's float32 poses)
    const want = [now[0], now[1] + POUR_GAP, now[2]];
    for (let i = 0; i < 3; i++) expect(goal[i]).toBeCloseTo(want[i]!, 6);
    expect(Math.hypot(now[0] - mouth[0], now[2] - mouth[2])).toBeLessThan(0.002); // not pushed
    const bottle = game.world.entity(at('naoh-01'))!;
    const lip = pointOf(
      bottle.pose.position,
      bottle.pose.rotation,
      bottle.item.container!.pour!.spout,
      [0, 0, 0],
    );
    expect(Math.hypot(lip[0] - goal[0], lip[1] - goal[1], lip[2] - goal[2])).toBeLessThan(0.01);
    expect(ul(game, 'burette')).toBeGreaterThan(0);
    expect(game.state.player.lean).toBeGreaterThan(0.25);
    game.input.release('pour');
    frames(game, 1);
    expect(game.interaction.pourGoal).toBeNull(); // back to the hold
  });
});
