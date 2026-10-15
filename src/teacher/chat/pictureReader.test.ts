import { describe, expect, it } from 'vitest';
import type { GpuStatus } from '@/ai/gpu';
import { pictureReaderFor, type PictureFacts } from './pictureReader';

const card = (kind: 'integrated' | 'discrete', vendorId: number): GpuStatus => ({
  supported: true,
  adapters: [
    {
      id: `${vendorId.toString(16)}:1:0`,
      name: kind,
      vendorId,
      deviceId: 1,
      kind,
      dedicatedMb: 4096,
      sharedMb: 8192,
    },
  ],
  choice: null,
  choiceName: null,
  startupChoice: null,
  startupApplied: false,
  restartNeeded: false,
});

const base: PictureFacts = {
  engine: 'gemma',
  gemmaModel: 'gemma4-e2b',
  webgpu: true,
  gemmaBlocked: false,
  gpuStatus: card('discrete', 0x10de),
  gemmaInfo: { vendor: 'nvidia', architecture: '' },
  localVision: null,
};

describe('who may get a picture of the circled area', () => {
  it('Gemma: only the chosen picture model on a card known not to be integrated', () => {
    expect(pictureReaderFor(base)).toBe('gemma');
    // A text model is never switched to the picture model behind the learner's back.
    expect(pictureReaderFor({ ...base, gemmaModel: 'gemma3-1b' })).toBeNull();
    expect(pictureReaderFor({ ...base, gemmaModel: 'gemma3-270m' })).toBeNull();
    // An integrated card (the AMD 780M crashed the computer), or a card nobody can tell.
    expect(
      pictureReaderFor({
        ...base,
        gpuStatus: card('integrated', 0x1002),
        gemmaInfo: { vendor: 'amd', architecture: '' },
      }),
    ).toBeNull();
    expect(pictureReaderFor({ ...base, gpuStatus: null, gemmaInfo: null })).toBeNull();
    // Gemma paused by a GPU fault, or no WebGPU.
    expect(pictureReaderFor({ ...base, gemmaBlocked: true })).toBeNull();
    expect(pictureReaderFor({ ...base, webgpu: false })).toBeNull();
    // A Gemma that is not ready (the engine is "gemma-missing") reads nothing.
    expect(pictureReaderFor({ ...base, engine: 'gemma-missing' })).toBeNull();
  });

  it('a runtime on this computer: only a model seen reading pictures ("Có")', () => {
    const local = { ...base, engine: 'local' as const };
    expect(pictureReaderFor({ ...local, localVision: 'yes' })).toBe('local');
    expect(pictureReaderFor({ ...local, localVision: 'unverified' })).toBeNull();
    expect(pictureReaderFor({ ...local, localVision: 'no' })).toBeNull();
    expect(pictureReaderFor({ ...local, localVision: null })).toBeNull();
    expect(pictureReaderFor({ ...local, engine: 'local-missing', localVision: 'yes' })).toBeNull();
  });

  it('never an online provider', () => {
    expect(pictureReaderFor({ ...base, engine: 'cloud', localVision: 'yes' })).toBeNull();
  });
});
