import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActionRow, ChoiceGroup, LabeledNumber } from './ModuleControls';

describe('module controls', () => {
  it('a choice group checks one radio and reports the pick; a labelled number shows its name', () => {
    const pick = vi.fn();
    const load = vi.fn();
    render(
      <>
        <ChoiceGroup
          label="Quá trình"
          items={['a', 'b']}
          value="b"
          name={(t) => t.toUpperCase()}
          onPick={pick}
        />
        <ActionRow label="Bài tập" items={['x']} name={() => 'Ví dụ'} onPick={load} />
        <LabeledNumber label="Áp suất p₁" value={1} onChange={() => undefined} />
      </>,
    );
    expect(screen.getByRole('radio', { name: 'B' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: 'A' }));
    expect(pick).toHaveBeenCalledWith('a');
    fireEvent.click(screen.getByRole('button', { name: 'Ví dụ' }));
    expect(load).toHaveBeenCalledWith('x');
    expect(screen.getByText('Áp suất p₁')).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Áp suất p₁' })).toBeInTheDocument();
  });
});
