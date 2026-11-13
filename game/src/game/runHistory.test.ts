import { describe, expect, it } from 'vitest';
import {
  fromStoredRun,
  MemoryRunHistoryStore,
  MOVED_STATIONS,
  toStoredRun,
  type RunHistoryStore,
  type StoredRun,
} from '../persistence/runHistory';
import { MemorySaveStorage } from '../persistence/SaveSystem';
import { parseSave } from '../persistence/saveData';
import { RUN_HISTORY_LIMIT } from '../simulation/ExperimentSession';
import type { RunRecord } from '../simulation/RunRecord';
import type { Game } from './Game';
import { bootTestGame, flush } from './testing';

const H = 1 / 60;
const LAB = 'physics-lab';
const STATION = 'test/free-fall'; // a session of its own, not one of the lab's stations
const SLOT = 'simlab.save.slot-1';

const session = (game: Game) => {
  const s = game.experiments.session(STATION, 'free-fall');
  game.experiments.setReady(STATION, true);
  return s;
};
/** One free-fall run at this station, from RESET to its natural end. */
function runToEnd(game: Game): RunRecord {
  const s = session(game);
  if (s.run) game.experiments.reset(STATION);
  expect(game.experiments.start(STATION)).toBeNull();
  for (let i = 0; s.run?.status === 'running' && i < 10_000; i++) game.update(H);
  const record = s.history.at(-1);
  if (!record) throw new Error('no record');
  return record;
}
const savedCompletions = (storage: MemorySaveStorage) => {
  const save = parseSave(storage.read(SLOT) ?? '');
  return save.ok ? save.value.progression.completedExperiments : null;
};

/** A new game in the lab with this history store (and a fresh save storage unless given). */
async function play(history: RunHistoryStore, storage = new MemorySaveStorage()) {
  const booted = await bootTestGame({ storage, history });
  const failures: string[] = [];
  booted.game.events.subscribe('RunHistoryFailed', ({ reason }) => failures.push(reason));
  await booted.game.newGame('researcher-male');
  await booted.game.scenes.load(LAB);
  return { ...booted, storage, failures };
}

const expectSameRun = (a: RunRecord, b: RunRecord) => {
  expect(b.runId).toBe(a.runId);
  expect(b.sessionId).toBe(a.sessionId);
  expect(b.sequence).toBe(a.sequence);
  expect(b.definition.id).toBe(a.definition.id);
  expect(b.status).toBe(a.status);
  expect(b.time).toBe(a.time);
  expect(b.inputs).toEqual(a.inputs);
  expect(b.results).toEqual(a.results);
  expect(b.theory()).toEqual(a.theory());
  expect(b.sampleCount).toBe(a.sampleCount);
  expect(b.sampleTimes).toEqual(a.sampleTimes);
  expect(b.sampleValues).toEqual(a.sampleValues);
};

