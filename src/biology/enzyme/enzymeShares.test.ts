import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { expectAllFreed, testKit } from '../view3d/testing';
import { rate, type EnzymeParams, type Inhibition } from './enzyme';
import { ENZYMES_DRAWN, enzymeShares, moleculesFor, perMolecule, splitCount } from './enzymeShares';
import { buildEnzymeScene } from './scene3d';

const KINDS: Inhibition[] = ['none', 'competitive', 'noncompetitive', 'uncompetitive'];
const params = (kind: Inhibition): EnzymeParams => ({ vmax: 10, km: 2, inhibitor: 2, ki: 1, kind });

describe('enzyme forms in the 3D view', () => {
  it('the share of enzyme holding substrate (ES) is v / Vmax of the lesson’s rate law', () => {
    for (const kind of KINDS) {
      for (const S of [0, 0.1, 1, 2, 5, 20, 100]) {
        const p = params(kind);
        const sh = enzymeShares(p, S);
        expect(sh.E + sh.ES + sh.EI + sh.ESI).toBeCloseTo(1, 12);
        expect(sh.ES * p.vmax, `${kind} S=${String(S)}`).toBeCloseTo(rate(p, S), 10);
        if (kind === 'none') expect(sh.EI + sh.ESI).toBe(0);
        if (kind === 'competitive') expect(sh.ESI).toBe(0);
        if (kind === 'uncompetitive') expect(sh.EI).toBe(0);
      }
    }
  });

  it('counts of drawn molecules add up and stay within one of the exact share', () => {
    for (const kind of KINDS) {
      for (const S of [0.3, 2, 7]) {
        const sh = enzymeShares(params(kind), S);
        const n = splitCount(sh, ENZYMES_DRAWN);
        expect(n.E + n.ES + n.EI + n.ESI).toBe(ENZYMES_DRAWN);
        for (const k of ['E', 'ES', 'EI', 'ESI'] as const)
          expect(Math.abs(n[k] - sh[k] * ENZYMES_DRAWN)).toBeLessThan(1);
      }
    }
    expect(moleculesFor(10, perMolecule(20, 0))).toBe(40);
    expect(moleculesFor(1e6, 1)).toBe(80);
  });

  it('the scene shows substrate in exactly ES + ESI active sites; dispose frees all', () => {
    const { kit, track, start } = testKit();
    const p = params('noncompetitive');
    const s = buildEnzymeScene(kit, {
      kind: p.kind,
      per: perMolecule(20, p.inhibitor),
      inhibitor: p.inhibitor,
      at: (x) => ({ S: x, P: 0, shares: enzymeShares(p, x) }),
    });
    for (const S of [0, 2, 20]) {
      s.setTime?.(S);
      const n = splitCount(enzymeShares(p, S), ENZYMES_DRAWN);
      const counts: number[] = [];
      kit.scene.traverse((o) => {
        if (o instanceof THREE.InstancedMesh) counts.push(o.visible ? o.count : 0);
      });
      // enzymes, pockets, bound substrate, inhibitor in pocket, inhibitor at the other site, …
      expect(counts[0]).toBe(ENZYMES_DRAWN);
      expect(counts[2]).toBe(n.ES + n.ESI);
      expect(counts[3]).toBe(0);
      expect(counts[4]).toBe(n.EI + n.ESI);
    }
    expectAllFreed(kit, track, start);
  });
});
