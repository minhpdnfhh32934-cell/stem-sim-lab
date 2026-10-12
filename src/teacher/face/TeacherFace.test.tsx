import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TeacherFace } from './TeacherFace';

describe('TeacherFace', () => {
  it('renders the teacher face with the requested mood', () => {
    const { container, rerender } = render(<TeacherFace />);
    expect(container.querySelector('.teacher-face')).toHaveAttribute('data-mood', 'idle');
    rerender(<TeacherFace mood="happy" />);
    expect(container.querySelector('.teacher-face')).toHaveAttribute('data-mood', 'happy');
  });

  it('is decorative (the surrounding label names the teacher)', () => {
    const { container } = render(<TeacherFace trackCursor />);
    expect(container.querySelector('svg.teacher-face')).toHaveAttribute('aria-hidden', 'true');
  });

  it('does not crash without matchMedia (jsdom)', async () => {
    const user = userEvent.setup();
    render(<TeacherFace trackCursor />);
    await user.hover(document.body);
    expect(document.querySelector('.teacher-face')).toBeInTheDocument();
  });
});
