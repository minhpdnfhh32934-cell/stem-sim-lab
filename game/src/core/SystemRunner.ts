import type { Logger } from './Logger';

/**
 * A unit of game behaviour with an explicit lifecycle. Systems are created by the composition
 * root (src/game/Game.ts) with their dependencies passed in — there is no global service locator.
 */
export interface GameSystem {
  readonly id: string;
  /** Called once, in registration order, during boot. A throw aborts the boot. */
  init?(): void | Promise<void>;
  /** Called every frame with the frame time in seconds, in registration order. */
  update?(dt: number): void;
  /** Called once, in reverse registration order, on shutdown. Must release listeners. */
  dispose?(): void;
}

export type SystemStatus = 'registered' | 'active' | 'failed' | 'disposed';

/**
 * Owns the deterministic init/update/dispose order of all systems. A system that throws during
 * `update` is disabled and logged instead of crashing the game loop.
 */
export class SystemRunner {
  private readonly systems: GameSystem[] = [];
  private readonly status = new Map<string, SystemStatus>();

  constructor(private readonly log: Logger) {}

  add(system: GameSystem): void {
    if (this.status.has(system.id)) throw new Error(`System "${system.id}" is already registered`);
    this.systems.push(system);
    this.status.set(system.id, 'registered');
  }

  async initAll(): Promise<void> {
    for (const system of this.systems) {
      if (this.status.get(system.id) !== 'registered') continue;
      try {
        await system.init?.();
      } catch (error) {
        this.status.set(system.id, 'failed');
        throw new Error(`System "${system.id}" failed to initialize: ${describeError(error)}`, {
          cause: error,
        });
      }
      this.status.set(system.id, 'active');
      this.log.debug(`System "${system.id}" initialized`);
    }
  }

  update(dt: number): void {
    for (const system of this.systems) {
      if (!system.update || this.status.get(system.id) !== 'active') continue;
      try {
        system.update(dt);
      } catch (error) {
        this.status.set(system.id, 'failed');
        this.log.error(`System "${system.id}" threw during update and was disabled`, error);
      }
    }
  }

  disposeAll(): void {
    for (let i = this.systems.length - 1; i >= 0; i--) {
      const system = this.systems[i];
      if (!system || this.status.get(system.id) === 'disposed') continue;
      try {
        system.dispose?.();
      } catch (error) {
        this.log.error(`System "${system.id}" threw during dispose`, error);
      }
      this.status.set(system.id, 'disposed');
    }
  }

  statuses(): { id: string; status: SystemStatus }[] {
    return this.systems.map((s) => ({ id: s.id, status: this.status.get(s.id) ?? 'registered' }));
  }
}

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
