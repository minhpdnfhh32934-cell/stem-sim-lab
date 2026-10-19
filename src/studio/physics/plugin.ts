import { useSettingsStore } from '@/app/settings/settingsStore';
import type { Source } from '@/core/data/dataset';
import { loadScene } from '@/physics/registry';
import type { SubjectPlugin } from '../flow/types';
import type { StudioScenario } from '../scenario';
import { engineEvidence, type StudioSession } from '../session';
import { conditionParams, physicsOf } from './comparison';
import { Facts, Interact, Observe, Predict } from './PhysicsSteps';

/** Sources of the scene's Science Card for the recorded condition A. */
async function modelSources(scenario: StudioScenario, session: StudioSession): Promise<Source[]> {
  const ctx = physicsOf(scenario);
  if (!ctx) return [];
  const scene = await loadScene(ctx.b.scene);
  const g =
    engineEvidence(session)[0]?.conditions[0]?.inputs.find((q) => q.id === 'g')?.value ??
    useSettingsStore.getState().defaultGravity;
  const { A } = conditionParams(scene, scenario, ctx.b, ctx.poe, session.inputs, g);
  return scene.scienceCard(A).sources;
}

export const physicsPlugin: SubjectPlugin = { Predict, Interact, Observe, Facts, modelSources };
