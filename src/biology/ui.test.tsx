import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { L } from './common';
import { Segmented } from './ui';

const OPTIONS = [
  { id: 'a', label: L('Một', 'One') },
  { id: 'b', label: L('Hai', 'Two') },
  { id: 'c', label: L('Ba', 'Three') },
];

function Controlled({ onChange }: { onChange?: (v: string) => void }) {
  const [value, setValue] = useState('a');
  return (
    <>
      <button type="button">before</button>
      <Segmented
        label={L('Chọn', 'Pick')}
        value={value}
        options={OPTIONS}
        onChange={(v) => {
          setValue(v);
          onChange?.(v);
        }}
      />
      <button type="button">after</button>
    </>
  );
}

describe('Segmented (radio group)', () => {
  it('one tab stop: Tab reaches the checked radio only', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.tab();
    expect(screen.getByRole('button', { name: 'before' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('radio', { name: 'Một' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'after' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'Hai' })).toHaveAttribute('tabindex', '-1');
  });

  it('arrow keys move the focus and the choice, wrapping around; Home and End jump', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    screen.getByRole('radio', { name: 'Một' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Hai' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'Hai' })).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'Ba' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Một' })).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Ba' })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('radio', { name: 'Hai' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('radio', { name: 'Một' })).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{End}');
    expect(screen.getByRole('radio', { name: 'Ba' })).toHaveAttribute('aria-checked', 'true');
    expect(onChange.mock.calls.map((c) => c[0] as string)).toEqual([
      'b',
      'c',
      'a',
      'c',
      'b',
      'a',
      'c',
    ]);
    // The checked radio is the group's only tab stop.
    expect(screen.getByRole('radio', { name: 'Ba' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Một' })).toHaveAttribute('tabindex', '-1');
  });

  it('a click still chooses', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: 'Ba' }));
    expect(onChange).toHaveBeenCalledWith('c');
    expect(screen.getByRole('radio', { name: 'Ba' })).toHaveAttribute('aria-checked', 'true');
  });
});
