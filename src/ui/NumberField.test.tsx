import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { NumberField } from './NumberField';

describe('NumberField (UI-17)', () => {
  afterEach(() => {
    useSettingsStore.setState({ locale: 'vi' });
  });

  it('Vietnamese: shows 0,25 and passes every typed digit on', async () => {
    useSettingsStore.setState({ locale: 'vi' });
    const onChange = vi.fn();
    render(<NumberField label="Khối lượng" value={0.25} onChange={onChange} />);
    const box = screen.getByRole('textbox', { name: 'Khối lượng' });
    expect(box).toHaveValue('0,25');
    await userEvent.clear(box);
    await userEvent.type(box, '33,33333333');
    expect(onChange).toHaveBeenLastCalledWith(33.33333333);
    expect(box).toHaveValue('33,33333333');
  });

  it('English: a decimal point', () => {
    useSettingsStore.setState({ locale: 'en' });
    render(<NumberField label="Mass" value={9.81} onChange={() => undefined} />);
    expect(screen.getByRole('textbox', { name: 'Mass' })).toHaveValue('9.81');
  });
});
