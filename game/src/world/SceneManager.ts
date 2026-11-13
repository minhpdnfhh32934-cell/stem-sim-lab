import { Disposables, type EventBus } from '../core/EventBus';
import { ENGLISH, type Texts } from '../core/i18n';
import type { Logger } from '../core/Logger';
import type { Vec3 } from '../core/math';
import type { Registry } from '../core/Registry';
import { describeError, type GameSystem } from '../core/SystemRunner';
import type { GameEvents } from '../game/GameEvents';
import type { GameState } from '../game/GameState';
import type { NeighbourScenes } from '../gameplay/door/DoorSystem';
import type { ItemDefinition } from '../gameplay/item';
import { arrivalPose, type StandPose } from './arrival';
import { campusOffsets, type DoorPair, doorPairs, translateRoom } from './campus';
import type { RoomDefinition, SceneDefinition } from './definitions';
import { entityFromPlacement, type World, type WorldEntity } from './World';

export interface SceneManagerDeps {
  scenes: Registry<SceneDefinition>;
  rooms: Registry<RoomDefinition>;
  items: Registry<ItemDefinition>;
  world: World;
  state: GameState;
  events: EventBus<GameEvents>;
  log: Logger;
  /**
   * Awaited before a world scene is built (the composition root loads physics here). A rejection
   * aborts the load before anything is torn down, so the current scene stays.
   */
  prepareWorld?: () => Promise<void>;
  /**
   * Awaited after a neighbour is attached (`SceneAttached`) and before `attach` resolves. A
   * rejection is logged and the scene stays: it only delays its first frames.
   */
  settleAttach?: (sceneId: string) => Promise<void>;
  /**
   * Lets a frame through while a neighbour is attached: its placements are spawned a few
   * milliseconds at a time (`ATTACH_SLICE_MS`), the door still shut. Without it, all at once.
   */
  pause?: () => Promise<void>;
  /** A placement's entity the player carries away (the inventory): it is not spawned. */
  away?: (entityId: string) => boolean;
  /** The language of the reasons `attach` gives (English without it). */
  texts?: Texts;
}

/** How long a neighbour's spawning may run before a frame goes through (ms). */
export const ATTACH_SLICE_MS = 4;

export interface LoadSceneOptions {
  /** false keeps the player's current transform (used when restoring a save). */
  placePlayer?: boolean;
  /** Door entity id in the new scene to arrive at (its arrival point); default: the spawn. */
  arrival?: string;
}

type WorldScene = Extract<SceneDefinition, { kind: 'world' }>;

/** A world scene in the World: the current one, or a neighbour attached beside it. */
interface Resident {
  readonly scene: WorldScene;
  /** Where the scene's own coordinates start, in the session frame. */
  readonly offset: Readonly<Vec3>;
}

const ZERO: Readonly<Vec3> = [0, 0, 0];

/**
 * Loads scenes from data: tears down the current world, spawns the new scene's rooms and
 * placements, positions the player and drives the session phase. Async so asset streaming can
 * be added later without changing callers.
 *
 * Residency: a neighbour scene — one a door pair joins to a scene in the World — can be attached
 * beside the current one, in the same World, at its place in the campus frame (`campus.ts`). The
 * session frame is the scene `load` loaded, at its own coordinates; a neighbour lies at its campus
 * offset relative to it, so walking into it moves nothing: it only becomes the current scene
 * (`SceneEntered`), and `origin` says where its own coordinates start in the frame. Walk-through
 * doors attach and release neighbours through it (`NeighbourScenes`).
 *
 * An object stays where it is while that place is in the World: thrown through a doorway, it is in
 * the other scene. A released scene takes with it what is in its rooms, and its own objects found
 * in no room; one of those whose own scene stays goes home, back to its placement there. A
 * placement is spawned only if its entity is neither carried nor still in the World.
 */
