import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useProgressStore } from '@/learn/progressStore';
import StudioScreen from '../StudioScreen';
import { useStudioStore } from '../studioStore';

const ID = 'chemistry.chloride-silver-nitrate';
const AGCL_OBSERVATION = 'Kết tủa trắng AgCl (dùng nhận biết ion Cl⁻).';

beforeEach(() => {
  useSettingsStore.setState({ locale: 'vi', uiMode: 'basic' });
  useStudioStore.setState({ tab: 'chemistry', sessions: {} });
  useProgressStore.getState().reset();
});

const next = () => screen.getByRole('button', { name: /^Tiếp:/ });
const tube = () => screen.getByRole('img', { name: /^Ống nghiệm/ });
const alertText = () => screen.getByRole('alert').textContent;

describe('Chemistry Studio bench in the POE flow', () => {
  it('Predict → bench → Observe → Explain → Conclude → Report, every result from the library', async () => {
    const user = userEvent.setup();
    render(<StudioScreen />);
    expect(
      screen.getByRole('heading', { name: 'Nhận biết ion Cl⁻ bằng dung dịch AgNO₃' }),
    ).toBeVisible();
    expect(screen.getByText(/chưa được kiểm duyệt/)).toBeInTheDocument();

    // Predict: required before the bench.
    expect(next()).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: 'Xuất hiện kết tủa' }));
    await user.click(next());

    // Interact: invalid actions are explained, never applied.
    expect(screen.getByRole('heading', { name: 'Làm thí nghiệm' })).toBeVisible();
    expect(tube()).toHaveAccessibleName(/Ống nghiệm trống/);
    await user.click(screen.getByRole('button', { name: 'Lắc để trộn' }));
    expect(alertText()).toBe('Ống nghiệm đang trống — hãy thêm dung dịch trước.');
    await user.click(screen.getByRole('button', { name: 'Thêm dung dịch NaCl' }));
    expect(tube()).toHaveAccessibleName(/Trong ống: Dung dịch NaCl\./);
    await user.click(screen.getByRole('button', { name: 'Thêm dung dịch NaCl' }));
    expect(alertText()).toMatch(/Ống đã có dung dịch NaCl rồi/);
    await user.click(screen.getByRole('button', { name: 'Lắc để trộn' }));
    expect(alertText()).toBe('Cần hai dung dịch trong ống mới trộn được.');

    // A pair without a library record: no guess, and it does not answer the question.
    await user.click(screen.getByRole('button', { name: 'Thêm dung dịch BaCl₂' }));
    await user.click(screen.getByRole('button', { name: 'Lắc để trộn' }));
    expect(screen.getByText(/chưa có trong cơ sở dữ liệu đã kiểm chứng/)).toBeInTheDocument();
    expect(screen.queryByText(/Kết tủa trắng/)).not.toBeInTheDocument();
    expect(next()).toBeDisabled();
    expect(
      screen.getByText('Trộn đúng cặp dung dịch của câu hỏi để có quan sát.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Thêm dung dịch AgNO₃' }));
    expect(alertText()).toBe('Ống đã trộn xong. Rửa ống trước khi thử cặp khác.');

    // The question's pair, added in the opposite order to the steps.
    await user.click(screen.getByRole('button', { name: 'Rửa ống nghiệm' }));
    expect(tube()).toHaveAccessibleName(/Ống nghiệm trống/);
    await user.click(screen.getByRole('button', { name: 'Thêm dung dịch AgNO₃' }));
    await user.click(screen.getByRole('button', { name: 'Thêm dung dịch NaCl' }));
    await user.click(screen.getByRole('button', { name: 'Lắc để trộn' }));
    expect(screen.getByText(AGCL_OBSERVATION)).toBeInTheDocument();
    expect(screen.getByText('AgNO₃ + NaCl → AgCl + NaNO₃')).toBeInTheDocument();
    expect(screen.getByText('Bản ghi thư viện chưa được kiểm duyệt.')).toBeInTheDocument();
    expect(screen.getByText(/thứ tự khác với các bước của bài/)).toBeInTheDocument();
    expect(tube()).toHaveAccessibleName(/Thư viện ghi có kết tủa/);
    expect(useProgressStore.getState().predictions[`studio:${ID}`]).toBe(true);
    expect(next()).toBeEnabled();
    await user.click(next());

    // Observe: both mixes, the question's first, with the record's Science Card.
    expect(screen.getByRole('heading', { name: 'Các lần trộn đã ghi lại' })).toBeVisible();
    const runs = within(screen.getByRole('list', { name: 'Các lần trộn đã ghi lại' })).getAllByRole(
      'listitem',
    );
    expect(runs).toHaveLength(2);
    expect(within(runs[0] as HTMLElement).getByText('Cặp của câu hỏi')).toBeInTheDocument();
    expect(within(runs[0] as HTMLElement).getByText(AGCL_OBSERVATION)).toBeInTheDocument();
    expect(
      within(runs[1] as HTMLElement).getByText(/chưa có trong cơ sở dữ liệu đã kiểm chứng/),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/pH/).length).toBeGreaterThan(0);

    // Explain → Conclude.
    await user.click(next());
    fireEvent.change(screen.getByLabelText('Giải thích của em'), {
      target: { value: 'Thư viện ghi có kết tủa trắng AgCl khi trộn hai dung dịch.' },
    });
    await user.click(next());
    expect(screen.getByText('Kết quả mô phỏng: Xuất hiện kết tủa')).toBeInTheDocument();
    expect(screen.getByText('Dự đoán của em khớp với kết quả mô phỏng.')).toBeInTheDocument();
    expect(screen.getByText(`Hiện tượng theo thư viện: ${AGCL_OBSERVATION}`)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Kết luận của em'), {
      target: { value: 'AgNO₃ dùng để nhận biết ion Cl⁻ vì tạo kết tủa AgCl.' },
    });
    await user.click(next());

    // Report: library text and sources, no measurement table.
    const report = screen.getByLabelText('Bản xem trước báo cáo');
    expect(report).toHaveTextContent('Kết quả từ thư viện dữ liệu của ứng dụng');
    expect(report).toHaveTextContent(AGCL_OBSERVATION);
    expect(report).toHaveTextContent('chưa có trong cơ sở dữ liệu đã kiểm chứng');
    expect(report).not.toHaveTextContent('Số đo từ mô phỏng');
    expect(await within(report).findByText(/Sách giáo khoa Hóa học 10/)).toBeInTheDocument();
    expect(useStudioStore.getState().sessions[ID]?.completedAt).not.toBeNull();
  });

  it('restores the tube from the stored log and locks the prediction after the first mix', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<StudioScreen />);
    await user.click(screen.getByRole('radio', { name: 'Không thấy kết tủa' }));
    await user.click(next());
    await user.click(screen.getByRole('button', { name: 'Thêm dung dịch NaCl' }));
    await user.click(screen.getByRole('button', { name: 'Thêm dung dịch AgNO₃' }));
    await user.click(screen.getByRole('button', { name: 'Lắc để trộn' }));
    expect(useProgressStore.getState().predictions[`studio:${ID}`]).toBe(false);
    unmount();

    render(<StudioScreen />);
    expect(tube()).toHaveAccessibleName(/Đã trộn\./);
    expect(screen.queryByText(/thứ tự khác/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Quay lại' }));
    expect(screen.getByRole('radio', { name: 'Xuất hiện kết tủa' })).toBeDisabled();
    expect(screen.getByText(/Dự đoán đã được ghi lại/)).toBeInTheDocument();
    expect(useStudioStore.getState().sessions[ID]?.verdict?.match).toBe(false);
  });
});
