import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TERMS_VERSION } from '@/safety/safety';
import { useSafetyStore } from '@/safety/safetyStore';
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

describe('command palette: AI Teacher follows the launch page’s age lock', () => {
  afterEach(() => {
    useCommandPalette.setState({ open: false });
  });

  const teacherCommands = () => {
    render(<CommandPalette />);
    act(() => {
      useCommandPalette.setState({ open: true });
    });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'AI Teacher' } });
    return screen.queryAllByRole('option', { name: /AI Teacher —/ }).map((o) => o.textContent);
  };

  it('under 18 (the door is locked): no command opens AI Teacher', () => {
    useSafetyStore.setState({
      status: { termsVersion: TERMS_VERSION, answered: true, aiAllowed: false, minor: true },
    });
    expect(teacherCommands()).toEqual([]);
  });

  it('18 and over: both pages are offered', () => {
    useSafetyStore.setState({
      status: { termsVersion: TERMS_VERSION, answered: true, aiAllowed: true, minor: false },
    });
    const found = teacherCommands();
    expect(found.some((t) => t.includes('AI Teacher — trò chuyện'))).toBe(true);
    expect(found.some((t) => t.includes('AI Teacher — giảng trên bảng'))).toBe(true);
  });
});

describe('command palette: Virtual Lab', () => {
  afterEach(() => {
    useCommandPalette.setState({ open: false });
  });

  it('is still found by its old name "Phòng thí nghiệm"', () => {
    render(<CommandPalette />);
    act(() => {
      useCommandPalette.setState({ open: true });
    });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'phòng thí nghiệm' } });
    expect(screen.getByRole('option', { name: /Virtual Lab/ })).toBeVisible();
  });
});
