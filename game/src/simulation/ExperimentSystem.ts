import type { EventBus } from '../core/EventBus';
import type { Logger } from '../core/Logger';
import type { Registry } from '../core/Registry';
import { describeError, type GameSystem } from '../core/SystemRunner';
import type { GameEvents } from '../game/GameEvents';
import type { ExperimentDefinition } from './experiment';
import {
  ExperimentSession,
  type RunCheck,
  type SessionPreview,
  type SessionState,
} from './ExperimentSession';
import type { RunRecord } from './RunRecord';
import type { SimulationModel } from './SimulationModel';

export interface ExperimentSystemDeps {
  experiments: Registry<ExperimentDefinition>;
  models: Registry<SimulationModel>;
  events: EventBus<GameEvents>;
  log: Logger;
}

/**
 * Owns every experiment session, advances running ones each frame on their fixed timestep, and
 * is the one place that announces what happens to them (started, state changes, parameter
 * changes, completed, failed). Stations decide when to configure, start, stop or reset;
 * progression, HUD and instruments react to the events without this system knowing them.
 */
export class ExperimentSystem implements GameSystem {
  readonly id = 'experiments';
  private readonly sessions = new Map<string, ExperimentSession>();
  /** Ended runs per station that outlive a playthrough (restored from the run history store). */
  private readonly kept = new Map<string, readonly RunRecord[]>();
  private last: ExperimentSession | null = null;

  constructor(private readonly deps: ExperimentSystemDeps) {}

  /** The most recently started session (debug panel). */
  get latest(): ExperimentSession | null {
    return this.last;
  }

  get activeCount(): number {
    let running = 0;
    for (const session of this.sessions.values()) if (session.state === 'running') running++;
    return running;
  }

  /** The session with this id, created for `experimentId` on first use. */
  session(sessionId: string, experimentId: string): ExperimentSession {
    let session = this.sessions.get(sessionId);
    if (!session) {
      const definition = this.deps.experiments.get(experimentId);
      session = new ExperimentSession(
        sessionId,
        definition,
        this.deps.models.get(definition.model),
        this.kept.get(sessionId),
      );
      this.sessions.set(sessionId, session);
    }
    return session;
  }

  find(sessionId: string): ExperimentSession | undefined {
    return this.sessions.get(sessionId);
  }

  /** Ended runs from before (the run history store), given back to their stations once made. */
  restore(records: readonly RunRecord[]): void {
    for (const record of records) {
      this.kept.set(record.sessionId, [...(this.kept.get(record.sessionId) ?? []), record]);
    }
  }

  /**
   * Forgets every session (a new playthrough starts) but keeps their ended runs: the run history
   * belongs to the browser, not to a playthrough. A run still running ends unrecorded.
   */
  clear(): void {
    for (const session of this.sessions.values()) {
      this.kept.set(session.id, [...session.history]); // a copy: reset may still record into it
      session.reset();
    }
    this.sessions.clear();
    this.last = null;
  }

