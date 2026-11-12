import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { withReducedMotion } from '@/ui/three/testing';
import { usePlayback } from './playback';

describe('usePlayback autoplay (#205 C3)', () => {
  it('plays on open when asked to', () => {
    const { result } = renderHook(() => usePlayback(10, { start: 0, autoplay: true }));
    expect(result.current.playing).toBe(true);
  });

  it('opens paused with reduced motion; the learner can still play', () => {
    const restore = withReducedMotion();
    try {
      const { result } = renderHook(() => usePlayback(10, { start: 0, autoplay: true }));
      expect(result.current.playing).toBe(false);
      act(() => {
        result.current.toggle();
      });
      expect(result.current.playing).toBe(true);
    } finally {
      restore();
    }
  });
});
