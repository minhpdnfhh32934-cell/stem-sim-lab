import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../content';
import { ItemDefinitionSchema } from '../../gameplay/item';
import { benchModel } from './bench/registry';

// Every Explain label anchored to a part (`{ part }`) names an object its bench model draws — in
// its frame or its rig — so the teacher's labels always have something to point at. (Points in
// the apparatus' frame, `{ at }`, need no check; apparatus that are not bench models are drawn by
// their own builders and checked by explain.spec.ts in the app.)

interface Part {
  readonly id: string;
  readonly anchor: { part?: string };
}
interface Experiment {
  readonly id: string;
  readonly requiredEquipment: readonly string[];
  readonly explain?: { parts: readonly Part[] };
}

// A physical-lab station's apparatus that is not among its experiment's equipment.
const STATION_ITEMS: Readonly<Record<string, string>> = {
  'acid-base-titration': 'tit-retort-stand',
};

describe('Explain anchors', () => {
  it('name an object of their bench model', () => {
    const items = (bundledContent.items as unknown[]).map((raw) => ItemDefinitionSchema.parse(raw));
    const missing: string[] = [];
    let checked = 0;
    for (const e of bundledContent.experiments as Experiment[]) {
      // Its apparatus may be one of several bench items (a retort stand and a titration stand).
      const drawn = items
        .filter(
          (i) => i.bench && (e.requiredEquipment.includes(i.id) || STATION_ITEMS[e.id] === i.id),
        )
        .flatMap((item) => {
          const model = item.bench && benchModel(item.bench.model);
          if (!model) return [];
          const frame = model.frame(item, new THREE.MeshStandardMaterial());
          const rig = model.rig?.(item) ?? null;
          return [{ frame, rig }];
        });
      if (drawn.length === 0) continue;
      for (const p of e.explain?.parts ?? []) {
        const name = p.anchor.part;
        if (!name) continue;
        checked++;
        const found = drawn.some(
          ({ frame, rig }) => frame.parts.getObjectByName(name) ?? rig?.group.getObjectByName(name),
        );
        if (!found) missing.push(`${e.id}: ${p.id} → ${name}`);
      }
      for (const { frame, rig } of drawn) {
        frame.dispose();
        rig?.dispose();
      }
    }
    expect(missing).toEqual([]);
    expect(checked).toBeGreaterThan(100);
  });
});
