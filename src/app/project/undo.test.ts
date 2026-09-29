import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GROUP_MS, UndoHistory, type UndoTarget } from './undo';

function counter() {
  let value = 0;
  const listeners = new Set<() => void>();
  const target: UndoTarget = {
    read: () => ({ kind: 'module', state: { value } }),
    write: (e) => {
      if (e.kind === 'module') set(e.state.value as number);
    },
    subscribe: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
  const set = (v: number) => {
    value = v;
    for (const l of listeners) l();
  };
  return { target, set, get: () => value };
}

describe('UndoHistory', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('undoes and redoes separate changes', () => {
    const c = counter();
    const states: { canUndo: boolean; canRedo: boolean }[] = [];
    const h = new UndoHistory(c.target, (s) => states.push(s));
    c.set(1);
    vi.advanceTimersByTime(GROUP_MS + 1);
    c.set(2);
    vi.advanceTimersByTime(GROUP_MS + 1);
    expect(h.undo()).toBe(true);
    expect(c.get()).toBe(1);
    expect(h.undo()).toBe(true);
    expect(c.get()).toBe(0);
    expect(h.undo()).toBe(false);
    expect(h.redo()).toBe(true);
    expect(c.get()).toBe(1);
    expect(states.at(-1)).toEqual({ canUndo: true, canRedo: true });
    h.dispose();
  });

  it('groups rapid changes (slider drag) into one step', () => {
    const c = counter();
    const h = new UndoHistory(c.target, () => undefined);
    for (let v = 1; v <= 10; v++) {
      c.set(v);
      vi.advanceTimersByTime(50);
    }
    vi.advanceTimersByTime(GROUP_MS + 1);
    h.undo();
    expect(c.get()).toBe(0);
    h.redo();
    expect(c.get()).toBe(10);
    h.dispose();
  });

  it('a new change after undo clears the redo stack', () => {
    const c = counter();
    const h = new UndoHistory(c.target, () => undefined);
    c.set(1);
    vi.advanceTimersByTime(GROUP_MS + 1);
    h.undo();
    c.set(5);
    expect(h.redo()).toBe(false);
    h.undo();
    expect(c.get()).toBe(0);
    h.dispose();
  });
});
