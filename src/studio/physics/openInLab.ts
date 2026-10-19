import { openTopic } from '@/app/topics';
import type { ParamSource, PhysicsScene } from '@/physics/types';
import type { StudioScenario } from '../scenario';
import { conditionParams, poeById } from './comparison';

/** Opens the real, running lab scene with condition A or B of the studio session. */
export async function openConditionInLab(
  scene: PhysicsScene,
  scenario: StudioScenario,
  inputs: Record<string, number>,
  g: number,
  condition: 'A' | 'B',
): Promise<void> {
  const b = scenario.binding;
  if (b.kind !== 'physics') return;
  const poe = poeById(b.poe);
  if (!poe) return;
  const { A, B } = conditionParams(scene, scenario, b, poe, inputs, g);
  const params = condition === 'A' ? A : B;
  const changed = new Set([...b.controls, poe.param, ...Object.keys(scenario.initial)]);
  const sources: Record<string, ParamSource> = {};
  for (const key of Object.keys(params)) sources[key] = changed.has(key) ? 'user' : 'default';
  await openTopic(scene.id, { params, sources });
}
