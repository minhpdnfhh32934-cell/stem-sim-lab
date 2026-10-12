import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AgeGate } from './AgeGate';
import { BrowserSafety, setSafetyBackendForTests } from './safety';
import { useSafetyStore } from './safetyStore';

describe('first-run age gate (main edition)', () => {
  it('asks once, needs the terms for "18+", and remembers the answer', async () => {
    setSafetyBackendForTests(new BrowserSafety(false));
    const user = userEvent.setup();
    render(<AgeGate />);
    const adult = await screen.findByRole('button', { name: /đủ 18 tuổi — bật AI/ });
    expect(adult).toBeDisabled();
    await user.click(screen.getByRole('checkbox'));
    expect(adult).toBeEnabled();
    await user.click(adult);
    await waitFor(() => {
      expect(useSafetyStore.getState().status?.aiAllowed).toBe(true);
    });
    expect(screen.queryByRole('button', { name: /đủ 18 tuổi — bật AI/ })).toBeNull();
  });

  it('"under 18" keeps the AI off but closes the gate', async () => {
    setSafetyBackendForTests(new BrowserSafety(false));
    const user = userEvent.setup();
    render(<AgeGate />);
    await user.click(await screen.findByRole('button', { name: 'Tôi chưa đủ 18 tuổi' }));
    await waitFor(() => {
      expect(useSafetyStore.getState().status).toMatchObject({ answered: true, aiAllowed: false });
    });
  });
});
