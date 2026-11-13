import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../content';
import { createTexts } from '../../core/i18n';
import type { Game } from '../../game/Game';
import type { GameEvents } from '../../game/GameEvents';
import { bootTestGame, flush, placePlayer } from '../../game/testing';
import { MemorySaveStorage } from '../../persistence/SaveSystem';
import { resultClass } from '../../simulation/experiment';
import { microscopeModel } from '../../simulation/models/microscope';
import type { BenchView } from './StationSystem';

// The digital microscope in the Biology Lab's south-east corner (content: lab-placements.json),
// worked in its workspace as a player does: the microscope's action opens it, the onion slide is
// made step by step (spec 21) or a prepared slide is chosen and put on the stage, the objective and
// the fine focus are set, RUN ("Observe"), the record. The image is written out here from the
// optics of a school microscope (M = M_eye·M_obj, FOV = FN/M_obj, depth λ/NA²) and the stated
// sharpness curve and slide table, not taken from the model.

const H = 1 / 60;
const LAB = 'biology-lab';
const SCOPE = `${LAB}/digital-microscope`;
/** The station's fixed inputs (experiments/microscope.json): 10× eyepiece, FN 18 mm, green light. */
const EYEPIECE = 10;
const FN = 18_000; // µm
const LAMBDA = 0.55; // µm
const START = 100; // µm above the focal plane
const SPEED = 20; // µm/s
/** Numerical apertures of the DIN achromats on the nosepiece. */
const NA: Record<number, number> = { 4: 0.1, 10: 0.25, 40: 0.65 };
/** The slides' typical cell lengths (µm): onion, cheek, Elodea. */
const CELL = [250, 60, 80];
const ONION_STEPS = ['new-slide', 'specimen', 'stain', 'coverslip', 'stage'];
const NEW_SLIDE = 'Take a clean slide first.';
const STAGE = 'Put the slide on the microscope stage first.';

const depth = (objective: number) => LAMBDA / NA[objective]! ** 2;
const sharpness = (offset: number, objective: number) =>
  1 / (1 + ((2 * offset) / depth(objective)) ** 2);

const frames = (game: Game, seconds: number, dt = H) => {
  for (let i = 0; i < Math.round(seconds / dt); i++) game.update(dt);
};
const act = (game: Game, id: string, action: string) =>
  game.interaction.perform(`${LAB}/${id}`, action);
const view = (game: Game): BenchView => {
  const station = game.stations.view(SCOPE);
  if (station?.kind !== 'bench') throw new Error(`${SCOPE} is not a bench station`);
  return station;
};
const session = (game: Game) => view(game).session;
const send = (game: Game, command: Omit<GameEvents['ExperimentCommand'], 'stationId'>) =>
  game.events.publish('ExperimentCommand', { stationId: SCOPE, ...command });
const set = (game: Game, parameter: string, value: number) =>
  send(game, { command: 'set', parameter, value });
/** The step ids the station asks for now, in order. */
const steps = (game: Game) => view(game).setup.map((s) => s.step.id);
/** Does every before-run setup step the station lists and has not done, in order. */
const prepare = (game: Game) => {
  for (const { step, done } of view(game).setup) {
    if (step.phase === 'before-run' && !done) send(game, { command: 'setup', step: step.id });
  }
};
const runUntilDone = (game: Game, dt = 0.05) => {
  for (let i = 0; session(game).state === 'running' && i < 100_000; i++) game.update(dt);
};

/** New game, then the developer jump to the Biology Lab (setup only). */
async function lab(storage = new MemorySaveStorage()) {
  const booted = await bootTestGame({ content: bundledContent, storage });
  await booted.game.newGame('researcher-male');
  await booted.game.scenes.load(LAB);
  frames(booted.game, 1);
  const blocked: string[] = [];
  booted.game.events.subscribe('ActionBlocked', ({ reason }) => blocked.push(reason));
  return { ...booted, blocked };
}

