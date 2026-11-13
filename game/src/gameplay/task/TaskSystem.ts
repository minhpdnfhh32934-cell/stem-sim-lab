import { Disposables, type EventBus } from '../../core/EventBus';
import type { Logger } from '../../core/Logger';
import type { Registry } from '../../core/Registry';
import type { GameSystem } from '../../core/SystemRunner';
import type { GameEvents } from '../../game/GameEvents';
import type { GameState } from '../../game/GameState';
import type { EntityStates } from '../../world/EntityStates';
import type { World } from '../../world/World';
import type { TaskDefinition, TaskStep } from './task';

export interface TaskSystemDeps {
  state: GameState;
  events: EventBus<GameEvents>;
  /** The labs' tasks: filled when the lab pack loads (empty before). */
  tasks: Registry<TaskDefinition>;
  world: World;
  entityStates: EntityStates;
  /** The held entity's id (a `grabbed` step reached while already holding one of its objects). */
  held: () => string | null;
  /** Whether a station's run is completed now (a `completed` step reached after it). */
  stationCompleted: (stationId: string) => boolean;
  log: Logger;
}

/** The followed task as the views read it. */
export interface ActiveTask {
  readonly task: TaskDefinition;
  readonly index: number;
  readonly step: TaskStep;
  /** The step's objects as entity ids (`<room>/<placement>`). */
  readonly objects: readonly string[];
}

/**
 * Follows one guided task at a time (Phase A contract A4): which step it is on, and the step done
 * when the world reports what it asked — only from events the rules publish (a grab, a set-down,
 * an entity state, a setup step, a run completed, results read). It changes nothing in the world
 * and holds nothing back: a refused action publishes no such event, so the task waits on its step.
 * Progress is the game state's (`progression.tasks`, saved); a saved task or step the content does
 * not know is dropped when it is first read.
 */
export class TaskSystem implements GameSystem {
  readonly id = 'tasks';
  private readonly subscriptions = new Disposables();

  constructor(private readonly deps: TaskSystemDeps) {}

  init(): void {
    const { events } = this.deps;
    const s = this.subscriptions;
    const on = <K extends keyof GameEvents>(event: K, match: (payload: GameEvents[K]) => boolean) =>
      s.add(events.subscribe(event, (payload) => this.check(() => match(payload))));
    on('ObjectGrabbed', ({ entityId }) => this.is('grabbed') && this.objectsHave(entityId));
    on('ObjectSetDown', ({ entityId }) => this.is('set-down') && this.objectsHave(entityId));
    on('ItemInspected', ({ entityId }) => this.is('inspected') && this.objectsHave(entityId));
    on('EntityStateChanged', ({ entityId, key, value }) => {
      const done = this.active?.step.done;
      if (done?.kind === 'state') {
        return done.key === key && done.value === value && this.objectsHave(entityId);
      }
      if (done?.kind === 'setup') {
        return (
          entityId === this.entity(done.station) &&
          value === true &&
          (key === `setup.${done.step}` || (done.or?.some((s) => key === `setup.${s}`) ?? false))
        );
      }
      return false;
    });
    on('ExperimentCompleted', ({ experimentId }) => {
      const done = this.active?.step.done;
      return done?.kind === 'completed' && this.experimentOf(done.station) === experimentId;
    });
    on('ExperimentResultsViewed', ({ stationId }) => {
      const done = this.active?.step.done;
      return done?.kind === 'viewed' && stationId === this.entity(done.station);
    });
  }

  dispose(): void {
    this.subscriptions.dispose();
  }

  /** The tasks offered in a room (its panel), in content order. */
  offered(roomId: string): TaskDefinition[] {
    return this.deps.tasks.all().filter((t) => t.room === roomId);
  }

  isDone(taskId: string): boolean {
    return this.deps.state.progression.tasks.done.includes(taskId);
  }

