import { z } from 'zod';
import { ENGLISH, type Texts } from '../core/i18n';
import type { Quat } from '../core/math';
import { fail, formatIssues, IdSchema, ok, type Result, Vec3Schema } from '../core/schema';
import { CharacterDefinitionSchema } from '../gameplay/character';

/**
 * Save format version. Changing SaveDataSchema in an incompatible way means: bump this, add a
 * migration from the previous version to SAVE_MIGRATIONS, and add a test that upgrades a
 * fixture of the old version.
 */
export const SAVE_VERSION = 11;

const QuatSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]) as z.ZodType<Quat>;

const EntityStateValueSchema = z.union([z.boolean(), z.number(), z.string()]);

/** A test paper (v11): see `PaperRecord` (game/GameState.ts). */
const PaperSchema = z.object({
  id: z.string().min(1),
  number: z.number().int().positive(),
  teacher: IdSchema,
  request: z.object({
    experiments: z.array(IdSchema),
    count: z.number().int().positive(),
    types: z.array(z.enum(['choice', 'true-false'])),
    levels: z.array(z.enum(['recognise', 'understand', 'apply', 'analyse'])),
    seed: z.number().int(),
  }),
  items: z.array(
    z.object({ experiment: IdSchema, question: IdSchema, order: z.array(z.number().int()) }),
  ),
  answers: z.array(z.union([z.number().int(), z.null(), z.array(z.boolean().nullable())])),
  crossed: z.array(z.array(z.number().int())),
  marked: z.object({ points: z.number(), max: z.number(), score: z.number() }).nullable(),
  writtenAtS: z.number(),
});

/** Plain serialisable data — never runtime objects, so saves survive code refactors. */
export const SaveDataSchema = z.object({
  version: z.literal(SAVE_VERSION),
  savedAt: z.string(),
  player: z.object({
    characterId: IdSchema,
    /** The player's own character (v10), when the game is played as it (`CUSTOM_ID`). */
    custom: CharacterDefinitionSchema.optional(),
    sceneId: IdSchema,
    position: Vec3Schema,
    yaw: z.number(),
    pitch: z.number(),
    /** Item ids worn (v2). */
    equipment: z.array(IdSchema),
    /**
     * What the player carries (v3): stacks by slot, each listing the placements (entity ids
     * `<room>/<placement>`) its items came from. Slots and ids are checked against the content
     * when the game is continued (InventorySystem.sanitize), so a bad entry never costs the save.
     */
    inventory: z.object({
      stacks: z.array(
        z.object({
          slot: z.number().int(),
          item: z.string().min(1),
          placements: z.array(z.string().min(1)),
        }),
      ),
      selected: z.number().int(),
    }),
  }),
  world: z.object({
    entityStates: z.record(z.string(), z.record(z.string(), EntityStateValueSchema)),
    /**
     * What each physical-lab container holds (v4): integer µL by material id — never a
     * concentration. Checked against the content when the game is continued (ContainerSave).
     */
    containers: z.record(
      z.string(),
      z.object({
        contents: z.record(z.string(), z.number().int().positive()),
        temperatureC: z.number(),
        closed: z.boolean(),
        mixed: z.boolean(),
      }),
    ),
    /** Where moved containers stand (v4), in their own scene's coordinates. Containers only. */
    objects: z.record(z.string(), z.object({ position: Vec3Schema, rotation: QuatSchema })),
    /** The time of day (v9): seconds into the game's day (world/clock.ts). */
    clockS: z.number().nonnegative(),
  }),
  progression: z.object({
    completedExperiments: z.array(IdSchema),
    /** Per procedure: completed step ids and whether its entrance was used (v2). */
    procedures: z.record(
      z.string(),
      z.object({ completed: z.array(IdSchema), entered: z.boolean() }),
    ),
    /**
     * Guided tasks (v5): the one followed and its step index, and the finished ones. Checked against
     * the content once the lab pack is in (TaskSystem): an unknown task or step is dropped.
     */
    tasks: z.object({
      active: z.object({ id: IdSchema, step: z.number().int().nonnegative() }).nullable(),
      done: z.array(IdSchema),
    }),
    /**
     * The hub teacher's test papers the player has (v11): their questions (bank ids, each choice
     * question's printed order), answers, crossed-out marks and mark. Checked against the banks
     * when they load (PaperSystem): a question no bank holds any more is left out.
     */
    papers: z.array(PaperSchema),
    /** The marks of every paper handed in (v11), kept after the paper is thrown away. */
    scores: z.array(
      z.object({
        paper: z.number().int(),
        experiments: z.array(IdSchema),
        points: z.number(),
        max: z.number(),
        score: z.number(),
      }),
    ),
  }),
});

export type SaveData = z.infer<typeof SaveDataSchema>;

