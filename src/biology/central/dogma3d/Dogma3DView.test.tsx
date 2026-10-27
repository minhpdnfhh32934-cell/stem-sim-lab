import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import type { BenchmarkResult } from '@/perf/benchmark';
import { usePerfStore } from '@/perf/perfStore';
import type { RendererLike } from '@/ui/three/renderer';
import { fakeRenderer } from '@/ui/three/testing';
import { resetWebgl2Cache } from '../../view3d/support';
import { centralDogma } from '../../modules';
import { codingToMrna, complement } from '../dogma';
import { useDogmaStore } from '../state';
import { CentralDogmaPanel, CentralDogmaStage } from '../views';
import { dogmaClock, dogmaModel3d, keyTime } from './binding';
import { dogmaCard3d } from './components';
import { Dogma3DView } from './Dogma3DView';
import { useDogma3D } from './store';

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
const CODING = 'TACATGGCTTTCAAAGGCTGGTAAGC';
const model = dogmaModel3d(CODING);
const clock = dogmaClock(model);

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
    view3d: true,
  });
  useDogma3D.setState({
    t: 0,
    playing: false,
    selected: null,
    camera: 'follow',
    viewNonce: 0,
    webglFailed: false,
    active: false,
    labels: null,
    speed: 1,
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

describe('Dogma3DView', () => {
  it('renders the controls with accessible names; the picture is described from the model', () => {
    const { factory } = fakeRenderer();
    render(<Dogma3DView createRenderer={factory} />);
    for (const name of [
      'Bước trước',
      'Phát',
      'Bước tiếp theo',
      'Phát lại từ đầu',
      'Đặt lại góc nhìn',
      'Hiện tên và chữ cái',
    ])
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    for (const name of ['3D', '2D', 'Theo dõi', 'Toàn cảnh', '1×'])
      expect(screen.getByRole('radio', { name })).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      expect.stringMatching(/^Chuỗi xoắn kép ADN 26 cặp nuclêôtit\. ARN pôlimeraza tháo xoắn/),
    );
    expect(screen.getByRole('slider', { name: /Thời điểm/ })).toBeInTheDocument();
    const strip = screen.getByRole('group', { name: 'Các giai đoạn' });
    expect(
      within(strip)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Phiên mã', 'Dịch mã']);
    expect(caption()).toContain('Minh họa — không phải tỉ lệ/hình dạng thật.');
    expect(useDogma3D.getState().active).toBe(true);
  });

  it('Basic mode: no speed choice, names and letters on', () => {
    useSettingsStore.setState({ uiMode: 'basic' });
    const { factory } = fakeRenderer();
    render(<Dogma3DView createRenderer={factory} />);
    expect(screen.queryByRole('radio', { name: '1×' })).toBeNull();
    expect(screen.getByRole('slider', { name: /Thời điểm/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hiện tên và chữ cái' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('the caption and chips follow the clock with the model’s bases, codons and amino acids', () => {
    const { factory } = fakeRenderer();
    render(<Dogma3DView createRenderer={factory} />);
    const mrna = codingToMrna(CODING);
    const tpl = complement(CODING);
    act(() => {
      useDogma3D.setState({ t: 13 * clock.perBase + 0.01 });
    });
    expect(caption()).toContain(
      `mARN dài 13/26 nuclêôtit (5′→3′). Nuclêôtit vừa lắp: ${mrna[12] ?? ''}, bắt cặp với ${tpl[12] ?? ''} của mạch khuôn.`,
    );
    expect(screen.getByText('mARN: 13/26 nuclêôtit')).toBeInTheDocument();
    act(() => {
      useDogma3D.setState({ t: keyTime(clock, 0) });
    });
    expect(caption()).toContain(
      'Ribosome ở bộ ba thứ 1/7: AUG → Met (Methionine), tARN mang bộ ba đối mã UAC.',
    );
    expect(screen.getByText('Chuỗi pôlipeptit: 1 axit amin')).toBeInTheDocument();
    expect(screen.getByText('Dịch mã', { selector: 'strong' })).toBeInTheDocument();
    act(() => {
      useDogma3D.setState({ t: keyTime(clock, 6) });
    });
    expect(caption()).toContain(
      'UAA là bộ ba kết thúc — không có tARN nào đến, chuỗi pôlipeptit được giải phóng.',
    );
    expect(screen.getByText('Chuỗi pôlipeptit: 6 axit amin')).toBeInTheDocument();
  });

  it('the step buttons go through transcription, then codon by codon; the slider scrubs', () => {
    const { factory } = fakeRenderer();
    render(<Dogma3DView createRenderer={factory} />);
    const next = screen.getByRole('button', { name: 'Bước tiếp theo' });
    fireEvent.click(next);
    expect(useDogma3D.getState().t).toBe(clock.tlStart);
    fireEvent.click(next);
    expect(useDogma3D.getState().t).toBe(keyTime(clock, 0));
    fireEvent.click(screen.getByRole('button', { name: 'Bước trước' }));
    expect(useDogma3D.getState().t).toBe(clock.tlStart);
    fireEvent.change(screen.getByRole('slider', { name: /Thời điểm/ }), {
      target: { value: String(keyTime(clock, 3)) },
    });
    // The clock writes the 2D page's step.
    expect(useDogmaStore.getState().step).toBe(3);
    expect(caption()).toContain('Ribosome ở bộ ba thứ 4/7: AAA → Lys (Lysine)');
  });

  it('a picked base shows its name, partner, 1-based position, codon and amino acid', () => {
    const { factory } = fakeRenderer();
    render(<Dogma3DView createRenderer={factory} />);
    act(() => {
      useDogma3D.setState({ selected: { kind: 'base', strand: 'coding', index: 3 } });
    });
    const card = screen.getByRole('complementary');
    expect(card).toHaveTextContent('Ađênin (A)');
    expect(card).toHaveTextContent('cặp nuclêôtit thứ 4');
    expect(card).toHaveTextContent('Bắt cặp với T (Timin) trên mạch khuôn (mạch mã gốc).');
    expect(card).toHaveTextContent(
      'Bộ ba thứ 1 trên mARN: AUG → Met (Methionine) · bộ ba đối mã của tARN: UAC.',
    );
    act(() => {
      useDogma3D.setState({ selected: { kind: 'codon', codon: 6 } });
    });
    expect(card).toHaveTextContent('Bộ ba UAA');
    expect(card).toHaveTextContent('không có tARN nào mang bộ ba đối mã tương ứng');
    act(() => {
      useDogma3D.setState({ selected: { kind: 'residue', codon: 1 } });
    });
    expect(card).toHaveTextContent('Ala (Alanine)');
    expect(card).toHaveTextContent('Axit amin thứ 2 của chuỗi pôlipeptit.');
    // At t = 0 the chain does not exist yet.
    expect(card).toHaveTextContent('Lúc này phần này không có trên hình.');
    fireEvent.click(within(card).getByRole('button', { name: 'Bỏ chọn' }));
    expect(useDogma3D.getState().selected).toBeNull();
  });

  it('an invalid sequence shows the 2D page’s notice and no scene', () => {
    useDogmaStore.setState({ input: 'ATGZ' });
    const { factory, made } = fakeRenderer();
    render(<Dogma3DView createRenderer={factory} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Trình tự không hợp lệ: invalid base "Z"');
    expect(screen.queryByRole('img')).toBeNull();
    expect(made).toHaveLength(0);
    expect(screen.getByRole('radio', { name: '3D' })).toBeInTheDocument();
  });

  it('frees its renderer on unmount', () => {
    const { factory, made } = fakeRenderer();
    const { unmount } = render(<Dogma3DView createRenderer={factory} />);
    expect(made).toHaveLength(1);
    unmount();
    expect(made[0]?.dispose).toHaveBeenCalled();
    expect(useDogma3D.getState().active).toBe(false);
  });
});

describe('3D Science Card', () => {
  it('adds what the 3D picture draws, what is exact, the B-DNA proportions and the sources', () => {
    const card = dogmaCard3d();
    const text = card.assumptions.map((a) => a.vi).join(' ');
    expect(card.title.vi).toBe('ADN → mARN → Protein 3D');
    expect(text).toContain('Minh họa — không phải tỉ lệ/hình dạng thật.');
    expect(text).toContain(
      'mọi bazơ của hai mạch ADN và của mARN, mọi bộ ba, bộ ba đối mã và axit amin',
    );
    expect(text).toContain('mỗi vòng xoắn 10 cặp nuclêôtit, dài 3,4 nm, đường kính 2 nm');
    expect(text).toContain('Không vẽ nhân tế bào');
    expect(card.confidence).toBe('exact');
    expect(card.reviewStatus).toBe('pending');
    expect(card.sources.map((x) => x.id)).toEqual(
      expect.arrayContaining(['sgk-sh10', 'sgk-sh12', 'campbell']),
    );
  });
});

describe('the lesson: 3D by default, 2D keeps the codon, 2D when 3D cannot be drawn', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  const renderLesson = () =>
    render(
      <>
        <CentralDogmaStage />
        <CentralDogmaPanel />
      </>,
    );

  it('3D → 2D → 3D keeps the codon being translated', async () => {
    useDogmaStore.setState({ step: 3 });
    const { container } = renderLesson();
    await waitFor(() => {
      expect(container.querySelector('.dogma3d canvas')).not.toBeNull();
    });
    // 3D opens on the 2D page's codon; the parts list follows the 3D view.
    expect(useDogma3D.getState().t).toBe(keyTime(clock, 3));
    expect(screen.getByRole('group', { name: 'Các thành phần' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: '2D' }));
    expect(container.querySelector('.dogma3d')).toBeNull();
    expect(screen.getByText('Ribosome ở bộ ba thứ 4/7')).toBeInTheDocument();
    expect(useDogmaStore.getState().view3d).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Bộ ba sau' }));
    expect(useDogmaStore.getState().step).toBe(4);
    fireEvent.click(screen.getByRole('radio', { name: '3D' }));
    await waitFor(() => {
      expect(container.querySelector('.dogma3d canvas')).not.toBeNull();
    });
    expect(useDogma3D.getState().t).toBe(keyTime(clock, 4));
    expect(caption()).toContain('Ribosome ở bộ ba thứ 5/7: GGC → Gly (Glycine)');
    // A place in transcription is kept when it still shows the same (first) codon.
    act(() => {
      useDogma3D.setState({ t: clock.txEnd / 3 });
    });
    expect(useDogmaStore.getState().step).toBe(0);
    fireEvent.click(screen.getByRole('radio', { name: '2D' }));
    fireEvent.click(screen.getByRole('radio', { name: '3D' }));
    await waitFor(() => {
      expect(container.querySelector('.dogma3d canvas')).not.toBeNull();
    });
    expect(useDogma3D.getState().t).toBe(clock.txEnd / 3);
  });

  it('display quality Low: the 2D page with its notice; the 3D view never starts', () => {
    usePerfStore.setState({ preference: 'low' });
    const { container } = renderLesson();
    expect(container.querySelector('.dogma3d')).toBeNull();
    expect(
      screen.getByText(/Đang ở chất lượng hiển thị Thấp nên dùng hình 2D/),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '3D' })).toHaveAttribute('aria-checked', 'true');
    expect(gl.made).toHaveLength(0);
  });

  it('the GPU context is lost: the 2D page takes over at the same codon', async () => {
    useDogmaStore.setState({ step: 2 });
    const { container } = renderLesson();
    await waitFor(() => {
      expect(container.querySelector('.dogma3d canvas')).not.toBeNull();
    });
    const r = gl.made[0]!;
    act(() => {
      r.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    });
    await screen.findByText(/Máy này chưa vẽ được 3D/);
    expect(r.disposed).toBe(1);
    expect(screen.getByText('Ribosome ở bộ ba thứ 3/7')).toBeInTheDocument();
  });

  it('the 2D page gives the anticodon of a sense codon only (no tRNA reads a stop codon)', () => {
    useDogmaStore.setState({ view3d: false, step: 0 });
    renderLesson();
    expect(screen.getByText(/Anticodon của tARN:/)).toHaveTextContent('UAC');
    act(() => {
      useDogmaStore.setState({ step: 6 });
    });
    expect(screen.getByText(/bộ ba kết thúc: không có axit amin/)).toBeInTheDocument();
    expect(screen.queryByText(/Anticodon của tARN:/)).toBeNull();
  });

  it('3D on/off is saved with the lesson’s inputs', () => {
    expect(centralDogma.state?.get()).toMatchObject({ input: INPUT, view3d: true });
    centralDogma.state?.set({ view3d: false });
    expect(useDogmaStore.getState().view3d).toBe(false);
    // A file with a wrong type keeps the current value.
    centralDogma.state?.set({ view3d: 'yes' });
    expect(useDogmaStore.getState().view3d).toBe(false);
  });
});
