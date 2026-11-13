import type { ProcedureDefinition } from '../gameplay/procedure/procedure';
import type { ExperimentDefinition, TopicDefinition } from '../simulation/experiment';
import type { LaboratoryDefinition, RoomDefinition, SceneDefinition } from '../world/definitions';
import type { Content } from './content';

/** A room with a station of an experiment, and the world scene it belongs to. */
export interface StationPlace {
  readonly scene: SceneDefinition;
  readonly room: RoomDefinition;
}

export interface CatalogExperiment {
  readonly experiment: ExperimentDefinition;
  /** Where it can be played; none: it has no station yet, so it is not playable. */
  readonly places: readonly StationPlace[];
}

export interface CatalogTopic {
  readonly topic: TopicDefinition;
  readonly experiments: readonly CatalogExperiment[];
}

/**
 * The topics as players browse them, from the content alone: a station is a placement that runs
 * an experiment (its `experimentId`), in a room of a world scene.
 */
export function topicCatalog(content: Content): CatalogTopic[] {
  const places = (id: string): StationPlace[] =>
    content.rooms.all().flatMap((room) => {
      const scene = content.scenes
        .all()
        .find((s) => s.kind === 'world' && s.rooms.includes(room.id));
      const hasStation = room.placements.some((p) => p.params.experimentId === id);
      return scene && hasStation ? [{ scene, room }] : [];
    });
  return content.topics.all().map((topic) => ({
    topic,
    experiments: topic.experiments.map((id) => ({
      experiment: content.experiments.get(id),
      places: places(id),
    })),
  }));
}

/** A subject (physics, chemistry…), named by its laboratory, with its topics; none: planned. */
export interface CatalogSubject {
  readonly laboratory: LaboratoryDefinition;
  readonly topics: readonly CatalogTopic[];
}

/**
 * The catalog by subject, from the content alone: each laboratory type once, in the order of the
 * laboratories, named by its first laboratory, with the topics of that subject in their order — a
 * laboratory without topics (a planned one) has none. Nothing is added to the content.
 */
export function subjectCatalog(content: Content): CatalogSubject[] {
  const topics = topicCatalog(content);
  const subjects: CatalogSubject[] = [];
  for (const laboratory of content.laboratories.all()) {
    if (subjects.some((s) => s.laboratory.type === laboratory.type)) continue;
    subjects.push({
      laboratory,
      topics: topics.filter(({ topic }) => topic.subject === laboratory.type),
    });
  }
  return subjects;
}

/** A step on the way to a scene: a scene to go through, or a procedure to finish first. */
export type RouteStep =
  | { readonly kind: 'scene'; readonly scene: SceneDefinition }
  | { readonly kind: 'procedure'; readonly procedure: ProcedureDefinition };

/**
 * The way from one world scene to another through the fewest doors (placements with a
 * `targetScene`), each procedure that gates a door named just before the scene the door opens
 * onto; null when no door leads there. Directions only: nothing here moves the player.
 */
export function routeBetween(content: Content, from: string, to: string): RouteStep[] | null {
  const via = new Map<string, { previous: string; door: string } | null>([[from, null]]);
  const queue = [from];
  for (let i = 0; i < queue.length && !via.has(to); i++) {
    const scene = content.scenes.tryGet(queue[i] ?? '');
    if (scene?.kind !== 'world') continue;
    for (const room of scene.rooms.map((id) => content.rooms.get(id))) {
      for (const placement of room.placements) {
        const target = placement.params.targetScene;
        if (typeof target !== 'string' || via.has(target)) continue;
        via.set(target, { previous: scene.id, door: `${room.id}/${placement.id}` });
        queue.push(target);
      }
    }
  }
  if (!via.has(to)) return null;
  const steps: RouteStep[] = [];
  for (let id: string | undefined = to; id !== undefined;) {
    const link = via.get(id);
    steps.unshift({ kind: 'scene', scene: content.scenes.get(id) });
    const gate = link && content.procedures.all().find((p) => p.entrance === link.door);
    if (gate) steps.unshift({ kind: 'procedure', procedure: gate });
    id = link?.previous;
  }
  return steps;
}
