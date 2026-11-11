import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useProfileStore } from '@/app/learner/profileStore';
import { useNavigationStore } from '@/app/navigationStore';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { useProgressStore } from '@/learn/progressStore';
import { hasScene } from '@/physics/registry';
import { useStudioStore } from '@/studio/studioStore';
import { BenchLibrary } from './Library';
import { useProblemSheet } from './problemSheet';

afterEach(() => {
  act(() => {
    useWorkspaceStore.getState().setSubject('physics');
    useProfileStore.getState().setGrade('all');
    useProblemSheet.setState({ open: false });
  });
});

const titles = () =>
  [...document.querySelectorAll('.shelf-card__title')].map((el) => el.textContent);

describe('"Kệ bài" (docs/BENCH_DESIGN.md §9.3)', () => {
  it('a filter column with the subject radios, shelves of topic cards named by their title', () => {
    act(() => {
      useProfileStore.getState().setGrade('all');
    });
    render(<BenchLibrary />);
    const filters = screen.getByRole('complementary', { name: 'Thư viện chủ đề' });
    expect(within(filters).getByRole('radio', { name: 'Vật lý' })).toBeChecked();
    expect(screen.getByRole('heading', { level: 1, name: 'Hôm nay học gì?' })).toBeInTheDocument();
    expect(titles()).toContain('Ném xiên');
    // A card's button is named by its title only.
    expect(screen.getByRole('button', { name: 'Ném xiên' })).toBeInTheDocument();
    fireEvent.click(within(filters).getByRole('radio', { name: 'Sinh học' }));
    expect(titles()).not.toContain('Ném xiên');
  });

  it('the search narrows the shelves; nothing found offers to clear it', () => {
    render(<BenchLibrary />);
    const search = screen.getByRole('searchbox', { name: 'Tìm chủ đề…' });
    fireEvent.change(search, { target: { value: 'ném xiên' } });
    expect(titles()).toEqual(['Ném xiên']);
    fireEvent.change(search, { target: { value: 'không có chủ đề này' } });
    expect(screen.getByRole('status')).toHaveTextContent('Không tìm thấy');
    fireEvent.click(screen.getByRole('button', { name: 'Xóa tìm kiếm' }));
    expect(titles().length).toBeGreaterThan(5);
    // The button that was clicked is gone: the focus goes back to the search field, emptied.
    expect(search).toHaveFocus();
    expect(search).toHaveValue('');
  });

  it('"Có đề bài?": "Phân tích đề" opens the problem sheet (the screen’s main action)', () => {
    render(<BenchLibrary />);
    fireEvent.click(screen.getByRole('button', { name: 'Phân tích đề' }));
    expect(useProblemSheet.getState().open).toBe(true);
  });

  it('"Có đề bài?": the one-line field is a button that opens the sheet (focus alone does not)', () => {
    render(<BenchLibrary />);
    const field = screen.getByRole('button', { name: 'Gõ hoặc dán đề bài…' });
    act(() => {
      field.focus();
    });
    expect(useProblemSheet.getState().open).toBe(false);
    fireEvent.click(field);
    expect(useProblemSheet.getState().open).toBe(true);
  });

  it('every card has a preview: a physics engine frame, else its subject line art', () => {
    render(<BenchLibrary />);
    const cards = document.querySelectorAll('.shelf-card');
    expect(cards.length).toBeGreaterThan(5);
    for (const c of cards) {
      // A physics lesson without an engine scene (Fourier, a module of its own) gets the line art.
      const id = c.querySelector('.shelf-card__meta')?.id.replace(/^shelf-card-|-desc$/g, '') ?? '';
      const preview = hasScene(id) ? '.shelf-card__preview canvas' : '.shelf-card__preview svg';
      expect(c.querySelector(preview)).not.toBeNull();
    }
    expect(document.querySelectorAll('.shelf-card__preview canvas').length).toBeGreaterThan(5);
    act(() => {
      useWorkspaceStore.getState().setSubject('chemistry');
    });
    for (const c of document.querySelectorAll('.shelf-card'))
      expect(c.querySelector('.shelf-card__preview svg')).not.toBeNull();
  });

  it('Advanced: "Soạn bài" at the bottom of the filters opens Science Studio’s authoring', () => {
    act(() => {
      useSettingsStore.setState({ uiMode: 'advanced' });
    });
    render(<BenchLibrary />);
    fireEvent.click(screen.getByRole('button', { name: 'Soạn bài' }));
    expect(useStudioStore.getState().tab).toBe('authoring');
    expect(useNavigationStore.getState().screen).toBe('studio');
    act(() => {
      useSettingsStore.setState({ uiMode: 'basic' });
      useNavigationStore.setState({ screen: 'lab' });
    });
  });
});

/**
 * The classic library's checks (src/app/layout/LeftSidebar.test.tsx and the grade views of
 * learner.test.tsx, gone with the classic shell in B8), on the shelf. The card marks are "Đã mở" /
 * "Đã xong" without the steps left (§9.3).
 */
