import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../core/math';
import type { Game } from '../../game/Game';
import type { GameEvents } from '../../game/GameEvents';
import { bundledContent } from '../../content';
import { onBench, physicalLabFixture } from '../../game/physicalLabFixture';
import { bootTestGame, lookAt, placePlayer } from '../../game/testing';
import { MemorySaveStorage } from '../../persistence/SaveSystem';
import { totalUl } from '../../simulation/liquid';
import type { BenchView } from '../experiment/StationSystem';
import { holdPitch, holdReach } from '../interaction/hold';
import { pointOf } from './pour';

// The physical lab end to end with the real game and real Rapier, on a fixture (no dilution
// content exists yet: game/physicalLabFixture.ts puts a `physical-lab` dilution station on the
// Physics Lab bench, with the shipped `chemistry.dilution` model). The player's hands are the
// real ones (grab, set down, the held `pour` input); fills and deliveries go through the actions
// a player presses. Rapier uses 32-bit floats: poses are compared to the millimetre.

const H = 1 / 60;
const LAB = 'physics-lab';
const at = (id: string) => `${LAB}/${id}`;
const COLORIMETER = at('dl-colorimeter');
const FLASK = at('dl-flask');
const PIPETTE = at('dl-pipette');
const STOCK = at('dl-stock');
const WASH = at('dl-wash');
const TILE: Vec3 = onBench([2, 0.91, 0.22]);
/** Where the player stands in front of the bench (z). */
const FRONT_Z = onBench([0, 0, 1.0])[2];
const NOT_PART = 'That is not part of this experiment.';
const TILE_FIRST = 'Stand the flask on the white tile first.';

/** The parts of a save's JSON these tests read or tamper with. */
interface SavedJson {
  version: number;
  world: {
    containers: Record<string, { contents: Record<string, number> }>;
    objects: Record<string, { position: number[]; rotation: number[] }>;
  };
}

const frames = (game: Game, seconds: number, each?: () => void) => {
  for (let i = 0; i < Math.round(seconds / H); i++) {
    game.update(H);
    each?.();
  }
};
const ul = (game: Game, id: string) => totalUl(game.stations.container(id)?.contents ?? {});
const view = (game: Game): BenchView => {
  const v = game.stations.view(COLORIMETER);
  if (v?.kind !== 'bench') throw new Error('no bench station');
  return v;
};
const done = (game: Game, step: string) => game.entityStates.get(COLORIMETER, `setup.${step}`);

async function lab(storage = new MemorySaveStorage()) {
  const booted = await bootTestGame({ storage, content: physicalLabFixture(bundledContent) });
  await booted.game.newGame('researcher-male');
  await booted.game.scenes.load(LAB);
  frames(booted.game, 1.5); // everything settles on the bench
  return watch(booted);
}

function watch<T extends { game: Game }>(booted: T) {
  const blocked: string[] = [];
  const poured: GameEvents['LiquidPoured'][] = [];
  booted.game.events.subscribe('ActionBlocked', ({ reason }) => blocked.push(reason));
  booted.game.events.subscribe('LiquidPoured', (e) => poured.push(e));
  return { ...booted, blocked, poured };
}

/** Stands in front of the bench, looks at the item and takes it (the `grab` action). */
function take(game: Game, id: string): void {
  const pose = game.world.entity(id)!.pose.position;
  placePlayer(game, [pose[0], 0, FRONT_Z]);
  lookAt(game, pose);
  game.update(H);
  expect(game.interaction.perform(id, 'grab')).toBe(true);
  frames(game, 0.5);
}

/** Aims at a spot on the bench (or a seat) and sets the held item down there; true if it went. */
function setDownAt(game: Game, spot: Readonly<Vec3>): boolean {
  placePlayer(game, [spot[0], 0, FRONT_Z]);
  lookAt(game, spot);
  frames(game, 0.4);
  const ok = game.interaction.setDown();
  frames(game, 1.5);
  return ok;
}

/**
 * Holds the held item so that the point `local` of it (its spout) is straight above `target`,
 * `gap` m higher (the wash bottle's bottom clear of the receiver): the player stands back along −z at the hold distance and looks at the hold
 * point (the held body follows it upright). Returns the spout's horizontal miss (m).
 */