  setReady(sessionId: string, ready: boolean): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    this.track(session, () => session.setReady(ready));
  }

  /** Sets a parameter (announced); returns why it cannot be set, or null. */
  setParameter(sessionId: string, parameterId: string, value: number): string | null {
    const session = this.sessions.get(sessionId);
    if (!session) return `No experiment session "${sessionId}".`;
    const problem = session.setParameter(parameterId, value);
    if (!problem) {
      this.deps.events.publish('ExperimentParameterChanged', { sessionId, parameterId, value });
    }
    return problem;
  }

  /** Sets a parameter to a preset or step-grid value (announced); returns why not, or null. */
  set(sessionId: string, parameterId: string, value: number): string | null {
    const session = this.sessions.get(sessionId);
    if (!session) return `No experiment session "${sessionId}".`;
    const problem = session.set(parameterId, value);
    if (!problem) {
      // The stored setting (the preset's own value), not the caller's near-equal number.
      const stored = session.parameters[parameterId] ?? value;
      this.deps.events.publish('ExperimentParameterChanged', {
        sessionId,
        parameterId,
        value: stored,
      });
    }
    return problem;
  }

  /** The model's t = 0 state for a session's current settings (`ExperimentSession.preview`). */
  preview(
    sessionId: string,
    apparatus: Readonly<Record<string, number>> = {},
  ): SessionPreview | null {
    return this.sessions.get(sessionId)?.preview(apparatus) ?? null;
  }

  /** One dial click up or down (step or preset); returns why not, or null. */
  adjust(sessionId: string, parameterId: string, direction: 1 | -1): string | null {
    const session = this.sessions.get(sessionId);
    const next = session?.nextValue(parameterId, direction) ?? null;
    if (!session || next === null) return `No parameter "${parameterId}".`;
    return this.setParameter(sessionId, parameterId, next);
  }

  start(
    sessionId: string,
    apparatus: Readonly<Record<string, number>> = {},
    check?: RunCheck,
  ): string | null {
    const session = this.sessions.get(sessionId);
    if (!session) return `No experiment session "${sessionId}".`;
    const before = session.state;
    let problem: string | null;
    try {
      problem = session.start(apparatus, check);
    } catch (error) {
      problem = `Could not start: ${describeError(error)}`;
      this.deps.log.error(`Experiment session "${sessionId}" could not start`, error);
    }
    const run = session.run;
    if (problem === null && run) {
      this.last = session;
      this.deps.log.info(`Experiment "${session.definition.id}" started as ${run.runId}`);
      this.deps.events.publish('ExperimentStarted', {
        runId: run.runId,
        experimentId: session.definition.id,
        sessionId,
      });
    }
    this.announce(session, before);
    return problem;
  }

  stop(sessionId: string): string | null {
    const session = this.sessions.get(sessionId);
    if (session?.state !== 'running') return 'Nothing is running.';
    this.track(session, () => session.stop());
    return null;
  }

  reset(sessionId: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session?.run) return 'There is no run to reset.';
    this.track(session, () => session.reset());
    return null;
  }

  update(dt: number): void {
    for (const session of this.sessions.values()) {
      if (session.state !== 'running') continue;
      const newest = session.history.at(-1);
      const oldest = session.history[0];
      session.advance(dt);
      if (session.run?.status !== 'running') {
        this.report(session); // it ended this frame
        this.announceRecord(session, newest, oldest);
      }
    }
  }

  dispose(): void {
    for (const session of this.sessions.values()) session.stop();
    this.sessions.clear();
  }

  /** Runs a change and announces the state if it moved. */
  private track(session: ExperimentSession, change: () => boolean): void {
    const before = session.state;
    const newest = session.history.at(-1);
    const oldest = session.history[0];
    change();
    this.announce(session, before);
    this.announceRecord(session, newest, oldest);
  }

  /** A run was frozen into the history (and maybe the oldest record dropped for it). */
  private announceRecord(
    session: ExperimentSession,
    newest: RunRecord | undefined,
    oldest: RunRecord | undefined,
  ): void {
    const record = session.history.at(-1);
    if (!record || record === newest) return;
    const dropped = oldest && !session.history.includes(oldest) ? oldest.runId : null;
    this.deps.events.publish('RunRecorded', { record, dropped });
  }

  private announce(session: ExperimentSession, before: SessionState): void {
    const state = session.state;
    if (state === before) return;
    this.deps.events.publish('ExperimentStateChanged', {
      sessionId: session.id,
      experimentId: session.definition.id,
      state,
    });
  }

  /** A run just ended by itself: completed or failed. */
  private report(session: ExperimentSession): void {
    const { events, log } = this.deps;
    const run = session.run;
    const experimentId = session.definition.id;
    if (!run) return;
    if (run.status === 'completed' && run.results && run.endReason) {
      log.info(
        `Experiment "${experimentId}" (${run.runId}) completed: ${run.endReason}`,
        run.results,
      );
      events.publish('ExperimentCompleted', {
        runId: run.runId,
        experimentId,
        sessionId: session.id,
        endReason: run.endReason,
        results: run.results,
      });
    } else if (run.status === 'failed') {
      log.error(`Experiment "${experimentId}" (${run.runId}) failed: ${run.error ?? 'unknown'}`);
      events.publish('ExperimentFailed', {
        runId: run.runId,
        experimentId,
        sessionId: session.id,
        error: run.error ?? 'unknown error',
      });
    }
    this.announce(session, 'running');
  }
}
