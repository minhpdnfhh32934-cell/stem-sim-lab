import type { EventBus } from '../../core/EventBus';
import type { Vec3 } from '../../core/math';
import type { GameSystem } from '../../core/SystemRunner';
import type { GameEvents } from '../../game/GameEvents';
import type { GameState } from '../../game/GameState';
import { type ContainerState, totalUl } from '../../simulation/liquid';
import type { World, WorldEntity } from '../../world/World';
import { type LineOfSight, tiltOf } from '../interaction/hold';
import type { InputState } from '../player/InputState';
import { overMouth, PourMeter, pointOf, pourRate } from './pour';

/**
 * The rule and bookkeeping side of liquids (StationSystem): the only writer of container state.
 * LiquidSystem only detects what the player does and asks.
 */
export interface LiquidRules {
  /** A container's state now (read-only), or null for one no station keeps. */
  container(entityId: string): Readonly<ContainerState> | null;
  /** Why pouring from `sourceId` into `receiverId` is refused now, or null. Changes nothing. */
  pourRefusal(sourceId: string, receiverId: string): string | null;
  /**
   * Checks the pour again and commits it in one call: moves up to `wantUl` µL, marks the step,
   * sets the material's parameter, feeds a driven run. Returns the µL moved (0 when refused).
   */
  transfer(sourceId: string, receiverId: string, wantUl: number): number;
  /** A closed vessel was turned over and back: why that is refused, or null (committed). */
  invert(entityId: string): string | null;
  /**
   * Vessels held off any surface (a burette in its clamp): out of the physics simulation, so no
   * ray meets them; a pour looks for their mouths too.
   */
  clamped?(): readonly string[];
}

export interface LiquidSystemDeps {
  state: GameState;
  input: InputState;
  events: EventBus<GameEvents>;
  world: World;
  lineOfSight: LineOfSight;
  rules: LiquidRules;
  hands: {
    readonly heldEntity: WorldEntity | null;
    setPourTilt(tilt: (held: WorldEntity) => number): () => void;
  };
  /** Fixed physics steps run this frame: the pour advances by exactly as many. */
  steps: () => number;
  /** The fixed step (s). */
  fixedStep: number;
}

const DEG = Math.PI / 180;
/** A stoppered vessel is turned towards this (rad): short of 180°, where the turn's axis flips. */
const INVERT_TILT = 165 * DEG;
/**
 * AFFORDANCE: past this tilt and back below `UPRIGHT`, a closed vessel was inverted once (the
 * number of inversions a mixing needs is a SPEC GAP: one counts).
 */
const INVERTED = 150 * DEG;
const UPRIGHT = 30 * DEG;
/** How far (m) below a spout a receiver is looked for. */
const MAX_DROP = 0.5;
const DOWN: Readonly<Vec3> = [0, -1, 0];

/**
 * Pour and inversion detection in the physical lab (`docs/physical-lab-architecture.md` §2.6):
 * geometry only — it writes no state, it asks `LiquidRules` (the StationSystem), which commits.
 * Each frame it advances the pour by the fixed steps physics ran, from the held pose physics wrote
 * back: tilt (or squeeze) → rate; spout ray down → a receiver's mouth within its capture radius →
 * the pair; the pair is asked once, a refusal said once; each step's whole µL are committed. One
 * ray per frame while a held source pours. Allocates nothing per frame.
 */
export class LiquidSystem implements GameSystem {
  readonly id = 'liquids';
  private removeTilt: (() => void) | null = null;
  private readonly meter = new PourMeter();
  private readonly spout: Vec3 = [0, 0, 0];
  private readonly mouth: Vec3 = [0, 0, 0];
  private source: string | null = null;
  private receiver: string | null = null;
  /** The pair was refused (said once): nothing moves until it changes. */
  private blocked = false;
  private poured = 0;
  /** The held closed vessel has passed `INVERTED` and not yet come back upright. */
  private turned: string | null = null;

  constructor(private readonly deps: LiquidSystemDeps) {}

  init(): void {
    const { hands, rules } = this.deps;
    // While `pour` is held: a closed vessel turns over, a tipping one to its full tilt, a squeezed
    // one (and anything else) stays upright.
    this.removeTilt = hands.setPourTilt((held) => {
      const c = held.item.container;
      if (!c) return 0;
      if (rules.container(held.id)?.closed) return INVERT_TILT;
      return c.pour?.trigger === 'tilt' ? c.pour.fullTiltDeg * DEG : 0;
    });
  }

  dispose(): void {
    this.removeTilt?.();
    this.removeTilt = null;
    this.endPour();
  }

