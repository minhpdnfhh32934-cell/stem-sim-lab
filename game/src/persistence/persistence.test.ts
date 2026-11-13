import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../game/GameEvents';
import { createGameState, type ObjectPose } from '../game/GameState';
import { captureLogger } from '../game/testing';
import { migrateSave, parseSave, SAVE_VERSION, type SaveMigration } from './saveData';
import { applySave, MemorySaveStorage, SaveSystem } from './SaveSystem';
import { CharacterDefinitionSchema, CUSTOM_ID } from '../gameplay/character';

const KEY = 'simlab.save.slot';
const FLASK = 'chemistry-lab/flask-50';
const MID_FILL = {
  contents: { 'stock-20': 5000, water: 21000 },
  temperatureC: 20,
  closed: false,
  mixed: false,
};
const POSE = { position: [1.5, 0.95, -2.25], rotation: [0, 0.3826834, 0, 0.9238795] };
/** Each lab's spawn by its hub door (scenes.json), where the v6 migration puts a lab's player. */
const PHYSICS_DOOR = { position: [-4, 0, 0], yaw: -1.5708, pitch: 0 };
const CHEMISTRY_DOOR = { position: [0, 0, 3], yaw: 0, pitch: 0 };
const CARRIED = {
  slot: 2,
  item: 'projectile-ball',
  placements: ['projectile-range/ball-1', 'projectile-range/ball-3'],
};

function setup() {
  const { log, entries } = captureLogger();
  const storage = new MemorySaveStorage();
  const state = createGameState();
  state.session = { phase: 'playing', sceneId: 'physics-lab', paused: false };
  state.player.characterId = 'researcher-male';
  state.player.position = [1, 0, -2];
  state.player.yaw = 0.25;
  state.world.entityStates = { 'physics-lab/lamp': { active: true } };
  state.progression.completedExperiments = ['free-fall'];
  state.player.equipment = ['lab-coat'];
  state.player.inventory = { stacks: [structuredClone(CARRIED)], selected: 2 };
  state.progression.procedures = {
    'cleanroom-entry': { completed: ['read-rules'], entered: false },
  };
  state.world.containers = { [FLASK]: structuredClone(MID_FILL) };
  state.world.objects = { [FLASK]: structuredClone(POSE) as ObjectPose };
  const events = new EventBus<GameEvents>(log);
  const saves = new SaveSystem({
    storage,
    state,
    events,
    log,
    now: () => new Date('2026-10-20T00:00:00Z'),
  });
  return { storage, state, saves, events, entries };
}

