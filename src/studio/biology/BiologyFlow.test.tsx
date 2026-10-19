import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { COMPONENTS, type ComponentId } from '@/biology/division/mitosis3d/components';
import { timelineFor, useMitosis3D } from '@/biology/division/mitosis3d/store';
import type { Stage3D } from '@/biology/division/mitosis3d/timeline';
import { useDivisionStore } from '@/biology/division/state';
import { useProgressStore } from '@/learn/progressStore';
import StudioScreen from '../StudioScreen';
import { useStudioStore } from '../studioStore';

// jsdom has no WebGL: the mitosis picture is replaced by a stub. Picking a part goes through
// the same store the 3D tap writes (`useMitosis3D.selected`), and the real parts list is used.
vi.mock('@/biology/division/views', () => ({
  MitosisStage: () => <div role="img" aria-label="Mô hình nguyên phân (thử)" />,
}));

const ID = 'biology.mitosis-equator';
const TASKS: ComponentId[] = ['membrane', 'nucleus', 'nuclearEnvelope', 'nucleolus', 'spindle'];

beforeEach(() => {
  useSettingsStore.setState({ locale: 'vi', uiMode: 'basic' });
  useStudioStore.setState({ tab: 'biology', sessions: {} });
  useProgressStore.getState().reset();
  useMitosis3D.setState({ t: 0, selected: null, active: false, playing: false });
  useDivisionStore.setState({ pairs: 3, cellType: 'plant', view3d: false });
});

const next = () => screen.getByRole('button', { name: /^Tiếp:/ });
const name = (id: ComponentId) => COMPONENTS[id].name.vi;

/** The 3D view on screen at a stage's key moment (what its stage buttons do). */
function show(stage: Stage3D) {
  const d = useDivisionStore.getState();
  act(() => {
    useMitosis3D.setState({ active: true, t: timelineFor(d.pairs, d.cellType).keyTime(stage) });
  });
}

/** Picks a part in the parts list (it is not already selected). */
async function pick(user: ReturnType<typeof userEvent.setup>, id: ComponentId) {
  const list = screen.getByRole('group', { name: 'Bộ phận tế bào' });
  await user.click(within(list).getByRole('button', { name: name(id) }));
}

const answer = (n: number) =>
  screen.getByRole('button', { name: new RegExp(`^Trả lời chức năng ${String(n)} `) });

