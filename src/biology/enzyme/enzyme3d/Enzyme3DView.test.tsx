import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import type { BenchmarkResult } from '@/perf/benchmark';
import { usePerfStore } from '@/perf/perfStore';
import type { RendererLike } from '@/ui/three/renderer';
import { fakeRenderer } from '@/ui/three/testing';
import { michaelisMenten } from '../../modules';
import { resetWebgl2Cache } from '../../view3d/support';
import { MichaelisMentenPanel, MichaelisMentenStage } from '../EnzymeViews';
import { useEnzyme } from '../store';
import { enzymeModel3d, formsOf, frameAt } from './binding';
import {
  ENZYME_ILLUSTRATION,
  ENZYME_SCALE_NOTE,
  LOCK_KEY_NOTE,
  LOCK_KEY_SHORT,
  SAMPLE_NOTE,
  enzymeCard3d,
} from './components';
import { Enzyme3DView } from './Enzyme3DView';
import { useEnzyme3D } from './store';

// The 2D charts' plot library is not under test here (it needs matchMedia and a canvas).
vi.mock('@/ui/charts/uplot', () => ({
  SERIES_VARS: ['--chart-1'],
  loadUPlot: () => new Promise(() => undefined),
}));

/**
 * jsdom has no WebGL: the view's own renderer factory gets a stand-in until its canvas fires
 * 'webglcontextlost'. Tests that pass `createRenderer` are not affected.
 */
