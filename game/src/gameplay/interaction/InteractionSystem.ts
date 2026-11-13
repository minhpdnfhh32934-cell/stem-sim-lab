import type { GameConfig } from '../../core/config';
import { Disposables, type EventBus } from '../../core/EventBus';
import type { Texts } from '../../core/i18n';
import type { Logger } from '../../core/Logger';
import { directionFromYawPitch, type Quat, rayBox, rotate, type Vec3 } from '../../core/math';
import type { Registry } from '../../core/Registry';
import type { GameSystem } from '../../core/SystemRunner';
import type { GameEvents } from '../../game/GameEvents';
import type { GameState } from '../../game/GameState';
import type { EntityStates } from '../../world/EntityStates';
import { leafPose } from '../../world/hinge';
import type { WorldEntity } from '../../world/World';
import type { DoorState } from '../door/DoorSystem';
import type { HingeState } from '../door/HingeSystem';
import type { Equipment } from '../player/Equipment';
import type { InputState } from '../player/InputState';
import type { ItemDefinition } from '../item';
import { pointOf } from '../lab/pour';
import type { BehaviorDefinition, Hands } from './behaviors';
import {
  heldClearance,
  holdPoint,
  type LineOfSight,
  type ObjectHolder,
  POUR_AIM,
  POUR_GAP,
  POUR_REACH,
  type SetDownRefusal,
  type SetDownRule,
} from './hold';

/** One thing the player can do to a target right now (open, inspect, turn on, ...). */
export interface InteractionAction {
  readonly id: string;
  readonly label: string;
  /** False hides the action. */
  isAvailable(): boolean;
  /** A reason the offered action cannot be done yet (shown, and the attempt refused). */
  blocked?(): string | null;
  /**
   * Offered only while the player holds something (and then instead of the target's ordinary
   * actions): using the held object on the target, e.g. loading a launcher. E performs it
   * instead of dropping.
   */
  readonly withHeld?: boolean;
  /** A left click performs it too, with empty hands (taking a paper, handing one over: Phase Y-5). */
  readonly click?: boolean;
  /**
   * An offered action that, while available, is the target's only one: its own actions are hidden
   * and refused (the teacher following: E on an experiment only asks him to explain it).
   */
  readonly exclusive?: boolean;
  perform(): void;
}

/**
 * Anything the player can target. Entities become interactables through their item's
 * behaviours; NPCs or UI-less triggers can register directly through `register`.
 */
export interface Interactable {
  readonly id: string;
  readonly displayName: string;
  /** Box centre and orientation; may be live references that change (physics objects). */
  readonly center: Readonly<Vec3>;
  readonly halfExtents: Readonly<Vec3>;
  readonly rotation: Readonly<Quat>;
  readonly actions: readonly InteractionAction[];
}

/**
 * A rule another system plugs in to hold an action back: returns the reason shown to the player,
 * or null to allow it. `entity` is null for interactables that are not world entities. `pressed`:
 * asked by `perform` (the player pressed it), not by a prompt (the HUD asks on every refresh).
 */
export type ActionGuard = (
  entity: WorldEntity | null,
  actionId: string,
  pressed: boolean,
) => string | null;

export interface InteractionSystemDeps {
  state: GameState;
  /** An action acted out is playing (Phase H-3): no other action starts until it ends. */
  busy?: () => boolean;
  /**
   * Acts an allowed action out first when its sequence says when it takes effect (Phase H-3):
   * true if it will be performed then (`perform`), so nothing is performed now.
   */
  defer?: (entityId: string, actionId: string, perform: () => void) => boolean;
  input: InputState;
  events: EventBus<GameEvents>;
  behaviors: Registry<BehaviorDefinition>;
  texts: Texts;
  entityStates: EntityStates;
  equipment: Equipment;
  config: GameConfig;
  log: Logger;
  /** Physics side of holding; without it nothing can be grabbed. */
  holder?: ObjectHolder;
  /** Physics ray queries; without it targets are not checked for occlusion. */
  lineOfSight?: LineOfSight;
  /** Walk-through doors, read by the door behaviour (without it every door is a teleport). */
  doors?: DoorState;
  /** Hinged leaves, read by the openable behaviour (without it they open at any time). */
  hinges?: HingeState;
  /** Item definitions, for behaviours that read another item's (what the player wears). */
  items: Registry<ItemDefinition>;
}

