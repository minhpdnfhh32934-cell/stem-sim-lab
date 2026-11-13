import { describe, expect, it } from 'vitest';
import type { Quat, Vec3 } from '../core/math';
import { bundledContent } from '../content';
import type { BenchView } from '../gameplay/experiment/StationSystem';
import { holdPitch, holdReach, tiltOf } from '../gameplay/interaction/hold';
import { pointOf } from '../gameplay/lab/pour';
import { totalUl } from '../simulation/liquid';
import type { Game } from './Game';
import { bootTestGame, lookAt, placePlayer } from './testing';

// The shipped dilution slice (src/content: experiments/dilution.json, the dil-* items, the reagent
// cabinet and the chemistry lab's main bench), played by hand with the real game and real Rapier —
// the same steps the player takes (docs/physical-lab-architecture.md §3.3) and the same aiming
// arithmetic e2e/physical-lab.spec.ts uses: the player presses against the bench front, the
// glassware is held at the hold distance, the nozzle or the lip is put over the mouth by the view
// direction alone. Rapier uses 32-bit floats: poses are compared to the millimetre.

const H = 1 / 60;
const LAB = 'chemistry-lab';
const at = (id: string) => `${LAB}/${id}`;
const STATION = at('dilution');
const CABINET = at('reagent-cabinet');
/** In front of the main bench, pressed against it: its front edge z −7.179 + capsule 0.3 + skin 0.01. */
const BENCH_Z = -6.869;
/** Where the cabinet is used from (it faces south since Phase L): clear of its doors' swing. */
const CABINET_Z = -9.5;
const TILE: Vec3 = [-0.6, 0.906, -7.459];
const SPOT = {
  bottle: [0.15, 0.9, -7.429],
  pipette: [0.4, 0.9, -7.379],
  wash: [-0.1, 0.9, -7.379],
  flask: [0.15, 0.9, -7.279],
} as const satisfies Record<string, Vec3>;
/** The glass the cabinet holds (placement ids). */
const GLASS = [
  'stock-5',
  'stock-10',
  'stock-20',
  'stock-40',
  'wash-bottle',
  'flask-25',
  'flask-50',
  'flask-100',
  'flask-250',
  'pipette-1',
  'pipette-2',
  'pipette-5',
  'pipette-10',
];

const frames = (game: Game, seconds: number, each?: () => void) => {
  for (let i = 0; i < Math.round(seconds / H); i++) {
    game.update(H);
    each?.();
  }
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
  frames(booted.game, 1.5); // everything settles on its shelf
  return { ...booted, blocked };
}

/** Stands where the item is used from (cabinet side for the shelves, the bench front) and looks at it. */
function face(game: Game, id: string): void {
  const [x, , z] = centre(game, id);
  const onBench = game.world.entity(at(id))!.pose.position[2] > -9;
  placePlayer(
    game,
    onBench ? [x, 0, BENCH_Z] : [Math.min(3.786, Math.max(2.786, x)), 0, CABINET_Z],
  );
  lookAt(game, [x, centre(game, id)[1], z]);
  game.update(H);
}

function take(game: Game, id: string): void {
  const fromCabinet = game.world.entity(at(id))!.pose.position[2] <= -9;
  face(game, id);
  expect(game.interaction.focused?.id, `${id} in focus`).toBe(at(id));
  expect(game.interaction.perform(at(id), 'grab'), `${id} grabbed`).toBe(true);
  frames(game, 0.5);
  if (!fromCabinet) return;
  // Carried round the bench's east end to its front, as a player walks it (Phase U-2: the cabinet
  // 2.6 m behind the bench; carried straight across, the glass caught on the apparatus).
  for (const z of [-8.6, -6.6]) {
    placePlayer(game, [2.4, 0, z], Math.PI);
    frames(game, 0.6);
  }
}

/** Aims at an item and presses E (or F): what the player does; it must be the item in focus. */
function use(game: Game, id: string, secondary = false): void {
  face(game, id);
  expect(game.interaction.focused?.id, `${id} in focus`).toBe(at(id));
  expect(game.interaction.interact(secondary), `${id} used`).toBe(true);
}

