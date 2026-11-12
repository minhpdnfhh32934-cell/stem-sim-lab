import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { SliderField } from './SliderField';

function Harness({ start = 300 }: { start?: number }) {
  const [v, setV] = useState(start);
  return (
    <SliderField
      label="Nhiệt độ T"
      value={v}
      min={100}
      max={1500}
      step={10}
      unit="K"
      onChange={setV}
    />
  );
}

describe('SliderField (#205 B7)', () => {
  it('a slider, a number box with its unit and − / +, all named after the label', () => {
    render(<Harness />);
    expect(screen.getByRole('slider', { name: 'Nhiệt độ T' })).toHaveValue('300');
    expect(screen.getByRole('textbox', { name: 'Nhiệt độ T' })).toHaveValue('300');
    expect(screen.getByText('K')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tăng Nhiệt độ T' }));
    expect(screen.getByRole('textbox', { name: 'Nhiệt độ T' })).toHaveValue('310');
    fireEvent.click(screen.getByRole('button', { name: 'Giảm Nhiệt độ T' }));
    fireEvent.click(screen.getByRole('button', { name: 'Giảm Nhiệt độ T' }));
    expect(screen.getByRole('slider', { name: 'Nhiệt độ T' })).toHaveValue('290');
  });

  it('typed values stay in [min, max]; − / + stop at the ends', () => {
    render(<Harness start={1500} />);
    expect(screen.getByRole('button', { name: 'Tăng Nhiệt độ T' })).toBeDisabled();
    const box = screen.getByRole('textbox', { name: 'Nhiệt độ T' });
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: '5000' } });
    expect(screen.getByRole('slider', { name: 'Nhiệt độ T' })).toHaveValue('1500');
    fireEvent.change(box, { target: { value: '20' } });
    expect(screen.getByRole('slider', { name: 'Nhiệt độ T' })).toHaveValue('100');
    expect(screen.getByRole('button', { name: 'Giảm Nhiệt độ T' })).toBeDisabled();
  });
});