export class SceneManager implements GameSystem, NeighbourScenes {
  readonly id = 'scenes';
  private currentScene: SceneDefinition | null = null;
  private loading = false;
  private readonly subscriptions = new Disposables();
  /** Door pairs between scenes, and each scene's local origin in the campus frame. */
  private readonly pairs: readonly DoorPair[];
  private readonly campus: ReadonlyMap<string, Vec3>;
  /** The world scene each room belongs to (a room is in one: checked at boot). */
  private readonly sceneOfRoom = new Map<string, string>();
  /** World scenes in the World, the current one included; none for the menu. */
  private readonly residents = new Map<string, Resident>();
  /** The scene `load` loaded: its coordinates are the session frame's. */
  private frameScene: string | null = null;
  private readonly currentOrigin: Vec3 = [0, 0, 0];
  /** Moves on every load, so an attach that waited across one knows it is stale. */
  private generation = 0;

  constructor(private readonly deps: SceneManagerDeps) {
    const scenes = deps.scenes.all();
    this.pairs = doorPairs(
      scenes,
      (id) => deps.rooms.tryGet(id),
      (id) => deps.items.tryGet(id),
    );
    this.campus = campusOffsets(
      scenes.flatMap((s) => (s.kind === 'world' ? [s.id] : [])),
      this.pairs,
    );
    for (const scene of scenes) {
      if (scene.kind === 'world') for (const id of scene.rooms) this.sceneOfRoom.set(id, scene.id);
    }
  }

  /** The door pairs joining scenes (campus.ts), in content order. */
  get doorPairs(): readonly DoorPair[] {
    return this.pairs;
  }

  /** The scene the player is in, or null (NeighbourScenes). */
  get currentSceneId(): string | null {
    return this.currentScene?.id ?? null;
  }

  /** Where a resident scene's own coordinates start in the session frame, or null (no copy). */
  offsetOf(sceneId: string): Readonly<Vec3> | null {
    return this.residents.get(sceneId)?.offset ?? null;
  }

  init(): void {
    const { events } = this.deps;
    this.subscriptions.add(
      events.subscribe('SceneChangeRequested', ({ sceneId, arrival }) => {
        this.load(sceneId, arrival ? { arrival } : {}).catch((error: unknown) => {
          this.deps.log.error(`Scene change to "${sceneId}" failed`, error);
        });
      }),
    );
    // Walking into a room of a neighbour makes it the current scene.
    this.subscriptions.add(
      events.subscribe('PlayerEnteredRoom', ({ roomId }) => {
        const sceneId = this.residentOfRoom(roomId);
        if (sceneId !== null && sceneId !== this.currentScene?.id) this.enter(sceneId);
      }),
    );
  }

  get current(): SceneDefinition | null {
    return this.currentScene;
  }

  get isLoading(): boolean {
    return this.loading;
  }

  /**
   * Where the current scene's own coordinates start in the session frame: zero after any load,
   * a neighbour's offset once the player has walked into it. Scene-local = frame − origin.
   */
  get origin(): Readonly<Vec3> {
    return this.currentOrigin;
  }

  /** Where the session frame lies in the campus frame: campus position = frame position + this. */
  get campusOffset(): Readonly<Vec3> {
    return (this.frameScene === null ? undefined : this.campus.get(this.frameScene)) ?? ZERO;
  }

  /** The world scenes in the World, the current one among them: the loaded one, then attached ones. */
  get residentIds(): string[] {
    return [...this.residents.keys()];
  }

  isResident(sceneId: string): boolean {
    return this.residents.has(sceneId);
  }

