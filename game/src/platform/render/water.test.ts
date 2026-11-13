import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { ItemDefinition } from '../../gameplay/item';
import { FALL_SPEED, type Flow, flowStep, WaterStreams } from './water';

// Running water without WebGL: the head and tail timing (pure), and the meshes WaterStreams hangs
// in an entity's group (their shaders are compiled through the injected callback, never here).

const LENGTH = 0.3;
const DT = 1 / 300;

/** Steps `flow` until it settles; the time it took (s). */
function settle(flow: Flow, running: boolean): number {
  let t = 0;
  while (flowStep(flow, running, LENGTH, DT)) {
    t += DT;
    expect(flow.tail).toBeLessThanOrEqual(flow.head);
    expect(flow.head).toBeLessThanOrEqual(LENGTH);
    if (t > 10) throw new Error('never settles');
  }
  return t + DT;
}

describe('flowStep', () => {
  it('lets the head fall from the mouth to the end at FALL_SPEED, then holds', () => {
    const flow = { head: 0, tail: 0 };
    flowStep(flow, true, LENGTH, 0.02);
    expect(flow).toEqual({ head: FALL_SPEED * 0.02, tail: 0 });
    expect(settle(flow, true)).toBeCloseTo(LENGTH / FALL_SPEED - 0.02, 2); // the rest of the fall
    expect(flow).toEqual({ head: LENGTH, tail: 0 });
    expect(flowStep(flow, true, LENGTH, DT)).toBe(false);
  });

  it('lets the tail fall away when turned off, leaving nothing', () => {
    const flow = { head: LENGTH, tail: 0 };
    flowStep(flow, false, LENGTH, 0.02);
    expect(flow).toEqual({ head: LENGTH, tail: FALL_SPEED * 0.02 });
    expect(settle(flow, false)).toBeCloseTo(LENGTH / FALL_SPEED - 0.02, 2); // the rest of the fall
    expect(flow).toEqual({ head: 0, tail: 0 });
  });

  it('lets water turned off before it landed fall on to the end, then away', () => {
    const flow = { head: 0.1, tail: 0 };
    flowStep(flow, false, LENGTH, 0.02);
    expect(flow.head).toBeCloseTo(0.15, 9);
    expect(flow.tail).toBeCloseTo(0.05, 9);
    settle(flow, false);
    expect(flow).toEqual({ head: 0, tail: 0 });
  });

  it('makes no water from nothing, and starts a new head when turned on while draining', () => {
    const dry = { head: 0, tail: 0 };
    expect(flowStep(dry, false, LENGTH, 1)).toBe(false);
    expect(dry).toEqual({ head: 0, tail: 0 });
    const draining = { head: LENGTH, tail: 0.1 };
    flowStep(draining, true, LENGTH, 0.02);
    expect(draining).toEqual({ head: FALL_SPEED * 0.02, tail: 0 });
  });

  it('never passes the end on a long frame', () => {
    const flow = { head: 0, tail: 0 };
    expect(flowStep(flow, true, LENGTH, 5)).toBe(false);
    expect(flow.head).toBe(LENGTH);
    expect(flowStep(flow, false, LENGTH, 5)).toBe(false);
    expect(flow).toEqual({ head: 0, tail: 0 });
  });
});

const faucet = (from?: [number, number, number]) =>
  ({
    visual: { size: [0.2, 0.12, 0.08], stream: { length: LENGTH, color: '#8fc8f0', from } },
  }) as unknown as ItemDefinition;

/** The column and the splash of a stream in `group`, and the group they hang from. */
function meshes(group: THREE.Group) {
  const root = group.children[0] as THREE.Group;
  const [column, splash] = root.children as THREE.Mesh[];
  return { root, column: column!, splash: splash! };
}

describe('WaterStreams', () => {
  it('hangs the stream from its mouth, hidden until it runs, and compiles it on the next frame', () => {
    const compile = vi.fn();
    const water = new WaterStreams(compile);
    const group = new THREE.Group();
    water.add('room/faucet', faucet([0.01, -0.05, 0]), group, false);
    const { root, column, splash } = meshes(group);
    expect(root.position.toArray()).toEqual([0.01, -0.05, 0]);
    expect(splash.position.y).toBe(-LENGTH);
    expect(column.visible || splash.visible).toBe(false);
    expect(compile).not.toHaveBeenCalled();
    water.update(DT);
    expect(compile).toHaveBeenCalledExactlyOnceWith(root);
    water.update(DT);
    expect(compile).toHaveBeenCalledTimes(1);
    water.dispose();
  });

  it('defaults the mouth to the bottom centre, and draws a saved running stream full at once', () => {
    const water = new WaterStreams(() => {});
    const group = new THREE.Group();
    water.add('room/faucet', faucet(), group, true);
    const { root, column, splash } = meshes(group);
    expect(root.position.toArray()).toEqual([0, -0.06, 0]);
    expect(column.visible && splash.visible).toBe(true);
    expect(column.position.y).toBeCloseTo(0, 9);
    expect(column.scale.y).toBe(LENGTH);
    water.dispose();
  });

  it('falls in when turned on and away when turned off, then shows nothing', () => {
    const water = new WaterStreams(() => {});
    const group = new THREE.Group();
    water.add('room/faucet', faucet(), group, false);
    const { column, splash } = meshes(group);
    water.refresh('room/faucet', true);
    water.update(0.05);
    expect(column.visible).toBe(true);
    expect(column.scale.y).toBeCloseTo(FALL_SPEED * 0.05, 9);
    expect(splash.visible).toBe(false); // not landed yet
    for (let i = 0; i < 100; i++) water.update(DT);
    expect(column.scale.y).toBe(LENGTH);
    expect(splash.visible).toBe(true);
    water.refresh('room/faucet', false);
    water.update(0.05);
    expect(column.position.y).toBeCloseTo(-FALL_SPEED * 0.05, 9); // the tail, below the mouth
    expect(column.scale.y).toBeCloseTo(LENGTH - FALL_SPEED * 0.05, 9);
    for (let i = 0; i < 100; i++) water.update(DT);
    expect(column.visible || splash.visible).toBe(false);
    water.dispose();
  });

  it('shares one geometry and one material each between streams of a colour', () => {
    const water = new WaterStreams(() => {});
    const [a, b] = [new THREE.Group(), new THREE.Group()];
    water.add('room/a', faucet(), a, false);
    water.add('room/b', faucet(), b, false);
    const [ma, mb] = [meshes(a), meshes(b)];
    expect(ma.column.geometry).toBe(mb.column.geometry);
    expect(ma.column.material).toBe(mb.column.material);
    expect(ma.splash.material).toBe(mb.splash.material);
    // Removing one leaves the other's resources alone; dispose frees them once.
    const disposed = vi.fn();
    ma.column.geometry.addEventListener('dispose', disposed);
    water.remove('room/a');
    water.refresh('room/a', true); // forgotten: nothing happens
    water.update(DT);
    expect(disposed).not.toHaveBeenCalled();
    water.dispose();
    expect(disposed).toHaveBeenCalledTimes(1);
  });

  it('adds nothing for an item without a stream', () => {
    const water = new WaterStreams(() => {});
    const group = new THREE.Group();
    water.add('room/x', { visual: { size: [1, 1, 1] } } as unknown as ItemDefinition, group, true);
    expect(group.children).toHaveLength(0);
    water.dispose();
  });
});
