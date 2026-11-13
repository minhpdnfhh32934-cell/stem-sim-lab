import { describe, expect, it } from 'vitest';
import { FAR_M, NEAR_M, voiceMix } from './voiceMix';

describe('voiceMix (proximity voice, 2026-11-12)', () => {
  const me = { x: 0, z: 0, yaw: 0 }; // facing −z

  it('is full near, fades with the distance, and is silent far away or out of the scene', () => {
    expect(voiceMix(me, { x: 0, z: -NEAR_M }).gain).toBe(1);
    expect(voiceMix(me, { x: 0, z: -(NEAR_M + FAR_M) / 2 }).gain).toBeCloseTo(0.5);
    expect(voiceMix(me, { x: 0, z: -FAR_M }).gain).toBe(0);
    expect(voiceMix(me, { x: 0, z: -100 }).gain).toBe(0);
    expect(voiceMix(me, null)).toEqual({ gain: 0, pan: 0 });
  });

  it('comes from the side the speaker is on, as the listener faces', () => {
    expect(voiceMix(me, { x: 2, z: 0 }).pan).toBeCloseTo(0.8); // to the right
    expect(voiceMix(me, { x: -2, z: 0 }).pan).toBeCloseTo(-0.8);
    expect(voiceMix(me, { x: 0, z: -2 }).pan).toBeCloseTo(0); // ahead
    // Turned left by 90° (facing −x): the speaker at −z is now on the right.
    expect(voiceMix({ ...me, yaw: Math.PI / 2 }, { x: 0, z: -2 }).pan).toBeCloseTo(0.8);
  });
});
