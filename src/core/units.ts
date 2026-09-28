/**
 * Unit registry. Internally the app computes in SI only; units exist at the edges
 * (problem input, SceneSpec, display). Conversions are exact multiplications by
 * defined factors (plus an offset for °C).
 *
 * Dimensions are exponent vectors over the SI base units [m, kg, s, A, K, mol, cd].
 */

export type Dimension = readonly [number, number, number, number, number, number, number];

const D = (m = 0, kg = 0, s = 0, A = 0, K = 0, mol = 0, cd = 0): Dimension => [
  m,
  kg,
  s,
  A,
  K,
  mol,
  cd,
];

export const DIM = {
  none: D(),
  length: D(1),
  mass: D(0, 1),
  time: D(0, 0, 1),
  current: D(0, 0, 0, 1),
  temperature: D(0, 0, 0, 0, 1),
  amount: D(0, 0, 0, 0, 0, 1),
  area: D(2),
  volume: D(3),
  velocity: D(1, 0, -1),
  acceleration: D(1, 0, -2),
  force: D(1, 1, -2),
  energy: D(2, 1, -2),
  power: D(2, 1, -3),
  pressure: D(-1, 1, -2),
  momentum: D(1, 1, -1),
  frequency: D(0, 0, -1),
  springConstant: D(0, 1, -2),
  density: D(-3, 1),
  concentration: D(-3, 0, 0, 0, 0, 1),
  charge: D(0, 0, 1, 1),
  voltage: D(2, 1, -3, -1),
  resistance: D(2, 1, -3, -2),
  molarMass: D(0, 1, 0, 0, 0, -1),
} as const;

export interface UnitDef {
  /** Canonical symbol used in data and SceneSpec. */
  symbol: string;
  dim: Dimension;
  /** value_SI = value * factor + offset */
  factor: number;
  offset?: number;
  /** Alternative spellings accepted on input. */
  aliases?: readonly string[];
}

const DEG = Math.PI / 180;

const UNITS: readonly UnitDef[] = [
  // dimensionless / angle (radian is SI-coherent and dimensionless)
  { symbol: '1', dim: DIM.none, factor: 1, aliases: [''] },
  { symbol: 'rad', dim: DIM.none, factor: 1 },
  { symbol: 'deg', dim: DIM.none, factor: DEG, aliases: ['°', 'degree', 'độ'] },
  { symbol: '%', dim: DIM.none, factor: 0.01 },
  // length
  { symbol: 'm', dim: DIM.length, factor: 1 },
  { symbol: 'km', dim: DIM.length, factor: 1e3 },
  { symbol: 'dm', dim: DIM.length, factor: 0.1 },
  { symbol: 'cm', dim: DIM.length, factor: 1e-2 },
  { symbol: 'mm', dim: DIM.length, factor: 1e-3 },
  { symbol: 'um', dim: DIM.length, factor: 1e-6, aliases: ['µm', 'μm'] },
  { symbol: 'nm', dim: DIM.length, factor: 1e-9 },
  { symbol: 'pm', dim: DIM.length, factor: 1e-12 },
  { symbol: 'angstrom', dim: DIM.length, factor: 1e-10, aliases: ['Å', 'A°'] },
  // mass
  { symbol: 'kg', dim: DIM.mass, factor: 1 },
  { symbol: 'g', dim: DIM.mass, factor: 1e-3 },
  { symbol: 'mg', dim: DIM.mass, factor: 1e-6 },
  { symbol: 't', dim: DIM.mass, factor: 1e3, aliases: ['tấn', 'tonne'] },
  // time
  { symbol: 's', dim: DIM.time, factor: 1 },
  { symbol: 'ms', dim: DIM.time, factor: 1e-3 },
  { symbol: 'min', dim: DIM.time, factor: 60, aliases: ['phút'] },
  { symbol: 'h', dim: DIM.time, factor: 3600, aliases: ['giờ'] },
  // area / volume
  { symbol: 'm^2', dim: DIM.area, factor: 1, aliases: ['m²'] },
  { symbol: 'cm^2', dim: DIM.area, factor: 1e-4, aliases: ['cm²'] },
  { symbol: 'm^3', dim: DIM.volume, factor: 1, aliases: ['m³'] },
  { symbol: 'dm^3', dim: DIM.volume, factor: 1e-3, aliases: ['dm³'] },
  { symbol: 'cm^3', dim: DIM.volume, factor: 1e-6, aliases: ['cm³'] },
  { symbol: 'L', dim: DIM.volume, factor: 1e-3, aliases: ['l', 'lít'] },
  { symbol: 'mL', dim: DIM.volume, factor: 1e-6, aliases: ['ml'] },
  // kinematics
  { symbol: 'm/s', dim: DIM.velocity, factor: 1, aliases: ['m.s^-1', 'm s^-1'] },
  { symbol: 'km/h', dim: DIM.velocity, factor: 1000 / 3600, aliases: ['kmh', 'km/giờ'] },
  { symbol: 'cm/s', dim: DIM.velocity, factor: 1e-2 },
  {
    symbol: 'm/s^2',
    dim: DIM.acceleration,
    factor: 1,
    aliases: ['m/s²', 'm.s^-2', 'm s^-2'],
  },
  { symbol: 'cm/s^2', dim: DIM.acceleration, factor: 1e-2, aliases: ['cm/s²'] },
  { symbol: 'rad/s', dim: DIM.frequency, factor: 1 },
  { symbol: 'Hz', dim: DIM.frequency, factor: 1 },
  // dynamics
  { symbol: 'N', dim: DIM.force, factor: 1 },
  { symbol: 'kN', dim: DIM.force, factor: 1e3 },
  { symbol: 'N/m', dim: DIM.springConstant, factor: 1 },
  { symbol: 'N/cm', dim: DIM.springConstant, factor: 100 },
  { symbol: 'kg*m/s', dim: DIM.momentum, factor: 1, aliases: ['kg.m/s', 'kg·m/s', 'N*s', 'N.s'] },
  // energy / power / pressure
  { symbol: 'J', dim: DIM.energy, factor: 1 },
  { symbol: 'kJ', dim: DIM.energy, factor: 1e3 },
  // 1 eV = e × 1 V, e exact (SI 2019).
  { symbol: 'eV', dim: DIM.energy, factor: 1.602176634e-19 },
  // Thermochemical calorie: exactly 4.184 J.
  { symbol: 'cal', dim: DIM.energy, factor: 4.184 },
  { symbol: 'kcal', dim: DIM.energy, factor: 4184 },
  { symbol: 'kWh', dim: DIM.energy, factor: 3.6e6 },
  { symbol: 'W', dim: DIM.power, factor: 1 },
  { symbol: 'kW', dim: DIM.power, factor: 1e3 },
  { symbol: 'Pa', dim: DIM.pressure, factor: 1 },
  { symbol: 'kPa', dim: DIM.pressure, factor: 1e3 },
  { symbol: 'bar', dim: DIM.pressure, factor: 1e5 },
  { symbol: 'atm', dim: DIM.pressure, factor: 101325 },
  // mmHg (conventional): 133.322387415 Pa by definition.
  { symbol: 'mmHg', dim: DIM.pressure, factor: 133.322387415 },
  // temperature
  { symbol: 'K', dim: DIM.temperature, factor: 1 },
  { symbol: 'degC', dim: DIM.temperature, factor: 1, offset: 273.15, aliases: ['°C', 'oC'] },
  // chemistry
  { symbol: 'mol', dim: DIM.amount, factor: 1 },
  { symbol: 'mmol', dim: DIM.amount, factor: 1e-3 },
  { symbol: 'mol/L', dim: DIM.concentration, factor: 1e3, aliases: ['M', 'mol/l', 'mol.L^-1'] },
  { symbol: 'mmol/L', dim: DIM.concentration, factor: 1, aliases: ['mM'] },
  { symbol: 'mol/m^3', dim: DIM.concentration, factor: 1 },
  { symbol: 'g/mol', dim: DIM.molarMass, factor: 1e-3 },
  { symbol: 'kg/m^3', dim: DIM.density, factor: 1, aliases: ['kg/m³'] },
  { symbol: 'g/cm^3', dim: DIM.density, factor: 1e3, aliases: ['g/cm³', 'g/mL', 'g/ml'] },
  // electricity
  { symbol: 'A', dim: DIM.current, factor: 1 },
  { symbol: 'mA', dim: DIM.current, factor: 1e-3 },
  { symbol: 'C', dim: DIM.charge, factor: 1 },
  { symbol: 'uC', dim: DIM.charge, factor: 1e-6, aliases: ['µC', 'μC'] },
  { symbol: 'V', dim: DIM.voltage, factor: 1 },
  { symbol: 'ohm', dim: DIM.resistance, factor: 1, aliases: ['Ω'] },
];

