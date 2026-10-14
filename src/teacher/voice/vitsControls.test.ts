import { describe, expect, it } from 'vitest';
import {
  VITS_DEFAULTS,
  VITS_SAFE,
  clampProsody,
  controlFeeds,
  sessionInputNames,
  supportedControls,
} from './vitsControls';

/**
 * The on-device voice's prosody controls (vitsControls.ts): passed to the model only when its
 * graph names them, always inside the range where MMS sounds clean.
 */
describe('VITS prosody controls', () => {
  it('the MMS export in use (input_ids, attention_mask) accepts none of them', () => {
    expect(supportedControls(['input_ids', 'attention_mask'])).toEqual([]);
    expect(controlFeeds([], { speakingRate: 0.9, noiseScale: 0.6 })).toEqual({});
  });

  it('a graph that names a control gets it, clamped to its safe range', () => {
    const names = ['input_ids', 'attention_mask', 'speaking_rate', 'noise_scale'];
    const supported = supportedControls(names);
    expect(supported).toEqual(['speaking_rate', 'noise_scale']);
    expect(controlFeeds(supported, { speakingRate: 0.5, noiseScale: 2 })).toEqual({
      speaking_rate: VITS_SAFE.speakingRate[0],
      noise_scale: VITS_SAFE.noiseScale[1],
    });
    expect(controlFeeds(supported, undefined)).toEqual({});
  });

  it('a missing or broken value is the model’s own', () => {
    expect(clampProsody({ speakingRate: NaN })).toEqual(VITS_DEFAULTS);
    expect(clampProsody()).toEqual(VITS_DEFAULTS);
    expect(clampProsody({ noiseScaleDuration: 0.9 }).noiseScaleDuration).toBe(0.9);
  });

  it('reads the input names of a Transformers.js model defensively', () => {
    expect(sessionInputNames({ sessions: { model: { inputNames: ['input_ids', 7] } } })).toEqual([
      'input_ids',
    ]);
    expect(sessionInputNames({})).toEqual([]);
    expect(sessionInputNames(null)).toEqual([]);
    expect(sessionInputNames({ sessions: { model: {} } })).toEqual([]);
  });
});
