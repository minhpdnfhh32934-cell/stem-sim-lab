import { create } from 'zustand';
import { sim } from '@/app/sim/runtime';
import { useSimStore } from '@/app/sim/simStore';
import { useModuleStore } from '@/modules/moduleStore';
import type { ModuleStateBinding } from '@/modules/types';
import type { ParamSource, Params } from '@/physics/types';

/**
 * Undo/redo of the user's inputs in the open topic (physics parameters or a module's
 * inputs). Rapid changes (dragging a slider) are grouped into one step. Opening another
 * topic starts a fresh history.
 */

type Entry =
  | { kind: 'physics'; params: Params; sources: Record<string, ParamSource> }
  | { kind: 'module'; state: Record<string, unknown> };

/** Target the history applies to: read and write its inputs, and watch for changes. */
export interface UndoTarget {
  read(): Entry;
  write(e: Entry): void;
  subscribe(onChange: () => void): () => void;
}

export interface UndoState {
  canUndo: boolean;
  canRedo: boolean;
}

export const useUndoStore = create<UndoState>()(() => ({ canUndo: false, canRedo: false }));

/** Changes closer together than this form one undo step. */
export const GROUP_MS = 500;
const MAX_STEPS = 100;

export class UndoHistory {
  private past: Entry[] = [];
  private future: Entry[] = [];
  private current: Entry;
  private grouping = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private applying = false;
  private readonly off: () => void;

  constructor(
    private readonly target: UndoTarget,
    private readonly onState: (s: UndoState) => void = (s) => {
      useUndoStore.setState(s);
    },
  ) {
    this.current = target.read();
    this.off = target.subscribe(() => {
      this.changed();
    });
    this.publish();
  }

  private publish() {
    this.onState({ canUndo: this.past.length > 0, canRedo: this.future.length > 0 });
  }

  private changed() {
    const now = this.target.read();
    if (this.applying) {
      this.current = now;
      return;
    }
    if (!this.grouping) {
      this.past.push(this.current);
      if (this.past.length > MAX_STEPS) this.past.shift();
      this.future = [];
      this.grouping = true;
    }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.grouping = false;
    }, GROUP_MS);
    this.current = now;
    this.publish();
  }

  private apply(e: Entry) {
    clearTimeout(this.timer);
    this.grouping = false;
    this.applying = true;
    try {
      this.target.write(e);
    } finally {
      this.applying = false;
    }
    this.current = this.target.read();
    this.publish();
  }

  undo(): boolean {
    const prev = this.past.pop();
    if (!prev) return false;
    this.future.push(this.target.read());
    this.apply(prev);
    return true;
  }

  redo(): boolean {
    const next = this.future.pop();
    if (!next) return false;
    this.past.push(this.target.read());
    this.apply(next);
    return true;
  }

  dispose() {
    clearTimeout(this.timer);
    this.off();
  }
}

function moduleTarget(binding: ModuleStateBinding): UndoTarget {
  return {
    read: () => ({ kind: 'module', state: binding.get() }),
    write: (e) => {
      if (e.kind === 'module') binding.set(e.state);
    },
    subscribe: (cb) => binding.subscribe(cb),
  };
}

const physicsTarget: UndoTarget = {
  read: () => {
    const s = useSimStore.getState();
    return { kind: 'physics', params: s.params, sources: s.sources };
  },
  write: (e) => {
    if (e.kind === 'physics') sim.applyParams(e.params, e.sources);
  },
  subscribe: (cb) =>
    useSimStore.subscribe((s, prev) => {
      if (s.scene === prev.scene && (s.params !== prev.params || s.sources !== prev.sources)) cb();
    }),
};

let history: UndoHistory | null = null;
let key: string | null = null;
let attachedTo: unknown = null;

function attach() {
  const mod = useModuleStore.getState().active;
  const scene = useSimStore.getState().scene;
  const nextKey = mod ? `m:${mod.id}` : scene ? `p:${scene.id}` : null;
  // A new object for the same topic id means it was reopened: start fresh too.
  const identity = mod ? mod.view : scene;
  if (nextKey === key && identity === attachedTo) return;
  history?.dispose();
  history = null;
  key = nextKey;
  attachedTo = identity;
  if (mod?.view.state) history = new UndoHistory(moduleTarget(mod.view.state));
  else if (scene) history = new UndoHistory(physicsTarget);
  else useUndoStore.setState({ canUndo: false, canRedo: false });
}
/** Starts following the open topic. Call once at startup; returns a cleanup function. */
export function initUndo(): () => void {
  attach();
  const offs = [
    useModuleStore.subscribe(attach),
    useSimStore.subscribe((s, prev) => {
      if (s.scene !== prev.scene) attach();
    }),
  ];
  return () => {
    for (const off of offs) off();
    history?.dispose();
    history = null;
    key = null;
    attachedTo = null;
  };
}

export function undo(): boolean {
  return history?.undo() ?? false;
}

export function redo(): boolean {
  return history?.redo() ?? false;
}
