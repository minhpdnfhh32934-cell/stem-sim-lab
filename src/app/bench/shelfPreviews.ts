import type { ResolvedTheme } from '@/app/settings/settingsStore';
import { hasScene } from '@/physics/registry';

/**
 * Topics without a physics engine frame (chemistry, biology and Fourier) with a picture of their
 * stage at its default values (docs/BENCH_DESIGN.md §9.3): public/shelf/<topic>.<light|dark>.webp,
 * made by scripts/bench/shelf-previews.mjs from the app's own output. Physics scenes draw their
 * engine frame instead (SceneStill).
 */
export const SHELF_PREVIEWS: ReadonlySet<string> = new Set([
  'fourierSeries',
  'periodicTable',
  'electronConfiguration',
  'bohrModel',
  'orbitals',
  'molecule3d',
  'vsepr',
  'bondPolarity',
  'reactionLibrary',
  'equationBalancing',
  'acidBaseTitration',
  'collisionTheory',
  'maxwellBoltzmann',
  'chemicalEquilibrium',
  'crystalStructure',
  'mitosis',
  'meiosis',
  'centralDogma',
  'pointMutation',
  'mendel',
  'hardyWeinberg',
  'geneticDrift',
  'logisticGrowth',
  'lotkaVolterra',
  'michaelisMenten',
  'diffusionOsmosis',
  'cellStructure',
  'cellToDna',
]);

/** The picture of `topic` in `theme`, or null when it has none. */
export function shelfPreviewUrl(topic: string, theme: ResolvedTheme): string | null {
  return SHELF_PREVIEWS.has(topic)
    ? `${import.meta.env.BASE_URL}shelf/${topic}.${theme}.webp`
    : null;
}

/** Whether `topic` has a picture on the shelf: an engine frame or a stage picture. */
export function hasTopicPicture(topic: string): boolean {
  return hasScene(topic) || SHELF_PREVIEWS.has(topic);
}
