import { describe, expect, it } from 'vitest';
import { uniformAcceleration } from '@/physics/linear/scenes';
import { pickBody } from './pick';

describe('picking bodies on the stage', () => {
  // Simple camera: 100 px per metre (the y flip does not matter here).
  const scale = 100;
  const toScreen = (x: number, y: number) => ({ sx: x * scale, sy: y * scale });
  const state = new Float64Array(6);

  it('in one-body mode the hidden body B cannot be picked', () => {
    const p = { ...uniformAcceleration.defaults, twoBodies: 0 };
    const b = uniformAcceleration.bodies[1];
    expect(b).toBeDefined();
    const pos = b?.position(state, p) ?? { x: 0, y: 0 };
    expect(
      pickBody(uniformAcceleration.bodies, state, p, toScreen, scale, pos.x * scale, pos.y * scale),
    ).toBeNull();
  });

  it('in two-body mode body B is picked', () => {
    const p = { ...uniformAcceleration.defaults, twoBodies: 1 };
    const pos = uniformAcceleration.bodies[1]?.position(state, p) ?? { x: 0, y: 0 };
    expect(
      pickBody(uniformAcceleration.bodies, state, p, toScreen, scale, pos.x * scale, pos.y * scale)
        ?.id,
    ).toBe('carB');
  });
});