  async load(sceneId: string, options: LoadSceneOptions = {}): Promise<void> {
    const { scenes, rooms, world, state, events, log } = this.deps;
    const scene = scenes.get(sceneId);
    if (this.loading) throw new Error(`Cannot load "${sceneId}": another scene is loading`);
    this.loading = true;
    this.generation++;
    const previousPhase = state.session.phase;
    state.session.phase = 'loading';
    events.publish('SceneLoading', { sceneId });
    try {
      await Promise.resolve(); // keep load asynchronous for callers even before assets stream
      if (scene.kind === 'world') await this.deps.prepareWorld?.();
      this.unloadAll();
      let placed = ''; // for the log: where the player was put
      if (scene.kind === 'world') {
        const sceneRooms = scene.rooms.map((id) => rooms.get(id));
        world.setRooms(sceneRooms, scene.id);
        this.spawnPlacements(sceneRooms, []);
        this.residents.set(scene.id, { scene, offset: ZERO });
        this.frameScene = scene.id;
        placed = ', player at the saved position';
        if (options.placePlayer !== false) {
          const arrival = this.arrivalIn(sceneRooms, options.arrival);
          const stand = arrival ?? scene.spawn;
          state.player.position = [...stand.position];
          state.player.yaw = stand.yaw;
          state.player.pitch = 0;
          placed = arrival
            ? `, player at door "${options.arrival ?? ''}"`
            : ', player at the spawn';
        }
        state.player.roomId = null;
      }
      this.currentScene = scene;
      state.session.sceneId = scene.id;
      state.session.phase = scene.kind === 'menu' ? 'menu' : 'playing';
      log.info(`Scene "${scene.id}" loaded (${world.entityCount} entities${placed})`);
      events.publish('SceneLoaded', { sceneId: scene.id, kind: scene.kind });
    } catch (error) {
      // Preparation failed before anything was torn down: keep playing the current scene.
      if (this.currentScene) state.session.phase = previousPhase;
      throw error;
    } finally {
      this.loading = false;
    }
  }

  /**
   * Makes a neighbour scene resident beside the current one: after the world preparations (the
   * same as a load's: physics and the renderer, already loaded after the first world scene), its
   * rooms are put at its campus place in the session frame and its placements spawned; then
   * `SceneAttached`. Returns why it could not, or null once the scene is resident. Refused while
   * a scene loads; a load meanwhile makes it stale (nothing of the scene is spawned); any failure
   * leaves exactly the scenes there were.
   */
  async attach(sceneId: string): Promise<string | null> {
    const generation = this.generation;
    const refused = this.attachBlock(sceneId);
    if (refused !== null || this.residents.has(sceneId)) return refused;
    try {
      await this.deps.prepareWorld?.();
    } catch (error) {
      return describeError(error);
    }
    if (generation !== this.generation) {
      return this.texts.ui('scenes.attachStale', 'Another scene was loaded meanwhile.');
    }
    // What may have changed while it was being prepared.
    const again = this.attachBlock(sceneId);
    const place = this.placeInFrame(sceneId);
    if (again !== null || this.residents.has(sceneId) || !place) return again;
    const { scene, offset } = place;
    const { world, rooms, events, log } = this.deps;
    const entityIds: string[] = [];
    try {
      const moved = scene.rooms.map((id) => translateRoom(rooms.get(id), offset));
      world.addRooms(scene.id, moved);
      events.publish('SceneAttaching', { sceneId });
      // A lab's placements spawned in one go stalled its door's frame ~225 ms (Phase G trace).
      const done = await this.spawnAttached(moved, entityIds, generation);
      if (!done) return this.texts.ui('scenes.attachStale', 'Another scene was loaded meanwhile.');
    } catch (error) {
      log.error(`Attaching scene "${sceneId}" failed; rolled back`, error);
      this.drop(sceneId, entityIds);
      return describeError(error);
    }
    this.residents.set(scene.id, { scene, offset });
    log.info(`Scene "${sceneId}" attached at ${offset.join(', ')} (${entityIds.length} entities)`);
    events.publish('SceneAttached', { sceneId });
    try {
      await this.deps.settleAttach?.(sceneId);
    } catch (error) {
      log.warn(`Settling attached scene "${sceneId}" failed`, error);
    }
    return null;
  }

  /**
   * Removes a neighbour scene: what is in it (its rooms, and its own entities found in no room),
   * then `SceneDetached`, then its rooms; then an entity among them whose own scene stays goes home,
   * spawned again at its placement. Never the current scene (false), nor one that is not resident.
   */
  release(sceneId: string): boolean {
    if (!this.residents.has(sceneId) || sceneId === this.currentScene?.id) return false;
    this.takeAway(sceneId, true);
    return true;
  }

