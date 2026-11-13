import { z } from 'zod';
import { containsXZ, type Vec3 } from '../core/math';
import { Registry } from '../core/Registry';
import { formatIssues, IdSchema } from '../core/schema';
import { type ActionSequence, ActionSequenceSchema } from '../gameplay/action/action';
import { type CharacterDefinition, CharacterDefinitionSchema } from '../gameplay/character';
import type { BehaviorDefinition } from '../gameplay/interaction/behaviors';
import { MAX_CARRIED_RADIUS } from '../gameplay/inventory/InventorySystem';
import { type ItemDefinition, ItemDefinitionSchema } from '../gameplay/item';
import { type NpcDefinition, NpcDefinitionSchema } from '../gameplay/npc/npc';
import { type TaskDefinition, TaskDefinitionSchema } from '../gameplay/task/task';
import { DECOR } from '../gameplay/props';
import {
  type ProcedureDefinition,
  ProcedureDefinitionSchema,
} from '../gameplay/procedure/procedure';
import {
  type ExperimentDefinition,
  ExperimentDefinitionSchema,
  leakIn,
  type TopicDefinition,
  TopicDefinitionSchema,
} from '../simulation/experiment';
import { checkQuestionSet, type QuestionSet, QuestionSetSchema } from '../simulation/questions';
import { checkExperimentAgainstModel } from '../simulation/ExperimentRuntime';
import { checkExample } from '../simulation/workedExample';
import { toUl } from '../simulation/liquid';
import type { SimulationModel } from '../simulation/SimulationModel';
import {
  type LaboratoryDefinition,
  LaboratoryDefinitionSchema,
  PlacementSchema,
  type RoomDefinition,
  RoomDefinitionSchema,
  type SceneDefinition,
  SceneDefinitionSchema,
  type Wall,
} from '../world/definitions';
import { arrivalPose, blockingPlacement, standsInside } from '../world/arrival';
import { LIGHT_SLOTS } from '../world/lighting';
import {
  alongX,
  campusOffsets,
  type DoorEnd,
  doorPairs,
  faceOf,
  pairOffset,
  translateRoom,
  wallOf,
} from '../world/campus';
import { leadsInto, WALL_THICKNESS, wallSpan } from '../world/roomGeometry';

/** Exact geometric equality in floating point (as in roomGeometry). */
const EPS = 1e-6;
/** How far (m) a walk-through door's leaf stands inside its wall face: two leaves and their wall
 * are 2 × this + one wall thickness deep, back to back. */
export const DOOR_INSET = 0.05;

/** A floor point's coordinate along a wall: x on north and south walls, z on east and west. */
const alongWall = ([x, , z]: Readonly<Vec3>, wall: Wall) => (alongX(wall) ? x : z);

/**
 * Whether (x, z), outside the room, stands in one of its openings: within the opening's width and
 * no deeper than the middle of the wall (a door between two rooms and its frame, Phase U).
 */
function inDoorway(room: RoomDefinition, x: number, z: number): boolean {
  const { min, max } = room.bounds;
  const half = WALL_THICKNESS / 2 + EPS;
  return room.openings.some(({ wall, center, width }) => {
    const along = alongX(wall) ? x : z;
    if (Math.abs(along - center) > width / 2 + EPS) return false;
    const depth =
      wall === 'north'
        ? min[2] - z
        : wall === 'south'
          ? z - max[2]
          : wall === 'west'
            ? min[0] - x
            : x - max[0];
    return depth > 0 && depth <= half;
  });
}

/** Unvalidated content the game boots with (`content/core.ts`), as loaded from JSON files. */
export interface CoreRawContent {
  characters: unknown;
  items: unknown;
  rooms: unknown;
  laboratories: unknown;
  scenes: unknown;
  procedures: unknown;
  strings: unknown;
  /** People of the world who are not the player (`npcs.json`, Phase Y); none when absent. */
  npcs?: unknown;
}

/** Unvalidated content of the lab pack (`content/lab.ts`): the experiments and their topics. */
export interface LabRawContent {
  experiments: unknown;
  topics: unknown;
  /** Guided tasks of the labs (`tasks.json`, Phase A). */
  tasks: unknown;
  /**
   * Actions acted out (`actions.json`, Phase H-3): with the pack, as every world waits for it,
   * so the menu never downloads them; none when absent (a fixture).
   */
  actions?: unknown;
}

/**
 * Unvalidated content as loaded from JSON files, all of it: the core and the lab pack's, its items
 * among the core's and its placements in their rooms (`content/index.ts`, the tests' fixtures).
 */
export type RawContent = CoreRawContent &
  LabRawContent & {
    /** Question banks, one per experiment (`content/questions.ts`, Phase Y-4); none when absent. */
    questions?: unknown;
  };

/** The lab pack (`game/labPack.ts`): its content, unvalidated, and the simulation models. */
export interface LabPack extends LabRawContent {
  /** The items only the labs place (`items.json`), added to the core's. */
  items: unknown;
  /** The labs' placements by room (`lab-placements.json`), added to rooms of the core. */
  placements: unknown;
  models: readonly SimulationModel[];
}

/** `lab-placements.json`: placements the lab pack adds to a room of the core content. */
const LabPlacementsSchema = z.array(
  z.object({ room: IdSchema, placements: z.array(PlacementSchema) }),
);

/**
 * Translations of the interface's text, by language and key; its English is written in the code
 * that shows it. Content text is translated in the content files themselves (`"vi": {…}`).
 */
const StringsSchema = z.object({ vi: z.record(z.string().min(1), z.string().min(1)) });
export type Strings = z.infer<typeof StringsSchema>;

/** Validated, cross-checked content. Every id reference inside it is known to resolve. */
export interface Content {
  characters: Registry<CharacterDefinition>;
  items: Registry<ItemDefinition>;
  rooms: Registry<RoomDefinition>;
  laboratories: Registry<LaboratoryDefinition>;
  scenes: Registry<SceneDefinition>;
  experiments: Registry<ExperimentDefinition>;
  procedures: Registry<ProcedureDefinition>;
  topics: Registry<TopicDefinition>;
  /** Question banks by experiment id (Phase Y-4). */
  questions: Registry<QuestionSet>;
  tasks: Registry<TaskDefinition>;
  actions: Registry<ActionSequence>;
  npcs: Registry<NpcDefinition>;
  strings: Strings;
}

