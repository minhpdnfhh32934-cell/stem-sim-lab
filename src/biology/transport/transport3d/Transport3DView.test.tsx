import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import type { BenchmarkResult } from '@/perf/benchmark';
import { usePerfStore } from '@/perf/perfStore';
import type { RendererLike } from '@/ui/three/renderer';
import { fakeRenderer } from '@/ui/three/testing';
import { diffusionOsmosis } from '../../modules';
import { resetWebgl2Cache } from '../../view3d/support';
import { MOTION } from '../../view3d/texts';
import { osmosisData } from '../osmosisData';
import { useTransport } from '../store';
import { DiffusionOsmosisPanel, DiffusionOsmosisStage } from '../TransportViews';
import {
  BLOCKED_NOTE,
  DIFFUSION_ILLUSTRATION,
  OSMOSIS_SCALE_NOTE,
  PORES_NOTE,
  SCALE_NOTE,
  SOLUTE_NOTE,
  VOLUME_NOTE,
  WATER_NOTE,
  diffusionCard3d,
  osmosisCard3d,
} from './components';
import { diffusionFrameAt, diffusionModel3d } from './diffusion';
import { osmosisFrameAt, osmosisModel3d } from './osmosis';
import { useTransport3D } from './store';
import { Transport3DView } from './Transport3DView';

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

const DEFAULTS = useTransport.getInitialState();
const DIFF = {
  particles: 160,
  pores: 4,
  c1: 10,
  c2: 0,
  v1: 1,
  v2: 1,
  pa: 0.2,
  run: 0,
};