/** How far (m) a walk-through door's aim box reaches past its leaf: the jamb beside, the header above. */
const DOOR_JAMB_M = 0.1;
const DOOR_HEAD_M = 0.175;
/** A target counts as hidden only if a surface is this much (m) in front of it. */
const OCCLUSION_TOLERANCE = 0.01;
/** A held object this far (m) from its hold point for this long (s) is let go (stuck). */
const HOLD_BREAK_DISTANCE = 1;
const HOLD_BREAK_SECONDS = 0.5;
const ZERO: Readonly<Vec3> = [0, 0, 0];

type ReleaseReason = GameEvents['ObjectReleased']['reason'];

/**
 * Generic look-at interaction: finds the nearest visible interactable under the crosshair
 * within reach, and performs its first available action on the interact input (the second on
 * the secondary input). New kinds of
 * interaction are new behaviours (see behaviors.ts) — this system never changes for them.
 *
 * It is also the player's hands: it owns what is held (NotHolding ⇄ Holding). While holding,
 * targeting pauses, interact drops (glassware: sets it down at the aim), throw throws and the
 * held pour input tilts glassware; the physics holder moves the body.
 */
export class InteractionSystem implements GameSystem, Hands {
  readonly id = 'interaction';
  private readonly interactables = new Map<string, Interactable>();
  /** World entities behind entity interactables, for guards. */
  private readonly entities = new Map<string, WorldEntity>();
  /** Target boxes of openable entities, moved with their `open` offset. */
  /** Targeting boxes that change while open (an `openBox`), updated in place. */
  private readonly openableBoxes = new Map<
    string,
    { center: Vec3; halfExtents: Vec3; rotation: Quat }
  >();
  private readonly guards: ActionGuard[] = [];
  private readonly offers: ((targetId: string) => InteractionAction | null)[] = [];
  /** The tilt (rad) the pour input turns the held object to (none: the input does nothing). */
  private pourTilt: ((held: WorldEntity) => number) | null = null;
  private setDownRule: SetDownRule | null = null;
  private focusedId: string | null = null;
  private held: WorldEntity | null = null;
  private stuckSeconds = 0;
  private readonly subscriptions = new Disposables();
  private readonly eye: Vec3 = [0, 0, 0];
  private readonly dir: Vec3 = [0, 0, 0];
  private readonly holdTarget: Vec3 = [0, 0, 0];
  /** Where the pour assist holds the spout (`pourGoal`), and a mouth's place (scratch). */
  private readonly spoutGoal: Vec3 = [0, 0, 0];
  private readonly mouth: Vec3 = [0, 0, 0];
  private pouringAt: Readonly<Vec3> | null = null;
  private readonly throwVelocity: Vec3 = [0, 0, 0];

  constructor(private readonly deps: InteractionSystemDeps) {}

  init(): void {
    const { events } = this.deps;
    const s = this.subscriptions;
    s.add(events.subscribe('EntitySpawned', ({ entity }) => this.registerEntity(entity)));
    s.add(
      events.subscribe('EntityDespawned', ({ entityId }) => {
        if (this.held?.id === entityId) this.release('despawned', ZERO);
        this.unregister(entityId);
      }),
    );
    // Holding never crosses scenes: let go before the old scene is torn down, or as the player
    // walks into a neighbour scene.
    s.add(events.subscribe('SceneLoading', () => this.release('scene-change', ZERO)));
    s.add(events.subscribe('SceneEntered', () => this.release('scene-change', ZERO)));
    s.add(
      events.subscribe('EntityStateChanged', ({ entityId, key }) => {
        if (key === 'open') this.placeOpenable(entityId);
      }),
    );
  }

  /** What the player sees a target called, in the current language (its id if unknown). */
  private readonly nameOf = (entityId: string): string =>
    this.interactables.get(entityId)?.displayName ?? entityId;

  register(interactable: Interactable): () => void {
    if (this.interactables.has(interactable.id)) {
      throw new Error(`Interactable "${interactable.id}" is already registered`);
    }
    this.interactables.set(interactable.id, interactable);
    return () => this.unregister(interactable.id);
  }

