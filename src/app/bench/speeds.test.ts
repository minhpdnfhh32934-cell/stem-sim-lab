import { act } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { sim } from '@/app/sim/runtime';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { basicSteps, keepBasicSpeedOnSteps, nearestStep } from './speeds';

let stop: (() => void) | undefined;

afterEach(() => {
  stop?.();
  stop = undefined;
  sim.shutdown();
  act(() => {
    useSettingsStore.getState().setUiMode('basic');
    useWorkspaceStore.setState({ speed: 1, suggestedSpeed: null });
  });
});

describe('Basic speed steps', () => {
  it('steps: 0,5× · 1× · 2× plus the lesson’s own; the nearest step', () => {
    expect(basicSteps(null)).toEqual([0.5, 1, 2]);
    expect(basicSteps(1000)).toEqual([0.5, 1, 2, 1000]);
    expect(basicSteps(1)).toEqual([0.5, 1, 2]);
    expect([0.1, 0.25, 4, 10, 1000].map((s) => nearestStep(s, basicSteps(null)))).toEqual([
      0.5, 0.5, 2, 2, 2,
    ]);
  });

  it('a lesson’s own speed is set by every open and does not follow into the next lesson', async () => {
    await sim.open('standingWave');
    const wave = useWorkspaceStore.getState().suggestedSpeed;
    expect(wave).not.toBeNull();
    expect(wave).toBeLessThan(1);
    expect(useWorkspaceStore.getState().speed).toBe(wave);
    // Free fall has no speed of its own: back to 1×, not the wave's ×0,1.
    await sim.open('freeFall');
    expect(useWorkspaceStore.getState()).toMatchObject({ suggestedSpeed: null, speed: 1 });
    // A speed the learner chose does follow.
    useWorkspaceStore.getState().setSpeed(2);
    await sim.open('obliqueProjectile');
    expect(useWorkspaceStore.getState().speed).toBe(2);
  });

  it('switching to Basic lands on the nearest step even with no bench edge on screen', async () => {
    stop = keepBasicSpeedOnSteps();
    act(() => {
      useSettingsStore.getState().setUiMode('advanced');
      useWorkspaceStore.getState().setSpeed(10);
    });
    // In the library (nothing open, no edge drawn): switch to Basic, then open a lesson.
    act(() => {
      useSettingsStore.getState().setUiMode('basic');
    });
    expect(useWorkspaceStore.getState().speed).toBe(2);
    await sim.open('freeFall');
    expect(useWorkspaceStore.getState().speed).toBe(2);
  });

  it('in Basic a lesson’s own speed is kept as its step; a speed set in Advanced is not', async () => {
    stop = keepBasicSpeedOnSteps();
    await sim.open('standingWave');
    const wave = useWorkspaceStore.getState().suggestedSpeed;
    expect(wave).not.toBeNull();
    expect(useWorkspaceStore.getState().speed).toBe(wave);
    act(() => {
      useSettingsStore.getState().setUiMode('advanced');
      useWorkspaceStore.getState().setSpeed(100);
      useSettingsStore.getState().setUiMode('basic');
    });
    expect(basicSteps(wave)).not.toContain(100);
    expect(useWorkspaceStore.getState().speed).toBe(2);
  });

  it('a closed lesson’s own speed is gone: wave, ×0,25, home, Basic → 0,5×, then free fall 0,5×', async () => {
    stop = keepBasicSpeedOnSteps();
    act(() => {
      useSettingsStore.getState().setUiMode('advanced');
    });
    await sim.open('standingWave');
    act(() => {
      useWorkspaceStore.getState().setSpeed(0.25);
    });
    // Back to the library (a module or Studio does the same).
    sim.shutdown();
    expect(useWorkspaceStore.getState().suggestedSpeed).toBeNull();
    act(() => {
      useSettingsStore.getState().setUiMode('basic');
    });
    // Nearest of 0,5× · 1× · 2×, not the closed wave's ×0,1.
    expect(useWorkspaceStore.getState().speed).toBe(0.5);
    await sim.open('freeFall');
    expect(useWorkspaceStore.getState().speed).toBe(0.5);
  });

  it('wave, home, free fall: 1×', async () => {
    await sim.open('standingWave');
    sim.shutdown();
    expect(useWorkspaceStore.getState()).toMatchObject({ suggestedSpeed: null, speed: 1 });
    await sim.open('freeFall');
    expect(useWorkspaceStore.getState().speed).toBe(1);
  });
});
