import { describe, expect, it } from 'vitest';
import { resolveConfig } from './config';
import { Disposables, EventBus, type Unsubscribe } from './EventBus';
import { directionFromYawPitch, type Quat, quatFromYaw, rayBox, type Vec3 } from './math';
import { Logger, type LogLevel } from './Logger';
import { Registry } from './Registry';
import { type GameSystem, SystemRunner } from './SystemRunner';

function captureLogger(level: LogLevel = 'debug') {
  const entries: { level: LogLevel; channel: string; message: string }[] = [];
  const log = Logger.create(level, (lvl, channel, message) =>
    entries.push({ level: lvl, channel, message }),
  );
  return { log, entries };
}

interface TestEvents {
  ping: { n: number };
  other: undefined;
}

describe('EventBus', () => {
  const make = () => {
    const { log, entries } = captureLogger();
    return { bus: new EventBus<TestEvents>(log), entries };
  };

  it('delivers payloads to subscribers in subscription order', () => {
    const { bus } = make();
    const calls: string[] = [];
    bus.subscribe('ping', ({ n }) => calls.push(`a${n}`));
    bus.subscribe('ping', ({ n }) => calls.push(`b${n}`));
    bus.publish('ping', { n: 1 });
    expect(calls).toEqual(['a1', 'b1']);
    expect(bus.publishedCount).toBe(1);
  });

  it('stops delivery after unsubscribe, and unsubscribe is idempotent', () => {
    const { bus } = make();
    let count = 0;
    const off = bus.subscribe('ping', () => count++);
    bus.publish('ping', { n: 1 });
    off();
    off();
    bus.publish('ping', { n: 2 });
    expect(count).toBe(1);
    expect(bus.listenerCount()).toBe(0);
  });

  it('never calls a listener that was unsubscribed earlier in the same dispatch', () => {
    const { bus } = make();
    const calls: string[] = [];
    let offB: Unsubscribe = () => undefined;
    bus.subscribe('ping', () => {
      calls.push('a');
      offB(); // e.g. A destroys the object that owns B
    });
    offB = bus.subscribe('ping', () => calls.push('b'));
    bus.publish('ping', { n: 1 });
    expect(calls).toEqual(['a']);
  });

  it('does not call listeners added during a dispatch until the next publish', () => {
    const { bus } = make();
    const calls: string[] = [];
    bus.subscribe('ping', () => {
      calls.push('a');
      bus.subscribe('ping', () => calls.push('late'));
    });
    bus.publish('ping', { n: 1 });
    expect(calls).toEqual(['a']);
  });

  it('isolates a throwing listener and logs it', () => {
    const { bus, entries } = make();
    let reached = false;
    bus.subscribe('ping', () => {
      throw new Error('boom');
    });
    bus.subscribe('ping', () => (reached = true));
    expect(() => bus.publish('ping', { n: 1 })).not.toThrow();
    expect(reached).toBe(true);
    expect(entries.some((e) => e.level === 'error' && e.message.includes('"ping"'))).toBe(true);
  });

  it('clear() drops every listener', () => {
    const { bus } = make();
    let count = 0;
    bus.subscribe('ping', () => count++);
    bus.subscribe('other', () => count++);
    bus.clear();
    bus.publish('ping', { n: 1 });
    bus.publish('other', undefined);
    expect(count).toBe(0);
    expect(bus.listenerCount()).toBe(0);
  });

  it('Disposables runs teardowns once, newest first', () => {
    const order: number[] = [];
    const d = new Disposables();
    d.add(() => order.push(1));
    d.add(() => order.push(2));
    d.dispose();
    d.dispose();
    expect(order).toEqual([2, 1]);
  });
});

describe('SystemRunner', () => {
  const system = (id: string, log: string[], extra: Partial<GameSystem> = {}): GameSystem => ({
    id,
    init: () => void log.push(`init:${id}`),
    update: () => void log.push(`update:${id}`),
    dispose: () => void log.push(`dispose:${id}`),
    ...extra,
  });

  it('inits and updates in registration order and disposes in reverse', async () => {
    const calls: string[] = [];
    const runner = new SystemRunner(captureLogger().log);
    runner.add(system('a', calls));
    runner.add(system('b', calls));
    await runner.initAll();
    runner.update(0.016);
    runner.disposeAll();
    expect(calls).toEqual(['init:a', 'init:b', 'update:a', 'update:b', 'dispose:b', 'dispose:a']);
  });

  it('rejects duplicate ids', () => {
    const runner = new SystemRunner(captureLogger().log);
    runner.add(system('a', []));
    expect(() => runner.add(system('a', []))).toThrow(/already registered/);
  });

  it('aborts boot with the failing system id', async () => {
    const runner = new SystemRunner(captureLogger().log);
    runner.add(
      system('broken', [], {
        init: () => {
          throw new Error('no GPU');
        },
      }),
    );
    await expect(runner.initAll()).rejects.toThrow('System "broken" failed to initialize: no GPU');
    expect(runner.statuses()).toEqual([{ id: 'broken', status: 'failed' }]);
  });

  it('disables a system that throws in update and keeps the others running', async () => {
    const calls: string[] = [];
    const { log, entries } = captureLogger();
    const runner = new SystemRunner(log);
    runner.add(
      system('bad', calls, {
        update: () => {
          throw new Error('nope');
        },
      }),
    );
    runner.add(system('good', calls));
    await runner.initAll();
    runner.update(0.016);
    runner.update(0.016);
    expect(calls.filter((c) => c === 'update:good')).toHaveLength(2);
    expect(runner.statuses().find((s) => s.id === 'bad')?.status).toBe('failed');
    expect(entries.filter((e) => e.level === 'error')).toHaveLength(1); // logged once, not per frame
  });
});

