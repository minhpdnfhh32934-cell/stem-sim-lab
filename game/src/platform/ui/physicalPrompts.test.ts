import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import strings from '../../content/strings.json';
import { createTexts, ENGLISH } from '../../core/i18n';
import type { WorldEntity } from '../../world/World';
import { containerOf } from '../../simulation/liquid';
import { DebugPanel } from './DebugPanel';
import { Hud } from './Hud';

// The physical lab's prompts and its debug line, against a minimal DOM stand-in (tests run in
// node): what the held glassware offers, when the player is told to hold it over a vessel, and
// that the containers line holds volumes and material ids only.

class FakeEl {
  className = '';
  textContent = '';
  readonly children: FakeEl[] = [];
  constructor(readonly tag: string) {}
  append(...nodes: FakeEl[]) {
    this.children.push(...nodes);
  }
  get text(): string {
    return [this.textContent, ...this.children.map((c) => c.text)].join('');
  }
}

beforeAll(() => {
  vi.stubGlobal('document', { createElement: (tag: string) => new FakeEl(tag) });
});
afterAll(() => {
  vi.unstubAllGlobals();
});

type Call = (this: unknown, ...args: unknown[]) => unknown;
const hud = Hud.prototype as unknown as Record<string, Call>;
const debug = DebugPanel.prototype as unknown as Record<string, Call>;

const tipping = { spout: [0, 0, 0], trigger: 'tilt', minTiltDeg: 70, fullTiltDeg: 115 };
const bindings = { pour: ['KeyR', 'Mouse2'], inspect: ['KeyC', 'Mouse1'] };

function held(container: unknown, rotation: [number, number, number, number] = [0, 0, 0, 1]) {
  return {
    id: 'lab/flask',
    item: { container, physical: { handling: 'upright' } },
    pose: { position: [0, 0, 0], rotation },
  } as unknown as WorldEntity;
}
function game(state: ReturnType<typeof containerOf> | null, held_?: WorldEntity, pouring = false) {
  return {
    config: { input: { bindings } },
    texts: ENGLISH,
    stations: { container: () => state },
    liquids: { pouringOver: pouring ? 'lab/beaker' : null },
    interaction: { heldEntity: held_ ?? null },
    input: { isHeld: (action: string) => action === 'pour' },
  };
}
const keys = (g: ReturnType<typeof game>, e: WorldEntity) =>
  (hud.glasswareKeys!.call({ game: g }, e) as FakeEl[]).map((n) => n.text.trim());

describe('the held glassware prompt', () => {
  it('offers pour for a vessel that tips, with the keys from the bindings, and always a close look', () => {
    const e = held({ pour: tipping });
    expect(keys(game(containerOf('water', 1000)), e)).toEqual([
      'R',
      'Pour (hold)',
      'C',
      'Look closely (hold)',
    ]);
  });

  it('offers squeeze for a wash bottle, turning over for a stoppered vessel, nothing to pour for a stock', () => {
    const squeeze = held({ pour: { ...tipping, trigger: 'squeeze' } });
    expect(keys(game(containerOf('water', 1000)), squeeze)[1]).toBe('Squeeze (hold)');
    const stoppered = held({ pour: tipping, closable: true });
    const closed = { ...containerOf('water', 1000), closed: true };
    expect(keys(game(closed), stoppered)[1]).toBe('Turn over to mix (hold)');
    const stock = held({ closable: true });
    expect(keys(game(containerOf('water', 1000)), stock)).toEqual(['C', 'Look closely (hold)']);
    // not a container: nothing
    const ball = held(undefined);
    expect(hud.glasswareKeys!.call({ game: game(null) }, ball)).toEqual([]);
  });

  it('has Vietnamese for each of its texts', () => {
    const vi = createTexts(strings, () => 'vi');
    for (const [key, english] of [
      ['hud.setDown', 'Set down'],
      ['hud.pour', 'Pour (hold)'],
      ['hud.squeeze', 'Squeeze (hold)'],
      ['hud.turnOver', 'Turn over to mix (hold)'],
      ['hud.inspect', 'Look closely (hold)'],
      ['hud.pourOver', 'Hold it over a vessel to pour.'],
    ] as const) {
      expect(vi.ui(key, english)).not.toBe(english);
    }
  });
});

describe('the hold-it-over-a-vessel hint', () => {
  const upright: [number, number, number, number] = [0, 0, 0, 1];
  const tipped: [number, number, number, number] = [
    Math.sin((100 * Math.PI) / 360),
    0,
    0,
    Math.cos((100 * Math.PI) / 360),
  ]; // 100° about x
  const needs = (g: ReturnType<typeof game>) => hud.needsVessel!.call({ game: g }) as boolean;

  it('says so once the vessel is tipped past its pour angle with liquid in it and nothing flows', () => {
    const full = containerOf('water', 1000);
    expect(needs(game(full, held({ pour: tipping }, tipped)))).toBe(true);
    expect(needs(game(full, held({ pour: tipping }, upright)))).toBe(false); // not tipped yet
    expect(needs(game(full, held({ pour: tipping }, tipped), true))).toBe(false); // over a vessel, flowing or refused
    expect(needs(game(containerOf(null, 0), held({ pour: tipping }, tipped)))).toBe(false); // empty
    const closed = { ...full, closed: true };
    expect(needs(game(closed, held({ pour: tipping }, tipped)))).toBe(false);
    expect(needs(game(full, held({ pour: { ...tipping, trigger: 'squeeze' } }, upright)))).toBe(
      true,
    );
    expect(needs(game(full, undefined))).toBe(false);
  });
});

describe('the debug panel’s containers lines', () => {
  const lines = (containers: Record<string, unknown>, heldId?: string) =>
    debug.containerLines!.call({
      game: {
        state: { world: { containers } },
        interaction: { heldId, focused: null },
        stations: { activeStation: () => null },
        world: { entity: () => undefined },
      },
    }) as string[];

  it('prints volumes in µL by material id, the held one first, and no concentration', () => {
    const out = lines(
      {
        'lab/bottle': containerOf('hcl', 25_000),
        'lab/flask': { ...containerOf('stock-20', 5000), closed: true },
        'lab/empty': containerOf(null, 0),
      },
      'lab/flask',
    );
    expect(out[0]).toBe('Containers:');
    expect(out[1]).toBe('  lab/flask  5000 µL (stock-20 5000)  closed');
    expect(out).toContain('  lab/bottle  25000 µL (hcl 25000)');
    expect(out).toContain('  lab/empty  0 µL');
    expect(out.join('\n')).not.toMatch(/mol|0[.,]085/);
  });

  it('prints nothing without containers, and at most six with a count of the rest', () => {
    expect(lines({})).toEqual([]);
    const many = Object.fromEntries(
      Array.from({ length: 9 }, (_, i) => [`lab/c${i}`, containerOf('water', 1000)]),
    );
    const out = lines(many);
    expect(out).toHaveLength(1 + 6 + 1);
    expect(out[out.length - 1]).toBe('  … 3 more');
  });
});
