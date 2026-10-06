import type { LocalizedText } from '@/core/data/dataset';
import { toSI } from '@/core/units';
import type { ParamSource, Params, PhysicsScene } from '@/physics/types';

/**
 * "Thử thách nhỏ" (PROMPT_PHAN_2 A4.1): the learner changes one or two parameters to reach a
 * goal on an answer of the scene. The goal is checked with the scene's own `solve()` — the same
 * engine-computed answers as "Lời giải" — so no number here is written by hand except the target
 * of a `target` goal, which the tests prove reachable inside the slider range.
 */
export type ChallengeGoal =
  | { answer: string; kind: 'max' | 'min' }
  /** `value` and `tol` in SI. */
  | { answer: string; kind: 'target'; value: number; tol: number };

export interface Challenge {
  id: string;
  topic: string;
  title: LocalizedText;
  task: LocalizedText;
  /** Parameters the learner may change. Every other parameter stays at `start`. */
  controls: string[];
  /** Starting values (SI) on top of the scene defaults. */
  start?: Params;
  goal: ChallengeGoal;
  hint: LocalizedText;
}

const L = (vi: string, en: string): LocalizedText => ({ vi, en });

export const CHALLENGES: readonly Challenge[] = [
  {
    id: 'uniformMotion.meet5',
    topic: 'uniformMotion',
    title: L('Hẹn gặp lúc 5 giây', 'Meet at 5 seconds'),
    task: L(
      'Chỉnh vận tốc của xe B để hai xe gặp nhau đúng lúc t = 5 s.',
      'Set car B’s velocity so that the two cars meet at exactly t = 5 s.',
    ),
    controls: ['vB'],
    goal: { answer: 'meet_time', kind: 'target', value: 5, tol: 0.1 },
    hint: L(
      'Hai xe đi ngược chiều. Xe B chạy nhanh hơn thì gặp sớm hơn hay muộn hơn?',
      'The cars move towards each other. Does a faster car B meet earlier or later?',
    ),
  },
  {
    id: 'uniformAcceleration.stop50',
    topic: 'uniformAcceleration',
    title: L('Phanh dừng sau 50 m', 'Stop within 50 m'),
    task: L(
      'Chỉnh gia tốc (hãm) của xe A để xe dừng lại sau đúng 50 m.',
      'Set car A’s (braking) acceleration so that it stops after exactly 50 m.',
    ),
    controls: ['aA'],
    goal: { answer: 'stop_distance_A', kind: 'target', value: 50, tol: 1 },
    hint: L(
      'Gia tốc phải ngược dấu với vận tốc. Hãm mạnh hơn thì quãng đường dừng thay đổi thế nào?',
      'The acceleration must oppose the velocity. How does harder braking change the distance?',
    ),
  },
  {
    id: 'freeFall.t2',
    topic: 'freeFall',
    title: L('Rơi đúng 2 giây', 'Fall for 2 seconds'),
    task: L(
      'Chọn độ cao thả vật để vật chạm đất sau đúng 2 s.',
      'Choose the drop height so that the object lands after exactly 2 s.',
    ),
    controls: ['h0'],
    goal: { answer: 'time_of_flight', kind: 'target', value: 2, tol: 0.05 },
    hint: L(
      'Thử vài độ cao rồi xem "Thời gian chuyển động" ở thẻ Lời giải.',
      'Try a few heights and read "Time of flight" in the Solution tab.',
    ),
  },
  {
    id: 'horizontalProjectile.range40',
    topic: 'horizontalProjectile',
    title: L('Ném trúng đích 40 m', 'Hit a target 40 m away'),
    task: L(
      'Chỉnh vận tốc ném để vật rơi cách chân tháp đúng 40 m.',
      'Set the launch speed so that the object lands exactly 40 m from the foot of the tower.',
    ),
    controls: ['v0'],
    goal: { answer: 'range', kind: 'target', value: 40, tol: 0.5 },
    hint: L(
      'Độ cao không đổi nên thời gian rơi không đổi. Tầm xa phụ thuộc vận tốc ném thế nào?',
      'The height is fixed, so the fall time is fixed. How does the range depend on the speed?',
    ),
  },
  {
    id: 'obliqueProjectile.maxRange',
    topic: 'obliqueProjectile',
    title: L('Bay xa nhất', 'Longest throw'),
    task: L(
      'Chỉnh góc ném để vật bay xa nhất (giữ nguyên vận tốc ném).',
      'Adjust the launch angle to throw as far as possible (keep the launch speed).',
    ),
    controls: ['angle'],
    start: { angle: (20 * Math.PI) / 180 },
    goal: { answer: 'range', kind: 'max' },
    hint: L(
      'Góc quá nhỏ thì vật bay ngắn, góc quá lớn thì vật bay cao mà không xa. Thử ở giữa.',
      'Too low and it lands early, too high and it goes up instead of far. Try in between.',
    ),
  },
  {
    id: 'newtonLaws.a3',
    topic: 'newtonLaws',
    title: L('Gia tốc 3 m/s²', 'Acceleration of 3 m/s²'),
    task: L(
      'Chỉnh lực kéo F để vật có gia tốc đúng 3 m/s².',
      'Set the pulling force F so that the block accelerates at exactly 3 m/s².',
    ),
    controls: ['F'],
    goal: { answer: 'acceleration', kind: 'target', value: 3, tol: 0.05 },
    hint: L(
      'Ma sát luôn cản lại. Lực kéo phải lớn hơn ma sát bao nhiêu?',
      'Friction always opposes. How much larger than friction must the pull be?',
    ),
  },
  {
    id: 'inclinedPlane.t2',
    topic: 'inclinedPlane',
    title: L('Trượt xuống trong 2 giây', 'Slide down in 2 seconds'),
    task: L(
      'Chỉnh góc nghiêng để vật trượt từ đỉnh xuống chân dốc trong đúng 2 s.',
      'Set the incline angle so that the block slides from the top to the bottom in exactly 2 s.',
    ),
    controls: ['theta'],
    goal: { answer: 'time_end', kind: 'target', value: 2, tol: 0.05 },
    hint: L(
      'Dốc thoải quá thì vật không trượt (ma sát nghỉ giữ lại). Dốc hơn thì trượt nhanh hơn.',
      'Too gentle and static friction holds the block. Steeper slopes make it faster.',
    ),
  },
  {
    id: 'pulley.a3',
    topic: 'pulley',
    title: L('Hệ tăng tốc 3 m/s²', 'System accelerates at 3 m/s²'),
    task: L(
      'Chỉnh khối lượng m₂ để hệ có gia tốc đúng 3 m/s².',
      'Set the mass m₂ so that the system accelerates at exactly 3 m/s².',
    ),
    controls: ['m2'],
    goal: { answer: 'acceleration', kind: 'target', value: 3, tol: 0.05 },
    hint: L(
      'Vật treo nặng hơn thì kéo mạnh hơn, nhưng cả hệ cũng nặng hơn.',
      'A heavier hanging mass pulls harder, but the whole system is heavier too.',
    ),
  },
  {
    id: 'hookeSpring.T05',
    topic: 'hookeSpring',
    title: L('Chu kì 0,5 giây', 'Period of 0.5 s'),
    task: L(
      'Chỉnh độ cứng k của lò xo để chu kì dao động đúng 0,5 s.',
      'Set the spring constant k so that the period is exactly 0.5 s.',
    ),
    controls: ['k'],
    goal: { answer: 'period', kind: 'target', value: 0.5, tol: 0.01 },
    hint: L(
      'Lò xo cứng hơn thì vật dao động nhanh hơn hay chậm hơn?',
      'Does a stiffer spring make the mass oscillate faster or slower?',
    ),
  },
  {
    id: 'springPendulum.T05',
    topic: 'springPendulum',
    title: L('Chu kì 0,5 giây', 'Period of 0.5 s'),
    task: L(
      'Chỉnh khối lượng của vật để chu kì dao động đúng 0,5 s.',
      'Set the mass so that the period is exactly 0.5 s.',
    ),
    controls: ['m'],
    goal: { answer: 'period', kind: 'target', value: 0.5, tol: 0.01 },
    hint: L(
      'Vật nặng hơn thì dao động nhanh hơn hay chậm hơn?',
      'Does a heavier mass oscillate faster or slower?',
    ),
  },
  {
    id: 'simplePendulum.T15',
    topic: 'simplePendulum',
    title: L('Chu kì 1,5 giây', 'Period of 1.5 s'),
    task: L(
      'Chỉnh chiều dài dây để chu kì (góc nhỏ) T₀ đúng 1,5 s.',
      'Set the string length so that the small-angle period T₀ is exactly 1.5 s.',
    ),
    controls: ['L'],
    goal: { answer: 'period_small', kind: 'target', value: 1.5, tol: 0.01 },
    hint: L(
      'Dây dài hơn thì con lắc đưa qua đưa lại nhanh hơn hay chậm hơn?',
      'Does a longer string swing faster or slower?',
    ),
  },
  {
    id: 'energyConservation.v10',
    topic: 'energyConservation',
    title: L('Tốc độ 10 m/s ở đáy', '10 m/s at the bottom'),
    task: L(
      'Chỉnh độ cao H để tốc độ tại điểm thấp nhất đúng 10 m/s.',
      'Set the height H so that the speed at the lowest point is exactly 10 m/s.',
    ),
    controls: ['H'],
    goal: { answer: 'v_low', kind: 'target', value: 10, tol: 0.1 },
    hint: L(
      'Thế năng ở trên cao biến thành động năng ở dưới thấp.',
      'Potential energy at the top turns into kinetic energy at the bottom.',
    ),
  },
  {
    id: 'collisions.stop1',
    topic: 'collisions',
    title: L('Vật 1 đứng yên', 'Stop ball 1'),
    task: L(
      'Chỉnh khối lượng m₂ để sau va chạm vật 1 đứng yên.',
      'Set the mass m₂ so that ball 1 stops after the collision.',
    ),
    controls: ['m2'],
    goal: { answer: 'v1x_after', kind: 'target', value: 0, tol: 0.03 },
    hint: L(
      'Thử m₂ lớn hơn và nhỏ hơn m₁: vật 1 bật lại hay đi tiếp?',
      'Try m₂ larger and smaller than m₁: does ball 1 bounce back or keep going?',
    ),
  },
];

