import { Disposables, type EventBus } from '../core/EventBus';
import type { Logger } from '../core/Logger';
import { containsXZ, type Quat, type Vec3 } from '../core/math';
import type { Registry } from '../core/Registry';
import type { GameSystem } from '../core/SystemRunner';
import type { GameEvents } from '../game/GameEvents';
import type { GameState } from '../game/GameState';
import type { ItemDefinition } from '../gameplay/item';
import type { ExperimentDefinition } from '../simulation/experiment';
import { totalUl, UL_PER_ML } from '../simulation/liquid';
import type { Placement, RoomDefinition } from '../world/definitions';
import type { WorldEntity } from '../world/World';

export interface ContainerSaveDeps {
  state: GameState;
  events: EventBus<GameEvents>;
  /** Rooms as content has them (scene coordinates, the lab pack's placements once added). */
  rooms: Registry<RoomDefinition>;
  items: Registry<ItemDefinition>;
  experiments: Registry<ExperimentDefinition>;
  log: Logger;
  /** The entity the player holds: its pose in mid-air is never saved. */
  held: () => string | null;
}

/** Where a container's placement puts it, in the session frame. */
export interface ContainerHomes {
  /** Writes the placement pose of a moved container into the outs; false if it is not one. */
  home(entityId: string, position: Vec3, rotation: Quat): boolean;
}

interface Tracked {
  readonly entity: WorldEntity;
  /** Session frame − scene frame for its scene (a neighbour's campus offset), fixed at spawn. */
  readonly offset: Vec3;
  /** Its placement pose, session frame. */
  readonly position: Vec3;
  readonly rotation: Quat;
}

/**
 * The save side of physical-lab containers (save v4): where carried glassware stands. Only items
 * with a `container` and a dynamic body are tracked — every other object still spawns at its
 * placement, as before. A pose is kept in its own scene's coordinates: written into
 * `world.objects` when a save is captured (`capture`) and when its scene goes; applied whenever it
 * spawns (a Continue, a scene attached again). It is the first system, so it hears of a spawn
 * before physics makes the body, which is then made where the saved pose is. `sanitize` checks a continued save against the content.
 */
export class ContainerSave implements GameSystem, ContainerHomes {
  readonly id = 'container-saves';
  private readonly tracked = new Map<string, Tracked>();
  private readonly subscriptions = new Disposables();

  constructor(private readonly deps: ContainerSaveDeps) {}

  init(): void {
    const { events } = this.deps;
    this.subscriptions.add(events.subscribe('EntitySpawned', ({ entity }) => this.spawned(entity)));
    this.subscriptions.add(
      events.subscribe('EntityDespawned', ({ entityId }) => {
        const tracked = this.tracked.get(entityId);
        if (!tracked) return;
        this.keep(tracked);
        this.tracked.delete(entityId);
      }),
    );
  }

  dispose(): void {
    this.subscriptions.dispose();
    this.tracked.clear();
  }

  /** Brings every tracked container's pose (the held one's excepted) into `world.objects`. */
  capture(): void {
    const held = this.deps.held();
    for (const tracked of this.tracked.values()) if (tracked.entity.id !== held) this.keep(tracked);
  }

  home(entityId: string, position: Vec3, rotation: Quat): boolean {
    const tracked = this.tracked.get(entityId);
    if (!tracked) return false;
    for (let i = 0; i < 3; i++) position[i] = tracked.position[i] ?? 0;
    for (let i = 0; i < 4; i++) rotation[i] = tracked.rotation[i] ?? 0;
    return true;
  }

