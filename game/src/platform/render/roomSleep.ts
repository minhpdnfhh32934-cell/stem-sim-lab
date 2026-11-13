import * as THREE from 'three';
import { type Passage, awakeRooms, passagesBetween } from '../../world/dormancy';
import type { RoomDefinition } from '../../world/definitions';

/** A room asleep is drawn by no camera and casts no shadow: its objects stand on this layer. */
export const ASLEEP_LAYER = 29;
/**
 * The layers an object may own: all but the renderer's warm-up layers (30 warm, 31 pending), which
 * an object only borrows while a scene attached is warmed. A room put to sleep in that time keeps
 * the layers it will have (0), not the borrowed one — else, woken, it was never drawn again.
 */
const OWN_LAYERS = 0x3fffffff;
/** How often the rooms are judged again (s): a walk at 2.2 m/s moves 0.55 m between. */
const JUDGE_S = 0.25;

/** What the room sleep reads of the game and asks of the renderer. */
export interface RoomSleepDeps {
  /** Whether rooms out of sight sleep (Settings). */
  readonly on: () => boolean;
  /** Every room of the resident scenes. */
  readonly rooms: () => readonly RoomDefinition[];
  /** The door leaves that close doorways: their ids and where they stand. */
  readonly closers: () => readonly { id: string; x: number; z: number }[];
  /** How far a leaf is open (0 shut). */
  readonly opening: (closerId: string) => number;
  /** The room at a floor point, of any resident scene. */
  readonly roomAt: (x: number, z: number) => string | null;
  /** The roots of what is drawn of a room now (shells, decor, entity views; not what is held). */
  readonly objectsOf: (roomId: string) => THREE.Object3D[];
  /** Everything drawn, to tell which GPU resources a room shares with what stays awake. */
  readonly scene: THREE.Object3D;
  /**
   * Compiles and draws `objects` once, a few a frame, before they are shown (the renderer's warm
   * path, as for a scene attached); resolves when they may be shown.
   */
  readonly warm: (objects: THREE.Object3D[]) => Promise<void>;
  /** Finishes the warm-up under way at once (a door opens on a room still waking). */
  readonly hurry: () => void;
  /** The rooms awake changed: the room lights go to them. */
  readonly changed: () => void;
}

interface Asleep {
  /** Each drawn object with its layers before it slept. */
  readonly layers: Map<THREE.Object3D, number>;
  /** Waking: its warm-up under way (its objects are shown when it resolves). */
  waking: boolean;
}

/**
 * Rooms out of sight left undrawn (Phú, 2026-11-06; the rule: world/dormancy.ts). A room put to
 * sleep moves everything drawn of it to ASLEEP_LAYER — no draw, no shadow, its lights given to the
 * rooms awake — and frees the GPU buffers only it uses (three uploads them again at their next
 * draw). Woken while its door is still shut and the player some metres away, its
 * objects are compiled and drawn into one pixel a few a frame (the warm-up of a neighbour scene),
 * then shown: by the time the door opens it costs a frame nothing. Judged four times a second,
 * never per frame; nothing is allocated between.
 */
export class RoomSleep {
  private readonly asleep = new Map<string, Asleep>();
  private awake = new Set<string>();
  private passages: Passage[] = [];
  private passagesFor = '';
  private clock = 0;

  constructor(private readonly deps: RoomSleepDeps) {}

  /** The rooms asleep (waking ones among them), for the debug panel. */
  get rooms(): { asleep: string[]; waking: string[] } {
    const asleep: string[] = [];
    const waking: string[] = [];
    for (const [id, room] of this.asleep) (room.waking ? waking : asleep).push(id);
    return { asleep: asleep.sort(), waking: waking.sort() };
  }

  isAsleep(roomId: string): boolean {
    const room = this.asleep.get(roomId);
    return room !== undefined && !room.waking;
  }

  /** Judges the rooms again every JUDGE_S, the player's feet at (x, z). */
  update(dt: number, x: number, z: number): void {
    this.clock += dt;
    if (this.clock < JUDGE_S) return;
    this.clock = 0;
    this.judge(x, z);
  }

