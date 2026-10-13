import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useApplyTheme } from '@/app/theme/useApplyTheme';
import { FrameMonitor } from '@/perf/frameMonitor';
import { DivisionStage } from '../DivisionViews';
import { STAGES } from '../division';
import { setDivisionState } from '../stageIndex';
import { useDivisionStore } from '../state';
import { MitosisBottom, MitosisPanel, MitosisStage } from '../views';
import { Mitosis3DSwitch } from './Mitosis3DSwitch';
import { Mitosis3DView, type RendererFactory, type RendererLike } from './Mitosis3DView';
import { Mitosis3DParts } from './panels';
import { index2dOf, stage3dOf, timelineFor, useMitosis3D } from './store';
import { STAGES_3D } from './timeline';

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
      info: { memory: { geometries: 0, textures: 0 }, programs: [], render: { calls: 0 } },
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
    expect(within(strip).getByRole('button', { name: 'Phân chia tế bào chất' })).toHaveAttribute(
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
      within(parts()).getByRole('button', { name: 'Rãnh phân cắt (eo thắt)' }),
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
    expect(within(parts()).queryByRole('button', { name: 'Rãnh phân cắt (eo thắt)' })).toBeNull();
    expect(useMitosis3D.getState().selected).toBeNull();
    // The scene was rebuilt for the plant cell; the renderer (WebGL context) was kept.
    expect(made).toHaveLength(1);
    expect(made[0]?.dispose).not.toHaveBeenCalled();
    // Picking a part from the list shows its name and function.
    fireEvent.click(within(parts()).getByRole('button', { name: 'Thành tế bào' }));
    expect(screen.getByRole('complementary')).toHaveTextContent(/cellulose/);
  });

  it('cleans up the renderer and the debug hook on unmount', () => {
    const { factory, made } = fakeRenderer();
    const view = render(<Mitosis3DView createRenderer={factory} />);
    expect(window.__simlabMitosis3d?.stage()).toBe('g1');
    view.unmount();
    expect(made[0]?.dispose).toHaveBeenCalled();
    expect(made[0]?.domElement.isConnected).toBe(false);
    expect(window.__simlabMitosis3d).toBeUndefined();
    expect(useMitosis3D.getState().active).toBe(false);
  });

  it('falls back to the 2D picture when WebGL cannot start', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const failing: RendererFactory = () => {
      throw new Error('no WebGL');
    };
    render(<Mitosis3DView createRenderer={failing} />);
    expect(useMitosis3D.getState().webglFailed).toBe(true);
    // The module view now shows the 2D stage with the 3D / 2D switch and a notice.
    render(
      <>
        <MitosisStage />
        <MitosisPanel />
        <MitosisBottom />
      </>,
    );
    expect(screen.getByText(/chưa vẽ được 3D/)).toBeInTheDocument();
    expect(screen.getAllByRole('radio', { name: '2D' }).length).toBeGreaterThan(0);
    vi.restoreAllMocks();
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