  /**
   * Adds an offer: an action another system puts first on a target (or null), e.g. asking the
   * teacher to explain the station looked at (Phase Y). Empty hands only. Returns its removal.
   */
  addOffer(offer: (targetId: string) => InteractionAction | null): () => void {
    this.offers.push(offer);
    return () => {
      const index = this.offers.indexOf(offer);
      if (index >= 0) this.offers.splice(index, 1);
    };
  }

  /** Whether an exclusive offer stands on `targetId` now (its own actions then hidden). */
  private exclusiveOn(targetId: string): boolean {
    if (this.held !== null) return false;
    for (let i = 0; i < this.offers.length; i++) {
      const action = this.offers[i]?.(targetId) ?? null;
      if (action?.exclusive === true && action.isAvailable()) return true;
    }
    return false;
  }

  /** The offered action `actionId` on `targetId`, if an offer makes it now. */
  private offered(targetId: string, actionId: string): InteractionAction | null {
    if (this.held !== null) return null;
    for (const offer of this.offers) {
      const action = offer(targetId);
      if (action?.id === actionId) return action;
    }
    return null;
  }

  /** Adds a rule that can hold actions back with a reason; returns its removal. */
  addGuard(guard: ActionGuard): () => void {
    this.guards.push(guard);
    return () => {
      const index = this.guards.indexOf(guard);
      if (index >= 0) this.guards.splice(index, 1);
    };
  }

  /**
   * Sets what the held `pour` input does: the tilt (rad, about the view's right axis; 0 keeps it
   * upright) a held set-down or upright item is turned to while the input is held, e.g. a
   * container's pour tilt, or its inversion when stoppered. Returns its removal.
   */
  setPourTilt(tilt: (held: WorldEntity) => number): () => void {
    this.pourTilt = tilt;
    return () => {
      if (this.pourTilt === tilt) this.pourTilt = null;
    };
  }

  /** Sets the rule asked before every set-down (it refuses, or commits it); returns its removal. */
  setSetDownRule(rule: SetDownRule): () => void {
    this.setDownRule = rule;
    return () => {
      if (this.setDownRule === rule) this.setDownRule = null;
    };
  }

  /** Why an offered action cannot be done now (its own precondition, then the guards). */
  blockedReason(targetId: string, action: InteractionAction, pressed = false): string | null {
    const own = action.blocked?.() ?? null;
    if (own) return own;
    const entity = this.entities.get(targetId) ?? null;
    for (const guard of this.guards) {
      const reason = guard(entity, action.id, pressed);
      if (reason) return reason;
    }
    return null;
  }

  unregister(id: string): void {
    this.entities.delete(id);
    this.openableBoxes.delete(id);
    if (!this.interactables.delete(id)) return;
    if (this.focusedId === id) this.setFocus(null);
  }

  get count(): number {
    return this.interactables.size;
  }

  get focused(): Interactable | null {
    return this.focusedId === null ? null : (this.interactables.get(this.focusedId) ?? null);
  }

  /** The action `interact` would perform on a target now, or null if none is available. */
  primaryAction(id: string): InteractionAction | null {
    return this.availableAction(id, 0);
  }

  /** The next available action after the primary one, performed by `secondary`, or null. */
  secondaryAction(id: string): InteractionAction | null {
    return this.availableAction(id, 1);
  }

  /**
   * The interactables the held object can be used on now — an action "with held" available and
   * not blocked (fill, deliver, load…), as a prompt would offer it — into `out`; empty while
   * nothing is held. Asked, never decided here: the actions and their guards decide.
   */
  usableTargets(out: string[]): string[] {
    out.length = 0;
    const held = this.held;
    if (!held) return out;
    for (const [id, target] of this.interactables) {
      if (id === held.id) continue;
      for (const action of target.actions) {
        if (action.withHeld !== true || !action.isAvailable()) continue;
        if (this.blockedReason(id, action) === null) {
          out.push(id);
          break;
        }
      }
    }
    return out;
  }

  // ---- Hands --------------------------------------------------------------------------------

  get heldId(): string | null {
    return this.held?.id ?? null;
  }

  /** The held entity (display name, throwable, ...), or null. */
  get heldEntity(): WorldEntity | null {
    return this.held;
  }

  canGrab(entity: WorldEntity): boolean {
    const physical = entity.item.physical;
    return (
      this.held === null &&
      this.deps.holder !== undefined &&
      physical.body === 'dynamic' &&
      physical.massKg <= this.deps.config.player.maxCarryMassKg
    );
  }

