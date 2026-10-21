import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LandingScreen } from '@/app/learner/LandingScreen';
import { LeftSidebar } from '@/app/layout/LeftSidebar';
import { useNavigationStore } from '@/app/navigationStore';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useProgressStore } from '@/learn/progressStore';
import { fmtQty } from '@/physics/common/tex';
import { freeFall } from '@/physics/projectile/scenes';
import StudioScreen from '../StudioScreen';
import { useStudioStore } from '../studioStore';

// uPlot needs a real canvas; the chart's data is checked in comparison.test.ts.
vi.mock('@/ui/charts/XYChart', () => ({
  XYChart: (p: { x: number[]; series: { label: string }[] }) => (
    <div data-testid="xy-chart" data-points={p.x.length} data-series={p.series.length} />
  ),
}));

beforeEach(() => {
  useSettingsStore.setState({ locale: 'vi', uiMode: 'basic' });
  useStudioStore.setState({ tab: 'physics', sessions: {} });
  useProgressStore.getState().reset();
});

describe('Science Studio entry', () => {
  it('the launch page has no Science Studio card; the lab sidebar opens the studio', async () => {
    const user = userEvent.setup();
    const landing = render(<LandingScreen />);
    // User decision 2026-10-20: two entries only, Science Studio lives inside the lab.
    expect(
      screen.getAllByRole('button').map((b) => b.querySelector('strong')?.textContent),
    ).toEqual(['Phòng thí nghiệm', 'AI Teacher']);
    expect(screen.queryByRole('button', { name: /Science Studio/ })).toBeNull();
    landing.unmount();
    useNavigationStore.setState({ screen: 'lab' });
    render(<LeftSidebar />);
    await user.click(screen.getByRole('button', { name: /Science Studio/ }));
    expect(useNavigationStore.getState().screen).toBe('studio');
    expect(screen.getByRole('button', { name: /Science Studio/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('authoring lists the local scenarios (none yet, no fake content); biology has its lesson', async () => {
    const user = userEvent.setup();
    render(<StudioScreen />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Hóa học',
      'Sinh học',
      'Vật lí',
      'Soạn bài',
    ]);
    await user.click(screen.getByRole('tab', { name: 'Soạn bài' }));
    expect(screen.getByRole('button', { name: 'Tạo bài mới' })).toBeVisible();
    expect(screen.getByText(/Chưa có bài nào/)).toBeVisible();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Sinh học' }));
    expect(screen.queryByText('Đang chuẩn bị')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Nguyên phân 3D/ })).toBeVisible();
  });
});

describe('POE flow with the physics slice', () => {
  it('Predict → Interact → Observe → Explain → Conclude → Report, numbers from the engine', async () => {
    const user = userEvent.setup();
    render(<StudioScreen />);
    expect(screen.getByRole('heading', { name: 'Rơi tự do: thả từ độ cao gấp đôi' })).toBeVisible();
    expect(screen.getByText(/chưa được kiểm duyệt/)).toBeInTheDocument();

    // Predict: cannot continue without a prediction.
    const next = () => screen.getByRole('button', { name: /^Tiếp:/ });
    expect(next()).toBeDisabled();
    expect(screen.getByText('Chọn một dự đoán để đi tiếp.')).toBeInTheDocument();
    const sqrt2 = await screen.findByRole('radio', { name: /√2/ });
    await user.click(sqrt2);
    expect(sqrt2).toHaveAttribute('aria-checked', 'true');
    await user.click(next());

    // Interact: run the engine for A and B.
    expect(screen.getByRole('heading', { name: 'Làm thí nghiệm' })).toBeVisible();
    expect(next()).toBeDisabled();
    expect(await screen.findByRole('slider')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Chạy thí nghiệm' }));
    // The learner stays on the experiment (as in chemistry and biology): the result is announced
    // and "Tiếp: Quan sát" moves on.
    expect(await screen.findByText(/Đã có số đo của cả hai điều kiện/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Làm thí nghiệm' })).toBeVisible();
    expect(next()).toBeEnabled();
    await user.click(next());

    // Observe: the table shows the engine values (equal to solve() within 1e-9).
    expect(await screen.findByRole('heading', { name: 'Quan sát số đo và đồ thị' })).toBeVisible();
    const g = useSettingsStore.getState().defaultGravity;
    const tA = freeFall.solve({ ...freeFall.defaults, h0: 45, v0: 0, g }, 'vi').answers[0];
    const tB = freeFall.solve({ ...freeFall.defaults, h0: 90, v0: 0, g }, 'vi').answers[0];
    const table = screen.getByRole('table');
    const row = within(table).getByRole('row', { name: /^Thời gian chuyển động/ });
    expect(row).toHaveTextContent(fmtQty('vi', tA?.value ?? NaN, 's'));
    expect(row).toHaveTextContent(fmtQty('vi', tB?.value ?? NaN, 's'));
    expect(within(table).getByRole('row', { name: /Tỉ số B\/A/ })).toHaveTextContent('1,414');
    expect(await screen.findByTestId('xy-chart')).toHaveAttribute('data-series', '2');
    expect(screen.getByRole('button', { name: 'Chạy A trong Phòng thí nghiệm' })).toBeVisible();
    expect(useProgressStore.getState().predictions['freeFall.h0']).toBe(true);

    // Explain: at least 20 characters of the learner's own words.
    await user.click(next());
    expect(next()).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Giải thích của em'), {
      target: { value: 'Thời gian tăng chậm hơn độ cao vì t tỉ lệ với căn h.' },
    });
    await user.click(screen.getByRole('button', { name: 'Xem gợi ý 1' }));
    expect(screen.getByText(/Gợi ý 1:/)).toBeInTheDocument();
    await user.click(next());

    // Conclude: prediction vs. computed outcome, then the reference conclusion.
    expect(screen.getByText('Dự đoán của em khớp với kết quả mô phỏng.')).toBeInTheDocument();
    expect(screen.queryByText('Kết luận tham khảo')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Kết luận của em'), {
      target: { value: 'Độ cao gấp đôi thì thời gian rơi tăng √2 lần.' },
    });
    expect(screen.getByText('Kết luận tham khảo')).toBeInTheDocument();
    await user.click(next());

    // Report: built from this session; marked complete.
    expect(screen.getByText('Em đã hoàn thành bài học này.')).toBeInTheDocument();
    const report = screen.getByLabelText('Bản xem trước báo cáo');
    expect(report).toHaveTextContent('Số đo từ mô phỏng');
    expect(report).toHaveTextContent(fmtQty('vi', tA?.value ?? NaN, 's'));
    expect(report).toHaveTextContent('Độ cao gấp đôi thì thời gian rơi tăng √2 lần.');
    expect(
      useStudioStore.getState().sessions['physics.free-fall-height']?.completedAt,
    ).not.toBeNull();
  });

  it('changing the variable after a run sends the learner back to run again', async () => {
    const user = userEvent.setup();
    render(<StudioScreen />);
    await user.click(await screen.findByRole('radio', { name: /√2/ }));
    await user.click(screen.getByRole('button', { name: /^Tiếp:/ }));
    await user.click(await screen.findByRole('button', { name: 'Chạy thí nghiệm' }));
    await screen.findByText(/Đã có số đo của cả hai điều kiện/);
    await user.click(screen.getByRole('button', { name: /^Tiếp:/ }));
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Quay lại' }));
    act(() => {
      fireEvent.change(screen.getByRole('slider'), { target: { value: '20' } });
    });
    const s = useStudioStore.getState().sessions['physics.free-fall-height'];
    expect(s?.verdict).toBeNull();
    expect(s?.evidence.filter((e) => e.kind === 'engine')).toEqual([]);
    expect(screen.getByRole('button', { name: /^Tiếp:/ })).toBeDisabled();
    // The prediction stays the learner's first one.
    expect(s?.prediction?.choice).toBe('1');
  });
});
