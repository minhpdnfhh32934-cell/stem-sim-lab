import { Disposables, type EventBus } from '../../core/EventBus';
import type { Texts } from '../../core/i18n';
import type { Logger } from '../../core/Logger';
import type { Registry } from '../../core/Registry';
import type { GameSystem } from '../../core/SystemRunner';
import type { GameEvents } from '../../game/GameEvents';
import type { GameState, ProcedureProgress } from '../../game/GameState';
import type { EntityStates } from '../../world/EntityStates';
import type { World, WorldEntity } from '../../world/World';
import type { DoorState } from '../door/DoorSystem';
import type { ActionGuard } from '../interaction/InteractionSystem';
import type { ItemDefinition } from '../item';
import type { Equipment } from '../player/Equipment';
import type { HandMotion, ProcedureDefinition, ProcedureStep, StateCondition } from './procedure';

type PerformStep = Extract<ProcedureStep, { kind: 'perform' }>;

const NOT_STARTED: Readonly<ProcedureProgress> = { completed: [], entered: false };

/**
 * Live, never historical: `ready` and `entered` only while the entrance would open right now
 * (every step done and the required equipment worn); `entered` once it has also been used.
 */
export type ProcedureStatus = 'not-started' | 'in-progress' | 'ready' | 'entered';

/** Everything the HUD, renderer and debug panel need, derived from the authoritative state. */
export interface ProcedureView {
  readonly definition: ProcedureDefinition;
  readonly status: ProcedureStatus;
  readonly completed: number;
  readonly total: number;
  /** The next step to do, or null once every step is done. */
  readonly step: ProcedureStep | null;
  readonly stageLabel: string | null;
  /** Required equipment (item ids) not worn right now. */
  readonly missingEquipment: readonly string[];
  /** A timed step in progress: seconds done of its duration. */
  readonly timer: {
    readonly stepId: string;
    readonly elapsed: number;
    readonly duration: number;
  } | null;
  /** Hand animation of the last completed step that has one. */
  readonly lastHands: HandMotion | null;
}

export interface ProcedureSystemDeps {
  state: GameState;
  events: EventBus<GameEvents>;
  world: World;
  entityStates: EntityStates;
  equipment: Equipment;
  procedures: Registry<ProcedureDefinition>;
  items: Registry<ItemDefinition>;
  texts: Texts;
  /** Where the procedure plugs its rules into interaction (one guard for every action). */
  guards: { addGuard(guard: ActionGuard): () => void };
  /** Walk-through doors: whether an entrance is shut (without it, none is ever open). */
  doors?: DoorState;
  log: Logger;
}

interface Timer {
  readonly procedure: ProcedureDefinition;
  readonly step: PerformStep;
  readonly entityId: string;
  elapsed: number;
}

/**
 * Runs data-defined procedures (e.g. cleanroom entry). It is the single authority for their
 * rules: it counts the right action at the right time, refuses actions that come too early with
 * the next instruction, holds the entrance shut until every step is done and the required
 * equipment is worn, and records progress in `progression.procedures` (saved).
 *
 * Steps complete strictly in order. `wear` and `state` steps complete as soon as they become
 * current and hold; `perform` steps complete when their action is done while current (after
 * `durationS` seconds of attention for timed ones — looking away or leaving cancels).
 */
export class ProcedureSystem implements GameSystem {
  readonly id = 'procedures';
  private timer: Timer | null = null;
  /** Procedures announced as ready, so ProcedureReady fires once per transition. */
  private readonly ready = new Set<string>();
  private readonly subscriptions = new Disposables();

  constructor(private readonly deps: ProcedureSystemDeps) {}

  init(): void {
    const { events, guards } = this.deps;
    const s = this.subscriptions;
    s.add(guards.addGuard((entity, actionId) => this.guard(entity, actionId)));
    s.add(
      events.subscribe('InteractionPerformed', (e) => this.onPerformed(e.entityId, e.actionId)),
    );
    s.add(events.subscribe('EquipmentChanged', () => this.advanceAll()));
    s.add(events.subscribe('EntityStateChanged', () => this.advanceAll()));
    s.add(events.subscribe('SceneLoaded', () => this.advanceAll()));
    s.add(
      events.subscribe('SceneEntered', ({ through }) => {
        this.crossed(through);
        this.advanceAll();
      }),
    );
    s.add(
      events.subscribe('InteractionFocusChanged', ({ entityId }) => {
        if (this.timer && entityId !== this.timer.entityId) {
          this.cancel(this.deps.texts.ui('procedure.lookedAway', 'You looked away.'));
        }
      }),
    );
    s.add(
      events.subscribe('SceneLoading', () =>
        this.cancel(this.deps.texts.ui('procedure.leftStation', 'You left the station.')),
      ),
    );
  }

