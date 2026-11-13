import { vi } from 'vitest';

/*
 * A DOM just big enough for the Chemistry piece views to mount, update and be released in Node
 * (tests only): elements with attributes, children, text and listeners.
 */

export class FakeNode {
  parent: FakeNode | null = null;
  readonly children: FakeNode[] = [];
  readonly attrs = new Map<string, string>();
  readonly listeners = new Map<string, Set<(event: unknown) => void>>();
  readonly dataset: Record<string, string> = {};
  readonly style = { setProperty: () => undefined };
  className = '';
  hidden = false;
  disabled = false;
  checked = false;
  type = '';
  name = '';
  title = '';
  private own = '';
  /** How many times an attribute or text was written (to see that nothing is rewritten unchanged). */
  writes = 0;

  constructor(readonly tag: string) {}

  readonly classList = {
    add: (...names: string[]) => {
      this.className = [this.className, ...names].filter(Boolean).join(' ');
    },
    toggle: (name: string, on?: boolean) => {
      const has = this.className.split(' ').includes(name);
      if (on ?? !has) this.classList.add(name);
    },
  };

  get id(): string {
    return this.attrs.get('id') ?? '';
  }
  get textContent(): string {
    return this.own + this.children.map((c) => c.textContent).join('');
  }
  set textContent(value: string) {
    this.writes++;
    for (const c of this.children) c.parent = null;
    this.children.length = 0;
    this.own = value;
  }
  get firstChild(): FakeNode | null {
    return this.children[0] ?? null;
  }
  setAttribute(name: string, value: string): void {
    this.writes++;
    this.attrs.set(name, value);
  }
  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }
  append(...nodes: (FakeNode | string)[]): void {
    for (const n of nodes) {
      if (typeof n === 'string') this.own += n;
      else {
        n.remove();
        n.parent = this;
        this.children.push(n);
      }
    }
  }
  before(node: FakeNode): void {
    const parent = this.parent;
    if (!parent) return;
    node.remove();
    node.parent = parent;
    parent.children.splice(parent.children.indexOf(this), 0, node);
  }
  remove(): void {
    if (!this.parent) return;
    this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = null;
  }
  replaceChildren(...nodes: FakeNode[]): void {
    for (const c of this.children) c.parent = null;
    this.children.length = 0;
    this.append(...nodes);
  }
  addEventListener(type: string, handler: (event: unknown) => void): void {
    (this.listeners.get(type) ?? this.listeners.set(type, new Set()).get(type))?.add(handler);
  }
  removeEventListener(type: string, handler: (event: unknown) => void): void {
    this.listeners.get(type)?.delete(handler);
  }
  dispatch(type: string, event: unknown = {}): void {
    for (const h of [...(this.listeners.get(type) ?? [])]) h(event);
  }
  get listenerCount(): number {
    let n = 0;
    for (const set of this.listeners.values()) n += set.size;
    return n;
  }
}

/** Every node under `root` (itself included) that `test` accepts. */
export function findAll(root: FakeNode, test: (node: FakeNode) => boolean): FakeNode[] {
  return [...(test(root) ? [root] : []), ...root.children.flatMap((c) => findAll(c, test))];
}

export const byClass = (root: FakeNode, name: string): FakeNode[] =>
  findAll(
    root,
    (n) =>
      n.className.split(' ').includes(name) ||
      n.attrs.get('class')?.split(' ').includes(name) === true,
  );

export const totalListeners = (root: FakeNode): number =>
  findAll(root, () => true).reduce((n, node) => n + node.listenerCount, 0);

/** Installs the fake `document`; the caller restores it with `vi.unstubAllGlobals()`. */
export function installDom(): void {
  const make = (tag: string) => new FakeNode(tag);
  vi.stubGlobal('document', {
    createElement: make,
    createElementNS: (_ns: string, tag: string) => make(tag),
  });
}
