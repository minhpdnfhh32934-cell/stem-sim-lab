import { Disposables, type EventBus } from '../../core/EventBus';
import type { Vec3 } from '../../core/math';
import type { Registry } from '../../core/Registry';
import type { GameSystem } from '../../core/SystemRunner';
import type { GameEvents } from '../../game/GameEvents';
import type { GameState } from '../../game/GameState';
import type { World, WorldEntity } from '../../world/World';
import type { ProcedureDefinition } from '../procedure/procedure';
import {
  type ActionSequence,
  atTarget,
  type HandSample,
  sampleLean,
  sampleLook,
  startsAtTarget,
} from './action';
import { handPoint } from './handPoint';

export interface ActionSystemDeps {
  state: GameState;
  events: EventBus<GameEvents>;
  world: World;
  /** The sequences (`content/actions.json`, with the lab pack). */
  actions: Registry<ActionSequence>;
  /** The procedures: a hand-hygiene step's motion is worked at its item (the basin, a dispenser). */
  procedures: Registry<ProcedureDefinition>;
}

/**
 * What an action is acted on: a world entity, or something like one that is not in the world (a
 * paper held out in a person's hand, Phase Y-5): its id, item (its look), pose and room.
 */
export type ActionTarget = Pick<WorldEntity, 'id' | 'item' | 'pose' | 'roomId'>;

/** The action playing, as the views read it. */
export interface PlayingAction {
  readonly sequence: ActionSequence;
  /** Seconds since it started. */
  readonly t: number;
  /** What it acts on (the entity performed on, the one let go, or a paper held out). */
  readonly target: ActionTarget;
}

/**
 * An arm's length (m) from the eye: the player leans in until what the hands work is this far,
 * at most LEAN_MAX (Phú, 2026-11-04: "lean in to a reasonable distance to do it").
 */
const ARM = 0.58;
const LEAN_MAX = 0.6;
/**
 * AFFORDANCE: how near (m, feet to where the hand works, along the floor) the player steps before
 * an action whose hands go to its target first: within an arm's reach, the lean doing the rest.
 */
const STAND = 0.5;
/** The step in gives up when it stops getting nearer this long (a counter in the way; s), or after MAX. */
const STALL_S = 0.2;
/** m/s: nearer more slowly than this is not getting there. */
const GAIN = 0.4;
const STEP_MAX_S = 3;
/** A quick hand-hygiene step's motion plays this long after it is done (HandsView's AFTER_S). */
const LINGER_S = 0.9;

/**
 * Plays actions acted out (Phase H-3, contract H7–H8): when an action is performed (or the hold
 * ends) and a sequence matches it, it plays for the sequence's seconds; meanwhile the player does
 * not move and no other action starts (`busy`, unless a tap's `waits` is false; looking around
 * stays free: D2). An action whose sequence has an `effect` moment is performed then (`defer`):
 * the water runs as the hand turns the handle, a door opens as the card touches its reader. Others
 * take effect at once and only their look waits (`swap`, `place`): SPEC DEVIATION from contract
 * H7, kept where nothing in play can tell. While the hands work something — a sequence's target,
 * or a hand-hygiene step's item — the player leans in to an arm's length of it (`lean`, `work`).
 * Not saved: a save during one has its effect (or not yet, before its `effect`).
 */
export class ActionSystem implements GameSystem {
  readonly id = 'actions';
  private readonly subscriptions = new Disposables();
  private playing: {
    sequence: ActionSequence;
    t: number;
    target: ActionTarget;
    actionId: string | null;
    /** The action itself, performed at the sequence's `effect` (then cleared). */
    effect: (() => void) | null;
    /** Stepping up to the target first (its clock waits): the nearest yet, how long without getting nearer, how long in all. */
    step: { nearest: number; stall: number; spent: number } | null;
  } | null = null;
  private readonly toward: Vec3 = [0, 0, 0];
  /** The item a hand-hygiene step is worked at, and for how much longer once it is done. */
  private working: { entity: WorldEntity; linger: number | null } | null = null;
  private readonly point: Vec3 = [0, 0, 0];
  private readonly sample: HandSample = {
    from: { at: 'body', offset: [0, 0, 0], palm: 'down', fingers: 'open' },
    to: { at: 'body', offset: [0, 0, 0], palm: 'down', fingers: 'open' },
    along: 0,
    weight: 0,
  };
  private readonly look = { weight: 0, pitch: 0 };

