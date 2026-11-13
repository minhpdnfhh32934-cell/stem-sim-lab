import { Disposables, type EventBus } from '../../core/EventBus';
import type { Logger } from '../../core/Logger';
import { directionFromYawPitch, type Vec3 } from '../../core/math';
import type { GameSystem } from '../../core/SystemRunner';
import type { GameEvents } from '../../game/GameEvents';
import type { GameState } from '../../game/GameState';
import type { EntityStates } from '../../world/EntityStates';
import type { World, WorldEntity } from '../../world/World';
import type { InputState } from '../player/InputState';

/** Seconds a fire takes from a spark to its full size. */
const GROW_S = 45;
/** How far past its own reach (m) a fire heats what can burn. */
const SPREAD_REACH = 0.3;
/** At most this many fires at once (each on its own object). */
const MAX_FIRES = 16;
/** A fire's size at which what it is on is blackened, and at which it is ruined. */
const CHAR_AT = 0.3;
const BURNT_AT = 0.5;
/** How much of a fire's size (1 = full) a CO₂ jet on it puts out each second. */
const KNOCK_PER_S = 0.45;
/** How far beside the jet's line (m) a fire is still reached, past its own size. */
const JET_WIDTH = 0.35;
/** Seconds the fire brigade takes after a 114 call (shortened for play). */
export const BRIGADE_S = 30;
/** Seconds between warnings to step back. */
const WARN_EVERY_S = 6;
/** Seconds between saves of a fire's size. */
const SAVE_EVERY_S = 1;

/** Entity-state keys: a fire's size on what it burns (saved), where on it, an extinguisher's charge. */
export const BURNING_KEY = 'burning';
export const BURNING_AT_KEY = 'burningAt';
export const CHARGE_KEY = 'charge';
export const CHARRED_KEY = 'charred';

/** One fire, on one object. */
export interface Fire {
  readonly entityId: string;
  /** Where on the object's top face it started: x, z in the object's frame. */
  readonly offset: [number, number];
  /** 0…1: a spark to fully alight. */
  size: number;
  /** Where it is (its object's top face) and how far it reaches (m), worked out each frame. */
  readonly position: Vec3;
  radius: number;
  /** Size last saved. */
  saved: number;
}

export interface FireSystemDeps {
  state: GameState;
  events: EventBus<GameEvents>;
  world: World;
  entityStates: EntityStates;
  input: InputState;
  hands: { readonly heldEntity: WorldEntity | null };
  log: Logger;
}

/**
 * Fire (Phú, Phase E-2): it starts where a circuit part or lead caught fire (`CircuitIncident`),
 * grows to its full size in GROW_S, and sets alight what can burn near it (items with `burns`,
 * after their `ignitionS` of exposure weighted by the fire's size) — the board, the bench, parts
 * lying about, the bench beside. It never goes out by itself: a CO₂ extinguisher held and sprayed
 * at it (the left mouse button) knocks it down, or the fire brigade called on 114 puts every fire
 * out when it arrives. A fire past half its size ruins what it is on (`EntityBurnt`) and blackens
 * it (`charred`, saved). Fires are kept in their objects' entity states, so a reload brings them
 * back. Illustrative: the spread and growth times are chosen for play, not a fire model.
 */
export class FireSystem implements GameSystem {
  readonly id = 'fire';
  private readonly fires = new Map<string, Fire>();
  /** The fires, for views (positions and reaches current each frame). */
  readonly list: Fire[] = [];
  private readonly exposure = new Map<string, number>();
  private readonly subscriptions = new Disposables();
  private readonly eye: Vec3 = [0, 0, 0];
  private readonly dir: Vec3 = [0, 0, 0];
  /** While the extinguisher is sprayed: where its jet starts, and which way. */
  spraying = false;
  readonly sprayFrom: Vec3 = [0, 0, 0];
  readonly sprayDir: Vec3 = [0, 0, 0];
  /** Seconds until the fire brigade arrives; null when none is called. */
  brigadeIn: number | null = null;
  private sinceWarned = Infinity;
  private sinceSaved = 0;
  private emptyTold = false;