describe('Biology Studio on the 3D mitosis model', () => {
  it('Predict → model (stages + find the parts) → Observe → Explain → Conclude → Report', async () => {
    const user = userEvent.setup();
    render(<StudioScreen />);
    expect(screen.getByRole('heading', { name: /^Nguyên phân 3D/ })).toBeVisible();
    expect(screen.getByText(/chưa được kiểm duyệt/)).toBeInTheDocument();

    // Predict: choices are the model's stage names.
    expect(next()).toBeDisabled();
    expect(screen.getAllByRole('radio')).toHaveLength(7);
    await user.click(screen.getByRole('radio', { name: 'Kì đầu' }));
    await user.click(next());

    // Interact: the model opens on the lesson's cell (2n = 4, animal, 3D).
    expect(screen.getByRole('img', { name: 'Mô hình nguyên phân (thử)' })).toBeInTheDocument();
    expect(useDivisionStore.getState()).toMatchObject({
      pairs: 2,
      cellType: 'animal',
      view3d: true,
    });
    // The lesson holds that cell: the view's cell type control is locked, with a note.
    expect(useMitosis3D.getState().cellLocked).toBe(true);
    expect(
      screen.getByText(/Bài học giữ mô hình ở tế bào động vật, 2n = 4: nút "Loại tế bào" bị khoá/),
    ).toBeInTheDocument();

    // A stage that does not answer the question: kept, no verdict.
    show('anaphase');
    expect(screen.getByText('Kì đang xem: Kì sau')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ghi lại kì này' }));
    const onPlane = () =>
      document.querySelector('[data-quantity="onPlane"] dd')?.textContent ?? null;
    expect(onPlane()).toBe('0');
    expect(screen.getByText(/Kì này chưa trả lời câu hỏi dự đoán/)).toBeInTheDocument();
    expect(next()).toBeDisabled();
    expect(
      screen.getByText('Ghi lại kì trả lời câu hỏi dự đoán để có quan sát.'),
    ).toBeInTheDocument();

    // The stage the model singles out sets the verdict.
    show('metaphase');
    await user.click(screen.getByRole('button', { name: 'Ghi lại kì này' }));
    expect(onPlane()).toBe('4');
    expect(screen.getByText(/Đã có quan sát trả lời câu hỏi dự đoán/)).toBeInTheDocument();
    expect(useProgressStore.getState().predictions[`studio:${ID}`]).toBe(false);
    expect(next()).toBeDisabled();
    expect(screen.getByText('Trả lời đủ các chức năng rồi bấm "Kiểm tra".')).toBeInTheDocument();

    // Find the parts: functions come from COMPONENTS; answers are the selected part.
    for (const id of TASKS) expect(screen.getByText(COMPONENTS[id].role.vi)).toBeInTheDocument();
    expect(answer(1)).toBeDisabled();
    // Task 1 (cell membrane) answered wrongly with the nucleus.
    await pick(user, 'nucleus');
    expect(screen.getByText(`Bộ phận đang chọn: ${name('nucleus')}`)).toBeInTheDocument();
    await user.click(answer(1));
    await user.click(answer(2));
    await pick(user, 'nuclearEnvelope');
    await user.click(answer(3));
    await pick(user, 'nucleolus');
    await user.click(answer(4));
    // A tap in the 3D view writes the same selection.
    act(() => {
      useMitosis3D.setState({ selected: { component: 'spindle' } });
    });
    await user.click(answer(5));
    await user.click(screen.getByRole('button', { name: 'Kiểm tra' }));
    expect(screen.getByText(/Đúng 4\/5\./)).toBeInTheDocument();
    expect(screen.getAllByText('Chưa đúng')).toHaveLength(1);
    expect(next()).toBeEnabled();

    // Changing an answer drops the check until it is redone.
    await pick(user, 'membrane');
    await user.click(answer(1));
    expect(next()).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Kiểm tra' }));
    expect(screen.getByText(/Đúng 5\/5\./)).toBeInTheDocument();
    await user.click(next());
    // Leaving the model gives the learner's own settings back.
    expect(useDivisionStore.getState()).toMatchObject({
      pairs: 3,
      cellType: 'plant',
      view3d: false,
    });
    expect(useMitosis3D.getState().cellLocked).toBe(false);

    // Observe: the answering stage first, its counts and stage note, the check, the card.
    const runs = within(screen.getByRole('list', { name: 'Các kì đã ghi lại' })).getAllByRole(
      'listitem',
    );
    expect(runs).toHaveLength(2);
    expect(within(runs[0] as HTMLElement).getByText('Trả lời câu hỏi')).toBeInTheDocument();
    expect(within(runs[0] as HTMLElement).getByText(/tập trung thành 1 hàng/)).toBeInTheDocument();
    const check = screen.getByRole('region', { name: 'Tìm bộ phận theo chức năng' });
    expect(within(check).getAllByText(/^Đúng\. Em chọn:/)).toHaveLength(5);
    expect(screen.getByText(/Nguyên phân 3D — tế bào động vật/)).toBeInTheDocument();

    // Explain → Conclude.
    await user.click(next());
    fireEvent.change(screen.getByLabelText('Giải thích của em'), {
      target: { value: 'Ở kì giữa mọi tâm động nằm trên mặt phẳng xích đạo.' },
    });
    await user.click(next());
    expect(screen.getByText('Kết quả mô phỏng: Kì giữa')).toBeInTheDocument();
    expect(screen.getByText(/Dự đoán chưa khớp/)).toBeInTheDocument();
    expect(
      screen.getByText('Theo mô hình, ở Kì giữa: 4/4 tâm động nằm trên mặt phẳng xích đạo.'),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Kết luận của em'), {
      target: { value: 'NST kép xếp hàng ở mặt phẳng xích đạo vào kì giữa.' },
    });
    await user.click(next());

    // Report: model counts, data texts and the model's sources.
    const report = screen.getByLabelText('Bản xem trước báo cáo');
    expect(report).toHaveTextContent('Số đo từ mô phỏng');
    expect(report).toHaveTextContent('Người học chọn: Kì đầu');
    expect(report).toHaveTextContent('kết quả kiểm tra tự động của ứng dụng');
    expect(report).toHaveTextContent(COMPONENTS.spindle.role.vi);
    expect(await within(report).findByText(/Sách giáo khoa Sinh học 10/)).toBeInTheDocument();
    expect(useStudioStore.getState().sessions[ID]?.completedAt).not.toBeNull();
  });

  it('records only the lesson cell; the learner settings come back when the lesson closes', async () => {
    const user = userEvent.setup();
    useMitosis3D.setState({ t: 7, camera: 'closeup' });
    const { unmount } = render(<StudioScreen />);
    await user.click(screen.getByRole('radio', { name: 'Kì giữa' }));
    await user.click(next());
    expect(useMitosis3D.getState().cellLocked).toBe(true);
    const engineRecords = () =>
      (useStudioStore.getState().sessions[ID]?.evidence ?? []).filter((e) => e.kind === 'engine');

    // Should the shared view ever show another cell, its stages are not recorded.
    act(() => {
      useDivisionStore.setState({ cellType: 'plant' });
    });
    show('metaphase');
    const record = screen.getByRole('button', { name: 'Ghi lại kì này' });
    expect(record).toBeDisabled();
    expect(screen.getByText(/tế bào khác với bài học/)).toBeInTheDocument();
    expect(engineRecords()).toHaveLength(0);

    act(() => {
      useDivisionStore.setState({ cellType: 'animal' });
    });
    await user.click(record);
    expect(engineRecords()).toHaveLength(1);
    expect(useStudioStore.getState().sessions[ID]?.verdict?.match).toBe(true);

    unmount();
    expect(useDivisionStore.getState()).toMatchObject({
      pairs: 3,
      cellType: 'plant',
      view3d: false,
      playing: false,
    });
    expect(useMitosis3D.getState()).toMatchObject({ cellLocked: false, t: 7, camera: 'closeup' });
  });

  it('keeps answers and observations when the lesson is reopened; the prediction stays locked', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<StudioScreen />);
    await user.click(screen.getByRole('radio', { name: 'Kì giữa' }));
    await user.click(next());
    show('metaphase');
    await user.click(screen.getByRole('button', { name: 'Ghi lại kì này' }));
    expect(useProgressStore.getState().predictions[`studio:${ID}`]).toBe(true);
    await pick(user, 'spindle');
    await user.click(answer(5));
    unmount();

    render(<StudioScreen />);
    expect(screen.getByText(`Em chọn: ${name('spindle')}`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kiểm tra' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Quay lại' }));
    expect(screen.getByRole('radio', { name: 'Kì đầu' })).toBeDisabled();
    expect(screen.getByText(/Dự đoán đã được ghi lại/)).toBeInTheDocument();
    expect(useStudioStore.getState().sessions[ID]?.verdict?.match).toBe(true);
  });
});
