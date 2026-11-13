import type { EventBus } from '../../core/EventBus';
import type { GameEvents } from '../../game/GameEvents';
import type { GameState } from '../../game/GameState';

/**
 * What the player is wearing (item ids in `player.equipment`, saved). Only wear behaviours
 * change it; every change is published so rules (procedures) and visuals (hands, goggles) react.
 */
export class Equipment {
  constructor(
    private readonly state: GameState,
    private readonly events: EventBus<GameEvents>,
  ) {}

  get worn(): readonly string[] {
    return this.state.player.equipment;
  }

  isWearing(itemId: string): boolean {
    return this.state.player.equipment.includes(itemId);
  }

  /** False if it was already worn (wearing twice changes nothing). */
  wear(itemId: string): boolean {
    if (this.isWearing(itemId)) return false;
    this.state.player.equipment.push(itemId);
    this.events.publish('EquipmentChanged', { itemId, worn: true });
    return true;
  }

  /** False if it was not worn. `discarded`: into a waste bin (used disposable PPE). */
  remove(itemId: string, discarded = false): boolean {
    const list = this.state.player.equipment;
    const index = list.indexOf(itemId);
    if (index < 0) return false;
    list.splice(index, 1);
    this.events.publish(
      'EquipmentChanged',
      discarded ? { itemId, worn: false, discarded } : { itemId, worn: false },
    );
    return true;
  }
}
