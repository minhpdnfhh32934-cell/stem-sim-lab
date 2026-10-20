import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useNavigationStore, type AppScreen } from '@/app/navigationStore';
import { sim } from '@/app/sim/runtime';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { useGlobalShortcuts } from './useGlobalShortcuts';

const undo = vi.hoisted(() => ({ undo: vi.fn(() => true), redo: vi.fn(() => true) }));
vi.mock('@/app/project/undo', () => undo);

function press(key: string, ctrlKey = false): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key, ctrlKey, bubbles: true, cancelable: true });
  window.dispatchEvent(e);
  return e;
}

describe('global shortcuts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    undo.undo.mockClear();
    undo.redo.mockClear();
    useNavigationStore.getState().setScreen('home');
  });

  it.each<AppScreen>(['teacher', 'studio', 'home'])(
    'leave the hidden lab topic alone on the %s screen',
    (screen) => {
      const play = vi.spyOn(sim, 'togglePlay').mockImplementation(() => undefined);
      useWorkspaceStore.setState({ hasSimulation: true, activeTool: 'select' });
      useNavigationStore.getState().setScreen(screen);
      renderHook(() => {
        useGlobalShortcuts();
      });
      expect(press('z', true).defaultPrevented).toBe(false);
      expect(press(' ').defaultPrevented).toBe(false);
      press('y', true);
      expect(undo.undo).not.toHaveBeenCalled();
      expect(undo.redo).not.toHaveBeenCalled();
      expect(play).not.toHaveBeenCalled();
    },
  );

  it('act on the open topic in the lab', () => {
    const play = vi.spyOn(sim, 'togglePlay').mockImplementation(() => undefined);
    useWorkspaceStore.setState({ hasSimulation: true });
    useNavigationStore.getState().setScreen('lab');
    renderHook(() => {
      useGlobalShortcuts();
    });
    expect(press('z', true).defaultPrevented).toBe(true);
    press(' ');
    expect(undo.undo).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);
  });
});