  constructor(private readonly deps: ActionSystemDeps) {}

  init(): void {
    const { events } = this.deps;
    const s = this.subscriptions;
    s.add(
      events.subscribe('InteractionPerformed', ({ entityId, actionId }) => {
        const p = this.playing;
        if (p && p.target.id === entityId && p.actionId === actionId) return; // its own effect
        this.start(entityId, actionId, (on) => on.action === actionId, null);
      }),
    );
    s.add(
      events.subscribe('ObjectReleased', ({ entityId, reason }) =>
        this.start(entityId, null, (on) => on.released === reason, null),
      ),
    );
    s.add(
      events.subscribe('ProcedureStepStarted', ({ procedureId, stepId }) => {
        const entity = this.itemOf(procedureId, stepId);
        this.working = entity ? { entity, linger: null } : null;
      }),
    );
    s.add(
      events.subscribe('ProcedureStepCompleted', ({ procedureId, stepId }) => {
        const entity = this.itemOf(procedureId, stepId);
        this.working = entity ? { entity, linger: LINGER_S } : null;
      }),
    );
    s.add(events.subscribe('ProcedureStepCancelled', () => (this.working = null)));
    s.add(
      events.subscribe('SceneLoaded', () => {
        this.playing = null;
        this.working = null;
      }),
    );
  }

  /** The action playing now, or null. */
  get current(): PlayingAction | null {
    return this.playing;
  }

  /**
   * Whether an action that holds the player is playing: they stand, and no other action starts.
   * One that takes effect later holds them only until then (the card on the reader: the door
   * opens, the hand goes back to the pocket as they walk).
   */
  /**
   * While the player steps up to what the hands will work (out of their reach when it started):
   * the way along the floor to where they stand to work it (m; reused, read it at once), else null.
   */
  get step(): Readonly<Vec3> | null {
    const p = this.playing;
    if (!p?.step) return null;
    const far = this.far(p.target);
    const scale = Math.max(0, far - STAND) / Math.max(far, 1e-6);
    this.toward[0] *= scale;
    this.toward[2] *= scale;
    return this.toward;
  }

  get busy(): boolean {
    const p = this.playing;
    return p !== null && p.sequence.waits && (p.sequence.effect === undefined || p.effect !== null);
  }

  /**
   * Where the hands work now (world), or null: the playing sequence's target while a hand is at
   * it, else a hand-hygiene step's item. Reused: read it at once.
   */
  get work(): Readonly<Vec3> | null {
    const p = this.playing;
    if (p && atTarget(p.sequence, p.t, this.sample) > 0) {
      return handPoint(p.target, this.deps.world, this.point);
    }
    const w = this.working;
    return w ? handPoint(w.entity, this.deps.world, this.point) : null;
  }

  /**
   * How far (rad) the eyes look away from the player's own pitch now: down to the hands the
   * playing sequence works in front of the body (its `look` keys), 0 otherwise.
   */
  get glance(): number {
    const p = this.playing;
    if (!p) return 0;
    const { weight, pitch } = sampleLook(p.sequence, p.t, this.look);
    return weight * (pitch - this.deps.state.player.pitch);
  }

  /**
   * The lean (m along the view) the hands' work asks now: the sequence's own (a crouch), or in to
   * an arm's length of what they work (at most LEAN_MAX), whichever is more.
   */
  get lean(): number {
    const p = this.playing;
    const own = p ? sampleLean(p.sequence, p.t) : 0;
    const w = p ? atTarget(p.sequence, p.t, this.sample) : this.working ? 1 : 0;
    const at = w > 0 ? this.work : null;
    if (!at) return own;
    const { position, eyeHeight } = this.deps.state.player;
    const far = Math.hypot(
      at[0] - position[0],
      at[1] - (position[1] + eyeHeight),
      at[2] - position[2],
    );
    return Math.max(own, w * Math.min(LEAN_MAX, Math.max(0, far - ARM)));
  }

  /**
   * Plays the sequence for `actionId` on `entityId` if it has an `effect` moment, the action
   * itself (`perform`) run then; true if it does (the caller performs nothing now).
   */
  defer(entityId: string, actionId: string, perform: () => void): boolean {
    const sequence = this.match(entityId, (on) => on.action === actionId);
    if (sequence?.effect === undefined) return false;
    return this.start(entityId, actionId, (on) => on.action === actionId, perform);
  }

