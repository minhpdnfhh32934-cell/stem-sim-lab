import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../game/GameEvents';
import type { GameState } from '../game/GameState';

export type EntityStateValue = boolean | number | string;

/**
 * Read/write access to persistent per-entity state. Every change is published as
 * `EntityStateChanged`, so visuals, audio or quests can react without polling.
 */
export class EntityStates {
  constructor(
    private readonly state: GameState,
    private readonly events: EventBus<GameEvents>,
  ) {}

  get(entityId: string, key: string): EntityStateValue | undefined {
    return this.state.world.entityStates[entityId]?.[key];
  }

  set(entityId: string, key: string, value: EntityStateValue): void {
    const states = this.state.world.entityStates;
    const entry = (states[entityId] ??= {});
    if (entry[key] === value) return;
    entry[key] = value;
    this.events.publish('EntityStateChanged', { entityId, key, value });
  }
}
