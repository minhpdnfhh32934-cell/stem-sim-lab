import { ENGLISH, type Texts } from '../../core/i18n';

/** Creates an element with optional class and text (text, never HTML, so content cannot inject markup). */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export type Attrs = Record<string, string | number>;

/** Creates an SVG element with its attributes and optional text (text, never markup). */
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Attrs,
  text?: string,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}

const MOUSE_LABELS: Readonly<Record<string, (t: Texts) => string>> = {
  Mouse0: (t) => t.ui('key.mouseLeft', 'LMB'),
  Mouse1: (t) => t.ui('key.mouseMiddle', 'MMB'),
  Mouse2: (t) => t.ui('key.mouseRight', 'RMB'),
};

/** Codes whose name is not what the key says. */
const NAMED_KEYS: Readonly<Record<string, string>> = {
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Escape: 'Esc',
};

/**
 * "KeyE" → "E", "Digit1" → "1", "ShiftLeft" → "Shift", "ArrowUp" → "↑", "F3" → "F3", "Mouse0" →
 * "LMB" (mouse buttons translated).
 */
export const keyLabel = (code: string | undefined, texts: Texts = ENGLISH): string =>
  MOUSE_LABELS[code ?? '']?.(texts) ??
  NAMED_KEYS[code ?? ''] ??
  (code ?? '?').replace(/^Key|^Digit/, '');

/** Compact SI display: 4 significant digits, real minus sign. */
export function formatQuantity(value: number, unit: string): string {
  const text = Number(value.toPrecision(4)).toString().replace('-', '−');
  return unit ? `${text} ${unit}` : text;
}