/** Code-side registries content refers to by id. */
export interface CodeRegistries {
  behaviors: Registry<BehaviorDefinition>;
  models: Registry<SimulationModel>;
}

export class ContentError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Game content is invalid (${problems.length} problem(s)):\n${problems.join('\n')}`);
    this.name = 'ContentError';
  }
}

/**
 * Validates every definition and every cross-reference up front, reporting all problems at
 * once, so broken data fails with a precise path instead of misbehaving in play. All the content
 * at once: the tests' check of everything bundled. The game splits it: `buildCoreContent` at boot,
 * `addLabContent` when the lab pack loads — the same checks, each before its content is used.
 */
export function buildContent(raw: RawContent, code: CodeRegistries): Content {
  return validate(raw, code, true);
}

/**
 * The core content, validated and cross-checked at boot: everything but the lab pack's, whose
 * registries (`experiments`, `topics`) stay empty, and whose items and placements are not there,
 * until `addLabContent` adds them — references to them are checked then.
 */
export function buildCoreContent(raw: CoreRawContent, code: CodeRegistries): Content {
  return validate(
    { ...raw, experiments: [], topics: [], tasks: [], actions: [], questions: [] },
    code,
    false,
  );
}

/**
 * Validates the lab pack — its experiments, topics, models, items and placements — against the
 * core content: every check of `buildContent` runs again on the core with the pack added (rooms
 * with their stations, doors with what stands by them), all problems at once. Only then does it
 * add them to the registries, and the placements to the rooms, the systems already hold.
 */
export function addLabContent(content: Content, code: CodeRegistries, pack: LabPack): void {
  const problems: string[] = [];
  const items = parseList(problems, 'items', 'item', ItemDefinitionSchema, pack.items);
  const placed = LabPlacementsSchema.safeParse(pack.placements);
  if (!placed.success) problems.push(...formatIssues(placed.error, 'lab-placements'));
  const added = placed.success ? placed.data : [];
  for (const item of items.all()) {
    if (content.items.has(item.id)) problems.push(`items: duplicate id "${item.id}"`);
  }
  added.forEach(({ room }, i) => {
    if (!content.rooms.has(room)) problems.push(`lab-placements.${i}.room: unknown room "${room}"`);
  });
  // Doors are paired and the campus laid out once, at boot, from the core rooms.
  added.forEach(({ placements }, i) => {
    placements.forEach((p, j) => {
      const item = content.items.tryGet(p.item) ?? items.tryGet(p.item);
      if (item && (item.door !== undefined || item.interactions.includes('travel'))) {
        problems.push(
          `lab-placements.${i}.placements.${j}: "${p.id}" is a door: doors are paired at boot, place it in rooms.json`,
        );
      }
    });
  });
  const experiments = parseList(
    problems,
    'experiments',
    'experiment',
    ExperimentDefinitionSchema,
    pack.experiments,
  );
  const topics = parseList(problems, 'topics', 'topic', TopicDefinitionSchema, pack.topics);
  const tasks = parseList(problems, 'tasks', 'task', TaskDefinitionSchema, pack.tasks);
  const actions = parseList(
    problems,
    'actions',
    'action',
    ActionSequenceSchema,
    pack.actions ?? [],
  );
  for (const action of actions.all()) {
    if (content.actions.has(action.id)) problems.push(`actions: duplicate id "${action.id}"`);
  }
  if (problems.length > 0) throw new ContentError(problems);
  const extra = (roomId: string) => added.flatMap((a) => (a.room === roomId ? a.placements : []));
  // The core as it will be with the pack, in copies: nothing changes unless all of it passes.
  const lab: Content = {
    ...content,
    items: new Registry('item', [...content.items.all(), ...items.all()]),
    rooms: new Registry(
      'room',
      content.rooms.all().map((r) => ({ ...r, placements: [...r.placements, ...extra(r.id)] })),
    ),
    experiments,
    topics,
    tasks,
  };
  const models = new Registry('simulation model', pack.models);
  problems.push(...check(lab, { ...code, models }, true));
  if (problems.length > 0) throw new ContentError(problems);
  for (const model of models.all()) code.models.add(model);
  for (const item of items.all()) content.items.add(item);
  for (const room of content.rooms.all()) room.placements.push(...extra(room.id));
  for (const experiment of experiments.all()) content.experiments.add(experiment);
  for (const topic of topics.all()) content.topics.add(topic);
  for (const task of tasks.all()) content.tasks.add(task);
  for (const action of actions.all()) content.actions.add(action);
}

/**
 * Validates the question banks (Phase Y-4) against the content with its lab pack — each an
 * experiment's, its numbers its model's — and only then adds them to `content.questions`. The
 * game loads them on their own, the first time a test is set (`Game.loadQuestions`).
 */
export function addQuestionBanks(content: Content, code: CodeRegistries, raw: unknown): void {
  const problems: string[] = [];
  const banks = parseList(problems, 'questions', 'question set', QuestionSetSchema, raw);
  for (const set of banks.all()) {
    if (content.questions.has(set.id)) problems.push(`questions: duplicate id "${set.id}"`);
  }
  if (problems.length === 0)
    problems.push(...questionProblems({ ...content, questions: banks }, code));
  if (problems.length > 0) throw new ContentError(problems);
  for (const set of banks.all()) content.questions.add(set);
}

/** The question banks' problems: each an experiment's, its numbers its model's (`checkQuestionSet`). */
function questionProblems(c: Content, code: CodeRegistries): string[] {
  const problems: string[] = [];
  for (const set of c.questions.all()) {
    const where = `questions.${set.id}`;
    const experiment = c.experiments.tryGet(set.id);
    const model = experiment ? code.models.tryGet(experiment.model) : undefined;
    if (!experiment) {
      problems.push(`${where}: no experiment "${set.id}" to ask about`);
      continue;
    }
    if (!model) continue; // its unknown model is reported with the experiment
    for (const problem of checkQuestionSet(experiment, model, set)) {
      problems.push(`${where}: ${problem}`);
    }
  }
  return problems;
}

/**
 * A guided task's references: its room, every step object placed in it, a station step's station
 * an experiment's apparatus there and, for `setup`, a setup step of that experiment.
 */
function taskProblems(c: Content): string[] {
  const problems: string[] = [];
  for (const task of c.tasks.all()) {
    const where = `tasks.${task.id}`;
    const room = c.rooms.tryGet(task.room);
    if (!room) {
      problems.push(`${where}.room: unknown room "${task.room}"`);
      continue;
    }
    const placed = (id: string) => room.placements.find((p) => p.id === id);
    task.steps.forEach((step, i) => {
      for (const id of step.objects) {
        if (!placed(id))
          problems.push(`${where}.steps.${i}.objects: "${id}" is not placed in ${room.id}`);
      }
      const { done } = step;
      if (!('station' in done)) return;
      const experimentId = placed(done.station)?.params.experimentId;
      const experiment =
        typeof experimentId === 'string' ? c.experiments.tryGet(experimentId) : undefined;
      if (!experiment) {
        problems.push(
          `${where}.steps.${i}.done.station: "${done.station}" is no experiment's apparatus`,
        );
      } else if (done.kind === 'setup') {
        for (const step of [done.step, ...(done.or ?? [])]) {
          if (!experiment.workspace?.setup.some((s) => s.id === step)) {
            problems.push(
              `${where}.steps.${i}.done.step: ${experiment.id} has no setup step "${step}"`,
            );
          }
        }
      }
    });
  }
  return problems;
}

