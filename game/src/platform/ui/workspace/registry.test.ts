import { describe, expect, it, vi } from 'vitest';
import { PieceResolver, WORKSPACE_PIECES } from './registry';
import type { PieceView, PieceViewFactory } from './types';

const view = (): PieceView => ({ mount() {}, update() {}, dispose() {} });

describe('piece registry', () => {
  it('is a plain record from kind to factory, and may be empty', () => {
    expect(typeof WORKSPACE_PIECES).toBe('object');
    expect(Object.isFrozen(WORKSPACE_PIECES)).toBe(true);
    for (const factory of Object.values(WORKSPACE_PIECES)) expect(typeof factory).toBe('function');
  });

  it('resolves a registered kind to its factory without warning', () => {
    const factory: PieceViewFactory = view;
    const warn = vi.fn();
    expect(new PieceResolver({ burette: factory }, warn).resolve('burette')).toBe(factory);
    expect(warn).not.toHaveBeenCalled();
  });

  it('answers an unknown kind with null and warns once per kind, never for a built-in name', () => {
    const warn = vi.fn();
    const resolver = new PieceResolver({}, warn);
    expect(resolver.resolve('ph-meter')).toBeNull();
    expect(resolver.resolve('ph-meter')).toBeNull();
    expect(resolver.resolve('toString')).toBeNull(); // not an inherited member of the record
    expect(warn.mock.calls).toEqual([['ph-meter'], ['toString']]);
  });
});
