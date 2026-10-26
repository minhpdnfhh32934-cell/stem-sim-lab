import { describe, expect, it } from 'vitest';
import { loadScene } from '@/physics/registry';
import { buildDraft } from './draft';
import { allowedUnits, type Extraction } from './spec';

const only = (key: string, value: number, unit: string, quote: string): Extraction => ({
  quantities: [{ key, value, unit, quote }],
  questions: [],
  assumptions: [],
  unsupported_parts: [],
  clarifications: [],
});

describe('allowedUnits: angular and cycle frequencies never mix (#37 §8.2 trap 1)', () => {
  it('simple pendulum: ω₀ takes only rad/s, the damping c keeps Hz', async () => {
    const s = await loadScene('simplePendulum');
    expect(allowedUnits(s, 'omega0')).toEqual(['rad/s']);
    expect(allowedUnits(s, 'c')).toContain('Hz');
    expect(allowedUnits(s, 'c')).not.toContain('rad/s');
  });

  it('rejects a frequency in Hz written into ω₀ instead of reading it as rad/s', async () => {
    const s = await loadScene('simplePendulum');
    const text = 'Con lắc đơn dài 1 m được truyền tần số 2 Hz.';
    const d = buildDraft(s, only('omega0', 2, 'Hz', 'tần số 2 Hz'), text, 9.81);
    expect(d.issues.some((x) => x.kind === 'badUnit' && x.key === 'omega0' && x.blocking)).toBe(
      true,
    );
    expect(d.sources.omega0).toBe('default');
  });

  it('the pendulum damping c in Hz is still accepted', async () => {
    const s = await loadScene('simplePendulum');
    const text = 'Con lắc đơn dài 1 m, hệ số cản 0,5 Hz.';
    const d = buildDraft(s, only('c', 0.5, 'Hz', 'hệ số cản 0,5 Hz'), text, 9.81);
    expect(d.issues.filter((x) => x.blocking)).toEqual([]);
    expect(d.params.c).toBe(0.5);
  });
});