/** Every cross-check, in order: each later one only means something once the earlier pass. */
function check(c: Content, code: CodeRegistries, withLab: boolean): string[] {
  const problems = checkReferences(c, code, withLab);
  if (problems.length === 0) problems.push(...checkRoomLights(c));
  // The campus only means something once every reference resolves.
  if (problems.length === 0) problems.push(...checkWalkThrough(c));
  return problems;
}

/** `withLab` false: the lab pack's content is not there yet, and nothing is checked against it. */
function validate(raw: RawContent, code: CodeRegistries, withLab: boolean): Content {
  const problems: string[] = [];
  const content: Content = {
    characters: parseList(
      problems,
      'characters',
      'character',
      CharacterDefinitionSchema,
      raw.characters,
    ),
    items: parseList(problems, 'items', 'item', ItemDefinitionSchema, raw.items),
    rooms: parseList(problems, 'rooms', 'room', RoomDefinitionSchema, raw.rooms),
    laboratories: parseList(
      problems,
      'laboratories',
      'laboratory',
      LaboratoryDefinitionSchema,
      raw.laboratories,
    ),
    scenes: parseList(problems, 'scenes', 'scene', SceneDefinitionSchema, raw.scenes),
    experiments: parseList(
      problems,
      'experiments',
      'experiment',
      ExperimentDefinitionSchema,
      raw.experiments,
    ),
    procedures: parseList(
      problems,
      'procedures',
      'procedure',
      ProcedureDefinitionSchema,
      raw.procedures,
    ),
    topics: parseList(problems, 'topics', 'topic', TopicDefinitionSchema, raw.topics),
    questions: parseList(
      problems,
      'questions',
      'question set',
      QuestionSetSchema,
      raw.questions ?? [],
    ),
    tasks: parseList(problems, 'tasks', 'task', TaskDefinitionSchema, raw.tasks),
    actions: parseList(problems, 'actions', 'action', ActionSequenceSchema, raw.actions ?? []),
    npcs: parseList(problems, 'npcs', 'npc', NpcDefinitionSchema, raw.npcs ?? []),
    strings: parseStrings(raw.strings, problems),
  };
  if (problems.length === 0) problems.push(...check(content, code, withLab));
  if (problems.length > 0) throw new ContentError(problems);
  return content;
}

/** One file's definitions by id, its problems (schema, duplicate ids) into `problems`. */
function parseList<T extends { id: string }>(
  problems: string[],
  file: string,
  kind: string,
  schema: z.ZodType<T>,
  data: unknown,
): Registry<T> {
  const registry = new Registry<T>(kind);
  const parsed = z.array(schema).safeParse(data);
  if (!parsed.success) {
    problems.push(...formatIssues(parsed.error, file));
    return registry;
  }
  for (const definition of parsed.data) {
    if (registry.has(definition.id)) problems.push(`${file}: duplicate id "${definition.id}"`);
    else registry.add(definition);
  }
  return registry;
}

/**
 * Every cross-reference. Without the lab (`withLab` false, at boot) the experiments and topics are
 * empty: the checks that need them find nothing to check, and references to an experiment wait.
 */
