/** What the game runs on: a computer (keyboard and mouse) or a touch screen, small or large. */
export type DeviceKind = 'computer' | 'tablet' | 'phone';

/** What the browser tells about the device (`detectDevice` reads them). */
export interface DeviceFacts {
  /** The main pointer is coarse (a finger), and it cannot hover. */
  readonly coarse: boolean;
  readonly hover: boolean;
  /** How many touches the screen takes at once (0: no touch screen). */
  readonly touchPoints: number;
  /** The screen's shorter side (CSS px). */
  readonly shortSide: number;
  /** The browser says it is a phone's or tablet's (user agent or client hints). */
  readonly mobile: boolean;
}

/** Below this shorter side (CSS px) a touch screen is a phone's: smaller controls. */
const PHONE_MAX_SIDE = 600;

/**
 * A touch screen first — the finger the main pointer, no hover, or a mobile browser (an iPad says
 * it is a Mac, but its pointer is coarse) — is a phone or a tablet by its size; anything else is a
 * computer, a laptop with a touch screen too (its main pointer is the mouse or touchpad).
 */
export function deviceKind(f: DeviceFacts): DeviceKind {
  const touchFirst = f.touchPoints > 0 && ((f.coarse && !f.hover) || f.mobile);
  if (!touchFirst) return 'computer';
  return f.shortSide < PHONE_MAX_SIDE ? 'phone' : 'tablet';
}

/**
 * This browser's device; `?device=phone|tablet|computer` in the address sets it instead (to try
 * the touch controls on a computer, or turn them off).
 */
export function detectDevice(): DeviceKind {
  const asked = new URLSearchParams(location.search).get('device');
  if (asked === 'phone' || asked === 'tablet' || asked === 'computer') return asked;
  const hints = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  return deviceKind({
    coarse: matchMedia('(pointer: coarse)').matches,
    hover: matchMedia('(hover: hover)').matches,
    touchPoints: navigator.maxTouchPoints,
    shortSide: Math.min(screen.width, screen.height),
    mobile: hints?.mobile === true || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent),
  });
}
