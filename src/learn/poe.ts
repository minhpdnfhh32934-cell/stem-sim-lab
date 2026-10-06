import type { LocalizedText } from '@/core/data/dataset';
import type { Params, PhysicsScene } from '@/physics/types';
import { answerValue } from './challenges';

/**
 * "Dự đoán trước" — Predict, Observe, Explain (PROMPT_PHAN_2 A4.1). One question per topic:
 * "if parameter X is multiplied by k, what happens to answer Y?". The correct choice is not
 * written by hand: it is computed by comparing the scene's `solve()` before and after.
 * The explanation is the learner's own (POE): the app shows the computed numbers.
 */
export type PoeChoice =
  | { kind: 'direction'; dir: 'up' | 'down' | 'same' }
  /** after / before ratio offered as a choice. */
  | { kind: 'ratio'; ratio: number };

export interface Poe {
  id: string;
  topic: string;
  /** Parameter changed, multiplied by `factor` (SI). */
  param: string;
  factor: number;
  answer: string;
  question: LocalizedText;
  choices: PoeChoice[];
  start?: Params;
}

const L = (vi: string, en: string): LocalizedText => ({ vi, en });
const DIRS: PoeChoice[] = [
  { kind: 'direction', dir: 'up' },
  { kind: 'direction', dir: 'down' },
  { kind: 'direction', dir: 'same' },
];
const ratios = (...r: number[]): PoeChoice[] => r.map((ratio) => ({ kind: 'ratio', ratio }));

export const POES: readonly Poe[] = [
  {
    id: 'uniformMotion.vA',
    topic: 'uniformMotion',
    param: 'vA',
    factor: 2,
    answer: 'meet_time',
    question: L(
      'Nếu xe A chạy nhanh gấp đôi, hai xe gặp nhau sớm hơn, muộn hơn hay đúng lúc cũ?',
      'If car A goes twice as fast, do the cars meet earlier, later or at the same time?',
    ),
    choices: DIRS,
  },
  {
    id: 'uniformAcceleration.vA',
    topic: 'uniformAcceleration',
    param: 'vA',
    factor: 2,
    answer: 'stop_distance_A',
    question: L(
      'Giữ nguyên lực hãm, nếu xe A chạy nhanh gấp đôi thì quãng đường đến khi dừng thay đổi thế nào?',
      'With the same braking, if car A goes twice as fast, how does the stopping distance change?',
    ),
    choices: ratios(1, 2, 4),
  },
  {
    id: 'freeFall.h0',
    topic: 'freeFall',
    param: 'h0',
    factor: 2,
    answer: 'time_of_flight',
    question: L(
      'Nếu thả vật từ độ cao gấp đôi, thời gian rơi thay đổi thế nào?',
      'If the object is dropped from twice the height, how does the fall time change?',
    ),
    choices: ratios(1, Math.SQRT2, 2, 4),
  },
  {
    id: 'horizontalProjectile.v0',
    topic: 'horizontalProjectile',
    param: 'v0',
    factor: 2,
    answer: 'time_of_flight',
    question: L(
      'Nếu ném ngang nhanh gấp đôi, vật bay trong không khí lâu hơn, ngắn hơn hay như cũ?',
      'If thrown horizontally twice as fast, does it stay in the air longer, shorter or the same?',
    ),
    choices: ratios(0.5, 1, 2),
  },
  {
    id: 'obliqueProjectile.m',
    topic: 'obliqueProjectile',
    param: 'm',
    factor: 2,
    answer: 'range',
    question: L(
      'Bỏ qua sức cản không khí: nếu vật nặng gấp đôi thì tầm xa thay đổi thế nào?',
      'Ignoring air resistance: if the object is twice as heavy, how does the range change?',
    ),
    choices: ratios(0.5, 1, 2),
  },
  {
    id: 'newtonLaws.m',
    topic: 'newtonLaws',
    param: 'm',
    factor: 2,
    answer: 'acceleration',
    question: L(
      'Giữ nguyên lực kéo, nếu vật nặng gấp đôi thì gia tốc tăng, giảm hay không đổi?',
      'With the same pull, if the block is twice as heavy, does the acceleration go up, down or stay?',
    ),
    choices: DIRS,
  },
  {
    id: 'inclinedPlane.m',
    topic: 'inclinedPlane',
    param: 'm',
    factor: 2,
    answer: 'acceleration',
    question: L(
      'Không có lực kéo: nếu vật trên dốc nặng gấp đôi thì gia tốc thay đổi thế nào?',
      'With no pulling force: if the block on the slope is twice as heavy, how does the acceleration change?',
    ),
    choices: ratios(0.5, 1, 2),
  },
  {
    id: 'pulley.m2',
    topic: 'pulley',
    param: 'm2',
    factor: 2,
    answer: 'acceleration',
    question: L(
      'Nếu vật treo m₂ nặng gấp đôi, gia tốc của hệ tăng, giảm hay không đổi?',
      'If the hanging mass m₂ is doubled, does the system’s acceleration go up, down or stay?',
    ),
    choices: DIRS,
  },
  {
    id: 'hookeSpring.m',
    topic: 'hookeSpring',
    param: 'm',
    factor: 4,
    answer: 'period',
    question: L(
      'Nếu treo vật nặng gấp 4 lần vào cùng lò xo, chu kì dao động thay đổi thế nào?',
      'If a mass 4 times heavier hangs on the same spring, how does the period change?',
    ),
    choices: ratios(0.5, 1, 2, 4),
  },
  {
    id: 'springPendulum.x0',
    topic: 'springPendulum',
    param: 'x0',
    factor: 2,
    answer: 'period',
    question: L(
      'Nếu kéo vật lệch ra xa gấp đôi rồi thả, chu kì dao động thay đổi thế nào?',
      'If the mass is pulled twice as far before release, how does the period change?',
    ),
    choices: ratios(0.5, 1, 2),
  },
  {
    id: 'simplePendulum.m',
    topic: 'simplePendulum',
    param: 'm',
    factor: 2,
    answer: 'period_small',
    question: L(
      'Nếu quả nặng của con lắc nặng gấp đôi, chu kì T₀ thay đổi thế nào?',
      'If the pendulum bob is twice as heavy, how does the period T₀ change?',
    ),
    choices: ratios(0.5, 1, 2),
  },
  {
    id: 'energyConservation.m',
    topic: 'energyConservation',
    param: 'm',
    factor: 2,
    answer: 'v_low',
    question: L(
      'Không ma sát: nếu xe nặng gấp đôi thì tốc độ ở điểm thấp nhất thay đổi thế nào?',
      'Without friction: if the cart is twice as heavy, how does the speed at the lowest point change?',
    ),
    choices: ratios(0.5, 1, 2),
  },
  {
    id: 'collisions.m2',
    topic: 'collisions',
    param: 'm2',
    factor: 2,
    answer: 'v2x_after',
    question: L(
      'Nếu vật 2 nặng gấp đôi, sau va chạm vật 2 chạy nhanh hơn, chậm hơn hay như cũ?',
      'If ball 2 is twice as heavy, does it move faster, slower or the same after the collision?',
    ),
    choices: DIRS,
  },
];

