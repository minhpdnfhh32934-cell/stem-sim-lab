import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useApplyTheme } from '@/app/theme/useApplyTheme';
import { useWorkspaceStore } from '@/app/workspaceStore';
import type { BenchmarkResult } from '@/perf/benchmark';
import { FrameMonitor } from '@/perf/frameMonitor';
import { effectiveTier, usePerfStore } from '@/perf/perfStore';
import { DivisionStage } from '../DivisionViews';
import { STAGES } from '../division';
import { setDivisionState } from '../stageIndex';
import { STAGE_NAME, useDivisionStore } from '../state';
import { MitosisBottom, MitosisPanel, MitosisStage } from '../views';
import { STAGE3D_NAME, stageNote } from './components';
import { Mitosis3DSwitch } from './Mitosis3DSwitch';
import { cellBound, placeCamera, cameraFrame } from './camera';
import { Mitosis3DView, type RendererFactory, type RendererLike } from './Mitosis3DView';
import { Mitosis3DParts } from './panels';
import { buildMitosisScene, type ScenePalette } from './scene';
import { index2dOf, stage3dOf, timelineFor, useMitosis3D } from './store';
import { STAGES_3D, type CellType } from './timeline';
import { withReducedMotion } from '@/ui/three/testing';

/**
 * The view's own renderer factory calls `new THREE.WebGLRenderer(…)`, and jsdom has no WebGL.
 * `gl.real` → the real three.js class (it throws: there is no context); otherwise a stand-in
 * that works until its canvas fires 'webglcontextlost'. Tests that pass `createRenderer` are
 * not affected.
 */
const gl = vi.hoisted(() => ({
  real: false,
  made: [] as { canvas: HTMLCanvasElement; disposed: number }[],
}));
vi.mock('three', async (importOriginal) => {
  const three = await importOriginal<typeof THREE>();
  function WebGLRenderer(params?: THREE.WebGLRendererParameters): RendererLike {
    if (gl.real) return new three.WebGLRenderer(params);
    const made = { canvas: document.createElement('canvas'), disposed: 0 };
    gl.made.push(made);
    return {
      domElement: made.canvas,
      localClippingEnabled: false,
      setPixelRatio: () => undefined,
      setSize: () => undefined,
      render: () => undefined,
      dispose: () => {
        made.disposed++;
      },
      info: {
        memory: { geometries: 0, textures: 0 },
        programs: [],
        render: { calls: 0, triangles: 0 },
      },
    };
  }
  return { ...three, WebGLRenderer };
});

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