  update(dt: number): void {
    const timer = this.timer;
    if (!timer || this.deps.state.session.phase !== 'playing') return;
    timer.elapsed += dt;
    if (timer.elapsed < timer.step.durationS) return;
    this.timer = null;
    const index = timer.procedure.steps.indexOf(timer.step);
    if (index === this.currentIndex(timer.procedure)) this.complete(timer.procedure, index);
    this.advance(timer.procedure);
  }

  dispose(): void {
    this.subscriptions.dispose();
    this.timer = null;
  }

  /** Done fraction (0–1) of the running timed step, or null. Allocation-free, for per-frame UI. */
  timerFraction(): number | null {
    const timer = this.timer;
    return timer ? Math.min(1, timer.elapsed / timer.step.durationS) : null;
  }

  /** The procedure done in the current scene, if any. */
  activeProcedure(): ProcedureDefinition | null {
    const sceneId = this.deps.state.session.sceneId;
    return this.deps.procedures.all().find((p) => p.scene === sceneId) ?? null;
  }

  view(procedureId: string): ProcedureView {
    const p = this.deps.procedures.get(procedureId);
    const progress = this.progressOf(p);
    const index = this.currentIndex(p);
    const step = p.steps[index] ?? null;
    const missingEquipment = p.requiredEquipment.filter((id) => !this.deps.equipment.isWearing(id));
    const open = step === null && missingEquipment.length === 0;
    let lastHands: HandMotion | null = null;
    for (let i = index - 1; i >= 0 && lastHands === null; i--)
      lastHands = p.steps[i]?.hands ?? null;
    const timer = this.timer?.procedure === p ? this.timer : null;
    return {
      definition: p,
      status: open
        ? progress.entered
          ? 'entered'
          : 'ready'
        : index === 0
          ? 'not-started'
          : 'in-progress',
      completed: index,
      total: p.steps.length,
      step,
      stageLabel: this.stageLabel(p, step ?? p.steps.at(-1)),
      missingEquipment,
      timer: timer
        ? { stepId: timer.step.id, elapsed: timer.elapsed, duration: timer.step.durationS }
        : null,
      lastHands,
    };
  }

  /** Why the entrance is still shut, or null when the player may go through. */
  entryBlock(p: ProcedureDefinition): string | null {
    const { texts } = this.deps;
    const step = p.steps[this.currentIndex(p)];
    if (step) {
      return texts.ui('procedure.entryNext', 'Entry blocked. Next: {step}', {
        step: texts.of(step, 'instruction'),
      });
    }
    const missing = p.requiredEquipment
      .filter((id) => !this.deps.equipment.isWearing(id))
      .map((id) => texts.of(this.deps.items.get(id), 'displayName').toLowerCase());
    return missing.length > 0
      ? texts.ui('procedure.entryPutOn', 'Entry blocked. Put on: {items}.', {
          items: missing.join(', '),
        })
      : null;
  }

  /** The stage `step` belongs to, as the player reads it. */
  private stageLabel(p: ProcedureDefinition, step: ProcedureStep | undefined): string | null {
    const stage = p.stages.find((s) => s.id === step?.stage);
    return stage ? this.deps.texts.of(stage, 'label') : null;
  }

  // ---- rules ---------------------------------------------------------------------------------

