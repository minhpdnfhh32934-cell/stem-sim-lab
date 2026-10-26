import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { harmonicFrequency } from '@/physics/wave/model';
import { standingWave } from '@/physics/wave/scenes';
import { simplePendulum } from '@/physics/pendulum/scenes';
import { ValidationFixes } from './ValidationFixes';

describe('ValidationFixes ("Dùng fₙ")', () => {
  it('a press sets the exact resonance, which then validates (f = 26 Hz → f₄ = 100/3 Hz)', async () => {
    const params = { ...standingWave.defaults, mode: 2, f: 26 };
    const onApply = vi.fn();
    render(<ValidationFixes scene={standingWave} params={params} onApply={onApply} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: /f₄/ }));
    expect(onApply).toHaveBeenCalledTimes(1);
    const change = onApply.mock.calls[0]?.[0] as Record<string, number>;
    expect(change).toEqual({ f: harmonicFrequency(4, 20, 1.2) });
    expect(standingWave.validate?.({ ...params, ...change })).toEqual([]);
  });

  it('nothing is shown, and nothing applied, without a fix', () => {
    const onApply = vi.fn();
    const { container } = render(
      <ValidationFixes scene={simplePendulum} params={simplePendulum.defaults} onApply={onApply} />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(onApply).not.toHaveBeenCalled();
  });
});
