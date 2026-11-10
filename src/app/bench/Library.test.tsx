import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useProfileStore } from '@/app/learner/profileStore';
import { useNavigationStore } from '@/app/navigationStore';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
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
    for (const c of cards) expect(c.querySelector('.shelf-card__preview canvas')).not.toBeNull();
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