  /**
   * Plays sequence `id` on a target that is not a world entity (Phase Y-5: a paper taken from a
   * person's hand, or handed to them), `effect` run at its effect moment. False if the sequence
   * is unknown or an action already holds the player.
   */
  playOn(id: string, target: ActionTarget, effect: () => void): boolean {
    const sequence = this.deps.actions.tryGet(id);
    if (!sequence || this.busy) return false;
    const steps = sequence.stepIn && sequence.waits && startsAtTarget(sequence);
    const far = steps ? this.far(target) : 0;
    const step = far > STAND ? { nearest: far, stall: 0, spent: 0 } : null;
    this.playing = { sequence, t: 0, target, actionId: null, effect, step };
    return true;
  }

  update(dt = 0): void {
    const w = this.working;
    if (w?.linger !== null && w?.linger !== undefined) {
      w.linger -= dt;
      if (w.linger <= 0) this.working = null;
    }
    const p = this.playing;
    if (!p) return;
    if (this.deps.state.session.phase !== 'playing') {
      this.playing = null;
      return;
    }
    const step = p.step;
    if (step) {
      const far = this.far(p.target);
      step.spent += dt;
      // Getting nearer at a walk, or held up (a counter in the way, sliding along its edge).
      step.stall = step.nearest - far >= GAIN * dt ? 0 : step.stall + dt;
      step.nearest = Math.min(step.nearest, far);
      if (far > STAND && step.stall < STALL_S && step.spent < STEP_MAX_S) return; // its clock waits
      p.step = null;
    }
    p.t += dt;
    if (p.effect && p.t >= (p.sequence.effect ?? 0)) {
      const effect = p.effect;
      p.effect = null;
      effect();
    }
    if (p.t >= p.sequence.seconds) this.playing = null;
  }

  dispose(): void {
    this.subscriptions.dispose();
    this.playing = null;
    this.working = null;
  }

  /** The first sequence for `entityId` whose `on` matches, if the entity is in the world. */
  private match(
    entityId: string,
    matches: (on: ActionSequence['on']) => boolean,
  ): ActionSequence | null {
    const target = this.deps.world.entity(entityId);
    if (!target) return null;
    for (const sequence of this.deps.actions.all()) {
      const { on } = sequence;
      if (!matches(on)) continue;
      if (on.wornOn !== undefined && target.item.wornOn !== on.wornOn) continue;
      if (on.below !== undefined && target.pose.position[1] >= on.below) continue;
      return sequence;
    }
    return null;
  }

  private start(
    entityId: string,
    actionId: string | null,
    matches: (on: ActionSequence['on']) => boolean,
    effect: (() => void) | null,
  ): boolean {
    const sequence = this.match(entityId, matches);
    const target = this.deps.world.entity(entityId);
    if (!sequence || !target) return false;
    const steps = sequence.stepIn && sequence.waits && startsAtTarget(sequence);
    const far = steps ? this.far(target) : 0;
    const step = far > STAND ? { nearest: far, stall: 0, spent: 0 } : null;
    this.playing = { sequence, t: 0, target, actionId, effect, step };
    return true;
  }

  /** How far (m, along the floor) the player's feet are from where a hand works `target`; the way there into `toward`. */
  private far(target: ActionTarget): number {
    const at = handPoint(target, this.deps.world, this.point);
    const { position } = this.deps.state.player;
    this.toward[0] = at[0] - position[0];
    this.toward[1] = 0;
    this.toward[2] = at[2] - position[2];
    return Math.hypot(this.toward[0], this.toward[2]);
  }

  /** The loaded entity a procedure step is done at: of its item, the nearest to the player. */
  private itemOf(procedureId: string, stepId: string): WorldEntity | null {
    const step = this.deps.procedures.tryGet(procedureId)?.steps.find((s) => s.id === stepId);
    if (step?.kind !== 'perform') return null;
    const [x, , z] = this.deps.state.player.position;
    let best: WorldEntity | null = null;
    let near = Infinity;
    for (const entity of this.deps.world.allEntities()) {
      if (!entity.id.endsWith(`/${step.item}`)) continue;
      const d = Math.hypot(entity.pose.position[0] - x, entity.pose.position[2] - z);
      if (d < near) [best, near] = [entity, d];
    }
    return best;
  }
}