function checkReferences(c: Content, code: CodeRegistries, withLab: boolean): string[] {
  const problems: string[] = [];
  const need = (registry: Registry<{ readonly id: string }>, id: string, where: string) => {
    if (!registry.has(id)) problems.push(`${where}: unknown ${registry.kind} "${id}"`);
  };

  for (const item of c.items.all()) {
    for (const id of item.interactions) {
      const behavior = code.behaviors.tryGet(id);
      const problem = behavior ? (behavior.check?.(item) ?? null) : `unknown behaviour "${id}"`;
      if (problem) problems.push(`items.${item.id}.interactions: ${problem}`);
    }
    const carry = item.inventory ? carryProblem(item) : null;
    if (carry) problems.push(`items.${item.id}.inventory: ${carry}`);
    item.seats?.forEach(({ accepts }, i) => {
      for (const tag of accepts) {
        if (!c.items.all().some((other) => other.tags.includes(tag))) {
          problems.push(`items.${item.id}.seats.${i}.accepts: no item has the tag "${tag}"`);
        }
      }
    });
    // Decor is only looked at: nothing to do with it, never moved, nothing live on it.
    const { interactions, physical, visual } = item;
    const live = visual.screen ?? visual.stream ?? visual.openBox ?? item.hinged;
    if (
      item.tags.includes(DECOR) &&
      (interactions.length > 0 || physical.body === 'dynamic' || live)
    ) {
      problems.push(
        `items.${item.id}.tags: decor has no interactions, is not dynamic and has no screen, ` +
          'stream or open box',
      );
    }
  }

  for (const room of c.rooms.all()) {
    room.openings.forEach((opening, i) => {
      const where = `rooms.${room.id}.openings.${i}`;
      const [start, end] = wallSpan(room, opening.wall);
      const { center, width, height } = opening;
      const roomHeight = room.bounds.max[1] - room.bounds.min[1];
      if (center - width / 2 < start || center + width / 2 > end || height > roomHeight) {
        problems.push(`${where}: does not fit in the ${opening.wall} wall`);
      }
      const overlaps = room.openings.some(
        (o, j) =>
          j < i && o.wall === opening.wall && Math.abs(o.center - center) < (o.width + width) / 2,
      );
      if (overlaps) problems.push(`${where}: overlaps another opening in the same wall`);
    });
    const seen = new Set<string>();
    for (const placement of room.placements) {
      const where = `rooms.${room.id}.placements.${placement.id}`;
      if (seen.has(placement.id)) problems.push(`${where}: duplicate placement id`);
      seen.add(placement.id);
      const [px, , pz] = placement.position;
      if (!containsXZ(room.bounds, px, pz) && !inDoorway(room, px, pz)) {
        problems.push(`${where}: position is outside the room bounds`);
      }
      const item = c.items.tryGet(placement.item);
      if (!item) {
        problems.push(`${where}: unknown item "${placement.item}"`);
        continue;
      }
      // A bench's desk lists every parameter, then every shown input not kept off it (`desk:
      // false`), in six rows: four parameters at most.
      const bench = item.bench && c.experiments.tryGet(String(placement.params.experimentId));
      const n = bench ? bench.parameters.length : 0;
      const onDesk = bench ? Object.values(bench.inputs).filter((i) => i.desk !== false).length : 0;
      if (bench && (n > 4 || n + onDesk > 6)) {
        problems.push(`${where}: "${bench.id}" overfills its desk: 4 dials, 6 rows`);
      }
      if (withLab && item.container) {
        problems.push(...containerProblems(c, room, placement, item).map((p) => `${where}: ${p}`));
      }
      for (const behaviorId of item.interactions) {
        const behavior = code.behaviors.tryGet(behaviorId);
        if (!behavior) continue;
        const params = behavior.params.safeParse(placement.params);
        if (!params.success) {
          problems.push(...formatIssues(params.error, `${where}.params[${behaviorId}]`));
          continue;
        }
        for (const ref of behavior.references?.(params.data) ?? []) {
          if (ref.kind === 'placement') {
            if (!room.placements.some((other) => other.id === ref.id)) {
              problems.push(`${where}.params: no placement "${ref.id}" in room "${room.id}"`);
            }
          } else if (ref.kind === 'arrival') {
            const problem = checkArrival(c, ref.id, ref.scene ?? '');
            if (problem) problems.push(`${where}.params.arrival: ${problem}`);
          } else if (ref.kind === 'station') {
            const problem = checkStation(c, room, ref.id, ref.parameter);
            if (problem) problems.push(`${where}.params: ${problem}`);
          } else if (ref.kind === 'scene' || withLab) {
            need(ref.kind === 'scene' ? c.scenes : c.experiments, ref.id, `${where}.params`);
            const experiment = ref.workspace ? c.experiments.tryGet(ref.id) : undefined;
            if (experiment?.presentation === 'physical-3d') {
              problems.push(`${where}.params[${behaviorId}]: "${ref.id}" has no workspace`);
            }
          }
        }
      }
    }
  }

  for (const lab of c.laboratories.all()) {
    const where = `laboratories.${lab.id}`;
    for (const id of lab.rooms) need(c.rooms, id, `${where}.rooms`);
    // Its equipment and experiments are the lab pack's.
    if (withLab) for (const id of lab.equipment) need(c.items, id, `${where}.equipment`);
    if (withLab) for (const id of lab.experiments) need(c.experiments, id, `${where}.experiments`);
  }

  problems.push(...taskProblems(c));

  const classified = new Set<string>();
  for (const topic of c.topics.all()) {
    const where = `topics.${topic.id}.experiments`;
    for (const id of topic.experiments) {
      need(c.experiments, id, where);
      const category = c.experiments.tryGet(id)?.category;
      if (category && category !== topic.subject) {
        problems.push(`${where}: "${id}" is a ${category} experiment, not ${topic.subject}`);
      }
      classified.add(id);
    }
  }
  for (const experiment of c.experiments.all()) {
    if (!classified.has(experiment.id)) problems.push(`experiments.${experiment.id}: in no topic`);
  }
  problems.push(...questionProblems(c, code));

  for (const experiment of c.experiments.all()) {
    const where = `experiments.${experiment.id}`;
    for (const id of experiment.requiredEquipment) need(c.items, id, `${where}.requiredEquipment`);
    experiment.procedure.forEach((step, i) => {
      if (step.done.kind === 'inspected') need(c.items, step.done.item, `${where}.procedure.${i}`);
    });
    const model = code.models.tryGet(experiment.model);
    if (!model) {
      problems.push(`${where}.model: unknown simulation model "${experiment.model}"`);
      continue;
    }
    for (const problem of checkExperimentAgainstModel(experiment, model)) {
      problems.push(`${where}: ${problem}`);
    }
    // Worked examples (Phase Y-3): their answers are the model's, each step checked against it.
    for (const example of experiment.examples) {
      for (const problem of checkExample(experiment, model, example)) {
        problems.push(`${where}: ${problem}`);
      }
    }
    // An inversion turns a stoppered vessel: some closable container must be that piece.
    experiment.workspace?.setup.forEach((step, i) => {
      if (step.by !== 'invert') return;
      const closable = c.rooms
        .all()
        .some((room) =>
          room.placements.some(
            (p) =>
              p.params.piece === step.place &&
              c.items.tryGet(p.item)?.container?.closable === true &&
              stationOf(c, room, p)?.id === experiment.id,
          ),
        );
      if (withLab && !closable) {
        problems.push(`${where}.workspace.setup.${i}: no closable container is "${step.place}"`);
      }
    });
    // What a workspace piece shows from the model (other bindings: the definition's own check).
    experiment.workspace?.pieces.forEach((piece, i) => {
      for (const binding of piece.shows) {
        if ('variable' in binding && !model.variables.includes(binding.variable)) {
          problems.push(
            `${where}.workspace.pieces.${i}: shows unknown model variable "${binding.variable}"`,
          );
        }
      }
    });
  }

  // A room is in one world scene: where a station stands is then never ambiguous.
  const sceneOfRoom = new Map<string, string>();
  for (const scene of c.scenes.all()) {
    if (scene.kind !== 'world') continue;
    const where = `scenes.${scene.id}`;
    for (const id of scene.rooms) {
      need(c.rooms, id, `${where}.rooms`);
      const other = sceneOfRoom.get(id);
      if (other) problems.push(`${where}.rooms: "${id}" is already in scene "${other}"`);
      else sceneOfRoom.set(id, scene.id);
    }
    const [x, , z] = scene.spawn.position;
    const spawnRoom = scene.rooms
      .flatMap((id) => c.rooms.tryGet(id) ?? [])
      .find((room) => containsXZ(room.bounds, x, z));
    if (!spawnRoom) {
      problems.push(`${where}.spawn: position is not inside any of the scene's rooms`);
    } else {
      const problem = standProblem(c, spawnRoom, x, z);
      if (problem) problems.push(`${where}.spawn: ${problem}`);
    }
    // An opening must lie on a wall shared with another room of the scene, which has the same
    // opening, or be the doorway behind a walk-through door (into another scene: checked with the
    // campus); otherwise it would look into the void.
    const sceneRooms = scene.rooms.flatMap((id) => c.rooms.tryGet(id) ?? []);
    for (const room of sceneRooms) {
      const glass = room.glassFloor;
      const { min, max } = room.bounds;
      if (
        glass &&
        (glass.x[0] < min[0] || glass.x[1] > max[0] || glass.z[0] < min[2] || glass.z[1] > max[2])
      ) {
        problems.push(`${where}: rooms.${room.id}.glassFloor is not inside the room`);
      }
      room.openings.forEach((opening, i) => {
        const behindDoor = room.placements.some(
          (p) =>
            c.items.tryGet(p.item)?.door !== undefined &&
            wallOf(room, p.position) === opening.wall &&
            Math.abs(alongWall(p.position, opening.wall) - opening.center) < EPS,
        );
        if (
          !behindDoor &&
          !sceneRooms.some((other) => other !== room && leadsInto(room, opening, other))
        ) {
          problems.push(
            `${where}: rooms.${room.id}.openings.${i} (${opening.wall} wall) does not lead into ` +
              `another room of the scene (same opening, ${WALL_THICKNESS} m away)`,
          );
        }
      });
    }
  }
  for (const procedure of c.procedures.all()) {
    problems.push(...checkProcedure(procedure, c, code));
  }
  // People (Phase Y): in a known scene, each stop of their day on a floor of it.
  for (const npc of c.npcs.all()) {
    const where = `npcs.${npc.id}`;
    if (!c.scenes.has(npc.scene)) {
      need(c.scenes, npc.scene, `${where}.scene`);
      continue;
    }
    const scene = c.scenes.get(npc.scene);
    const rooms =
      scene.kind === 'world' ? scene.rooms.flatMap((id) => c.rooms.tryGet(id) ?? []) : [];
    npc.schedule.forEach(({ at: [x, z] }, i) => {
      if (!rooms.some((room) => containsXZ(room.bounds, x, z))) {
        problems.push(`${where}.schedule.${i}: (${x}, ${z}) is in no room of scene "${npc.scene}"`);
      }
    });
    need(c.items, npc.character.outfit.default, `${where}.character.outfit.default`);
    // A test paper is carried only in the bag (Phase Y-5).
    const paper = npc.test ? c.items.tryGet(npc.test.paperItem) : undefined;
    if (npc.test && !paper?.inventory?.virtual) {
      problems.push(
        `${where}.test.paperItem: "${npc.test.paperItem}" is no item carried only in the bag`,
      );
    }
  }
  return problems;
}

