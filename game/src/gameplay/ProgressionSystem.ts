import { Disposables, type EventBus } from '../core/EventBus';
import type { GameSystem } from '../core/SystemRunner';
import type { GameEvents } from '../game/GameEvents';
import type { GameState } from '../game/GameState';

/**
 * Records progression from gameplay events. Phase 1 only tracks finished experiments; XP,
 * levels and achievements will hang off the same events.
 */
export class ProgressionSystem implements GameSystem {
  readonly id = 'progression';
  private readonly subscriptions = new Disposables();

  constructor(
    private readonly state: GameState,
    private readonly events: EventBus<GameEvents>,
  ) {}

  init(): void {
    this.subscriptions.add(
      this.events.subscribe('ExperimentCompleted', ({ experimentId, endReason }) => {
        const done = this.state.progression.completedExperiments;
        // A run cut off by the time limit did not actually finish the experiment.
        if (endReason !== 'model' || done.includes(experimentId)) return;
        done.push(experimentId);
        this.events.publish('ProgressionRecorded', { experimentId });
      }),
    );
  }

  dispose(): void {
    this.subscriptions.dispose();
  }
}
