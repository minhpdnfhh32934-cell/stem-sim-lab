import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../content';
import { ItemDefinitionSchema } from '../../gameplay/item';
import { revealEase, revealStep, revealWanted } from './reveal';

describe('a display shown near the player (reveal.ts)', () => {
  it('shows within its radius, hides past it plus 0.4 m, and keeps what it was in between', () => {
    expect(revealWanted(2.9, 3, false)).toBe(true);
    expect(revealWanted(3, 3, false)).toBe(true);
    expect(revealWanted(3.2, 3, true)).toBe(true); // walking away: still shown at the edge
    expect(revealWanted(3.2, 3, false)).toBe(false); // walking in: not yet
    expect(revealWanted(3.41, 3, true)).toBe(false);
  });

  it('comes out and goes away in 0.6 s, eased at both ends', () => {
    let t = 0;
    for (let i = 0; i < 18; i++) t = revealStep(t, true, 1 / 60);
    expect(t).toBeCloseTo(0.5, 9);
    for (let i = 0; i < 60; i++) t = revealStep(t, true, 1 / 60);
    expect(t).toBe(1);
    for (let i = 0; i < 36; i++) t = revealStep(t, false, 1 / 60);
    expect(t).toBeCloseTo(0, 9);
    expect(revealStep(0, false, 1)).toBe(0);
    expect([revealEase(0), revealEase(0.5), revealEase(1)]).toEqual([0, 0.5, 1]);
    expect(revealEase(0.1)).toBeLessThan(0.1); // slow out of its slot
  });

  it('is in the shipped content where Phú asked: every results monitor rises, the wing’s panels overhead', () => {
    const items = (bundledContent.items as unknown[]).map((raw) => ItemDefinitionSchema.parse(raw));
    const monitor = items.find((i) => i.id === 'results-monitor');
    expect(monitor?.visual.reveal).toEqual({ kind: 'rise', radius: 3 });
    const panels = items.filter((i) => i.visual.reveal?.kind === 'overhead');
    expect(panels).toHaveLength(71); // + the boards of T-2 (4), T-3 (7), T-4 (7), T-5, T-6, T-6b (4) the ripple tank and the electric field, the air track and the Atwood machine; Phase X: the practice rooms' (one each) and the AC generator's
    // A panel is shown before it is in reach: its radius past the player's reach (2.2 m).
    for (const panel of panels) expect(panel.visual.reveal!.radius).toBeGreaterThan(2.2);
  });
});
