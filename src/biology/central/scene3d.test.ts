import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { SceneKit } from '../view3d/kit';
import { expectAllFreed, testKit } from '../view3d/testing';
import { analyzeMutation, mutatedTranslation } from './dogma';
import { MAX_BP, buildMutationScene } from './scene3d';

const CODING = 'TACATGGCTTTCAAAGGCTGGTAAGC';

/** Labels drawn on the page, and how many rungs (half base pairs) the helices have. */
function census(kit: SceneKit) {
  const labels: string[] = [];
  let tori = 0;
  kit.scene.traverse((o) => {
    const el = (o as { element?: HTMLElement }).element;
    if (el) labels.push(el.textContent);
    if (o instanceof THREE.Mesh && o.geometry instanceof THREE.TorusGeometry) tori++;
  });
  return { labels, tori };
}

describe('point mutation 3D figure', () => {
  it('a substitution glows at its base pair; the mutated protein is the model’s', () => {
    const m = { kind: 'substitution' as const, pos: 12, base: 'T' };
    const a = analyzeMutation(CODING, m);
    const mt = mutatedTranslation(CODING, m);
    const { kit, track, start } = testKit();
    buildMutationScene(kit, {
      coding: CODING,
      mutated: mt.coding,
      changed: new Set([12]),
      deletedAt: -1,
      normal: a.before.codons
        .filter((c) => !c.entry?.stop)
        .map((c) => ({ name: c.entry?.three ?? '?', glow: false })),
      mutant: mt.t.codons
        .filter((c) => !c.entry?.stop)
        .map((c) => ({ name: c.entry?.three ?? '?', glow: false })),
      texts: { five: '5′', three: '3′', normal: 'N', mutant: 'M' },
    });
    const c = census(kit);
    expect(c.tori).toBe(1);
    // Nonsense: Met–Ala–Phe, then the premature stop.
    expect(c.labels.filter((l) => /^[A-Z][a-z]{2}$/.test(l)).slice(-3)).toEqual([
      'Met',
      'Ala',
      'Phe',
    ]);
    expectAllFreed(kit, track, start);
  });

  it('a long sequence is drawn up to MAX_BP base pairs', () => {
    const long = 'ATG'.repeat(40);
    const { kit, track, start } = testKit();
    buildMutationScene(kit, {
      coding: long,
      mutated: long,
      changed: new Set(),
      deletedAt: -1,
      normal: [],
      mutant: [],
      texts: { five: '5′', three: '3′', normal: 'N', mutant: 'M' },
    });
    let rungs = 0;
    kit.scene.traverse((o) => {
      if (o instanceof THREE.Mesh && o.geometry instanceof THREE.CylinderGeometry) rungs++;
    });
    // Two helices, two half rungs per base pair.
    expect(rungs).toBe(4 * MAX_BP);
    expectAllFreed(kit, track, start);
  });
});