  grab(entity: WorldEntity): boolean {
    if (!this.canGrab(entity) || !this.deps.holder?.grab(entity.id)) return false;
    this.held = entity;
    this.stuckSeconds = 0;
    if (this.focusedId !== null) this.setFocus(null);
    this.deps.events.publish('ObjectGrabbed', { entityId: entity.id });
    return true;
  }

  /** Lets go: the object stays where it is and falls under gravity. */
  drop(): boolean {
    return this.release('drop', ZERO);
  }

  /**
   * Sets the held object down at the aim (items whose `physical.handling` is not "free"): physics
   * checks the spot, the set-down rule may refuse or commits it, and the hold ends as physics
   * lowers it there. A refusal keeps it in hand and says why (`ActionBlocked`, `set-down`).
   */
  setDown(): boolean {
    const { holder, events } = this.deps;
    const held = this.held;
    if (!held || !holder) return false;
    const plan = holder.planSetDown();
    const reason = plan.ok
      ? (this.setDownRule?.(held, plan.surfaceId, plan.seat) ?? null)
      : this.refusalText(plan.reason);
    if (reason) {
      events.publish('ActionBlocked', { entityId: held.id, actionId: 'set-down', reason });
      return false;
    }
    if (!holder.setDown()) return false;
    this.held = null;
    this.stuckSeconds = 0;
    events.publish('ObjectReleased', {
      entityId: held.id,
      reason: 'set-down',
      velocity: [0, 0, 0],
    });
    return true;
  }

  private refusalText(reason: SetDownRefusal): string {
    const { texts } = this.deps;
    switch (reason) {
      case 'no-surface':
        return texts.ui('hold.noSurface', 'Nothing to set it down on here.');
      case 'not-level':
        return texts.ui('hold.notLevel', 'That surface is not level.');
      case 'no-room':
        return texts.ui('hold.noRoom', 'No room to set it down there.');
      case 'too-far':
        return texts.ui('hold.tooFar', 'Too far: move closer.');
      case 'wrong-seat':
        return texts.ui('hold.wrongSeat', 'That does not go there.');
    }
  }

  /** Hands the held object over (e.g. into an apparatus), at rest; returns it, or null. */
  place(): WorldEntity | null {
    const held = this.held;
    return held && this.release('placed', ZERO) ? held : null;
  }

  /** Throws a throwable held object along the aim; speed = impulse / mass, capped. */
  throw(): boolean {
    const held = this.held;
    if (!held?.item.physical.throwable) return false;
    const { player } = this.deps.state;
    const { throwImpulse, maxThrowSpeed } = this.deps.config.player;
    const speed = Math.min(throwImpulse / held.item.physical.massKg, maxThrowSpeed);
    const v = directionFromYawPitch(player.yaw, player.pitch, this.throwVelocity);
    v[0] *= speed;
    v[1] *= speed;
    v[2] *= speed;
    return this.release('throw', v);
  }

  // ---- Frame --------------------------------------------------------------------------------

  update(dt: number): void {
    const { state, input } = this.deps;
    if (state.session.phase !== 'playing') {
      if (this.focusedId !== null) this.setFocus(null);
      return;
    }
    if (this.deps.busy?.()) {
      // The hands are taken: inputs wait; what is looked at still follows the view.
      this.updateFocus(); // while holding: only what takes the held object
      return;
    }
    if (this.held) {
      this.updateHeld(this.held, dt);
      return;
    }
    this.updateFocus();
    if (input.wasPressed('interact')) this.interact();
    else if (input.wasPressed('secondary')) this.interact(true);
    else if (input.wasPressed('throw')) this.click();
  }

  /** A left click with empty hands: the focused target's first available action a click does. */
  private click(): boolean {
    const target = this.focused;
    if (!target) return false;
    for (let index = 0; ; index++) {
      const action = this.availableAction(target.id, index);
      if (!action) return false;
      if (action.click) return this.perform(target.id, action.id);
    }
  }

  /** Performs the focused target's primary (or secondary) action. False when nothing happened. */
  interact(secondary = false): boolean {
    const target = this.focused;
    if (!target) return false;
    const action = secondary ? this.secondaryAction(target.id) : this.primaryAction(target.id);
    return action ? this.perform(target.id, action.id) : false;
  }