beforeEach(() => {
  setDivisionState('mitosis', { pairs: 2, index: 0, cellType: 'animal', view3d: true, speed: 1 });
  useMitosis3D.setState({
    t: 0,
    playing: false,
    selected: null,
    camera: 'overview',
    viewNonce: 0,
    webglFailed: false,
    active: false,
    cellLocked: false,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const stageLabel = () => screen.getByRole('img').getAttribute('aria-label') ?? '';

describe('Mitosis3DView', () => {
  it('renders the controls with accessible names', () => {
    const { factory } = fakeRenderer();
    render(<Mitosis3DView createRenderer={factory} />);
    for (const name of [
      'Bước trước',
      'Phát',
      'Bước tiếp theo',
      'Phát lại từ đầu',
      'Đặt lại góc nhìn',
    ])
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    for (const name of ['Động vật', 'Thực vật', '3D', '2D', 'Toàn cảnh', 'Cận cảnh NST', '1×'])
      expect(screen.getByRole('radio', { name })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '0,5×' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bước trước' })).toBeDisabled();
    expect(useMitosis3D.getState().active).toBe(true);
  });

  it('the stage label follows the playback time and the stage buttons', async () => {
    const { factory, made } = fakeRenderer();
    render(<Mitosis3DView createRenderer={factory} />);
    expect(stageLabel()).toMatch(/^Kì trung gian \(pha G1\)/);
    const tl = timelineFor(2, 'animal');
    act(() => {
      useMitosis3D.setState({ t: tl.keyTime('metaphase') });
    });
    expect(stageLabel()).toMatch(/^Kì giữa\. /);
    expect(screen.getByText('1 tế bào · 4 NST kép')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Bước tiếp theo' }));
    expect(stageLabel()).toMatch(/^Kì sau\. /);
    expect(screen.getByText('1 tế bào · 8 NST đơn')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Bước tiếp theo' }));
    expect(stageLabel()).toMatch(/^Kì cuối\. /);
    expect(screen.getByText('1 tế bào · 2 nhân · mỗi nhân 4 NST đơn')).toBeInTheDocument();
    // Early telophase: the envelopes are still forming, so there are no two nuclei yet.
    act(() => {
      useMitosis3D.setState({ t: tl.stages.find((w) => w.id === 'telophase')!.start + 0.2 });
    });
    expect(screen.getByText('1 tế bào · 8 NST đơn · đang hình thành 2 nhân')).toBeInTheDocument();
    act(() => {
      useMitosis3D.setState({ t: tl.keyTime('telophase') });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Bước tiếp theo' }));
    expect(stageLabel()).toMatch(/^Phân chia tế bào chất\. /);
    expect(
      screen.getByText('Sau khi chia: 2 tế bào con · mỗi tế bào 4 NST đơn'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bước tiếp theo' })).toBeDisabled();
    // The stage strip marks the current stage.
    const strip = screen.getByRole('group', { name: 'Các kì' });
    expect(within(strip).getByRole('button', { name: 'Chia tế bào chất' })).toHaveAttribute(
      'aria-current',
      'step',
    );
    fireEvent.click(within(strip).getByRole('button', { name: 'Kì đầu' }));
    expect(stageLabel()).toMatch(/^Kì đầu\. /);
    // Renders on demand (next animation frame).
    await waitFor(() => {
      expect(made[0]?.render).toHaveBeenCalled();
    });
  });

  it('play / pause toggles playback; replay starts from the beginning', () => {
    const { factory } = fakeRenderer();
    render(<Mitosis3DView createRenderer={factory} />);
    fireEvent.click(screen.getByRole('button', { name: 'Phát' }));
    expect(useMitosis3D.getState().playing).toBe(true);
    expect(screen.getByRole('button', { name: 'Tạm dừng' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tạm dừng' }));
    expect(useMitosis3D.getState().playing).toBe(false);
    act(() => {
      useMitosis3D.setState({ t: 10 });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Phát lại từ đầu' }));
    expect(useMitosis3D.getState()).toMatchObject({ t: 0, playing: true });
    fireEvent.click(screen.getByRole('radio', { name: '2×' }));
    expect(useDivisionStore.getState().speed).toBe(2);
  });

  it('toggling animal / plant changes the cell parts', () => {
    const { factory, made } = fakeRenderer();
    render(
      <>
        <Mitosis3DView createRenderer={factory} />
        <Mitosis3DParts />
      </>,
    );
    const parts = () => screen.getByRole('group', { name: 'Bộ phận tế bào' });
    expect(within(parts()).getByRole('button', { name: 'Trung thể' })).toBeInTheDocument();
    expect(
      within(parts()).getByRole('button', { name: 'Vòng co (rãnh phân cắt)' }),
    ).toBeInTheDocument();
    expect(within(parts()).queryByRole('button', { name: 'Thành tế bào' })).toBeNull();
    // Select an animal-only part, then switch to plant: the selection is cleared.
    fireEvent.click(within(parts()).getByRole('button', { name: 'Trung thể' }));
    expect(screen.getByRole('complementary')).toHaveTextContent('Trung thể');
    // The close button is a full-size target.
    expect(screen.getByRole('button', { name: 'Bỏ chọn' })).toHaveClass('icon-btn--lg');
    fireEvent.click(screen.getByRole('radio', { name: 'Thực vật' }));
    expect(useDivisionStore.getState().cellType).toBe('plant');
    expect(within(parts()).getByRole('button', { name: 'Thành tế bào' })).toBeInTheDocument();
    expect(
      within(parts()).getByRole('button', { name: 'Vách ngăn (tấm tế bào)' }),
    ).toBeInTheDocument();
    expect(within(parts()).queryByRole('button', { name: 'Trung thể' })).toBeNull();
    expect(within(parts()).queryByRole('button', { name: 'Vòng co (rãnh phân cắt)' })).toBeNull();
    expect(useMitosis3D.getState().selected).toBeNull();
    // The scene was rebuilt for the plant cell; the renderer (WebGL context) was kept.
    expect(made).toHaveLength(1);
    expect(made[0]?.dispose).not.toHaveBeenCalled();
    // Picking a part from the list shows its name and function.
    fireEvent.click(within(parts()).getByRole('button', { name: 'Thành tế bào' }));
    expect(screen.getByRole('complementary')).toHaveTextContent(/cellulose/);
  });

  it('a lesson that holds the cell locks the cell type control', () => {
    const { factory } = fakeRenderer();
    useMitosis3D.setState({ cellLocked: true });
    render(<Mitosis3DView createRenderer={factory} />);
    const animal = screen.getByRole('radio', { name: 'Động vật' });
    const plant = screen.getByRole('radio', { name: 'Thực vật' });
    expect(animal).toBeDisabled();
    expect(animal).toHaveAttribute('aria-checked', 'true');
    expect(plant).toBeDisabled();
    fireEvent.click(plant);
    expect(useDivisionStore.getState().cellType).toBe('animal');
    // Released: the learner can switch again.
    act(() => {
      useMitosis3D.setState({ cellLocked: false });
    });
    expect(plant).toBeEnabled();
    fireEvent.click(plant);
    expect(useDivisionStore.getState().cellType).toBe('plant');
  });

  it('cleans up the renderer and the debug hook on unmount', () => {
    const { factory, made } = fakeRenderer();
    const view = render(<Mitosis3DView createRenderer={factory} />);
    expect(window.__simlabMitosis3d?.stage()).toBe('g1');
    // The hook also reports the last frame's draw calls and triangles, and the quality in use.
    made[0]!.info.render.calls = 26;
    made[0]!.info.render.triangles = 9152;
    expect(window.__simlabMitosis3d?.info()).toMatchObject({ calls: 26, triangles: 9152 });
    expect(window.__simlabMitosis3d?.quality()).toEqual({
      tier: effectiveTier(usePerfStore.getState()),
      degraded: false,
    });
    view.unmount();
    expect(made[0]?.dispose).toHaveBeenCalled();
    expect(made[0]?.domElement.isConnected).toBe(false);
    expect(window.__simlabMitosis3d).toBeUndefined();
    expect(useMitosis3D.getState().active).toBe(false);
  });

  it('plant cell: the stage label, caption and Science Card name the plant cell and its parts', () => {
    setDivisionState('mitosis', { cellType: 'plant' });
    const { factory } = fakeRenderer();
    render(<Mitosis3DView createRenderer={factory} />);
    expect(stageLabel()).toBe(`${STAGE3D_NAME.g1.vi}. ${stageNote('g1', 'plant').vi}`);
    expect(stageLabel()).toMatch(/thành tế bào cứng và không có trung thể/);
    const caption = document.querySelector('.m3d__caption');
    expect(caption).toHaveTextContent(/Tế bào thực vật ·/);
    expect(caption).not.toHaveTextContent(/Tế bào động vật/);
    expect(useWorkspaceStore.getState().scienceCard?.title.vi).toBe(
      'Nguyên phân 3D — tế bào thực vật',
    );
    // Cytokinesis of a plant cell: a cell plate, never a furrow.
    act(() => {
      useMitosis3D.setState({ t: timelineFor(2, 'plant').keyTime('cytokinesis') });
    });
    expect(stageLabel()).toMatch(/^Phân chia tế bào chất\. Tấm tế bào hình thành/);
    expect(stageLabel()).not.toMatch(/rãnh phân cắt|vòng co|trung thể/i);
    expect(
      screen.getByText('Sau khi chia: 2 tế bào con · mỗi tế bào 4 NST đơn'),
    ).toBeInTheDocument();
    // Back to the animal cell: centrosome and furrow texts, animal card.
    fireEvent.click(screen.getByRole('radio', { name: 'Động vật' }));
    expect(stageLabel()).toMatch(/rãnh phân cắt/);
    expect(document.querySelector('.m3d__caption')).toHaveTextContent(/Tế bào động vật ·/);
    expect(useWorkspaceStore.getState().scienceCard?.title.vi).toBe(
      'Nguyên phân 3D — tế bào động vật',
    );
  });

  it('replays and scene rebuilds free every geometry and material they create', () => {
    const palette: ScenePalette = {
      maternal: 'gray',
      paternal: 'gray',
      centromere: 'gray',
      membrane: 'gray',
      envelope: 'gray',
      nucleolus: 'gray',
      wall: 'gray',
      spindle: 'gray',
      centrosome: 'gray',
      plate: 'gray',
      ring: 'gray',
      highlight: 'gray',
    };
    // three.js numbers geometries and materials in creation order: everything created between
    // two probes has an id strictly between theirs.
    // (`Material.id` is documented but missing from @types/three.)
    const materialId = (m: unknown) => (m as THREE.Material & { readonly id: number }).id;
    const probe = () => ({ g: new THREE.BufferGeometry().id, m: materialId(new THREE.Material()) });
    const between = (a: number, b: number) =>
      Array.from({ length: b - a - 1 }, (_, k) => a + 1 + k);
    /** How many geometries / materials one scene creates. */
    const perScene = (pairs: number, type: CellType) => {
      const a = probe();
      buildMitosisScene(timelineFor(pairs, type), palette, { segments: 12 }).dispose();
      const b = probe();
      return { g: b.g - a.g - 1, m: b.m - a.m - 1 };
    };
    const initial = perScene(2, 'animal');
    const final = perScene(4, 'plant');
    const geo = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
    const mat = vi.spyOn(THREE.Material.prototype, 'dispose');
    const freed = () => ({
      g: new Set(geo.mock.contexts.map((x) => (x as THREE.BufferGeometry).id)),
      m: new Set(mat.mock.contexts.map(materialId)),
    });

    const start = probe();
    const { factory, made } = fakeRenderer();
    const view = render(<Mitosis3DView createRenderer={factory} />);
    const built = probe();
    expect(built.g - start.g - 1).toBe(initial.g);
    expect(built.m - start.m - 1).toBe(initial.m);
    // Five replays, stepping through every stage: nothing is created or freed.
    for (let r = 0; r < 5; r++) {
      fireEvent.click(screen.getByRole('button', { name: 'Phát lại từ đầu' }));
      fireEvent.click(screen.getByRole('button', { name: 'Tạm dừng' }));
      for (let k = 0; k < STAGES_3D.length - 1; k++)
        fireEvent.click(screen.getByRole('button', { name: 'Bước tiếp theo' }));
      expect(screen.getByRole('button', { name: 'Bước tiếp theo' })).toBeDisabled();
    }
    const replayed = probe();
    expect(between(built.g, replayed.g)).toEqual([]);
    expect(between(built.m, replayed.m)).toEqual([]);
    expect(freed().g.size).toBe(0);
    expect(freed().m.size).toBe(0);
    // Scene rebuilds: cell type back and forth, theme, 2n. Only the last scene stays alive.
    for (const type of ['Thực vật', 'Động vật', 'Thực vật', 'Động vật', 'Thực vật'])
      fireEvent.click(screen.getByRole('radio', { name: type }));
    act(() => {
      useSettingsStore.setState({
        theme: useSettingsStore.getState().theme === 'dark' ? 'light' : 'dark',
      });
    });
    act(() => {
      useDivisionStore.setState({ pairs: 4 });
    });
    const end = probe();
    const live = (f: ReturnType<typeof freed>) => ({
      g: between(start.g, end.g).filter(
        (id) => id !== built.g && id !== replayed.g && !f.g.has(id),
      ),
      m: between(start.m, end.m).filter(
        (id) => id !== built.m && id !== replayed.m && !f.m.has(id),
      ),
    });
    expect(live(freed()).g).toHaveLength(final.g);
    expect(live(freed()).m).toHaveLength(final.m);
    // The renderer (WebGL context) was kept through all of it.
    expect(made).toHaveLength(1);
    view.unmount();
    expect(live(freed())).toEqual({ g: [], m: [] });
    useSettingsStore.setState({ theme: 'system' });
  });

  it('a theme switch rebuilds the scene with the new theme colours', async () => {
    const style = document.createElement('style');
    style.textContent = `
      :root { --subject-biology: rgb(10, 120, 60); }
      :root[data-theme='dark'] { --subject-biology: rgb(120, 220, 160); }
    `;
    document.head.appendChild(style);
    useSettingsStore.setState({ theme: 'light' });
    const { factory, made } = fakeRenderer();
    // As in the app: the theme is applied by a parent of the view.
    function Themed() {
      useApplyTheme();
      return <Mitosis3DView createRenderer={factory} />;
    }
    const membraneColour = () => {
      const calls = vi.mocked(made[0]!.render).mock.calls;
      const scene = calls[calls.length - 1]?.[0];
      let hex: number | null = null;
      scene?.traverse((o) => {
        if ((o.userData as { part?: string }).part === 'membrane' && o instanceof THREE.Mesh)
          hex = (o.material as THREE.MeshStandardMaterial).color.getHex();
      });
      return hex;
    };
    try {
      render(<Themed />);
      await waitFor(() => {
        expect(membraneColour()).toBe(new THREE.Color('rgb(10, 120, 60)').getHex());
      });
      act(() => {
        useSettingsStore.setState({ theme: 'dark' });
      });
      expect(document.documentElement.dataset.theme).toBe('dark');
      await waitFor(() => {
        expect(membraneColour()).toBe(new THREE.Color('rgb(120, 220, 160)').getHex());
      });
    } finally {
      style.remove();
      delete document.documentElement.dataset.theme;
      useSettingsStore.setState({ theme: 'system' });
    }
  });

  it('stage buttons: each accessible name contains the visible text (label in name)', () => {
    const { factory } = fakeRenderer();
    render(<Mitosis3DView createRenderer={factory} />);
    const strip = screen.getByRole('group', { name: 'Các kì' });
    const buttons = within(strip).getAllByRole('button');
    expect(buttons).toHaveLength(STAGES_3D.length);
    for (const b of buttons) {
      const visible = b.textContent.trim();
      expect(visible).not.toBe('');
      expect(within(strip).getAllByRole('button', { name: (n) => n.includes(visible) })).toContain(
        b,
      );
    }
  });

  it('with reduced motion, "Phát lại từ đầu" goes back to the start without playing', () => {
    const queries: string[] = [];
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => {
        queries.push(query);
        return {
          matches: query.includes('prefers-reduced-motion: reduce'),
          media: query,
          onchange: null,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          addListener: () => undefined,
          removeListener: () => undefined,
          dispatchEvent: () => false,
        };
      },
    });
    try {
      const { factory } = fakeRenderer();
      render(<Mitosis3DView createRenderer={factory} />);
      act(() => {
        useMitosis3D.setState({ t: 12, playing: false });
      });
      fireEvent.click(screen.getByRole('button', { name: 'Phát lại từ đầu' }));
      expect(useMitosis3D.getState()).toMatchObject({ t: 0, playing: false });
      expect(queries).toContain('(prefers-reduced-motion: reduce)');
      // Play still plays: the learner asked for it.
      fireEvent.click(screen.getByRole('button', { name: 'Phát' }));
      expect(useMitosis3D.getState().playing).toBe(true);
    } finally {
      delete (window as { matchMedia?: unknown }).matchMedia;
    }
  });

  it('zoom stays outside the cell and within the far limit; "Đặt lại góc nhìn" restores the view', async () => {
    const { factory, made } = fakeRenderer();
    render(<Mitosis3DView createRenderer={factory} />);
    const r = made[0]!;
    await waitFor(() => {
      expect(r.render).toHaveBeenCalled();
    });
    const cam = vi.mocked(r.render).mock.calls.at(-1)![1] as THREE.PerspectiveCamera;
    // Overview of the animal cell: the camera looks at the cell centre.
    const framed = cam.position.clone();
    // jsdom has no layout: the canvas is 1 × 1 px.
    const limits = placeCamera(cameraFrame('overview', null, 'animal'), 'animal', 1, 1);
    expect(framed.length()).toBeCloseTo(limits.distance, 6);
    const wheel = (deltaY: number) => {
      fireEvent.wheel(r.domElement, { deltaY, clientX: 0, clientY: 0 });
    };
    for (let k = 0; k < 100; k++) {
      wheel(-120);
      // Never inside the cell, at any moment of the division.
      expect(cam.position.length()).toBeGreaterThan(cellBound('animal'));
    }
    expect(cam.position.length()).toBeCloseTo(limits.min, 6);
    for (let k = 0; k < 100; k++) {
      wheel(120);
      expect(cam.position.length()).toBeLessThanOrEqual(limits.max + 1e-6);
    }
    expect(cam.position.length()).toBeCloseTo(limits.max, 6);
    // The camera glides back (a short smooth move), then is exactly where it was framed.
    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại góc nhìn' }));
    await waitFor(() => {
      expect(cam.position.distanceTo(framed)).toBeLessThan(1e-9);
    });
    // With reduced motion the view is restored at once.
    const restore = withReducedMotion();
    try {
      for (let k = 0; k < 20; k++) wheel(120);
      fireEvent.click(screen.getByRole('button', { name: 'Đặt lại góc nhìn' }));
      expect(cam.position.distanceTo(framed)).toBeLessThan(1e-9);
    } finally {
      restore();
    }
  });

  it('close-up: the camera follows the chromosomes as they spread out', async () => {
    const { factory, made } = fakeRenderer();
    render(<Mitosis3DView createRenderer={factory} />);
    const r = made[0]!;
    fireEvent.click(screen.getByRole('radio', { name: 'Cận cảnh NST' }));
    await waitFor(() => {
      expect(r.render).toHaveBeenCalled();
    });
    const cam = vi.mocked(r.render).mock.calls.at(-1)![1] as THREE.PerspectiveCamera;
    const tl = timelineFor(2, 'animal');
    const inView = () => {
      cam.updateMatrixWorld(true);
      const f = cameraFrame('closeup', tl.stateAt(useMitosis3D.getState().t), 'animal');
      const v = new THREE.Vector3();
      return f.points.every((p) => {
        v.set(f.center[0] + p[0], f.center[1] + p[1], f.center[2] + p[2]).project(cam);
        return Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1;
      });
    };
    expect(inView()).toBe(true);
    // Playback moves the time on: the close-up keeps every chromosome in view.
    for (const stage of ['metaphase', 'anaphase', 'telophase', 'cytokinesis'] as const) {
      for (const u of [0.2, 0.6, 1]) {
        const w = tl.stages.find((x) => x.id === stage)!;
        act(() => {
          useMitosis3D.setState({ t: w.start + u * (w.end - w.start) - 1e-6 });
        });
        expect(inView(), `${stage} u=${String(u)}`).toBe(true);
      }
    }
  });

  it('playback feeds raw frame times to the monitor, only while the page is visible', () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    const record = vi.spyOn(FrameMonitor.prototype, 'record');
    const { factory } = fakeRenderer();
    render(<Mitosis3DView createRenderer={factory} />);
    const flush = (now: number) => {
      const due = frames.splice(0);
      act(() => {
        for (const cb of due) cb(now);
      });
    };
    act(() => {
      useMitosis3D.setState({ playing: true });
    });
    // A slow frame (0.5 s): the monitor sees 0.5 s, playback moves at most 0.1 s.
    flush(1500);
    expect(record).toHaveBeenLastCalledWith(0.5);
    expect(useMitosis3D.getState().t).toBeCloseTo(0.1);
    // Hidden tab: no frame time is recorded, playback still advances by at most 0.1 s.
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    flush(4000);
    expect(record).toHaveBeenCalledTimes(1);
    expect(useMitosis3D.getState().t).toBeCloseTo(0.2);
    visibility.mockReturnValue('visible');
    flush(4016);
    expect(record).toHaveBeenCalledTimes(2);
    expect(record).toHaveBeenLastCalledWith(expect.closeTo(0.016, 6));
  });
});

describe('the module shows the 2D picture when 3D cannot be drawn', () => {
  const benchmark: BenchmarkResult = {
    cpuScore: 1,
    drawScore: 1,
    webgl2: true,
    cores: 4,
    tier: 'medium',
    measuredAt: '2026-10-14T00:00:00.000Z',
    durationMs: 1,
  };
  const stops: (() => void)[] = [];

  beforeEach(() => {
    gl.real = false;
    gl.made.length = 0;
    // WebGL 2 reported and Medium quality: the module starts with the 3D view.
    usePerfStore.setState({ preference: 'medium', benchmark, degraded: false });
    // jsdom has no canvas: the 2D picture draws nothing (its controls and table still work).
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  afterEach(() => {
    // Unmount first: resetting the quality would otherwise bring the 3D view back on screen.
    cleanup();
    for (const stop of stops.splice(0)) stop();
    gl.real = false;
    usePerfStore.setState({ preference: 'auto', benchmark: null, degraded: false });
  });

  /** Stage, inspector panel and bottom table, as the module shows them (3D view lazy-loaded). */
  function renderModule() {
    // Every time the 3D view comes on or goes off screen.
    const shown: boolean[] = [];
    stops.push(
      useMitosis3D.subscribe((s, prev) => {
        if (s.active !== prev.active) shown.push(s.active);
      }),
    );
    const view = render(
      <>
        <MitosisStage />
        <MitosisPanel />
        <MitosisBottom />
      </>,
    );
    return { ...view, shown };
  }

  function expect2dPicture(container: HTMLElement, notice: RegExp) {
    expect(container.querySelector('.m3d')).toBeNull();
    expect(container.querySelector('canvas.chem-canvas')).not.toBeNull();
    expect(screen.getByText(notice)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bước tiếp theo' })).toBeEnabled();
    // 3D is still the learner's choice (the switch shows it); it just cannot be drawn.
    expect(screen.getByRole('radio', { name: '3D' })).toHaveAttribute('aria-checked', 'true');
    expect(useDivisionStore.getState().view3d).toBe(true);
    expect(useMitosis3D.getState().active).toBe(false);
    // Inspector without the 3D parts list; the 2D table (6 stages, no nuclei column).
    expect(screen.queryByRole('group', { name: 'Bộ phận tế bào' })).toBeNull();
    const table = screen.getByRole('table');
    expect(within(table).queryByRole('columnheader', { name: 'Số nhân / tế bào' })).toBeNull();
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((th) => th.textContent),
    ).toEqual(STAGES.mitosis.map((s) => STAGE_NAME[s].vi));
    expect(screen.getByText(`${String(STAGES.mitosis.length)} giai đoạn`)).toBeInTheDocument();
  }

  it('the real WebGL renderer cannot start: the 3D view hands over to the 2D picture', async () => {
    gl.real = true;
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { container, shown } = renderModule();
    await screen.findByText(/Máy này chưa vẽ được 3D/);
    expect(useMitosis3D.getState().webglFailed).toBe(true);
    // The 3D view was on screen first (it is what failed), then the 2D picture replaced it.
    expect(shown).toEqual([true, false]);
    expect(errors.mock.calls.flat().join(' ')).toMatch(/Error creating WebGL context/);
    expect2dPicture(container, /Máy này chưa vẽ được 3D \(WebGL\), nên dùng hình 2D/);
  });

  it('the GPU context is lost while 3D is shown: the 2D picture takes over', async () => {
    // The 3D view is at metaphase; the 2D index is still the G1 left from before.
    useMitosis3D.setState({ t: timelineFor(2, 'animal').keyTime('metaphase') });
    expect(useDivisionStore.getState().index).toBe(0);
    const { container, shown } = renderModule();
    await waitFor(() => {
      expect(container.querySelector('.m3d canvas')).not.toBeNull();
    });
    // The 3D view: its parts list and its seven-step table with the nuclei column.
    expect(shown).toEqual([true]);
    expect(screen.getByRole('group', { name: 'Bộ phận tế bào' })).toBeInTheDocument();
    const table3d = screen.getByRole('table');
    expect(
      within(table3d).getByRole('columnheader', { name: 'Số nhân / tế bào' }),
    ).toBeInTheDocument();
    expect(within(table3d).getAllByRole('rowheader')).toHaveLength(STAGES_3D.length);
    expect(gl.made).toHaveLength(1);
    const r = gl.made[0]!;
    expect(container.querySelector('.m3d canvas')).toBe(r.canvas);
    act(() => {
      useMitosis3D.setState({ playing: true });
    });
    act(() => {
      r.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    });
    await screen.findByText(/Máy này chưa vẽ được 3D/);
    expect(useMitosis3D.getState()).toMatchObject({ webglFailed: true, playing: false });
    expect(shown).toEqual([true, false]);
    // The lost renderer is released and its canvas removed; no new one is tried.
    expect(r.disposed).toBe(1);
    expect(r.canvas.isConnected).toBe(false);
    expect(gl.made).toHaveLength(1);
    expect2dPicture(container, /Máy này chưa vẽ được 3D \(WebGL\), nên dùng hình 2D/);
    // The 2D picture opens at the stage the 3D view was showing.
    expect(useDivisionStore.getState().index).toBe(STAGES.mitosis.indexOf('metaphase'));
    expect(screen.getByText('Kì giữa', { selector: 'strong' })).toBeInTheDocument();
  });

  it('sustained overload at Medium: the 2D picture at the 3D stage, without blaming a Low setting', async () => {
    const tl = timelineFor(2, 'animal');
    useMitosis3D.setState({ t: tl.keyTime('anaphase') });
    const { container, shown } = renderModule();
    await waitFor(() => {
      expect(container.querySelector('.m3d canvas')).not.toBeNull();
    });
    // From here on, animation frames run only when the test says so, 50 ms apart (slower than
    // the 3D budget of 1/30 s plus 20 % tolerance).
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    act(() => {
      useMitosis3D.setState({ playing: true });
    });
    for (let k = 0; k < 60 && container.querySelector('.m3d'); k++) {
      now += 50;
      const due = frames.splice(0);
      act(() => {
        for (const cb of due) cb(now);
      });
    }
    // The app lowered the quality by itself (Medium → Low draws 2D).
    expect(usePerfStore.getState()).toMatchObject({ preference: 'medium', degraded: true });
    expect(shown).toEqual([true, false]);
    expect(container.querySelector('.m3d')).toBeNull();
    const notice = await screen.findByText(/chạy chậm/);
    expect(notice).not.toHaveTextContent(/Thấp/);
    expect(screen.queryByText(/chất lượng hiển thị Thấp/)).toBeNull();
    // The 2D picture shows the stage the 3D playback had reached.
    const stage = tl.stageAt(useMitosis3D.getState().t).stage;
    expect(stage).toBe('telophase');
    expect(useDivisionStore.getState().index).toBe(index2dOf(stage));
    expect(screen.getByText('Kì cuối', { selector: 'strong' })).toBeInTheDocument();
  });

  it('display quality Low: the 2D picture with its notice; the 3D view never starts', () => {
    usePerfStore.setState({ preference: 'low' });
    const { container, shown } = renderModule();
    expect2dPicture(container, /Đang ở chất lượng hiển thị Thấp nên dùng hình 2D/);
    expect(shown).toEqual([]);
    expect(gl.made).toHaveLength(0);
  });
});

describe('3D / 2D switch keeps the stage', () => {
  beforeEach(() => {
    // jsdom has no 2D canvas: the 2D stage draws nothing (its controls still work).
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  const next = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Bước tiếp theo' }));
  };

  it('maps every 3D stage to a 2D stage and back', () => {
    expect(STAGES_3D.map((s) => STAGES.mitosis[index2dOf(s)])).toEqual([
      'g1',
      'g2',
      'prophase',
      'metaphase',
      'anaphase',
      'telophase',
      'telophase',
    ]);
    // The 2D telophase (two daughter cells, 2n each) is the end of cytokinesis in 3D.
    expect(STAGES.mitosis.map((_, i) => stage3dOf(i))).toEqual([
      'g1',
      'g2',
      'prophase',
      'metaphase',
      'anaphase',
      'cytokinesis',
    ]);
  });

  it('3D → 2D → 3D, also after a meiosis visit', () => {
    const tl = timelineFor(2, 'animal');
    // The meiosis view writes its own stage index first.
    const meiosis = render(<DivisionStage kind="meiosis" />);
    for (let k = 0; k < 3; k++) next();
    expect(useDivisionStore.getState().index).toBe(3);
    meiosis.unmount();
    // Mitosis in 3D at anaphase → 2D.
    act(() => {
      useMitosis3D.setState({ t: tl.keyTime('anaphase') });
    });
    const { factory } = fakeRenderer();
    const view = render(<Mitosis3DView createRenderer={factory} />);
    fireEvent.click(screen.getByRole('radio', { name: '2D' }));
    expect(useDivisionStore.getState()).toMatchObject({
      view3d: false,
      index: STAGES.mitosis.indexOf('anaphase'),
    });
    view.unmount();
    // The 2D mitosis view keeps that stage (the meiosis visit does not reset it).
    render(<DivisionStage kind="mitosis" toolbar={<Mitosis3DSwitch />} />);
    expect(useDivisionStore.getState().index).toBe(STAGES.mitosis.indexOf('anaphase'));
    expect(screen.getByText('Kì sau', { selector: 'strong' })).toBeInTheDocument();
    // 2D telophase → 3D: the end of cytokinesis (two daughter cells).
    next();
    fireEvent.click(screen.getByRole('radio', { name: '3D' }));
    expect(useDivisionStore.getState().view3d).toBe(true);
    expect(useMitosis3D.getState().t).toBe(tl.keyTime('cytokinesis'));
  });

  it('3D telophase → 2D telophase', () => {
    const tl = timelineFor(2, 'animal');
    act(() => {
      useMitosis3D.setState({ t: tl.keyTime('telophase') });
    });
    const { factory } = fakeRenderer();
    render(<Mitosis3DView createRenderer={factory} />);
    fireEvent.click(screen.getByRole('radio', { name: '2D' }));
    expect(useDivisionStore.getState().index).toBe(STAGES.mitosis.indexOf('telophase'));
  });

  it('2D → 3D ignores a stage index left by the meiosis view', () => {
    setDivisionState('mitosis', { view3d: false, index: 4 });
    const meiosis = render(<DivisionStage kind="meiosis" />);
    // The meiosis view starts at its first stage, then the learner steps on.
    expect(useDivisionStore.getState().index).toBe(0);
    for (let k = 0; k < 5; k++) next();
    meiosis.unmount();
    render(<Mitosis3DSwitch />);
    fireEvent.click(screen.getByRole('radio', { name: '3D' }));
    expect(useMitosis3D.getState().t).toBe(timelineFor(2, 'animal').keyTime('g1'));
  });

  it('the 2D fallback (3D on but not drawable) keeps its own stage when 2D is picked', () => {
    const tl = timelineFor(2, 'animal');
    // An old 3D time from an earlier visit; the 3D view is not on screen.
    useMitosis3D.setState({ t: tl.keyTime('anaphase'), active: false });
    render(<DivisionStage kind="mitosis" toolbar={<Mitosis3DSwitch />} />);
    for (let k = 0; k < 3; k++) next();
    expect(useDivisionStore.getState().index).toBe(STAGES.mitosis.indexOf('metaphase'));
    fireEvent.click(screen.getByRole('radio', { name: '2D' }));
    expect(useDivisionStore.getState()).toMatchObject({
      view3d: false,
      index: STAGES.mitosis.indexOf('metaphase'),
    });
  });
});