export interface SaveMigration {
  /** Upgrades data of version `from` to `from + 1` (the runner sets `version`). */
  readonly from: number;
  migrate(data: Record<string, unknown>): Record<string, unknown>;
}

/** Ordered upgrades, one per version step. */
export const SAVE_MIGRATIONS: readonly SaveMigration[] = [
  {
    // v2 (Phase 5): equipment worn and procedure progress. A v1 player wore nothing and had
    // started no procedure.
    from: 1,
    migrate: (data) => ({
      ...data,
      player: { ...(isRecord(data.player) ? data.player : {}), equipment: [] },
      progression: { ...(isRecord(data.progression) ? data.progression : {}), procedures: {} },
    }),
  },
  {
    // v3 (inventory): what the player carries. A v2 player carried nothing.
    from: 2,
    migrate: (data) => ({
      ...data,
      player: {
        ...(isRecord(data.player) ? data.player : {}),
        inventory: { stacks: [], selected: 0 },
      },
    }),
  },
  {
    // v4 (physical lab): container contents and moved containers' poses. A v3 world had neither:
    // every container starts from its placement.
    from: 3,
    migrate: (data) => ({
      ...data,
      world: { ...(isRecord(data.world) ? data.world : {}), containers: {}, objects: {} },
    }),
  },
  {
    // v5 (guided tasks): which task is followed. A v4 player followed none and had finished none.
    from: 4,
    migrate: (data) => ({
      ...data,
      progression: {
        ...(isRecord(data.progression) ? data.progression : {}),
        tasks: { active: null, done: [] },
      },
    }),
  },
  {
    // v6 (Phase L, larger labs): a pose saved in the old layout would stand somewhere else. In the
    // labs' rooms, moved containers go home and the benches are cleared (what sits where, clamps,
    // taps, a loaded ball, setup steps); dials are kept. A player inside a lab stands at its hub
    // door. A migration is a snapshot of the change it crosses, so it names the rooms and the
    // spawns (each lab's, by its hub door: that wall did not move) as they were in v6.
    from: 5,
    migrate: (data) => {
      const world = isRecord(data.world) ? data.world : {};
      const player = isRecord(data.player) ? data.player : {};
      const inLabs = (id: string) => PHASE_L_ROOMS.some((room) => id.startsWith(`${room}/`));
      const spawn = PHASE_L_SPAWNS[String(player.sceneId)];
      return {
        ...data,
        player: spawn ? { ...player, ...spawn, pitch: 0 } : player,
        world: {
          ...world,
          entityStates: Object.fromEntries(
            Object.entries(isRecord(world.entityStates) ? world.entityStates : {}).map(
              ([id, states]) => [
                id,
                inLabs(id) && isRecord(states)
                  ? Object.fromEntries(Object.entries(states).filter(([key]) => !isBenchKey(key)))
                  : states,
              ],
            ),
          ),
          objects: Object.fromEntries(
            Object.entries(isRecord(world.objects) ? world.objects : {}).filter(
              ([id]) => !inLabs(id),
            ),
          ),
        },
      };
    },
  },
  {
    // v7 (Phase T-1a, the Physics wing rebuilt): its stations moved bench and room, so what a v6
    // save kept of them (dial settings, bench state, a moved object's pose) belongs to no bench
    // any more: their states are reset and moved objects go home (Phú, D6). A player inside the
    // wing stands at its hub door, its spawn (a snapshot, as in v6).
    from: 6,
    migrate: (data) => {
      const world = isRecord(data.world) ? data.world : {};
      const player = isRecord(data.player) ? data.player : {};
      const inWing = (id: string) => PHYSICS_WING_ROOMS.some((room) => id.startsWith(`${room}/`));
      const inScene = player.sceneId === 'physics-lab';
      return {
        ...data,
        player: inScene ? { ...player, position: [-4, 0, 0], yaw: -1.5708, pitch: 0 } : player,
        world: {
          ...world,
          entityStates: Object.fromEntries(
            Object.entries(isRecord(world.entityStates) ? world.entityStates : {}).filter(
              ([id]) => !inWing(id),
            ),
          ),
          objects: Object.fromEntries(
            Object.entries(isRecord(world.objects) ? world.objects : {}).filter(
              ([id]) => !inWing(id),
            ),
          ),
        },
      };
    },
  },
  {
    // v8 (Phase U-2, the three labs larger): their stations keep their ids and settings, but every
    // pose moved, so a moved object's saved pose (a flask set down elsewhere) would stand somewhere
    // else: it goes home. A player in a lab scene stands at its hub door, its spawn (as in v6).
    from: 7,
    migrate: (data) => {
      const world = isRecord(data.world) ? data.world : {};
      const player = isRecord(data.player) ? data.player : {};
      const moved = (id: string) => PHASE_U2_ROOMS.some((room) => id.startsWith(`${room}/`));
      const spawn = typeof player.sceneId === 'string' ? PHASE_L_SPAWNS[player.sceneId] : undefined;
      return {
        ...data,
        player: spawn
          ? { ...player, position: [...spawn.position], yaw: spawn.yaw, pitch: 0 }
          : player,
        world: {
          ...world,
          objects: Object.fromEntries(
            Object.entries(isRecord(world.objects) ? world.objects : {}).filter(
              ([id]) => !moved(id),
            ),
          ),
        },
      };
    },
  },
  {
    // v9 (Phase V, the time of day): a v8 game had none; it continues at 08:00, a new game's hour.
    from: 8,
    migrate: (data) => ({
      ...data,
      world: { ...(isRecord(data.world) ? data.world : {}), clockS: V9_START_S },
    }),
  },
  {
    // v10 (Phase C-9, the player's own character): a v9 game was played as one of the cast, so it
    // has none; nothing else changed.
    from: 9,
    migrate: (data) => data,
  },
  {
    // v11 (Phase Y-5, the hub teacher's tests): a v10 player had no test paper and no mark.
    from: 10,
    migrate: (data) => ({
      ...data,
      progression: {
        ...(isRecord(data.progression) ? data.progression : {}),
        papers: [],
        scores: [],
      },
    }),
  },
];