  perform(targetId: string, actionId: string): boolean {
    const offered = this.offered(targetId, actionId);
    if (!offered && this.exclusiveOn(targetId)) {
      this.deps.log.debug(`Action "${actionId}" is not offered on "${targetId}" now`);
      return false;
    }
    const action =
      offered ?? this.interactables.get(targetId)?.actions.find((a) => a.id === actionId);
    if (!action?.isAvailable()) {
      this.deps.log.warn(`Action "${actionId}" is not available on "${targetId}"`);
      return false;
    }
    const reason = this.blockedReason(targetId, action, true);
    if (reason) {
      this.deps.events.publish('ActionBlocked', { entityId: targetId, actionId, reason });
      return false;
    }
    const commit = () => {
      try {
        action.perform();
      } catch (error) {
        this.deps.log.error(`Action "${actionId}" on "${targetId}" failed`, error);
        return false;
      }
      this.deps.events.publish('InteractionPerformed', { entityId: targetId, actionId });
      return true;
    };
    // Acted out first, it takes effect once the hand is there.
    if (this.deps.defer?.(targetId, actionId, commit)) return true;
    return commit();
  }

  dispose(): void {
    this.subscriptions.dispose();
    this.interactables.clear();
    this.entities.clear();
    this.openableBoxes.clear();
    this.guards.length = 0;
    this.offers.length = 0;
    this.pourTilt = null;
    this.setDownRule = null;
    this.focusedId = null;
    this.held = null;
  }

  private updateHeld(held: WorldEntity, dt: number): void {
    const { input, state, config } = this.deps;
    this.updateFocus(); // only targets that take the held object (withHeld actions)
    const setsDown = held.item.physical.handling !== 'free';
    if (input.wasPressed('interact')) {
      const target = this.focused;
      const action = target ? this.primaryAction(target.id) : null;
      // Use the held object on the target if one is offered (a refusal keeps it in hand);
      // glassware is set down at the aim, anything else let go where it is.
      if (target && action) this.perform(target.id, action.id);
      else if (setsDown) this.setDown();
      else this.drop();
      return;
    }
    if (setsDown) {
      const pouring = input.isHeld('pour') && this.pourTilt !== null;
      const tilt = pouring && this.pourTilt ? this.pourTilt(held) : 0;
      this.deps.holder?.setHoldTilt(tilt);
      this.pouringAt = pouring && held.item.container?.pour ? this.mouthAhead(held) : null;
      this.deps.holder?.setSpoutAt(this.pouringAt);
    }
    if (input.wasPressed('throw') && this.throw()) return;
    // Held objects cannot pass walls; one left behind (e.g. the player walked away from it
    // through a doorway-sized gap) is let go instead of being dragged forever.
    const clear = heldClearance(config.player.radius, held.item);
    holdPoint(
      state.player,
      config.player.holdDistance,
      this.holdTarget,
      clear,
      held.item.heldAside,
    );
    const p = held.pose.position;
    const gap = Math.hypot(
      p[0] - this.holdTarget[0],
      p[1] - this.holdTarget[1],
      p[2] - this.holdTarget[2],
    );
    // Reaching to pour, it is meant to be away from the hold point.
    this.stuckSeconds = gap > HOLD_BREAK_DISTANCE && !this.pouringAt ? this.stuckSeconds + dt : 0;
    if (this.stuckSeconds > HOLD_BREAK_SECONDS) this.release('out-of-reach', ZERO);
  }

  /**
   * Where the pour assist holds the spout now (POUR_GAP over the mouth it reaches for), or null
   * when not pouring at one. The player system leans in towards it.
   */
  get pourGoal(): Readonly<Vec3> | null {
    return this.held ? this.pouringAt : null;
  }

