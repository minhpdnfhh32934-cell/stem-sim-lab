import { describe, expect, it } from 'vitest';
import { DIM, UnitError, convert, fromSI, getUnit, toSI, unitLabel, unitsFor } from './units';

describe('units', () => {
  it('converts common textbook units to SI exactly', () => {
    expect(toSI(72, 'km/h')).toBeCloseTo(20, 12);
    expect(toSI(50, 'cm')).toBeCloseTo(0.5, 15);
    expect(toSI(30, 'deg')).toBeCloseTo(Math.PI / 6, 15);
    expect(toSI(25, '°C')).toBeCloseTo(298.15, 12);
    expect(toSI(1, 'atm')).toBe(101325);
    expect(toSI(2, 'mol/L')).toBe(2000);
  });

  it('round-trips through SI', () => {
    for (const u of ['km/h', 'degC', 'eV', 'g/cm^3', 'mmHg', 'min']) {
      expect(fromSI(toSI(3.7, u), u)).toBeCloseTo(3.7, 12);
    }
  });

  it('refuses to convert between different dimensions', () => {
    expect(() => convert(1, 'm', 's')).toThrow(UnitError);
    expect(convert(36, 'km/h', 'm/s')).toBeCloseTo(10, 12);
  });

  it('accepts aliases and rejects unknown units', () => {
    expect(getUnit('m/s²').symbol).toBe('m/s^2');
    expect(getUnit('Ω').symbol).toBe('ohm');
    expect(() => getUnit('furlong')).toThrow(UnitError);
  });

  it('lists units by dimension and pretty-prints labels', () => {
    expect(unitsFor(DIM.velocity)).toEqual(['m/s', 'km/h', 'cm/s']);
    expect(unitLabel('m/s^2')).toBe('m/s²');
    expect(unitLabel('degC')).toBe('°C');
  });
});
