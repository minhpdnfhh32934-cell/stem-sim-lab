/**
 * The animals of the predator–prey habitat: the prey are the logistic habitat's grazers (long
 * ears, a round body, a puff of a tail) tinted in the 2D chart's x(t) colour; the predators are
 * low-poly prowlers (no species: pointed ears, a long muzzle, slender legs and a bushy tail with a
 * pale tip) tinted in its y(t) colour. Each species is one flock (one draw call for the bodies,
 * one for the contact shadows). How many stand comes from the model (`binding.ts`); the shapes,
 * where they stand and how they move (grazers hop and nibble, prowlers sniff and look round) are
 * illustration — the model has no hunting, no space and no individuals.
 */
import * as THREE from 'three';
import type { SceneKit } from '../../view3d/kit';
import { flock, mergeFigure, type Flock, type Part } from '../logistic3d/organisms';
import type { Slot } from './layout';

/** Predators are drawn a little larger than the prey (illustration). */
export const PREDATOR_SIZE = 1.08;

/**
 * One merged prowler standing at the origin facing +z. Nose to tail tip it stays within the
 * Hardy–Weinberg figure's footprint at PREDATOR_SIZE (tested), so the shared spiral keeps every
 * animal clear of its neighbours.
 */
export function prowlerGeometry(): THREE.BufferGeometry {
  const ico = (d: number) => new THREE.IcosahedronGeometry(1, d);
  const cone = (sides: number) => new THREE.ConeGeometry(1, 1, sides);
  const parts: Part[] = [
    // Body, a paler chest, head and muzzle (shade 1: the instance colour, darker underneath).
    [ico(1), 1, [0, 0.52, -0.06], [0.25, 0.24, 0.42]],
    [ico(1), 1.22, [0, 0.55, 0.22], [0.2, 0.22, 0.2]],
    [ico(1), 1, [0, 0.76, 0.34], [0.19, 0.17, 0.19]],
    [cone(6), 1, [0, 0.71, 0.53], [0.085, 0.24, 0.08], [Math.PI / 2, 0, 0]],
    // Nose and eyes (dark).
    [ico(0), 0.06, [0, 0.71, 0.66], [0.04, 0.035, 0.035]],
    [ico(0), 0.06, [-0.085, 0.81, 0.47], [0.04, 0.035, 0.03]],
    [ico(0), 0.06, [0.085, 0.81, 0.47], [0.04, 0.035, 0.03]],
    // Pointed ears with darker inner faces.
    ...[-1, 1].flatMap((sx): Part[] => [
      [cone(4), 1, [sx * 0.11, 0.98, 0.3], [0.075, 0.2, 0.05], [0.08, 0, sx * -0.28]],
      [cone(4), 0.45, [sx * 0.11, 0.97, 0.33], [0.045, 0.13, 0.03], [0.08, 0, sx * -0.28]],
    ]),
    // Slender legs with dark "socks".
    ...[-1, 1].flatMap((sx): Part[] =>
      [0.2, -0.3].map((z): Part => [
        new THREE.BoxGeometry(1, 1, 1),
        0.5,
        [sx * 0.13, 0.19, z],
        [0.075, 0.38, 0.085],
      ]),
    ),
    // Bushy tail sweeping down behind, with a pale tip.
    [ico(1), 1, [0, 0.47, -0.44], [0.12, 0.12, 0.26], [-0.55, 0, 0]],
    [ico(0), 1.5, [0, 0.33, -0.63], [0.08, 0.08, 0.08]],
  ];
  return mergeFigure(parts);
}

export interface Animals {
  prey: Flock;
  predators: Flock;
}

export function animals(
  kit: SceneKit,
  slots: { prey: readonly Slot[]; predators: readonly Slot[] },
  heightAt: (x: number, z: number) => number,
  colors: { prey: string; predators: string },
): Animals {
  return {
    prey: flock(kit, slots.prey, heightAt, colors.prey, { prefix: 'lv-prey' }),
    predators: flock(kit, slots.predators, heightAt, colors.predators, {
      prefix: 'lv-predator',
      shape: { key: 'lv-prowler', make: prowlerGeometry },
      gait: 'prowl',
      size: PREDATOR_SIZE,
    }),
  };
}