/** Aims at a bench spot from the bench front and sets the held item down there. */
function setDownAt(game: Game, spot: Readonly<Vec3>): boolean {
  placePlayer(game, [spot[0], 0, BENCH_Z]);
  lookAt(game, spot);
  // Carried round from the cabinet's side (2.6 m behind since Phase U-2): it catches up first.
  frames(game, 1);
  const ok = game.interaction.setDown();
  frames(game, 1.5);
  return ok;
}

/** The mouth of an item, in the world. */
const mouthOf = (game: Game, id: string): Vec3 => {
  const e = game.world.entity(at(id))!;
  return pointOf(e.pose.position, e.pose.rotation, e.item.container!.mouth!.center, [0, 0, 0]);
};

/**
 * Puts the held item's spout `above` m over `target` by the view direction alone, the player at
 * `x` in front of the bench. The hold point is `holdReach` along the view: the height wanted fixes
 * the pitch, and the player stands back from the target by the hold's range (at most pressed
 * against the bench). `reach` is how far the spout is in front of the held centre and `up` its
 * height above it. Returns the spout's height above the target (m).
 */
function aimOver(
  game: Game,
  x: number,
  target: Readonly<Vec3>,
  reach: number,
  up: number,
  above = 0.25,
): number {
  const d = game.config.player.holdDistance;
  const p = game.state.player;
  const pitch = holdPitch(target[1] + above - up - p.eyeHeight, d);
  if (pitch === null) throw new Error('the spout cannot be held that high');
  const range = holdReach(pitch, d) * Math.cos(pitch) + reach;
  const z = target[2] + Math.sqrt(range * range - (target[0] - x) ** 2);
  expect(z, 'standing in front of the bench').toBeGreaterThanOrEqual(BENCH_Z - 0.001);
  placePlayer(game, [x, 0, z]);
  Object.assign(p, { yaw: Math.atan2(-(target[0] - x), -(target[2] - z)), pitch });
  frames(game, 2);
  return p.eyeHeight + holdReach(pitch, d) * Math.sin(pitch) + up - target[1];
}

/** Takes the flask from its shelf and stands it on the tile. */
function flaskOnTile(game: Game, flask: string): void {
  take(game, flask);
  expect(setDownAt(game, TILE)).toBe(true);
  const p = centre(game, flask);
  expect(Math.hypot(p[0] - TILE[0], p[2] - TILE[2])).toBeLessThan(0.002);
  expect(game.entityStates.get(at(flask), 'seat')).toBe(at('dilution-tile') + '/tile');
}

/** Opens the cabinet from where it is used. */
function openCabinet(game: Game): void {
  placePlayer(game, [3.286, 0, CABINET_Z]);
  lookAt(game, centre(game, 'reagent-cabinet'));
  game.update(H);
  expect(game.interaction.perform(CABINET, 'open')).toBe(true);
  frames(game, 1);
  expect(game.hinges.fraction(CABINET)).toBe(1);
}

/** One dilution by hand, from the open cabinet to the reading; returns the finished session. */
function dilute(game: Game, stock: string, pipette: string, flask: string, dx = 0) {
  take(game, stock);
  expect(setDownAt(game, SPOT.bottle)).toBe(true);
  flaskOnTile(game, flask);
  take(game, pipette);
  use(game, stock); // E: fill the pipette to its mark
  use(game, flask); // E: deliver it
  expect(setDownAt(game, SPOT.pipette)).toBe(true);
  take(game, 'wash-bottle');
  const mouth = mouthOf(game, flask);
  // The nozzle's tip: held ahead of the view (PhysicsSystem.grab), `ahead` in front of the centre.
  const [, up, ahead] = game.world.entity(at('wash-bottle'))!.item.container!.pour!.spout;
  const height = aimOver(game, TILE[0] + dx, mouth, -ahead, up);
  expect(height, 'the nozzle over the lip').toBeGreaterThan(0.2);
  expect(height).toBeLessThan(0.5);
  game.input.press('pour');
  frames(game, 40);
  game.input.release('pour');
  frames(game, 0.2);
  expect(setDownAt(game, SPOT.wash)).toBe(true);
  return view(game).session;
}