  /** The held source pouring now (accepted, not refused), or null — for views (the stream). */
  get pouringFrom(): string | null {
    return this.blocked ? null : this.source;
  }

  /** The receiver the held source is over, accepted or refused, or null — for the HUD's hint. */
  get pouringOver(): string | null {
    return this.receiver;
  }

  /** The receiver it pours into, or null. */
  get pouringInto(): string | null {
    return this.blocked ? null : this.receiver;
  }

  update(): void {
    const held = this.deps.hands.heldEntity;
    const c = held?.item.container;
    const state = held && c ? this.deps.rules.container(held.id) : null;
    if (!held || !c || !state || this.deps.state.session.phase !== 'playing') {
      this.turned = null;
      this.endPour();
      return;
    }
    const tilt = tiltOf(held.pose.rotation);
    if (state.closed) {
      this.endPour();
      this.inversion(held, tilt);
      return;
    }
    this.turned = null;
    const rate = c.pour ? pourRate(c.pour, tilt, this.deps.input.isHeld('pour')) : 0;
    const receiver =
      c.pour && rate > 0 && totalUl(state.contents) > 0 ? this.receiverOf(held) : null;
    if (!receiver) {
      this.endPour();
      return;
    }
    if (this.source !== held.id || this.receiver !== receiver) {
      this.endPour();
      this.source = held.id;
      this.receiver = receiver;
      this.ask();
    }
    if (this.blocked) return;
    const { rules, steps, fixedStep } = this.deps;
    for (let i = steps(); i > 0; i--) {
      const want = this.meter.take(rate, fixedStep);
      const moved = want > 0 ? rules.transfer(held.id, receiver, want) : 0;
      this.poured += moved;
      if (moved < want) this.meter.reset();
      if (want > 0 && moved === 0) {
        // Why it stopped (full to the mark, the source empty, a rule).
        if (this.ask()) return;
      }
    }
  }

  /** The receiver under the held source's spout, or null. */
  private receiverOf(held: WorldEntity): string | null {
    const pour = held.item.container?.pour;
    if (!pour) return null;
    pointOf(held.pose.position, held.pose.rotation, pour.spout, this.spout);
    const hit = this.deps.lineOfSight.castRay(this.spout, DOWN, MAX_DROP);
    // A clamped vessel's mouth under the spout, above whatever the ray met, takes the pour.
    const floor = this.spout[1] - (hit?.distance ?? MAX_DROP);
    for (const id of this.deps.rules.clamped?.() ?? []) {
      const target = this.deps.world.entity(id);
      const mouth = target?.item.container?.mouth;
      if (!target || !mouth || id === held.id) continue;
      pointOf(target.pose.position, target.pose.rotation, mouth.center, this.mouth);
      const below = this.mouth[1] <= this.spout[1] && this.mouth[1] >= floor;
      if (below && overMouth(this.spout, this.mouth, mouth)) return id;
    }
    const id = hit?.entityId ?? null;
    const target = id === null ? undefined : this.deps.world.entity(id);
    const mouth = target?.item.container?.mouth;
    if (!target || !mouth) return null;
    pointOf(target.pose.position, target.pose.rotation, mouth.center, this.mouth);
    return overMouth(this.spout, this.mouth, mouth) ? target.id : null;
  }

  /** Asks the rule for the current pair; a refusal is said once and holds the pair (true). */
  private ask(): boolean {
    const { source, receiver } = this;
    if (source === null || receiver === null) return false;
    const reason = this.deps.rules.pourRefusal(source, receiver);
    this.blocked = reason !== null;
    if (reason) {
      this.deps.events.publish('ActionBlocked', { entityId: receiver, actionId: 'pour', reason });
    }
    return this.blocked;
  }

  /** The pair broke: its pour (if any liquid moved) is announced once. */
  private endPour(): void {
    const { source, receiver, poured } = this;
    if (source !== null && receiver !== null && poured > 0) {
      this.deps.events.publish('LiquidPoured', { from: source, to: receiver, volumeUl: poured });
    }
    this.source = null;
    this.receiver = null;
    this.blocked = false;
    this.poured = 0;
    this.meter.reset();
  }

  /** A closed held vessel past `INVERTED` and back below `UPRIGHT`: one inversion, asked once. */
  private inversion(held: WorldEntity, tilt: number): void {
    if (tilt > INVERTED) this.turned = held.id;
    if (this.turned !== held.id || tilt >= UPRIGHT) return;
    this.turned = null;
    const reason = this.deps.rules.invert(held.id);
    if (reason) {
      this.deps.events.publish('ActionBlocked', { entityId: held.id, actionId: 'invert', reason });
    }
  }
}
