/**
 * Keyboard shortcut table. Pure data + pure matching so it can be unit-tested
 * and rendered in Settings → Phím tắt.
 */

export type ShortcutAction =
  | 'playPause'
  | 'reset'
  | 'step'
  | 'undo'
  | 'redo'
  | 'save'
  | 'open'
  | 'toggleLeft'
  | 'toggleRight'
  | 'toggleBottom'
  | 'presentation'
  | 'exitPresentation'
  | 'fontLarger'
  | 'fontSmaller'
  | 'toolSelect'
  | 'toolDrag'
  | 'toolRuler'
  | 'toolProtractor'
  | 'toolStopwatch'
  | 'toolFitView';

export interface KeyChord {
  /** `KeyboardEvent.key`, compared case-insensitively. */
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export interface ShortcutDef {
  action: ShortcutAction;
  chords: KeyChord[];
  /** Also fires while the user is typing in an input/textarea. */
  worksInInputs?: boolean;
}

export const SHORTCUTS: readonly ShortcutDef[] = [
  { action: 'playPause', chords: [{ key: ' ' }] },
  { action: 'reset', chords: [{ key: 'r' }] },
  { action: 'step', chords: [{ key: '.' }] },
  { action: 'undo', chords: [{ key: 'z', ctrl: true }] },
  {
    action: 'redo',
    chords: [
      { key: 'y', ctrl: true },
      { key: 'z', ctrl: true, shift: true },
    ],
  },
  { action: 'save', chords: [{ key: 's', ctrl: true }], worksInInputs: true },
  { action: 'open', chords: [{ key: 'o', ctrl: true }], worksInInputs: true },
  { action: 'toggleLeft', chords: [{ key: 'b', ctrl: true }], worksInInputs: true },
  { action: 'toggleRight', chords: [{ key: 'i', ctrl: true }], worksInInputs: true },
  { action: 'toggleBottom', chords: [{ key: 'j', ctrl: true }], worksInInputs: true },
  { action: 'presentation', chords: [{ key: 'F5' }], worksInInputs: true },
  { action: 'exitPresentation', chords: [{ key: 'Escape' }], worksInInputs: true },
  {
    action: 'fontLarger',
    chords: [
      { key: '=', ctrl: true },
      { key: '+', ctrl: true },
      { key: '+', ctrl: true, shift: true },
    ],
    worksInInputs: true,
  },
  { action: 'fontSmaller', chords: [{ key: '-', ctrl: true }], worksInInputs: true },
  { action: 'toolSelect', chords: [{ key: 'v' }] },
  { action: 'toolDrag', chords: [{ key: 'h' }] },
  { action: 'toolRuler', chords: [{ key: 'm' }] },
  { action: 'toolProtractor', chords: [{ key: 'a' }] },
  { action: 'toolStopwatch', chords: [{ key: 't' }] },
  { action: 'toolFitView', chords: [{ key: 'f' }] },
];

export interface KeyEventLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

function chordMatches(chord: KeyChord, e: KeyEventLike): boolean {
  // Treat Cmd on macOS like Ctrl.
  const ctrl = e.ctrlKey || e.metaKey;
  return (
    chord.key.toLowerCase() === e.key.toLowerCase() &&
    Boolean(chord.ctrl) === ctrl &&
    Boolean(chord.shift) === e.shiftKey &&
    Boolean(chord.alt) === e.altKey
  );
}

/** Finds the action bound to a key event, honouring the "typing in a field" rule. */
export function matchShortcut(e: KeyEventLike, inEditableField: boolean): ShortcutAction | null {
  for (const def of SHORTCUTS) {
    if (inEditableField && !def.worksInInputs) continue;
    if (def.chords.some((c) => chordMatches(c, e))) return def.action;
  }
  return null;
}

/** True when keystrokes should go to a text field rather than to app shortcuts. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (target as HTMLInputElement).type;
    return !['checkbox', 'radio', 'range', 'button', 'submit'].includes(type);
  }
  return false;
}

const ACTIVATION_ROLES = new Set([
  'button',
  'tab',
  'radio',
  'checkbox',
  'switch',
  'menuitem',
  'option',
  'link',
]);

/**
 * True when Space/Enter should activate the focused control (a button, tab, radio…)
 * instead of triggering an app shortcut such as Play/Pause.
 */
export function isActivationTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'BUTTON' || tag === 'SUMMARY' || (tag === 'A' && target.hasAttribute('href'))) {
    return true;
  }
  if (tag === 'INPUT') {
    const type = (target as HTMLInputElement).type;
    return ['checkbox', 'radio', 'button', 'submit', 'reset'].includes(type);
  }
  const role = target.getAttribute('role');
  return role !== null && ACTIVATION_ROLES.has(role);
}

/** Human-readable label for a chord, e.g. "Ctrl + Shift + Z". */
export function formatChord(chord: KeyChord): string {
  const parts: string[] = [];
  if (chord.ctrl) parts.push('Ctrl');
  if (chord.shift) parts.push('Shift');
  if (chord.alt) parts.push('Alt');
  const keyLabel: Record<string, string> = { ' ': 'Space', Escape: 'Esc' };
  parts.push(keyLabel[chord.key] ?? (chord.key.length === 1 ? chord.key.toUpperCase() : chord.key));
  return parts.join(' + ');
}
