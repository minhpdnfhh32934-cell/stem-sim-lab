import { Disposables, type EventBus } from '../../core/EventBus';
import type { GameSystem } from '../../core/SystemRunner';
import type { GameEvents } from '../../game/GameEvents';
import type { GameState } from '../../game/GameState';
import { buildNavGrid, findPath, type NavGrid, nearestFree } from '../../world/navGrid';
import type { World } from '../../world/World';
import type { ItemDefinition } from '../item';
import type { ActiveTask } from './TaskSystem';

export interface TaskGuideDeps {
  state: GameState;
  events: EventBus<GameEvents>;
  world: World;
  itemOf: (id: string) => ItemDefinition | undefined;
  /** The followed task and its step (TaskSystem). */
  active: () => ActiveTask | null;
  /**
   * The item the scene's procedure's next step is done with (the cleanroom entry: the coat, the
   * faucet, the basin…), or null: with no task followed here, its objects are outlined.
   */
  procedureItem?: () => string | null;
}

/** How often (s) the way is looked for again, at most. */
const INTERVAL_S = 0.25;
/** How far (m) from an object the player may stand to use it (the stand point is within this). */
const REACH = 1.2;
/** Closer than this (m) to the stand point the player has arrived: no path is drawn. */
const ARRIVED = 0.6;

/**
 * Where the guided task leads now (Phase A contract A5): the current step's objects that are in
 * the player's scene (outlined), and a walkable path on the floor from the player to the free spot
 * beside the nearest of them. The grid is built once per scene (its rooms' static items); the path
 * is looked for again only when the player has moved a cell or the step changed, at most four
 * times a second. It reads the task and the world; it changes neither.
 */
export class TaskGuide implements GameSystem {
  readonly id = 'task-guide';
  private grid: NavGrid | null = null;
  private gridRooms = '';
  private since = Infinity;
  private lastCell = -1;
  private lastStep = '';
  private readonly scratch: number[] = [];
  private readonly stand: [number, number] = [0, 0];
  private readonly subscriptions = new Disposables();
  /** x, z pairs from the player to the stand point (empty: nothing to walk to). */
  path: number[] = [];
  /** The current step's objects in the player's scene (entity ids). */
  objects: string[] = [];
  /** Grows when `path` or `objects` change. */
  version = 0;

  constructor(private readonly deps: TaskGuideDeps) {}

  init(): void {
    const again = () => {
      this.since = Infinity;
      this.lastStep = '';
    };
    for (const event of [
      'TaskStarted',
      'TaskStepCompleted',
      'TaskCompleted',
      'TaskCancelled',
      'SceneEntered',
      'SceneLoaded',
    ] as const) {
      this.subscriptions.add(this.deps.events.subscribe(event, again));
    }
  }

  update(dt: number): void {
    this.since += dt;
    if (this.since < INTERVAL_S) return;
    this.since = 0;
    const { world, state } = this.deps;
    const active = this.deps.active();
    const here = active && world.activeRooms.some((r) => r.id === active.task.room) ? active : null;
    if (!here) {
      this.procedureObjects();
      return;
    }
    const grid = this.gridOf();
    const [px, , pz] = state.player.position;
    const cell = grid
      ? Math.floor((px - grid.minX) / grid.cell) * 100003 + Math.floor((pz - grid.minZ) / grid.cell)
      : -1;
    const step = `${here.task.id}/${here.index}`;
    if (cell === this.lastCell && step === this.lastStep) return;
    this.lastCell = cell;
    this.lastStep = step;
    const objects = here.objects.filter((id) => world.entity(id) !== undefined);
    // The nearest of the step's objects (any of them will do).
    let target: readonly number[] | null = null;
    let best = Infinity;
    for (const id of objects) {
      const p = world.entity(id)?.pose.position;
      if (!p) continue;
      const d = Math.hypot(p[0] - px, p[2] - pz);
      if (d < best) [best, target] = [d, p];
    }
    const path = this.scratch;
    path.length = 0;
    if (grid && target && nearestFree(grid, target[0] ?? 0, target[2] ?? 0, REACH, this.stand)) {
      const away = Math.hypot(this.stand[0] - px, this.stand[1] - pz);
      if (away > ARRIVED) findPath(grid, px, pz, this.stand[0], this.stand[1], path);
    }
    this.show(path, objects);
  }

  dispose(): void {
    this.subscriptions.dispose();
  }

  /**
   * No task followed here: the procedure's next step's objects outlined (every one of its item in
   * the player's scene), no path — the procedure's own panel says where to go.
   */
  private procedureObjects(): void {
    const item = this.deps.procedureItem?.() ?? null;
    const { world } = this.deps;
    const step = `procedure/${item ?? ''}/${world.entityCount}`;
    if (step === this.lastStep) return;
    this.lastStep = step;
    this.lastCell = -1;
    const objects: string[] = [];
    if (item !== null) {
      const rooms = world.activeRooms;
      for (const entity of world.allEntities()) {
        if (entity.item.id === item && rooms.some((r) => r.id === entity.roomId)) {
          objects.push(entity.id);
        }
      }
    }
    this.show([], objects);
  }

  /** The current scene's grid, built again only when its rooms changed. */
  private gridOf(): NavGrid | null {
    const rooms = this.deps.world.activeRooms;
    // The lab pack adds its placements to the rooms when it loads: their count is in the key.
    const key = rooms.map((r) => `${r.id}:${r.placements.length}`).join('|');
    if (key !== this.gridRooms) {
      this.gridRooms = key;
      this.grid = rooms.length > 0 ? buildNavGrid(rooms, this.deps.itemOf) : null;
    }
    return this.grid;
  }

  private show(path: readonly number[], objects: readonly string[]): void {
    const same =
      path.length === this.path.length &&
      path.every((v, i) => v === this.path[i]) &&
      objects.length === this.objects.length &&
      objects.every((id, i) => id === this.objects[i]);
    if (same) return;
    this.path = [...path];
    this.objects = [...objects];
    this.version++;
  }
}