describe('the dilution slice, shipped content', () => {
  it('holds its glass on the cabinet’s shelves, behind doors that open to every piece', async () => {
    const { game } = await lab();
    // On the shelves, where placed, at rest.
    for (const id of GLASS) {
      const entity = game.world.entity(at(id))!;
      const base = entity.pose.position[1] - entity.item.visual.size[1] / 2;
      expect([id, base > 0.09 && base < 1.43]).toEqual([id, true]);
      expect(game.physics.body(at(id))?.sleeping, `${id} asleep`).toBe(true);
    }
    // Shut, the doors hide every piece from the front.
    for (const id of GLASS) {
      face(game, id);
      expect(game.interaction.focused?.id).not.toBe(at(id));
    }
    openCabinet(game);
    // Open, each piece is the target of the view that aims at it.
    for (const id of GLASS) {
      face(game, id);
      expect(game.interaction.focused?.id, id).toBe(at(id));
    }
  });

  it('stops a player walking into the bench 0.59 m from the tile’s centre and 0.65 m from the cuvette', async () => {
    const { game } = await lab();
    placePlayer(game, [-0.4, 0, -6.479]);
    game.input.press('moveForward');
    frames(game, 2);
    game.input.release('moveForward');
    frames(game, 0.2);
    expect(game.state.player.position[2]).toBeCloseTo(BENCH_Z, 2);
    expect(BENCH_Z - TILE[2]).toBeCloseTo(0.59, 2);
    expect(BENCH_Z - mouthOf(game, 'dilution')[2]).toBeCloseTo(0.65, 2);
  });

  it('dilutes by hand: 20 µmol/L, 5 mL into 50 mL; the reading is C₁V₁/V₂; clearing restocks', async () => {
    const { game, blocked } = await lab();
    openCabinet(game);
    expect(blocked).toEqual([]);
    const session = dilute(game, 'stock-20', 'pipette-5', 'flask-50');
    expect(blocked).toContain('It is full to the mark.');
    expect(session.state).toBe('completed');
    expect(session.run?.endReason).toBe('model');
    expect(session.run?.inputs).toMatchObject({
      stockConcentration: 2e-5,
      stockVolume: 5,
      finalVolume: 50,
    });
    expect(game.stations.container(at('flask-50'))?.contents).toEqual({
      'stock-20': 5000,
      water: 45_000,
    });
    expect([ul(game, 'stock-20'), ul(game, 'wash-bottle'), ul(game, 'pipette-5')]).toEqual([
      145_000, 455_000, 0,
    ]);
    const theory = session.predict();
    expect(session.run?.results?.finalConcentration).toBe(theory?.finalConcentration);
    expect(theory?.finalConcentration).toBeCloseTo((2e-5 * 5) / 50, 18);

    // The wrong receiver, and the sample before the mix, are refused with their reasons.
    expect(game.stations.pourRefusal(at('wash-bottle'), at('stock-20'))).toBe(
      'That is not part of this experiment.',
    );
    expect(game.stations.pourRefusal(at('flask-50'), STATION)).toBe(
      'Stopper the flask and turn it over to mix it first.',
    );

    // Stopper, turn it over, take the stopper out: mixed, no number changes.
    const results = { ...session.run?.results };
    const flask = at('flask-50');
    use(game, 'flask-50', true); // F: the stopper
    take(game, 'flask-50');
    game.input.press('pour');
    frames(game, 1.4);
    game.input.release('pour');
    frames(game, 1.4);
    expect(game.stations.container(flask)).toMatchObject({ closed: true, mixed: true });
    expect(done(game, 'mix')).toBe(true);
    expect(session.run?.results).toEqual(results);
    expect(setDownAt(game, TILE)).toBe(true);
    use(game, 'flask-50', true); // F: take it out

    // A sample into the cuvette: the flask tilted over it by the view alone.
    take(game, 'flask-50');
    const cuvette = mouthOf(game, 'dilution');
    const half = game.world.entity(flask)!.item.visual.size[1] / 2; // the lip, tipped to 115°
    const turn = (115 * Math.PI) / 180;
    const height = aimOver(
      game,
      cuvette[0],
      cuvette,
      half * Math.sin(turn),
      half * Math.cos(turn),
      0.15,
    );
    expect(height, 'the lip over the cuvette').toBeGreaterThan(0.1);
    expect(height).toBeLessThan(0.5);
    game.input.press('pour');
    frames(game, 2);
    game.input.release('pour');
    frames(game, 0.5);
    const sample = game.stations.container(STATION)?.contents ?? {};
    expect(totalUl(sample)).toBeGreaterThan(0);
    expect(Object.keys(sample).sort()).toEqual(['stock-20', 'water']);
    expect(done(game, 'cuvette')).toBe(true);
    expect(setDownAt(game, TILE)).toBe(true);

    // Clear the bench: everything back where it was, full again, the setup and the run gone.
    const placed = GLASS.map((id) => [id, centre(game, id)] as const);
    expect(placed.length).toBe(13);
    placePlayer(game, [0.7, 0, BENCH_Z]);
    lookAt(game, centre(game, 'dilution-clear'));
    game.update(H);
    expect(game.interaction.perform(at('dilution-clear'), 'clear')).toBe(true);
    frames(game, 1);
    expect(view(game).session.run).toBeNull();
    expect([ul(game, 'stock-20'), ul(game, 'wash-bottle'), ul(game, 'flask-50')]).toEqual([
      150_000, 500_000, 0,
    ]);
    for (const step of ['flask', 'aspirate', 'dispense', 'mix', 'cuvette']) {
      expect(done(game, step)).toBe(false);
    }
  });

  it('follows the dilution as a guided task to its end, changing nothing it measures (Phase A)', async () => {
    const { game } = await lab();
    const step = () => game.tasks.active?.step.id;
    expect(game.tasks.offered(LAB).map((t) => t.id)).toEqual([
      'dilution-by-hand',
      'chemistry-glassware',
      'chemistry-lights',
      'titration-by-hand',
      'heating-curve',
      'reaction-rate',
    ]);
    const started: number[] = [];
    game.events.subscribe('TaskStarted', ({ step: at }) => started.push(at));
    expect(game.tasks.start('dilution-by-hand')).toBe(true);
    expect([step(), started]).toEqual(['open-cabinet', [0]]);
    expect(game.tasks.active?.objects).toEqual([CABINET]);
    openCabinet(game);
    expect(step()).toBe('take-stock');
    const session = dilute(game, 'stock-20', 'pipette-5', 'flask-50');
    expect(step()).toBe('mix'); // every step up to the mark followed the world
    // The rest by hand, as the slice test does it: stopper, turn over, sample, read.
    use(game, 'flask-50', true);
    take(game, 'flask-50');
    game.input.press('pour');
    frames(game, 1.4);
    game.input.release('pour');
    frames(game, 1.4);
    expect(step()).toBe('sample');
    expect(setDownAt(game, TILE)).toBe(true);
    use(game, 'flask-50', true);
    take(game, 'flask-50');
    const cuvette = mouthOf(game, 'dilution');
    const half = game.world.entity(at('flask-50'))!.item.visual.size[1] / 2;
    const turn = (115 * Math.PI) / 180;
    aimOver(game, cuvette[0], cuvette, half * Math.sin(turn), half * Math.cos(turn), 0.15);
    game.input.press('pour');
    frames(game, 2);
    game.input.release('pour');
    frames(game, 0.5);
    expect(step()).toBe('read');
    game.events.publish('ExperimentCommand', { stationId: STATION, command: 'view' }); // the monitor's E
    expect(game.tasks.active).toBeNull();
    expect(game.tasks.isDone('dilution-by-hand')).toBe(true);
    expect(game.state.progression.tasks).toEqual({ active: null, done: ['dilution-by-hand'] });
    expect(session.run?.results?.finalConcentration).toBe(session.predict()?.finalConcentration);
  });

  it('waits on its step when the world refuses, and lets the player cancel (Phase A)', async () => {
    const { game, blocked } = await lab();
    game.tasks.start('dilution-by-hand');
    openCabinet(game);
    take(game, 'wash-bottle'); // not the step's object: the task stays where it was
    expect(game.tasks.active?.step.id).toBe('take-stock');
    expect(setDownAt(game, SPOT.wash)).toBe(true);
    take(game, 'stock-20');
    expect(game.tasks.active?.step.id).toBe('bottle-down');
    // A refused set-down (the bench's front face is not level) publishes no set-down: it waits.
    expect(setDownAt(game, [0.2, 0.45, -7.179])).toBe(false);
    expect(blocked.length).toBeGreaterThan(0);
    expect(game.tasks.active?.step.id).toBe('bottle-down');
    // Saved with the game (v5): a Continue comes back to this step.
    expect(game.saves.capture().progression.tasks).toEqual({
      active: { id: 'dilution-by-hand', step: 2 },
      done: [],
    });
    game.tasks.cancel();
    expect(game.tasks.active).toBeNull();
    expect(game.state.progression.tasks).toEqual({ active: null, done: [] });
  });

  it('leads the player on the floor to the step’s object, and stops when the task does (A5)', async () => {
    const { game } = await lab();
    placePlayer(game, [0, 0, 3]); // by the door
    game.tasks.start('dilution-by-hand');
    frames(game, 0.3);
    const { path, objects } = game.taskGuide;
    expect(objects).toEqual([CABINET]);
    expect(path.length).toBeGreaterThanOrEqual(4); // at least one leg
    expect(Math.hypot((path[0] ?? 0) - 0, (path[1] ?? 0) - 3)).toBeLessThan(0.3); // from the player
    const cabinet = centre(game, 'reagent-cabinet');
    const [ex, ez] = [path.at(-2) ?? 0, path.at(-1) ?? 0];
    expect(Math.hypot(ex - cabinet[0], ez - cabinet[2])).toBeLessThan(1.2); // to stand by the cabinet
    game.tasks.cancel();
    frames(game, 0.3);
    expect([game.taskGuide.path, game.taskGuide.objects]).toEqual([[], []]);
  });

  it('the light switch task: off, then on again', async () => {
    const { game, logs } = await lab();
    // The panel reads the task on each step's event: the last one leaves none, not a lost step.
    const seen: (string | undefined)[] = [];
    game.events.subscribe('TaskStepCompleted', () => seen.push(game.tasks.active?.step.id));
    game.tasks.start('chemistry-lights');
    expect(game.interaction.perform(at('light-switch'), 'lights-off')).toBe(true);
    expect(game.tasks.active?.step.id).toBe('on');
    expect(game.interaction.perform(at('light-switch'), 'lights-on')).toBe(true);
    expect(game.tasks.isDone('chemistry-lights')).toBe(true);
    expect(seen).toEqual(['on', undefined]);
    expect(logs.filter((l) => l.message.includes('not in the content'))).toEqual([]);
  });

  it('names exactly what the held glass can act on now (Phase A contract A1)', async () => {
    const { game } = await lab();
    openCabinet(game);
    const targets = () => {
      game.update(H);
      return game.heldTargets.ids;
    };
    expect(targets()).toEqual([]); // nothing held
    take(game, 'stock-20');
    expect(setDownAt(game, SPOT.bottle)).toBe(true);
    take(game, 'flask-50');
    expect(targets()).toContain(at('dilution-tile')); // its seat, the step that comes next
    expect(setDownAt(game, TILE)).toBe(true);
    take(game, 'pipette-5');
    expect(targets()).toContain(at('stock-20')); // fill from the stock
    expect(targets()).not.toContain(at('flask-50')); // empty: nothing to deliver yet
    use(game, 'stock-20');
    expect(targets()).toContain(at('flask-50')); // deliver
    expect(targets()).not.toContain(at('stock-20')); // already full to its mark
    use(game, 'flask-50');
    expect(setDownAt(game, SPOT.pipette)).toBe(true);
    take(game, 'wash-bottle');
    expect(targets()).toContain(at('flask-50'));
    expect(targets()).not.toContain(at('stock-20')); // refused: not part of this experiment
    // Every vessel named for a pour is one the pour rule accepts now.
    for (const id of targets()) {
      if (game.world.entity(id)?.item.container?.mouth) {
        expect(game.stations.pourBlock(at('wash-bottle'), id), id).toBeNull();
      }
    }
  });

  it('has one dial, the colorimeter’s resolution; the glassware chosen sets the rest', async () => {
    const { game } = await lab();
    expect(view(game).session.parameters.concentrationResolution).toBe(1e-7);
    expect(game.interaction.perform(at('dilution-dial-resolution'), 'raise')).toBe(true);
    expect(view(game).session.parameters.concentrationResolution).toBe(1e-6);
    for (const parameter of ['stockConcentration', 'stockVolume', 'finalVolume']) {
      expect(game.stations.refusal(STATION, 'set', parameter, 0)).toBe(
        'Do this with the apparatus itself.',
      );
    }
    expect(game.stations.refusal(STATION, 'run')).toBe('Stand the flask on the white tile first.');
  });

  it('keeps glass cleared mid set-down at home: the set-down does not pull it back', async () => {
    const { game } = await lab();
    openCabinet(game);
    const home = centre(game, 'flask-50');
    take(game, 'flask-50');
    placePlayer(game, [SPOT.flask[0], 0, BENCH_Z]);
    lookAt(game, SPOT.flask);
    frames(game, 0.4);
    expect(game.interaction.setDown()).toBe(true);
    game.update(H); // still settling onto the bench
    placePlayer(game, [0.7, 0, BENCH_Z]);
    lookAt(game, centre(game, 'dilution-clear'));
    game.update(H);
    expect(game.interaction.perform(at('dilution-clear'), 'clear')).toBe(true);
    frames(game, 2);
    const end = centre(game, 'flask-50');
    expect(Math.hypot(end[0] - home[0], end[1] - home[1], end[2] - home[2])).toBeLessThan(0.01);
    expect(game.physics.body(at('flask-50'))?.driven).toBe(false);
  });

  it('stands up glass saved tipped, rather than locking it on its side', async () => {
    const { game } = await lab();
    const s = Math.SQRT1_2;
    const tipped = { position: [0.15, 0.95, -7.379] as Vec3, rotation: [s, 0, 0, s] as Quat };
    await game.scenes.load('physics-lab');
    game.state.world.objects[at('flask-50')] = tipped; // as a save or a scene keep records it
    await game.scenes.load(LAB);
    frames(game, 6);
    expect(tiltOf(game.world.entity(at('flask-50'))!.pose.rotation)).toBeLessThan(0.035); // < 2°
  });

  it('runs again with other glassware: 40 µmol/L, 10 mL into 25 mL (the darkest setting)', async () => {
    const { game } = await lab();
    openCabinet(game);
    const session = dilute(game, 'stock-40', 'pipette-10', 'flask-25', -0.3); // 0.3 m off to the side
    expect(session.state).toBe('completed');
    expect(session.run?.inputs).toMatchObject({
      stockConcentration: 4e-5,
      stockVolume: 10,
      finalVolume: 25,
    });
    expect(game.stations.container(at('flask-25'))?.contents).toEqual({
      'stock-40': 10_000,
      water: 15_000,
    });
    expect(session.run?.results?.finalConcentration).toBe(session.predict()?.finalConcentration);
  });
});