describe('the run history store keeps ended runs across visits', () => {
  it('an ended run is stored once, as plain data, and comes back the same after a reload', async () => {
    const store = new MemoryRunHistoryStore();
    const first = await play(store);
    const record = runToEnd(first.game);
    await flush();
    expect([...store.runs.keys()]).toEqual([`${STATION}#1`]);
    const stored = store.runs.get(`${STATION}#1`) as StoredRun;
    expect(stored.experimentId).toBe('free-fall');
    expect(stored.sampleTimes).toBeInstanceOf(Float64Array);
    expect(typeof (stored as unknown as Record<string, unknown>).theory).toBe('object');
    first.game.dispose();

    // A new visit: the station has its run back, same id, and numbering goes on from it.
    const second = await play(store);
    const back = session(second.game).history;
    expect(back).toHaveLength(1);
    expectSameRun(record, back[0] as RunRecord);
    expect(Object.isFrozen(back[0])).toBe(true);
    const next = runToEnd(second.game);
    expect(next.runId).toBe(`${STATION}#2`);
    await flush();
    expect(store.runs.size).toBe(2);
  });

  it('writing the same run twice keeps one entry; a record does not change after it is stored', async () => {
    const store = new MemoryRunHistoryStore();
    const { game } = await play(store);
    const record = runToEnd(game);
    await flush();
    await store.put(toStoredRun(record));
    await store.put(toStoredRun(record));
    expect(store.runs.size).toBe(1);
    const before = (store.runs.get(record.runId) as StoredRun).sampleTimes.slice();
    runToEnd(game); // more runs, dial changes: the stored one stays as it was
    game.experiments.setParameter(STATION, 'height', 2);
    await flush();
    expect((store.runs.get(record.runId) as StoredRun).sampleTimes).toEqual(before);
  });

  it(`keeps at most ${RUN_HISTORY_LIMIT} runs per station: the oldest is deleted from the store`, async () => {
    const store = new MemoryRunHistoryStore();
    const { game } = await play(store);
    for (let i = 0; i < RUN_HISTORY_LIMIT + 1; i++) runToEnd(game);
    await flush();
    expect(store.runs.size).toBe(RUN_HISTORY_LIMIT);
    expect(store.runs.has(`${STATION}#1`)).toBe(false);
    expect(store.runs.has(`${STATION}#${RUN_HISTORY_LIMIT + 1}`)).toBe(true);
  });

  it('a stopped run is kept as stopped, never as completed', async () => {
    const store = new MemoryRunHistoryStore();
    const { game, storage } = await play(store);
    session(game);
    game.experiments.start(STATION);
    game.update(H);
    game.experiments.stop(STATION);
    await flush();
    expect([...store.runs.values()].map((r) => [r.status, r.results])).toEqual([['stopped', null]]);
    expect(savedCompletions(storage)).toEqual([]);
  });

  it('New game and Back to the main menu keep ended runs; a run still running is not recorded', async () => {
    const store = new MemoryRunHistoryStore();
    const { game } = await play(store);
    runToEnd(game);
    game.experiments.reset(STATION);
    game.experiments.start(STATION); // running when the player leaves
    expect((await game.backToMenu()).ok).toBe(true);
    await flush();
    expect([...store.runs.keys()]).toEqual([`${STATION}#1`]);

    await game.newGame('researcher-male');
    expect(session(game).history.map((r) => r.runId)).toEqual([`${STATION}#1`]);
    expect(session(game).state).toBe('configured'); // no run came back
  });

  it('skips stored values that are invalid or whose experiment is gone, and loads the rest', async () => {
    const store = new MemoryRunHistoryStore();
    const { game } = await play(store);
    const good = toStoredRun(runToEnd(game));
    await flush();
    game.dispose();
    store.runs.set('bad#1', { ...good, runId: 'bad#1', sampleCount: good.sampleCount + 1 });
    store.runs.set('gone#1', { ...good, runId: 'gone#1', experimentId: 'no-such-experiment' });
    store.runs.set('junk', { runId: 'junk' } as unknown as StoredRun);

    const again = await play(store);
    expect(session(again.game).history.map((r) => r.runId)).toEqual([good.runId]);
    expect(again.logs.filter((l) => l.level === 'warn').map((l) => l.message)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('sampleCount'),
        expect.stringContaining('no-such-experiment'),
        expect.stringContaining('Invalid stored run'),
      ]),
    );
  });

  it('round-trips a record without the game: plain data in, the same frozen record out', async () => {
    const { game } = await play(new MemoryRunHistoryStore());
    const record = runToEnd(game);
    const back = fromStoredRun(structuredClone(toStoredRun(record)), game.content.experiments);
    expect(back.ok).toBe(true);
    if (back.ok) expectSameRun(record, back.value);
  });
});

describe('runs kept before the Physics wing was rebuilt (Phase T-1a)', () => {
  it('come back under their station’s new id, each a station of the shipped wing', async () => {
    const store = new MemoryRunHistoryStore();
    const { game } = await play(store);
    const good = toStoredRun(runToEnd(game));
    const back = fromStoredRun(
      { ...good, sessionId: 'projectile-range/refraction' },
      game.content.experiments,
    );
    expect(back.ok && back.value.sessionId).toBe('waves-optics/refraction');
    const kept = fromStoredRun(good, game.content.experiments);
    expect(kept.ok && kept.value.sessionId).toBe(good.sessionId); // not moved: as it was
    await game.loadLab();
    await game.scenes.load('physics-lab');
    for (const [from, to] of Object.entries(MOVED_STATIONS)) {
      expect(game.world.entity(from), from).toBeUndefined();
      expect(game.stations.view(to), to).toBeDefined();
    }
    game.dispose();
  });
});

describe('a run history failure never fails the progression save', () => {
  const failing = (fail: 'load' | 'put' | 'throw'): RunHistoryStore => ({
    load: () => (fail === 'load' ? Promise.reject(new Error('blocked')) : Promise.resolve([])),
    put: () => {
      if (fail === 'throw') throw new Error('DataCloneError');
      return Promise.reject(new Error('QuotaExceededError'));
    },
    delete: () => Promise.resolve(),
  });

  for (const fail of ['put', 'throw', 'load'] as const) {
    it(`a ${fail} failure: reported, the run stays listed, the completion is saved`, async () => {
      const { game, storage, failures } = await play(failing(fail));
      const record = runToEnd(game);
      await flush();
      expect(record.status).toBe('completed');
      expect(failures.length).toBeGreaterThan(0); // reported (RunHistoryFailed → HUD notice)
      expect(session(game).history).toContain(record); // still listed this visit
      expect(savedCompletions(storage)).toEqual(['free-fall']); // progression saved regardless
      expect(game.save()?.ok).toBe(true);
    });
  }

  it('boot goes on when the store cannot be read: Continue still loads the save', async () => {
    const storage = new MemorySaveStorage();
    const first = await play(new MemoryRunHistoryStore(), storage);
    runToEnd(first.game);
    first.game.dispose();
    const { game } = await bootTestGame({ storage, history: failing('load') });
    expect((await game.continueGame()).ok).toBe(true);
    expect(game.state.progression.completedExperiments).toEqual(['free-fall']);
  });
});
