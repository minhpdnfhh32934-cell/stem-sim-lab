import { describe, expect, it } from 'vitest';
import { bundledContent } from '../content';
import { ItemDefinitionSchema } from '../gameplay/item';
import { DECOR } from '../gameplay/props';

/** Every item and room, the lab pack's included. */
const itemsJson = bundledContent.items as unknown[];

// Decorative and interactive objects are told apart in the data: decor does nothing and offers
// nothing (never focused, no prompt); what can be inspected says honestly what it is.

const items = itemsJson.map((raw) => ItemDefinitionSchema.parse(raw));
const decor = items.filter((i) => i.tags.includes(DECOR));

describe('decorative items', () => {
  it('are shipped', () => {
    expect(decor.length).toBeGreaterThan(0);
  });

  it.each(decor.map((i) => [i.id, i] as const))('%s does nothing and offers nothing', (_, i) => {
    expect(i.interactions).toEqual([]);
    expect(i.physical.body).not.toBe('dynamic');
    expect(i.inventory).toBeUndefined();
    const { screen, stream, openBox, model } = i.visual;
    expect({ screen, stream, openBox, model }).toEqual({});
    expect([i.launcher, i.pendulum, i.dropTower, i.springStand]).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    expect(i.description).toBe(''); // nothing to read: it is never inspected
  });

  it('include every furniture or architecture prop without interactions', () => {
    // A sliding door's leaf (Phase U) moves: it is an entity, not batched decor.
    const untagged = items.filter(
      (i) => i.visual.prop && i.interactions.length === 0 && !i.tags.includes(DECOR) && !i.slider,
    );
    expect(untagged.map((i) => i.id)).toEqual([]);
  });
});

describe('inspectable items', () => {
  it('describe themselves in English and in Vietnamese', () => {
    const silent = items
      .filter((i) => i.interactions.includes('inspect'))
      .filter((i) => i.description.trim() === '' || !i.vi?.description?.trim())
      .map((i) => i.id);
    expect(silent).toEqual([]);
  });
});
