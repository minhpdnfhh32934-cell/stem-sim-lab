import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePerfStore } from '@/perf/perfStore';
import { fakeRenderer, withReducedMotion } from '@/ui/three/testing';
import { OrbView } from './OrbView';

const webgl2 = vi.hoisted(() => ({ ok: true }));
vi.mock('@/ui/three/availability', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/ui/three/availability')>()),
  webgl2Available: () => webgl2.ok,
}));

const RINGS = <div data-testid="rings" />;

beforeEach(() => {
  webgl2.ok = true;
  usePerfStore.setState({ preference: 'medium', degraded: false });
});
afterEach(() => {
  usePerfStore.setState({ preference: 'auto', degraded: false });
});

describe('OrbView (#234 step 2)', () => {
  it('draws the orb on a canvas; leaving the page frees the renderer and removes the canvas', () => {
    const { factory, made } = fakeRenderer();
    const view = render(<OrbView state="idle" fallback={RINGS} createRenderer={factory} />);
    expect(made).toHaveLength(1);
    const canvas = made[0]?.domElement;
    expect(canvas?.isConnected).toBe(true);
    expect(document.querySelector('.teacher-orb')).toHaveAttribute('data-picture', 'orb');
    expect(document.querySelector('.teacher-orb')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByTestId('rings')).toBeNull();
    view.unmount();
    expect(made[0]?.dispose).toHaveBeenCalledTimes(1);
    expect(made[0]?.forceContextLoss).toHaveBeenCalledTimes(1);
    expect(canvas?.isConnected).toBe(false);
  });

  it('Low quality or no WebGL 2: the rings, no renderer at all', () => {
    const { factory, made } = fakeRenderer();
    usePerfStore.setState({ preference: 'low' });
    const low = render(<OrbView state="idle" fallback={RINGS} createRenderer={factory} />);
    expect(screen.getByTestId('rings')).toBeInTheDocument();
    low.unmount();
    usePerfStore.setState({ preference: 'medium' });
    webgl2.ok = false;
    render(<OrbView state="idle" fallback={RINGS} createRenderer={factory} />);
    expect(screen.getByTestId('rings')).toBeInTheDocument();
    expect(made).toHaveLength(0);
  });

  it('a lost GPU context: the rings take over and the renderer is freed', () => {
    const { factory, made } = fakeRenderer();
    render(<OrbView state="thinking" fallback={RINGS} createRenderer={factory} />);
    act(() => {
      made[0]?.domElement.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    });
    expect(screen.getByTestId('rings')).toBeInTheDocument();
    expect(made[0]?.dispose).toHaveBeenCalledTimes(1);
  });

  it('no renderer can start: the rings', async () => {
    const failing = () => {
      throw new Error('no WebGL');
    };
    render(<OrbView state="idle" fallback={RINGS} createRenderer={failing} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId('rings')).toBeInTheDocument();
  });

  it('reduced motion: drawn once, still; a new state draws it once more', async () => {
    const restore = withReducedMotion();
    try {
      const { factory, made } = fakeRenderer();
      const view = render(<OrbView state="idle" fallback={RINGS} createRenderer={factory} />);
      expect(document.querySelector('.teacher-orb')).toHaveAttribute('data-picture', 'still');
      const r = made[0];
      if (!r) throw new Error('no renderer');
      const once = vi.mocked(r.render).mock.calls.length;
      expect(once).toBeGreaterThanOrEqual(1);
      await new Promise((ok) => setTimeout(ok, 120));
      expect(vi.mocked(r.render).mock.calls.length).toBe(once);
      view.rerender(<OrbView state="thinking" fallback={RINGS} createRenderer={factory} />);
      expect(vi.mocked(r.render).mock.calls.length).toBe(once + 1);
    } finally {
      restore();
    }
  });
});