describe('Logger', () => {
  it('filters by level, and children share the level', () => {
    const { log, entries } = captureLogger('warn');
    const child = log.child('Child');
    child.info('hidden');
    child.warn('shown');
    log.setLevel('debug');
    child.debug('now shown');
    expect(entries.map((e) => `${e.channel}:${e.message}`)).toEqual([
      'Child:shown',
      'Child:now shown',
    ]);
  });
});

describe('config', () => {
  it('fills every default from an empty override', () => {
    const config = resolveConfig();
    expect(config.game.initialScene).toBe('main-menu');
    expect(config.input.bindings.interact).toEqual(['KeyE']);
    expect(config.debug.enabled).toBe(false);
  });

  it('merges partial overrides section by section', () => {
    const config = resolveConfig({
      player: { walkSpeed: 3 },
      input: { bindings: { interact: ['KeyF'] } },
    });
    expect(config.player.walkSpeed).toBe(3);
    expect(config.player.runSpeed).toBe(4.5);
    expect(config.input.bindings.interact).toEqual(['KeyF']);
    expect(config.input.bindings.moveForward).toEqual(['KeyW', 'ArrowUp']);
  });

  it('rejects invalid values with their path', () => {
    expect(() => resolveConfig({ graphics: { fov: 500 } })).toThrow(/config\.graphics\.fov/);
    expect(() => resolveConfig({ debug: { logLevel: 'loud' } })).toThrow(/config\.debug\.logLevel/);
  });
});

describe('Registry', () => {
  it('returns items by id and names the kind in errors', () => {
    const registry = new Registry('widget', [{ id: 'a' }]);
    expect(registry.get('a')).toEqual({ id: 'a' });
    expect(registry.tryGet('b')).toBeUndefined();
    expect(() => registry.get('b')).toThrow('Unknown widget "b"');
    expect(() => registry.add({ id: 'a' })).toThrow('Duplicate widget id "a"');
  });
});

describe('rayBox', () => {
  const forward = (yaw: number, pitch = 0) => directionFromYawPitch(yaw, pitch, [0, 0, 0]);
  const half: Vec3 = [0.5, 0.5, 0.5];
  const NO_ROTATION: Quat = [0, 0, 0, 1];

  it('hits a box straight ahead at the near face distance', () => {
    expect(rayBox([0, 0, 0], forward(0), [0, 0, -3], half, NO_ROTATION)).toBeCloseTo(2.5, 9);
  });

  it('misses boxes behind or beside the ray', () => {
    expect(rayBox([0, 0, 0], forward(0), [0, 0, 3], half, NO_ROTATION)).toBeNull();
    expect(rayBox([0, 0, 0], forward(0), [2, 0, -3], half, NO_ROTATION)).toBeNull();
  });

  it('reports 0 when the origin is inside the box', () => {
    expect(rayBox([0, 0, 0], forward(1), [0, 0, 0], half, NO_ROTATION)).toBe(0);
  });

  it('respects rotation about Y', () => {
    // A 2 m wide, 0.1 m deep panel; rotated 90° it is thin along x, so a ray along -x hits at 4.95.
    const panel: Vec3 = [1, 1, 0.05];
    expect(
      rayBox([5, 0, 0], forward(Math.PI / 2), [0, 0, 0], panel, quatFromYaw(Math.PI / 2)),
    ).toBeCloseTo(4.95, 9);
    expect(rayBox([5, 0, 0], forward(Math.PI / 2), [0, 0, 0], panel, NO_ROTATION)).toBeCloseTo(
      4,
      9,
    );
  });

  it('respects rotation about any axis (tumbling objects)', () => {
    // A thin 2 m × 0.1 m plate lying flat; tipped 90° about X it stands up and faces +Z.
    const plate: Vec3 = [1, 0.05, 1];
    const tipped: Quat = [Math.SQRT1_2, 0, 0, Math.SQRT1_2];
    const down = directionFromYawPitch(0, -Math.PI / 2, [0, 0, 0]);
    expect(rayBox([0, 5, 0], down, [0, 0, 0], plate, NO_ROTATION)).toBeCloseTo(4.95, 9);
    expect(rayBox([0, 5, 0], down, [0, 0, 0], plate, tipped)).toBeCloseTo(4, 9);
    expect(rayBox([0, 0, 5], forward(0), [0, 0, 0], plate, tipped)).toBeCloseTo(4.95, 9);
  });
});
