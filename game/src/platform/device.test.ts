import { describe, expect, it } from 'vitest';
import { deviceKind, type DeviceFacts } from './device';

const desktop: DeviceFacts = {
  coarse: false,
  hover: true,
  touchPoints: 0,
  shortSide: 1080,
  mobile: false,
};

describe('deviceKind', () => {
  it('a computer: mouse and keyboard, a touch-screen laptop too', () => {
    expect(deviceKind(desktop)).toBe('computer');
    expect(deviceKind({ ...desktop, touchPoints: 10 })).toBe('computer'); // the mouse is its pointer
  });

  it('a phone and a tablet by the screen’s shorter side', () => {
    const phone = { coarse: true, hover: false, touchPoints: 5, shortSide: 393, mobile: true };
    expect(deviceKind(phone)).toBe('phone');
    expect(deviceKind({ ...phone, shortSide: 820 })).toBe('tablet');
  });

  it('an iPad that says it is a Mac: its finger pointer makes it a tablet', () => {
    expect(
      deviceKind({ coarse: true, hover: false, touchPoints: 5, shortSide: 1024, mobile: false }),
    ).toBe('tablet');
  });

  it('a mobile browser without a touch screen is a computer (nothing to tap)', () => {
    expect(deviceKind({ ...desktop, mobile: true })).toBe('computer');
  });
});
