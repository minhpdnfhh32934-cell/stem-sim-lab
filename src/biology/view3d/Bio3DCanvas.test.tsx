import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePerfStore } from '@/perf/perfStore';
import { LogisticStage } from '../ecology/EcologyViews';
import { Bio3DCanvas } from './Bio3DCanvas';
import type { Bio3DScene, SceneKit } from './kit';
import { BIO3D_LESSONS, set3d, useBio3DHealth, useBio3DPrefs } from './prefs';
import type { RendererFactory, RendererLike } from './renderer';
import { resetWebgl2Cache } from './support';
import { Bio3DSwitch } from './switch';

// The 2D charts' plot library is not under test here (it needs matchMedia and a canvas).
vi.mock('@/ui/charts/uplot', () => ({
  SERIES_VARS: ['--chart-1'],
  loadUPlot: () => new Promise(() => undefined),
}));

function fakeRenderer() {
  const made: RendererLike[] = [];
  const factory: RendererFactory = () => {
    const r: RendererLike = {
      domElement: document.createElement('canvas'),
      localClippingEnabled: false,
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
      info: {
        memory: { geometries: 0, textures: 0 },
        programs: [],
        render: { calls: 0, triangles: 0 },
      },
    };
    made.push(r);
    return r;
  };
  return { factory, made };
}

/** A scene that records what the canvas does with it. */
function probeScene() {
  const calls = { builds: 0, times: [] as number[], disposed: 0 };
  const build = (kit: SceneKit): Bio3DScene => {
    calls.builds++;
    kit.mesh(kit.sphere(), kit.solid('#808080'));
    const dispose = kit.dispose.bind(kit);
    kit.dispose = () => {
      calls.disposed++;
      dispose();
    };
    return {
      kit,
      bounds: { center: [0, 0, 0], radius: 2 },
      setTime: (t) => {
        calls.times.push(t);
      },
    };
  };
  return { build, calls };
}

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
    setTimeout(() => {
      cb(performance.now());
    }, 0),
  );
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    clearTimeout(id);
  });
  useBio3DHealth.setState({ failed: false });
  useBio3DPrefs.setState({ off: [] });
  usePerfStore.setState({ preference: 'medium', degraded: false });
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetWebgl2Cache();
});

describe('biology 3D canvas', () => {
  it('draws on demand, moves the scene in time without rebuilding, frees everything on unmount', async () => {
    const r = fakeRenderer();
    const probe = probeScene();
    const view = render(
      <Bio3DCanvas
        lesson="logistic"
        build={probe.build}
        buildKey="a"
        label="x"
        time={1}
        createRenderer={r.factory}
      />,
    );
    await act(() => new Promise((res) => setTimeout(res, 5)));
    expect(probe.calls.builds).toBe(1);
    const renderer = r.made[0];
    if (!renderer) throw new Error('no renderer');
    expect(renderer.render).toHaveBeenCalled();
    const drawn = vi.mocked(renderer.render).mock.calls.length;
    // Nothing changes: no new frame.
    await act(() => new Promise((res) => setTimeout(res, 20)));
    expect(vi.mocked(renderer.render).mock.calls.length).toBe(drawn);
    // A new moment: the same scene moves (no rebuild) and one frame is drawn.
    view.rerender(
      <Bio3DCanvas
        lesson="logistic"
        build={probe.build}
        buildKey="a"
        label="x"
        time={2}
        createRenderer={r.factory}
      />,
    );
    await act(() => new Promise((res) => setTimeout(res, 5)));
    expect(probe.calls.builds).toBe(1);
    expect(probe.calls.times.at(-1)).toBe(2);
    expect(vi.mocked(renderer.render).mock.calls.length).toBe(drawn + 1);
    // A new model: rebuilt, the old scene freed, the renderer kept.
    view.rerender(
      <Bio3DCanvas
        lesson="logistic"
        build={probe.build}
        buildKey="b"
        label="x"
        time={2}
        createRenderer={r.factory}
      />,
    );
    expect(probe.calls.builds).toBe(2);
    expect(probe.calls.disposed).toBe(1);
    expect(r.made).toHaveLength(1);
    view.unmount();
    expect(probe.calls.disposed).toBe(2);
    expect(renderer.dispose).toHaveBeenCalled();
    expect(renderer.domElement.isConnected).toBe(false);
  });

  it('a renderer that cannot start marks 3D as unavailable (the lessons fall back to 2D)', () => {
    const probe = probeScene();
    const failing: RendererFactory = () => {
      throw new Error('no WebGL');
    };
    render(
      <Bio3DCanvas
        lesson="drift"
        build={probe.build}
        buildKey="a"
        label="x"
        createRenderer={failing}
      />,
    );
    expect(useBio3DHealth.getState().failed).toBe(true);
    expect(probe.calls.builds).toBe(0);
  });

  it('a lost GPU context hands every lesson to its 2D picture', async () => {
    const r = fakeRenderer();
    const probe = probeScene();
    render(
      <Bio3DCanvas
        lesson="drift"
        build={probe.build}
        buildKey="a"
        label="x"
        createRenderer={r.factory}
      />,
    );
    await act(() => new Promise((res) => setTimeout(res, 5)));
    act(() => {
      r.made[0]?.domElement.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    });
    expect(useBio3DHealth.getState().failed).toBe(true);
  });
});

describe('3D / 2D choice', () => {
  it('lessons open in 3D; the switch keeps the learner’s choice per lesson', async () => {
    const user = userEvent.setup();
    expect(BIO3D_LESSONS.every((l) => !useBio3DPrefs.getState().off.includes(l))).toBe(true);
    render(<Bio3DSwitch lesson="enzyme" />);
    expect(screen.getByRole('radio', { name: '3D' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('radio', { name: '2D' }));
    expect(useBio3DPrefs.getState().off).toEqual(['enzyme']);
    act(() => {
      set3d('enzyme', true);
    });
    expect(useBio3DPrefs.getState().off).toEqual([]);
  });

  it('without WebGL a lesson shows its 2D picture and says why', () => {
    // jsdom has no WebGL 2.
    render(<LogisticStage />);
    expect(screen.getByText(/Máy này chưa vẽ được 3D \(WebGL\)/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '3D' })).toHaveAttribute('aria-checked', 'true');
    expect(document.querySelector('.bio3d')).toBeNull();
  });

  it('the Low quality tier uses the 2D picture (and says how to change it)', () => {
    usePerfStore.setState({
      preference: 'low',
      benchmark: {
        cpuScore: 1,
        drawScore: 1,
        webgl2: true,
        cores: 4,
        tier: 'low',
        measuredAt: '2026-10-20',
        durationMs: 1,
      },
    });
    resetWebgl2Cache();
    render(<LogisticStage />);
    expect(screen.getByText(/chất lượng hiển thị Thấp/)).toBeInTheDocument();
    usePerfStore.setState({ benchmark: null });
  });
});
