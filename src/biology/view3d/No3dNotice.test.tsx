import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { No3dNotice } from './No3dNotice';

describe('the 2D notice', () => {
  it('says why the 2D picture shows, with nothing to press', () => {
    render(<No3dNotice text="Máy đang chạy chậm" />);
    expect(screen.getByText('Máy đang chạy chậm')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
