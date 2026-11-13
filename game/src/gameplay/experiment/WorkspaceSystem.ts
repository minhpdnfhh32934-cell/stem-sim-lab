import { Disposables, type EventBus } from '../../core/EventBus';
import type { GameSystem } from '../../core/SystemRunner';
import type { GameEvents } from '../../game/GameEvents';
import type { GameState } from '../../game/GameState';
import type { StationCommand } from './StationSystem';

export interface WorkspaceSystemDeps {
  state: GameState;
  events: EventBus<GameEvents>;
  /** The rule authority for an apparatus: whether its workspace may open. */
  stations: {
    refusal(stationId: string, command: StationCommand): string | null;
    view(stationId: string): unknown;
  };
}

/**
 * Which station's workspace is open, one at a time (`state.session.workspace`, never saved). It
 * opens on `WorkspaceRequested` (the apparatus' `open-workspace` action) or `open`, and closes
 * with `close` (Exit, Esc) or when the scene changes or its station goes away. While it is open
 * the player stands still (PlayerSystem); the run goes on. Input, pointer lock and Esc are the
 * platform's.
 */
export class WorkspaceSystem implements GameSystem {
  readonly id = 'workspace';
  private readonly subscriptions = new Disposables();

  constructor(private readonly deps: WorkspaceSystemDeps) {}

  /** The station whose workspace is open, or null. */
  get openStation(): string | null {
    return this.deps.state.session.workspace ?? null;
  }

  init(): void {
    const { events } = this.deps;
    const s = this.subscriptions;
    s.add(events.subscribe('WorkspaceRequested', ({ stationId }) => this.open(stationId)));
    s.add(events.subscribe('SceneLoading', () => this.close()));
    s.add(
      events.subscribe('SceneDetached', () => {
        const open = this.openStation;
        if (open !== null && this.deps.stations.view(open) === null) this.close();
      }),
    );
  }

  /**
   * Opens station `stationId`'s workspace (closing another one first); returns why it cannot, or
   * null. A refusal is announced as `ActionBlocked`, like any refused station command.
   */
  open(stationId: string): string | null {
    const { state, events, stations } = this.deps;
    const reason = stations.refusal(stationId, 'open-workspace');
    if (reason !== null) {
      events.publish('ActionBlocked', { entityId: stationId, actionId: 'open-workspace', reason });
      return reason;
    }
    if (this.openStation === stationId) return null;
    this.close();
    state.session.workspace = stationId;
    events.publish('WorkspaceOpened', { stationId });
    return null;
  }

  /** Closes the open workspace; false if none was open. */
  close(): boolean {
    const stationId = this.openStation;
    if (stationId === null) return false;
    this.deps.state.session.workspace = null;
    this.deps.events.publish('WorkspaceClosed', { stationId });
    return true;
  }

  dispose(): void {
    this.subscriptions.dispose();
  }
}