/** The experiment of a container's station: its `station` placement's, else its own (an apparatus). */
function stationOf(
  c: Content,
  room: RoomDefinition,
  placement: RoomDefinition['placements'][number],
): ExperimentDefinition | undefined {
  const { station } = placement.params;
  const apparatus =
    typeof station === 'string' ? room.placements.find((p) => p.id === station) : placement;
  const id = apparatus?.params.experimentId;
  return typeof id === 'string' ? c.experiments.tryGet(id) : undefined;
}

/**
 * A container placed for a physical-lab station (`docs/physical-lab-architecture.md` §2.3): its
 * `piece` and `material` are the station's experiment's, its `fill` (an AFFORDANCE bookkeeping
 * volume) is whole µL of its material within its mark, a mark or measure equals the mL its
 * material sets (one source for a model input), and no text bound to it shows a hidden value.
 */
function containerProblems(
  c: Content,
  room: RoomDefinition,
  placement: RoomDefinition['placements'][number],
  item: ItemDefinition,
): string[] {
  const container = item.container;
  const { piece, material, fill } = placement.params;
  if (!container || piece === undefined) return []; // not bound to a station: a prop
  const experiment = stationOf(c, room, placement);
  const workspace = experiment?.workspace;
  if (!experiment || !workspace || experiment.presentation !== 'physical-lab') {
    return ['a container with a "piece" belongs to a "physical-lab" station'];
  }
  const problems: string[] = [];
  if (!workspace.pieces.some((p) => p.id === piece)) {
    problems.push(`"${String(piece)}" is no piece of "${experiment.id}"`);
  }
  const bound = workspace.materials.find((m) => m.id === material);
  if (material !== undefined && !bound) {
    problems.push(`"${String(material)}" is no material of "${experiment.id}"`);
  }
  if (fill !== undefined) {
    const limit = container.fillLimitMl ?? container.capacityMl;
    let ok = typeof fill === 'number' && material !== undefined && fill <= limit;
    try {
      toUl(Number(fill));
    } catch {
      ok = false;
    }
    if (!ok) problems.push(`fill ${String(fill)} mL: whole µL of its material, up to ${limit} mL`);
  }
  const volume = container.measured?.volumeMl ?? container.fillLimitMl;
  const sets = bound?.sets;
  if (volume !== undefined && sets) {
    const unit = experiment.parameters.find((p) => p.id === sets.parameter)?.unit;
    if (unit !== 'mL' || sets.value !== volume) {
      problems.push(
        `its ${volume} mL mark is not what "${bound.id}" sets (${sets.value} ${unit ?? ''})`,
      );
    }
  }
  const texts = [
    ...Object.values(placement.params).filter((v): v is string => typeof v === 'string'),
    ...(bound ? [bound.label, bound.vi?.label, bound.formula] : []),
    item.description,
    item.vi?.description,
  ];
  for (const text of texts) {
    const leak = text === undefined ? null : leakIn(experiment, text);
    if (leak) problems.push(`a text bound to it ${leak}`);
  }
  return problems;
}

