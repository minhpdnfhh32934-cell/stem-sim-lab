import type { InputAction } from '../../core/config';

/**
 * Device-independent input for one frame: which actions are held, which were pressed this
 * frame, and accumulated look delta. The platform layer writes it (keyboard/mouse today,
 * gamepad/VR later); gameplay only reads it.
 */
export class InputState {
  private readonly held = new Set<InputAction>();
  private readonly pressed = new Set<InputAction>();
  lookDeltaX = 0;
  lookDeltaY = 0;
  /**
   * An analog stick for walking (a touch screen's, a gamepad's): right and down, −1…1 each; 0, 0
   * when none is pushed (the walking keys then). Held as written: the device sets it back.
   */
  stickX = 0;
  stickY = 0;
  /** Turns this frame in radians, as the device turned (a gyroscope): left and up positive. */
  turnYaw = 0;
  turnPitch = 0;

  press(action: InputAction): void {
    if (!this.held.has(action)) this.pressed.add(action);
    this.held.add(action);
  }

  release(action: InputAction): void {
    this.held.delete(action);
  }

  addLook(dx: number, dy: number): void {
    this.lookDeltaX += dx;
    this.lookDeltaY += dy;
  }

  isHeld(action: InputAction): boolean {
    return this.held.has(action);
  }

  wasPressed(action: InputAction): boolean {
    return this.pressed.has(action);
  }

  /** Called once after all systems updated: clears per-frame edges and look delta. */
  endFrame(): void {
    this.pressed.clear();
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
    this.turnYaw = 0;
    this.turnPitch = 0;
  }

  /** Drops everything, e.g. when the window loses focus, so no key stays stuck down. */
  reset(): void {
    this.held.clear();
    this.stickX = 0;
    this.stickY = 0;
    this.endFrame();
  }
}