  constructor(private readonly deps: FireSystemDeps) {}

  init(): void {
    const { events, world } = this.deps;
    const s = this.subscriptions;
    s.add(
      events.subscribe('CircuitIncident', ({ boardId, what, at }) => {
        if (what === 'fire') this.ignite(boardId, at[0], at[1]);
      }),
    );
    s.add(events.subscribe('EntitySpawned', ({ entity }) => this.restore(entity)));
    s.add(
      events.subscribe('EntityDespawned', ({ entityId }) => {
        if (this.fires.delete(entityId)) this.relist();
        this.exposure.delete(entityId);
      }),
    );
    for (const entity of world.allEntities()) this.restore(entity);
  }

  dispose(): void {
    this.subscriptions.dispose();
    this.fires.clear();
    this.list.length = 0;
  }

  /** Whether a fire burns on the entity now. */
  burning(entityId: string): boolean {
    return this.fires.has(entityId);
  }

  /**
   * Another player of the room lit or put out this fire (Phase F-3: its states already set): this
   * game follows. Each game then lets it grow and spread on its own.
   */
  adopt(entityId: string): void {
    const size = this.deps.entityStates.get(entityId, BURNING_KEY);
    const fire = this.fires.get(entityId);
    const entity = this.deps.world.entity(entityId);
    if (typeof size === 'number' && size > 0) {
      if (fire || !entity) return;
      this.restore(entity);
      this.deps.events.publish('FireChanged', { entityId, burning: true });
    } else if (fire) this.out(fire);
  }

  /** Sets an entity alight at (x, z) of its frame (a spark), unless it burns already. */
  ignite(entityId: string, x = 0, z = 0): boolean {
    const entity = this.deps.world.entity(entityId);
    if (!entity || this.fires.has(entityId) || this.fires.size >= MAX_FIRES) return false;
    this.add(entity, [x, z], 0.05);
    this.deps.entityStates.set(entityId, BURNING_AT_KEY, `${x.toFixed(3)},${z.toFixed(3)}`);
    this.deps.entityStates.set(entityId, BURNING_KEY, 0.05);
    this.deps.events.publish('FireChanged', { entityId, burning: true });
    return true;
  }

  /**
   * A call on the player's phone (Phase E-2). 114 (fire and rescue) sends the brigade when
   * something burns; with nothing burning it is a false alarm. 113 and 115 are other emergency
   * services, any other number does not answer here.
   */
  call(number: string): GameEvents['EmergencyCall']['outcome'] {
    const digits = number.replace(/\D/g, '');
    let outcome: GameEvents['EmergencyCall']['outcome'];
    if (digits === '114') {
      if (this.fires.size === 0) outcome = 'false-alarm';
      else if (this.brigadeIn !== null) outcome = 'already-coming';
      else {
        this.brigadeIn = BRIGADE_S;
        outcome = 'dispatched';
      }
    } else if (digits === '113' || digits === '115') outcome = 'other-service';
    else outcome = 'no-answer';
    this.deps.events.publish('EmergencyCall', { number: digits, outcome });
    return outcome;
  }

  update(dt: number): void {
    const { state } = this.deps;
    if (dt <= 0 || state.session.phase !== 'playing') return;
    this.place();
    this.spray(dt);
    for (const fire of this.list) this.grow(fire, dt);
    this.spread(dt);
    this.brigade(dt);
    this.warn(dt);
    this.sinceSaved += dt;
    if (this.sinceSaved >= SAVE_EVERY_S) {
      this.sinceSaved = 0;
      for (const fire of this.list) this.save(fire);
    }
  }

  // ---- fires ----------------------------------------------------------------------------------