  /** The interaction guard: the reason an action must wait, or null to let it happen. */
  private guard(entity: WorldEntity | null, actionId: string): string | null {
    if (!entity) return null;
    const { texts } = this.deps;
    for (const p of this.deps.procedures.all()) {
      if (entity.id === p.entrance && actionId === 'travel') {
        const block = this.entryBlock(p);
        if (block) return block;
        continue;
      }
      if (actionId === 'travel' && p.exits.includes(entity.id)) {
        const worn = this.deps.equipment.worn;
        if (worn.length === 0) continue;
        const names = worn.map((id) => {
          const item = this.deps.items.tryGet(id);
          return item ? texts.of(item, 'displayName').toLowerCase() : id;
        });
        return texts.ui('procedure.takeOffFirst', 'Take off your PPE before leaving: {items}.', {
          items: names.join(', '),
        });
      }
      // The interlock: required equipment stays on while the entrance is not shut, or someone in
      // its doorway could take it off and walk in — taken off, or discarded into a waste bin.
      const entrance = this.deps.doors?.state(p.entrance);
      const removed =
        actionId === 'take-off'
          ? entity.item
          : actionId === 'discard'
            ? this.deps.equipment.worn
                .map((id) => this.deps.items.tryGet(id))
                .find((item) => item?.disposable && p.requiredEquipment.includes(item.id))
            : undefined;
      const required = removed !== undefined && p.requiredEquipment.includes(removed.id);
      if (removed && required && entrance && entrance !== 'closed') {
        return texts.ui(
          'procedure.closeEntranceFirst',
          'Close the door to the clean area before taking off your {item}.',
          { item: texts.of(removed, 'displayName').toLowerCase() },
        );
      }
      if (this.deps.state.session.sceneId !== p.scene) continue;
      const index = this.currentIndex(p);
      const next = p.steps[index];
      let matched = false;
      let later = false; // the action belongs to a step still ahead
      for (let i = 0; i < p.steps.length; i++) {
        const step = p.steps[i];
        if (step?.kind !== 'perform' || step.item !== entity.item.id || step.action !== actionId) {
          continue;
        }
        if (i === index) {
          if (this.timer?.step === step) {
            return texts.ui('procedure.inProgress', 'Already in progress: keep looking at it.');
          }
          const unmet = step.requires.find((r) => !this.holds(p, r));
          return unmet ? texts.of(unmet, 'message') : null;
        }
        matched = true;
        if (i > index) later = true;
      }
      // Too early: refused with the next instruction. Repeating a done step is harmless and
      // simply counts for nothing (e.g. reading the notice board again).
      const notYet = () =>
        texts.ui('procedure.notYet', 'Not yet. Next: {step}', {
          step: next ? texts.of(next, 'instruction') : '',
        });
      if (matched && later && next) return notYet();
      // Equipment may go on early only if nothing but other equipment steps comes before it
      // (gloves go on after hand hygiene, the coat and goggles in any order).
      if (actionId === 'wear' && next) {
        const at = p.steps.findIndex((s) => s.kind === 'wear' && s.item === entity.item.id);
        if (at > index && p.steps.slice(index, at).some((s) => s.kind !== 'wear')) {
          return notYet();
        }
      }
    }
    return null;
  }

  private onPerformed(entityId: string, actionId: string): void {
    const entity = this.deps.world.entity(entityId);
    if (!entity) return;
    // A teleport door counts when used; a walk-through door when walked through (`crossed`).
    const teleport = actionId === 'travel' && !entity.item.door;
    for (const p of this.deps.procedures.all()) {
      if (teleport && entityId === p.entrance && this.entryBlock(p) === null) {
        this.enter(p);
        continue;
      }
      if (teleport && p.exits.includes(entityId)) {
        this.leave(p);
        continue;
      }
      if (this.deps.state.session.sceneId !== p.scene) continue;
      const index = this.currentIndex(p);
      const step = p.steps[index];
      if (step?.kind !== 'perform' || step.item !== entity.item.id || step.action !== actionId) {
        continue;
      }
      if (step.durationS > 0) {
        this.cancel(this.deps.texts.ui('procedure.startedAgain', 'Started again.'));
        this.timer = { procedure: p, step, entityId, elapsed: 0 };
        this.deps.events.publish('ProcedureStepStarted', {
          procedureId: p.id,
          stepId: step.id,
          durationS: step.durationS,
        });
      } else {
        this.complete(p, index);
        this.advance(p);
      }
    }
  }

  /**
   * The player walked through `through` into another scene (SceneEntered): through the entrance,
   * ready, the procedure is entered; through an exit, it starts over.
   */
  private crossed(through: string | null): void {
    if (through === null) return;
    for (const p of this.deps.procedures.all()) {
      if (through === p.entrance && this.entryBlock(p) === null) this.enter(p);
      else if (p.exits.includes(through)) this.leave(p);
    }
  }