export function poeFor(topic: string): Poe | undefined {
  return POES.find((p) => p.topic === topic);
}

/** Relative change below which two values count as "the same". */
const SAME = 1e-6;

export interface PoeOutcome {
  before: number;
  after: number;
  /** Index into `poe.choices` of the computed answer. */
  correct: number;
}

/** Computes the observation: the answer before and after the change, and the right choice. */
export function observe(scene: PhysicsScene, poe: Poe, params: Params): PoeOutcome | null {
  const before = answerValue(scene, params, poe.answer);
  const changed = { ...params, [poe.param]: (params[poe.param] ?? 0) * poe.factor };
  const after = answerValue(scene, changed, poe.answer);
  if (before === null || after === null) return null;
  let correct = -1;
  if (poe.choices[0]?.kind === 'direction') {
    const rel = (after - before) / Math.max(Math.abs(before), 1e-12);
    const dir = Math.abs(rel) < SAME ? 'same' : rel > 0 ? 'up' : 'down';
    correct = poe.choices.findIndex((c) => c.kind === 'direction' && c.dir === dir);
  } else {
    const r = Math.abs(before) < 1e-12 ? NaN : after / before;
    let bestErr = Infinity;
    poe.choices.forEach((c, i) => {
      if (c.kind !== 'ratio') return;
      const err = Math.abs(Math.log(Math.abs(r) / c.ratio));
      if (err < bestErr) {
        bestErr = err;
        correct = i;
      }
    });
    // A ratio that is not one of the choices (more than 5 % away) has no right answer.
    if (!(bestErr < Math.log(1.05))) correct = -1;
  }
  return { before, after, correct };
}

/** The changed parameter value (SI), for "Quan sát" (applied to the simulation). */
export function changedValue(poe: Poe, params: Params): number {
  return (params[poe.param] ?? 0) * poe.factor;
}
