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

  it('keeps angular (rad/s) and cycle (Hz, rev/s, rev/min) frequencies apart', () => {
    // Same SI exponents and factor 1: only the unit group stops "2 Hz" becoming "2 rad/s".
    expect(() => convert(1, 'Hz', 'rad/s')).toThrow(UnitError);
    expect(() => convert(1, 'rad/s', 'rev/min')).toThrow(UnitError);
    expect(convert(120, 'vòng/phút', 'Hz')).toBeCloseTo(2, 15);
    expect(convert(3, 'rev/s', 'Hz')).toBe(3);
    expect(getUnit('rpm').symbol).toBe('rev/min');
    expect(unitsFor(DIM.frequency, 'angular')).toEqual(['rad/s']);
    expect(unitsFor(DIM.frequency, 'cycle')).toEqual(['Hz', 'rev/s', 'rev/min']);
    expect(unitsFor(DIM.frequency)).toEqual([]);
    // Display of existing Hz answers (spring frequency, damping rate γ) is unchanged.
    expect(fromSI(2, 'Hz')).toBe(2);
  });

  it('reads the electric-field units (#76): charge, field, voltage, small forces, Coulomb k', () => {
    expect(toSI(40, 'nC')).toBeCloseTo(4e-8, 20);
    expect(convert(1, 'uC', 'nC')).toBeCloseTo(1000, 9);
    expect(convert(5, 'kV/m', 'V/m')).toBe(5000);
    expect(getUnit('N/C').symbol).toBe('V/m');
    expect(toSI(2, 'kV')).toBe(2000);
    expect(convert(3, 'mN', 'uN')).toBeCloseTo(3000, 9);
    expect(getUnit('µN').symbol).toBe('uN');
    expect(getUnit('N·m²/C²').symbol).toBe('N*m^2/C^2');
    expect(unitLabel('N*m^2/C^2')).toBe('N·m²/C²');
    expect(unitLabel('uN')).toBe('µN');
    expect(unitsFor(DIM.electricField)).toEqual(['V/m', 'kV/m']);
    expect(unitsFor(DIM.charge)).toEqual(['C', 'uC', 'nC']);
    // V/m and N/C are one unit: k·q/r² (N·m²/C² · C / m²) is N/C.
    expect(() => convert(1, 'V/m', 'N')).toThrow(UnitError);
  });
});
