import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { closeModule, openModule, useModuleStore } from '@/modules/moduleStore';
import { Stage } from './Stage';

beforeEach(() => {
  useSettingsStore.setState({ locale: 'vi' });
});

afterEach(() => {
  act(() => {
    closeModule();
    useModuleStore.setState({ active: null, requested: null, loading: false, error: null });
  });
});

const frame = (name: string) => screen.getByRole('region', { name });

describe('the stage frame of a module', () => {
  it('a descriptive textbook lesson is a lesson, never a simulation, while it loads or fails', () => {
    act(() => {
      useModuleStore.setState({ requested: 'levelsOfLife', loading: true, error: null });
    });
    const { container, rerender } = render(<Stage />);
    expect(frame('Khung bài học')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải bài học…');
    expect(container.textContent).not.toMatch(/mô phỏng/i);

    act(() => {
      useModuleStore.setState({ loading: false, error: 'boom' });
    });
    rerender(<Stage />);
    expect(screen.getByRole('alert')).toHaveTextContent('Không mở được bài học: boom');
    expect(container.textContent).not.toMatch(/mô phỏng/i);
  });

  it('every other module keeps its simulation frame', () => {
    act(() => {
      useModuleStore.setState({ requested: 'atomStructure', loading: true, error: null });
    });
    render(<Stage />);
    expect(frame('Khung mô phỏng')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải mô phỏng…');
  });

  it('opening a module records which topic was asked for; closing forgets it', async () => {
    await act(() => openModule('levelsOfLife'));
    expect(useModuleStore.getState()).toMatchObject({
      requested: 'levelsOfLife',
      active: { id: 'levelsOfLife' },
    });
    render(<Stage />);
    expect(frame('Khung bài học')).toBeInTheDocument();
    act(() => {
      closeModule();
    });
    expect(useModuleStore.getState().requested).toBeNull();
  });
});