describe('SaveSystem', () => {
  it('round-trips the persistent parts of the game state', () => {
    const { saves, events } = setup();
    const saved: string[] = [];
    events.subscribe('GameSaved', ({ slot }) => saved.push(slot));
    expect(saves.save('slot').ok).toBe(true);
    expect(saved).toEqual(['slot']);

    const loaded = saves.load('slot');
    if (!loaded.ok) throw new Error(loaded.error);
    expect(loaded.value).toEqual({
      version: SAVE_VERSION,
      savedAt: '2026-10-20T00:00:00.000Z',
      player: {
        characterId: 'researcher-male',
        sceneId: 'physics-lab',
        position: [1, 0, -2],
        yaw: 0.25,
        pitch: 0,
        equipment: ['lab-coat'],
        inventory: { stacks: [CARRIED], selected: 2 },
      },
      world: {
        clockS: 300, // v9: the time of day, a new game's 08:00
        entityStates: { 'physics-lab/lamp': { active: true } },
        containers: { [FLASK]: MID_FILL },
        objects: { [FLASK]: POSE },
      },
      progression: {
        completedExperiments: ['free-fall'],
        procedures: { 'cleanroom-entry': { completed: ['read-rules'], entered: false } },
        tasks: { active: null, done: [] },
        papers: [],
        scores: [],
      },
    });

    const fresh = createGameState();
    applySave(fresh, loaded.value);
    // v4: contents exact (integer µL by material, no concentration), poses as saved.
    expect(fresh.world.containers).toEqual({ [FLASK]: MID_FILL });
    expect(fresh.world.objects).toEqual({ [FLASK]: POSE });
    expect(fresh.player.position).toEqual([1, 0, -2]);
    expect(fresh.world.entityStates).toEqual({ 'physics-lab/lamp': { active: true } });
    expect(fresh.player.equipment).toEqual(['lab-coat']);
    expect(fresh.player.inventory).toEqual({ stacks: [CARRIED], selected: 2 });
    expect(fresh.progression.procedures).toEqual({
      'cleanroom-entry': { completed: ['read-rules'], entered: false },
    });
  });

  it('keeps copies of what the player carries, never the live stacks', () => {
    const { saves, state } = setup();
    const data = saves.capture();
    state.player.inventory.stacks[0]?.placements.pop();
    state.player.inventory.selected = 0;
    expect(data.player.inventory).toEqual({ stacks: [CARRIED], selected: 2 });
    const fresh = createGameState();
    applySave(fresh, data);
    fresh.player.inventory.stacks[0]?.placements.push('projectile-range/ball-2');
    expect(data.player.inventory.stacks[0]?.placements).toEqual(CARRIED.placements);
  });

  it('keeps the player’s own character with a game played as it (v10), and none otherwise', () => {
    const { saves, state } = setup();
    expect(saves.capture().player.custom).toBeUndefined();
    const own = CharacterDefinitionSchema.parse({
      id: CUSTOM_ID,
      displayName: 'Phú',
      gender: 'unspecified',
      appearance: { heightM: 1.81, skinTone: '#e3b48c', hairColor: '#3a6fd8', hair: 'spiky' },
      outfit: { default: 'lab-coat' },
      profile: { pose: 'peace', seat: 8, coat: false },
    });
    state.player.characterId = CUSTOM_ID;
    state.player.custom = own;
    expect(saves.save('slot').ok).toBe(true);
    const loaded = saves.load('slot');
    if (!loaded.ok) throw new Error(loaded.error);
    expect(loaded.value.player.custom).toEqual(own);
    const fresh = createGameState();
    applySave(fresh, loaded.value);
    expect(fresh.player.custom).toEqual(own);
  });

  it('upgrades a version 9 save unchanged but for its version (v10: no own character; v11: no paper)', () => {
    const { saves } = setup();
    const v9 = { ...saves.capture(), version: 9 };
    const parsed = parseSave(JSON.stringify(v9));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.value).toEqual({ ...v9, version: 11 });
    expect(parsed.value.player.custom).toBeUndefined();
  });

  it('upgrades a version 10 save with no test paper and no mark (v11)', () => {
    const { saves } = setup();
    const data = saves.capture();
    const v10 = {
      ...data,
      version: 10,
      progression: {
        completedExperiments: data.progression.completedExperiments,
        procedures: data.progression.procedures,
        tasks: data.progression.tasks,
      },
    };
    const parsed = parseSave(JSON.stringify(v10));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.value.version).toBe(11);
    expect(parsed.value.progression.papers).toEqual([]);
    expect(parsed.value.progression.scores).toEqual([]);
  });

  it('keeps test papers, their answers and marks, and the scores (v11)', () => {
    const { saves, state } = setup();
    state.progression.papers = [
      {
        id: 'paper-1',
        number: 1,
        teacher: 'teacher',
        request: {
          experiments: ['free-fall'],
          count: 2,
          types: ['choice', 'true-false'],
          levels: ['apply'],
          seed: 7,
        },
        items: [
          { experiment: 'free-fall', question: 'moon-time', order: [2, 0, 3, 1] },
          { experiment: 'free-fall', question: 'statements-jupiter', order: [] },
        ],
        answers: [1, [true, null, false, true]],
        crossed: [[3], [2]],
        marked: { points: 0.75, max: 1.25, score: 6 },
        writtenAtS: 412,
      },
    ];
    state.progression.scores = [
      { paper: 1, experiments: ['free-fall'], points: 0.75, max: 1.25, score: 6 },
    ];
    const json = JSON.stringify(saves.capture());
    const parsed = parseSave(json);
    if (!parsed.ok) throw new Error(parsed.error);
    const fresh = createGameState();
    applySave(fresh, parsed.value);
    expect(fresh.progression.papers).toEqual(state.progression.papers);
    expect(fresh.progression.scores).toEqual(state.progression.scores);
    expect(fresh.progression.papers).not.toBe(state.progression.papers);
  });

  it('saves a copy, not live references', () => {
    const { saves, state } = setup();
    const data = saves.capture();
    state.player.position[0] = 99;
    state.world.entityStates['physics-lab/lamp'] = { active: false };
    expect(data.player.position[0]).toBe(1);
    expect(data.world.entityStates['physics-lab/lamp']).toEqual({ active: true });
  });

  it('refuses to save without a game in progress', () => {
    const { saves, state } = setup();
    state.player.characterId = null;
    const result = saves.save('slot');
    expect(result.ok).toBe(false);
  });

  it('falls back to the backup when the primary save is damaged', () => {
    const { saves, storage, state, entries } = setup();
    saves.save('slot');
    state.player.position = [3, 0, 3];
    saves.save('slot'); // previous good save becomes the backup
    storage.write(KEY, '{"version":1,"player":'); // damaged primary
    const loaded = saves.load('slot');
    expect(loaded.ok && loaded.value.player.position).toEqual([1, 0, -2]);
    expect(entries.some((e) => e.level === 'warn' && e.message.includes('backup'))).toBe(true);
  });

  it('does not let a damaged save overwrite a good backup', () => {
    const { saves, storage } = setup();
    saves.save('slot');
    saves.save('slot');
    const goodBackup = storage.read(`${KEY}.backup`);
    storage.write(KEY, 'garbage');
    saves.save('slot');
    expect(storage.read(`${KEY}.backup`)).toBe(goodBackup);
  });

  it('reports missing saves and unreadable storage', () => {
    const { saves, storage } = setup();
    expect(saves.load('slot')).toEqual({ ok: false, error: 'No saved game' });
    storage.read = () => {
      throw new Error('SecurityError');
    };
    expect(saves.load('slot')).toEqual({
      ok: false,
      error: 'Save storage is not readable: SecurityError',
    });
    expect(saves.hasSave('slot')).toBe(false);
  });
});

