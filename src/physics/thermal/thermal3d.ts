/**
 * What the 3D view of "Nội năng, nhiệt độ, nhiệt lượng" draws (pure, no three.js; tested against
 * the model): a sample of the substance as GRID³ particles at the time cursor τ. How many are
 * solid, liquid or gas comes from the model's `stateAt`: all solid while it heats as a solid, the
 * share `done` liquid while it melts, all liquid while it heats as a liquid, the share `done` gas
 * while it boils. How hard they jiggle grows with the temperature in kelvin (illustration).
 */
import { K_OFFSET, stateAt, type Stage, type StageKind } from './model';

export const GRID = 6;
export const COUNT = GRID * GRID * GRID;

export interface Phases {
  solid: number;
  liquid: number;
  gas: number;
  /** The model's stage at τ, °C at τ and the jiggle share T/T_max (kelvin). */
  kind: StageKind;
  t: number;
  jiggle: number;
}

export function phasesAt(stages: readonly Stage[], tau: number): Phases {
  const now = stateAt(stages, tau);
  const n = (share: number) => Math.round(COUNT * share);
  const tMax = Math.max(...stages.flatMap((s) => [s.from, s.to])) + K_OFFSET;
  const jiggle = (now.t + K_OFFSET) / tMax;
  switch (now.stage.kind) {
    case 'heatSolid':
      return { solid: COUNT, liquid: 0, gas: 0, kind: now.stage.kind, t: now.t, jiggle };
    case 'melt':
      return {
        solid: COUNT - n(now.done),
        liquid: n(now.done),
        gas: 0,
        kind: now.stage.kind,
        t: now.t,
        jiggle,
      };
    case 'heatLiquid':
      return { solid: 0, liquid: COUNT, gas: 0, kind: now.stage.kind, t: now.t, jiggle };
    case 'boil':
      return {
        solid: 0,
        liquid: COUNT - n(now.done),
        gas: n(now.done),
        kind: now.stage.kind,
        t: now.t,
        jiggle,
      };
  }
}