export function challengesFor(topic: string): Challenge[] {
  return CHALLENGES.filter((c) => c.topic === topic);
}

/**
 * Parameters at the start of a challenge: scene defaults (with the learner's g from Settings,
 * when given) + `start`.
 */
export function startParams(scene: PhysicsScene, c: Challenge, g?: number): Params {
  const base = { ...scene.defaults, ...c.start };
  return scene.usesGravity && g !== undefined ? { ...base, g } : base;
}

/** Engine answer `id` for `params`, or null when it is not defined (invalid / not finite). */
export function answerValue(scene: PhysicsScene, params: Params, id: string): number | null {
  if ((scene.validate?.(params) ?? []).length > 0) return null;
  try {
    const a = scene.solve(params, 'vi').answers.find((x) => x.id === id);
    return a && Number.isFinite(a.value) ? a.value : null;
  } catch {
    return null;
  }
}

/** Slider range of a control in SI. */
function rangeSI(scene: PhysicsScene, key: string): [number, number] {
  const def = scene.params.find((d) => d.key === key);
  const unit = def?.unit ?? '1';
  return [toSI(def?.min ?? 0, unit), toSI(def?.max ?? 1, unit)];
}

/**
 * Best value of a `max`/`min` goal over the controls' slider ranges: a grid search refined
 * around the best point (deterministic, uses only `solve()`).
 */