  /** Judges at once (a scene loaded or attached, the setting changed). */
  judge(x: number, z: number): void {
    const { deps } = this;
    const rooms = deps.rooms();
    if (!deps.on()) {
      this.wakeAll();
      return;
    }
    const ids = rooms.map((r) => r.id);
    const key = ids.join(',');
    if (key !== this.passagesFor) {
      this.passages = passagesBetween(rooms, deps.closers());
      this.passagesFor = key;
      for (const id of [...this.asleep.keys()]) if (!ids.includes(id)) this.asleep.delete(id);
    }
    const awake = awakeRooms(
      ids,
      this.passages,
      { x, z, room: deps.roomAt(x, z) },
      deps.opening,
      this.awake,
    );
    let changed = false;
    for (const id of ids) {
      const room = this.asleep.get(id);
      if (awake.has(id) && room && !room.waking) {
        this.wake(id, room);
        changed = true;
      } else if (!awake.has(id) && (!room || room.waking)) {
        this.sleep(id);
        changed = true;
      }
    }
    // A door opening on a room still waking: shown now, a slow frame rather than an empty room.
    for (const p of this.passages) {
      if (!p.closers.some((c) => deps.opening(c) > 0)) continue;
      if (p.rooms.some((id) => this.asleep.get(id)?.waking)) deps.hurry();
    }
    this.awake = awake;
    if (changed) deps.changed();
  }

  /** Whether `object` belongs to a room asleep now (the renderer's warm-up leaves it asleep). */
  holds(object: THREE.Object3D): boolean {
    for (const room of this.asleep.values()) {
      if (!room.waking && room.layers.has(object)) return true;
    }
    return false;
  }

  /** What is added to a room asleep (an entity spawned there) sleeps with it. */
  adopt(roomId: string, root: THREE.Object3D): void {
    const room = this.asleep.get(roomId);
    if (room && !room.waking) this.lay(root, room.layers);
  }

  /** Every room drawn again (the setting off), each warmed first. */
  wakeAll(): void {
    let changed = false;
    for (const [id, room] of this.asleep) {
      if (room.waking) continue;
      this.wake(id, room);
      changed = true;
    }
    this.awake.clear();
    if (changed) this.deps.changed();
  }

  /** Forgets every room (the scene unloaded: its objects are gone). */
  forgetAll(): void {
    this.asleep.clear();
    this.awake.clear();
    this.passagesFor = '';
  }

  /** Forgets the rooms of a scene freed (its objects are gone). */
  forget(roomIds: readonly string[]): void {
    for (const id of roomIds) {
      this.asleep.delete(id);
      this.awake.delete(id); // attached again, it is judged afresh, not by its last visit
    }
    this.passagesFor = '';
  }

  private sleep(roomId: string): void {
    // A room put back to sleep while waking keeps its record: its warm-up's end lays it again.
    const room = this.asleep.get(roomId) ?? {
      layers: new Map<THREE.Object3D, number>(),
      waking: false,
    };
    room.waking = false;
    for (const root of this.deps.objectsOf(roomId)) this.lay(root, room.layers);
    this.asleep.set(roomId, room);
    this.release(room.layers);
  }

  /** Moves the drawn objects under `root` to ASLEEP_LAYER, remembering their layers. */
  private lay(root: THREE.Object3D, layers: Map<THREE.Object3D, number>): void {
    root.traverse((object) => {
      if (!(object as Partial<THREE.Mesh>).material || object.layers.mask === 1 << ASLEEP_LAYER) {
        return;
      }
      if (!layers.has(object)) layers.set(object, object.layers.mask & OWN_LAYERS || 1);
      object.layers.set(ASLEEP_LAYER);
    });
  }

  private wake(roomId: string, room: Asleep): void {
    room.waking = true;
    const objects = [...room.layers.keys()];
    this.deps
      .warm(objects)
      .catch(() => undefined) // shown unwarmed: its first draw uploads it
      .finally(() => {
        if (this.asleep.get(roomId) !== room) return; // its scene freed meanwhile
        if (!room.waking) {
          // Asleep again meanwhile: the warm-up left its objects pending.
          for (const object of room.layers.keys()) object.layers.set(ASLEEP_LAYER);
          return;
        }
        for (const [object, mask] of room.layers) object.layers.mask = mask;
        this.asleep.delete(roomId);
      });
  }

  /**
   * Frees the GPU buffers of the objects asleep that nothing awake uses (three uploads them again
   * at their next draw, here the warm-up's; the arrays stay in memory). Textures are kept: freed,
   * SwiftShader prepared them again only when they were first sampled over the screen — the frame
   * the room appeared, ~300 ms in the lab (the warm-up samples one pixel) — and a room's are few.
   */
  private release(layers: Map<THREE.Object3D, number>): void {
    const used = new Set<object>();
    this.deps.scene.traverse((object) => {
      if (layers.has(object) || object.layers.mask === 1 << ASLEEP_LAYER) return;
      collect(object, used);
    });
    const freed = new Set<object>();
    for (const object of layers.keys()) collect(object, freed);
    for (const resource of freed) {
      if (!used.has(resource) && resource instanceof THREE.BufferGeometry) resource.dispose();
    }
  }
}

/** The geometry an object draws with. */
function collect(object: THREE.Object3D, into: Set<object>): void {
  const mesh = object as Partial<THREE.Mesh>;
  if (mesh.material && mesh.geometry) into.add(mesh.geometry);
}
