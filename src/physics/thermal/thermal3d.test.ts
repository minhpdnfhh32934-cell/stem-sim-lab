import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { expectAllFreed, testKit } from '@/biology/view3d/testing';
import { heatingPlan, stateAt, totalTime } from './model';
import { buildThermalScene } from './scene3d';
import { COUNT, phasesAt } from './thermal3d';

// The book's question 2, p. 24: 2 kg of copper from 30 °C, 20 000 W, 50 %.
const copper = heatingPlan({ preset: 'copper', m: 2, t0: 30, P: 20000, eff: 0.5 });
const ice = heatingPlan({ preset: 'ice', m: 1, t0: -10, P: 2000, eff: 1 });

describe('heat and phase 3D binding', () => {
  it('solid while heating, the model’s share melted while melting', () => {
    const melt = copper.find((s) => s.kind === 'melt');
    if (!melt) throw new Error('no melting');
    expect(phasesAt(copper, 0)).toMatchObject({
      solid: COUNT,
      liquid: 0,
      gas: 0,
      kind: 'heatSolid',
    });
    // Just after the start: at τ = start exactly, the model still counts the end of heating.
    for (const share of [0.01, 0.25, 0.5, 0.9]) {
      const tau = melt.start + share * melt.dt;
      const p = phasesAt(copper, tau);
      expect(p.kind).toBe('melt');
      expect(p.liquid).toBe(Math.round(COUNT * stateAt(copper, tau).done));
      expect(p.solid + p.liquid + p.gas).toBe(COUNT);
      expect(p.t).toBe(stateAt(copper, tau).t);
    }
  });

  it('ice → water → steam: the share boiled while boiling; hotter jiggles harder', () => {
    const boil = ice.find((s) => s.kind === 'boil');
    if (!boil) throw new Error('no boiling');
    const p = phasesAt(ice, boil.start + 0.3 * boil.dt);
    expect(p).toMatchObject({ solid: 0, gas: Math.round(COUNT * 0.3), kind: 'boil' });
    expect(phasesAt(ice, 0).jiggle).toBeLessThan(p.jiggle);
    expect(phasesAt(ice, totalTime(ice)).gas).toBe(COUNT);
  });
});

describe('heat and phase 3D scene', () => {
  it('setTime recounts the states from the model; frees all', () => {
    const { kit, track, start } = testKit();
    const scene = buildThermalScene(kit, { stages: ice, texts: { t: (p) => String(p.t) } });
    const boil = ice.find((s) => s.kind === 'boil');
    if (!boil) throw new Error('no boiling');
    scene.setTime?.(boil.start + 0.5 * boil.dt);
    expect(scene.state().gas).toBe(Math.round(COUNT * 0.5));
    scene.tick?.(1 / 60);
    const parts = kit.scene.getObjectByName('th-parts') as THREE.InstancedMesh;
    expect(parts.count).toBe(COUNT);
    expectAllFreed(kit, track, start);
  });
});
