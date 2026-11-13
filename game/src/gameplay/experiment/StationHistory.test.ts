import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../core/math';
import type { Game } from '../../game/Game';
import { bootTestGame, flush, placePlayer } from '../../game/testing';
import { MemoryRunHistoryStore } from '../../persistence/runHistory';
import { MemorySaveStorage } from '../../persistence/SaveSystem';

const H = 1 / 60;
const BAY = 'pendulum-bay';
const PENDULUM = `${BAY}/pendulum`;
const RANGE = 'projectile-range';
const LAUNCHER = `${RANGE}/launcher`;

const frames = (game: Game, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / H); i++) game.update(H);
};
const act = (game: Game, id: string, action: string) => game.interaction.perform(id, action);
const session = (game: Game, station: string) => game.stations.view(station)!.session;
const runToEnd = (game: Game, station: string) => {
  for (let i = 0; session(game, station).state === 'running' && i < 100_000; i++) game.update(H);
};

/** New game, the Physics Lab (developer jump: setup only), a ball loaded into the launcher. */
async function lab(storage = new MemorySaveStorage(), history = new MemoryRunHistoryStore()) {
  const booted = await bootTestGame({ storage, history });
  await booted.game.newGame('researcher-male');
  await booted.game.scenes.load('physics-lab');
  frames(booted.game, 1);
  placePlayer(booted.game, [-3.85, 0, 7] as Vec3);
  expect(act(booted.game, `${RANGE}/ball-1`, 'grab')).toBe(true);
  expect(act(booted.game, LAUNCHER, 'load')).toBe(true);
  return booted;
}

