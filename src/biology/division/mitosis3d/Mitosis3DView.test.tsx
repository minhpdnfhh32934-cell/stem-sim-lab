import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDivisionStore } from '../state';
import { MitosisBottom, MitosisPanel, MitosisStage } from '../views';
import { Mitosis3DView, type RendererFactory, type RendererLike } from './Mitosis3DView';
import { Mitosis3DParts } from './panels';
import { timelineFor, useMitosis3D } from './store';

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
  useDivisionStore.setState({ pairs: 2, index: 0, cellType: 'animal', view3d: true, speed: 1 });
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

const stageLabel = () => screen.getByRole('img').getAttribute('aria-label') ?? '';

describe('Mitosis3DView', () => {
  it('renders the controls with accessible names', () => {
    const { factory } = fakeRenderer();
    render(<Mitosis3DView createRenderer={factory} />);
    for (const name of ['Kì trước', 'Phát', 'Kì tiếp theo', 'Phát lại từ đầu', 'Đặt lại góc nhìn'])
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    for (const name of ['Động vật', 'Thực vật', '3D', '2D', 'Toàn cảnh', 'Cận cảnh NST', '1×'])
      expect(screen.getByRole('radio', { name })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '0,5×' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kì trước' })).toBeDisabled();
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
    fireEvent.click(screen.getByRole('button', { name: 'Kì tiếp theo' }));
    expect(stageLabel()).toMatch(/^Kì sau\. /);
    expect(screen.getByText('1 tế bào · 8 NST đơn')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Kì tiếp theo' }));
    expect(stageLabel()).toMatch(/^Kì cuối\. /);
    expect(screen.getByText('1 tế bào · 2 nhân · mỗi nhân 4 NST đơn')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Kì tiếp theo' }));
    expect(stageLabel()).toMatch(/^Phân chia tế bào chất\. /);
    expect(
      screen.getByText('Sau khi chia: 2 tế bào con · mỗi tế bào 4 NST đơn'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kì tiếp theo' })).toBeDisabled();
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
});