const gl = vi.hoisted(() => ({
  made: [] as { canvas: HTMLCanvasElement; disposed: number }[],
}));
vi.mock('three', async (importOriginal) => {
  const three = await importOriginal<typeof THREE>();
  function WebGLRenderer(): RendererLike {
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

const benchmark: BenchmarkResult = {
  cpuScore: 1,
  drawScore: 1,
  webgl2: true,
  cores: 4,
  tier: 'medium',
  measuredAt: '2026-10-20T00:00:00.000Z',
  durationMs: 1,
};

const DEFAULTS = {
  vmax: 10,
  km: 2,
  kind: 'competitive' as const,
  inhibitor: 2,
  ki: 1,
  s0: 10,
  view: 'rate' as const,
  view3d: true,
};

beforeEach(() => {
  useEnzyme.setState(DEFAULTS);
  useEnzyme3D.setState({
    t: 0,
    s: null,
    playing: false,
    selected: null,
    camera: 'overview',
    viewNonce: 0,
    webglFailed: false,
    active: false,
    labels: null,
  });
  useSettingsStore.setState({ uiMode: 'advanced', locale: 'vi' });
  usePerfStore.setState({ preference: 'medium', benchmark, degraded: false });
  resetWebgl2Cache();
  gl.made.length = 0;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  usePerfStore.setState({ preference: 'auto', benchmark: null, degraded: false });
  resetWebgl2Cache();
});

const caption = () => document.querySelector('.m3d__caption')?.textContent ?? '';
const counts = () => document.querySelector('.enz3d__counts')?.textContent ?? '';
/** The default moment: competitive, [S] cursor at the apparent Km = 6 mM. */
const defaultFrame = () => frameAt(enzymeModel3d(DEFAULTS), 6);

describe('Enzyme3DView', () => {
  it('controls with accessible names; counts, scale and the picture’s words come from the model', () => {
    const { factory } = fakeRenderer();
    render(<Enzyme3DView createRenderer={factory} />);
    for (const name of ['Đặt lại góc nhìn', 'Hiện tên và dạng enzyme', 'Phát'])
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    for (const name of ['3D', '2D', 'Toàn cảnh', 'Cận cảnh enzyme', 'v theo [S]'])
      expect(screen.getByRole('radio', { name })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Nồng độ cơ chất [S]' })).toHaveValue('6');
    // [S] = 6 mM = Km_app: v = Vmax/2 → 12 of 24 enzymes hold substrate; E : EI = 1 : 2.
    expect(counts()).toBe('ES 12 · EI 8 · tự do 4');
    expect(screen.getByText('1 hạt = 0,2 mM')).toBeInTheDocument();
    expect(screen.getByText('[S] = 6 mM · v = 5 mM/phút')).toBeInTheDocument();
    expect(caption()).toContain(ENZYME_ILLUSTRATION.vi);
    expect(caption()).toContain(ENZYME_SCALE_NOTE.vi);
    expect(caption()).toContain(LOCK_KEY_SHORT.vi);
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      'Thể tích phản ứng với 24 enzyme (mẫu đại diện): ES 12 · EI 8 · tự do 4. [S] = 6 mM · v = 5 mM/phút. 30 hạt cơ chất (1 hạt = 0,2 mM).',
    );
    expect(useEnzyme3D.getState().active).toBe(true);
  });

  it('the [S] cursor: the forms follow v/Vmax; the cursor never leaves the plot’s range', () => {
    const { factory } = fakeRenderer();
    render(<Enzyme3DView createRenderer={factory} />);
    fireEvent.change(screen.getByRole('slider', { name: 'Nồng độ cơ chất [S]' }), {
      target: { value: '20' },
    });
    expect(useEnzyme3D.getState().s).toBe(20);
    // s = 10, i = 2: ES = round(24 · 10/13) = 18; E : EI = 1 : 2 of the other 6.
    expect(counts()).toBe('ES 18 · EI 4 · tự do 2');
    act(() => {
      useEnzyme.setState({ kind: 'noncompetitive' });
    });
    // v/Vmax = s/((1+s)(1+i)) = 10/33 → 7; E : EI : ESI = 1 : 2 : 20 of 17.
    expect(counts()).toBe('ES 7 · EI 1 · ESI 15 · tự do 1');
  });

  it('a picked enzyme: its form and the model’s share; a particle: its kind and the scale', () => {
    const { factory } = fakeRenderer();
    render(<Enzyme3DView createRenderer={factory} />);
    const forms = formsOf(defaultFrame().counts);
    act(() => {
      useEnzyme3D.setState({ selected: { kind: 'enzyme', index: forms.indexOf('ES') } });
    });
    const card = screen.getByRole('complementary');
    expect(card).toHaveTextContent('Phức hợp enzyme – cơ chất (ES)');
    expect(card).toHaveTextContent(
      'Theo mô hình, ở [S] = 6 mM: 50 % số enzyme ở dạng ES; trên hình 12/24 enzyme.',
    );
    expect(card).toHaveTextContent('làm tròn(24 × 5/10) = 12 enzyme ES.');
    expect(card).toHaveTextContent(LOCK_KEY_NOTE.vi);
    act(() => {
      useEnzyme3D.setState({ selected: { kind: 'enzyme', index: forms.indexOf('EI') } });
    });
    expect(card).toHaveTextContent('Chất ức chế cạnh tranh chiếm trung tâm hoạt động');
    expect(card).toHaveTextContent('33,3 % số enzyme ở dạng EI; trên hình 8/24 enzyme.');
    act(() => {
      useEnzyme3D.setState({ selected: { kind: 'particle', pool: 'sp', index: 0 } });
    });
    expect(card).toHaveTextContent('Hạt cơ chất (S)');
    expect(card).toHaveTextContent('[S] = 6 mM → 30 hạt (1 hạt = 0,2 mM).');
    act(() => {
      useEnzyme3D.setState({ selected: { kind: 'particle', pool: 'i', index: 2 } });
    });
    expect(card).toHaveTextContent('Hạt chất ức chế (I)');
    expect(card).toHaveTextContent('[I] = 2 mM, Kᵢ = 1 mM → 10 hạt (1 hạt = 0,2 mM).');
    fireEvent.click(within(card).getByRole('button', { name: 'Bỏ chọn' }));
    expect(useEnzyme3D.getState().selected).toBeNull();
  });

  it('time view: the time slider; S + P particles stay [S]₀’s; a product particle’s card', () => {
    useEnzyme.setState({ view: 'time' });
    const { factory } = fakeRenderer();
    render(<Enzyme3DView createRenderer={factory} />);
    const m = enzymeModel3d({ ...DEFAULTS, view: 'time' });
    expect(m.pool0).toBe(100);
    const slider = screen.getByRole('slider', { name: 'Thời gian' });
    expect(slider).toHaveAttribute('max', String(m.tEnd));
    fireEvent.change(slider, { target: { value: String(m.tEnd / 2) } });
    const f = frameAt(m, m.tEnd / 2);
    expect(f.particles.S + f.particles.P).toBe(100);
    act(() => {
      useEnzyme3D.setState({ selected: { kind: 'particle', pool: 'sp', index: 99 } });
    });
    const card = screen.getByRole('complementary');
    expect(card).toHaveTextContent('Hạt sản phẩm (P)');
    expect(card).toHaveTextContent(
      `→ ${String(f.particles.P)} hạt; S + P = 100 hạt (1 hạt = 0,1 mM).`,
    );
    expect(caption()).toContain('S + P không đổi');
    // Play from the end starts again at 0.
    act(() => {
      useEnzyme3D.setState({ t: m.tEnd });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Phát' }));
    expect(useEnzyme3D.getState()).toMatchObject({ playing: true, t: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Tạm dừng' }));
    expect(useEnzyme3D.getState().playing).toBe(false);
  });

  it('Basic mode: no camera choice; names and forms on', () => {
    useSettingsStore.setState({ uiMode: 'basic' });
    const { factory } = fakeRenderer();
    render(<Enzyme3DView createRenderer={factory} />);
    expect(screen.queryByRole('radio', { name: 'Cận cảnh enzyme' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Hiện tên và dạng enzyme' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('frees its renderer on unmount', () => {
    const { factory, made } = fakeRenderer();
    const { unmount } = render(<Enzyme3DView createRenderer={factory} />);
    expect(made).toHaveLength(1);
    unmount();
    expect(made[0]?.dispose).toHaveBeenCalled();
    expect(useEnzyme3D.getState().active).toBe(false);
  });
});

describe('3D Science Card', () => {
  it('adds the fractions drawn, the illustration and cartoon notes, and the sources', () => {
    const card = enzymeCard3d();
    const text = card.assumptions.map((a) => a.vi).join(' ');
    expect(card.title.vi).toBe('Động học enzyme 3D');
    for (const note of [ENZYME_ILLUSTRATION, ENZYME_SCALE_NOTE, LOCK_KEY_NOTE, SAMPLE_NOTE])
      expect(text).toContain(note.vi);
    expect(text).toContain('S + P luôn bằng số hạt lúc đầu');
    expect(card.equations.map((e) => e.tex).join(' ')).toContain('k_{cat}[ES]');
    expect(card.confidence).toBe('exact');
    expect(card.reviewStatus).toBe('pending');
    expect(card.sources.map((x) => x.id)).toEqual(
      expect.arrayContaining(['cornish-bowden', 'schnell-mendoza', 'sgk-sh10']),
    );
  });
});

describe('the lesson: 3D by default, 2D on request or when 3D cannot be drawn', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  const renderLesson = () =>
    render(
      <>
        <MichaelisMentenStage />
        <MichaelisMentenPanel />
      </>,
    );

  it('3D ↔ 2D is the lesson store’s saved switch', async () => {
    const { container } = renderLesson();
    await waitFor(() => {
      expect(container.querySelector('.enz3d canvas')).not.toBeNull();
    });
    fireEvent.click(screen.getByRole('radio', { name: '2D' }));
    expect(container.querySelector('.enz3d')).toBeNull();
    expect(useEnzyme.getState().view3d).toBe(false);
    expect(michaelisMenten.state?.get()).toMatchObject({ view3d: false });
    expect(container.querySelector('.bio-stage-chart')).not.toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: '3D' }));
    await waitFor(() => {
      expect(container.querySelector('.enz3d canvas')).not.toBeNull();
    });
    // Restoring a file sets the switch too.
    act(() => {
      michaelisMenten.state?.set({ view3d: false });
    });
    expect(container.querySelector('.enz3d')).toBeNull();
  });

  it('display quality Low: the 2D plots with the notice; the 3D view never starts', () => {
    usePerfStore.setState({ preference: 'low' });
    const { container } = renderLesson();
    expect(container.querySelector('.enz3d')).toBeNull();
    expect(
      screen.getByText(/Đang ở chất lượng hiển thị Thấp nên dùng hình 2D/),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '3D' })).toHaveAttribute('aria-checked', 'true');
    expect(gl.made).toHaveLength(0);
  });

  it('the GPU context is lost: the 2D plots take over', async () => {
    const { container } = renderLesson();
    await waitFor(() => {
      expect(container.querySelector('.enz3d canvas')).not.toBeNull();
    });
    const r = gl.made[0]!;
    act(() => {
      r.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    });
    await screen.findByText(/Máy này chưa vẽ được 3D/);
    expect(r.disposed).toBe(1);
    expect(container.querySelector('.bio-stage-chart')).not.toBeNull();
    act(() => {
      useEnzyme3D.setState({ webglFailed: false });
    });
  });
});