describe('save versioning', () => {
  const v2: SaveMigration = { from: 1, migrate: (d) => ({ ...d, renamed: d.old, old: undefined }) };
  const v3: SaveMigration = { from: 2, migrate: (d) => ({ ...d, added: true }) };

  it('upgrades step by step through every migration', () => {
    const result = migrateSave({ version: 1, old: 'x' }, [v3, v2], 3);
    expect(result).toEqual({
      ok: true,
      value: { version: 3, renamed: 'x', old: undefined, added: true },
    });
  });

  it('rejects saves with a gap in the migration chain, a newer version, or no version', () => {
    expect(migrateSave({ version: 1 }, [v3], 3)).toEqual({
      ok: false,
      error: 'No migration from save version 1',
    });
    expect(migrateSave({ version: 4 }, [], 3).ok).toBe(false);
    expect(migrateSave({ version: '1' }, [], 3)).toEqual({
      ok: false,
      error: 'Save has no valid version number',
    });
    expect(migrateSave([], [], 3).ok).toBe(false);
  });

  it('upgrades a version 1 save (Phases 1–4): nothing worn, no procedure started', () => {
    const v1 = {
      version: 1,
      savedAt: '2026-10-20T00:00:00.000Z',
      player: {
        characterId: 'researcher-female',
        sceneId: 'cleanroom-corridor',
        position: [0, 0, -5],
        yaw: 0,
        pitch: 0,
      },
      world: { entityStates: { 'preparation-room/cabinet': { open: true } } },
      progression: { completedExperiments: ['free-fall'] },
    };
    const parsed = parseSave(JSON.stringify(v1));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.value).toEqual({
      ...v1,
      version: SAVE_VERSION,
      player: { ...v1.player, equipment: [], inventory: { stacks: [], selected: 0 } },
      world: { ...v1.world, containers: {}, objects: {}, clockS: 300 },
      progression: {
        completedExperiments: ['free-fall'],
        procedures: {},
        tasks: { active: null, done: [] },
        papers: [],
        scores: [],
      },
    });
  });

  it('upgrades a version 2 save: nothing carried, everything else as it was', () => {
    const v2 = {
      version: 2,
      savedAt: '2026-10-20T00:00:00.000Z',
      player: {
        characterId: 'researcher-male',
        sceneId: 'physics-lab',
        position: [-3.85, 0, 7],
        yaw: 1.2,
        pitch: -0.1,
        equipment: ['lab-coat'],
      },
      world: { entityStates: { 'projectile-range/launcher': { 'param.angle': 30 } } },
      progression: {
        completedExperiments: ['projectile-motion'],
        procedures: { 'cleanroom-entry': { completed: ['read-rules'], entered: true } },
      },
    };
    const parsed = parseSave(JSON.stringify(v2));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(SAVE_VERSION).toBe(11);
    expect(parsed.value).toEqual({
      ...v2,
      version: 11,
      player: {
        ...v2.player,
        ...PHYSICS_DOOR, // v6: a player inside a lab stands at its hub door
        inventory: { stacks: [], selected: 0 },
      },
      // v7: the Physics wing rebuilt, its stations' settings reset
      world: { entityStates: {}, containers: {}, objects: {}, clockS: 300 },
      progression: { ...v2.progression, tasks: { active: null, done: [] }, papers: [], scores: [] },
    });
  });

  it('upgrades a version 3 save: no container moved or filled, everything else as it was', () => {
    const v3 = {
      version: 3,
      savedAt: '2026-10-31T00:00:00.000Z',
      player: {
        characterId: 'researcher-female',
        sceneId: 'chemistry-lab',
        position: [2, 0, 1],
        yaw: 0.5,
        pitch: 0,
        equipment: ['lab-coat', 'goggles'],
        inventory: { stacks: [structuredClone(CARRIED)], selected: 2 },
      },
      world: { entityStates: { 'chemistry-lab/titration': { 'param.baseConcentration': 0.1 } } },
      progression: { completedExperiments: ['free-fall'], procedures: {} },
    };
    const parsed = parseSave(JSON.stringify(v3));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.value).toEqual({
      ...v3,
      version: 11,
      player: { ...v3.player, ...CHEMISTRY_DOOR },
      world: { ...v3.world, containers: {}, objects: {}, clockS: 300 },
      progression: { ...v3.progression, tasks: { active: null, done: [] }, papers: [], scores: [] },
    });
  });

  it('upgrades a version 4 save: no guided task followed or finished, everything else as it was', () => {
    const v4 = {
      version: 4,
      savedAt: '2026-11-02T00:00:00.000Z',
      player: {
        characterId: 'researcher-male',
        sceneId: 'chemistry-lab',
        position: [0.2, 0, -0.79],
        yaw: 0,
        pitch: -0.5,
        equipment: [],
        inventory: { stacks: [], selected: 0 },
      },
      world: {
        entityStates: { 'chemistry-lab/light-switch': { lightsOff: true } },
        containers: { [FLASK]: MID_FILL },
        objects: { [FLASK]: POSE },
      },
      progression: { completedExperiments: ['dilution'], procedures: {} },
    };
    const parsed = parseSave(JSON.stringify(v4));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.value).toEqual({
      ...v4,
      version: 11,
      player: { ...v4.player, ...CHEMISTRY_DOOR },
      world: { ...v4.world, objects: {}, clockS: 300 }, // v6: the flask goes home, still holding what it held
      progression: { ...v4.progression, tasks: { active: null, done: [] }, papers: [], scores: [] },
    });
  });

  it('upgrades a version 5 save (Phase L): in the labs, glass home, benches cleared, at the door', () => {
    const v5 = {
      version: 5,
      savedAt: '2026-11-03T00:00:00.000Z',
      player: {
        characterId: 'researcher-female',
        sceneId: 'biology-lab',
        position: [-1, 0, 1],
        yaw: 2,
        pitch: -0.4,
        equipment: ['lab-coat'],
        inventory: { stacks: [structuredClone(CARRIED)], selected: 1 },
      },
      world: {
        entityStates: {
          'chemistry-lab/titration': {
            'param.baseConcentration': 0.1,
            clamp: 'chemistry-lab/burette',
            clampRaised: true,
            'setup.fill-burette': true,
          },
          'chemistry-lab/burette': { tapOpen: true, seat: 'chemistry-lab/titration/clamp' },
          'projectile-range/launcher': { 'param.angle': 30, loaded: 'projectile-range/ball-1' },
          'chemistry-lab/light-switch': { lightsOff: true },
          'preparation-room/cabinet': { open: true, seat: 'kept' }, // not a lab: as it was
        },
        containers: { [FLASK]: MID_FILL },
        objects: { [FLASK]: POSE, 'preparation-room/beaker': POSE },
      },
      progression: {
        completedExperiments: ['dilution'],
        procedures: {},
        tasks: { active: { id: 'dilution-by-hand', step: 2 }, done: [] },
      },
    };
    const parsed = parseSave(JSON.stringify(v5));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.value).toEqual({
      ...v5,
      version: 11,
      player: { ...v5.player, position: [4, 0, 0], yaw: 1.5708, pitch: 0 },
      world: {
        clockS: 300, // v9: a game before the clock continues at 08:00
        entityStates: {
          'chemistry-lab/titration': { 'param.baseConcentration': 0.1 },
          'chemistry-lab/burette': {},
          // v7: the Physics wing's states reset
          'chemistry-lab/light-switch': { lightsOff: true },
          'preparation-room/cabinet': { open: true, seat: 'kept' },
        },
        containers: { [FLASK]: MID_FILL },
        objects: { 'preparation-room/beaker': POSE },
      },
      progression: { ...v5.progression, papers: [], scores: [] }, // v11: no paper, no mark
    });
    // Outside the labs nothing moves.
    const hub = parseSave(
      JSON.stringify({ ...v5, player: { ...v5.player, sceneId: 'simlab-hub' } }),
    );
    if (!hub.ok) throw new Error(hub.error);
    expect(hub.value.player).toEqual({ ...v5.player, sceneId: 'simlab-hub' });
  });

  it('upgrades a version 7 save (Phase U-2): at a lab’s hub door, moved objects home, settings kept', () => {
    const v7 = {
      version: 7,
      savedAt: '2026-11-05T00:00:00.000Z',
      player: {
        characterId: 'researcher-female',
        sceneId: 'chemistry-lab',
        position: [-3.4, 0, -1.5], // at the titration island of the smaller lab
        yaw: 0.4,
        pitch: -0.3,
        equipment: ['lab-coat'],
        inventory: { stacks: [], selected: 0 },
      },
      world: {
        entityStates: {
          'chemistry-lab/titration': { 'param.baseConcentration': 0.1 },
          'physics-lab/tower': { 'param.height': 2 },
        },
        containers: { [FLASK]: MID_FILL },
        objects: { [FLASK]: POSE, 'preparation-room/desk-lamp': POSE },
      },
      progression: {
        completedExperiments: ['dilution'],
        procedures: {},
        tasks: { active: null, done: [] },
        papers: [],
        scores: [],
      },
    };
    const parsed = parseSave(JSON.stringify(v7));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.value).toEqual({
      ...v7,
      version: 11,
      player: { ...v7.player, ...CHEMISTRY_DOOR },
      world: { ...v7.world, objects: { 'preparation-room/desk-lamp': POSE }, clockS: 300 },
    });
    // Outside the labs the player stays where they were.
    const hub = parseSave(
      JSON.stringify({ ...v7, player: { ...v7.player, sceneId: 'simlab-hub' } }),
    );
    if (!hub.ok) throw new Error(hub.error);
    expect(hub.value.player).toEqual({ ...v7.player, sceneId: 'simlab-hub' });
  });

  it('upgrades a version 6 save (Phase T-1a): in the Physics wing, at its door, its stations reset', () => {
    const v6 = {
      version: 6,
      savedAt: '2026-11-04T00:00:00.000Z',
      player: {
        characterId: 'researcher-male',
        sceneId: 'physics-lab',
        position: [3.2, 0, 7.3], // at the refraction desk on the old range
        yaw: 0,
        pitch: -0.3,
        equipment: [],
        inventory: { stacks: [], selected: 0 },
      },
      world: {
        entityStates: {
          'projectile-range/refraction': { 'param.index': 1.52 },
          'physics-lab/tower': { 'param.height': 2 },
          'pendulum-bay/pendulum': { 'param.length': 1 },
          'chemistry-lab/light-switch': { lightsOff: true },
        },
        containers: { [FLASK]: MID_FILL },
        objects: { 'projectile-range/ball-1': POSE, [FLASK]: POSE },
      },
      progression: {
        completedExperiments: ['refraction'],
        procedures: {},
        tasks: { active: null, done: [] },
        papers: [],
        scores: [],
      },
    };
    const parsed = parseSave(JSON.stringify(v6));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.value).toEqual({
      ...v6,
      version: 11,
      player: { ...v6.player, ...PHYSICS_DOOR },
      world: {
        clockS: 300, // v9: a game before the clock continues at 08:00
        entityStates: { 'chemistry-lab/light-switch': { lightsOff: true } },
        containers: { [FLASK]: MID_FILL },
        objects: {}, // v8: the Chemistry Lab larger, the flask goes home with what it holds
      },
    });
    // Elsewhere the player stays where they were.
    const hub = parseSave(
      JSON.stringify({ ...v6, player: { ...v6.player, sceneId: 'simlab-hub' } }),
    );
    if (!hub.ok) throw new Error(hub.error);
    expect(hub.value.player).toEqual({ ...v6.player, sceneId: 'simlab-hub' });
  });

  it('rejects a malformed task progress (ids are checked against the content when continued)', () => {
    const { saves } = setup();
    const good = saves.capture();
    const bad = (tasks: unknown) => {
      const data = structuredClone(good) as { progression: Record<string, unknown> };
      data.progression.tasks = tasks;
      return parseSave(JSON.stringify(data)).ok;
    };
    expect(bad({ active: null, done: [] })).toBe(true);
    expect(bad({ active: { id: 'dilution-by-hand', step: 3 }, done: ['glassware'] })).toBe(true);
    expect(bad({ active: { id: 'dilution-by-hand', step: -1 }, done: [] })).toBe(false);
    expect(bad({ active: { id: 'dilution-by-hand', step: 1.5 }, done: [] })).toBe(false);
    expect(bad({ done: [] })).toBe(false);
    expect(bad(undefined)).toBe(false);
  });

  it('rejects v4 contents that are not whole µL, and poses that are not a vector and a quaternion', () => {
    const { saves } = setup();
    const good = saves.capture();
    type World = {
      containers?: Record<string, { contents: Record<string, unknown>; closed?: boolean }>;
      objects: Record<string, { rotation: unknown }>;
    };
    const bad = (change: (world: World) => void) => {
      const data = structuredClone(good) as unknown as { world: World };
      change(data.world);
      return parseSave(JSON.stringify(data)).ok;
    };
    expect(bad(() => undefined)).toBe(true);
    expect(bad((w) => (w.containers![FLASK]!.contents.water = 21000.5))).toBe(false);
    expect(bad((w) => (w.containers![FLASK]!.contents.water = -1))).toBe(false);
    expect(bad((w) => (w.containers![FLASK]!.contents.water = '21 mL'))).toBe(false);
    expect(bad((w) => delete w.containers![FLASK]!.closed)).toBe(false);
    expect(bad((w) => (w.objects[FLASK]!.rotation = [0, 0, 1]))).toBe(false);
    expect(bad((w) => delete w.containers)).toBe(false);
  });

  it('rejects a malformed inventory (its ids and slots are checked when continued)', () => {
    const { saves } = setup();
    const good = saves.capture();
    const bad = (inventory: unknown, stack?: object) => {
      const data = structuredClone(good) as { player: Record<string, unknown> };
      data.player.inventory = stack
        ? { stacks: [{ ...CARRIED, ...stack }], selected: 0 }
        : inventory;
      return parseSave(JSON.stringify(data)).ok;
    };
    expect(bad(good.player.inventory)).toBe(true);
    expect(bad({ stacks: [{ ...CARRIED, slot: 40, item: 'gone' }], selected: 9 })).toBe(true);
    expect(bad('x')).toBe(false);
    expect(bad(undefined)).toBe(false);
    expect(bad({ stacks: {}, selected: 0 })).toBe(false);
    expect(bad({ stacks: [], selected: '0' })).toBe(false);
    expect(bad(null, { slot: 1.5 })).toBe(false);
    expect(bad(null, { item: '' })).toBe(false);
    expect(bad(null, { placements: [1] })).toBe(false);
    expect(bad(null, { placements: [''] })).toBe(false);
  });

  it('rejects a version 2 save with malformed equipment or procedure progress', () => {
    const { saves } = setup();
    const good = saves.capture();
    // Loosely typed copies, so each can be broken in a way the SaveData type would not allow.
    const bad = (patch: (d: { player: object; progression: object }) => void) => {
      const data = structuredClone(good);
      patch(data);
      return parseSave(JSON.stringify(data));
    };
    expect(bad((d) => Object.assign(d.player, { equipment: 'lab-coat' })).ok).toBe(false);
    expect(bad((d) => Object.assign(d.progression, { procedures: undefined })).ok).toBe(false);
    expect(
      bad((d) =>
        Object.assign(d.progression, {
          procedures: { 'cleanroom-entry': { completed: [], entered: 'yes' } },
        }),
      ).ok,
    ).toBe(false);
  });

  it('parses only valid JSON that matches the current schema', () => {
    expect(parseSave('not json')).toEqual({ ok: false, error: 'Save is not valid JSON' });
    const wrong = parseSave(JSON.stringify({ version: SAVE_VERSION, savedAt: 'x', player: {} }));
    expect(wrong.ok).toBe(false);
    expect(!wrong.ok && wrong.error).toMatch(/save\.player\.characterId/);
    expect(parseSave(JSON.stringify({ version: SAVE_VERSION + 1 })).ok).toBe(false);
  });
});
