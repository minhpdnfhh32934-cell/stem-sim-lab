import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { SceneKit } from '../view3d/kit';
import { expectAllFreed, testKit } from '../view3d/testing';
import { analyzeMutation, codingToMrna, mutatedTranslation, translate } from './dogma';
import { MAX_BP, buildDogmaScene, buildMutationScene } from './scene3d';

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

describe('central dogma 3D', () => {
  it('the polypeptide so far is the translation up to the active codon', () => {
    const mrna = codingToMrna(CODING);
    const t = translate(mrna);
    for (const active of [0, 2, t.codons.length - 1]) {
      const { kit, track, start } = testKit();
      buildDogmaScene(kit, {
        coding: CODING,
        mrna,
        t,
        active,
        texts: { five: '5′', three: '3′', stop: 'STOP', ribosome: 'R' },
      });
      const shown = census(kit).labels.filter((l) => /^[A-Z][a-z]{2}$/.test(l));
      const expected = t.codons
        .slice(0, active + 1)
        .filter((c) => !c.entry?.stop)
        .map((c) => c.entry?.three ?? '?');
      expect(shown).toEqual(expected);
      expect(census(kit).labels.includes('STOP')).toBe(!!t.codons[active]?.entry?.stop);
      expectAllFreed(kit, track, start);
    }
  });

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
    buildDogmaScene(kit, {
      coding: long,
      mrna: codingToMrna(long),
      t: translate(codingToMrna(long)),
      active: 0,
      texts: { five: '5′', three: '3′', stop: 'S', ribosome: 'R' },
    });
    let rungs = 0;
    kit.scene.traverse((o) => {
      if (o instanceof THREE.Mesh && o.geometry instanceof THREE.CylinderGeometry) rungs++;
    });
    // Two half rungs per base pair of DNA, one stick per mRNA base.
    expect(rungs).toBe(3 * MAX_BP);
    expectAllFreed(kit, track, start);
  });
});
