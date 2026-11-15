import { describe, expect, it } from 'vitest';
import { FLUIDS } from '@/physics/fluid/model';
import { TOPIC_HINTS } from './prompts';

describe('topic hints', () => {
  it('name the drag lesson’s air and water densities from its own table (#268)', () => {
    // A problem that states the default density keeps "Nước"; any other value is typed in.
    expect(FLUIDS[1]?.rho).toBe(999);
    expect(TOPIC_HINTS.fluidFall).toContain('1,225 kg/m³ (không khí)');
    expect(TOPIC_HINTS.fluidFall).toContain('999 kg/m³ (nước)');
  });
});
