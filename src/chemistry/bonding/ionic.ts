import {
  elementBySymbol,
  elementByZ,
  shellOrder,
  type ElementData,
  type Subshell,
} from '../data/elements';
import { IONS, type IonData } from '../data/ions';
import { bondPolarity, paulingDelta, prettyFormula, type BondPolarity } from '../data/molecules';

/** Metals that give a cation, non-metals that take an anion (data/ions.json). */
export const CATIONS: readonly IonData[] = IONS.filter((i) => i.charge > 0);
export const ANIONS: readonly IonData[] = IONS.filter((i) => i.charge < 0);

function element(symbol: string): ElementData {
  const e = elementBySymbol(symbol);
  if (!e) throw new Error(`unknown element ${symbol}`);
  return e;
}

/**
 * Configuration of the ion, from the atom's configuration in the data table: a cation loses its
 * electrons from the outermost shell (highest n, then highest l), an anion's electrons go into
 * the outermost subshell (the open p subshell for groups 15–17).
 */
export function ionConfiguration(e: ElementData, charge: number): Subshell[] {
  const conf: Subshell[] = shellOrder(e.configuration).map(([n, l, k]) => [n, l, k]);
  if (charge > 0) {
    let left = charge;
    while (left > 0) {
      const last = conf[conf.length - 1];
      if (!last) throw new Error(`${e.symbol}${String(charge)}+: not enough electrons`);
      const take = Math.min(left, last[2]);
      last[2] -= take;
      left -= take;
      if (last[2] === 0) conf.pop();
    }
  } else if (charge < 0) {
    const last = conf[conf.length - 1];
    if (!last || last[1] !== 'p' || last[2] - charge > 6) {
      throw new Error(`${e.symbol}${String(-charge)}−: no open p subshell to fill`);
    }
    last[2] -= charge;
  }
  return conf;
}

const sameConfiguration = (a: readonly Subshell[], b: readonly Subshell[]) =>
  a.length === b.length && a.every((s, i) => s.join() === b[i]?.join());

/** The noble gas whose configuration (data table) the ion has, if any. */
export function nobleGasReached(e: ElementData, charge: number): ElementData | null {
  const gas = elementByZ(e.z - charge);
  if (!gas || gas.group !== 18) return null;
  return sameConfiguration(ionConfiguration(e, charge), shellOrder(gas.configuration)) ? gas : null;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

export interface IonicCompound {
  metal: ElementData;
  nonmetal: ElementData;
  /** Ion charges (+a, −b) from the ion table. */
  cationCharge: number;
  anionCharge: number;
  /** Ions per formula unit: x cations, y anions with x·a = y·b = lcm(a, b). */
  cations: number;
  anions: number;
  /** Electrons moved per formula unit: lcm(a, b). */
  electrons: number;
  formula: string;
  /** Pauling |Δχ| and the bond type its thresholds give (SGK Bảng 12.1). */
  deltaEn: number | null;
  bondType: BondPolarity | null;
  cationGas: ElementData | null;
  anionGas: ElementData | null;
}

/** Charge balance of a metal and a non-metal from the ion table. */
export function ionicCompound(metalSymbol: string, nonmetalSymbol: string): IonicCompound {
  const cation = CATIONS.find((i) => i.element === metalSymbol);
  const anion = ANIONS.find((i) => i.element === nonmetalSymbol);
  if (!cation || !anion) throw new Error(`no ion data for ${metalSymbol}/${nonmetalSymbol}`);
  const metal = element(metalSymbol);
  const nonmetal = element(nonmetalSymbol);
  const a = cation.charge;
  const b = -anion.charge;
  const electrons = (a * b) / gcd(a, b);
  const x = electrons / a;
  const y = electrons / b;
  const sub = (n: number) => (n > 1 ? String(n) : '');
  const d = paulingDelta(metalSymbol, nonmetalSymbol);
  return {
    metal,
    nonmetal,
    cationCharge: a,
    anionCharge: -b,
    cations: x,
    anions: y,
    electrons,
    formula: prettyFormula(`${metalSymbol}${sub(x)}${nonmetalSymbol}${sub(y)}`),
    deltaEn: d,
    bondType: d === null ? null : bondPolarity(d),
    cationGas: nobleGasReached(metal, a),
    anionGas: nobleGasReached(nonmetal, -b),
  };
}

/** "Al³⁺", "O²⁻", "Na⁺", "Cl⁻". */
export function ionLabel(symbol: string, charge: number): string {
  const sup = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const n = Math.abs(charge);
  return `${symbol}${n > 1 ? (sup[n] ?? '') : ''}${charge > 0 ? '⁺' : '⁻'}`;
}
