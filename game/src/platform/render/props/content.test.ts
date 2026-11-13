import { describe, expect, it } from 'vitest';
import coreItems from '../../../content/core-items.json';
import labItems from '../../../content/items.json';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import type { Prop } from '../../../gameplay/props';
import { PROP_BUILDERS } from './index';
import { expectProp } from './testing';

/** Every shipped item: the core's and the lab pack's. */
const items = [...coreItems, ...labItems];

// The shipped content against the prop builders: every `visual.prop` an item uses is drawn by a
// builder whose parts fit that item's box at its size (the box is the collider and the aim box).

/**
 * Props whose builders land with WX-P step 2 (props/labs.ts, props/rooms.ts), drawn as their
 * item's primitive until then. Once a builder exists, the fit below checks it like any other.
 */
const PENDING: readonly Prop[] = [
  'lab-island',
  'stool',
  'wall-bench',
  'wall-bench-sink',
  'tap',
  'cabinet-doors',
  'glassware-shelf',
  'safety-shower',
  'extinguisher',
  'microscope',
  'specimen-cabinet',
  'refrigerator',
  'plant-shelf',
  'fume-hood',
  'bookshelf',
  'whiteboard',
];

const WITH_PROP = items.map((raw) => ItemDefinitionSchema.parse(raw)).filter((i) => i.visual.prop);

describe('props of the shipped items', () => {
  it('are used by the content', () => {
    expect(WITH_PROP.length).toBeGreaterThan(0);
  });

  describe.each(WITH_PROP.map((item) => [item.id, item] as const))('%s', (_, item) => {
    const prop = item.visual.prop!;
    const builder = PROP_BUILDERS[prop];

    it('has a builder, or one that is pending', () => {
      expect(builder !== undefined || PENDING.includes(prop), prop).toBe(true);
    });

    it.runIf(builder !== undefined)('fits its box at its size', () => {
      expectProp(builder!(item.visual.size), item.visual.shape, item.visual.size);
    });
  });
});

describe('hinged items (UX3.1)', () => {
  // The prop draws the leaves its item's `hinged` data swings (the hinge system) and makes solid
  // (physics): the same hinges, turning the same way, or what is drawn and what blocks part.
  const hinged = items
    .map((raw) => ItemDefinitionSchema.parse(raw))
    .filter((item) => item.hinged && item.visual.prop);

  it('are the PPE cabinet, the washroom door and the reagent cabinet', () => {
    expect(hinged.map((item) => item.id)).toEqual([
      'wardrobe',
      'teacher-cabinet',
      'wc-door',
      'chem-reagent-cabinet',
      'circuit-cabinet',
    ]);
  });

  it.each(hinged.map((item) => [item.id, item] as const))(
    '%s: its prop hinges its leaves where its data does',
    (_id, item) => {
      const parts = PROP_BUILDERS[item.visual.prop!]!(item.visual.size);
      const drawn = [...new Set(parts.map((p) => p.hinge).filter((h) => h !== undefined))].map(
        (h) => [+h.x.toFixed(9), +h.z.toFixed(9), h.opens],
      );
      const data = item.hinged!.leaves.map((l) => [l.hinge[0], l.hinge[1], l.opens]);
      expect(drawn).toEqual(data);
    },
  );
});
