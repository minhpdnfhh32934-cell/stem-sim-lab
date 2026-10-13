import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GpuStatus } from '@/ai/gpu';

/**
 * Audit G5: the on-device voice (MMS) must never put long WebGPU work on an integrated card or on
 * a card that already failed (the 0x119 crash, audit GPU-01), and a hung worker must never hold
 * `speak()` or the lesson. Nothing here runs a model: the worker is a fake.
 */
const env = vi.hoisted(() => ({ webgpu: true }));
vi.mock('@/ai/webGemma', () => ({
  webGPUStatus: () => (env.webgpu ? 'webgpu' : 'none'),
  ortPaths: () => ({ wasm: '/ort/a.wasm', mjs: '/ort/a.mjs' }),
}));
vi.mock('@/ai/modelStore', () => ({
  opfsAvailable: () => false,
  repoStored: () => Promise.resolve(true),
  deleteRepo: () => Promise.resolve(),
}));

type Reply = 'audio' | 'silent' | 'hang' | 'loaded';

class FakeWorker {
  static all: FakeWorker[] = [];
  static onSpeak: Reply = 'audio';
  posted: { kind: string; id?: number; device?: string }[] = [];
  terminated = false;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  constructor() {
    FakeWorker.all.push(this);
  }
  postMessage(msg: { kind: string; id?: number; device?: string }) {
    this.posted.push(msg);
    if (msg.kind === 'load') {
      queueMicrotask(() => {
        this.reply({ kind: 'loaded' });
      });
    }
    if (msg.kind === 'speak' && FakeWorker.onSpeak !== 'hang') {
      const samples =
        FakeWorker.onSpeak === 'silent' ? new Float32Array(1600) : Float32Array.from([0.2, -0.3]);
      queueMicrotask(() => {
        this.reply({ kind: 'audio', id: msg.id, samples, sampleRate: 16000 });
      });
    }
  }
  terminate() {
    this.terminated = true;
  }
  reply(data: unknown) {
    if (!this.terminated) this.onmessage?.({ data } as MessageEvent);
  }
  crash() {
    this.onerror?.({ preventDefault: () => undefined } as ErrorEvent);
  }
}

const AMD_ONLY: GpuStatus = {
  supported: true,
  adapters: [
    {
      id: '1002:15bf:0',
      name: 'AMD Radeon 780M',
      vendorId: 0x1002,
      deviceId: 0x15bf,
      kind: 'integrated',
      dedicatedMb: 512,
      sharedMb: 16000,
    },
  ],
  choice: null,
  choiceName: null,
  startupChoice: null,
  startupApplied: false,
  restartNeeded: false,
};
const RTX_ONLY: GpuStatus = {
  ...AMD_ONLY,
  adapters: [
    {
      id: '10de:2d59:0',
      name: 'NVIDIA GeForce RTX 5060 Laptop GPU',
      vendorId: 0x10de,
      deviceId: 0x2d59,
      kind: 'discrete',
      dedicatedMb: 8151,
      sharedMb: 16000,
    },
  ],
};

let voice: typeof import('./localVoice');
let gpu: typeof import('@/ai/gpu');
let safety: typeof import('@/ai/gpuSafety');

const loads = () =>
  FakeWorker.all.flatMap((w) => w.posted.filter((m) => m.kind === 'load').map((m) => m.device));

