import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import type { BenchmarkResult } from '@/perf/benchmark';
import { usePerfStore } from '@/perf/perfStore';
import type { RendererLike } from '@/ui/three/renderer';
import { fakeRenderer } from '@/ui/three/testing';
import { resetWebgl2Cache } from '../../view3d/support';
import { pointMutation } from '../../modules';
import { EFFECT, useDogmaStore } from '../state';
import { MutationPanel, MutationStage } from '../views';
import { mutationCard3d } from './components';
import { Mutation3DView } from './Mutation3DView';
import { applyPick, useMutation3D } from './store';

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

const INPUT = 'TAC ATGGCTTTCAAAGGCTGGTAA GC';

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
  useDogmaStore.setState({
    input: INPUT,
    strand: 'coding',
    step: 0,
    playing: false,
    kind: 'substitution',
    pos: 13,
    bases: 'T',
    count: 1,
    view3d: true,
  });
  useMutation3D.setState({
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

describe('Mutation3DView', () => {
  it('controls with accessible names; effect, change and proteins come from the model', () => {
    const { factory } = fakeRenderer();
    render(<Mutation3DView createRenderer={factory} />);
    for (const name of ['Đặt lại góc nhìn', 'Hiện tên và chữ cái'])
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    for (const name of ['3D', '2D', 'Toàn cảnh', 'Vị trí đột biến'])
      expect(screen.getByRole('radio', { name })).toBeInTheDocument();
    // AAA → TAA: the effect chip is EFFECT.nonsense (the 2D page's words), shown once.
    expect(screen.getAllByText(EFFECT.nonsense.name.vi)).toHaveLength(1);
    expect(screen.getByText('Thay A bằng T ở vị trí 13')).toBeInTheDocument();
    expect(screen.getByText('Met–Ala–Phe–Lys–Gly–Trp', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('Met–Ala–Phe', { exact: true })).toBeInTheDocument();
    expect(caption()).toContain(EFFECT.nonsense.desc.vi);
    expect(caption()).toContain('Minh họa — không phải tỉ lệ/hình dạng thật.');
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      'ADN bình thường (26 cặp nuclêôtit) và ADN đột biến (26 cặp): Thay A bằng T ở vị trí 13. Protein bình thường 6 axit amin, protein đột biến 3 axit amin.',
    );
    expect(useMutation3D.getState().active).toBe(true);
  });

  it('Basic mode: names and letters on, no colour legend', () => {
    useSettingsStore.setState({ uiMode: 'basic' });
    const { factory } = fakeRenderer();
    const { container } = render(<Mutation3DView createRenderer={factory} />);
    expect(screen.getByRole('button', { name: 'Hiện tên và chữ cái' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(container.querySelector('.dogma3d__legend')).toBeNull();
  });

  it('a picked bead compares the normal and the mutated amino acid', () => {
    const { factory } = fakeRenderer();
    render(<Mutation3DView createRenderer={factory} />);
    act(() => {
      useMutation3D.setState({ selected: { kind: 'bead', helix: 'normal', index: 3 } });
    });
    const card = screen.getByRole('complementary');
    expect(card).toHaveTextContent('Axit amin thứ 4');
    expect(card).toHaveTextContent('Bình thường: Lys (Lysine), từ bộ ba AAA.');
    expect(card).toHaveTextContent('Đột biến: không có — chuỗi chỉ có 3 axit amin.');
    expect(card).toHaveTextContent('Hai chuỗi khác nhau ở vị trí này.');
    act(() => {
      useMutation3D.setState({ selected: { kind: 'bead', helix: 'mutated', index: 1 } });
    });
    expect(card).toHaveTextContent('Bình thường: Ala (Alanine), từ bộ ba GCU.');
    expect(card).toHaveTextContent('Đột biến: Ala (Alanine), từ bộ ba GCU.');
    expect(card).toHaveTextContent('Hai chuỗi giống nhau ở vị trí này.');
    act(() => {
      useMutation3D.setState({ selected: { kind: 'codon', helix: 'mutated', codon: 3 } });
    });
    expect(card).toHaveTextContent('Bộ ba UAA');
    expect(card).toHaveTextContent('UAA → bộ ba kết thúc');
    expect(card).toHaveTextContent('Bộ ba cùng thứ tự trên mARN bình thường: AAA → Lys (Lysine).');
    act(() => {
      useMutation3D.setState({ selected: { kind: 'pair', helix: 'mutated', index: 12 } });
    });
    expect(card).toHaveTextContent('Cặp T–A');
    expect(card).toHaveTextContent('Cặp bị thay: ADN bình thường có A ở vị trí này.');
    fireEvent.click(within(card).getByRole('button', { name: 'Bỏ chọn' }));
    expect(useMutation3D.getState().selected).toBeNull();
  });

  it('picking a base pair of the normal DNA sets the position (a saved input); the effect follows', () => {
    const { factory } = fakeRenderer();
    render(<Mutation3DView createRenderer={factory} />);
    act(() => {
      applyPick({ kind: 'pair', helix: 'normal', index: 15 });
    });
    expect(useDogmaStore.getState().pos).toBe(16);
    expect(pointMutation.state?.get()).toMatchObject({ pos: 16 });
    // GGC → TGC: glycine becomes cysteine.
    expect(screen.getByText(EFFECT.missense.name.vi)).toBeInTheDocument();
    expect(screen.getByText('Thay G bằng T ở vị trí 16')).toBeInTheDocument();
    expect(screen.getByRole('complementary')).toHaveTextContent(
      'Đã đặt vị trí đột biến ở đây (vị trí 16).',
    );
    // Other picks only select.
    act(() => {
      applyPick({ kind: 'pair', helix: 'mutated', index: 4 });
    });
    expect(useDogmaStore.getState().pos).toBe(16);
    act(() => {
      applyPick(null);
    });
    expect(useMutation3D.getState().selected).toBeNull();
  });

  it('insertions and deletions: the change chip and effect from the model', () => {
    useDogmaStore.setState({ kind: 'deletion', pos: 10, count: 1 });
    const { factory } = fakeRenderer();
    render(<Mutation3DView createRenderer={factory} />);
    expect(screen.getByText(EFFECT.frameshift.name.vi)).toBeInTheDocument();
    expect(screen.getByText('Mất 1 nuclêôtit (T) từ vị trí 10')).toBeInTheDocument();
    act(() => {
      useDogmaStore.setState({ kind: 'insertion', bases: 'GCA' });
    });
    expect(screen.getByText(EFFECT.inFrameIndel.name.vi)).toBeInTheDocument();
    expect(screen.getByText('Thêm GCA trước vị trí 10')).toBeInTheDocument();
  });

  it('an invalid sequence or a missing new base: a notice and no scene', () => {
    useDogmaStore.setState({ input: 'ATGZ' });
    const { factory, made } = fakeRenderer();
    const { unmount } = render(<Mutation3DView createRenderer={factory} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Trình tự không hợp lệ: invalid base "Z"');
    expect(made).toHaveLength(0);
    unmount();
    useDogmaStore.setState({ input: INPUT, bases: '' });
    render(<Mutation3DView createRenderer={factory} />);
    expect(screen.getByRole('status')).toHaveTextContent('Chưa có đột biến để so sánh');
    expect(screen.queryByRole('img')).toBeNull();
    expect(made).toHaveLength(0);
    expect(screen.getByRole('radio', { name: '3D' })).toBeInTheDocument();
  });

  it('frees its renderer on unmount', () => {
    const { factory, made } = fakeRenderer();
    const { unmount } = render(<Mutation3DView createRenderer={factory} />);
    expect(made).toHaveLength(1);
    unmount();
    expect(made[0]?.dispose).toHaveBeenCalled();
    expect(useMutation3D.getState().active).toBe(false);
  });
});

describe('3D Science Card', () => {
  it('adds the illustration note, the alignment, what is exact and the sources', () => {
    const card = mutationCard3d();
    const text = card.assumptions.map((a) => a.vi).join(' ');
    expect(card.title.vi).toBe('Đột biến điểm 3D');
    expect(text).toContain('Minh họa — không phải tỉ lệ/hình dạng thật.');
    expect(text).toContain('chỗ phình (thêm nuclêôtit), khoảng trống (mất nuclêôtit)');
    expect(text).toContain('ADN thật vẫn là một chuỗi xoắn kép liền mạch');
    expect(text).toContain('mỗi vòng xoắn 10 cặp nuclêôtit, dài 3,4 nm, đường kính 2 nm');
    // The effect names appear once on the page (the chip): never in the card.
    for (const e of Object.values(EFFECT)) expect(text).not.toContain(e.name.vi.toLowerCase());
    expect(card.confidence).toBe('exact');
    expect(card.reviewStatus).toBe('pending');
    expect(card.sources.map((x) => x.id)).toEqual(
      expect.arrayContaining(['sgk-sh10', 'sgk-sh12', 'campbell']),
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
        <MutationStage />
        <MutationPanel />
      </>,
    );

  it('3D ↔ 2D uses the dogma store’s saved switch; both show the same effect', async () => {
    const { container } = renderLesson();
    await waitFor(() => {
      expect(container.querySelector('.mut3d canvas')).not.toBeNull();
    });
    expect(screen.getByText(EFFECT.nonsense.name.vi)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: '2D' }));
    expect(container.querySelector('.mut3d')).toBeNull();
    expect(useDogmaStore.getState().view3d).toBe(false);
    expect(pointMutation.state?.get()).toMatchObject({ view3d: false });
    // The 2D page: the same effect, its own rows.
    expect(screen.getByText(`${EFFECT.nonsense.name.vi}:`)).toBeInTheDocument();
    expect(screen.getByText('Met–Ala–Phe', { exact: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: '3D' }));
    await waitFor(() => {
      expect(container.querySelector('.mut3d canvas')).not.toBeNull();
    });
  });

  it('display quality Low: the 2D page with its notice; the 3D view never starts', () => {
    usePerfStore.setState({ preference: 'low' });
    const { container } = renderLesson();
    expect(container.querySelector('.mut3d')).toBeNull();
    expect(
      screen.getByText(/Đang ở chất lượng hiển thị Thấp nên dùng hình 2D/),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '3D' })).toHaveAttribute('aria-checked', 'true');
    expect(gl.made).toHaveLength(0);
  });

  it('the GPU context is lost: the 2D page takes over', async () => {
    const { container } = renderLesson();
    await waitFor(() => {
      expect(container.querySelector('.mut3d canvas')).not.toBeNull();
    });
    const r = gl.made[0]!;
    act(() => {
      r.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    });
    await screen.findByText(/Máy này chưa vẽ được 3D/);
    expect(r.disposed).toBe(1);
    expect(screen.getByText(`${EFFECT.nonsense.name.vi}:`)).toBeInTheDocument();
    act(() => {
      useMutation3D.setState({ webglFailed: false });
    });
  });
});
