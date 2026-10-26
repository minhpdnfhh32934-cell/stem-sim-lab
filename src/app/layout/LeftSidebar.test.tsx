import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useProfileStore } from '@/app/learner/profileStore';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { useProgressStore } from '@/learn/progressStore';
import { LeftSidebar } from './LeftSidebar';

beforeEach(() => {
  useSettingsStore.setState({ locale: 'vi' });
  useProfileStore.setState({ level: 'foundation' });
  useWorkspaceStore.setState({ subject: 'physics' });
  useProgressStore.getState().reset();
});

describe('library marks: learned, steps left, complete', () => {
  it('an opened topic is "Đã học" in every subject; physics also shows the steps left', () => {
    useProgressStore.setState({ visited: { freeFall: true, periodicTable: true, mitosis: true } });
    render(<LeftSidebar />);
    // The mark is a description: the button keeps the topic's name.
    const freeFall = screen.getByRole('button', { name: 'Rơi tự do' });
    expect(freeFall).toHaveAccessibleDescription(
      'Đã học — xong 1/3 bước, còn: Dự đoán trước, 1 thử thách',
    );
    expect(freeFall).toHaveTextContent('1/3');
    // The same text on hover and keyboard focus of the whole row.
    expect(freeFall).toHaveAttribute(
      'data-tip',
      'Đã học — xong 1/3 bước, còn: Dự đoán trước, 1 thử thách',
    );
    expect(screen.getByRole('button', { name: 'Ném ngang' })).not.toHaveAttribute(
      'aria-describedby',
    );
    expect(screen.getByLabelText('1/5 chủ đề đã học')).toHaveTextContent('1/5');

    for (const [subject, topic] of [
      ['chemistry', 'Bảng tuần hoàn'],
      ['biology', 'Nguyên phân'],
    ] as const) {
      act(() => {
        useWorkspaceStore.getState().setSubject(subject);
      });
      expect(screen.getByRole('button', { name: topic })).toHaveAccessibleDescription('Đã học');
    }
  });

  it('while searching, a chapter shows how many topics match, not a partial progress', () => {
    useProgressStore.setState({ visited: { freeFall: true } });
    render(<LeftSidebar />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm chủ đề…' }), {
      target: { value: 'rơi' },
    });
    expect(screen.queryByLabelText(/chủ đề đã học/)).toBeNull();
    expect(screen.getByRole('button', { name: /Động học/ })).toHaveTextContent(/1$/);
  });

  it('every step done → the "Hoàn thành" mark instead of the tick and the count', () => {
    useProgressStore.setState({
      visited: { freeFall: true },
      predictions: { 'freeFall.h0': false },
      challenges: { 'freeFall.t2': 1 },
    });
    render(<LeftSidebar />);
    const freeFall = screen.getByRole('button', { name: 'Rơi tự do' });
    expect(freeFall).toHaveAccessibleDescription('Đã hoàn thành chủ đề');
    expect(freeFall).not.toHaveTextContent('1/3');
    expect(freeFall.querySelector('.tree__mark')).toHaveAttribute('data-state', 'complete');
  });
});