describe('"Kệ bài": marks, grade views and searches without a dead end (B8)', () => {
  afterEach(() => {
    act(() => {
      useProgressStore.getState().reset();
    });
  });

  const card = (name: string) => screen.getByRole('button', { name });
  const shelfCount = (chapter: RegExp) =>
    screen.getByRole('heading', { level: 2, name: chapter }).querySelector('.shelf__count');

  it('an opened topic is "Đã mở" in every subject; its chapter counts it', () => {
    act(() => {
      useProgressStore.setState({
        visited: { freeFall: true, periodicTable: true, mitosis: true },
      });
    });
    render(<BenchLibrary />);
    expect(card('Rơi tự do')).toHaveAccessibleDescription(/Đã mở/);
    expect(card('Ném ngang')).not.toHaveAccessibleDescription(/Đã mở/);
    expect(shelfCount(/^Động học/)).toHaveTextContent('1/5 đã mở');
    for (const [subject, topic] of [
      ['Hóa học', 'Bảng tuần hoàn'],
      ['Sinh học', 'Nguyên phân'],
    ] as const) {
      fireEvent.click(screen.getByRole('radio', { name: subject }));
      expect(card(topic)).toHaveAccessibleDescription(/Đã mở/);
    }
  });

  it('while searching, a chapter still counts the whole chapter, never a partial progress', () => {
    act(() => {
      useProgressStore.setState({ visited: { freeFall: true } });
    });
    render(<BenchLibrary />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm chủ đề…' }), {
      target: { value: 'rơi' },
    });
    expect(titles()).toEqual(['Rơi tự do']);
    expect(shelfCount(/^Động học/)).toHaveTextContent('1/5 đã mở');
  });

  it('a physics topic with steps left says "1/3" and what is left (3b.5); others just "Đã mở"', () => {
    act(() => {
      useProgressStore.setState({ visited: { freeFall: true, periodicTable: true } });
    });
    render(<BenchLibrary />);
    expect(card('Rơi tự do')).toHaveAccessibleDescription(
      /Đã mở · 1\/3 bước.*Còn: Dự đoán trước, 1 thử thách/,
    );
    act(() => {
      useProgressStore.setState({ predictions: { 'freeFall.h0': true } });
    });
    expect(card('Rơi tự do')).toHaveAccessibleDescription(/Đã mở · 2\/3 bước.*Còn: 1 thử thách/);
    expect(card('Rơi tự do')).not.toHaveAccessibleDescription(/Dự đoán trước/);
    fireEvent.click(screen.getByRole('radio', { name: 'Hóa học' }));
    expect(card('Bảng tuần hoàn')).toHaveAccessibleDescription(/Đã mở/);
    expect(card('Bảng tuần hoàn')).not.toHaveAccessibleDescription(/bước|Còn:/);
  });

  it('every step done → the "Đã xong" mark instead of "Đã mở"', () => {
    act(() => {
      useProgressStore.setState({
        visited: { freeFall: true },
        predictions: { 'freeFall.h0': false },
        challenges: { 'freeFall.t2': 1 },
      });
    });
    render(<BenchLibrary />);
    expect(card('Rơi tự do')).toHaveAccessibleDescription(/Đã xong/);
    expect(card('Rơi tự do')).not.toHaveAccessibleDescription(/Đã mở/);
    expect(document.querySelector('.shelf-card__mark[data-state="complete"]')).not.toBeNull();
  });

  it('a grade shows its topics by textbook chapter, with lessons and the pending label', () => {
    render(<BenchLibrary />);
    const grades = screen.getByRole('radiogroup', { name: 'Lớp' });
    expect(
      within(grades)
        .getAllByRole('radio')
        .map((r) => r.textContent),
    ).toEqual(['Lớp 10', 'Lớp 11', 'Lớp 12', 'Tất cả']);
    fireEvent.click(within(grades).getByRole('radio', { name: 'Lớp 10' }));
    expect(useProfileStore.getState().grade).toBe(10);
    expect(card('Chuyển động thẳng đều')).toHaveAccessibleDescription(
      /Bài 4–5, 7 · chờ giáo viên duyệt/,
    );
    // Found only in another subject: a way there (the periodic table is grade 10 chemistry).
    const search = screen.getByRole('searchbox', { name: 'Tìm chủ đề…' });
    fireEvent.change(search, { target: { value: 'tuần hoàn' } });
    fireEvent.click(screen.getByRole('button', { name: 'Có 1 chủ đề ở Hóa học' }));
    expect(useWorkspaceStore.getState().subject).toBe('chemistry');
    expect(card('Bảng tuần hoàn')).toHaveAccessibleDescription(/Bài 5–6, 8/);
    // Unplaced topics are only under "Tất cả"; the search looks in the view shown.
    fireEvent.click(screen.getByRole('radio', { name: 'Vật lý' }));
    fireEvent.change(search, { target: { value: '' } });
    expect(screen.queryByRole('button', { name: 'Mặt phẳng nghiêng' })).toBeNull();
    fireEvent.change(search, { target: { value: 'nghiêng' } });
    expect(screen.getByRole('status')).toHaveTextContent('Không tìm thấy');
    fireEvent.click(screen.getByRole('button', { name: 'Xem tất cả' }));
    expect(useProfileStore.getState().grade).toBe('all');
    // The button that was clicked is gone: the focus stays in the library.
    expect(within(grades).getByRole('radio', { name: 'Tất cả' })).toHaveFocus();
    expect(card('Mặt phẳng nghiêng')).toBeInTheDocument();
  });

  it('a grade without topics in the subject is no dead end: "Xem tất cả"', () => {
    act(() => {
      useProfileStore.getState().setGrade(11);
      useWorkspaceStore.getState().setSubject('biology');
    });
    render(<BenchLibrary />);
    expect(
      screen.getByText('Chưa có chủ đề Sinh học nào được xếp vào lớp 11.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xóa tìm kiếm' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Xem tất cả' }));
    expect(card('Nguyên phân')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Tất cả' })).toHaveFocus();
  });
});