describe('microscope station (Biology Lab)', () => {
  it('opens from the microscope; the onion slide is made step by step, RUN waits for the stage', async () => {
    const { game, blocked } = await lab();
    const v = view(game);
    expect(v.definition.id).toBe('microscope');
    expect(v.definition.presentation).toBe('microscopy');
    expect(v.model).toBe('digital-microscope');
    // Onion, iodine, 4×, 50 µm: spec 21's preparation applies to the onion only.
    expect(v.session.parameters).toEqual({ specimen: 0, stain: 1, objective: 4, focus: 50 });
    expect(game.entityStates.get(SCOPE, 'param.objective')).toBe(4);
    expect(steps(game)).toEqual(ONION_STEPS);
    expect(v.session.state).toBe('idle');
    expect(v.runBlock).toBe(NEW_SLIDE);
    expect(Object.keys(v.pose.sample)).toEqual([...microscopeModel.variables]);
    expect(Object.values(v.pose.sample).every(Number.isNaN)).toBe(true);
    expect(v.checklist.map((s) => s.done)).toEqual(Array(7).fill(false));

    // E at the microscope works at the bench (inspecting it is F); the player stands still.
    expect(game.interaction.primaryAction(SCOPE)?.id).toBe('open-workspace');
    expect(game.interaction.secondaryAction(SCOPE)?.id).toBe('inspect');
    expect(game.interaction.perform(SCOPE, 'open-workspace')).toBe(true);
    expect(game.workspace.openStation).toBe(SCOPE);
    expect(view(game).checklist[1]).toMatchObject({ done: true });
    game.input.press('moveForward');
    game.update(H);
    expect(game.state.player.moveIntent).toEqual([0, 0, 0]);
    game.input.release('moveForward');

    // RUN and a later step are refused with the step they wait for; nothing changes.
    send(game, { command: 'run' });
    send(game, { command: 'setup', step: 'stage' });
    expect(blocked).toEqual([NEW_SLIDE, NEW_SLIDE]);
    expect(session(game).state).toBe('idle');

    // The preparation, in order: methylene blue is the stain chosen at the bottles (a `set`), the
    // step adds it to the slide; the coverslip; the slide on the stage makes it ready.
    set(game, 'stain', 2);
    send(game, { command: 'setup', step: 'new-slide' });
    send(game, { command: 'setup', step: 'specimen' });
    send(game, { command: 'setup', step: 'stain' });
    expect(view(game).runBlock).toBe('Lower a coverslip onto the slide first.');
    send(game, { command: 'setup', step: 'coverslip' });
    expect(view(game).runBlock).toBe(STAGE);
    send(game, { command: 'setup', step: 'stage' });
    expect(view(game).setup.every((s) => s.done)).toBe(true);
    expect(view(game).session.state).toBe('configured');
    expect(view(game).runBlock).toBeNull();
    // The board not read; the bench worked at, the slide on the stage (a setup milestone).
    expect(view(game).checklist.map((s) => s.done)).toEqual([
      false,
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
    expect(game.entityStates.get(SCOPE, 'setup.stain')).toBe(true);
    expect(session(game).parameters.stain).toBe(2);

    // A new slide: the bench cleared, the preparation from its first step again.
    send(game, { command: 'clear' });
    expect(steps(game)).toEqual(ONION_STEPS);
    expect(view(game).runBlock).toBe(NEW_SLIDE);
    expect(game.workspace.close()).toBe(true);
  });

  it('puts the cheek cells and the Elodea leaf on the stage as prepared slides, with no preparation', async () => {
    const { game } = await lab();
    expect(game.interaction.perform(SCOPE, 'open-workspace')).toBe(true);
    set(game, 'specimen', 1); // cheek cells, chosen in the specimen library
    expect(steps(game)).toEqual(['stage']);
    expect(view(game).runBlock).toBe(STAGE);
    send(game, { command: 'setup', step: 'stage' });
    expect(view(game).session.state).toBe('configured');
    expect(view(game).runBlock).toBeNull();
    // The slide lies on the stage: another one waits until the bench is cleared.
    expect(game.stations.refusal(SCOPE, 'set', 'specimen', 2)).toMatch(/clear the bench/);
    set(game, 'specimen', 2);
    expect(session(game).parameters.specimen).toBe(1);
    send(game, { command: 'clear' });
    set(game, 'specimen', 2); // an Elodea leaf: also prepared
    expect(steps(game)).toEqual(['stage']);
    expect(view(game).runBlock).toBe(STAGE);
    // The onion asks for its steps again, whatever slide came before.
    set(game, 'specimen', 0);
    expect(steps(game)).toEqual(ONION_STEPS);
    expect(view(game).runBlock).toBe(NEW_SLIDE);
    // The stain of a prepared slide is left as it was: its protocol is not specified.
    expect(session(game).parameters.stain).toBe(1);
    // No illumination control: the lamp is an indicator, owning nothing.
    const { pieces } = view(game).definition.workspace!;
    expect(pieces.find((p) => p.kind === 'lamp-indicator')?.owns).toEqual([]);
    expect(pieces.flatMap((p) => p.owns).sort()).toEqual([
      'focus',
      'objective',
      'specimen',
      'stain',
    ]);
  });

  it('lets the stain of a prepared slide be chosen, and fixes it once an onion is stained', async () => {
    const { game } = await lab();
    expect(game.interaction.perform(SCOPE, 'open-workspace')).toBe(true);
    set(game, 'specimen', 1);
    set(game, 'stain', 2); // methylene blue on the cheek cells
    expect(session(game).parameters.stain).toBe(2);
    set(game, 'specimen', 0);
    for (const step of ['new-slide', 'specimen', 'stain']) send(game, { command: 'setup', step });
    expect(game.stations.refusal(SCOPE, 'set', 'stain', 0)).toMatch(/clear the bench/);
    set(game, 'stain', 0);
    set(game, 'specimen', 1); // the onion is made: no other slide until the bench is cleared
    expect(session(game).parameters).toMatchObject({ specimen: 0, stain: 2 });
    send(game, { command: 'clear' });
    set(game, 'stain', 0);
    expect(session(game).parameters.stain).toBe(0);
  });

  it('keeps the made slide and its locked stain in the save', async () => {
    const storage = new MemorySaveStorage();
    const { game } = await lab(storage);
    for (const step of ['new-slide', 'specimen', 'stain']) send(game, { command: 'setup', step });
    expect(game.save()?.ok).toBe(true);
    game.dispose();

    const { game: again } = await bootTestGame({ content: bundledContent, storage });
    expect((await again.continueGame()).ok).toBe(true);
    await flush();
    expect(
      view(again)
        .setup.filter((s) => s.done)
        .map((s) => s.step.id),
    ).toEqual(['new-slide', 'specimen', 'stain']);
    expect(again.stations.refusal(SCOPE, 'set', 'stain', 0)).toMatch(/clear the bench/);
  });

  it('focuses onion at 100×: the field, the count, the length, the record', async () => {
    const { game } = await lab();
    const completed: GameEvents['ExperimentCompleted'][] = [];
    game.events.subscribe('ExperimentCompleted', (e) => completed.push(e));
    expect(act(game, 'microscope-instructions', 'inspect')).toBe(true);
    expect(game.interaction.perform(SCOPE, 'open-workspace')).toBe(true);
    set(game, 'objective', 10);
    set(game, 'focus', 0);
    prepare(game);
    expect(session(game).parameters).toEqual({ specimen: 0, stain: 1, objective: 10, focus: 0 });
    send(game, { command: 'run' });
    const run = session(game).run!;
    expect(run.inputs).toEqual({
      eyepiece: EYEPIECE,
      fieldNumber: 18,
      wavelength: LAMBDA,
      focusStart: START,
      focusRate: SPEED,
      specimen: 0,
      stain: 1,
      objective: 10,
      focus: 0,
    });

    // The stage and the eyepiece field follow the fine focus, from the model's own values.
    const pose = view(game).pose;
    for (let i = 0; i < 120; i++) {
      game.update(H);
      if (session(game).state !== 'running') break;
      expect(pose.sample.offset).toBe(run.value('offset'));
      expect(pose.sample.offset).toBeCloseTo(START - SPEED * run.time, 9);
      expect(pose.sample.sharpness).toBeCloseTo(sharpness(pose.sample.offset!, 10), 12);
    }
    runUntilDone(game);
    expect(session(game).state).toBe('completed');
    expect(run.time).toBeCloseTo(START / SPEED, 9); // 5 s down to the focal plane

    const field = FN / 10; // 1800 µm
    const counted = Math.floor(field / CELL[0]!); // 7 whole onion cells across
    expect(completed).toHaveLength(1);
    const results = completed[0]!.results;
    expect(results.magnification).toBe(EYEPIECE * 10);
    expect(results.fieldOfView).toBeCloseTo(field, 9);
    expect(results.depthOfField).toBeCloseTo(depth(10), 12); // 8.8 µm
    expect(results.sharpness).toBe(1);
    expect(results.contrast).toBe(0.8);
    expect(results.cellsCounted).toBe(counted);
    expect(results.measuredLength).toBeCloseTo(field / counted, 9); // 257 µm against 250 µm
    expect(game.state.progression.completedExperiments).toEqual(['microscope']);

    const [record] = session(game).history;
    expect(record?.status).toBe('completed');
    expect(record?.results).toEqual(results);
    expect(record!.theory()!.cellsCountable).toBe(counted);
    expect(record!.theory()!.countableLength).toBe(CELL[0]);
    // Sharpness, contrast and count are named beside their numbers, in each language.
    const named = (id: string) => record!.definition.results.find((r) => r.id === id)!;
    const vi = createTexts({}, () => 'vi');
    expect(resultClass(named('sharpness'), results.sharpness!)).toBe('Sharp');
    expect(resultClass(named('contrast'), results.contrast!)).toBe('Clear');
    expect(resultClass(named('cellsCounted'), results.cellsCounted!)).toBe('Few: a rough length');
    expect(resultClass(named('sharpness'), results.sharpness!, vi)).toBe('Rõ nét');

    send(game, { command: 'view' });
    expect(view(game).checklist.every((s) => s.done)).toBe(true);
    send(game, { command: 'reset' });
    expect(session(game).state).toBe('configured'); // the slide stays on the stage
    expect(session(game).history).toHaveLength(1); // the record outlives the reset
  });

  it('counts nothing out of focus at 400× or on an unstained onion, and the theory agrees', async () => {
    const { game } = await lab();
    expect(game.interaction.perform(SCOPE, 'open-workspace')).toBe(true);
    set(game, 'objective', 40);
    set(game, 'focus', 2); // past the 1.3 µm depth of field
    prepare(game);
    send(game, { command: 'run' });
    runUntilDone(game);
    send(game, { command: 'reset' });
    // A new slide, this time with no stain: the stain is chosen before it is added.
    send(game, { command: 'clear' });
    set(game, 'objective', 4);
    set(game, 'focus', 0); // in focus
    set(game, 'stain', 0);
    prepare(game);
    send(game, { command: 'run' });
    runUntilDone(game);
    const [blurred, faint] = session(game).history;
    expect(blurred!.inputs.focus).toBe(2);
    expect(blurred!.results!.sharpness).toBeCloseTo(sharpness(2, 40), 12); // 0.096
    expect(blurred!.results!.sharpness).toBeLessThan(0.1);
    expect(faint!.results!.sharpness).toBe(1);
    expect(faint!.results!.contrast).toBe(0.15);
    for (const record of [blurred!, faint!]) {
      expect(record.results!.cellsCounted).toBe(0);
      expect(record.results!.measuredLength).toBe(0);
      expect(record.theory()!.cellsCountable).toBe(0); // 0 against 0, not a 100 % error
      expect(record.theory()!.countableLength).toBe(0);
    }
    const contrast = faint!.definition.results.find((r) => r.id === 'contrast')!;
    expect(resultClass(contrast, faint!.results!.contrast!)).toBe('Faint: stain it');
  });

  it('offers only its presets, refuses the rest, and the HUD follows it from the microscope', async () => {
    const { game, blocked } = await lab();
    const presets = (id: string) =>
      view(game)
        .definition.parameters.find((p) => p.id === id)!
        .presets.map((p) => p.value);
    const stops: Record<string, number[]> = {};
    for (const parameter of Object.keys(session(game).parameters)) {
      stops[parameter] = presets(parameter);
      for (const value of stops[parameter]) {
        expect(game.stations.refusal(SCOPE, 'set', parameter, value)).toBeNull();
        set(game, parameter, value);
        expect(session(game).parameters[parameter]).toBe(value);
      }
    }
    expect(stops).toEqual({
      specimen: [0, 1, 2],
      stain: [0, 1, 2],
      objective: [4, 10, 40],
      focus: [-100, -50, -20, -10, -5, -2, -1, 0, 1, 2, 5, 10, 20, 50, 100],
    });
    expect(blocked).toEqual([]);
    expect(game.stations.refusal(SCOPE, 'set', 'focus', 3)).toMatch(/cannot be set to 3 µm/);
    // The longest turn of the fine focus, from +100 to −100 µm, ends inside the run's 11 s.
    expect(200 / SPEED).toBeLessThan(view(game).definition.simulation.maxDuration);
    // Where the e2e specs stand at the microscope and its board (stationZones.test.ts): the old
    // points near the door were stale, and T-6b's pea cross now stands nearer them.
    for (const at of [
      [0.5, 0, 6.1], // the microscope
      [-1, 0, 6.4], // its board
    ] as const) {
      placePlayer(game, [...at]);
      expect(game.stations.activeStation()?.id).toBe(SCOPE);
    }
  });
});
