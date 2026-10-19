import { useEffect, useState } from 'react';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { loadScene } from '@/physics/registry';
import type { PhysicsScene } from '@/physics/types';
import type { StudioScenario } from '../scenario';
import { engineEvidence, type StudioSession } from '../session';
import { runComparison, type ComparisonResult } from './comparison';

export function useScene(id: string): { scene: PhysicsScene | null; failed: boolean } {
  const [state, setState] = useState<{ id: string; scene: PhysicsScene | null; failed: boolean }>({
    id,
    scene: null,
    failed: false,
  });
  useEffect(() => {
    let alive = true;
    loadScene(id)
      .then((scene) => {
        if (alive) setState({ id, scene, failed: false });
      })
      .catch(() => {
        if (alive) setState({ id, scene: null, failed: true });
      });
    return () => {
      alive = false;
    };
  }, [id]);
  return state.id === id ? state : { scene: null, failed: false };
}

const cache = new Map<string, Promise<ComparisonResult>>();
const CACHE_SIZE = 8;

/** Runs (or reuses) the engine comparison for these exact inputs; the engines are deterministic. */
export function getComparison(
  scene: PhysicsScene,
  scenario: StudioScenario,
  inputs: Record<string, number>,
  g: number,
): Promise<ComparisonResult> {
  const key = JSON.stringify([scenario.id, Object.entries(inputs).sort(), g]);
  let p = cache.get(key);
  if (!p) {
    p = runComparison(scene, scenario, inputs, g);
    cache.set(key, p);
    if (cache.size > CACHE_SIZE) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
  }
  return p;
}

/** g of the recorded run (so a later change in Settings cannot mix two states), else Settings. */
export function useRunGravity(session: StudioSession): number {
  const settingsG = useSettingsStore((s) => s.defaultGravity);
  const recorded = engineEvidence(session)[0]?.conditions[0]?.inputs.find((q) => q.id === 'g');
  return recorded?.value ?? settingsG;
}

/** The comparison behind the recorded evidence (for the graph), recomputed from its inputs. */
export function useComparison(
  scene: PhysicsScene | null,
  scenario: StudioScenario,
  session: StudioSession,
): ComparisonResult | null {
  const g = useRunGravity(session);
  const runAt = engineEvidence(session)[0]?.at ?? null;
  const inputsKey = JSON.stringify(session.inputs);
  const [result, setResult] = useState<{ key: string; r: ComparisonResult } | null>(null);
  const key = `${String(runAt)}|${inputsKey}|${String(g)}`;
  useEffect(() => {
    if (!scene || runAt === null) return;
    let alive = true;
    void getComparison(scene, scenario, JSON.parse(inputsKey) as Record<string, number>, g).then(
      (r) => {
        if (alive) setResult({ key, r });
      },
    );
    return () => {
      alive = false;
    };
  }, [scene, scenario, runAt, inputsKey, g, key]);
  return result?.key === key ? result.r : null;
}