  private add(entity: WorldEntity, offset: [number, number], size: number): void {
    const fire: Fire = {
      entityId: entity.id,
      offset,
      size,
      position: [0, 0, 0],
      radius: 0,
      saved: size,
    };
    this.fires.set(entity.id, fire);
    this.exposure.delete(entity.id);
    this.relist();
    this.place();
  }

  /** A fire saved on an entity comes back with it. */
  private restore(entity: WorldEntity): void {
    const size = this.deps.entityStates.get(entity.id, BURNING_KEY);
    if (typeof size !== 'number' || size <= 0 || this.fires.has(entity.id)) return;
    const at = String(this.deps.entityStates.get(entity.id, BURNING_AT_KEY) ?? '0,0')
      .split(',')
      .map(Number);
    this.add(entity, [at[0] || 0, at[1] || 0], Math.min(1, size));
  }

  private relist(): void {
    this.list.length = 0;
    for (const fire of this.fires.values()) this.list.push(fire);
  }

  private out(fire: Fire): void {
    this.fires.delete(fire.entityId);
    this.relist();
    this.exposure.delete(fire.entityId);
    this.deps.entityStates.set(fire.entityId, BURNING_KEY, 0);
    this.deps.events.publish('FireChanged', { entityId: fire.entityId, burning: false });
  }

  private save(fire: Fire): void {
    const size = Math.round(fire.size * 100) / 100;
    if (size === fire.saved) return;
    fire.saved = size;
    this.deps.entityStates.set(fire.entityId, BURNING_KEY, size);
  }

  /** Each fire's place (its object may move) and reach: its size over its object's half extent. */
  private place(): void {
    for (const fire of this.list) {
      const entity = this.deps.world.entity(fire.entityId);
      if (!entity) continue;
      const { position, rotation } = entity.pose;
      const yaw = 2 * Math.atan2(rotation[1], rotation[3]);
      const [c, s] = [Math.cos(yaw), Math.sin(yaw)];
      const [x, z] = fire.offset;
      const [w, h, d] = entity.item.visual.size;
      fire.position[0] = position[0] + c * x + s * z;
      fire.position[1] = position[1] + h / 2;
      fire.position[2] = position[2] - s * x + c * z;
      fire.radius = 0.05 + fire.size * Math.max(w, d) * 0.5;
    }
  }

  private grow(fire: Fire, dt: number): void {
    const was = fire.size;
    fire.size = Math.min(1, fire.size + dt / GROW_S);
    if (was < CHAR_AT && fire.size >= CHAR_AT) {
      this.deps.entityStates.set(fire.entityId, CHARRED_KEY, true);
    }
    if (was < BURNT_AT && fire.size >= BURNT_AT) {
      this.deps.events.publish('EntityBurnt', { entityId: fire.entityId });
    }
  }

  /** What can burn near a fire takes its heat, and catches at its own ignition time. */
  private spread(dt: number): void {
    if (this.list.length === 0) return;
    for (const entity of this.deps.world.allEntities()) {
      const burns = entity.item.burns;
      if (!burns || this.fires.has(entity.id)) continue;
      const { position, rotation } = entity.pose;
      const [w, h, d] = entity.item.visual.size;
      const turned = Math.abs(Math.sin(2 * Math.atan2(rotation[1], rotation[3]))) > 0.5;
      const [hx, hz] = turned ? [d / 2, w / 2] : [w / 2, d / 2];
      let heat = 0;
      let nearest: WorldEntity | null = null;
      let nx = 0;
      let nz = 0;
      for (const fire of this.list) {
        const p = fire.position;
        if (p[1] < position[1] - h / 2 - 1 || p[1] > position[1] + h / 2 + 1) continue;
        const dx = Math.max(0, Math.abs(p[0] - position[0]) - hx);
        const dz = Math.max(0, Math.abs(p[2] - position[2]) - hz);
        if (Math.hypot(dx, dz) > fire.radius + SPREAD_REACH) continue;
        heat += fire.size;
        nearest = entity;
        // The nearest point of it to this fire: where it catches.
        nx = Math.max(-hx, Math.min(hx, p[0] - position[0]));
        nz = Math.max(-hz, Math.min(hz, p[2] - position[2]));
      }
      if (!nearest) continue;
      const exposure = (this.exposure.get(entity.id) ?? 0) + heat * dt;
      if (exposure < burns.ignitionS) {
        this.exposure.set(entity.id, exposure);
        continue;
      }
      // Into its own frame (a placement turns about +y only).
      const yaw = 2 * Math.atan2(rotation[1], rotation[3]);
      const [c, s] = [Math.cos(yaw), Math.sin(yaw)];
      this.ignite(entity.id, c * nx - s * nz, s * nx + c * nz);
    }
  }

