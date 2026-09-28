import { describe, expect, it } from 'vitest';
import {
  formatChord,
  isActivationTarget,
  isEditableTarget,
  matchShortcut,
  SHORTCUTS,
  type KeyEventLike,
} from './shortcuts';

const key = (k: string, mods: Partial<KeyEventLike> = {}): KeyEventLike => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
});

describe('matchShortcut()', () => {
  it('maps the core shortcuts from MASTER_PROMPT §7.2', () => {
    expect(matchShortcut(key(' '), false)).toBe('playPause');
    expect(matchShortcut(key('r'), false)).toBe('reset');
    expect(matchShortcut(key('R'), false)).toBe('reset');
    expect(matchShortcut(key('z', { ctrlKey: true }), false)).toBe('undo');
    expect(matchShortcut(key('y', { ctrlKey: true }), false)).toBe('redo');
    expect(matchShortcut(key('Z', { ctrlKey: true, shiftKey: true }), false)).toBe('redo');
  });

  it('treats Cmd (macOS) like Ctrl', () => {
    expect(matchShortcut(key('b', { metaKey: true }), false)).toBe('toggleLeft');
  });

  it('does not steal plain keys while typing in a text field', () => {
    expect(matchShortcut(key(' '), true)).toBeNull();
    expect(matchShortcut(key('r'), true)).toBeNull();
    expect(matchShortcut(key('z', { ctrlKey: true }), true)).toBeNull(); // native undo in the field
  });

  it('keeps layout shortcuts working inside text fields', () => {
    expect(matchShortcut(key('b', { ctrlKey: true }), true)).toBe('toggleLeft');
    expect(matchShortcut(key('F5'), true)).toBe('presentation');
  });

  it('requires modifiers to match exactly', () => {
    expect(matchShortcut(key('r', { ctrlKey: true }), false)).toBeNull(); // Ctrl+R is not Reset
  });

  it('has no two actions bound to the same chord', () => {
    const seen = new Map<string, string>();
    for (const def of SHORTCUTS) {
      for (const chord of def.chords) {
        const id = formatChord(chord);
        expect(seen.get(id), `${id} bound twice`).toBeUndefined();
        seen.set(id, def.action);
      }
    }
  });
});

describe('isEditableTarget()', () => {
  it('recognises text inputs but not buttons or sliders', () => {
    const text = document.createElement('input');
    const range = document.createElement('input');
    range.type = 'range';
    expect(isEditableTarget(text)).toBe(true);
    expect(isEditableTarget(document.createElement('textarea'))).toBe(true);
    expect(isEditableTarget(range)).toBe(false);
    expect(isEditableTarget(document.createElement('button'))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe('isActivationTarget()', () => {
  it('lets Space/Enter press focused buttons, tabs and radios', () => {
    const tab = document.createElement('div');
    tab.setAttribute('role', 'tab');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    expect(isActivationTarget(document.createElement('button'))).toBe(true);
    expect(isActivationTarget(tab)).toBe(true);
    expect(isActivationTarget(checkbox)).toBe(true);
  });

  it('does not treat the stage or plain containers as controls', () => {
    expect(isActivationTarget(document.createElement('div'))).toBe(false);
    expect(isActivationTarget(document.body)).toBe(false);
    expect(isActivationTarget(null)).toBe(false);
  });
});

describe('formatChord()', () => {
  it('produces readable labels', () => {
    expect(formatChord({ key: 'z', ctrl: true, shift: true })).toBe('Ctrl + Shift + Z');
    expect(formatChord({ key: ' ' })).toBe('Space');
  });
});
