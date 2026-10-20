import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { physicsFreeFall } from '../scenarios/physicsFreeFall';
import StudioScreen from '../StudioScreen';
import { useStudioStore } from '../studioStore';
import { useAuthoringStore } from './authoringStore';
import { asTeacherContent } from './fileFormat';

// jsdom has no WebGL or canvas: the 3D model and uPlot are stubbed as in the studio flow tests.
vi.mock('@/biology/division/views', () => ({
  MitosisStage: () => <div role="img" aria-label="Mô hình nguyên phân (thử)" />,
}));
vi.mock('@/ui/charts/XYChart', () => ({ XYChart: () => <div data-testid="xy-chart" /> }));

beforeEach(() => {
  useSettingsStore.setState({ locale: 'vi', uiMode: 'basic' });
  useStudioStore.setState({ tab: 'authoring', sessions: {}, picked: {} });
  useAuthoringStore.setState({ scenarios: [] });
});

function typeIn(group: string, text: string) {
  const box = within(screen.getByRole('group', { name: group })).getByLabelText('Tiếng Việt');
  fireEvent.change(box, { target: { value: text } });
}

describe('Soạn bài', () => {
  it('creates a biology scenario, refuses it while incomplete, then previews it in the Biology studio', async () => {
    const user = userEvent.setup();
    render(<StudioScreen />);
    expect(screen.getByText(/Chưa có bài nào/)).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Tạo bài mới' }));
    const pick = screen.getByRole('group', { name: 'Chọn môn cho bài mới' });
    await user.click(within(pick).getByRole('button', { name: 'Sinh học' }));
    expect(screen.getByRole('heading', { name: 'Bài mới — Sinh học' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Lưu bài' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Hãy đặt tên bài (tiếng Việt).');
    expect(alert).toHaveTextContent('Hãy viết câu hỏi dự đoán (tiếng Việt).');

    // Engine choices: plant cell; the parts list is the model's own list for that cell.
    await user.click(screen.getByRole('button', { name: 'Tế bào thực vật' }));
    expect(screen.getByRole('checkbox', { name: 'Thành tế bào' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Trung thể/ })).not.toBeInTheDocument();

    typeIn('Tên bài', 'Kì giữa ở tế bào thực vật');
    typeIn('Mục tiêu', 'Tìm kì mà NST xếp hàng');
    typeIn('Kết luận mong đợi', 'Ở kì giữa các NST kép xếp thành một hàng.');
    typeIn('Câu hỏi dự đoán', 'Ở kì nào các NST xếp thành một hàng?');
    await user.click(screen.getByRole('button', { name: 'Lưu bài' }));

    const list = await screen.findByRole('list', { name: 'Bài đã soạn' });
    const item = within(list).getByRole('listitem');
    expect(within(item).getByRole('heading', { name: 'Kì giữa ở tế bào thực vật' })).toBeVisible();
    expect(within(item).getByText(/Nội dung do giáo viên soạn/)).toBeVisible();
    const saved = useAuthoringStore.getState().scenarios[0];
    expect(saved?.binding.kind === 'biology' && saved.binding.cellType).toBe('plant');

    await user.click(within(item).getByRole('button', { name: 'Xem trước' }));
    expect(screen.getByRole('tab', { name: 'Sinh học' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Kì giữa ở tế bào thực vật' })).toBeVisible();
    expect(screen.getByText(/Nội dung do giáo viên soạn/)).toBeVisible();
    // The built-in lesson is still listed next to the authored one.
    const picker = screen.getByRole('group', { name: 'Chọn bài học' });
    expect(within(picker).getAllByRole('button')).toHaveLength(2);
    expect(
      within(picker).getByRole('button', { name: 'Kì giữa ở tế bào thực vật' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('previews a physics scenario in the Physics studio; duplicate and delete', async () => {
    const user = userEvent.setup();
    const s = asTeacherContent({ ...physicsFreeFall, id: 'teacher.physics.roi' });
    useAuthoringStore.setState({ scenarios: [s] });
    render(<StudioScreen />);

    await user.click(screen.getByRole('button', { name: 'Nhân bản' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    const copy = screen.getAllByRole('listitem')[1];
    if (!copy) throw new Error('copy');
    await user.click(within(copy).getByRole('button', { name: 'Xóa' }));
    await user.click(within(copy).getByRole('button', { name: 'Xóa hẳn bài này' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Xem trước' }));
    expect(screen.getByRole('tab', { name: 'Vật lí' })).toHaveAttribute('aria-selected', 'true');
    expect(useStudioStore.getState().picked.physics).toBe(s.id);
    expect(screen.getByRole('list', { name: 'Các bước của bài học' })).toBeVisible();
  });

  it('a lesson that cannot be stored is not shown, and the teacher is told why', async () => {
    const user = userEvent.setup();
    const s = asTeacherContent({ ...physicsFreeFall, id: 'teacher.physics.roi' });
    useAuthoringStore.setState({ scenarios: [s] });
    render(<StudioScreen />);
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    try {
      await user.click(screen.getByRole('button', { name: 'Nhân bản' }));
    } finally {
      setItem.mockRestore();
    }
    const lessons = () => within(screen.getByRole('list', { name: 'Bài đã soạn' }));
    expect(lessons().getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent('Không ghi được vào bộ nhớ của ứng dụng');
    await user.click(screen.getByRole('button', { name: 'Nhân bản' }));
    expect(lessons().getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('editing a physics scenario shows the scene range and refuses an out-of-range start value', async () => {
    const user = userEvent.setup();
    useAuthoringStore.setState({
      scenarios: [asTeacherContent({ ...physicsFreeFall, id: 'teacher.physics.roi' })],
    });
    render(<StudioScreen />);
    await user.click(screen.getByRole('button', { name: 'Sửa' }));
    const h0 = await screen.findByLabelText(/^Giá trị ban đầu \(m\)$/, {}, { timeout: 3000 });
    expect(screen.getByText('Từ 0,1 đến 100 m')).toBeInTheDocument();
    fireEvent.change(h0, { target: { value: '150' } });
    await user.click(screen.getByRole('button', { name: 'Lưu bài' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('phải từ 0,1 đến 100 m');
  });
});
