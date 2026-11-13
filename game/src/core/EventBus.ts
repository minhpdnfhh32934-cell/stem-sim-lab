import type { Logger } from './Logger';

export type Unsubscribe = () => void;

interface Listener<T> {
  readonly handler: (payload: T) => void;
  active: boolean;
}

/**
 * Synchronous, typed publish/subscribe channel so systems can react to each other without
 * holding references to each other.
 *
 * Listener lists are copy-on-write: `publish` iterates without allocating, and a listener that
 * is unsubscribed during a dispatch (e.g. its owner was destroyed by an earlier listener) is
 * not called afterwards. A throwing listener is logged and isolated; the others still run.
 */
export class EventBus<TEvents extends object> {
  private readonly listeners = new Map<keyof TEvents, readonly Listener<never>[]>();
  private published = 0;

  constructor(private readonly log: Logger) {}

  subscribe<K extends keyof TEvents>(type: K, handler: (payload: TEvents[K]) => void): Unsubscribe {
    const listener: Listener<TEvents[K]> = { handler, active: true };
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
    return () => {
      if (!listener.active) return;
      listener.active = false;
      const remaining = (this.listeners.get(type) ?? []).filter((l) => l !== listener);
      if (remaining.length > 0) this.listeners.set(type, remaining);
      else this.listeners.delete(type);
    };
  }

  publish<K extends keyof TEvents>(type: K, payload: TEvents[K]): void {
    this.published++;
    const list = this.listeners.get(type) as readonly Listener<TEvents[K]>[] | undefined;
    if (!list) return;
    for (const listener of list) {
      if (!listener.active) continue;
      try {
        listener.handler(payload);
      } catch (error) {
        this.log.error(`Listener for "${String(type)}" threw`, error);
      }
    }
  }

  /** Number of live listeners, for one event type or all of them (debug panel, leak tests). */
  listenerCount(type?: keyof TEvents): number {
    if (type !== undefined) return this.listeners.get(type)?.length ?? 0;
    let total = 0;
    for (const list of this.listeners.values()) total += list.length;
    return total;
  }

  get publishedCount(): number {
    return this.published;
  }

  clear(): void {
    for (const list of this.listeners.values()) for (const l of list) l.active = false;
    this.listeners.clear();
  }
}

/** Collects teardown callbacks (unsubscribes, DOM listeners) and runs them once, newest first. */
export class Disposables {
  private items: (() => void)[] = [];

  add(dispose: () => void): void {
    this.items.push(dispose);
  }

  dispose(): void {
    const items = this.items;
    this.items = [];
    for (let i = items.length - 1; i >= 0; i--) items[i]?.();
  }
}
