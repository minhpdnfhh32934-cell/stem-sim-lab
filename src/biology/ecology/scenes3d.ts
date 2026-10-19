/**
 * 3D scenes of the ecology lessons. Every count comes from the lesson's model (`eco3d.ts`); the
 * habitat, the figures and where they stand are illustration.
 *
 * - Logistic growth: one population in a round habitat that fills up as N(t) grows, and a
 *   column filled to N(t) with marks at K and K/2.
 * - Lotka–Volterra: prey (small figures) and predators (larger figures) in one habitat, each
 *   with a column filled to its share of the run's peak.
 */
import type { Bio3DScene, SceneKit, Vec3 } from '../view3d/kit';
import { logisticMoment, lvMoment, lvSampleAt, type LvTrajectory } from './eco3d';
import { gauge, ground, population } from '../view3d/creatures';
import type { LogisticState } from './store';

/** Outline of a round habitat of radius r (and the columns up to height h beside it). */
function habitatOutline(r: number, h: number, extraX: number): Vec3[] {
  const pts: Vec3[] = [];
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    pts.push([r * Math.cos(a), 0, r * Math.sin(a)], [r * Math.cos(a), 1.5, r * Math.sin(a)]);
  }
  pts.push([extraX, 0, 0], [extraX, h * 1.15, 0]);
  return pts;
}

/** Habitat radius for `capacity` figures of size `size` (about 1.6 size apart). */
const habitatRadius = (capacity: number, size: number) =>
  Math.max(6, Math.sqrt(Math.max(1, capacity)) * 0.95 * size);

export interface LogisticSceneInput {
  st: LogisticState;
  per: number;
  capacity: number;
  /** Page labels (the view's localized text with the model's values). */
  texts: { k: string; half: string; title: string };
}

export function buildLogisticScene(kit: SceneKit, input: LogisticSceneInput): Bio3DScene {
  const { st, per, capacity } = input;
  const size = 1;
  const R = habitatRadius(capacity, size);
  ground(kit, R + 1.5, kit.color('--bio3d-ground'));
  const pop = population(kit, {
    capacity,
    radius: R,
    color: kit.color('--chart-1'),
    kind: 'small',
    seed: 1,
    size,
  });
  // The column's top is a little above the larger of K and the run's peak.
  const top = Math.max(st.K, st.N0) * 1.08;
  const height = Math.max(6, R * 0.9);
  const g = gauge(kit, {
    at: [R + 4, 0],
    height,
    radius: Math.max(0.8, R * 0.06),
    color: kit.color('--chart-1'),
    marks: [
      { share: st.K / top, text: input.texts.k },
      { share: st.K / 2 / top, text: input.texts.half },
    ],
    title: input.texts.title,
  });
  return {
    kit,
    bounds: {
      center: [2, height * 0.25, 0],
      radius: R + 5,
      points: habitatOutline(R + 1.5, height, R + 5),
    },
    setTime: (t) => {
      const m = logisticMoment(st, t, per);
      pop.setCount(m.shown);
      g.set(m.value / top);
    },
  };
}

export interface LvSceneInput {
  traj: LvTrajectory;
  per: { prey: number; predators: number };
  capacity: { prey: number; predators: number };
  peak: { prey: number; predators: number };
  texts: { prey: string; predators: string; peakPrey: string; peakPredators: string };
}

export function buildLvScene(kit: SceneKit, input: LvSceneInput): Bio3DScene {
  const { traj, per, capacity, peak } = input;
  const R = habitatRadius(capacity.prey + 2 * capacity.predators, 1);
  ground(kit, R + 1.5, kit.color('--bio3d-ground'));
  const prey = population(kit, {
    capacity: capacity.prey,
    radius: R,
    color: kit.color('--chart-1'),
    kind: 'small',
    seed: 2,
    size: 0.9,
  });
  const predators = population(kit, {
    capacity: capacity.predators,
    radius: R * 0.92,
    color: kit.color('--chart-4'),
    kind: 'large',
    seed: 5,
    size: 1.1,
  });
  const height = Math.max(6, R * 0.9);
  const radius = Math.max(0.7, R * 0.05);
  const gPrey = gauge(kit, {
    at: [R + 3.5, -1.6 * radius],
    height,
    radius,
    color: kit.color('--chart-1'),
    marks: [{ share: 1 / 1.08, text: input.texts.peakPrey }],
    title: input.texts.prey,
  });
  const gPred = gauge(kit, {
    at: [R + 3.5 + 3.4 * radius, 1.6 * radius],
    height,
    radius,
    color: kit.color('--chart-4'),
    marks: [{ share: 1 / 1.08, text: input.texts.peakPredators }],
    title: input.texts.predators,
  });
  return {
    kit,
    bounds: {
      center: [3, height * 0.25, 0],
      radius: R + 6,
      points: habitatOutline(R + 1.5, height, R + 4 + 4 * radius),
    },
    setTime: (t) => {
      const m = lvMoment(traj, lvSampleAt(traj, t), per);
      prey.setCount(m.prey.shown);
      predators.setCount(m.predators.shown);
      gPrey.set(peak.prey > 0 ? m.prey.value / (peak.prey * 1.08) : 0);
      gPred.set(peak.predators > 0 ? m.predators.value / (peak.predators * 1.08) : 0);
    },
  };
}