  /**
   * The spout's goal over the vessel mouth nearest the view (within POUR_AIM of it and POUR_REACH
   * of the eye), other than the held object's own; null if there is none.
   */
  private mouthAhead(held: WorldEntity): Readonly<Vec3> | null {
    const player = this.deps.state.player;
    this.eye[0] = player.position[0];
    this.eye[1] = player.position[1] + player.eyeHeight;
    this.eye[2] = player.position[2];
    directionFromYawPitch(player.yaw, player.pitch, this.dir);
    let best = POUR_AIM;
    let found = false;
    for (const entity of this.entities.values()) {
      const mouth = entity.item.container?.mouth;
      if (!mouth || entity === held) continue;
      pointOf(entity.pose.position, entity.pose.rotation, mouth.center, this.mouth);
      const dx = this.mouth[0] - this.eye[0];
      const dy = this.mouth[1] - this.eye[1];
      const dz = this.mouth[2] - this.eye[2];
      const distance = Math.hypot(dx, dy, dz);
      if (distance > POUR_REACH || distance < 1e-6) continue;
      const cos = (dx * this.dir[0] + dy * this.dir[1] + dz * this.dir[2]) / distance;
      const angle = Math.acos(Math.min(1, cos));
      if (angle >= best) continue;
      best = angle;
      found = true;
      this.spoutGoal[0] = this.mouth[0];
      this.spoutGoal[1] = this.mouth[1] + POUR_GAP;
      this.spoutGoal[2] = this.mouth[2];
    }
    return found ? this.spoutGoal : null;
  }

  private release(reason: ReleaseReason, velocity: Readonly<Vec3>): boolean {
    const held = this.held;
    if (!held) return false;
    this.held = null;
    this.pouringAt = null;
    this.stuckSeconds = 0;
    this.deps.holder?.release(velocity);
    this.deps.events.publish('ObjectReleased', {
      entityId: held.id,
      reason,
      velocity: [velocity[0], velocity[1], velocity[2]],
    });
    return true;
  }

  /**
   * The `index`-th currently available action of a target, in the item's behaviour order —
   * while holding, among the actions for the held object; otherwise among the others.
   */
  private availableAction(id: string, index: number): InteractionAction | null {
    const holding = this.held !== null;
    let seen = 0;
    // Offered by another system (empty hands only), ahead of the target's own actions; an
    // exclusive one hides them.
    let exclusive = false;
    if (!holding) {
      for (let i = 0; i < this.offers.length; i++) {
        const action = this.offers[i]?.(id) ?? null;
        if (!action?.isAvailable()) continue;
        exclusive ||= action.exclusive === true;
        if (seen++ === index) return action;
      }
    }
    if (exclusive) return null;
    for (const action of this.interactables.get(id)?.actions ?? []) {
      if ((action.withHeld === true) !== holding || !action.isAvailable()) continue;
      if (seen++ === index) return action;
    }
    return null;
  }

  private hasAction(target: Interactable): boolean {
    return this.availableAction(target.id, 0) !== null;
  }

  private registerEntity(entity: WorldEntity): void {
    if (entity.item.interactions.length === 0) return;
    const { behaviors, events, entityStates, equipment, texts, log } = this.deps;
    const actions: InteractionAction[] = [];
    for (const behaviorId of entity.item.interactions) {
      const behavior = behaviors.tryGet(behaviorId);
      // A placement's translations of its text parameters travel with them (e.g. a label).
      const params = behavior?.params.safeParse(
        entity.vi ? { ...entity.params, vi: entity.vi } : entity.params,
      );
      if (!behavior || !params?.success) {
        // Content is validated at load, so this only happens for entities spawned at runtime.
        log.error(`Entity "${entity.id}": behaviour "${behaviorId}" is unknown or misconfigured`);
        continue;
      }
      const { doors, hinges } = this.deps;
      actions.push(
        ...behavior.createActions(
          {
            entity,
            events,
            entityStates,
            hands: this,
            equipment,
            texts,
            doors,
            hinges,
            nameOf: this.nameOf,
            itemOf: (itemId) => this.deps.items.tryGet(itemId),
          },
          params.data,
        ),
      );
    }
    const [w, h, d] = entity.item.visual.size;
    // An openable object with an open box (the PPE cabinet) is targeted by that box while open.
    let center: Vec3 = entity.pose.position;
    let rotation: Quat = entity.pose.rotation;
    const halfExtents: Vec3 = [w / 2, h / 2, d / 2];
    // ...and a hinged one without (the washroom door) by its leaf, swung open (UX3.1).
    if (entity.item.visual.openBox || entity.item.hinged) {
      center = [...entity.pose.position];
      rotation = [...entity.pose.rotation];
      this.openableBoxes.set(entity.id, { center, halfExtents, rotation });
    }
    const { door } = entity.item;
    if (door) {
      // A walk-through leaf is aimed at by its whole door: the leaf where it stands closed, the
      // pocket it slides into (+x), the jamb it closes against and the header over its track — so
      // the leaf, its pull or its frame answer, closed, sliding or open (UX3.1).
      const shift = rotate(
        entity.pose.rotation,
        [(door.travel - DOOR_JAMB_M) / 2, DOOR_HEAD_M / 2, 0],
        [0, 0, 0],
      );
      center = [0, 1, 2].map((i) => (entity.pose.position[i] ?? 0) + (shift[i] ?? 0)) as Vec3;
      halfExtents[0] = (w + door.travel + DOOR_JAMB_M) / 2;
      halfExtents[1] = (h + DOOR_HEAD_M) / 2;
    }
    this.entities.set(entity.id, entity);
    this.register({
      id: entity.id,
      get displayName() {
        return texts.of(entity.item, 'displayName');
      },
      // Live references: a moving physics object stays targetable where it actually is.
      center,
      halfExtents,
      rotation,
      actions,
    });
    this.placeOpenable(entity.id); // it may already be open (restored from a save)
  }