beforeEach(() => {
  useTransport.setState(DEFAULTS);
  useTransport3D.setState({
    t: 0,
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
const counts = () => document.querySelector('.tr3d__counts')?.textContent ?? '';
const readout = () => document.querySelector('.bio3d__player output')?.textContent ?? '';
const vi10 = (v: number, d = 3) =>
  new Intl.NumberFormat('vi-VN', { maximumSignificantDigits: d }).format(v);

describe('Transport3DView — diffusion', () => {
  it('controls with accessible names; counts, readout and the picture’s words come from the model', () => {
    const { factory } = fakeRenderer();
    render(<Transport3DView createRenderer={factory} />);
    for (const name of ['Đặt lại góc nhìn', 'Hiện tên', 'Phát', 'Chạy lại'])
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    for (const name of ['3D', '2D', 'Khuếch tán', 'Thẩm thấu'])
      expect(screen.getByRole('radio', { name })).toBeInTheDocument();
    const m = diffusionModel3d(DIFF);
    expect(screen.getByRole('slider', { name: 'Thời gian' })).toHaveAttribute(
      'max',
      String(m.tEnd),
    );
    expect(counts()).toBe('Ngăn 1: 160 hạt · Ngăn 2: 0 hạt');
    expect(readout()).toBe('t = 0 phút · C₁ = 10 mM · C₂ = 0 mM');
    // 10 mM × 1 mL = 10 µmol over 160 particles.
    expect(screen.getByText('1 hạt ≈ 0,0625 µmol')).toBeInTheDocument();
    expect(caption()).toContain(DIFFUSION_ILLUSTRATION.vi);
    expect(caption()).toContain(VOLUME_NOTE.vi);
    expect(caption()).toContain(SCALE_NOTE.vi);
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      'Hộp hai ngăn (V₁ : V₂ = 1 : 1) ngăn bởi màng có 4 lỗ. t = 0 phút: ngăn 1 có 160 hạt, ngăn 2 có 0 hạt.',
    );
    expect(useTransport3D.getState().active).toBe(true);
  });

  it('the time slider: each side’s count is Fick’s law at that t', () => {
    const { factory } = fakeRenderer();
    render(<Transport3DView createRenderer={factory} />);
    const m = diffusionModel3d(DIFF);
    for (const t of [0.5, 2, 5, m.tEnd]) {
      fireEvent.change(screen.getByRole('slider', { name: 'Thời gian' }), {
        target: { value: String(t) },
      });
      const f = diffusionFrameAt(m, t);
      expect(f.n1 + f.n2).toBe(160);
      expect(counts()).toBe(`Ngăn 1: ${String(f.n1)} hạt · Ngăn 2: ${String(f.n2)} hạt`);
      expect(readout()).toContain(`C₁ = ${vi10(f.c1)} mM`);
    }
    // At the end of the range (5 time constants) both sides are nearly equal.
    expect(Math.abs(diffusionFrameAt(m, m.tEnd).n1 - 80)).toBeLessThanOrEqual(1);
  });

  it('picked parts: a compartment’s C and count, a pore, the membrane, a particle', () => {
    const { factory } = fakeRenderer();
    render(<Transport3DView createRenderer={factory} />);
    const m = diffusionModel3d(DIFF);
    act(() => {
      useTransport3D.setState({ t: 2, selected: { kind: 'compartment', side: 1 } });
    });
    const f = diffusionFrameAt(m, 2);
    const card = screen.getByRole('complementary');
    expect(card).toHaveTextContent('Ngăn 1');
    expect(card).toHaveTextContent(
      `Lúc t = 2 phút: C₁ = ${vi10(f.c1)} mM (định luật Fick); trên hình ${String(f.n1)} hạt.`,
    );
    expect(card).toHaveTextContent('Cân bằng: C₁ = C₂ = 5 mM');
    act(() => {
      useTransport3D.setState({ selected: { kind: 'pore', index: 2 } });
    });
    expect(card).toHaveTextContent('Lỗ màng 3/4');
    expect(card).toHaveTextContent(`${String(f.crossed)} hạt đã qua màng`);
    expect(card).toHaveTextContent(PORES_NOTE.vi);
    act(() => {
      useTransport3D.setState({ selected: { kind: 'membrane' } });
    });
    expect(card).toHaveTextContent('Mô hình Fick dùng PA = 0,2 mL/phút');
    act(() => {
      useTransport3D.setState({ selected: { kind: 'particle', index: 0 } });
    });
    // Particle 1 is the first to cross (from side 1).
    expect(card).toHaveTextContent('Đã qua màng từ ngăn 1 sang ngăn 2');
    expect(card).toHaveTextContent('≈ 0,0625 µmol');
    fireEvent.click(within(card).getByRole('button', { name: 'Bỏ chọn' }));
    expect(useTransport3D.getState().selected).toBeNull();
  });

  it('no pore: the counts stay and the notice says why', () => {
    useTransport.setState({ pores: 0 });
    const { factory } = fakeRenderer();
    render(<Transport3DView createRenderer={factory} />);
    act(() => {
      useTransport3D.setState({ t: 5 });
    });
    expect(counts()).toBe('Ngăn 1: 160 hạt · Ngăn 2: 0 hạt');
    expect(screen.getByText(BLOCKED_NOTE.vi)).toHaveAttribute('role', 'status');
  });

  it('play from the end starts again; "Chạy lại" plays from t = 0; Basic hides the scale', () => {
    const { factory } = fakeRenderer();
    const { unmount } = render(<Transport3DView createRenderer={factory} />);
    const m = diffusionModel3d(DIFF);
    act(() => {
      useTransport3D.setState({ t: m.tEnd });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Phát' }));
    expect(useTransport3D.getState()).toMatchObject({ playing: true, t: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Tạm dừng' }));
    act(() => {
      useTransport3D.setState({ t: 3 });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Chạy lại' }));
    expect(useTransport.getState().run).toBe(1);
    expect(useTransport3D.getState()).toMatchObject({ playing: true, t: 0 });
    unmount();
    useSettingsStore.setState({ uiMode: 'basic' });
    render(<Transport3DView createRenderer={fakeRenderer().factory} />);
    expect(screen.queryByText(/µmol/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Hiện tên' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('frees its renderer on unmount', () => {
    const { factory, made } = fakeRenderer();
    const { unmount } = render(<Transport3DView createRenderer={factory} />);
    expect(made).toHaveLength(1);
    unmount();
    expect(made[0]?.dispose).toHaveBeenCalled();
    expect(useTransport3D.getState().active).toBe(false);
  });
});

describe('Transport3DView — osmosis', () => {
  it('heights, Δh and Π from the model; a column’s and the membrane’s cards', () => {
    const { factory } = fakeRenderer();
    render(<Transport3DView createRenderer={factory} />);
    act(() => {
      useTransport3D.setState({ t: 1, selected: { kind: 'pore', index: 0 } });
    });
    // The other process starts at t = 0 with nothing picked.
    fireEvent.click(screen.getByRole('radio', { name: 'Thẩm thấu' }));
    expect(useTransport3D.getState()).toMatchObject({ t: 0, selected: null });
    expect(screen.getByText(/Π₀ = iC₀RT/)).toBeInTheDocument();
    const m = osmosisModel3d(osmosisData(DEFAULTS));
    const slider = screen.getByRole('slider', { name: 'Thời gian' });
    expect(slider).toHaveAttribute('max', String(m.tEnd));
    expect(slider).toHaveAttribute('step', String(m.tEnd / 240));
    const t = m.traj.t[120] ?? 0;
    fireEvent.change(slider, { target: { value: String(t) } });
    const f = osmosisFrameAt(m, t);
    expect(readout()).toBe(
      `t = ${vi10(f.t)} s · h_L = ${vi10(f.hL * 100)} cm · h_R = ${vi10(f.hR * 100)} cm · Δh = ${vi10(f.dh * 100)} cm`,
    );
    act(() => {
      useTransport3D.setState({ selected: { kind: 'column', side: 'solution' } });
    });
    const card = screen.getByRole('complementary');
    expect(card).toHaveTextContent('Cột dung dịch (nhánh trái)');
    expect(card).toHaveTextContent(`Nồng độ C = C₀h₀/h_L = ${vi10(f.c)} mM`);
    expect(card).toHaveTextContent(`Π = iCRT = ${vi10(f.pi / 1000)} kPa`);
    expect(card).toHaveTextContent(`Cân bằng (mô hình): Δh = ${vi10(m.eq.dh * 100)} cm`);
    act(() => {
      useTransport3D.setState({ selected: { kind: 'membrane' } });
    });
    expect(card).toHaveTextContent('Màng bán thấm');
    expect(card).toHaveTextContent('giữ chất tan lại');
    act(() => {
      useTransport3D.setState({ selected: { kind: 'solute', index: 4 } });
    });
    expect(card).toHaveTextContent(SOLUTE_NOTE.vi);
    expect(caption()).toContain(OSMOSIS_SCALE_NOTE.vi);
    expect(caption()).toContain(WATER_NOTE.vi);
  });
});

describe('3D Science Cards', () => {
  it('diffusion: Fick counts, the illustration notes, pores not in the model, sources', () => {
    const card = diffusionCard3d();
    const text = card.assumptions.map((a) => a.vi).join(' ');
    expect(card.title.vi).toBe('Khuếch tán qua màng 3D');
    for (const note of [DIFFUSION_ILLUSTRATION, SCALE_NOTE, VOLUME_NOTE, PORES_NOTE, MOTION])
      expect(text).toContain(note.vi);
    expect(text).not.toContain('không được dùng để đọc kết quả');
    expect(card.equations.map((e) => e.tex).join(' ')).toContain('N_1(t)');
    expect(card.confidence).toBe('exact');
    expect(card.reviewStatus).toBe('pending');
    expect(card.sources.map((x) => x.id)).toEqual(expect.arrayContaining(['sgk-sh10', 'atkins']));
  });

  it('osmosis: heights to scale, water and solute notes', () => {
    const card = osmosisCard3d();
    const text = card.assumptions.map((a) => a.vi).join(' ');
    expect(card.title.vi).toContain('Thẩm thấu');
    for (const note of [OSMOSIS_SCALE_NOTE, WATER_NOTE, SOLUTE_NOTE])
      expect(text).toContain(note.vi);
    expect(card.reviewStatus).toBe('pending');
  });
});

describe('the lesson: 3D by default, 2D on request or when 3D cannot be drawn', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  const renderLesson = () =>
    render(
      <>
        <DiffusionOsmosisStage />
        <DiffusionOsmosisPanel />
      </>,
    );

  it('3D ↔ 2D is the lesson store’s saved switch', async () => {
    const { container } = renderLesson();
    await waitFor(() => {
      expect(container.querySelector('.tr3d canvas')).not.toBeNull();
    });
    fireEvent.click(screen.getByRole('radio', { name: '2D' }));
    expect(container.querySelector('.tr3d')).toBeNull();
    expect(useTransport.getState().view3d).toBe(false);
    expect(diffusionOsmosis.state?.get()).toMatchObject({ view3d: false });
    expect(container.querySelector('canvas.chem-canvas')).not.toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: '3D' }));
    await waitFor(() => {
      expect(container.querySelector('.tr3d canvas')).not.toBeNull();
    });
    // Restoring a file sets the switch too.
    act(() => {
      diffusionOsmosis.state?.set({ view3d: false });
    });
    expect(container.querySelector('.tr3d')).toBeNull();
  });

  it('display quality Low: the 2D pictures with the notice; the 3D view never starts', () => {
    usePerfStore.setState({ preference: 'low' });
    const { container } = renderLesson();
    expect(container.querySelector('.tr3d')).toBeNull();
    expect(
      screen.getByText(/Đang ở chất lượng hiển thị Thấp nên dùng hình 2D/),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '3D' })).toHaveAttribute('aria-checked', 'true');
    expect(gl.made).toHaveLength(0);
  });

  it('the GPU context is lost: the 2D pictures take over', async () => {
    const { container } = renderLesson();
    await waitFor(() => {
      expect(container.querySelector('.tr3d canvas')).not.toBeNull();
    });
    const r = gl.made[0]!;
    act(() => {
      r.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    });
    await screen.findByText(/Máy này chưa vẽ được 3D/);
    expect(r.disposed).toBe(1);
    expect(container.querySelector('canvas.chem-canvas')).not.toBeNull();
    act(() => {
      useTransport3D.setState({ webglFailed: false });
    });
  });
});