const REGISTRY = new Map<string, UnitDef>();
for (const u of UNITS) {
  for (const key of [u.symbol, ...(u.aliases ?? [])]) {
    if (REGISTRY.has(key)) throw new Error(`Duplicate unit spelling "${key}"`);
    REGISTRY.set(key, u);
  }
}

export class UnitError extends Error {
  override name = 'UnitError';
}

/** Resolves a unit spelling (canonical symbol or alias). */
export function getUnit(symbol: string): UnitDef {
  const u = REGISTRY.get(symbol.trim());
  if (!u) throw new UnitError(`Unknown unit "${symbol}"`);
  return u;
}

export function isKnownUnit(symbol: string): boolean {
  return REGISTRY.has(symbol.trim());
}

export function sameDimension(a: Dimension, b: Dimension): boolean {
  return a.every((x, i) => x === b[i]);
}

export function toSI(value: number, unit: string): number {
  const u = getUnit(unit);
  return value * u.factor + (u.offset ?? 0);
}

export function fromSI(valueSI: number, unit: string): number {
  const u = getUnit(unit);
  return (valueSI - (u.offset ?? 0)) / u.factor;
}

/** Converts between units of the same dimension; throws on a dimension mismatch. */
export function convert(value: number, from: string, to: string): number {
  const a = getUnit(from);
  const b = getUnit(to);
  if (!sameDimension(a.dim, b.dim)) {
    throw new UnitError(`Cannot convert "${from}" to "${to}": different dimensions`);
  }
  return fromSI(toSI(value, from), to);
}

/** Canonical SI unit symbol for a dimension, if one is registered with factor 1. */
export function siUnitFor(dim: Dimension): string | undefined {
  return UNITS.find((u) => u.factor === 1 && !u.offset && sameDimension(u.dim, dim))?.symbol;
}

/** Units that can display a quantity of the given dimension (for unit pickers). */
export function unitsFor(dim: Dimension): string[] {
  return UNITS.filter((u) => sameDimension(u.dim, dim)).map((u) => u.symbol);
}

/** Pretty label for display: "m/s^2" → "m/s²", "degC" → "°C". */
export function unitLabel(symbol: string): string {
  const special: Record<string, string> = {
    deg: '°',
    degC: '°C',
    um: 'µm',
    uC: 'µC',
    angstrom: 'Å',
    ohm: 'Ω',
    '1': '',
    'kg*m/s': 'kg·m/s',
  };
  if (symbol in special) return special[symbol] ?? symbol;
  return symbol.replace(/\^2/g, '²').replace(/\^3/g, '³').replace(/\*/g, '·');
}
