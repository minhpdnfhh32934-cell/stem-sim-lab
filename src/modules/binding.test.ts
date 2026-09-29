import { describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';
import { bindStore } from './binding';

describe('bindStore', () => {
  const make = () =>
    create<{ a: number; b: string; list: number[]; live: number }>()(() => ({
      a: 1,
      b: 'x',
      list: [1, 2],
      live: 0,
    }));

  it('gets only the bound keys as a JSON copy', () => {
    const s = make();
    const bind = bindStore(s, ['a', 'list']);
    const got = bind.get();
    expect(got).toEqual({ a: 1, list: [1, 2] });
    (got.list as number[]).push(3);
    expect(s.getState().list).toEqual([1, 2]);
  });

  it('restores matching keys and ignores unknown keys or wrong types', () => {
    const s = make();
    const bind = bindStore(s, ['a', 'b', 'list']);
    bind.set({ a: 5, b: 7, list: [9], evil: 1 });
    expect(s.getState()).toMatchObject({ a: 5, b: 'x', list: [9] });
    expect(s.getState()).not.toHaveProperty('evil');
  });

  it('notifies only when bound keys change', () => {
    const s = make();
    const bind = bindStore(s, ['a']);
    const fn = vi.fn();
    const off = bind.subscribe(fn);
    s.setState({ live: 1 });
    s.setState({ live: 2 });
    expect(fn).not.toHaveBeenCalled();
    s.setState({ a: 2 });
    expect(fn).toHaveBeenCalledTimes(1);
    off();
  });

  it('uses the apply hook when given', () => {
    const s = make();
    const apply = vi.fn();
    bindStore(s, ['a'], apply).set({ a: 3 });
    expect(apply).toHaveBeenCalledWith({ a: 3 });
    expect(s.getState().a).toBe(1);
  });
});
