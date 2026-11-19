import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SHADOW_TAPS_MARK, softerShadows } from './shadowTaps';

describe('softer shadow edges for Max (shadowTaps.ts)', () => {
  it('rewrites three’s five PCF taps once: twelve from a radius over 5, five below', () => {
    softerShadows();
    softerShadows(); // idempotent
    const chunk = THREE.ShaderChunk.shadowmap_pars_fragment;
    expect(chunk.split(SHADOW_TAPS_MARK)).toHaveLength(2);
    // The spot and directional lights' five-tap sum is gone (point shadows keep theirs: none here).
    expect(chunk).not.toContain('shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius');
    expect(chunk).toContain('shadow /= float( taps );');
  });
});
