import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IntegrationError } from '@/core/ode';

const failing = vi.hoisted(() => ({ on: false }));

vi.mock('./eqStore', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./eqStore')>();
  return {
    ...mod,
    stepEq: (dt: number) => {
      if (failing.on) throw new IntegrationError('dopri5: exceeded 1000000 steps');
      mod.stepEq(dt);
    },
  };
});

const { EquilibriumPanel, EquilibriumStage } = await import('./EquilibriumViews');
const { K_MAX, resetEq, useEqStore } = await import('./eqStore');

/** Manual requestAnimationFrame queue so the test drives the animation loop. */
let frames: FrameRequestCallback[] = [];
let now = 0;
function frame(ms: number) {
  // Never behind the loop's own start time (a slow render under load must not make dt < 0).
  now = Math.max(now, performance.now()) + ms;
  const due = frames;
  frames = [];
  for (const cb of due) cb(now);
}

beforeEach(() => {
  frames = [];
  now = performance.now();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    frames.push(cb);
    return frames.length;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  resetEq({ systemId: 'a+b-c' });
});

afterEach(() => {
  failing.on = false;
  vi.restoreAllMocks();
});

describe('EquilibriumStage animation loop', () => {
  it('advances while the kinetics can be computed', () => {
    render(<EquilibriumStage />);
    act(() => {
      frame(100);
      frame(100);
    });
    expect(useEqStore.getState().t).toBeGreaterThan(0);
    expect(useEqStore.getState().stalled).toBe(false);
  });

  it('pauses with a learner-friendly message instead of dying when a step fails', () => {
    failing.on = true;
    render(<EquilibriumStage />);
    act(() => {
      frame(100);
      frame(100);
    });
    const st = useEqStore.getState();
    expect(st.running).toBe(false);
    expect(st.stalled).toBe(true);
    expect(screen.getByRole('alert').textContent).toMatch(/tạm dừng|paused/i);
  });
});

describe('EquilibriumPanel inputs', () => {
  it('caps the rate constants at K_MAX', () => {
    render(<EquilibriumPanel />);
    const inputs = screen.getAllByRole('spinbutton');
    const kf = inputs[0] as HTMLInputElement;
    expect(kf.max).toBe(String(K_MAX));
    fireEvent.change(kf, { target: { value: '1e12' } });
    expect(useEqStore.getState().kinetics.kf0).toBe(K_MAX);
  });
});
