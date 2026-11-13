/** Heard at full volume up to this far (m); fading to nothing at FAR_M. */
export const NEAR_M = 3;
export const FAR_M = 24;

/**
 * How loud, and from which side, another player's voice is heard (2026-11-12, proximity voice as
 * in Minecraft): full near, fading with the distance to nothing at FAR_M, nothing from a scene not
 * here (`speaker` null). `pan` is −1 (left) … 1 (right) for the listener facing `yaw` (forward is
 * (−sin yaw, −cos yaw) in x, z, as the doors read it). Written into `out` (read every frame).
 */
export function voiceMix(
  listener: { x: number; z: number; yaw: number },
  speaker: { x: number; z: number } | null,
  out: { gain: number; pan: number } = { gain: 0, pan: 0 },
): { gain: number; pan: number } {
  out.gain = 0;
  out.pan = 0;
  if (!speaker) return out;
  const dx = speaker.x - listener.x;
  const dz = speaker.z - listener.z;
  const distance = Math.hypot(dx, dz);
  out.gain = Math.min(1, Math.max(0, (FAR_M - distance) / (FAR_M - NEAR_M)));
  if (distance < 0.01) return out;
  const right = (Math.cos(listener.yaw) * dx - Math.sin(listener.yaw) * dz) / distance;
  // Never all in one ear: a voice to the side is still heard a little on the other.
  out.pan = right * 0.8;
  return out;
}
