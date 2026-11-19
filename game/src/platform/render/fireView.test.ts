import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Game } from '../../game/Game';
import { FireView } from './fireView';

afterEach(() => vi.unstubAllGlobals());

/** A fire burning for a few seconds under `level`: how much smoke each pool holds then. */
function smokeAt(level: 'high' | 'ultra') {
  // The ember bed's glow is drawn on a canvas: none here (no DOM in a unit test).
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) });
  const burning = {
    item: { visual: { size: [0.5, 0.1, 0.5] } },
    pose: { position: [0, 0.9, 0], rotation: [0, 0, 0, 1] },
  };
  const game = {
    graphicsQuality: level,
    world: { entity: () => burning },
    fires: {
      list: [{ entityId: 'f', position: [0, 0.9, 0], radius: 0.3, size: 1 }],
      spraying: false,
      sprayFrom: [0, 0, 0],
      sprayTo: [0, 0, 0],
    },
  } as unknown as Game;
  const view = new FireView(new THREE.Group(), game);
  for (let i = 0; i < 180; i++) view.update(1 / 60, 900, 60);
  const pools = view as unknown as { smoke: { count: number }; soot: { count: number } };
  return { plain: pools.smoke.count, soot: pools.soot.count };
}

describe('the fire drawn (fireView.ts)', () => {
  it('Max: its smoke billows, lit by the flames (its own pool); Ultra keeps the plain smoke', () => {
    const ultra = smokeAt('high');
    expect(ultra.plain).toBeGreaterThan(0);
    expect(ultra.soot).toBe(0);
    const max = smokeAt('ultra');
    expect(max.soot).toBeGreaterThan(0);
    expect(max.plain).toBe(0);
  });
});