  /** The held extinguisher, sprayed while the left button is held: its jet knocks fires down. */
  private spray(dt: number): void {
    const { hands, input, entityStates, state, events } = this.deps;
    const held = hands.heldEntity;
    const spec = held?.item.extinguisher;
    this.spraying = false;
    if (!held || !spec || !input.isHeld('throw')) return;
    const left = entityStates.get(held.id, CHARGE_KEY);
    const charge = typeof left === 'number' ? left : spec.seconds;
    if (charge <= 0) {
      if (!this.emptyTold) events.publish('FireNotice', { what: 'empty' });
      this.emptyTold = true;
      return;
    }
    this.emptyTold = false;
    this.spraying = true;
    const p = state.player;
    directionFromYawPitch(p.yaw, p.pitch, this.dir);
    this.eye[0] = p.position[0];
    this.eye[1] = p.position[1] + p.eyeHeight;
    this.eye[2] = p.position[2];
    // From its horn, by its top, along the view.
    const top = held.item.visual.size[1] / 2;
    for (let i = 0; i < 3; i++) {
      this.sprayFrom[i] =
        (held.pose.position[i] ?? 0) + (i === 1 ? top : 0) + (this.dir[i] ?? 0) * 0.1;
      this.sprayDir[i] = this.dir[i] ?? 0;
    }
    const next = Math.max(0, charge - dt);
    // Saved in steps of a tenth of a second: not an entity-state event every frame.
    if (Math.floor(next * 10) !== Math.floor(charge * 10))
      entityStates.set(held.id, CHARGE_KEY, next);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const fire = this.list[i];
      if (!fire) continue;
      const vx = fire.position[0] - this.eye[0];
      const vy = fire.position[1] - this.eye[1];
      const vz = fire.position[2] - this.eye[2];
      const along = vx * this.dir[0] + vy * this.dir[1] + vz * this.dir[2];
      if (along <= 0 || along > spec.range + fire.radius) continue;
      const across = Math.sqrt(Math.max(0, vx * vx + vy * vy + vz * vz - along * along));
      if (across > fire.radius + JET_WIDTH) continue;
      fire.size -= KNOCK_PER_S * dt;
      if (fire.size > 0) continue;
      this.out(fire);
      if (this.fires.size === 0) events.publish('FireNotice', { what: 'out' });
    }
  }

  private brigade(dt: number): void {
    if (this.brigadeIn === null) return;
    this.brigadeIn -= dt;
    if (this.brigadeIn > 0) return;
    this.brigadeIn = null;
    for (const fire of [...this.list]) this.out(fire);
    this.deps.events.publish('FireNotice', { what: 'brigade-arrived' });
  }

  /** Too close to a fire: a warning, now and then. */
  private warn(dt: number): void {
    this.sinceWarned += dt;
    if (this.sinceWarned < WARN_EVERY_S) return;
    const p = this.deps.state.player.position;
    for (const fire of this.list) {
      const near = Math.hypot(fire.position[0] - p[0], fire.position[2] - p[2]);
      if (near > fire.radius + 0.5) continue;
      this.sinceWarned = 0;
      this.deps.events.publish('FireNotice', { what: 'too-close' });
      return;
    }
  }
}
