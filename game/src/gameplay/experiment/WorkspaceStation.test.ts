import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../content';
import type { Game } from '../../game/Game';
import type { GameEvents } from '../../game/GameEvents';
import { bootTestGame, flush, withTitrationRig } from '../../game/testing';
import { MemorySaveStorage } from '../../persistence/SaveSystem';
import type { BenchView } from './StationSystem';

// The workspace contract at a real station: the Chemistry Lab's titration stand given another
// workspace here only (test data, not the shipped one) — its setup gate, `set`, `setup`, `clear`, `refusal`,
// opening and closing the workspace, and setup kept in the save as configuration.

const H = 1 / 60;
const LAB = 'chemistry-lab';
const STAND = `${LAB}/titration`;
const CLAMP = 'Clamp the burette on the stand first.';
const FLASK = 'Put the flask under the burette first.';

const WORKSPACE = {
  pieces: [
    {
      id: 'burette',
      kind: 'burette',
      slot: 'stand',
      label: 'Burette',
      vi: { label: 'Buret' },
      owns: ['baseConcentration', 'resolution'],
      shows: [{ variable: 'volume' }, { instrument: 'endpoint-volume' }],
    },
    {
      id: 'flask',
      kind: 'conical-flask',
      slot: 'bench',
      label: 'Conical flask',
      owns: ['acidVolume', 'endpointPH'],
      shows: [{ variable: 'pH' }, { parameter: 'acidVolume' }, { input: 'flowRate' }],
    },
    { id: 'stand', kind: 'retort-stand', slot: 'bench', label: 'Stand' },
  ],
  materials: [
    {
      id: 'methyl-orange',
      kind: 'indicator',
      label: 'Methyl orange',
      sets: { parameter: 'endpointPH', value: 4.4 },
    },
  ],
  setup: [
    {
      id: 'clamp',
      instruction: 'Clamp the burette.',
      refusal: CLAMP,
      place: 'burette',
      onto: 'stand',
    },
    {
      id: 'flask',
      instruction: 'Put the flask under it.',
      refusal: FLASK,
      place: 'flask',
      onto: 'stand',
      after: ['clamp'],
    },
    {
      id: 'read',
      instruction: 'Read the burette.',
      refusal: 'Read the burette first.',
      place: 'burette',
      onto: 'stand',
      after: ['flask'],
      phase: 'after-run',
    },
  ],
};

/** The bundled content, the titration given a workspace and its stand the open-workspace action. */
function content() {
  const raw = withTitrationRig(structuredClone(bundledContent)) as unknown as {
    experiments: { id: string; presentation?: string; workspace?: object; procedure: object[] }[];
  };
  const titration = raw.experiments.find((e) => e.id === 'acid-base-titration')!;
  titration.presentation = '2d-workspace';
  titration.workspace = structuredClone(WORKSPACE);
  // Its own checklist: the shipped one names the shipped workspace's steps.
  titration.procedure = [
    {
      id: 'work',
      instruction: 'Work at the stand.',
      vi: { instruction: 'Làm việc tại giá.' },
      done: { kind: 'inspected', item: 'titration-stand' },
    },
    {
      id: 'clamp',
      instruction: 'Clamp the burette.',
      vi: { instruction: 'Kẹp buret.' },
      done: { kind: 'setup', step: 'clamp' },
    },
    {
      id: 'indicator',
      instruction: 'Choose the indicator.',
      vi: { instruction: 'Chọn chất chỉ thị.' },
      done: { kind: 'adjusted', parameter: 'endpointPH' },
    },
  ];
  return raw as unknown as typeof bundledContent;
}

const frames = (game: Game, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / H); i++) game.update(H);
};
const view = (game: Game): BenchView => {
  const station = game.stations.view(STAND);
  if (station?.kind !== 'bench') throw new Error(`${STAND} is not a bench station`);
  return station;
};
const send = (game: Game, command: Omit<GameEvents['ExperimentCommand'], 'stationId'>) =>
  game.events.publish('ExperimentCommand', { stationId: STAND, ...command });