  private placeOpenable(entityId: string): void {
    const box = this.openableBoxes.get(entityId);
    const entity = this.entities.get(entityId);
    if (!box || !entity) return;
    const { openBox } = entity.item.visual;
    const { hinged } = entity.item;
    const open = this.deps.entityStates.get(entityId, 'open') === true;
    const leaf = hinged?.leaves[0];
    if (open && !openBox && hinged && leaf) {
      const q = entity.pose.rotation;
      const yaw = 2 * Math.atan2(q[1], q[3]); // a placement turns about +y only
      const widest = (hinged.angleDeg * Math.PI) / 180;
      const turned = leafPose(entity.pose.position, yaw, leaf, leaf.opens * widest, box.center);
      for (let i = 0; i < 3; i++) box.halfExtents[i] = (leaf.size[i] ?? 0) / 2;
      box.rotation[0] = 0;
      box.rotation[1] = Math.sin(turned / 2);
      box.rotation[2] = 0;
      box.rotation[3] = Math.cos(turned / 2);
      return;
    }
    const shift = open && openBox ? rotate(entity.pose.rotation, openBox.center, [0, 0, 0]) : ZERO;
    const size = open && openBox ? openBox.size : entity.item.visual.size;
    for (let i = 0; i < 4; i++) box.rotation[i] = entity.pose.rotation[i] ?? 0;
    for (let i = 0; i < 3; i++) {
      box.center[i] = (entity.pose.position[i] ?? 0) + (shift[i] ?? 0);
      box.halfExtents[i] = (size[i] ?? 0) / 2;
    }
  }

  private updateFocus(): void {
    const player = this.deps.state.player;
    this.eye[0] = player.position[0];
    this.eye[1] = player.position[1] + player.eyeHeight;
    this.eye[2] = player.position[2];
    directionFromYawPitch(player.yaw, player.pitch, this.dir);

    // shortcut: linear scan of the loaded scene; add a per-room spatial index when scenes
    // hold several thousand interactables.
    let bestId: string | null = null;
    let bestDistance = this.deps.config.player.reach;
    const holding = this.held !== null;
    for (const target of this.interactables.values()) {
      // While holding, only targets with an action for the held object (never the object).
      if (holding && (target.id === this.held?.id || !this.hasAction(target))) continue;
      const distance = rayBox(
        this.eye,
        this.dir,
        target.center,
        target.halfExtents,
        target.rotation,
      );
      if (distance !== null && distance <= bestDistance) {
        bestDistance = distance;
        bestId = target.id;
      }
    }
    // One physics ray: a wall, bench or other solid in front of the target hides it.
    if (bestId !== null && this.deps.lineOfSight) {
      const hit = this.deps.lineOfSight.castRay(this.eye, this.dir, bestDistance);
      if (hit && hit.entityId !== bestId && hit.distance < bestDistance - OCCLUSION_TOLERANCE) {
        bestId = null;
      }
    }
    if (bestId !== this.focusedId) this.setFocus(bestId);
  }

  private setFocus(id: string | null): void {
    this.focusedId = id;
    this.deps.events.publish('InteractionFocusChanged', { entityId: id });
  }
}