  /** `release` without its checks; `goHome` false when everything is being torn down anyway. */
  private takeAway(sceneId: string, goHome: boolean): void {
    const { world } = this.deps;
    const rooms = world.roomsOf(sceneId);
    const leaving: WorldEntity[] = [];
    for (const entity of world.allEntities()) {
      const [x, , z] = entity.pose.position;
      const at = world.roomAt(x, z);
      if (at ? rooms.includes(at) : this.sceneOfRoom.get(entity.roomId) === sceneId) {
        leaving.push(entity);
      }
    }
    this.drop(
      sceneId,
      leaving.map((e) => e.id),
    );
    let home = 0;
    for (const entity of goHome ? leaving : []) {
      const own = this.sceneOfRoom.get(entity.roomId);
      if (own === undefined || own === sceneId || !this.residents.has(own)) continue;
      const room = world.roomsOf(own).find((r) => r.id === entity.roomId);
      const placement = room?.placements.find((p) => `${entity.roomId}/${p.id}` === entity.id);
      if (!placement) continue;
      world.spawn(entityFromPlacement(entity.roomId, placement, entity.item));
      home++;
    }
    const back = home > 0 ? `; ${home} object(s) back home` : '';
    this.deps.log.info(`Scene "${sceneId}" released (${leaving.length} entities${back})`);
  }

  dispose(): void {
    this.subscriptions.dispose();
    this.unloadAll();
  }

  /**
   * Spawns every placement of `rooms` (already in the session frame) and adds the entity ids to
   * `spawned` as it goes. The one place placements become entities, for a load and an attach.
   */
  /** Spawns the rooms' placements, at once (a load). */
  private spawnPlacements(rooms: readonly RoomDefinition[], spawned: string[]): void {
    for (const spawn of this.spawnsOf(rooms, spawned)) spawn();
  }

  /**
   * Spawns a neighbour's placements, letting a frame through (`pause`) every `ATTACH_SLICE_MS`:
   * false if a load came meanwhile (it cleared the world: nothing more is spawned).
   */
  private async spawnAttached(
    rooms: readonly RoomDefinition[],
    spawned: string[],
    generation: number,
  ): Promise<boolean> {
    let since = performance.now();
    for (const spawn of this.spawnsOf(rooms, spawned)) {
      if (this.deps.pause && performance.now() - since > ATTACH_SLICE_MS) {
        await this.deps.pause();
        if (generation !== this.generation) return false;
        since = performance.now();
      }
      spawn();
    }
    return true;
  }

  /** One step a placement: it spawns the placement's entity (and records it), unless it is away. */
  private spawnsOf(rooms: readonly RoomDefinition[], spawned: string[]): (() => void)[] {
    const { world, items } = this.deps;
    return rooms.flatMap((room) =>
      room.placements.map((p) => () => {
        const id = `${room.id}/${p.id}`;
        // Never in two places: carried, or left in the scene next door (it comes home with it).
        if (this.deps.away?.(id) || world.entity(id)) return;
        world.spawn(entityFromPlacement(room.id, p, items.get(p.item)));
        spawned.push(id);
      }),
    );
  }

  /** Why `sceneId` cannot be attached now, or null: it can be, or already is resident. */
  private attachBlock(sceneId: string): string | null {
    const t = this.texts;
    if (this.loading) return t.ui('scenes.attachLoading', 'Another scene is loading.');
    if (this.residents.has(sceneId) || this.placeInFrame(sceneId)) return null;
    const scene = this.deps.scenes.tryGet(sceneId);
    return t.ui('scenes.attachNotNeighbour', 'No door leads from here to {scene}.', {
      scene: scene ? t.of(scene, 'displayName') : sceneId,
    });
  }

  /**
   * A world scene a door pair joins to a resident scene, and where it starts in the session
   * frame (campus[scene] − campus[frame]); null when no pair joins it to one.
   */
  private placeInFrame(sceneId: string): { scene: WorldScene; offset: Vec3 } | null {
    const scene = this.deps.scenes.tryGet(sceneId);
    const joined = this.pairs.some(
      ({ a, b }) =>
        (a.sceneId === sceneId && this.residents.has(b.sceneId)) ||
        (b.sceneId === sceneId && this.residents.has(a.sceneId)),
    );
    const at = this.campus.get(sceneId);
    const frame = this.frameScene === null ? undefined : this.campus.get(this.frameScene);
    if (scene?.kind !== 'world' || !joined || !at || !frame) return null;
    return { scene, offset: [at[0] - frame[0], at[1] - frame[1], at[2] - frame[2]] };
  }

