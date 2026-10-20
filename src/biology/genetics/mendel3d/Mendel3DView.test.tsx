import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import type { BenchmarkResult } from '@/perf/benchmark';
import { usePerfStore } from '@/perf/perfStore';
import type { RendererLike } from '@/ui/three/renderer';
import { fakeRenderer } from '@/ui/three/testing';
import { mendel } from '../../modules';
import { resetWebgl2Cache } from '../../view3d/support';
import { MendelPanel, MendelStage } from '../GeneticsViews';
import { mendelDraw } from '../mendelRun';
import { useMendel } from '../store';
import { MENDEL_TOTAL, stepEnd } from './binding';
import { COLOUR_NOTE, MENDEL_ILLUSTRATION, STEP_NOTE, mendelCard3d } from './components';
import { Mendel3DView } from './Mendel3DView';
import { useMendel3D } from './store';

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

beforeEach(() => {
  useMendel.setState({
    loci: 2,
    dominance: ['complete', 'complete'],
    p1: 'AaBb',
    p2: 'AaBb',
    n: 1000,
    seed: 1,
    ran: false,
    view3d: true,
  });
  useMendel3D.setState({
    t: MENDEL_TOTAL,
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

describe('Mendel3DView', () => {
  it('controls with accessible names; the cross and its ratio come from the model', () => {
    const { factory } = fakeRenderer();
    render(<Mendel3DView createRenderer={factory} />);
    for (const name of [
      'Đặt lại góc nhìn',
      'Hiện tên và chữ cái',
      'Phát',
      'Bước trước',
      'Bước tiếp theo',
      'Phát lại từ đầu',
      'Tạo ngẫu nhiên 1.000 con lai',
    ])
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    for (const name of ['3D', '2D', 'Toàn cảnh', 'Bảng Punnett'])
      expect(screen.getByRole('radio', { name })).toBeInTheDocument();
    for (const name of ['Giảm phân', 'Giao tử', 'Thụ tinh', 'Con lai'])
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    // The 2D page's reduced ratio, shown once (the end-to-end test looks for it).
    expect(screen.getAllByText('9 : 3 : 3 : 1', { exact: true })).toHaveLength(1);
    for (const key of ['A_ B_', 'A_ bb', 'aa B_', 'aa bb'])
      expect(screen.getByText(key, { exact: true })).toBeInTheDocument();
    expect(caption()).toContain(COLOUR_NOTE.vi);
    expect(caption()).toContain(MENDEL_ILLUSTRATION.vi);
    expect(caption()).toContain(STEP_NOTE.offspring.vi);
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      'Phép lai P: ♀ AaBb × ♂ AaBb. Bảng Punnett 4 × 4 ô; tỉ lệ kiểu hình 9 : 3 : 3 : 1.',
    );
    expect(useMendel3D.getState().active).toBe(true);
  });

  it('the steps: a button shows its step complete; Next and Previous walk them', () => {
    const { factory } = fakeRenderer();
    render(<Mendel3DView createRenderer={factory} />);
    fireEvent.click(screen.getByRole('button', { name: 'Giao tử' }));
    expect(useMendel3D.getState().t).toBe(stepEnd(1));
    expect(caption()).toContain(STEP_NOTE.gametes.vi);
    expect(screen.getByRole('button', { name: 'Giao tử' })).toHaveAttribute('aria-current', 'step');
    fireEvent.click(screen.getByRole('button', { name: 'Bước tiếp theo' }));
    expect(useMendel3D.getState().t).toBe(stepEnd(2));
    fireEvent.click(screen.getByRole('button', { name: 'Bước trước' }));
    expect(useMendel3D.getState().t).toBe(stepEnd(1));
    act(() => {
      useMendel3D.setState({ t: 0 });
    });
    expect(caption()).toContain(STEP_NOTE.meiosis.vi);
    expect(screen.getByRole('button', { name: 'Bước trước' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Bước tiếp theo' }));
    expect(useMendel3D.getState().t).toBe(stepEnd(0));
  });

  it('a picked cell, gamete, parent or bar: genotype, probability as a fraction, phenotype', () => {
    const { factory } = fakeRenderer();
    render(<Mendel3DView createRenderer={factory} />);
    act(() => {
      useMendel3D.setState({ selected: { kind: 'cell', row: 0, col: 1 } });
    });
    const card = screen.getByRole('complementary');
    expect(card).toHaveTextContent('Ô hàng 1 · cột 2: AABb');
    expect(card).toHaveTextContent('Giao tử ♀ AB × giao tử ♂ Ab.');
    expect(card).toHaveTextContent('Xác suất ô này: 1/4 × 1/4 = 1/16.');
    expect(card).toHaveTextContent('Kiểu gen AABb: 1/8 số con lai (2 ô trên bảng).');
    expect(card).toHaveTextContent('Kiểu hình A_ B_ — trội về gen A/a, trội về gen B/b: 9/16.');
    act(() => {
      useMendel3D.setState({ selected: { kind: 'gamete', parent: 1, index: 3 } });
    });
    expect(card).toHaveTextContent('Giao tử ♂ ab');
    expect(card).toHaveTextContent('Xác suất: 1/4 (từ bố AaBb).');
    expect(card).toHaveTextContent('Trên bảng Punnett: cột 4.');
    act(() => {
      useMendel3D.setState({ selected: { kind: 'parent', parent: 0 } });
    });
    expect(card).toHaveTextContent('Mẹ ♀: AaBb');
    expect(card).toHaveTextContent('Gen A/a: cặp NST thứ 1 trên hình mang A và a (dị hợp).');
    expect(card).toHaveTextContent('Cho 4 loại giao tử: AB 1/4 · Ab 1/4 · aB 1/4 · ab 1/4.');
    act(() => {
      useMendel3D.setState({ selected: { kind: 'class', index: 3 } });
    });
    expect(card).toHaveTextContent('Kiểu hình aa bb');
    expect(card).toHaveTextContent('Xác suất: 1/16 (6,25 %).');
    expect(card).toHaveTextContent('Tỉ lệ: 1 trong 9 : 3 : 3 : 1.');
    fireEvent.click(within(card).getByRole('button', { name: 'Bỏ chọn' }));
    expect(useMendel3D.getState().selected).toBeNull();
  });

  it('incomplete dominance: the heterozygote is its own class (1 : 2 : 1)', () => {
    useMendel.setState({ loci: 1, p1: 'Aa', p2: 'Aa', dominance: ['incomplete', 'complete'] });
    const { factory } = fakeRenderer();
    render(<Mendel3DView createRenderer={factory} />);
    expect(screen.getByText('1 : 2 : 1', { exact: true })).toBeInTheDocument();
    act(() => {
      useMendel3D.setState({ selected: { kind: 'class', index: 1 } });
    });
    expect(screen.getByRole('complementary')).toHaveTextContent(
      'Trung gian về gen A/a (trội không hoàn toàn).',
    );
  });

  it('“Tạo ngẫu nhiên”: the 2D page’s draw — same store, same seed, same counts', () => {
    const { factory } = fakeRenderer();
    render(<Mendel3DView createRenderer={factory} />);
    act(() => {
      useMendel3D.setState({ t: 0 });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo ngẫu nhiên 1.000 con lai' }));
    const st = useMendel.getState();
    expect(st.ran).toBe(true);
    expect(st.seed).toBe(2);
    // The field is shown: the view jumps to the last step.
    expect(useMendel3D.getState().t).toBe(MENDEL_TOTAL);
    const draw = mendelDraw(st);
    expect(draw).not.toBeNull();
    const obs = (draw?.obs ?? []).map((v) => new Intl.NumberFormat('vi-VN').format(v)).join(' : ');
    expect(screen.getByText(obs, { exact: true })).toBeInTheDocument();
    expect(screen.getByText('Mỗi hình ≈ 5 cá thể (làm tròn).')).toBeInTheDocument();
    act(() => {
      useMendel3D.setState({ selected: { kind: 'class', index: 0 } });
    });
    expect(screen.getByRole('complementary')).toHaveTextContent(
      `Lần tạo ngẫu nhiên: ${String(draw?.obs[0] ?? '')} / 1.000 con lai (kì vọng 562,5).`,
    );
  });

  it('Basic mode: no camera choice, names and letters on', () => {
    useSettingsStore.setState({ uiMode: 'basic' });
    const { factory } = fakeRenderer();
    render(<Mendel3DView createRenderer={factory} />);
    expect(screen.queryByRole('radio', { name: 'Bảng Punnett' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Hiện tên và chữ cái' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('a genotype the model cannot read: the 2D page’s notice and no scene', () => {
    useMendel.setState({ loci: 1, p1: 'AaBb', p2: 'Aa' });
    const { factory, made } = fakeRenderer();
    render(<Mendel3DView createRenderer={factory} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Kiểu gen không hợp lệ: "AaBb" needs 2 letters',
    );
    expect(made).toHaveLength(0);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByRole('radio', { name: '3D' })).toBeInTheDocument();
  });

  it('frees its renderer on unmount', () => {
    const { factory, made } = fakeRenderer();
    const { unmount } = render(<Mendel3DView createRenderer={factory} />);
    expect(made).toHaveLength(1);
    unmount();
    expect(made[0]?.dispose).toHaveBeenCalled();
    expect(useMendel3D.getState().active).toBe(false);
  });
});

describe('3D Science Card', () => {
  it('adds the illustration notes, the colour note, what is exact and the sources', () => {
    const card = mendelCard3d();
    const text = card.assumptions.map((a) => a.vi).join(' ');
    expect(card.title.vi).toBe('Di truyền Mendel 3D');
    expect(text).toContain(COLOUR_NOTE.vi);
    expect(text).toContain('kí hiệu trừu tượng: không thuộc loài nào');
    expect(text).toContain('không phải màu pha giữa hai thể đồng hợp');
    expect(text).toContain('Giảm phân vẽ giản lược');
    expect(text).toContain('Minh họa');
    expect(card.confidence).toBe('exact');
    expect(card.reviewStatus).toBe('pending');
    expect(card.sources.map((x) => x.id)).toEqual(expect.arrayContaining(['sgk-sh12', 'campbell']));
  });
});

describe('the lesson: 3D by default, 2D on request or when 3D cannot be drawn', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  const renderLesson = () =>
    render(
      <>
        <MendelStage />
        <MendelPanel />
      </>,
    );

  it('3D ↔ 2D is the lesson store’s saved switch; both show the same ratio and draw', async () => {
    const { container } = renderLesson();
    await waitFor(() => {
      expect(container.querySelector('.men3d canvas')).not.toBeNull();
    });
    expect(screen.getByText('9 : 3 : 3 : 1', { exact: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tạo ngẫu nhiên 1.000 con lai' }));
    const obs3d = mendelDraw(useMendel.getState())?.obs ?? [];
    fireEvent.click(screen.getByRole('radio', { name: '2D' }));
    expect(container.querySelector('.men3d')).toBeNull();
    expect(useMendel.getState().view3d).toBe(false);
    expect(mendel.state?.get()).toMatchObject({ view3d: false });
    // The 2D page: its own table, the same reduced ratio and the same observed counts.
    expect(screen.getByText('9 : 3 : 3 : 1', { exact: true })).toBeInTheDocument();
    const rows = [...container.querySelectorAll('.mendel-mc tbody tr')].slice(0, 4);
    expect(rows.map((r) => r.querySelector('td')?.textContent)).toEqual(
      obs3d.map((v) => new Intl.NumberFormat('vi-VN').format(v)),
    );
    fireEvent.click(screen.getByRole('radio', { name: '3D' }));
    await waitFor(() => {
      expect(container.querySelector('.men3d canvas')).not.toBeNull();
    });
    // Restoring a file sets the switch too.
    act(() => {
      mendel.state?.set({ view3d: false });
    });
    expect(container.querySelector('.men3d')).toBeNull();
  });

  it('display quality Low: the 2D page with its notice; the 3D view never starts', () => {
    usePerfStore.setState({ preference: 'low' });
    const { container } = renderLesson();
    expect(container.querySelector('.men3d')).toBeNull();
    expect(
      screen.getByText(/Đang ở chất lượng hiển thị Thấp nên dùng hình 2D/),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '3D' })).toHaveAttribute('aria-checked', 'true');
    expect(gl.made).toHaveLength(0);
  });

  it('the GPU context is lost: the 2D page takes over', async () => {
    const { container } = renderLesson();
    await waitFor(() => {
      expect(container.querySelector('.men3d canvas')).not.toBeNull();
    });
    const r = gl.made[0]!;
    act(() => {
      r.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    });
    await screen.findByText(/Máy này chưa vẽ được 3D/);
    expect(r.disposed).toBe(1);
    expect(container.querySelector('.punnett')).not.toBeNull();
    act(() => {
      useMendel3D.setState({ webglFailed: false });
    });
  });

  it('the 2D page shows the model’s notice for a genotype it cannot read', () => {
    useMendel.setState({ view3d: false, loci: 1, p1: 'AaBb', p2: 'Aa' });
    renderLesson();
    expect(screen.getByRole('alert')).toHaveTextContent('Kiểu gen không hợp lệ:');
  });
});