const done = (game: Game) => view(game).setup.map((s) => s.done);
const runUntilDone = (game: Game) => {
  for (let i = 0; view(game).session.state === 'running' && i < 100_000; i++) game.update(0.05);
};

async function lab(storage = new MemorySaveStorage(), raw = content()) {
  const booted = await bootTestGame({ content: raw, storage });
  await booted.game.newGame('researcher-male');
  await booted.game.scenes.load(LAB);
  frames(booted.game, 1);
  const blocked: GameEvents['ActionBlocked'][] = [];
  booted.game.events.subscribe('ActionBlocked', (e) => blocked.push(e));
  return { ...booted, blocked };
}

describe('workspace station (titration with a test workspace)', () => {
  it('starts not ready: RUN waits for the next setup step, refused with its reason', async () => {
    const { game, blocked } = await lab();
    const v = view(game);
    expect(v.definition.presentation).toBe('2d-workspace');
    expect(v.session.state).toBe('idle');
    expect(v.runBlock).toBe(CLAMP);
    expect(done(game)).toEqual([false, false, false]);
    expect(game.entityStates.get(STAND, 'setup.clamp')).toBe(false);
    // The refusal check and the command give the same reason; the command changes nothing.
    expect(game.stations.refusal(STAND, 'run')).toBe(CLAMP);
    send(game, { command: 'run' });
    expect(blocked.map((b) => b.reason)).toEqual([CLAMP]);
    expect(blocked[0]).toEqual({ entityId: STAND, actionId: 'run', reason: CLAMP });
    expect(view(game).session.state).toBe('idle');
  });

  it('takes setup steps in their order; the last before-run step makes it ready', async () => {
    const { game, blocked } = await lab();
    send(game, { command: 'setup', step: 'flask' });
    expect(blocked.at(-1)?.reason).toBe(CLAMP);
    send(game, { command: 'setup', step: 'read' });
    expect(blocked.at(-1)?.reason).toBe(CLAMP);
    send(game, { command: 'setup', step: 'nope' });
    expect(blocked.at(-1)?.reason).toBe('There is no such step at this apparatus.');
    expect(done(game)).toEqual([false, false, false]);

    send(game, { command: 'setup', step: 'clamp' });
    expect(done(game)).toEqual([true, false, false]);
    expect(view(game).checklist[1]?.done).toBe(true); // the `setup` milestone
    expect(view(game).runBlock).toBe(FLASK);
    send(game, { command: 'setup', step: 'clamp' });
    expect(blocked.at(-1)?.reason).toBe('That step is already done.');
    send(game, { command: 'setup', step: 'flask' });
    expect(view(game).session.state).toBe('configured');
    expect(view(game).runBlock).toBeNull();
    send(game, { command: 'setup', step: 'read' });
    expect(blocked.at(-1)?.reason).toBe('Complete a run first.');
    expect(game.entityStates.get(STAND, 'setup.flask')).toBe(true);
  });

  it('sets presets only, like a dial (entity state, adjusted milestones); refused while running', async () => {
    const { game, blocked } = await lab();
    send(game, { command: 'set', parameter: 'endpointPH', value: 4.4 });
    expect(view(game).session.parameters.endpointPH).toBe(4.4);
    expect(game.entityStates.get(STAND, 'param.endpointPH')).toBe(4.4);
    expect(view(game).checklist.find((s) => s.instruction.includes('indicator'))?.done).toBe(true);
    expect(blocked).toEqual([]);
    expect(game.stations.refusal(STAND, 'set', 'endpointPH', 6)).toBe('pH_end cannot be set to 6.');
    send(game, { command: 'set', parameter: 'endpointPH', value: 6 });
    expect(blocked.at(-1)?.actionId).toBe('set');
    expect(view(game).session.parameters.endpointPH).toBe(4.4);
    send(game, { command: 'set', parameter: 'nope', value: 1 });
    expect(blocked.at(-1)?.reason).toBe('This apparatus has no such setting.');

    send(game, { command: 'setup', step: 'clamp' });
    send(game, { command: 'setup', step: 'flask' });
    send(game, { command: 'run' });
    expect(view(game).session.state).toBe('running');
    send(game, { command: 'set', parameter: 'endpointPH', value: 8.2 });
    expect(blocked.at(-1)?.reason).toBe('Stop the run before changing its parameters.');
    send(game, { command: 'clear' });
    expect(blocked.at(-1)?.reason).toBe('Stop the run before clearing the bench.');
    expect(done(game)).toEqual([true, true, false]);
  });

  it('after a run: after-run steps; RESET keeps the setup but not them; clear starts again', async () => {
    const { game, logs } = await lab();
    send(game, { command: 'setup', step: 'clamp' });
    send(game, { command: 'setup', step: 'flask' });
    send(game, { command: 'run' });
    runUntilDone(game);
    expect(view(game).session.state).toBe('completed');
    const logged = logs.length;
    expect(game.stations.refusal(STAND, 'setup', 'read')).toBeNull();
    expect(game.stations.refusal(STAND, 'run')).toBe('Press RESET before the next run.');
    expect(logs.length).toBe(logged); // refusal logs nothing
    send(game, { command: 'setup', step: 'read' });
    expect(done(game)).toEqual([true, true, true]);

    send(game, { command: 'reset' });
    expect(view(game).session.state).toBe('configured');
    expect(done(game)).toEqual([true, true, false]);

    send(game, { command: 'clear' });
    expect(done(game)).toEqual([false, false, false]);
    expect(view(game).session.state).toBe('idle');
    expect(view(game).runBlock).toBe(CLAMP);
    expect(view(game).session.history).toHaveLength(1); // the record stays
  });

  it('keeps setup progress in the save, like the dials', async () => {
    const storage = new MemorySaveStorage();
    const { game } = await lab(storage);
    send(game, { command: 'setup', step: 'clamp' });
    send(game, { command: 'set', parameter: 'acidVolume', value: 10 });
    expect(game.save()?.ok).toBe(true);
    game.dispose();

    const { game: again } = await bootTestGame({ content: content(), storage });
    expect((await again.continueGame()).ok).toBe(true);
    await flush();
    expect(done(again)).toEqual([true, false, false]);
    expect(view(again).session.parameters.acidVolume).toBe(10);
    expect(view(again).runBlock).toBe(FLASK);
    expect(again.workspace.openStation).toBeNull(); // never saved open
  });

  it('opens from the apparatus, holds the player, marks it inspected, closes on a scene change', async () => {
    const { game } = await lab();
    const seen: string[] = [];
    game.events.subscribe('WorkspaceOpened', ({ stationId }) => seen.push(`open ${stationId}`));
    game.events.subscribe('WorkspaceClosed', ({ stationId }) => seen.push(`close ${stationId}`));
    expect(game.interaction.perform(STAND, 'open-workspace')).toBe(true);
    expect(game.workspace.openStation).toBe(STAND);
    expect(seen).toEqual([`open ${STAND}`]);
    expect(view(game).checklist[0]).toEqual({ instruction: 'Work at the stand.', done: true });

    game.input.press('moveForward');
    game.update(H);
    expect(game.state.player.moveIntent).toEqual([0, 0, 0]);

    expect(game.workspace.close()).toBe(true);
    game.update(H); // the same key moves the player once it is closed
    expect(game.state.player.moveIntent).not.toEqual([0, 0, 0]);
    game.input.release('moveForward');
    expect(game.workspace.close()).toBe(false);
    expect(game.workspace.open(STAND)).toBeNull();
    await game.scenes.load('physics-lab');
    expect(game.workspace.openStation).toBeNull();
    expect(seen).toEqual([`open ${STAND}`, `close ${STAND}`, `open ${STAND}`, `close ${STAND}`]);
  });

  it('closes when its station leaves with a neighbouring scene', async () => {
    const { game } = await lab();
    await game.scenes.load('simlab-hub');
    expect(await game.scenes.attach(LAB)).toBeNull();
    expect(game.workspace.open(STAND)).toBeNull();
    expect(game.scenes.release(LAB)).toBe(true);
    expect(game.workspace.openStation).toBeNull();
  });

  it('forgets after-run steps over a save (runs are not saved), keeps the before-run setup', async () => {
    const storage = new MemorySaveStorage();
    const { game } = await lab(storage);
    send(game, { command: 'setup', step: 'clamp' });
    send(game, { command: 'setup', step: 'flask' });
    send(game, { command: 'run' });
    runUntilDone(game);
    send(game, { command: 'setup', step: 'read' });
    expect(done(game)).toEqual([true, true, true]);
    expect(game.save()?.ok).toBe(true);
    game.dispose();

    const { game: again } = await bootTestGame({ content: content(), storage });
    expect((await again.continueGame()).ok).toBe(true);
    await flush();
    expect(view(again).session.run).toBeNull();
    expect(done(again)).toEqual([true, true, false]);
  });

  it('stores the preset itself; setting the current value again adjusts nothing', async () => {
    const { game } = await lab();
    const changed: number[] = [];
    game.events.subscribe('ExperimentParameterChanged', (e) => changed.push(e.value));
    const indicator = () =>
      view(game).checklist.find((s) => s.instruction.includes('indicator'))?.done;
    send(game, { command: 'set', parameter: 'endpointPH', value: 8.2 }); // the default
    expect(indicator()).toBe(false);
    expect(changed).toEqual([]);
    send(game, { command: 'set', parameter: 'endpointPH', value: 4.4000000001 });
    expect(view(game).session.parameters.endpointPH).toBe(4.4);
    expect(game.entityStates.get(STAND, 'param.endpointPH')).toBe(4.4);
    expect(changed).toEqual([4.4]);
    expect(indicator()).toBe(true);
  });

  it('asks only for the steps of the material chosen (`when`)', async () => {
    // Test data: the flask step applies with methyl orange only.
    const raw = content() as unknown as {
      experiments: { id: string; workspace: typeof WORKSPACE }[];
    };
    const flask = raw.experiments.find((e) => e.id === 'acid-base-titration')!.workspace.setup[1]!;
    Object.assign(flask, { when: { parameter: 'endpointPH', values: [4.4] } });
    const { game } = await lab(undefined, raw as unknown as typeof bundledContent);
    const steps = () => view(game).setup.map((s) => s.step.id);
    expect(steps()).toEqual(['clamp', 'read']); // phenolphthalein, the default
    send(game, { command: 'setup', step: 'clamp' });
    expect(view(game).session.state).toBe('configured');
    expect(game.stations.refusal(STAND, 'setup', 'flask')).toBe(
      'There is no such step at this apparatus.',
    );
    send(game, { command: 'set', parameter: 'endpointPH', value: 4.4 });
    expect(steps()).toEqual(['clamp', 'flask', 'read']);
    expect(view(game).runBlock).toBe(FLASK);
    expect(view(game).session.ready).toBe(false);
    send(game, { command: 'set', parameter: 'endpointPH', value: 8.2 });
    expect(view(game).runBlock).toBeNull();
    expect(view(game).session.ready).toBe(true);
  });

  it('refuses a workspace for a physical-3d station', async () => {
    const { game, blocked } = await lab();
    await game.scenes.load('physics-lab');
    const launcher = 'projectile-range/launcher';
    expect(game.stations.refusal(launcher, 'open-workspace')).toBe(
      'This apparatus has no workspace.',
    );
    expect(game.workspace.open(launcher)).toBe('This apparatus has no workspace.');
    expect(blocked.at(-1)?.actionId).toBe('open-workspace');
    expect(game.workspace.openStation).toBeNull();
  });
});
