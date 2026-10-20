import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatNumber } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import type { BenchmarkResult } from '@/perf/benchmark';
import { usePerfStore } from '@/perf/perfStore';
import { closeTeacher, useTeacherStore } from '@/teacher/teacherStore';
import { fakeRenderer } from '@/ui/three/testing';
import type { RendererLike } from '@/ui/three/renderer';
import { meiosis } from '../../modules';
import { DivisionPanel, DivisionStage } from '../DivisionViews';
import { STAGES } from '../division';
import { setDivisionState } from '../stageIndex';
import { STAGE_NAME, useDivisionStore } from '../state';
import { MeiosisBottom, MeiosisPanel, MeiosisStage } from '../views';
import { MEIOSIS_STAGE_NAME, drillSelection, meiosisCard3d } from './components';
import { Meiosis3DSwitch } from './Meiosis3DSwitch';
import { Meiosis3DView, type Meiosis3DDebug } from './Meiosis3DView';
import { Meiosis3DBottom, Meiosis3DParts } from './panels';
import { meiosisIndex2dOf, meiosisStage3dOf, meiosisTimelineFor, useMeiosis3D } from './store';
import { MEIOSIS_STAGES_3D } from './timeline';

/**
 * The view's own renderer factory calls `new THREE.WebGLRenderer(…)`, and jsdom has no WebGL:
 * a stand-in that works until its canvas fires 'webglcontextlost' (`gl.real` → the real class,
 * which throws without a context). Tests that pass `createRenderer` are not affected.
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

const debug = () =>
  (window as unknown as { __simlab3d?: Record<string, Meiosis3DDebug> }).__simlab3d?.meiosis;

beforeEach(() => {
  setDivisionState('meiosis', {
    pairs: 2,
    index: 0,
    crossover: true,
    seed: 1,
    meiosisView3d: true,
    speed: 1,
  });
  useMeiosis3D.setState({
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
});

afterEach(() => {
  vi.restoreAllMocks();
});

const stageLabel = () => screen.getByRole('img').getAttribute('aria-label') ?? '';
const tl2 = () => meiosisTimelineFor(2, true, 1);

describe('Meiosis3DView', () => {
  it('renders the controls with accessible names; the picture is labelled with the stage', () => {
    const { factory } = fakeRenderer();
    render(<Meiosis3DView createRenderer={factory} />);
    for (const name of [
      'Bước trước',
      'Phát',
      'Bước tiếp theo',
      'Phát lại từ đầu',
      'Đặt lại góc nhìn',
      'Hiện tên các bộ phận',
    ])
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    for (const name of ['3D', '2D', 'Toàn cảnh', 'Cận cảnh NST', '1×'])
      expect(screen.getByRole('radio', { name })).toBeInTheDocument();
    expect(stageLabel()).toMatch(/^Kì trung gian \(pha G1\)\. /);
    // Twelve stage buttons; the accessible name is the visible text.
    const strip = screen.getByRole('group', { name: 'Các kì' });
    expect(within(strip).getAllByRole('button')).toHaveLength(12);
    for (const b of within(strip).getAllByRole('button'))
      expect(b.getAttribute('aria-label') ?? b.textContent).toBe(b.textContent);
    expect(useMeiosis3D.getState().active).toBe(true);
    // The caption says what is illustration.
    expect(screen.getByText(/Minh họa — không phải tỉ lệ\/hình dạng thật\./)).toBeInTheDocument();
  });

  it('Basic mode hides the speed and the camera choice', () => {
    useSettingsStore.setState({ uiMode: 'basic' });
    const { factory } = fakeRenderer();
    render(<Meiosis3DView createRenderer={factory} />);
    expect(screen.queryByRole('radio', { name: '1×' })).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Cận cảnh NST' })).toBeNull();
    expect(screen.getByRole('radio', { name: '3D' })).toBeInTheDocument();
    // Name labels are on by default in Basic mode.
    expect(screen.getByRole('button', { name: 'Hiện tên các bộ phận' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('the stage label and the counts chip follow the playback time (counts from the model)', () => {
    const { factory } = fakeRenderer();
    render(<Meiosis3DView createRenderer={factory} />);
    const tl = tl2();
    act(() => {
      useMeiosis3D.setState({ t: tl.keyTime('metaphase1') });
    });
    expect(stageLabel()).toMatch(/^Kì giữa I\. /);
    expect(screen.getByText('1 tế bào · 4 NST kép')).toBeInTheDocument();
    act(() => {
      useMeiosis3D.setState({ t: tl.keyTime('telophase1') });
    });
    expect(screen.getByText('1 tế bào · 2 nhân · mỗi nhân 2 NST kép')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Bước tiếp theo' }));
    expect(stageLabel()).toMatch(/^Phân chia tế bào chất I\. /);
    expect(
      screen.getByText('Sau khi chia: 2 tế bào con · mỗi tế bào 2 NST kép'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Bước tiếp theo' }));
    expect(screen.getByText('2 tế bào · mỗi tế bào 2 NST kép')).toBeInTheDocument();
    const strip = screen.getByRole('group', { name: 'Các kì' });
    fireEvent.click(within(strip).getByRole('button', { name: 'Kì sau II' }));
    expect(stageLabel()).toMatch(/^Kì sau II\. /);
    expect(screen.getByText('2 tế bào · mỗi tế bào 4 NST đơn')).toBeInTheDocument();
    fireEvent.click(within(strip).getByRole('button', { name: 'Chia tế bào chất II' }));
    // Four cells; with crossing over, four different gametes (gameteSignature of the model).
    expect(
      screen.getByText('Sau khi chia: 4 tế bào con · mỗi tế bào 2 NST đơn · 4 loại giao tử'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bước tiếp theo' })).toBeDisabled();
  });

  it('a picked chromatid lists its DNA pieces from the model', () => {
    const { factory } = fakeRenderer();
    render(<Meiosis3DView createRenderer={factory} />);
    const tl = tl2();
    // The paternal homologue of pair 1, its inner sister: recombinant after crossing over.
    const id = tl.chromatids.findIndex((c) => c.pair === 0 && c.origin === 'P' && c.sister === 0);
    const info = tl.chromatids[id]!;
    expect(info.recombinant).toBe(true);
    const x = tl.options.crossovers[0]!.point;
    const f = (v: number) => formatNumber('vi', v, { maximumFractionDigits: 2 });
    act(() => {
      useMeiosis3D.setState({
        t: tl.keyTime('metaphase1'),
        selected: { component: 'sisterChromatid', chromosome: info.chromosome, sister: 0 },
      });
    });
    const card = screen.getByRole('complementary');
    expect(card).toHaveTextContent('Cromatit chị em');
    expect(card).toHaveTextContent(
      `Các đoạn ADN của crômatit này: bố 0–${f(x)} · mẹ ${f(x)}–1 (đã trao đổi chéo).`,
    );
    expect(card).toHaveTextContent('Nguồn: SGK Sinh học 10; Campbell Biology');
    // Before the exchange (G2) the same chromatid is all paternal.
    act(() => {
      useMeiosis3D.setState({ t: tl.keyTime('g2') });
    });
    expect(card).toHaveTextContent('Các đoạn ADN của crômatit này: bố 0–1.');
  });

  it('after the homologues separate a picked chromosome is a double chromosome, one of its pair', () => {
    const { factory } = fakeRenderer();
    render(<Meiosis3DView createRenderer={factory} />);
    const tl = tl2();
    const info = tl.chromatids.find((c) => c.pair === 1 && c.origin === 'M' && c.sister === 0)!;
    const selected = { component: 'doubleChromosome' as const, chromosome: info.chromosome };
    act(() => {
      useMeiosis3D.setState({ t: tl.keyTime('metaphase2'), selected });
    });
    const card = screen.getByRole('complementary');
    expect(card).toHaveTextContent('Nhiễm sắc thể kép');
    expect(card).toHaveTextContent(
      'Theo mô hình: một chiếc của cặp NST số 2, nguồn gốc từ mẹ; lúc này có 2 crômatit (2 phân tử ADN).',
    );
    expect(card).not.toHaveTextContent('Bộ phận này không thấy rõ ở kì đang xem.');
    // "NST tương đồng" from the parts list: no homologue is in a meiosis II cell.
    act(() => {
      useMeiosis3D.setState({ selected: { component: 'homologousChromosome' } });
    });
    expect(screen.getByRole('complementary')).toHaveTextContent(
      'Bộ phận này không thấy rõ ở kì đang xem.',
    );
    // In metaphase I the pair is still together: the line names the pair.
    act(() => {
      useMeiosis3D.setState({ t: tl.keyTime('metaphase1'), selected });
    });
    expect(screen.getByRole('complementary')).toHaveTextContent(
      'Theo mô hình: cặp NST số 2, nguồn gốc từ mẹ',
    );
  });

  it('a second tap on a picked bivalent drills into the chromatid under the pointer', () => {
    const bivalent = { component: 'bivalent' as const, pair: 0, chromosome: 1, sister: 1 as const };
    expect(drillSelection(null, bivalent)).toEqual(bivalent);
    expect(drillSelection(bivalent, bivalent)).toEqual({
      component: 'sisterChromatid',
      chromosome: 1,
      sister: 1,
    });
    const homologue = {
      component: 'homologousChromosome' as const,
      chromosome: 2,
      sister: 0 as const,
    };
    expect(drillSelection(homologue, homologue)).toEqual({
      component: 'sisterChromatid',
      chromosome: 2,
      sister: 0,
    });
    // Another chromosome, or another part: a fresh pick.
    expect(drillSelection(homologue, { ...homologue, chromosome: 3 })).toMatchObject({
      component: 'homologousChromosome',
    });
    expect(drillSelection(bivalent, { component: 'spindle' })).toEqual({ component: 'spindle' });
    // After the homologues separate a chromosome is picked as a double chromosome: same drill.
    const double = { ...homologue, component: 'doubleChromosome' as const };
    expect(drillSelection(double, double)).toEqual({
      component: 'sisterChromatid',
      chromosome: 2,
      sister: 0,
    });
    expect(drillSelection(homologue, double)).toEqual(double);
  });

  it('the parts list picks a part; "Hỏi thầy" opens the teacher with a question from the texts', () => {
    const { factory } = fakeRenderer();
    render(
      <>
        <Meiosis3DView createRenderer={factory} />
        <Meiosis3DParts />
      </>,
    );
    act(() => {
      useMeiosis3D.setState({ t: tl2().keyTime('metaphase1') });
    });
    const parts = screen.getByRole('group', { name: 'Bộ phận tế bào' });
    expect(within(parts).getAllByRole('button')).toHaveLength(15);
    fireEvent.click(within(parts).getByRole('button', { name: 'Điểm bắt chéo (trao đổi chéo)' }));
    const card = screen.getByRole('complementary');
    const x = formatNumber('vi', tl2().options.crossovers[0]!.point, {
      maximumFractionDigits: 2,
    });
    expect(card).toHaveTextContent(`cặp NST số 1, tại vị trí ${x} dọc chiều dài NST`);
    fireEvent.click(within(card).getByRole('button', { name: 'Hỏi thầy về bộ phận này' }));
    expect(useTeacherStore.getState().draft).toBe(
      'Thầy giải thích giúp em: bộ phận “Điểm bắt chéo (trao đổi chéo)” làm gì ở giai đoạn “Kì giữa I” (mô phỏng giảm phân, tế bào động vật) ạ?',
    );
    closeTeacher();
    // In anaphase II there is no chiasma: the question does not assume it is there.
    act(() => {
      useMeiosis3D.setState({ t: tl2().keyTime('anaphase2') });
    });
    expect(card).toHaveTextContent('Bộ phận này không thấy rõ ở kì đang xem.');
    fireEvent.click(within(card).getByRole('button', { name: 'Hỏi thầy về bộ phận này' }));
    expect(useTeacherStore.getState().draft).toMatch(/em không thấy rõ bộ phận/);
    closeTeacher();
  });

  it('the crossover switch and the new random run rebuild the timeline', () => {
    const { factory } = fakeRenderer();
    render(
      <>
        <Meiosis3DView createRenderer={factory} />
        <DivisionPanel kind="meiosis" />
        <Meiosis3DBottom />
      </>,
    );
    expect(screen.getByText(/Lần chạy này cho 4 loại giao tử khác nhau\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Có trao đổi chéo (cặp số 1)' }));
    expect(useDivisionStore.getState().crossover).toBe(false);
    // Without crossing over, 2n = 4 gives two kinds of gamete per run.
    expect(screen.getByText(/Lần chạy này cho 2 loại giao tử khác nhau\./)).toBeInTheDocument();
    const before = meiosisTimelineFor(2, false, 1);
    fireEvent.click(screen.getByRole('button', { name: 'Sắp xếp ngẫu nhiên lại ở kì giữa I' }));
    expect(useDivisionStore.getState().seed).toBe(2);
    expect(meiosisTimelineFor(2, false, 2)).not.toBe(before);
    // A bottom-table row jumps to its stage.
    const table = screen.getByRole('table');
    fireEvent.click(within(table).getByRole('button', { name: 'Kì giữa II' }));
    expect(useMeiosis3D.getState().t).toBe(meiosisTimelineFor(2, false, 2).keyTime('metaphase2'));
  });

  it('cleans up the renderer and the debug hook on unmount', () => {
    const { factory, made } = fakeRenderer();
    const view = render(<Meiosis3DView createRenderer={factory} />);
    expect(debug()?.stage()).toBe('g1');
    view.unmount();
    expect(made[0]?.dispose).toHaveBeenCalled();
    expect(made[0]?.domElement.isConnected).toBe(false);
    expect(debug()).toBeUndefined();
    expect(useMeiosis3D.getState().active).toBe(false);
  });

  it('the 3D Science Card: illustration note, animal only (plant meiosis is not drawn)', () => {
    const card = meiosisCard3d();
    expect(card.title.vi).toBe('Giảm phân 3D — tế bào động vật');
    const text = card.assumptions.map((a) => a.vi).join(' ');
    expect(text).toContain('Minh họa — không phải tỉ lệ/hình dạng thật.');
    expect(text).toContain('bào tử (không vẽ)');
    expect(text).toContain('không có pha S');
    expect(card.reviewStatus).toBe('pending');
    expect(card.sources.length).toBe(2);
  });
});

describe('the module shows the 2D picture when 3D cannot be drawn', () => {
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
    gl.real = false;
    gl.made.length = 0;
    usePerfStore.setState({ preference: 'medium', benchmark, degraded: false });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  afterEach(() => {
    cleanup();
    gl.real = false;
    usePerfStore.setState({ preference: 'auto', benchmark: null, degraded: false });
  });

  const renderModule = () =>
    render(
      <>
        <MeiosisStage />
        <MeiosisPanel />
        <MeiosisBottom />
      </>,
    );

  function expect2dPicture(container: HTMLElement, notice: RegExp) {
    expect(container.querySelector('.mei3d')).toBeNull();
    expect(container.querySelector('canvas.chem-canvas')).not.toBeNull();
    expect(screen.getByText(notice)).toBeInTheDocument();
    // 3D is still the learner's choice; it just cannot be drawn.
    expect(screen.getByRole('radio', { name: '3D' })).toHaveAttribute('aria-checked', 'true');
    expect(useDivisionStore.getState().meiosisView3d).toBe(true);
    expect(useMeiosis3D.getState().active).toBe(false);
    expect(screen.queryByRole('group', { name: 'Bộ phận tế bào' })).toBeNull();
    expect(
      within(screen.getByRole('table'))
        .getAllByRole('rowheader')
        .map((th) => th.textContent),
    ).toEqual(STAGES.meiosis.map((s) => STAGE_NAME[s].vi));
  }

  it('display quality Low: the 2D picture with its notice; the 3D view never starts', () => {
    usePerfStore.setState({ preference: 'low' });
    const { container } = renderModule();
    expect2dPicture(container, /Đang ở chất lượng hiển thị Thấp nên dùng hình 2D/);
    expect(gl.made).toHaveLength(0);
  });

  it('the GPU context is lost while 3D is shown: the 2D picture takes over at that stage', async () => {
    useMeiosis3D.setState({ t: tl2().keyTime('metaphase2') });
    const { container } = renderModule();
    await waitFor(() => {
      expect(container.querySelector('.mei3d canvas')).not.toBeNull();
    });
    // The 3D view's twelve-step table and parts list.
    expect(within(screen.getByRole('table')).getAllByRole('rowheader')).toHaveLength(12);
    expect(screen.getByRole('group', { name: 'Bộ phận tế bào' })).toBeInTheDocument();
    const r = gl.made[0]!;
    act(() => {
      r.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    });
    await screen.findByText(/Máy này chưa vẽ được 3D/);
    expect(r.disposed).toBe(1);
    expect2dPicture(container, /Máy này chưa vẽ được 3D \(WebGL\), nên dùng hình 2D/);
    expect(useDivisionStore.getState().index).toBe(STAGES.meiosis.indexOf('metaphase2'));
    expect(screen.getByText('Kì giữa II', { selector: 'strong' })).toBeInTheDocument();
  });

  it('the picture has an accessible name in 3D (the stage and its note)', async () => {
    const { container } = renderModule();
    await waitFor(() => {
      expect(container.querySelector('.mei3d canvas')).not.toBeNull();
    });
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      expect.stringMatching(/^Kì trung gian \(pha G1\)\. .*trung thể/),
    );
  });
});

describe('3D / 2D switch keeps the stage (meiosis has its own index map)', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  it('maps every 3D stage to a 2D stage and back', () => {
    expect(MEIOSIS_STAGES_3D.map((s) => STAGES.meiosis[meiosisIndex2dOf(s)])).toEqual([
      'g1',
      'g2',
      'prophase1',
      'metaphase1',
      'anaphase1',
      'telophase1',
      'telophase1',
      'prophase2',
      'metaphase2',
      'anaphase2',
      'telophase2',
      'telophase2',
    ]);
    // The 2D telophase pictures (daughter cells counted per cell) are the ends of cytokinesis.
    expect(STAGES.meiosis.map((_, i) => meiosisStage3dOf(i))).toEqual([
      'g1',
      'g2',
      'prophase1',
      'metaphase1',
      'anaphase1',
      'cytokinesis1',
      'prophase2',
      'metaphase2',
      'anaphase2',
      'cytokinesis2',
    ]);
  });

  it('3D → 2D → 3D keeps the stage, also after a mitosis visit', () => {
    const tl = tl2();
    act(() => {
      useMeiosis3D.setState({ t: tl.keyTime('anaphase1') });
    });
    const { factory } = fakeRenderer();
    const view = render(<Meiosis3DView createRenderer={factory} />);
    fireEvent.click(screen.getByRole('radio', { name: '2D' }));
    expect(useDivisionStore.getState()).toMatchObject({
      meiosisView3d: false,
      index: STAGES.meiosis.indexOf('anaphase1'),
    });
    view.unmount();
    const twoD = render(<DivisionStage kind="meiosis" toolbar={<Meiosis3DSwitch />} />);
    expect(
      screen.getByText(MEIOSIS_STAGE_NAME.anaphase1.vi, { selector: 'strong' }),
    ).toBeInTheDocument();
    // 2D telophase I → 3D: the end of cytokinesis I (two daughter cells).
    fireEvent.click(screen.getByRole('button', { name: 'Bước tiếp theo' }));
    fireEvent.click(screen.getByRole('radio', { name: '3D' }));
    expect(useDivisionStore.getState().meiosisView3d).toBe(true);
    expect(useMeiosis3D.getState().t).toBe(tl.keyTime('cytokinesis1'));
    twoD.unmount();
    // A stage index left by the mitosis view is not a meiosis stage.
    setDivisionState('mitosis', { index: 4 });
    useDivisionStore.setState({ meiosisView3d: false });
    render(<Meiosis3DSwitch />);
    fireEvent.click(screen.getByRole('radio', { name: '3D' }));
    expect(useMeiosis3D.getState().t).toBe(tl.keyTime('g1'));
  });
});

describe('meiosis module state (files, history, undo)', () => {
  it('saves and restores the 3D choice; a non-boolean from a file is ignored', () => {
    useDivisionStore.setState({ meiosisView3d: false, speed: 2 });
    const saved = meiosis.state!.get();
    expect(saved).toMatchObject({ meiosisView3d: false, speed: 2 });
    useDivisionStore.setState({ meiosisView3d: true, speed: 1 });
    meiosis.state!.set(saved);
    expect(useDivisionStore.getState()).toMatchObject({ meiosisView3d: false, speed: 2 });
    meiosis.state!.set({ meiosisView3d: 'yes', crossover: 1 });
    expect(useDivisionStore.getState()).toMatchObject({ meiosisView3d: false, crossover: true });
  });
});
