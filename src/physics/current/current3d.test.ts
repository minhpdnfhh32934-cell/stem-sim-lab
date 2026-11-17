import { describe, expect, it } from 'vitest';
import { expectAllFreed, testKit } from '@/biology/view3d/testing';
import { CurrentEngine, WR } from './engine';
import { ELECTRONS, electronX, electronYZ, wireLength } from './current3d';
import { WIRE_DEFAULTS, driftSpeed, jitter, wireInput } from './model';
import { electricCurrent } from './scenes';
import { buildCurrentScene } from './scene3d';

const d = WIRE_DEFAULTS.d;
const Lw = wireLength(d);

describe('electric current 3D binding', () => {
  it('the electrons move back by the drift distance s (the 2D rule), inside the wire', () => {
    for (const s of [0, 1e-4, 0.0123, 7.9 * d]) {
      for (let k = 0; k < ELECTRONS; k++) {
        const x = electronX(k, s, Lw);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(Lw);
        const back = (((jitter(k, 1) * Lw - x - s) % Lw) + Lw) % Lw;
        expect(Math.min(back, Lw - back)).toBeLessThan(1e-12);
        expect(Math.hypot(...electronYZ(k, d / 2))).toBeLessThanOrEqual(0.76 * (d / 2) + 1e-15);
      }
    }
  });
});

describe('electric current 3D scene', () => {
  it('reads the engine’s s (v·t), moves without rebuilding, frees all', () => {
    const { kit, track, start } = testKit();
    const p = { ...electricCurrent.defaults };
    const engine = new CurrentEngine();
    engine.reset(p);
    const state = new Float64Array(engine.stateSize);
    const scene = buildCurrentScene(kit, {
      d,
      texts: { I: 'I', v: 'v', S: 'S' },
      read: () => state,
    });
    for (let i = 0; i < 600; i++) engine.step();
    engine.readState(state);
    scene.tick?.(1 / 60);
    const s = scene.state();
    expect(s.s).toBe(state[WR.s]);
    expect(s.s).toBeCloseTo(driftSpeed(wireInput(p)) * engine.time(), 15);
    expect(s.firstX).toBe(electronX(0, s.s, Lw));
    expect(s.electrons).toBe(ELECTRONS);
    expectAllFreed(kit, track, start);
  });
});
