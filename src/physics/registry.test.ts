import { describe, expect, it } from 'vitest';
import { registeredEngines } from '@/core/sim/engine';
import '@/workers/engines';
import { loadScene, sceneIds } from './registry';

describe('physics registry', () => {
  it('every scene has its engine registered in src/workers/engines.ts', async () => {
    const engines = registeredEngines();
    for (const id of sceneIds()) {
      const scene = await loadScene(id);
      expect(scene.id, id).toBe(id);
      expect(engines, `${id} → ${scene.engineId}`).toContain(scene.engineId);
    }
  });
});
