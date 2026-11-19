import { el } from './dom';

/**
 * A red dot on what a first-time player should look at (Phú 2026-11-18: Settings, then Graphics,
 * then Menu background, to find the live background). Pulses; read as `label` by screen readers.
 */
export function hintDot(label: string, inline = false): HTMLElement {
  const dot = el('span', inline ? 'hint-dot inline' : 'hint-dot');
  dot.append(el('span', 'sr-only', label));
  return dot;
}

/** Puts the dot on (once) or takes it off `host`. */
export function setHintDot(host: HTMLElement, on: boolean, label: string, inline = false): void {
  const dot = host.querySelector(':scope > .hint-dot');
  host.classList.toggle('has-hint', on);
  if (on && !dot) host.append(hintDot(label, inline));
  else if (!on) dot?.remove();
}
