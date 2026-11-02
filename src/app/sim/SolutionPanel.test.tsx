import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { inclinedPlane, newtonLaws } from '@/physics/incline/scenes';
import { MODE } from '@/physics/interference/engine';
import { interference } from '@/physics/interference/scenes';
import { hookeSpring, springPendulum } from '@/physics/spring/scenes';
import type { Params, PhysicsScene } from '@/physics/types';
import { SolutionPanel } from './SolutionPanel';
import { useSimStore } from './simStore';

function show(scene: PhysicsScene, p: Params) {
  const params = { ...scene.defaults, ...(scene.usesGravity ? { g: 9.81 } : {}), ...p };
  expect(scene.validate?.(params) ?? []).toEqual([]);
  useSimStore.setState({ scene, params, validation: [], problem: null, intervened: false });
  render(<SolutionPanel />);
}

afterEach(() => {
  cleanup();
});

describe('SolutionPanel cross-checks', () => {
  it('a check within 1 % reads "khớp"', () => {
    show(interference, { mode: MODE.beats });
    expect(screen.getAllByText(/^khớp/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/chưa khớp/)).toHaveLength(0);
  });

  // Checks that disagree on these reachable inputs were shown as "khớp" before #110; the panel now
  // says "chưa khớp". The checks themselves are not fixed here (separate issue).
  it.each([
    [
      'newtonLaws: the body passes the end before stopping',
      newtonLaws,
      { mu: 1.4, v0: 16, length: 12 },
    ],
    ['inclinedPlane: the body just passes the top', inclinedPlane, { v0: 0.9, s0: 4.95 }],
    ['springPendulum: near critical damping', springPendulum, { b: 9.9 }],
    ['hookeSpring: near critical damping', hookeSpring, { vertical: 0, x0: -0.26, b: 6.3 }],
  ] as const)('%s reads "chưa khớp"', (_name, scene, p) => {
    show(scene, p);
    expect(screen.getAllByText(/chưa khớp/).length).toBeGreaterThan(0);
  });
});
