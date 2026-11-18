import { describe, expect, it } from 'vitest';
import {
  focusUnlessTyping,
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

  it('Ctrl+/ opens the shortcut list, but not while typing (#195)', () => {
    expect(matchShortcut(key('/', { ctrlKey: true }), false)).toBe('shortcutSheet');
    expect(matchShortcut(key('/', { ctrlKey: true }), true)).toBeNull();
    expect(matchShortcut(key('/'), false)).toBeNull();
  });

  it('treats Cmd (macOS) like Ctrl', () => {
    expect(matchShortcut(key('s', { metaKey: true }), false)).toBe('save');
  });

  it('does not steal plain keys while typing in a text field', () => {
    expect(matchShortcut(key(' '), true)).toBeNull();
    expect(matchShortcut(key('r'), true)).toBeNull();
    expect(matchShortcut(key('z', { ctrlKey: true }), true)).toBeNull(); // native undo in the field
  });

  it('keeps layout shortcuts working inside text fields', () => {
    expect(matchShortcut(key('s', { ctrlKey: true }), true)).toBe('save');
    expect(matchShortcut(key('F5'), true)).toBe('presentation');
  });

  it('no longer hides panels with Ctrl+B / Ctrl+I / Ctrl+J (removed in 0.4.3)', () => {
    for (const k of ['b', 'i', 'j'])
      expect(matchShortcut(key(k, { ctrlKey: true }), false)).toBeNull();
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

describe('focusUnlessTyping()', () => {
  it('never takes the keys from a field the learner is typing in (a lesson may load after)', () => {
    const box = document.createElement('textarea');
    const stage = document.createElement('canvas');
    stage.tabIndex = 0;
    document.body.append(box, stage);
    box.focus();
    focusUnlessTyping(stage);
    expect(document.activeElement).toBe(box);
    box.blur();
    focusUnlessTyping(stage);
    expect(document.activeElement).toBe(stage);
    box.remove();
    stage.remove();
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
