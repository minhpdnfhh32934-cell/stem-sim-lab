import type { EventBus } from '../core/EventBus';
import { containsXZ, type Quat, quatFromYaw, type Vec3 } from '../core/math';
import type { GameEvents } from '../game/GameEvents';
import type { ItemDefinition } from '../gameplay/item';
import type { ParamValue, Placement, RoomDefinition } from './definitions';

/**
 * Current world transform of an entity. `position` is the centre of the item's bounding box
 * (not the placement's base point). The arrays are mutated in place — by the physics system for
 * dynamic bodies — so renderers and interaction can hold references instead of copying.
 */
export interface Pose {
  readonly position: Vec3;
  readonly rotation: Quat;
}

/** A live object in the loaded scene, created from a room placement (or, later, at runtime). */
export interface WorldEntity {
  readonly id: string;
  readonly roomId: string;
  readonly item: ItemDefinition;
  readonly pose: Pose;
  readonly params: Readonly<Record<string, ParamValue>>;
  /** The placement's translations of its text parameters (e.g. a door's label). */
  readonly vi?: Readonly<Record<string, string | undefined>> | undefined;
}

/** Entity for a placement; its id `<room>/<placement>` is stable across sessions (save key). */
export function entityFromPlacement(
  roomId: string,
  placement: Placement,
  item: ItemDefinition,
): WorldEntity {
  const [x, y, z] = placement.position;
  return {
    id: `${roomId}/${placement.id}`,
    roomId,
    item,
    pose: {
      position: [x, y + item.visual.size[1] / 2, z],
      rotation: quatFromYaw(placement.rotationY),
    },
    params: placement.params,
    vi: placement.vi,
  };
}

/** A neighbour scene's rooms, resident beside the current scene's. */
interface Neighbour {
  readonly sceneId: string;
  readonly rooms: readonly RoomDefinition[];
}

/**
 * The set of rooms and entities currently loaded: the current scene's, and those of neighbour
 * scenes resident beside it (SceneManager.attach). Spawning and despawning publish events, which
 * is how interaction, rendering and future systems (physics, audio) attach to entities without
 * this class knowing about them.
 */
export class World {
  private readonly entities = new Map<string, WorldEntity>();
  private rooms: readonly RoomDefinition[] = [];
  private currentSceneId: string | null = null;
  /** A plain array, so `roomAt` (every frame) scans it without allocating. */
  private readonly neighbours: Neighbour[] = [];

  constructor(private readonly events: EventBus<GameEvents>) {}

  /** The current scene's rooms (neighbours' rooms are not among them: see `roomsOf`). */
  get activeRooms(): readonly RoomDefinition[] {
    return this.rooms;
  }

  get entityCount(): number {
    return this.entities.size;
  }

  entity(id: string): WorldEntity | undefined {
    return this.entities.get(id);
  }

  allEntities(): IterableIterator<WorldEntity> {
    return this.entities.values();
  }

  /** The current scene's rooms (`sceneId`: whose they are, for `roomsOf` and `makeCurrent`). */
  setRooms(rooms: readonly RoomDefinition[], sceneId: string | null = null): void {
    this.rooms = rooms;
    this.currentSceneId = sceneId;
  }

  /** Adds a neighbour scene's rooms (already moved into the frame). */
  addRooms(sceneId: string, rooms: readonly RoomDefinition[]): void {
    if (sceneId === this.currentSceneId || this.neighbourIndex(sceneId) >= 0) {
      throw new Error(`Rooms of scene "${sceneId}" are already in the world`);
    }
    this.neighbours.push({ sceneId, rooms });
  }

  /** Removes a neighbour scene's rooms (never the current scene's); false if it had none. */
  removeRooms(sceneId: string): boolean {
    const index = this.neighbourIndex(sceneId);
    if (index < 0) return false;
    this.neighbours.splice(index, 1);
    return true;
  }

  /** A scene's rooms: the current scene's or a neighbour's, else none. */
  roomsOf(sceneId: string): readonly RoomDefinition[] {
    if (sceneId === this.currentSceneId) return this.rooms;
    return this.neighbours[this.neighbourIndex(sceneId)]?.rooms ?? [];
  }

  /** Whether room `roomId` is the current scene's or a resident neighbour's. */
  hasRoom(roomId: string): boolean {
    return (
      this.rooms.some((r) => r.id === roomId) ||
      this.neighbours.some((n) => n.rooms.some((r) => r.id === roomId))
    );
  }

  /** A neighbour becomes the current scene; the current one becomes a neighbour. */
  makeCurrent(sceneId: string): void {
    const index = this.neighbourIndex(sceneId);
    const next = this.neighbours[index];
    if (!next) throw new Error(`Scene "${sceneId}" has no rooms beside the current scene`);
    if (this.currentSceneId === null) this.neighbours.splice(index, 1);
    else this.neighbours[index] = { sceneId: this.currentSceneId, rooms: this.rooms };
    this.rooms = next.rooms;
    this.currentSceneId = sceneId;
  }

  spawn(entity: WorldEntity): void {
    if (this.entities.has(entity.id)) throw new Error(`Entity "${entity.id}" already exists`);
    this.entities.set(entity.id, entity);
    this.events.publish('EntitySpawned', { entity });
  }

  despawn(entityId: string): boolean {
    if (!this.entities.delete(entityId)) return false;
    this.events.publish('EntityDespawned', { entityId });
    return true;
  }

  clear(): void {
    for (const id of [...this.entities.keys()]) this.despawn(id);
    this.rooms = [];
    this.currentSceneId = null;
    this.neighbours.length = 0;
  }

  /** The room containing floor point (x, z): the current scene's first, then neighbours'. */
  roomAt(x: number, z: number): RoomDefinition | null {
    const found = inRooms(this.rooms, x, z);
    if (found) return found;
    for (let i = 0; i < this.neighbours.length; i++) {
      const room = inRooms(this.neighbours[i]?.rooms ?? [], x, z);
      if (room) return room;
    }
    return null;
  }

  private neighbourIndex(sceneId: string): number {
    return this.neighbours.findIndex((n) => n.sceneId === sceneId);
  }
}

function inRooms(rooms: readonly RoomDefinition[], x: number, z: number): RoomDefinition | null {
  for (let i = 0; i < rooms.length; i++) {
    const room = rooms[i];
    if (room && containsXZ(room.bounds, x, z)) return room;
  }
  return null;
}