describe('on-device voice: where it runs', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('Worker', FakeWorker);
    FakeWorker.all = [];
    FakeWorker.onSpeak = 'audio';
    env.webgpu = true;
    localStorage.setItem('stemsim.voice-model', 'Xenova/mms-tts-vie');
    voice = await import('./localVoice');
    gpu = await import('@/ai/gpu');
    safety = await import('@/ai/gpuSafety');
    gpu.useGpuStore.setState({ status: null, gemmaInfo: null });
  });
  afterEach(() => {
    voice.unloadLocalVoice();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('uses the graphics card when it is a discrete one', async () => {
    gpu.useGpuStore.setState({ status: RTX_ONLY });
    await voice.synthesizeLocal('xin chào', new AbortController().signal);
    expect(loads()).toEqual(['webgpu']);
  });

  it('runs on the CPU when only an integrated card is known', async () => {
    gpu.useGpuStore.setState({ status: AMD_ONLY });
    await voice.synthesizeLocal('xin chào', new AbortController().signal);
    expect(loads()).toEqual(['wasm']);
  });

  it('runs on the CPU after a recorded GPU fault, and without WebGPU', async () => {
    gpu.useGpuStore.setState({ status: RTX_ONLY });
    safety.noteGpuFault('device-lost', null);
    await voice.synthesizeLocal('xin chào', new AbortController().signal);
    expect(loads()).toEqual(['wasm']);
    safety.allowGemmaAgain();
    safety.forgetGpuFault();
    voice.unloadLocalVoice();
    env.webgpu = false;
    await voice.synthesizeLocal('xin chào', new AbortController().signal);
    expect(loads()).toEqual(['wasm', 'wasm']);
  });

  it('can be forced onto the CPU (tests, the listening-pack tool)', async () => {
    gpu.useGpuStore.setState({ status: RTX_ONLY });
    voice.setLocalVoiceDevicePreference('wasm');
    expect(voice.localVoiceDevicePreference()).toBe('wasm');
    expect(await voice.localVoiceDevice()).toBe('wasm');
    await voice.synthesizeLocal('xin chào', new AbortController().signal);
    expect(loads()).toEqual(['wasm']);
    voice.setLocalVoiceDevicePreference('auto');
    expect(await voice.localVoiceDevice()).toBe('webgpu');
  });

  it('moves to the CPU after its own GPU worker crashed', async () => {
    gpu.useGpuStore.setState({ status: RTX_ONLY });
    await voice.synthesizeLocal('một', new AbortController().signal);
    FakeWorker.all[0]?.crash();
    await voice.synthesizeLocal('hai', new AbortController().signal);
    expect(loads()).toEqual(['webgpu', 'wasm']);
  });

  it('a GPU fault elsewhere (Gemma) reloads the voice on the CPU', async () => {
    gpu.useGpuStore.setState({ status: RTX_ONLY });
    await voice.synthesizeLocal('một', new AbortController().signal);
    safety.noteGpuFault('worker-crashed', null);
    await voice.synthesizeLocal('hai', new AbortController().signal);
    expect(loads()).toEqual(['webgpu', 'wasm']);
    expect(FakeWorker.all[0]?.terminated).toBe(true);
  });
});

describe('on-device voice: a phrase never hangs', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('Worker', FakeWorker);
    FakeWorker.all = [];
    FakeWorker.onSpeak = 'audio';
    env.webgpu = false;
    localStorage.setItem('stemsim.voice-model', 'Xenova/mms-tts-vie');
    voice = await import('./localVoice');
  });
  afterEach(() => {
    voice.unloadLocalVoice();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('gives up on a hung worker after a timeout and restarts it', async () => {
    vi.useFakeTimers();
    FakeWorker.onSpeak = 'hang';
    const text = 'một câu khá dài để máy đọc';
    const result = voice.synthesizeLocal(text, new AbortController().signal);
    const failed = expect(result).rejects.toThrow('voice-model-timeout');
    await vi.advanceTimersByTimeAsync(voice.speakTimeoutMs(text) + 10);
    await failed;
    expect(FakeWorker.all[0]?.terminated).toBe(true);
  });

  it('stops waiting at once when the learner stops, even after the model loaded', async () => {
    await voice.synthesizeLocal('một', new AbortController().signal);
    FakeWorker.onSpeak = 'hang';
    const ctrl = new AbortController();
    const result = voice.synthesizeLocal('hai', ctrl.signal);
    await Promise.resolve();
    ctrl.abort();
    await expect(result).rejects.toThrow('cancelled');
  });

  it('keeps the loaded model when an earlier phrase is stopped afterwards', async () => {
    const first = new AbortController();
    await voice.synthesizeLocal('một', first.signal);
    first.abort();
    await voice.synthesizeLocal('hai', new AbortController().signal);
    expect(FakeWorker.all).toHaveLength(1);
    expect(FakeWorker.all[0]?.terminated).toBe(false);
    expect(loads()).toHaveLength(1);
  });

  it('treats silent output as a failure, not as speech', async () => {
    FakeWorker.onSpeak = 'silent';
    await expect(voice.synthesizeLocal('xin chào', new AbortController().signal)).rejects.toThrow(
      'voice-model-silent',
    );
    // Nothing to say is not a failure.
    expect((await voice.synthesizeLocal('…', new AbortController().signal)).samples).toHaveLength(
      0,
    );
  });
});
