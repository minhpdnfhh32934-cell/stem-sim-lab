import { describe, expect, it } from 'vitest';
import { heatState, heatStep, lampWear } from './circuitHeat';

const RESISTOR = { capacity: 0.4, resistance: 300, smoke: 200, fail: 350, ignite: 450 };

describe('circuit heat', () => {
  it('rises toward P·R_th with τ = R_th·C, exactly however it is stepped', () => {
    const tau = 300 * 0.4;
    expect(heatStep(RESISTOR, 0, 0.25, tau)).toBeCloseTo(75 * (1 - Math.exp(-1)), 9);
    let rise = 0;
    for (let i = 0; i < 1200; i++) rise = heatStep(RESISTOR, rise, 0.25, tau / 1200);
    expect(rise).toBeCloseTo(75 * (1 - Math.exp(-1)), 9);
    expect(heatStep(RESISTOR, 100, 0, 1e9)).toBeCloseTo(0, 9); // cools back to the room
  });

  it('smokes, fails, then burns past its thresholds', () => {
    expect(heatState(RESISTOR, 75)).toBe('ok');
    expect(heatState(RESISTOR, 250)).toBe('smoking');
    expect(heatState(RESISTOR, 400)).toBe('failed');
    expect(heatState(RESISTOR, 500)).toBe('burning');
    expect(heatState({ capacity: 1, resistance: 1, fail: 10 }, 1e6)).toBe('failed'); // cannot burn
  });

  it('a lamp at its rating spends its life in its rated life; at twice the voltage 2^16 faster', () => {
    const lamp = { volts: 6, life: 3.6e6 };
    expect(lampWear(lamp, 6, 3.6e6)).toBeCloseTo(1, 12);
    expect(lampWear(lamp, 12, 3.6e6 / 65536)).toBeCloseTo(1, 12);
  });
});
