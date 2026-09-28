import { describe, expect, it } from 'vitest';
import type { Frame } from '@/core/sim/runner';
import { InProcessHost, createSimulationHost } from './host';

describe('simulation host', () => {
  it('uses the in-process host under test', () => {
    expect(createSimulationHost()).toBeInstanceOf(InProcessHost);
  });

  it('loads a registered engine lazily and streams frames', async () => {
    const host = new InProcessHost();
    const info = await host.load('demo.oscillator', { mass: 1, k: 1, x0: 1, v0: 0 });
    expect(info.stateSize).toBe(2);
    const frames: Frame[] = [];
    host.onFrame((f) => frames.push(f));
    for (let i = 0; i < 30; i++) host.requestFrame(1 / 60, 1, false);
    expect(frames).toHaveLength(30);
    expect(frames.at(-1)!.t).toBeCloseTo(0.5, 2);
  });

  it('rejects unknown engines', async () => {
    await expect(new InProcessHost().load('nope', {})).rejects.toThrow(/Unknown simulation engine/);
  });
});
