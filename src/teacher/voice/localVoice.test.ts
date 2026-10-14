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

type Reply = 'audio' | 'silent' | 'nan' | 'hang';
/** How a load ends: loaded, never answered, the worker crashing, or this error message. */
type LoadReply = 'loaded' | 'hang' | 'crash' | { error: string };

/**
 * Behaves like localVoiceWorker.ts: one job at a time, "started" when a phrase begins, a
 * cancelled phrase dropped if it has not started. A phrase takes `msPerChar` per character of
 * (fake) time, or no time at all.
 */
class FakeWorker {
  static all: FakeWorker[] = [];
  static onSpeak: Reply = 'audio';
  static onLoad: LoadReply = 'loaded';
  static msPerChar = 0;
  posted: { kind: string; id?: number; device?: string; text?: string }[] = [];
  terminated = false;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  private queue: { id: number; text: string }[] = [];
  private busy = false;
  private cancelled = new Set<number>();
  constructor() {
    FakeWorker.all.push(this);
  }
  postMessage(msg: { kind: string; id?: number; device?: string; text?: string }) {
    this.posted.push(msg);
    if (msg.kind === 'load') {
      const reply = FakeWorker.onLoad;
      queueMicrotask(() => {
        if (reply === 'loaded') this.reply({ kind: 'loaded' });
        else if (reply === 'crash') this.crash();
        else if (reply !== 'hang') this.reply({ kind: 'error', id: -1, message: reply.error });
      });
    }
    if (msg.kind === 'cancel' && msg.id !== undefined) this.cancelled.add(msg.id);
    if (msg.kind === 'speak' && msg.id !== undefined) {
      this.queue.push({ id: msg.id, text: msg.text ?? '' });
      queueMicrotask(() => {
        this.pump();
      });
    }
  }
  private pump() {
    if (this.busy || this.terminated) return;
    const job = this.queue.shift();
    if (!job) return;
    if (this.cancelled.delete(job.id)) {
      this.reply({ kind: 'error', id: job.id, message: 'cancelled' });
      this.pump();
      return;
    }
    this.busy = true;
    this.reply({ kind: 'started', id: job.id });
    if (FakeWorker.onSpeak === 'hang') return;
    const samples =
      FakeWorker.onSpeak === 'silent'
        ? new Float32Array(1600)
        : FakeWorker.onSpeak === 'nan'
          ? Float32Array.from([NaN, NaN])
          : Float32Array.from([0.2, -0.3]);
    const finish = () => {
      this.busy = false;
      this.reply({ kind: 'audio', id: job.id, samples, sampleRate: 16000 });
      this.pump();
    };
    if (FakeWorker.msPerChar > 0) setTimeout(finish, job.text.length * FakeWorker.msPerChar);
    else queueMicrotask(finish);
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
    FakeWorker.onLoad = 'loaded';
    FakeWorker.msPerChar = 0;
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
    FakeWorker.onLoad = 'loaded';
    FakeWorker.msPerChar = 0;
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

describe('on-device voice: a failing graphics card (second review)', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('Worker', FakeWorker);
    FakeWorker.all = [];
    FakeWorker.onSpeak = 'audio';
    FakeWorker.onLoad = 'loaded';
    FakeWorker.msPerChar = 0;
    env.webgpu = true;
    localStorage.setItem('stemsim.voice-model', 'Xenova/mms-tts-vie');
    voice = await import('./localVoice');
    gpu = await import('@/ai/gpu');
    safety = await import('@/ai/gpuSafety');
    gpu.useGpuStore.setState({ status: RTX_ONLY, gemmaInfo: null });
  });
  afterEach(() => {
    voice.unloadLocalVoice();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('uses the graphics card only when a discrete card is confirmed', async () => {
    // A browser or a failed adapter list: the kind of card is unknown.
    gpu.useGpuStore.setState({ status: null });
    expect(await voice.localVoiceDevice()).toBe('wasm');
    gpu.useGpuStore.setState({
      status: { ...RTX_ONLY, adapters: RTX_ONLY.adapters.map((a) => ({ ...a, kind: 'unknown' })) },
    });
    expect(await voice.localVoiceDevice()).toBe('wasm');
    await voice.synthesizeLocal('xin chào', new AbortController().signal);
    expect(loads()).toEqual(['wasm']);
    gpu.useGpuStore.setState({ status: RTX_ONLY });
    expect(await voice.localVoiceDevice()).toBe('webgpu');
  });

  it.each([
    [
      'the device is lost while the model loads',
      { error: 'Error: GPU device was lost' },
      'device-lost',
    ],
    ['the worker crashes while the model loads', 'crash', 'worker-crashed'],
  ] as const)(
    '%s: recorded like a Gemma fault, never reloaded on the card',
    async (_name, reply, reason) => {
      FakeWorker.onLoad = reply;
      await expect(voice.synthesizeLocal('một', new AbortController().signal)).rejects.toThrow(
        /^voice-model-load-failed/,
      );
      expect(safety.gemmaBlockedByGpuFault()).toBe(true);
      expect(safety.lastGpuFault()?.reason).toBe(reason);
      FakeWorker.onLoad = 'loaded';
      await voice.synthesizeLocal('hai', new AbortController().signal);
      expect(loads()).toEqual(['webgpu', 'wasm']);
    },
  );

  it('a load that never finishes gives up, and on the card counts as a card failure', async () => {
    vi.useFakeTimers();
    FakeWorker.onLoad = 'hang';
    const result = voice.synthesizeLocal('một', new AbortController().signal);
    const failed = expect(result).rejects.toThrow('voice-model-load-timeout');
    await vi.advanceTimersByTimeAsync(voice.LOAD_STALL_MS + 10);
    await failed;
    expect(FakeWorker.all[0]?.terminated).toBe(true);
    expect(safety.lastGpuFault()?.reason).toBe('runtime-gpu-error');
    FakeWorker.onLoad = 'loaded';
    await voice.synthesizeLocal('hai', new AbortController().signal);
    expect(loads()).toEqual(['webgpu', 'wasm']);
  });

  it('a phrase that hangs on the card is a card failure: unloaded, then the CPU', async () => {
    vi.useFakeTimers();
    await voice.synthesizeLocal('một', new AbortController().signal);
    FakeWorker.onSpeak = 'hang';
    const result = voice.synthesizeLocal('hai', new AbortController().signal);
    const failed = expect(result).rejects.toThrow('voice-model-timeout');
    await vi.advanceTimersByTimeAsync(voice.speakTimeoutMs('hai') + 10);
    await failed;
    expect(FakeWorker.all[0]?.terminated).toBe(true);
    expect(safety.gemmaBlockedByGpuFault()).toBe(true);
    FakeWorker.onSpeak = 'audio';
    await voice.synthesizeLocal('ba', new AbortController().signal);
    expect(loads()).toEqual(['webgpu', 'wasm']);
  });

  it('NaN audio from the card is a card failure; the phrase is not played', async () => {
    FakeWorker.onSpeak = 'nan';
    await expect(voice.synthesizeLocal('một', new AbortController().signal)).rejects.toThrow(
      'voice-model-silent',
    );
    expect(FakeWorker.all[0]?.terminated).toBe(true);
    expect(safety.lastGpuFault()?.reason).toBe('runtime-gpu-error');
    FakeWorker.onSpeak = 'audio';
    await voice.synthesizeLocal('hai', new AbortController().signal);
    expect(loads()).toEqual(['webgpu', 'wasm']);
  });

  it('on the CPU, a timeout or NaN audio is not taken for a card failure', async () => {
    vi.useFakeTimers();
    gpu.useGpuStore.setState({ status: AMD_ONLY });
    FakeWorker.onSpeak = 'nan';
    await expect(voice.synthesizeLocal('một', new AbortController().signal)).rejects.toThrow(
      'voice-model-silent',
    );
    FakeWorker.onSpeak = 'hang';
    const result = voice.synthesizeLocal('hai', new AbortController().signal);
    const failed = expect(result).rejects.toThrow('voice-model-timeout');
    await vi.advanceTimersByTimeAsync(voice.speakTimeoutMs('hai') + 10);
    await failed;
    expect(safety.lastGpuFault()).toBeNull();
    expect(safety.gemmaBlockedByGpuFault()).toBe(false);
  });
});

describe('on-device voice: time budgets (second review)', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('Worker', FakeWorker);
    vi.useFakeTimers();
    FakeWorker.all = [];
    FakeWorker.onSpeak = 'audio';
    FakeWorker.onLoad = 'loaded';
    FakeWorker.msPerChar = 0;
    env.webgpu = false;
    localStorage.setItem('stemsim.voice-model', 'Xenova/mms-tts-vie');
    voice = await import('./localVoice');
  });
  afterEach(() => {
    voice.unloadLocalVoice();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  /** Records how a phrase ends (fake time moves on by hand). */
  function track(result: Promise<unknown>): { value: unknown } {
    const box: { value: unknown } = { value: null };
    result.then(
      (pcm) => (box.value = pcm),
      (e: unknown) => (box.value = e),
    );
    return box;
  }

  it('a phrase waiting behind a stopped one gets its full time once it starts', async () => {
    // Pause, then "Tiếp tục": the look-ahead phrase that was stopped still runs in the worker
    // (25 s); the short phrase read again waits behind it and must not time out meanwhile.
    FakeWorker.msPerChar = 125;
    const ahead = new AbortController();
    const long = voice.synthesizeLocal('a'.repeat(200), ahead.signal);
    long.catch(() => undefined);
    await vi.advanceTimersByTimeAsync(1000);
    ahead.abort();
    await expect(long).rejects.toThrow('cancelled');
    const again = track(
      voice.synthesizeLocal('một câu ngắn để đọc lại', new AbortController().signal),
    );
    await vi.advanceTimersByTimeAsync(30_000);
    expect(again.value).toMatchObject({ sampleRate: 16000 });
    expect(FakeWorker.all).toHaveLength(1);
  });

  it('a phrase dropped before it started is never worked on', async () => {
    FakeWorker.msPerChar = 100;
    const first = track(
      voice.synthesizeLocal('một câu khá dài đang được đọc', new AbortController().signal),
    );
    await vi.advanceTimersByTimeAsync(10);
    const ctrl = new AbortController();
    const second = voice.synthesizeLocal('câu thứ hai', ctrl.signal);
    second.catch(() => undefined);
    await vi.advanceTimersByTimeAsync(10);
    ctrl.abort();
    await expect(second).rejects.toThrow('cancelled');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(first.value).toMatchObject({ sampleRate: 16000 });
    const posted = FakeWorker.all[0]?.posted ?? [];
    expect(posted.filter((m) => m.kind === 'cancel')).toHaveLength(1);
  });

  it('the budget follows the speed measured on this computer', () => {
    // Before anything is measured: a cautious guess, never under the first fixed budget.
    expect(voice.speakTimeoutMs('a'.repeat(100), null)).toBeGreaterThanOrEqual(15_000 + 100 * 200);
    // A CPU measured at 340 ms per character gets more than it needs for 220 characters.
    expect(voice.speakTimeoutMs('a'.repeat(220), 340)).toBeGreaterThan(220 * 340 * 2);
  });

  it('a much slower computer: after its first phrase, long phrases are no longer cut', async () => {
    FakeWorker.msPerChar = 600;
    // 40 characters: 24 s of work, measured.
    const first = track(voice.synthesizeLocal('a'.repeat(40), new AbortController().signal));
    await vi.advanceTimersByTimeAsync(25_000);
    expect(first.value).toMatchObject({ sampleRate: 16000 });
    // 220 characters: 132 s of work, longer than the budget before any measurement.
    expect(voice.speakTimeoutMs('a'.repeat(220), null)).toBeLessThan(132_000);
    const long = track(voice.synthesizeLocal('a'.repeat(220), new AbortController().signal));
    await vi.advanceTimersByTimeAsync(140_000);
    expect(long.value).toMatchObject({ sampleRate: 16000 });
  });
});