/** The translations, or none with the problems reported (the boot stops on any). */
function parseStrings(data: unknown, problems: string[]): Strings {
  const parsed = StringsSchema.safeParse(data);
  if (parsed.success) return parsed.data;
  problems.push(...formatIssues(parsed.error, 'strings'));
  return { vi: {} };
}

/**
 * Why an item cannot be carried in the inventory, or null: it is put away from the hands (so it
 * can be grabbed), taken out inside the player's capsule (so it is small), and PPE is worn.
 */
function carryProblem(item: ItemDefinition): string | null {
  if (item.category === 'ppe') return 'PPE is worn, never carried';
  if (item.inventory?.virtual) return null; // only in the bag: never grabbed or taken out
  if (!item.interactions.includes('grab')) return 'needs the "grab" interaction';
  return Math.hypot(...item.visual.size) / 2 > MAX_CARRIED_RADIUS
    ? `too big to carry: half its diagonal must be at most ${MAX_CARRIED_RADIUS} m`
    : null;
}

/**
 * A control's station must be an apparatus (launcher, pendulum, dropTower, springStand or bench
 * geometry) in the same room; a dial's parameter must be one of that station's experiment
 * parameters.
 */
function checkStation(
  c: Content,
  room: RoomDefinition,
  placementId: string,
  parameter: string | undefined,
): string | null {
  const station = room.placements.find((p) => p.id === placementId);
  if (!station) return `no placement "${placementId}" in room "${room.id}"`;
  const apparatus = c.items.tryGet(station.item);
  const { launcher, pendulum, dropTower, springStand, bench } = apparatus ?? {};
  if (!launcher && !pendulum && !dropTower && !springStand && !bench) {
    return `"${placementId}" is not an experiment apparatus`;
  }
  const experiment = c.experiments.tryGet(String(station.params.experimentId));
  if (parameter === undefined || !experiment) return null; // a bad experiment id is reported on the station
  return experiment.parameters.some((p) => p.id === parameter)
    ? null
    : `station "${placementId}" (${experiment.id}) has no parameter "${parameter}"`;
}

/** Why the player could not stand at (x, z) in `room` (wall or solid object too close), or null. */
function standProblem(c: Content, room: RoomDefinition, x: number, z: number): string | null {
  if (!standsInside(room, x, z)) return 'too close to a wall of the room';
  const blocker = blockingPlacement(room, (id) => c.items.tryGet(id), x, z);
  return blocker ? `overlaps placement "${blocker}"` : null;
}

/**
 * A door's arrival must name a door (a placement offering travel) in a room of the target scene
 * whose inside face can be told, with free floor in front of it.
 */
function checkArrival(c: Content, entityId: string, sceneId: string): string | null {
  const scene = c.scenes.tryGet(sceneId);
  if (scene?.kind !== 'world') return null; // the scene reference reports this
  const slash = entityId.indexOf('/');
  const roomId = entityId.slice(0, slash);
  const room = scene.rooms.includes(roomId) ? c.rooms.tryGet(roomId) : undefined;
  const door = room?.placements.find((p) => p.id === entityId.slice(slash + 1));
  if (!room || !door) return `"${entityId}" is not a placement in scene "${sceneId}"`;
  if (!c.items.tryGet(door.item)?.interactions.includes('travel')) {
    return `"${entityId}" is not a door`;
  }
  const pose = arrivalPose(room, door);
  if (typeof pose === 'string') return `cannot arrive at "${entityId}": ${pose}`;
  const problem = standProblem(c, room, pose.position[0], pose.position[2]);
  return problem ? `the arrival point in front of "${entityId}" ${problem}` : null;
}

/**
 * A procedure must be doable: its scene is a world scene, its entrance is a door placed in that
 * scene, and every item it names — equipment, step targets, conditions — is placed in that scene
 * with the behaviour (and action) the step needs.
 */
function checkProcedure(p: ProcedureDefinition, c: Content, code: CodeRegistries): string[] {
  const where = `procedures.${p.id}`;
  const scene = c.scenes.tryGet(p.scene);
  if (scene?.kind !== 'world') return [`${where}.scene: "${p.scene}" is not a world scene`];
  const placed = scene.rooms
    .flatMap((id) => c.rooms.tryGet(id) ?? [])
    .flatMap((room) => room.placements.map((placement) => ({ room, placement })));
  /** Action ids offered by placements of `itemId` in the scene. */
  const actionsOf = (itemId: string, roomPlacement?: string): string[] =>
    placed
      .filter(({ room, placement }) =>
        roomPlacement ? `${room.id}/${placement.id}` === roomPlacement : placement.item === itemId,
      )
      .flatMap(({ placement }) => {
        const item = c.items.tryGet(placement.item);
        return (item?.interactions ?? []).flatMap((id) => {
          const behavior = code.behaviors.tryGet(id);
          const params = behavior?.params.safeParse(placement.params);
          return behavior && params?.success ? behavior.actionIds(params.data) : [];
        });
      });
  const problems: string[] = [];
  if (!actionsOf('', p.entrance).includes('travel')) {
    problems.push(`${where}.entrance: "${p.entrance}" is not a door placed in scene "${p.scene}"`);
  }
  p.exits.forEach((door, i) => {
    if (door === p.entrance) problems.push(`${where}.exits.${i}: "${door}" is the entrance`);
    else if (!actionsOf('', door).includes('travel')) {
      problems.push(`${where}.exits.${i}: "${door}" is not a door placed in scene "${p.scene}"`);
    }
  });
  const wearable = (itemId: string, path: string) => {
    if (!actionsOf(itemId).includes('wear')) {
      problems.push(`${path}: "${itemId}" is not wearable equipment placed in the scene`);
    }
  };
  const isPlaced = (itemId: string, path: string) => {
    if (!placed.some(({ placement }) => placement.item === itemId)) {
      problems.push(`${path}: no "${itemId}" is placed in scene "${p.scene}"`);
    }
  };
  p.requiredEquipment.forEach((id, i) => wearable(id, `${where}.requiredEquipment.${i}`));
  p.steps.forEach((step, i) => {
    const path = `${where}.steps.${i}`;
    if (step.kind === 'wear') wearable(step.item, path);
    if (step.kind === 'state') isPlaced(step.condition.item, `${path}.condition`);
    if (step.kind === 'perform') {
      if (!actionsOf(step.item).includes(step.action)) {
        problems.push(`${path}: no "${step.item}" in the scene offers action "${step.action}"`);
      }
      step.requires.forEach((r, j) => isPlaced(r.item, `${path}.requires.${j}`));
    }
  });
  return problems;
}

