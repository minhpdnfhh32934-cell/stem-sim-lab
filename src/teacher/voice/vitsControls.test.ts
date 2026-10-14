import { describe, expect, it } from 'vitest';
import {
  VITS_DEFAULTS,
  VITS_SAFE,
  clampProsody,
  controlFeeds,
  retryWithoutControls,
  runWithControls,
  sessionInputNames,
  supportedControls,
} from './vitsControls';
import { isGpuFailure } from '@/ai/gpuSafety';

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

describe('running again without the controls', () => {
  it('only when the graph refused a value, never after a graphics-card failure', () => {
    const retry = (message: string) => retryWithoutControls(new Error(message), isGpuFailure);
    expect(retry('Invalid rank for input: noise_scale Got: 1 Expected: 0')).toBe(true);
    expect(
      retry('Unexpected input data type. Actual: (tensor(float)), expected: (tensor(double))'),
    ).toBe(true);
    expect(retry('Got invalid dimensions for input: speaking_rate')).toBe(true);
    expect(retry('WebGPU device was lost while reading the input buffer')).toBe(false);
    expect(retry('mapAsync failed for the input tensor')).toBe(false);
    expect(retry('DXGI_ERROR_DEVICE_REMOVED')).toBe(false);
    expect(retry('failed to allocate a buffer of size 4096')).toBe(false);
  });

  it('a lost card fails the phrase at once: the model is not run a second time', async () => {
    const fed: string[][] = [];
    const run = (feeds: Record<string, unknown>) => {
      fed.push(Object.keys(feeds));
      return Promise.reject(new Error('Device lost while reading input ids'));
    };
    await expect(
      runWithControls(run, { input_ids: 1 }, { noise_scale: 0.6 }, isGpuFailure),
    ).rejects.toThrow('Device lost');
    expect(fed).toEqual([['input_ids', 'noise_scale']]);
  });

  it('a refused control: once more without it, and the caller is told', async () => {
    const run = (feeds: Record<string, unknown>) =>
      'noise_scale' in feeds
        ? Promise.reject(new Error('Invalid rank for input: noise_scale'))
        : Promise.resolve('audio');
    await expect(
      runWithControls(run, { input_ids: 1 }, { noise_scale: 0.6 }, isGpuFailure),
    ).resolves.toEqual({ output: 'audio', withControls: false });
    await expect(runWithControls(run, { input_ids: 1 }, {}, isGpuFailure)).resolves.toEqual({
      output: 'audio',
      withControls: false,
    });
  });
});