  /** The resident scene `roomId` belongs to, or null. */
  private residentOfRoom(roomId: string): string | null {
    for (const sceneId of this.residents.keys()) {
      if (this.deps.world.roomsOf(sceneId).some((r) => r.id === roomId)) return sceneId;
    }
    return null;
  }

  /**
   * The player walked into a resident neighbour: it becomes the current scene. No load: nothing
   * is torn down, built or moved, the phase and a pause stay as they are.
   */
  private enter(sceneId: string): void {
    const resident = this.residents.get(sceneId);
    const previous = this.currentScene;
    if (!resident || !previous || this.loading) return;
    const through = this.doorTowards(previous.id, sceneId);
    this.deps.world.makeCurrent(sceneId);
    this.currentScene = resident.scene;
    this.deps.state.session.sceneId = sceneId;
    for (let i = 0; i < 3; i++) this.currentOrigin[i] = resident.offset[i] ?? 0;
    this.deps.log.info(`Entered scene "${sceneId}" from "${previous.id}"`);
    this.deps.events.publish('SceneEntered', { sceneId, previousSceneId: previous.id, through });
  }

  /** The door of scene `from` that leads to scene `to` nearest the player, or null. */
  private doorTowards(from: string, to: string): string | null {
    const [x, , z] = this.deps.state.player.position;
    let best: string | null = null;
    let distance = Infinity;
    for (const { a, b } of this.pairs) {
      const end =
        a.sceneId === from && b.sceneId === to
          ? a
          : b.sceneId === from && a.sceneId === to
            ? b
            : null;
      const door = end ? this.deps.world.entity(end.entityId) : undefined;
      if (!end || !door) continue;
      const d = Math.hypot(door.pose.position[0] - x, door.pose.position[2] - z);
      if (d < distance) [distance, best] = [d, end.entityId];
    }
    return best;
  }

  /** Despawns a resident scene's entities, publishes SceneDetached, then removes its rooms. */
  private drop(sceneId: string, entityIds: readonly string[]): void {
    const { world, events } = this.deps;
    this.residents.delete(sceneId);
    for (const id of entityIds) world.despawn(id);
    events.publish('SceneDetached', { sceneId });
    world.removeRooms(sceneId);
  }

  /** The arrival point in front of door `entityId`, or null (logged) to use the spawn. */
  private arrivalIn(rooms: readonly RoomDefinition[], entityId?: string): StandPose | null {
    if (entityId === undefined) return null;
    const slash = entityId.indexOf('/');
    const room = rooms.find((r) => r.id === entityId.slice(0, slash));
    const door = room?.placements.find((p) => p.id === entityId.slice(slash + 1));
    // Content validation guarantees a resolvable door; this only guards runtime-built content.
    const pose = room && door ? arrivalPose(room, door) : 'no such door in this scene';
    if (typeof pose !== 'string') return pose;
    this.deps.log.warn(`Arrival at "${entityId}" impossible (${pose}); using the spawn`);
    return null;
  }

  /** Tears everything down: the neighbours (SceneDetached each), then the current scene. */
  private unloadAll(): void {
    const previous = this.currentScene;
    for (const sceneId of [...this.residents.keys()]) {
      if (sceneId !== previous?.id) this.takeAway(sceneId, false);
    }
    this.residents.clear();
    this.deps.world.clear();
    this.currentScene = null;
    this.frameScene = null;
    this.currentOrigin.fill(0);
    this.deps.state.session.sceneId = null;
    if (previous) this.deps.events.publish('SceneUnloaded', { sceneId: previous.id });
  }

  private get texts(): Texts {
    return this.deps.texts ?? ENGLISH;
  }
}
