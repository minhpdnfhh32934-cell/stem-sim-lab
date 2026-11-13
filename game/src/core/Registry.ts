/** Id-keyed lookup with clear errors, used for both content definitions and code registries. */
export class Registry<T extends { readonly id: string }> {
  private readonly items = new Map<string, T>();

  constructor(
    readonly kind: string,
    items: Iterable<T> = [],
  ) {
    for (const item of items) this.add(item);
  }

  add(item: T): void {
    if (this.items.has(item.id)) throw new Error(`Duplicate ${this.kind} id "${item.id}"`);
    this.items.set(item.id, item);
  }

  /** Adds `item`, or replaces the one with its id. */
  put(item: T): void {
    this.items.set(item.id, item);
  }

  get(id: string): T {
    const item = this.items.get(id);
    if (!item) throw new Error(`Unknown ${this.kind} "${id}"`);
    return item;
  }

  tryGet(id: string): T | undefined {
    return this.items.get(id);
  }

  has(id: string): boolean {
    return this.items.has(id);
  }

  all(): T[] {
    return [...this.items.values()];
  }

  get size(): number {
    return this.items.size;
  }
}
