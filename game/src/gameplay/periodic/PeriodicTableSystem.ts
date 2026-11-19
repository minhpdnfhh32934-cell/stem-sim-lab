import { Disposables, type EventBus } from '../../core/EventBus';
import { directionFromYawPitch, type Vec3 } from '../../core/math';
import type { GameSystem } from '../../core/SystemRunner';
import type { GameEvents } from '../../game/GameEvents';
import type { GameState } from '../../game/GameState';
import type { World, WorldEntity } from '../../world/World';
import { CARD, cardPlace, type CardPlace, elementAt } from './layout';

/** How far (m) along the aim a display is read. */
export const FAR_M = 4;
/** How long (s) the aim may be off the display (and its card) before the card goes. */
export const AWAY_S = 0.4;
/** The tag of an item that is a periodic table display. */
const TAG = 'periodic-table';

/** The element shown on a periodic table display, for the view (null: none). */
export interface PeriodicView {
  readonly boardId: string;
  readonly z: number;
}

export interface PeriodicTableSystemDeps {
  readonly state: GameState;
  readonly events: EventBus<GameEvents>;
  readonly world: World;
}

/**
 * The hub's periodic table display (2026-11-14, Phú: no key — the centre of the screen on a tile
 * shows it): the element whose tile the aim is on is shown — its tile lit, its card beside it
 * (render/periodicBoard.ts). The aim on its card keeps it (the card stands over other tiles), on
 * the board between tiles too; off the display for `AWAY_S`, or farther than `FAR_M`, it goes.
 * The only rule authority on what is shown; the views read `view()`. Never saved, never shared.
 */
export class PeriodicTableSystem implements GameSystem {
  readonly id = 'periodic-table';
  private shown: PeriodicView | null = null;
  private card: CardPlace | null = null;
  private away = 0;
  private readonly boards = new Map<string, WorldEntity>();
  private readonly subscriptions = new Disposables();
  private readonly eye: Vec3 = [0, 0, 0];
  private readonly dir: Vec3 = [0, 0, 0];
  private readonly o: Vec3 = [0, 0, 0];
  private readonly v: Vec3 = [0, 0, 0];

  constructor(private readonly deps: PeriodicTableSystemDeps) {}

  init(): void {
    const { events } = this.deps;
    const s = this.subscriptions;
    s.add(
      events.subscribe('EntitySpawned', ({ entity }) => {
        if (entity.item.tags.includes(TAG)) this.boards.set(entity.id, entity);
      }),
    );
    s.add(
      events.subscribe('EntityDespawned', ({ entityId }) => {
        this.boards.delete(entityId);
        if (this.shown?.boardId === entityId) this.hide();
      }),
    );
    for (const type of ['SceneLoading', 'SceneEntered'] as const) {
      s.add(events.subscribe(type, () => this.hide()));
    }
  }

  view(): PeriodicView | null {
    return this.shown;
  }

  update(dt: number): void {
    let seen = false;
    for (const board of this.boards.values()) {
      if (this.look(board)) seen = true;
    }
    if (seen) this.away = 0;
    else if (this.shown && (this.away += dt) > AWAY_S) this.hide();
  }

  dispose(): void {
    this.subscriptions.dispose();
    this.boards.clear();
    this.hide();
  }

  private hide(): void {
    this.shown = null;
    this.card = null;
    this.away = 0;
  }

  /**
   * Where the aim meets `board` (its card first, then its face), within `FAR_M`: the tile there
   * shown. True if the aim is on the board or on its card.
   */
  private look(board: WorldEntity): boolean {
    const player = this.deps.state.player;
    const { eye, dir, o, v } = this;
    eye[0] = player.position[0];
    eye[1] = player.position[1] + player.eyeHeight;
    eye[2] = player.position[2];
    directionFromYawPitch(player.yaw, player.pitch, dir);
    // Into the board's frame (its pose is its box's centre): the conjugate of its rotation.
    const [px, py, pz] = board.pose.position;
    const [qx, qy, qz, qw] = board.pose.rotation;
    turn(eye[0] - px, eye[1] - py, eye[2] - pz, -qx, -qy, -qz, qw, o);
    turn(dir[0], dir[1], dir[2], -qx, -qy, -qz, qw, v);
    if (v[2] >= 0) return false; // looking at its back or along it
    const [w, h, d] = board.item.visual.size;
    // The display's face (props/hub.ts `board`): its panel's front, facing +z.
    const front = -d / 2 + Math.min(0.03, d / 2);
    // Its card first: it floats before the board, over other tiles.
    const card = this.shown?.boardId === board.id ? this.card : null;
    if (card) {
      const t = (front + CARD.out - o[2]) / v[2];
      const x = o[0] + v[0] * t - card.x;
      const y = o[1] + v[1] * t - card.y;
      if (t > 0 && t <= FAR_M && Math.abs(x) <= CARD.w / 2 && Math.abs(y) <= CARD.h / 2)
        return true;
    }
    const t = (front - o[2]) / v[2];
    if (t <= 0 || t > FAR_M) return false;
    const x = o[0] + v[0] * t;
    const y = o[1] + v[1] * t;
    if (Math.abs(x) > w / 2 || Math.abs(y) > h / 2) return false;
    const z = elementAt(x, y, w, h);
    if (z !== null && (this.shown?.boardId !== board.id || this.shown.z !== z)) {
      this.shown = { boardId: board.id, z };
      this.card = cardPlace(z, w, h);
    }
    return true;
  }
}

/** (x, y, z) turned by the unit quaternion (qx, qy, qz, qw), into `out`. */
function turn(
  x: number,
  y: number,
  z: number,
  qx: number,
  qy: number,
  qz: number,
  qw: number,
  out: Vec3,
): void {
  // t = 2 q × v; v' = v + w t + q × t
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);
  out[0] = x + qw * tx + (qy * tz - qz * ty);
  out[1] = y + qw * ty + (qz * tx - qx * tz);
  out[2] = z + qw * tz + (qx * ty - qy * tx);
}
