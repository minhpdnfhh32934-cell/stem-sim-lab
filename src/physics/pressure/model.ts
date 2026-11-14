import { constant } from '@/core/constants';
import { FLUIDS } from '../fluid/model';
import type { Params } from '../types';

/**
 * A point at depth h in a liquid at rest in an open vessel (VL10 Bài 34: khối lượng riêng, áp
 * suất chất lỏng). The liquid is incompressible, so the pressure grows linearly with depth:
 * p = pₐ + ρgh.
 */
export interface Column {
  /** Depth of the point below the surface (m). */
  h: number;
  /** Density of the liquid (kg/m³). */
  rho: number;
  /** Pressure on the open surface (Pa). */
  pa: number;
  g: number;
}

/** Water at 20 °C (IAPWS-95, the drag scene's table) and one standard atmosphere (CODATA). */
export const WATER_RHO = FLUIDS[1]?.rho ?? 998.21;
export const ATM = constant('atm').value;

export function column(p: Params): Column {
  return { h: p.h ?? 2, rho: p.rho ?? WATER_RHO, pa: p.pa ?? ATM, g: p.g ?? 9.81 };
}

/** Pressure the liquid itself causes at the point: the weight of the column above 1 m². */
export const liquidPart = (q: Column) => q.rho * q.g * q.h;

export const totalPressure = (q: Column) => q.pa + liquidPart(q);

/** How long the probe takes to sink to the point (illustration only, at a constant speed). */
export const sinkTime = (q: Column) => (q.h > 0 ? 4 : 1);