/** A new game's time of day when v9 came (08:00 of a 900 s day): a snapshot, as migrations are. */
const V9_START_S = 300;

/** The rooms Phase U-2 made larger or moved with them (v8). */
const PHASE_U2_ROOMS = [
  'physics-lab',
  'projectile-range',
  'pendulum-bay',
  'waves-optics',
  'chemistry-lab',
  'biology-lab',
];

/** The Physics wing's rooms in v6, before Phase T-1a rebuilt it. */
const PHYSICS_WING_ROOMS = ['physics-lab', 'projectile-range', 'pendulum-bay'];

/** The rooms Phase L moved things in (v6): the three labs, the Physics Lab's range and bay. */
const PHASE_L_ROOMS = [
  'physics-lab',
  'projectile-range',
  'pendulum-bay',
  'chemistry-lab',
  'biology-lab',
];
/** Each lab scene's spawn in v6 (scenes.json), by its hub door. */
const PHASE_L_SPAWNS: Readonly<Record<string, { position: number[]; yaw: number }>> = {
  'physics-lab': { position: [-4, 0, 0], yaw: -1.5708 },
  'chemistry-lab': { position: [0, 0, 3], yaw: 0 },
  'biology-lab': { position: [4, 0, 0], yaw: 1.5708 },
};
/** A station's bench state (StationSystem), not its configuration (`param.*`). */
const isBenchKey = (key: string) =>
  ['seat', 'clamp', 'clampRaised', 'tapOpen', 'loaded', 'run'].includes(key) ||
  key.startsWith('setup.');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Upgrades raw save JSON step by step to `target`. Saves from a newer game are rejected. */
export function migrateSave(
  raw: unknown,
  migrations: readonly SaveMigration[],
  target: number,
  texts: Texts = ENGLISH,
): Result<Record<string, unknown>> {
  if (!isRecord(raw) || typeof raw.version !== 'number' || !Number.isInteger(raw.version)) {
    return fail(texts.ui('save.noVersion', 'Save has no valid version number'));
  }
  let version = raw.version;
  if (version > target) {
    return fail(
      texts.ui(
        'save.tooNew',
        'Save version {version} is newer than this game supports ({target})',
        {
          version,
          target,
        },
      ),
    );
  }
  let data: Record<string, unknown> = raw;
  while (version < target) {
    const migration = migrations.find((m) => m.from === version);
    if (!migration) {
      return fail(
        texts.ui('save.noMigration', 'No migration from save version {version}', { version }),
      );
    }
    data = { ...migration.migrate(data), version: version + 1 };
    version++;
  }
  return ok(data);
}

export function parseSave(
  text: string,
  migrations: readonly SaveMigration[] = SAVE_MIGRATIONS,
  texts: Texts = ENGLISH,
): Result<SaveData> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail(texts.ui('save.notJson', 'Save is not valid JSON'));
  }
  const migrated = migrateSave(raw, migrations, SAVE_VERSION, texts);
  if (!migrated.ok) return migrated;
  const parsed = SaveDataSchema.safeParse(migrated.value);
  if (!parsed.success) {
    const issues = formatIssues(parsed.error, 'save').join('\n');
    return fail(texts.ui('save.invalid', 'Save data is invalid:\n{issues}', { issues }));
  }
  return ok(parsed.data);
}