function holdOver(game: Game, local: Readonly<Vec3>, target: Readonly<Vec3>, gap = 0.25): number {
  const held = game.interaction.heldEntity!;
  const p = game.state.player;
  const centre: Vec3 = [target[0] - local[0], target[1] + gap - local[1], target[2] - local[2]];
  const d = game.config.player.holdDistance;
  const pitch = holdPitch(centre[1] - p.eyeHeight, d);
  if (pitch === null) throw new Error('out of the hold’s reach');
  placePlayer(game, [centre[0], 0, centre[2] + holdReach(pitch, d) * Math.cos(pitch)], 0, pitch);
  frames(game, 1.2);
  const spout = pointOf(held.pose.position, held.pose.rotation, local, [0, 0, 0]);
  return Math.hypot(spout[0] - target[0], spout[2] - target[2]);
}

/** The flask's mouth (world), wherever it stands. */
const mouthOf = (game: Game, id: string): Vec3 => {
  const e = game.world.entity(id)!;
  return pointOf(e.pose.position, e.pose.rotation, e.item.container!.mouth!.center, [0, 0, 0]);
};

/** Flask on the tile, stock pipetted into it: ready for water. */
function prepare(game: Game): void {
  take(game, FLASK);
  expect(setDownAt(game, TILE)).toBe(true);
  take(game, PIPETTE);
  expect(game.interaction.perform(STOCK, 'fill')).toBe(true);
  expect(game.interaction.perform(FLASK, 'deliver')).toBe(true);
  expect(setDownAt(game, onBench([1.5, 0.9, 0.15]))).toBe(true);
}

/** Holds the wash bottle's nozzle over the flask's mouth. */
function washOverFlask(game: Game): void {
  take(game, WASH);
  expect(holdOver(game, [0, 0.1, 0], mouthOf(game, FLASK))).toBeLessThan(0.01);
}

describe('physical lab (fixture): binding and the closed bus', () => {
  it('binds each container to its station, filled as placed, nothing in the bus', async () => {
    const { game, blocked } = await lab();
    expect(view(game).definition.presentation).toBe('physical-lab');
    expect(game.stations.container(STOCK)).toEqual({
      contents: { 'stock-20': 125_000 },
      temperatureC: 20,
      closed: false,
      mixed: false,
    });
    expect(ul(game, WASH)).toBe(500_000);
    expect(ul(game, FLASK)).toBe(0);
    expect(ul(game, COLORIMETER)).toBe(0); // the cuvette: a receiver on the static apparatus
    for (const command of ['setup', 'set'] as const) {
      game.events.publish('ExperimentCommand', {
        stationId: COLORIMETER,
        command,
        step: 'flask',
        parameter: 'finalVolume',
        value: 100,
      });
    }
    expect(blocked).toEqual([
      'Do this with the apparatus itself.',
      'Do this with the apparatus itself.',
    ]);
    expect(done(game, 'flask')).toBe(false);
    expect(view(game).session.parameters.finalVolume).toBe(50);
  });
});

