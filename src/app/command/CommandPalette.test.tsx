import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { closeTeacher, useTeacherStore } from '@/teacher/teacherStore';
import { CommandPalette } from './CommandPalette';
import { useCommandPalette } from './commands';

describe('command palette: the AI Teacher pages', () => {
  afterEach(() => {
    closeTeacher();
    useCommandPalette.setState({ open: false });
  });

  it.each([
    ['AI Teacher — giảng trên bảng', 'board'],
    ['AI Teacher — trò chuyện', 'talk'],
  ] as const)('"%s" opens the teacher page in the %s layout', async (label, layout) => {
    useTeacherStore.setState({ layout: layout === 'board' ? 'talk' : 'board' });
    render(<CommandPalette />);
    act(() => {
      useCommandPalette.setState({ open: true });
    });
    fireEvent.click(screen.getByRole('option', { name: new RegExp(label) }));
    await waitFor(() => {
      expect(useTeacherStore.getState().open).toBe(true);
    });
    expect(useTeacherStore.getState().layout).toBe(layout);
  });
});
