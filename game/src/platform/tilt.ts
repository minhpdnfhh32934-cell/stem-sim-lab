import { Disposables } from '../core/EventBus';
import type { GameSystem } from '../core/SystemRunner';
import type { Game } from '../game/Game';
import { listen } from './BrowserInput';

const DEG = Math.PI / 180;
/** A gap between two readings longer than this (s) is not integrated (the page was asleep). */
const MAX_GAP_S = 0.1;

/**
 * The device's turn rates (deg/s, `DeviceMotionEvent.rotationRate`: about its own z, x and y
 * axes, right-handed, the screen's portrait frame) as the view's: `yaw` about the screen's up
 * (left positive), `pitch` about the screen's right (the top towards the player, looking up,
 * positive), for the screen turned `angle` degrees (`screen.orientation.angle`: 90 for a phone
 * turned with its top to the left). The screen's right and up in the device's frame are its x and
 * y turned by the angle: right (cos a, −sin a), up (sin a, cos a).
 */
export function tiltTurn(
  rate: { readonly alpha: number; readonly beta: number; readonly gamma: number },
  angle: number,
): { yaw: number; pitch: number } {
  const a = angle * DEG;
  const c = Math.cos(a);
  const s = Math.sin(a);
  // rate.beta is about x, rate.gamma about y.
  return { yaw: rate.beta * s + rate.gamma * c, pitch: rate.beta * c - rate.gamma * s };
}

/** Whether this page may read the gyroscope: a secure page (https or localhost) with motion events. */
export function tiltAvailable(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext && 'DeviceMotionEvent' in window;
}

/**
 * Asks for the motion sensors where the browser wants a yes first (iOS: from a tap); true when
 * they may be read.
 */
export async function askTilt(): Promise<boolean> {
  if (!tiltAvailable()) return false;
  const ask = (
    DeviceMotionEvent as unknown as { requestPermission?: () => Promise<'granted' | 'denied'> }
  ).requestPermission;
  if (!ask) return true;
  try {
    return (await ask()) === 'granted';
  } catch {
    return false;
  }
}

/**
 * Looking by tilting a phone or tablet (2026-11-12, `game.controls.tiltLook`): the gyroscope's turn
 * rates, integrated between readings, turn the view as far as the device turned (× the tilt
 * sensitivity, reversed if asked) — added to the finger's drags, while playing only.
 */
export class TiltLook implements GameSystem {
  readonly id = 'tilt-look';
  private readonly subscriptions = new Disposables();
  private last: number | null = null;

  constructor(private readonly game: Game) {}

  init(): void {
    if (!tiltAvailable()) return;
    listen(this.subscriptions, window, 'devicemotion', (event) => this.read(event));
  }

  dispose(): void {
    this.subscriptions.dispose();
  }

  private read(event: DeviceMotionEvent): void {
    const { controls, state, input } = this.game;
    const { phase, paused } = state.session;
    const rate = event.rotationRate;
    const at = event.timeStamp;
    const gap = this.last === null ? 0 : (at - this.last) / 1000;
    this.last = at;
    if (!controls.tiltLook || phase !== 'playing' || paused || !rate || gap <= 0) return;
    if (gap > MAX_GAP_S) return;
    // Older Safari has no screen.orientation: upright then.
    const angle = (screen as { orientation?: ScreenOrientation }).orientation?.angle ?? 0;
    const turn = tiltTurn(
      { alpha: rate.alpha ?? 0, beta: rate.beta ?? 0, gamma: rate.gamma ?? 0 },
      angle,
    );
    const k = gap * DEG * controls.tiltSensitivity * (controls.tiltInvert ? -1 : 1);
    input.turnYaw += turn.yaw * k;
    input.turnPitch += turn.pitch * k;
  }
}