/** Room lights of a scene, by kind: what it takes of the renderer's pool (LIGHT_SLOTS). */
function lightsOf(c: Content, sceneId: string): { key: number; other: number } {
  const scene = c.scenes.tryGet(sceneId);
  const lights = (scene?.kind === 'world' ? scene.rooms : []).flatMap(
    (id) => c.rooms.tryGet(id)?.lights ?? [],
  );
  const key = lights.filter((l) => l.role === 'key').length;
  return { key, other: lights.length - key };
}

/**
 * Room lights (world/lighting.ts): each hangs under a glowing fixture of its own room, a room has
 * one key at most (the light that casts its shadows), and every scene fits the renderer's pool.
 */
function checkRoomLights(c: Content): string[] {
  const problems: string[] = [];
  for (const room of c.rooms.all()) {
    room.lights.forEach((light, i) => {
      const where = `rooms.${room.id}.lights.${i}`;
      const fixture = room.placements.find((p) => p.id === light.fixture);
      if (!fixture) {
        problems.push(`${where}: no placement "${light.fixture}" in the room`);
      } else if (c.items.tryGet(fixture.item)?.visual.material !== 'light') {
        problems.push(
          `${where}: "${light.fixture}" is not a light fixture (its item does not glow)`,
        );
      } else if (
        light.reachHeight !== undefined &&
        (light.role !== 'key' ||
          light.reachHeight >= fixture.position[1] - 0.02 - room.bounds.min[1])
      ) {
        problems.push(`${where}: reachHeight is for a key light, below its fixture`);
      }
    });
    if (room.lights.filter((l) => l.role === 'key').length > 1) {
      problems.push(`rooms.${room.id}.lights: one key light at most (it casts the room's shadows)`);
    }
  }
  for (const scene of c.scenes.all()) {
    const { key, other } = lightsOf(c, scene.id);
    if (key > LIGHT_SLOTS.key || other > LIGHT_SLOTS.other) {
      problems.push(
        `scenes.${scene.id}: ${key} key and ${other} other room lights, more than the ` +
          `renderer keeps (${LIGHT_SLOTS.key} and ${LIGHT_SLOTS.other})`,
      );
    }
  }
  return problems;
}

/**
 * Walk-through doors and the campus they make (Z1 §4.13). A leaf (an item with `door`) names the
 * door of another scene as its arrival and is named back, on the facing wall; the two leaves slide
 * alike, stand back to back through one wall (each DOOR_INSET inside its face) with the same
 * opening behind both, covered by the leaf, and slide along their wall clear of everything in the
 * room. The campus the pairs make places each scene once, around loops too (floors level), and
 * keeps the rooms of different scenes at least a wall apart.
 */
function checkWalkThrough(c: Content): string[] {
  const problems: string[] = [];
  const itemOf = (id: string) => c.items.tryGet(id);
  const worlds = c.scenes.all().flatMap((s) => (s.kind === 'world' ? [s] : []));
  const pairs = doorPairs(worlds, (id) => c.rooms.tryGet(id), itemOf).filter(
    ({ a, b }) => itemOf(a.door.item)?.door || itemOf(b.door.item)?.door,
  );
  const paired = new Set(pairs.flatMap(({ a, b }) => [a.entityId, b.entityId]));
  for (const room of c.rooms.all()) {
    for (const p of room.placements) {
      if (itemOf(p.item)?.door && !paired.has(`${room.id}/${p.id}`)) {
        problems.push(
          `rooms.${room.id}.placements.${p.id}: a walk-through door needs as its arrival a ` +
            'door of another scene, on the facing wall, that names it back',
        );
      }
    }
  }
  for (const { a, b } of pairs) {
    const where = `doors "${a.entityId}" and "${b.entityId}"`;
    const [da, db] = [itemOf(a.door.item), itemOf(b.door.item)];
    if (!da?.door || !db?.door) {
      problems.push(`${where}: a walk-through door pairs only with another`);
      continue;
    }
    const alike =
      JSON.stringify([da.door, da.visual.size]) === JSON.stringify([db.door, db.visual.size]) &&
      Math.abs(a.door.rotationY - b.door.rotationY) < EPS;
    if (!alike) problems.push(`${where}: the two leaves must slide alike (same door, size, turn)`);
    // Lighting is one for the whole view, chosen by the scene the player is in: a scene seen
    // through an open door would be lit as the other one, and change at the threshold.
    const [la, lb] = [a, b].map(({ sceneId }) => worlds.find((s) => s.id === sceneId)?.lighting);
    // Both scenes are lit at once while the door is open: their room lights share the pool.
    const [na, nb] = [lightsOf(c, a.sceneId), lightsOf(c, b.sceneId)];
    if (na.key + nb.key > LIGHT_SLOTS.key || na.other + nb.other > LIGHT_SLOTS.other) {
      problems.push(
        `${where}: scenes "${a.sceneId}" and "${b.sceneId}" together have ${na.key + nb.key} key ` +
          `and ${na.other + nb.other} other room lights, more than the renderer keeps ` +
          `(${LIGHT_SLOTS.key} and ${LIGHT_SLOTS.other})`,
      );
    }
    if (la !== lb) {
      problems.push(
        `${where}: scenes "${a.sceneId}" (${la}) and "${b.sceneId}" (${lb}) need the same ` +
          'lighting: one is seen through the door while the other lights the view',
      );
    }
    const depth = inset(a) + WALL_THICKNESS + inset(b);
    if (Math.abs(depth - (2 * DOOR_INSET + WALL_THICKNESS)) > EPS) {
      problems.push(
        `${where}: not back to back: ${+depth.toFixed(4)} m apart, not ` +
          `${2 * DOOR_INSET + WALL_THICKNESS} m (each ${DOOR_INSET} m inside its wall face)`,
      );
    }
    const [oa, ob] = [a, b].map((end) => leafProblems(end, itemOf, problems));
    if (
      oa &&
      ob &&
      (Math.abs(oa.width - ob.width) > EPS || Math.abs(oa.height - ob.height) > EPS)
    ) {
      problems.push(`${where}: the openings behind the two leaves differ`);
    }
  }
  if (problems.length > 0) return problems;

  // The campus: each pair must put its far scene where the walk through the pairs before it did.
  const sceneIds = worlds.map((s) => s.id);
  const offsets = campusOffsets(sceneIds, pairs);
  const zero: Vec3 = [0, 0, 0];
  for (const { a, b } of pairs) {
    const d = pairOffset(a, b);
    const [pa, pb] = [offsets.get(a.sceneId) ?? zero, offsets.get(b.sceneId) ?? zero];
    if (d.some((v, i) => Math.abs((pb[i] ?? 0) - (pa[i] ?? 0) - v) > EPS)) {
      problems.push(
        `doors "${a.entityId}" and "${b.entityId}": put scene "${b.sceneId}" elsewhere than ` +
          'the doors before them (a loop of doors that does not close)',
      );
    }
  }
  // Rooms of scenes the pairs join (one campus) never overlap: at least a wall apart.
  const group = campusGroups(sceneIds, pairs);
  const placed = worlds.flatMap((s) =>
    s.rooms.flatMap((id) => {
      const room = c.rooms.tryGet(id);
      return room ? [{ scene: s.id, room: translateRoom(room, offsets.get(s.id) ?? zero) }] : [];
    }),
  );
  placed.forEach((one, i) => {
    for (const other of placed.slice(i + 1)) {
      if (one.scene === other.scene || group.get(one.scene) !== group.get(other.scene)) continue;
      const [p, q] = [one.room.bounds, other.room.bounds];
      const gap = (k: 0 | 2) => Math.max(q.min[k] - p.max[k], p.min[k] - q.max[k]);
      if (Math.max(gap(0), gap(2)) < WALL_THICKNESS - EPS) {
        problems.push(
          `rooms "${one.room.id}" (${one.scene}) and "${other.room.id}" (${other.scene}) ` +
            'overlap in the campus: less than a wall apart',
        );
      }
    }
  });
  return problems;
}

