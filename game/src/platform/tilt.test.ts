import { describe, expect, it } from 'vitest';
import { tiltTurn } from './tilt';

// The device's own axes (portrait): x to its right edge, y to its top, z out of the screen.
// Right-handed rates: about y positive takes x towards −z (the right edge away from the player):
// the device, and the view, turn left. About x positive takes y towards z (the top towards the
// player): its back faces higher, the view looks up.

describe('tiltTurn', () => {
  it('held upright (portrait): about its top edge turns, about its right edge looks', () => {
    expect(tiltTurn({ alpha: 0, beta: 0, gamma: 30 }, 0)).toEqual({ yaw: 30, pitch: 0 });
    expect(tiltTurn({ alpha: 0, beta: 20, gamma: 0 }, 0)).toEqual({ yaw: 0, pitch: 20 });
  });

  it('turned sideways, its top to the left (90°): its right edge is the screen’s up', () => {
    const turn = tiltTurn({ alpha: 0, beta: 30, gamma: 0 }, 90);
    expect(turn.yaw).toBeCloseTo(30);
    expect(turn.pitch).toBeCloseTo(0);
    const look = tiltTurn({ alpha: 0, beta: 0, gamma: 20 }, 90);
    expect(look.yaw).toBeCloseTo(0);
    expect(look.pitch).toBeCloseTo(-20); // its top points left: about y, the screen's left
  });

  it('turned the other way (270°): the same turn reads the other way round', () => {
    const turn = tiltTurn({ alpha: 0, beta: 30, gamma: 0 }, 270);
    expect(turn.yaw).toBeCloseTo(-30);
    expect(tiltTurn({ alpha: 0, beta: 0, gamma: 20 }, 270).pitch).toBeCloseTo(20);
  });

  it('a spin about the screen’s own axis (alpha) neither turns nor looks', () => {
    expect(tiltTurn({ alpha: 90, beta: 0, gamma: 0 }, 90)).toEqual({ yaw: 0, pitch: 0 });
  });
});