describe('physical lab (fixture): the dilution by hand', () => {
  it('sets down, pipettes, fills to the mark as a driven run, inverts, samples and clears', async () => {
    const { game, blocked, poured } = await lab();

    // Pipetting first is allowed; delivering waits for the flask on the tile.
    take(game, PIPETTE);
    expect(game.interaction.perform(STOCK, 'fill')).toBe(true);
    // Acted out (Phase H-3): the left hand steadies the bottle, the player leans in; the pipette
    // stays in the right hand.
    expect(game.actions.current?.sequence.id).toBe('pipette-fill');
    expect(game.actions.busy).toBe(true);
    frames(game, 0.35);
    // At least the sequence's own lean; more to bring the bottle within an arm's length.
    expect(game.actions.lean).toBeGreaterThanOrEqual(0.25 - 1e-6);
    expect(game.interaction.heldId).toBe(PIPETTE);
    expect([ul(game, STOCK), ul(game, PIPETTE)]).toEqual([120_000, 5000]);
    expect(done(game, 'aspirate')).toBe(true);
    expect(view(game).session.parameters).toMatchObject({
      stockConcentration: 2e-5,
      stockVolume: 5,
    });
    expect(game.interaction.perform(FLASK, 'deliver')).toBe(false);
    expect(blocked.at(-1)).toBe(TILE_FIRST);
    expect([ul(game, PIPETTE), ul(game, FLASK)]).toEqual([5000, 0]);
    expect(setDownAt(game, onBench([1.5, 0.9, 0.15]))).toBe(true);

    take(game, FLASK);
    expect(setDownAt(game, TILE)).toBe(true);
    const flaskAt = game.world.entity(FLASK)!.pose.position;
    expect(Math.hypot(flaskAt[0] - TILE[0], flaskAt[2] - TILE[2])).toBeLessThan(0.002);
    expect(game.entityStates.get(FLASK, 'seat')).toBe(`${COLORIMETER}/tile`);
    expect(done(game, 'flask')).toBe(true);

    take(game, PIPETTE);
    expect(game.interaction.perform(FLASK, 'deliver')).toBe(true);
    expect(game.stations.container(FLASK)?.contents).toEqual({ 'stock-20': 5000 });
    expect(ul(game, PIPETTE)).toBe(0);
    expect(done(game, 'dispense')).toBe(true);
    expect(setDownAt(game, onBench([1.5, 0.9, 0.15]))).toBe(true);
    expect(view(game).session.state).toBe('configured');
    expect(game.stations.refusal(COLORIMETER, 'run')).toBe(
      'This run starts when you add the first drop by hand.',
    );

    // Water: the first accepted µL starts the run; every step moves exactly what it takes.
    washOverFlask(game);
    let started = false;
    let steps = 0;
    const check = () => {
      const [w, f] = [ul(game, WASH), ul(game, FLASK)];
      expect(w + f).toBe(500_000 + 5000);
      if (f > 5000 && !started) {
        started = true;
        expect(view(game).session.run?.inputs).toMatchObject({
          stockConcentration: 2e-5,
          stockVolume: 5,
          finalVolume: 50,
        });
      }
      steps++;
    };
    game.input.press('pour');
    frames(game, 1, check);
    expect(started).toBe(true);
    expect(view(game).session.state).toBe('running');
    const midway = ul(game, FLASK);
    expect(midway).toBeGreaterThan(5000);
    // A pause longer than the definition's maxDuration (12 s) neither ends nor fails it.
    game.input.release('pour');
    frames(game, 13, check);
    expect(view(game).session.state).toBe('running');
    expect(ul(game, FLASK)).toBe(midway);
    expect(poured).toEqual([{ from: WASH, to: FLASK, volumeUl: midway - 5000 }]);
    expect(holdOver(game, [0, 0.1, 0], mouthOf(game, FLASK))).toBeLessThan(0.01);
    game.input.press('pour');
    frames(game, 4, check);
    game.input.release('pour');
    frames(game, 0.2, check);
    expect(steps).toBeGreaterThan(1000);
    expect(ul(game, FLASK)).toBe(50_000);
    expect(ul(game, WASH)).toBe(455_000);
    expect(blocked).toContain('It is full to the mark.');
    const session = view(game).session;
    expect(session.state).toBe('completed');
    expect(session.run?.endReason).toBe('model');
    const theory = session.predict();
    expect(session.run?.results?.finalConcentration).toBe(theory?.finalConcentration);
    expect(game.stations.container(FLASK)?.contents).toEqual({ 'stock-20': 5000, water: 45_000 });
    expect(setDownAt(game, onBench([1.35, 0.9, -0.25]))).toBe(true);

    // Before mixing, the sample may not go into the cuvette; after the inversion it may.
    expect(game.stations.pourRefusal(FLASK, COLORIMETER)).toBe(
      'Stopper and invert the flask first.',
    );
    placePlayer(game, onBench([2, 0, 1.0]));
    lookAt(game, mouthOf(game, FLASK));
    game.update(H);
    expect(game.interaction.perform(FLASK, 'stopper')).toBe(true);
    expect(game.stations.container(FLASK)?.closed).toBe(true);
    const results = { ...session.run?.results };
    take(game, FLASK);
    expect(game.entityStates.get(FLASK, 'seat')).toBe(''); // picked up: off its seat
    game.input.press('pour'); // closed: it turns over instead of pouring
    frames(game, 1.2);
    game.input.release('pour');
    frames(game, 1.2);
    expect(game.stations.container(FLASK)).toMatchObject({ closed: true, mixed: true });
    expect(done(game, 'mix')).toBe(true);
    expect(ul(game, FLASK)).toBe(50_000);
    expect(session.run?.results).toEqual(results); // mixing changes no number
    expect(setDownAt(game, TILE)).toBe(true);
    placePlayer(game, onBench([2, 0, 1.0]));
    lookAt(game, mouthOf(game, FLASK));
    game.update(H);
    expect(game.interaction.perform(FLASK, 'unstopper')).toBe(true);
    // The cuvette pour, committed as LiquidSystem commits a tilt pour over its mouth.
    expect(game.stations.pourRefusal(FLASK, COLORIMETER)).toBeNull();
    expect(game.stations.transfer(FLASK, COLORIMETER, 2000)).toBe(2000);
    expect(game.stations.transfer(FLASK, COLORIMETER, 2000)).toBe(1000); // its 3 mL brim
    expect(game.stations.container(COLORIMETER)?.contents).toEqual({
      'stock-20': 300,
      water: 2700,
    });
    expect(ul(game, FLASK)).toBe(47_000);
    expect(done(game, 'cuvette')).toBe(true);

    // Clear the bench: restocked, back where placed, the setup and the run gone.
    expect(game.interaction.perform(at('dl-clear'), 'clear')).toBe(true);
    frames(game, 0.5);
    expect(view(game).session.run).toBeNull();
    for (const step of ['flask', 'aspirate', 'dispense', 'mix', 'cuvette']) {
      expect(done(game, step)).toBe(false);
    }
    expect([ul(game, STOCK), ul(game, WASH), ul(game, FLASK), ul(game, COLORIMETER)]).toEqual([
      125_000, 500_000, 0, 0,
    ]);
    expect(game.entityStates.get(FLASK, 'seat')).toBe('');
    const home = game.world.entity(FLASK)!.pose.position;
    const spot = onBench([1.65, 0, 0.15]);
    expect(Math.hypot(home[0] - spot[0], home[2] - spot[2])).toBeLessThan(0.001);
  });

  it('refuses water before the setup, into a non-receiver piece, and adds nothing', async () => {
    const { game, blocked } = await lab();
    washOverFlask(game); // the flask still where it was placed
    game.input.press('pour');
    frames(game, 1);
    game.input.release('pour');
    frames(game, 0.1);
    expect(blocked).toEqual([TILE_FIRST]); // once for the pair, though held a second
    expect([ul(game, WASH), ul(game, FLASK)]).toEqual([500_000, 0]);
    expect(view(game).session.run).toBeNull();
    // Water into the stock bottle is no step of this experiment.
    expect(holdOver(game, [0, 0.1, 0], mouthOf(game, STOCK))).toBeLessThan(0.01);
    game.input.press('pour');
    frames(game, 1);
    expect(blocked).toEqual([TILE_FIRST, NOT_PART]);
    expect([ul(game, WASH), ul(game, STOCK)]).toEqual([500_000, 125_000]);
  });

  it('refuses a full pipette, a stoppered flask and an inversion before the run', async () => {
    const { game, blocked } = await lab();
    take(game, FLASK);
    expect(setDownAt(game, TILE)).toBe(true);
    placePlayer(game, onBench([2, 0, 1.0]));
    lookAt(game, mouthOf(game, FLASK));
    game.update(H);
    expect(game.interaction.perform(FLASK, 'stopper')).toBe(true);
    take(game, PIPETTE);
    expect(game.interaction.perform(STOCK, 'fill')).toBe(true);
    game.events.publish('ContainerRequested', { entityId: STOCK, action: 'fill' });
    expect(blocked.at(-1)).toBe('Empty the pipette first.');
    expect(game.interaction.perform(FLASK, 'deliver')).toBe(false);
    expect(blocked.at(-1)).toBe('Take the stopper or cap off first.');
    expect([ul(game, STOCK), ul(game, PIPETTE), ul(game, FLASK)]).toEqual([120_000, 5000, 0]);
    expect(setDownAt(game, onBench([1.5, 0.9, 0.15]))).toBe(true);
    // Turned over before any run: refused with what it waits for, nothing marked.
    take(game, FLASK);
    game.input.press('pour');
    frames(game, 1.2);
    game.input.release('pour');
    frames(game, 1.2);
    expect(blocked.at(-1)).toBe('Deliver the stock into the flask first.');
    expect(game.stations.container(FLASK)?.mixed).toBe(false);
    expect(done(game, 'mix')).toBe(false);
  });

  it('refuses water into a flask knocked off (or taken off) its tile with the tile step’s reason', async () => {
    const { game } = await lab();
    prepare(game);
    expect(game.stations.pourRefusal(WASH, FLASK)).toBeNull();
    take(game, FLASK); // off its seat
    expect(setDownAt(game, onBench([1.7, 0.9, 0.15]))).toBe(true);
    expect(game.entityStates.get(FLASK, 'seat')).toBe('');
    expect(game.stations.pourRefusal(WASH, FLASK)).toBe(TILE_FIRST);
    expect(game.stations.transfer(WASH, FLASK, 1000)).toBe(0);
    expect(view(game).session.run).toBeNull();
  });
});