  private enter(p: ProcedureDefinition): void {
    const progress = this.progress(p);
    if (progress.entered) return;
    progress.entered = true;
    this.deps.events.publish('ProcedureEntered', { procedureId: p.id });
  }

  private leave(p: ProcedureDefinition): void {
    this.reset(
      p,
      this.deps.texts.ui(
        'procedure.leftArea',
        'You left the preparation area. Prepare again from the start before entering.',
      ),
    );
  }

  private cancel(reason: string): void {
    const timer = this.timer;
    if (!timer) return;
    this.timer = null;
    this.deps.events.publish('ProcedureStepCancelled', {
      procedureId: timer.procedure.id,
      stepId: timer.step.id,
      reason,
    });
  }

  /** Forgets all progress (left through an exit), so entering again needs every step. */
  private reset(p: ProcedureDefinition, reason: string): void {
    const before = this.progressOf(p);
    if (before.completed.length === 0 && !before.entered) return;
    this.deps.state.progression.procedures[p.id] = { completed: [], entered: false };
    this.ready.delete(p.id);
    this.deps.log.info(`${p.id}: reset (left through an exit)`);
    this.deps.events.publish('ProcedureReset', { procedureId: p.id, reason });
  }

  private advanceAll(): void {
    for (const p of this.deps.procedures.all()) this.advance(p);
  }

  /** Completes current wear/state steps that already hold, then announces readiness changes. */
  private advance(p: ProcedureDefinition): void {
    if (this.deps.state.session.sceneId === p.scene) {
      for (;;) {
        const index = this.currentIndex(p);
        const step = p.steps[index];
        if (!step) break;
        const holds =
          step.kind === 'wear'
            ? this.deps.equipment.isWearing(step.item)
            : step.kind === 'state' && this.holds(p, step.condition);
        if (!holds) break;
        this.complete(p, index);
      }
    }
    const isReady = this.entryBlock(p) === null;
    if (isReady && !this.ready.has(p.id)) {
      this.ready.add(p.id);
      this.deps.events.publish('ProcedureReady', { procedureId: p.id });
    } else if (!isReady) {
      this.ready.delete(p.id);
    }
  }

  private complete(p: ProcedureDefinition, index: number): void {
    const step = p.steps[index];
    if (!step) return;
    // Always a strict prefix of the steps: ids saved out of order (or for steps that no longer
    // exist) can never make a later step count as done.
    this.progress(p).completed = p.steps.slice(0, index + 1).map((s) => s.id);
    this.deps.log.debug(`${p.id}: step "${step.id}" done (${index + 1}/${p.steps.length})`);
    this.deps.events.publish('ProcedureStepCompleted', {
      procedureId: p.id,
      stepId: step.id,
      index,
    });
  }

  /** Steps complete strictly in order, so progress is the length of the completed prefix. */
  private currentIndex(p: ProcedureDefinition): number {
    const done = new Set(this.progressOf(p).completed);
    const index = p.steps.findIndex((s) => !done.has(s.id));
    return index < 0 ? p.steps.length : index;
  }

  /** Progress record for writing (created on first use). */
  private progress(p: ProcedureDefinition): ProcedureProgress {
    const all = this.deps.state.progression.procedures;
    return (all[p.id] ??= { completed: [], entered: false });
  }

  /** Progress for reading only: views and checks never create records. */
  private progressOf(p: ProcedureDefinition): Readonly<ProcedureProgress> {
    return this.deps.state.progression.procedures[p.id] ?? NOT_STARTED;
  }

  /**
   * Some entity of the item in the procedure's own scene has the state (a resident neighbour's
   * never counts); an unset boolean state counts as false.
   */
  private holds(p: ProcedureDefinition, condition: StateCondition): boolean {
    const rooms = this.deps.world.roomsOf(p.scene);
    for (const entity of this.deps.world.allEntities()) {
      if (entity.item.id !== condition.item) continue;
      if (!rooms.some((room) => room.id === entity.roomId)) continue;
      const value = this.deps.entityStates.get(entity.id, condition.key);
      const actual = value ?? (typeof condition.value === 'boolean' ? false : undefined);
      if (actual === condition.value) return true;
    }
    return false;
  }
}
