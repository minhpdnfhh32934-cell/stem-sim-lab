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
      'Nếu xe A chạy nhanh gấp đôi, thời điểm hai xe gặp nhau tăng, giảm hay không đổi?',
      'If car A goes twice as fast, does the meeting time go up, go down or stay the same?',
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
      'Nếu ném ngang nhanh gấp đôi, thời gian vật bay trong không khí thay đổi thế nào?',
      'If thrown horizontally twice as fast, how does the time in the air change?',
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
      'Nếu vật 2 nặng gấp đôi, vận tốc của vật 2 sau va chạm tăng, giảm hay không đổi?',
      'If ball 2 is twice as heavy, does its velocity after the collision go up, go down or stay the same?',
    ),
    choices: DIRS,
  },
  {
    id: 'newtonThirdLaw.m2',
    topic: 'newtonThirdLaw',
    param: 'm2',
    factor: 2,
    answer: 'F0',
    question: L(
      'Nếu xe 2 nặng gấp đôi, lực lò xo đẩy mỗi xe lúc vừa thả tăng, giảm hay không đổi?',
      'If cart 2 is twice as heavy, does the force the spring puts on each cart at release go up, go down or stay the same?',
    ),
    choices: DIRS,
  },
  {
    id: 'fluidFall.m',
    topic: 'fluidFall',
    param: 'm',
    factor: 4,
    answer: 'vt',
    question: L(
      'Quả cầu cùng kích thước nhưng nặng gấp 4 lần rơi trong không khí. Tốc độ giới hạn gấp mấy lần?',
      'A sphere of the same size but four times as heavy falls through air. How many times larger is its terminal speed?',
    ),
    choices: ratios(1, 2, 4),
    start: { fluid: 0 },
  },
  {
    id: 'forceComposition.angle',
    topic: 'forceComposition',
    param: 'a2',
    factor: 2,
    answer: 'R',
    question: L(
      'Hai lực 3 N và 4 N. Nếu góc giữa chúng tăng từ 60° lên 120° thì hợp lực tăng, giảm hay không đổi?',
      'Two forces of 3 N and 4 N. If the angle between them grows from 60° to 120°, does the resultant go up, go down or stay the same?',
    ),
    choices: DIRS,
    start: { count: 2, a1: 0, a2: Math.PI / 3 },
  },
  {
    id: 'stringTension.a1',
    topic: 'stringTension',
    param: 'a1',
    factor: 2,
    answer: 'T2',
    question: L(
      'Đèn treo bằng hai dây cùng nghiêng 30°. Nếu dây trái nghiêng nhiều hơn (30° lên 60°), lực căng của dây phải tăng, giảm hay không đổi?',
      'A lamp hangs from two strings, both 30° from the vertical. If the left string slants more (30° to 60°), does the tension in the right string go up, go down or stay the same?',
    ),
    choices: DIRS,
    start: { strings: 2, a1: Math.PI / 6, a2: Math.PI / 6 },
  },
  {
    id: 'torqueBalance.m2',
    topic: 'torqueBalance',
    param: 'm2',
    factor: 2,
    answer: 'd2star',
    question: L(
      'Nếu vật bên phải nặng gấp đôi, nó phải đặt cách trục bao xa (so với trước) để thanh vẫn cân bằng?',
      'If the right weight is twice as heavy, how far from the axle (compared with before) must it sit for the beam to balance?',
    ),
    choices: ratios(0.5, 1, 2),
  },
  {
    id: 'uniformCircularMotion.r',
    topic: 'uniformCircularMotion',
    param: 'r',
    factor: 2,
    answer: 'a_c',
    question: L(
      'Giữ nguyên tốc độ v, nếu bán kính quỹ đạo gấp đôi thì gia tốc hướng tâm thay đổi thế nào?',
      'Keeping the speed v, if the radius doubles, how does the centripetal acceleration change?',
    ),
    choices: ratios(0.5, 1, 2),
    // mode 0 = "Biết tốc độ v": v stays fixed while r changes.
    start: { mode: 0 },
  },
  {
    id: 'standingWave.tension',
    topic: 'standingWave',
    param: 'tension',
    factor: 4,
    answer: 'frequency',
    question: L(
      'Giữ nguyên dây và số bó sóng, nếu lực căng dây tăng 4 lần thì tần số của sóng dừng thay đổi thế nào?',
      'Keeping the same string and number of loops, if the tension is 4 times larger, how does the standing-wave frequency change?',
    ),
    choices: ratios(1, 2, 4),
    // mode 0 = "Tìm f (biết L, v, n)"; vFrom 1 = v from the tension and the linear density.
    start: { mode: 0, vFrom: 1 },
  },
  {
    id: 'interference.d',
    topic: 'interference',
    param: 'd',
    factor: 2,
    answer: 'fringe_spacing',
    question: L(
      'Giữ nguyên tần số và tốc độ truyền sóng, nếu khoảng cách hai nguồn S₁S₂ gấp đôi thì khoảng cách giữa hai cực đại liên tiếp trên S₁S₂ thay đổi thế nào?',
      'Keeping the frequency and the wave speed, if the source separation S₁S₂ doubles, how does the spacing of neighbouring maxima on S₁S₂ change?',
    ),
    choices: ratios(0.5, 1, 2),
  },
  {
    id: 'electricField.d',
    topic: 'electricField',
    param: 'd',
    factor: 2,
    answer: 'E',
    question: L(
      'Tụ điện phẳng (SimLab chuyển sang khi bạn bấm “Chạy để kiểm tra”): giữ nguyên hiệu điện thế U, nếu khoảng cách hai bản tụ gấp đôi thì điện trường giữa hai bản thay đổi thế nào?',
      'Parallel-plate capacitor (SimLab switches to it when you press “Run to check”): keeping the voltage U, if the plate separation doubles, how does the field between the plates change?',
    ),
    choices: ratios(0.5, 1, 2),
    // mode 1 = "Tụ điện phẳng": U stays fixed while d changes.
    start: { mode: 1 },
  },
  {
    id: 'forcedOscillation.Omega',
    topic: 'forcedOscillation',
    param: 'Omega',
    factor: 2,
    answer: 'A',
    question: L(
      'Vật 0,5\u00a0kg, lò xo 50\u00a0N/m (ω₀\u00a0=\u00a010\u00a0rad/s), ngoại lực có Ω\u00a0=\u00a05\u00a0rad/s (SimLab đặt sẵn khi bạn bấm “Chạy để kiểm tra”): giữ nguyên mọi thứ khác, nếu Ω tăng gấp đôi thì biên độ dao động ổn định tăng, giảm hay không đổi?',
      'A 0.5\u00a0kg body, a 50\u00a0N/m spring (ω₀\u00a0=\u00a010\u00a0rad/s), driven at Ω\u00a0=\u00a05\u00a0rad/s (SimLab sets it when you press “Run to check”): keeping everything else, if Ω doubles, does the steady amplitude go up, down or stay the same?',
    ),
    choices: DIRS,
    start: { Omega: 5, F0: 1, b: 0.5, m: 0.5, k: 50, x0: 0 },
  },
  {
    id: 'dcCircuit.R2',
    topic: 'dcCircuit',
    param: 'R2',
    factor: 2,
    answer: 'I',
    question: L(
      'Mạch R₁ nt (R₂ ∥ R₃) (SimLab đặt sẵn khi bạn bấm “Chạy để kiểm tra”): giữ nguyên nguồn và R₁, R₃, nếu R₂ tăng gấp đôi thì cường độ dòng điện qua nguồn tăng, giảm hay không đổi?',
      'Circuit R₁ + (R₂ ∥ R₃) (SimLab sets it when you press “Run to check”): keeping the source, R₁ and R₃, if R₂ doubles, does the current through the source go up, down or stay the same?',
    ),
    choices: DIRS,
    // layout 5 = R₁ nt (R₂ ∥ R₃).
    start: { layout: 5 },
  },
  {
    id: 'keplerOrbit.e',
    topic: 'keplerOrbit',
    param: 'e',
    factor: 2,
    answer: 'speedRatio',
    question: L(
      'Quỹ đạo có tâm sai 0,2 (SimLab đặt sẵn khi bạn bấm “Chạy để kiểm tra”): nếu tâm sai tăng gấp đôi thì tỉ số tốc độ ở cận nhật và ở viễn nhật tăng, giảm hay không đổi?',
      'An orbit of eccentricity 0.2 (SimLab sets it when you press “Run to check”): if the eccentricity doubles, does the ratio of the perihelion and aphelion speeds go up, down or stay the same?',
    ),
    choices: DIRS,
    start: { e: 0.2, N: 6, T: 12 },
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
