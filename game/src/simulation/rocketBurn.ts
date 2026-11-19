/*
 * What a methane–oxygen rocket engine burns (Phú 2026-11-18: the opening rocket's flame, its
 * chemistry shown): CH₄ + 2 O₂ → CO₂ + 2 H₂O, mixed fuel-rich as engines run (cooler than the
 * stoichiometric mix), so some methane leaves unburnt. Heat from the reaction's enthalpy with the
 * water as vapour. Pure.
 */

export const G0 = 9.80665;

/** Molar masses (g/mol) and the reaction's enthalpy (kJ/mol of CH₄, water as vapour). */
export const MOLAR = { CH4: 16.043, O2: 31.998, CO2: 44.009, H2O: 18.015 } as const;
export const COMBUSTION_KJ_PER_MOL = 802.3;

export interface Burn {
  /** Into the engines (kg/s). */
  readonly methane: number;
  readonly oxygen: number;
  /** Out of them (kg/s): the products, and the methane left unburnt (the mix is fuel-rich). */
  readonly carbonDioxide: number;
  readonly water: number;
  readonly unburnt: number;
  /** Oxidiser to fuel for complete burning, by mass. */
  readonly stoichiometric: number;
  /** Heat released (W). */
  readonly heat: number;
}

/** What burns each second at a thrust (N), for the engines' Isp (s) and oxidiser-to-fuel mix. */
export function burnAt(thrust: number, isp: number, mixture: number): Burn {
  const total = thrust / (isp * G0);
  const methane = total / (1 + mixture);
  const oxygen = total - methane;
  const molCH4 = (methane * 1000) / MOLAR.CH4;
  const molO2 = (oxygen * 1000) / MOLAR.O2;
  // The oxygen runs out first in a fuel-rich mix (two of it per methane).
  const burned = Math.min(molCH4, molO2 / 2);
  return {
    methane,
    oxygen,
    carbonDioxide: (burned * MOLAR.CO2) / 1000,
    water: (burned * 2 * MOLAR.H2O) / 1000,
    unburnt: ((molCH4 - burned) * MOLAR.CH4) / 1000,
    stoichiometric: (2 * MOLAR.O2) / MOLAR.CH4,
    heat: burned * COMBUSTION_KJ_PER_MOL * 1000,
  };
}
