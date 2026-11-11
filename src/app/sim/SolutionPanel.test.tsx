import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { inclinedPlane, newtonLaws } from '@/physics/incline/scenes';
import { MODE } from '@/physics/interference/engine';
import { interference } from '@/physics/interference/scenes';
import { hookeSpring, springPendulum } from '@/physics/spring/scenes';
import type { Answer, Params, PhysicsScene } from '@/physics/types';
import { SolutionPanel } from './SolutionPanel';
import { useSimStore } from './simStore';

function show(scene: PhysicsScene, p: Params) {
  const params = { ...scene.defaults, ...(scene.usesGravity ? { g: 9.81 } : {}), ...p };
  expect(scene.validate?.(params) ?? []).toEqual([]);
  useSimStore.setState({ scene, params, validation: [], problem: null, intervened: false });
  render(<SolutionPanel />);
}

/** The same scene with its answers rewritten (to show a check the real scenes never produce). */
function withAnswers(scene: PhysicsScene, edit: (a: Answer[]) => Answer[]): PhysicsScene {
  return {
    ...scene,
    solve: (p, locale) => {
      const s = scene.solve(p, locale);
      return { ...s, answers: edit(s.answers) };
    },
  };
}

/** The answer table's check labels (the note above the table names "chưa khớp" too). */
const labels = () =>
  [...document.querySelectorAll('.solution__check span')].map((e) => e.textContent);
const notAgreeing = () => labels().filter((s) => !s.startsWith('khớp'));

afterEach(() => {
  cleanup();
});

describe('SolutionPanel cross-checks', () => {
  it('a measured beat period within its declared 0,3 % reads "khớp"', () => {
    show(interference, { mode: MODE.beats });
    expect(labels().length).toBeGreaterThan(0);
    expect(notAgreeing()).toEqual([]);
  });

  it('an exact 0 with a round-off check (~1e-14) reads "khớp" with the absolute gap', () => {
    // The body stops exactly at the top: speed 0 m/s, the DOPRI5 check ~1e-14 m/s.
    show(inclinedPlane, {
      theta: (55 * Math.PI) / 180,
      muS: 1.16,
      muK: 1.16,
      length: 49.6,
      s0: 49.6,
      v0: -18.8,
      F: 176,
      m: 2,
    });
    expect(labels().some((s) => /^khớp, sai lệch .*m\/s$/.test(s))).toBe(true);
    expect(notAgreeing()).toEqual([]);
  });

  it('an answer of 0 with a check of 1e-15 shows "sai lệch 1·10⁻¹⁵ m/s", not a ratio', () => {
    show(
      withAnswers(inclinedPlane, (list) =>
        list.slice(0, 1).map((a) => ({ ...a, value: 0, unit: 'm/s', check: 1e-15 })),
      ),
      {},
    );
    expect(screen.getByText('khớp, sai lệch 1·10⁻¹⁵ m/s')).toBeTruthy();
  });

  it('a check off by 10⁻⁶ (inside the old 1 % rule) now reads "chưa khớp"', () => {
    show(
      withAnswers(inclinedPlane, (list) =>
        list.map((a) => (a.check === undefined ? a : { ...a, check: a.value * (1 + 1e-6) })),
      ),
      {},
    );
    expect(labels().length).toBeGreaterThan(0);
    expect(new Set(labels())).toEqual(new Set(['chưa khớp, sai lệch 1·10⁻⁶']));
  });

  // Checks that disagreed on these reachable inputs were shown as "khớp" before #110, then as
  // "chưa khớp". Issue #112 (PR #118) fixed the checks: they now agree, or the card says why there
  // is none, so none of these inputs reads "chưa khớp" any more.
  it.each([
    [
      'newtonLaws: the body passes the end before stopping',
      newtonLaws,
      { mu: 1.4, v0: 16, length: 12 },
    ],
    ['inclinedPlane: the body just passes the top', inclinedPlane, { v0: 0.9, s0: 4.95 }],
    ['springPendulum: near critical damping', springPendulum, { b: 9.9 }],
    ['hookeSpring: near critical damping', hookeSpring, { vertical: 0, x0: -0.26, b: 6.3 }],
  ] as const)('%s: fixed by #112, no "chưa khớp"', (_name, scene, p) => {
    show(scene, p);
    expect(notAgreeing()).toEqual([]);
  });
});