/** How far (m) a door stands inside its wall face. */
function inset({ room, wall, door }: DoorEnd): number {
  return Math.abs(faceOf(room, wall) - (alongX(wall) ? door.position[2] : door.position[0]));
}

/**
 * The checks of one leaf of a pair, into `problems`: it stands flat against its wall; the opening
 * behind it (returned, or null when missing) is covered by the leaf; it slides inside its wall,
 * clear of every solid of its room.
 */
function leafProblems(
  { room, wall, door }: DoorEnd,
  itemOf: (id: string) => ItemDefinition | undefined,
  problems: string[],
): { width: number; height: number } | null {
  const item = itemOf(door.item);
  if (!item?.door) return null;
  const [w, h, d] = item.visual.size;
  const along = alongWall(door.position, wall);
  const where = `rooms.${room.id}.placements.${door.id}`;
  // Its thin side faces the wall: turned 0 or π on north and south walls, ±π/2 on east and west.
  const turn = alongX(wall) ? Math.sin(door.rotationY) : Math.cos(door.rotationY);
  if (Math.abs(turn) > 1e-4)
    problems.push(`${where}: does not stand flat against its ${wall} wall`);
  const opening = room.openings.find((o) => o.wall === wall && Math.abs(o.center - along) < EPS);
  if (!opening) {
    problems.push(`${where}: no opening in the ${wall} wall behind it (centred at ${along})`);
  } else if (
    opening.width > w + EPS ||
    // Standing on the floor, as tall as the opening: a raised leaf would leave a gap below it.
    door.position[1] > room.bounds.min[1] + EPS ||
    door.position[1] + h < room.bounds.min[1] + opening.height - EPS
  ) {
    problems.push(`${where}: the leaf does not cover the opening behind it`);
  }
  // It slides along its own +x, which is (cos r, −sin r) on the floor: along the wall.
  const slide =
    (alongX(wall) ? Math.cos(door.rotationY) : -Math.sin(door.rotationY)) * item.door.travel;
  const lo = Math.min(along, along + slide) - w / 2;
  const hi = Math.max(along, along + slide) + w / 2;
  const [start, end] = wallSpan(room, wall);
  if (lo < start - EPS || hi > end + EPS) problems.push(`${where}: slides out of its wall`);
  const across = alongX(wall) ? door.position[2] : door.position[0];
  const y = door.position[1];
  const overlaps = (a0: number, a1: number, b0: number, b1: number) =>
    a0 < b1 - EPS && b0 < a1 - EPS;
  for (const other of room.placements) {
    const solid = other === door ? undefined : itemOf(other.item);
    // Only solids block it: what has no body (door trim on the wall face) is the content tests' to
    // keep clear of the leaf (world/doorBands.test.ts).
    if (!solid || solid.physical.body === 'none') continue;
    // The bounding box of its footprint, turned by its rotationY, and its height.
    const [ow, oh, od] = solid.visual.size;
    const cos = Math.abs(Math.cos(other.rotationY));
    const sin = Math.abs(Math.sin(other.rotationY));
    const hx = (ow * cos + od * sin) / 2;
    const hz = (ow * sin + od * cos) / 2;
    const [ox, oy, oz] = other.position;
    const [oAlong, oAcross, half, halfAcross] = alongX(wall) ? [ox, oz, hx, hz] : [oz, ox, hz, hx];
    if (
      overlaps(lo, hi, oAlong - half, oAlong + half) &&
      overlaps(across - d / 2, across + d / 2, oAcross - halfAcross, oAcross + halfAcross) &&
      overlaps(y, y + h, oy, oy + oh)
    ) {
      problems.push(`${where}: "${other.id}" is in the way of the leaf sliding open`);
    }
  }
  return opening ?? null;
}

/** Which campus each scene is in: scenes the pairs join share one (named by the first of them). */
function campusGroups(
  sceneIds: readonly string[],
  pairs: readonly { readonly a: DoorEnd; readonly b: DoorEnd }[],
): Map<string, string> {
  const group = new Map<string, string>();
  for (const root of sceneIds) {
    if (group.has(root)) continue;
    group.set(root, root);
    const queue = [root];
    for (const at of queue) {
      for (const { a, b } of pairs) {
        const next = a.sceneId === at ? b.sceneId : b.sceneId === at ? a.sceneId : null;
        if (next !== null && !group.has(next)) {
          group.set(next, root);
          queue.push(next);
        }
      }
    }
  }
  return group;
}
