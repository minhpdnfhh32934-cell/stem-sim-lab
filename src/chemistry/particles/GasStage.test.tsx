import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { withReducedMotion } from '@/ui/three/testing';
import { GasStage } from './GasStage';
import { useGasStore } from './gasStore';

describe('GasStage on open (#205 C3)', () => {
  it('runs, as before', () => {
    useGasStore.setState({ running: false });
    render(<GasStage mode="maxwell" />);
    expect(useGasStore.getState().running).toBe(true);
  });

  it('opens paused with reduced motion, even when it was left running', () => {
    const restore = withReducedMotion();
    try {
      useGasStore.setState({ running: true });
      render(<GasStage mode="collision" />);
      expect(useGasStore.getState().running).toBe(false);
    } finally {
      restore();
    }
  });
});
