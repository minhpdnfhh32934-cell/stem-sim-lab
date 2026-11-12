import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IntegrationError } from '@/core/ode';
import { withReducedMotion } from '@/ui/three/testing';

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
let frames = new Map<number, FrameRequestCallback>();
let nextFrame = 0;
let now = 0;
function frame(ms: number) {
  // Never behind the loop's own start time (a slow render under load must not make dt < 0).
  now = Math.max(now, performance.now()) + ms;
  const due = [...frames.values()];
  frames = new Map();
  for (const cb of due) cb(now);
}

beforeEach(() => {
  frames = new Map();
  now = performance.now();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    nextFrame += 1;
    frames.set(nextFrame, cb);
    return nextFrame;
  });
  // Like a browser: a cancelled frame never runs.
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
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

describe('reduced motion (#205 C3)', () => {
  it('opens paused, a restart keeps it paused, and only "Chạy" runs it', () => {
    const restore = withReducedMotion();
    try {
      // Left running earlier in the session: reopening still waits for the learner.
      expect(useEqStore.getState().running).toBe(true);
      render(<EquilibriumStage />);
      expect(useEqStore.getState().running).toBe(false);
      act(() => {
        frame(100);
        frame(100);
      });
      expect(useEqStore.getState().t).toBe(0);
      act(() => {
        resetEq({ T: 350 });
      });
      expect(useEqStore.getState().running).toBe(false);
      fireEvent.click(screen.getByRole('button', { name: 'Chạy' }));
      expect(useEqStore.getState().running).toBe(true);
      act(() => {
        frame(100);
        frame(100);
      });
      expect(useEqStore.getState().t).toBeGreaterThan(0);
      // The learner chose to run: a restart keeps running.
      act(() => {
        resetEq({ T: 300 });
      });
      expect(useEqStore.getState().running).toBe(true);
    } finally {
      restore();
    }
  });

  it('without reduced motion a restart runs again, as before', () => {
    // The stub of the test above is gone.
    expect(Reflect.get(window, 'matchMedia')).toBeUndefined();
    useEqStore.setState({ running: false });
    resetEq({ T: 350 });
    expect(useEqStore.getState().running).toBe(true);
  });
});