describe('physical lab (fixture): frame rates', () => {
  it('conserves every µL at 30, 60 and 300 Hz and pours alike, within one frame of flow', async () => {
    const totals: number[] = [];
    for (const hz of [30, 60, 300]) {
      const { game } = await lab();
      prepare(game);
      washOverFlask(game);
      game.input.press('pour');
      for (let i = 0; i < hz; i++) {
        game.update(1 / hz); // one second of squeezing
        expect(ul(game, WASH) + ul(game, FLASK)).toBe(505_000);
      }
      totals.push(ul(game, FLASK) - 5000);
    }
    // 20 mL/s for 1 s; the slowest frame (1/30 s) of flow is 667 µL.
    for (const total of totals) expect(Math.abs(total - (totals[1] ?? 0))).toBeLessThanOrEqual(667);
    expect(totals[1]).toBeGreaterThan(15_000);
  });
});

describe('physical lab (fixture): saves (v4)', () => {
  it('continues a mid-fill save: contents and poses as left, no run, recovery by clearing', async () => {
    const storage = new MemorySaveStorage();
    const first = await lab(storage);
    prepare(first.game);
    washOverFlask(first.game);
    first.game.input.press('pour');
    frames(first.game, 0.5);
    first.game.input.release('pour');
    expect(setDownAt(first.game, onBench([1.35, 0.9, -0.25]))).toBe(true);
    expect(first.game.interaction.perform(FLASK, 'grab')).toBe(false); // the run's vessel stays
    expect(first.blocked.at(-1)).toBe('Wait until the run has finished.');
    const contents = structuredClone(first.game.state.world.containers);
    const poses = [FLASK, PIPETTE, WASH, STOCK].map((id) => [
      ...first.game.world.entity(id)!.pose.position,
    ]);
    const states = structuredClone(first.game.state.world.entityStates[COLORIMETER]);
    expect(first.game.save()?.ok).toBe(true);
    const saved = JSON.parse(storage.read('simlab.save.slot-1') ?? '{}') as SavedJson;
    expect(saved.version).toBe(11); // v11 keeps v4's containers and poses (and v7's tasks)
    expect(saved.world.containers[FLASK]?.contents['stock-20']).toBe(5000);
    expect(Object.keys(saved.world.objects).sort()).toEqual([FLASK, PIPETTE, STOCK, WASH].sort());
    expect(JSON.stringify(saved.world.containers)).not.toMatch(/concentration/i);
    first.game.dispose();

    const second = watch(
      await bootTestGame({ storage, content: physicalLabFixture(bundledContent) }),
    );
    expect((await second.game.continueGame()).ok).toBe(true);
    frames(second.game, 0.5);
    const { game, blocked } = second;
    expect(game.state.world.containers).toEqual(contents);
    expect(ul(game, FLASK)).toBeGreaterThan(5000);
    [FLASK, PIPETTE, WASH, STOCK].forEach((id, i) => {
      const p = game.world.entity(id)!.pose.position;
      const q = poses[i]!;
      expect(Math.hypot(p[0] - q[0]!, p[1] - q[1]!, p[2] - q[2]!)).toBeLessThan(0.001);
    });
    expect(game.state.world.entityStates[COLORIMETER]).toMatchObject({
      'setup.flask': true,
      'setup.aspirate': true,
      'setup.dispense': true,
    });
    expect(states).toMatchObject({ 'setup.dispense': true });
    expect(view(game).session.run).toBeNull();
    const restart = 'What is in it was not added in a run: clear the bench to start again.';
    expect(game.stations.pourRefusal(WASH, FLASK)).toBe(restart);
    expect(game.stations.refusal(COLORIMETER, 'reset')).toBe('There is no run to reset.');
    game.events.publish('ExperimentCommand', { stationId: COLORIMETER, command: 'clear' });
    frames(game, 0.5);
    expect([ul(game, FLASK), ul(game, WASH), ul(game, STOCK)]).toEqual([0, 500_000, 125_000]);
    // A new run is possible again from the start.
    prepare(game);
    washOverFlask(game);
    game.input.press('pour');
    frames(game, 0.3);
    expect(view(game).session.state).toBe('running');
    expect(blocked).not.toContain(restart);
  });

  it('continues a save made after the run: the flask full, after-run steps to do again', async () => {
    const storage = new MemorySaveStorage();
    const first = await lab(storage);
    prepare(first.game);
    washOverFlask(first.game);
    first.game.input.press('pour');
    frames(first.game, 3);
    first.game.input.release('pour');
    expect(view(first.game).session.state).toBe('completed');
    expect(first.game.save()?.ok).toBe(true);
    first.game.dispose();

    const { game } = watch(
      await bootTestGame({ storage, content: physicalLabFixture(bundledContent) }),
    );
    expect((await game.continueGame()).ok).toBe(true);
    frames(game, 0.5);
    expect(game.stations.container(FLASK)?.contents).toEqual({ 'stock-20': 5000, water: 45_000 });
    expect(view(game).session.run).toBeNull();
    expect(game.stations.pourRefusal(WASH, FLASK)).toBe('It is full to the mark.');
    expect(done(game, 'mix')).toBe(false);
  });

  it('puts a moved container back where it was left when its scene comes back', async () => {
    const { game } = await lab();
    take(game, PIPETTE);
    expect(setDownAt(game, onBench([0.9, 0.9, 0.2]))).toBe(true);
    const left = [...game.world.entity(PIPETTE)!.pose.position];
    await game.scenes.load('simlab-hub');
    frames(game, 0.2);
    await game.scenes.load(LAB);
    frames(game, 0.5);
    const back = game.world.entity(PIPETTE)!.pose.position;
    expect(Math.hypot(back[0] - left[0]!, back[1] - left[1]!, back[2] - left[2]!)).toBeLessThan(
      0.002,
    );
    expect(game.world.entity(at('steel-ball'))!.pose.position[0]).toBeCloseTo(
      onBench([1.1, 0, 0])[0],
      2,
    );
  });

  it('sanitizes a tampered v4 save, one warning each, the rest kept', async () => {
    const storage = new MemorySaveStorage();
    const first = await lab(storage);
    expect(first.game.save()?.ok).toBe(true);
    first.game.dispose();
    const key = 'simlab.save.slot-1';
    const data = JSON.parse(storage.read(key) ?? '{}') as SavedJson;
    data.world.containers[STOCK] = { ...data.world.containers[STOCK], contents: { acid: 1000 } };
    data.world.containers[FLASK] = { ...data.world.containers[FLASK], contents: { water: 61_000 } };
    data.world.containers[PIPETTE] = {
      ...data.world.containers[PIPETTE],
      contents: { water: 3000 },
    };
    data.world.objects[WASH] = { position: [40, 0.9, 0], rotation: [0, 0, 0, 1] };
    data.world.objects[PIPETTE] = { position: [1.5, 0.9, 0.15], rotation: [0, 0, 0, 2] };
    storage.write(key, JSON.stringify(data));
    const { game, logs } = await bootTestGame({
      storage,
      content: physicalLabFixture(bundledContent),
    });
    expect((await game.continueGame()).ok).toBe(true);
    frames(game, 0.2);
    const warnings = logs.filter((l) => l.level === 'warn' && l.channel.endsWith('Containers'));
    expect(warnings.map((w) => w.message).sort()).toEqual(
      [
        `Saved container "${WASH}" stands outside its room: it starts from its placement`,
        `Saved container "${PIPETTE}" has no valid rotation: it starts from its placement`,
        `Saved container "${STOCK}" holds "acid", not a material of its experiment: it starts from its placement`,
        `Saved container "${FLASK}" holds more than its mark or brim: it starts from its placement`,
        `Saved container "${PIPETTE}" is a measured pipette neither empty nor full: it starts from its placement`,
      ].sort(),
    );
    expect(ul(game, STOCK)).toBe(125_000);
    expect(ul(game, FLASK)).toBe(0);
    expect(ul(game, PIPETTE)).toBe(0);
    expect(ul(game, WASH)).toBe(500_000);
  });
});