export function optimum(
  scene: PhysicsScene,
  c: Challenge,
  base: Params = startParams(scene, c),
): { value: number; params: Params } {
  const sign = c.goal.kind === 'min' ? -1 : 1;
  const found: { best: { value: number; params: Params } | null } = { best: null };
  const consider = (p: Params) => {
    const v = answerValue(scene, p, c.goal.answer);
    if (v !== null && (found.best === null || sign * v > sign * found.best.value))
      found.best = { value: v, params: p };
  };
  // One or two controls: a grid over the slider ranges, then 3 refinements of ±2 cells.
  let ranges = c.controls.map((k) => rangeSI(scene, k));
  const n = c.controls.length === 1 ? 200 : 40;
  for (let pass = 0; pass < 4; pass++) {
    const axes = ranges.map(([a, b]) =>
      Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n),
    );
    const visit = (i: number, p: Params) => {
      if (i === c.controls.length) {
        consider(p);
        return;
      }
      for (const x of axes[i] ?? []) visit(i + 1, { ...p, [c.controls[i] ?? '']: x });
    };
    visit(0, base);
    const best = found.best;
    if (best === null) break;
    ranges = c.controls.map((k, i) => {
      const [lo, hi] = rangeSI(scene, k);
      const [a0, b0] = ranges[i] ?? [lo, hi];
      const cell = (b0 - a0) / n;
      const x = best.params[k] ?? lo;
      return [Math.max(lo, x - 2 * cell), Math.min(hi, x + 2 * cell)] as [number, number];
    });
  }
  if (found.best === null) throw new Error(`challenge ${c.id}: no valid parameters`);
  return found.best;
}

export type ChallengeStatus =
  | { state: 'invalid' }
  /** A parameter that is not a control was changed: the challenge needs a restart. */
  | { state: 'changed'; keys: string[] }
  | { state: 'trying' | 'done'; value: number; goal: number; tol: number };

/** Relative tolerance of `max`/`min` goals (the slider step is finer than this). */
export const OPTIMUM_TOL = 0.005;

/**
 * Where the learner stands. A challenge starts with every parameter at its default source, so
 * a non-control parameter with source "user"/"problem" means the rules were changed.
 */
export function evaluate(
  scene: PhysicsScene,
  c: Challenge,
  params: Params,
  sources: Record<string, ParamSource>,
  best?: number,
): ChallengeStatus {
  const changed = scene.params
    .map((d) => d.key)
    .filter((k) => !c.controls.includes(k) && (sources[k] ?? 'default') !== 'default');
  if (changed.length > 0) return { state: 'changed', keys: changed };
  const value = answerValue(scene, params, c.goal.answer);
  if (value === null) return { state: 'invalid' };
  if (c.goal.kind === 'target') {
    const ok = Math.abs(value - c.goal.value) <= c.goal.tol;
    return { state: ok ? 'done' : 'trying', value, goal: c.goal.value, tol: c.goal.tol };
  }
  const target = best ?? optimum(scene, c, params).value;
  const tol = Math.abs(target) * OPTIMUM_TOL;
  const ok = c.goal.kind === 'max' ? value >= target - tol : value <= target + tol;
  return { state: ok ? 'done' : 'trying', value, goal: target, tol };
}
