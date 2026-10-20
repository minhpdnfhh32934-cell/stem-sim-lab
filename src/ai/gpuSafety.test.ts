import { afterEach, describe, expect, it } from 'vitest';
import type { GpuAdapter, GpuStatus } from './gpu';
import {
  allowGemmaAgain,
  forgetGpuFault,
  gemmaBlockedByGpuFault,
  gemmaOnIntegrated,
  isGpuFailure,
  lastGpuFault,
  noteGpuFault,
} from './gpuSafety';

const amd: GpuAdapter = {
  id: '1002:15bf:0',
  name: 'AMD Radeon 780M',
  vendorId: 0x1002,
  deviceId: 0x15bf,
  kind: 'integrated',
  dedicatedMb: 512,
  sharedMb: 16000,
};
const rtx: GpuAdapter = {
  id: '10de:2d59:0',
  name: 'NVIDIA GeForce RTX 5060 Laptop GPU',
  vendorId: 0x10de,
  deviceId: 0x2d59,
  kind: 'discrete',
  dedicatedMb: 8151,
  sharedMb: 16000,
};
const status = (over: Partial<GpuStatus> = {}): GpuStatus => ({
  supported: true,
  adapters: [amd, rtx],
  choice: null,
  choiceName: null,
  startupChoice: null,
  startupApplied: false,
  restartNeeded: false,
  ...over,
});

describe('GPU safety for on-device Gemma (audit GPU-01)', () => {
  afterEach(() => {
    allowGemmaAgain();
    forgetGpuFault();
  });

  it('recognises the runtime errors seen when the card failed', () => {
    expect(isGpuFailure('gpu-lost')).toBe(true);
    expect(
      isGpuFailure(
        'failed to call OrtRun(). ERROR_MESSAGE: BufferManager::Download ... map_async_result.status == wgpu::MapAsyncStatus::Success was false. Failed to download data from buffer.',
      ),
    ).toBe(true);
    expect(isGpuFailure('model-missing')).toBe(false);
    expect(isGpuFailure('empty reply')).toBe(false);
  });

  it('turns Gemma off after one fault and remembers it across restarts', () => {
    expect(gemmaBlockedByGpuFault()).toBe(false);
    noteGpuFault('device-lost', { vendor: 'amd', architecture: 'rdna-3' });
    expect(gemmaBlockedByGpuFault()).toBe(true);
    expect(lastGpuFault()).toMatchObject({ reason: 'device-lost', adapter: 'amd rdna-3' });
    allowGemmaAgain();
    expect(gemmaBlockedByGpuFault()).toBe(false);
    // The record stays for Settings until the learner dismisses it.
    expect(lastGpuFault()).not.toBeNull();
  });

  it('knows when Gemma runs on the integrated card', () => {
    // The worker reported an AMD adapter, and the only AMD card is integrated.
    expect(gemmaOnIntegrated(status(), { vendor: 'amd', architecture: 'rdna-3' })).toBe(true);
    expect(gemmaOnIntegrated(status(), { vendor: 'nvidia', architecture: 'blackwell' })).toBe(
      false,
    );
    // Nothing reported yet: the card chosen at start-up decides…
    expect(gemmaOnIntegrated(status({ startupChoice: rtx.id, startupApplied: true }), null)).toBe(
      false,
    );
    // …and without a choice WebView2 uses the integrated card of a hybrid laptop.
    expect(gemmaOnIntegrated(status(), null)).toBe(true);
    expect(gemmaOnIntegrated(status({ adapters: [rtx] }), null)).toBe(false);
    expect(gemmaOnIntegrated(null, null)).toBeNull();
  });
});