describe('station run history in the game', () => {
  it('records each station’s runs through its own controls; leaving keeps the history', async () => {
    const { game } = await lab();
    act(game, `${BAY}/button-run`, 'run');
    runToEnd(game, PENDULUM);
    act(game, `${BAY}/dial-length`, 'raise');
    act(game, `${BAY}/button-reset`, 'reset');
    act(game, `${BAY}/button-run`, 'run');
    runToEnd(game, PENDULUM);
    act(game, `${RANGE}/button-run`, 'run');
    runToEnd(game, LAUNCHER);
    const pendulum = session(game, PENDULUM).history;
    expect(pendulum.map((r) => [r.sequence, r.status, r.inputs.length])).toEqual([
      [1, 'completed', 1],
      [2, 'completed', 1.25],
    ]);
    expect(session(game, LAUNCHER).history.map((r) => r.status)).toEqual(['completed']);

    // Out to the hub and back: the sessions, and so their histories, are the same.
    await game.scenes.load('simlab-hub');
    await game.scenes.load('physics-lab');
    expect(session(game, PENDULUM).history).toEqual(pendulum);
    expect(session(game, PENDULUM).history[0]).toBe(pendulum[0]); // the very records

    // A run cut short by leaving is kept too, as stopped.
    act(game, `${BAY}/button-reset`, 'reset');
    act(game, `${BAY}/button-run`, 'run');
    frames(game, 0.5);
    await game.scenes.load('simlab-hub');
    await game.scenes.load('physics-lab');
    expect(session(game, PENDULUM).history.map((r) => r.status)).toEqual([
      'completed',
      'completed',
      'stopped',
    ]);
  });

  it('never puts the history in the save: the run history store brings it back on Continue', async () => {
    const storage = new MemorySaveStorage();
    const history = new MemoryRunHistoryStore();
    const { game } = await lab(storage, history);
    act(game, `${BAY}/dial-angle`, 'raise');
    act(game, `${BAY}/button-run`, 'run');
    runToEnd(game, PENDULUM);
    act(game, `${RANGE}/button-run`, 'run');
    runToEnd(game, LAUNCHER);
    expect(session(game, PENDULUM).history).toHaveLength(1);
    const saved = game.save();
    if (!saved?.ok) throw new Error('save failed');
    const text = JSON.stringify(saved.value);
    // Plain settings only: no run, no record, no sample (a run alone has hundreds of numbers).
    expect(text).not.toContain('#1');
    expect(text).not.toMatch(/history|sample|theory|result/i);
    // A station's settings take under 200 characters (32 stations, 4.6 kB at Phase T-4); one run
    // alone would take thousands.
    const states = Object.keys(saved.value.world.entityStates).length;
    expect(text.length).toBeLessThan(800 + 200 * states);
    expect(saved.value.world.entityStates[PENDULUM]).toMatchObject({ 'param.angle': 15 });
    game.dispose();

    await flush();

    // The same browser: the dials from the save, the runs from the run history store.
    const { game: again } = await bootTestGame({ storage, history });
    expect((await again.continueGame()).ok).toBe(true);
    await flush();
    frames(again, 0.2);
    expect(session(again, PENDULUM).parameters.angle).toBe(15);
    expect(session(again, PENDULUM).history.map((r) => r.runId)).toEqual([`${PENDULUM}#1`]);
    expect(session(again, LAUNCHER).history.map((r) => r.runId)).toEqual([`${LAUNCHER}#1`]);
    again.dispose();

    // A run history that is empty (another browser, or one that could not keep it): none.
    const { game: other } = await bootTestGame({ storage });
    expect((await other.continueGame()).ok).toBe(true);
    await flush();
    frames(other, 0.2);
    expect(session(other, PENDULUM).parameters.angle).toBe(15);
    expect(session(other, PENDULUM).history).toEqual([]);
    expect(session(other, LAUNCHER).history).toEqual([]);
  });

  it('saves each instrument resolution like a dial; an older save without one gets the default', async () => {
    const storage = new MemorySaveStorage();
    const { game } = await lab(storage);
    expect(act(game, `${BAY}/dial-resolution`, 'raise')).toBe(true); // 0.01 → 0.1 s
    expect(act(game, `${RANGE}/dial-resolution`, 'lower')).toBe(true); // 0.01 → 0.001 m
    const saved = game.save();
    if (!saved?.ok) throw new Error('save failed');
    expect(saved.value.world.entityStates[PENDULUM]).toMatchObject({ 'param.resolution': 0.1 });
    expect(saved.value.world.entityStates[LAUNCHER]).toMatchObject({ 'param.resolution': 0.001 });
    game.dispose();

    /** The resolutions Continue restores from the save, edited first. */
    const restored = async (edit: (states: Record<string, unknown>) => void) => {
      type Save = { world: { entityStates: Record<string, Record<string, unknown>> } };
      const data = JSON.parse(storage.read('simlab.save.slot-1') ?? '') as Save;
      for (const id of [PENDULUM, LAUNCHER]) edit(data.world.entityStates[id]!);
      const copy = new MemorySaveStorage();
      copy.write('simlab.save.slot-1', JSON.stringify(data));
      const { game: again } = await bootTestGame({ storage: copy });
      expect((await again.continueGame()).ok).toBe(true);
      await flush();
      frames(again, 0.2);
      const values = [PENDULUM, LAUNCHER].map((id) => session(again, id).parameters.resolution);
      again.dispose();
      return values;
    };
    expect(await restored(() => {})).toEqual([0.1, 0.001]);
    // A save from before Phase 6C.4 has no resolution: the default, as for any new setting.
    expect(await restored((states) => delete states['param.resolution'])).toEqual([0.01, 0.01]);
    // A value no dial can reach (an edited file) is refused like any out-of-range setting.
    for (const bad of [0, -0.01, 1, '0.1']) {
      const values = await restored((states) => {
        states['param.resolution'] = bad;
      });
      expect(values).toEqual([0.01, 0.01]);
    }
  });

  it('reads the results with no current run while the history keeps runs; refuses with none', async () => {
    const storage = new MemorySaveStorage();
    const { game } = await lab(storage);
    const viewed: string[] = [];
    const blocked: string[] = [];
    game.events.subscribe('ExperimentResultsViewed', ({ stationId }) => viewed.push(stationId));
    game.events.subscribe('ActionBlocked', ({ reason }) => blocked.push(reason));
    const read = (g: Game, room: string) => act(g, `${room}/monitor`, 'view-results');
    const NONE = 'No results yet: run the experiment first.';

    // Nothing run yet: refused with the reason, as before.
    expect(read(game, BAY)).toBe(false);
    expect(blocked).toEqual([NONE]);
    // A current run: read as before.
    act(game, `${BAY}/button-run`, 'run');
    runToEnd(game, PENDULUM);
    expect(read(game, BAY)).toBe(true);
    // RESET: no current run, but the history keeps it, so the monitor still opens.
    act(game, `${BAY}/button-reset`, 'reset');
    expect(session(game, PENDULUM).run).toBeNull();
    expect(session(game, PENDULUM).history).toHaveLength(1);
    expect(read(game, BAY)).toBe(true);
    // The launcher the same way: a shot, RESET, still readable.
    act(game, `${RANGE}/button-run`, 'run');
    runToEnd(game, LAUNCHER);
    act(game, `${RANGE}/button-reset`, 'reset');
    expect(session(game, LAUNCHER).run).toBeNull();
    expect(read(game, RANGE)).toBe(true);
    // Out to the hub and back: the sessions and their histories stay, and so does reading them.
    await game.scenes.load('simlab-hub');
    await game.scenes.load('physics-lab');
    expect(read(game, BAY)).toBe(true);
    expect(read(game, RANGE)).toBe(true);
    expect(viewed).toEqual([PENDULUM, PENDULUM, LAUNCHER, PENDULUM, LAUNCHER]);
    expect(blocked).toEqual([NONE]);
    expect(session(game, PENDULUM).history).toHaveLength(1); // reading changed nothing
    const saved = game.save();
    if (!saved?.ok) throw new Error('save failed');
    game.dispose();

    // Continue: the history is not saved (Phase 6C.3), so there is nothing to read: refused.
    const { game: again } = await bootTestGame({ storage });
    expect((await again.continueGame()).ok).toBe(true);
    await flush();
    frames(again, 0.2);
    again.events.subscribe('ActionBlocked', ({ reason }) => blocked.push(reason));
    expect(read(again, BAY)).toBe(false);
    expect(read(again, RANGE)).toBe(false);
    expect(blocked).toEqual([NONE, NONE, NONE]);
    again.dispose();
  });
});