  /** The followed task and its step, or null (a saved one the content does not know is dropped). */
  get active(): ActiveTask | null {
    const progress = this.deps.state.progression.tasks;
    const saved = progress.active;
    if (!saved) return null;
    const task = this.deps.tasks.tryGet(saved.id);
    const step = task?.steps[saved.step];
    if (!task || !step) {
      // Before the lab pack loads no task is known yet: keep it until there is something to check.
      if (this.deps.tasks.all().length > 0) {
        this.deps.log.warn(
          `Saved task "${saved.id}" step ${saved.step} is not in the content: dropped`,
        );
        progress.active = null;
      }
      return null;
    }
    return {
      task,
      index: saved.step,
      step,
      objects: step.objects.map((id) => `${task.room}/${id}`),
    };
  }

  /** Starts following `taskId` from its first step (any task followed before is cancelled). */
  start(taskId: string): boolean {
    const task = this.deps.tasks.tryGet(taskId);
    if (!task) return false;
    const current = this.active;
    if (current) this.cancel();
    this.deps.state.progression.tasks.active = { id: task.id, step: 0 };
    const index = this.settle();
    this.deps.events.publish('TaskStarted', { taskId: task.id, step: index });
    return true;
  }

  /** Stops following the task (nothing it led to is undone). */
  cancel(): void {
    const current = this.active;
    if (!current) return;
    this.deps.state.progression.tasks.active = null;
    this.deps.events.publish('TaskCancelled', { taskId: current.task.id });
  }

  private is(kind: TaskStep['done']['kind']): boolean {
    return this.active?.step.done.kind === kind;
  }

  private objectsHave(entityId: string): boolean {
    return this.active?.objects.includes(entityId) ?? false;
  }

  private entity(placement: string): string | null {
    const task = this.active?.task;
    return task ? `${task.room}/${placement}` : null;
  }

  private experimentOf(placement: string): string | null {
    const id = this.entity(placement);
    const experiment = id === null ? undefined : this.deps.world.entity(id)?.params.experimentId;
    return typeof experiment === 'string' ? experiment : null;
  }

  /** The current step is done if `matched` says so: on to the next one not already done. */
  private check(matched: () => boolean): void {
    const current = this.active;
    if (!current || !matched()) return;
    this.advance(current);
  }

  private advance(current: ActiveTask): void {
    if (this.complete(current)) this.settle();
  }

  /** Marks the step done and moves on; false when that was the last (the task is finished). */
  private complete(current: ActiveTask): boolean {
    const progress = this.deps.state.progression.tasks;
    const next = current.index + 1;
    const last = next >= current.task.steps.length;
    // Past the last step there is none to point at: finished, not a step the content lacks.
    if (last) progress.active = null;
    else if (progress.active) progress.active.step = next;
    this.deps.events.publish('TaskStepCompleted', {
      taskId: current.task.id,
      stepId: current.step.id,
      next,
    });
    if (!last) return true;
    this.finish(current.task.id);
    return false;
  }

  /** Passes steps whose state is already what they ask (an open cabinet, a setup step done). */
  private settle(): number {
    for (let current = this.active; current; current = this.active) {
      if (!this.already(current)) return current.index;
      if (!this.complete(current)) break;
    }
    return 0;
  }

  private already({ step, objects }: ActiveTask): boolean {
    const { entityStates, held, stationCompleted } = this.deps;
    const done = step.done;
    switch (done.kind) {
      case 'state':
        return objects.some((id) => entityStates.get(id, done.key) === done.value);
      case 'setup': {
        const station = this.entity(done.station);
        return (
          station !== null &&
          [done.step, ...(done.or ?? [])].some(
            (s) => entityStates.get(station, `setup.${s}`) === true,
          )
        );
      }
      case 'grabbed': {
        const id = held();
        return id !== null && objects.includes(id);
      }
      case 'completed': {
        const station = this.entity(done.station);
        return station !== null && stationCompleted(station);
      }
      default:
        return false; // set-down, inspected, viewed: only when the player does it
    }
  }

  private finish(taskId: string): void {
    const progress = this.deps.state.progression.tasks;
    progress.active = null;
    if (!progress.done.includes(taskId)) progress.done.push(taskId);
    this.deps.events.publish('TaskCompleted', { taskId });
  }
}