  /**
   * Checks a continued save's containers against the content, before its scene spawns: a pose of
   * no carried container, outside its room or not a rotation, goes (it spawns at its placement);
   * contents of no container, of a material its experiment does not list, over its mark (else its
   * brim), or a measured pipette neither empty nor full go (its station fills it again from its
   * placement). One warning each. Returns the warnings' count.
   */
  sanitize(): number {
    const { state, log } = this.deps;
    let problems = 0;
    const drop = (map: Record<string, unknown>, id: string, why: string) => {
      Reflect.deleteProperty(map, id);
      log.warn(`Saved container "${id}" ${why}: it starts from its placement`);
      problems++;
    };
    for (const [id, pose] of Object.entries(state.world.objects)) {
      const found = this.placementOf(id);
      const item = found && this.deps.items.tryGet(found.placement.item);
      const [x, y, z] = pose.position;
      const length = Math.hypot(...pose.rotation);
      if (!found || !item?.container || item.physical.body !== 'dynamic') {
        drop(state.world.objects, id, 'is not a carried container');
      } else if (
        !containsXZ(found.room.bounds, x, z) ||
        y < found.room.bounds.min[1] ||
        y > found.room.bounds.max[1]
      ) {
        drop(state.world.objects, id, 'stands outside its room');
      } else if (!(Math.abs(length - 1) < 1e-3)) {
        drop(state.world.objects, id, 'has no valid rotation');
      }
    }
    for (const [id, saved] of Object.entries(state.world.containers)) {
      const found = this.placementOf(id);
      const container = found && this.deps.items.tryGet(found.placement.item)?.container;
      const materials = found && this.materialsOf(found.room, found.placement);
      const unknown = Object.keys(saved.contents).find((m) => !materials?.includes(m));
      if (!found || !container || !materials) {
        drop(state.world.containers, id, 'is not a container of a station');
      } else if (unknown !== undefined) {
        drop(state.world.containers, id, `holds "${unknown}", not a material of its experiment`);
      } else if (
        totalUl(saved.contents) >
        (container.measured?.volumeMl ?? container.fillLimitMl ?? container.capacityMl) * UL_PER_ML
      ) {
        drop(state.world.containers, id, 'holds more than its mark or brim');
      } else if (
        container.measured &&
        totalUl(saved.contents) !== 0 &&
        totalUl(saved.contents) !== Math.round(container.measured.volumeMl * UL_PER_ML)
      ) {
        drop(state.world.containers, id, 'is a measured pipette neither empty nor full');
      }
    }
    return problems;
  }

  private spawned(entity: WorldEntity): void {
    if (!entity.item.container || entity.item.physical.body !== 'dynamic') return;
    const found = this.placementOf(entity.id);
    if (!found) return; // made at runtime, not from a placement: nothing to restore
    const { position: at, rotation } = entity.pose;
    const [px, py, pz] = found.placement.position;
    const offset: Vec3 = [at[0] - px, at[1] - (py + entity.item.visual.size[1] / 2), at[2] - pz];
    this.tracked.set(entity.id, { entity, offset, position: [...at], rotation: [...rotation] });
    const saved = this.deps.state.world.objects[entity.id];
    if (!saved) return;
    for (let i = 0; i < 3; i++) at[i] = (saved.position[i] ?? 0) + (offset[i] ?? 0);
    for (let i = 0; i < 4; i++) rotation[i] = saved.rotation[i] ?? 0;
  }

  /** Its pose now, in its scene's coordinates, into `world.objects`. */
  private keep({ entity, offset }: Tracked): void {
    const [x, y, z] = entity.pose.position;
    const [qx, qy, qz, qw] = entity.pose.rotation;
    this.deps.state.world.objects[entity.id] = {
      position: [x - offset[0], y - offset[1], z - offset[2]],
      rotation: [qx, qy, qz, qw],
    };
  }

  private placementOf(entityId: string): { room: RoomDefinition; placement: Placement } | null {
    const cut = entityId.lastIndexOf('/');
    const room = this.deps.rooms.tryGet(entityId.slice(0, cut));
    const placement = room?.placements.find((p) => p.id === entityId.slice(cut + 1));
    return room && placement ? { room, placement } : null;
  }

  /** The materials of the experiment a container's placement belongs to (its station's), or null. */
  private materialsOf(room: RoomDefinition, placement: Placement): string[] | null {
    const station = placement.params.station;
    const apparatus =
      typeof station === 'string' ? room.placements.find((p) => p.id === station) : placement;
    const experimentId = apparatus?.params.experimentId;
    const experiment =
      typeof experimentId === 'string' ? this.deps.experiments.tryGet(experimentId) : undefined;
    return experiment?.workspace?.materials.map((m) => m.id) ?? null;
  }
}
