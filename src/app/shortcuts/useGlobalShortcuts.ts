import { useEffect } from 'react';
import { useLayoutStore } from '@/app/layout/layoutStore';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useWorkspaceStore, type StageTool } from '@/app/workspaceStore';
import {
  isActivationTarget,
  isEditableTarget,
  matchShortcut,
  type ShortcutAction,
} from './shortcuts';

const TOOL_FOR_ACTION: Partial<Record<ShortcutAction, StageTool>> = {
  toolSelect: 'select',
  toolDrag: 'drag',
  toolRuler: 'ruler',
  toolProtractor: 'protractor',
  toolStopwatch: 'stopwatch',
  toolFitView: 'fitView',
};

/**
 * Performs a shortcut action. Returns `false` when the action did nothing, so the key event
 * keeps its default behaviour (e.g. Esc still closes an open dialog).
 */
function runAction(action: ShortcutAction): boolean {
  const layout = useLayoutStore.getState();
  const workspace = useWorkspaceStore.getState();
  const settings = useSettingsStore.getState();

  switch (action) {
    case 'playPause':
      if (!workspace.hasSimulation) return false;
      workspace.togglePlaying();
      return true;
    case 'reset':
      if (!workspace.hasSimulation) return false;
      workspace.resetSimulation();
      return true;
    case 'step':
    case 'undo':
    case 'redo':
      // Stepping and the undo history arrive with the engine in Phase 1–2.
      return false;
    case 'toggleLeft':
      layout.toggle('left');
      return true;
    case 'toggleRight':
      layout.toggle('right');
      return true;
    case 'toggleBottom':
      layout.toggle('bottom');
      return true;
    case 'presentation':
      layout.setPresentation(!layout.presentation);
      return true;
    case 'exitPresentation':
      if (!layout.presentation) return false;
      layout.setPresentation(false);
      return true;
    case 'fontLarger':
      settings.stepFontScale(1);
      return true;
    case 'fontSmaller':
      settings.stepFontScale(-1);
      return true;
    default: {
      const tool = TOOL_FOR_ACTION[action];
      // Tools other than "select" need a loaded simulation.
      if (!tool || (tool !== 'select' && !workspace.hasSimulation)) return false;
      workspace.setActiveTool(tool);
      return true;
    }
  }
}

/** Installs the app-wide keyboard shortcuts on `window`. Mount once, in the app shell. */
export function useGlobalShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return; // respect IME (Vietnamese Telex/VNI)
      // Space/Enter on a focused button, tab or radio must press that control.
      if ((e.key === ' ' || e.key === 'Enter') && isActivationTarget(e.target)) return;
      // A modal dialog (Settings) owns the keyboard, except for its own Esc handling.
      if (document.querySelector('dialog[open]')) return;
      const action = matchShortcut(e, isEditableTarget(e.target));
      if (action && runAction(action)) e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);
}
