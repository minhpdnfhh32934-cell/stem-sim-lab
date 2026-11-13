import { describe, expect, it } from 'vitest';
import { meterText } from './circuitView';

// The cabinet's meters as their displays show a reading: the ammeter (0–3 A) to 1 mA, the
// voltmeter (0–20 V) to 0.01 V, − when led the wrong way round, OL past the range.

const ammeter = { amps: 3 };
const voltmeter = { volts: 20 };
const r = (volts: number, amps: number) => ({ volts, amps, watts: volts * amps });

describe('meterText', () => {
  it('reads an ammeter to 1 mA, reversed −, OL past 3 A', () => {
    expect(meterText('ammeter', r(0, 0.0995), ammeter)).toBe('0.100 A');
    expect(meterText('ammeter', r(0, -0.0985), ammeter)).toBe('-0.099 A');
    expect(meterText('ammeter', r(0, 3.2), ammeter)).toBe('OL');
    expect(meterText('ammeter', r(0, -0.0002), ammeter)).toBe('0.000 A');
  });

  it('reads a voltmeter to 0.01 V, reversed −, OL past 20 V', () => {
    expect(meterText('voltmeter', r(6, 0), voltmeter)).toBe('6.00 V');
    expect(meterText('voltmeter', r(-6, 0), voltmeter)).toBe('-6.00 V');
    expect(meterText('voltmeter', r(24, 0), voltmeter)).toBe('OL');
  });
});
