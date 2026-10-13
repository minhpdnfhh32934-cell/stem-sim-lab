import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The Gemma worker reports a lost GPU device only when it is a real fault (audit GPU-01
 * follow-up). No model and no GPU are used: Transformers.js is replaced by fakes that behave like
 * ONNX Runtime — every load creates a WebGPU device, and disposing the last session destroys it
 * (`device.lost` resolves with reason 'destroyed').
 */
interface LostInfo {
  reason: 'destroyed' | 'unknown';
  message: string;
}
interface FakeDevice {
  lost: Promise<LostInfo>;
  lose: (info: LostInfo) => void;
}

const fake = vi.hoisted(() => {
  const devices: FakeDevice[] = [];
  const env = {
    backends: { onnx: { wasm: {}, webgpu: { device: undefined as unknown } } },
    useBrowserCache: false,
    useCustomCache: false,
    useWasmCache: true,
    customCache: null as unknown,
  };
  function newDevice(): FakeDevice {
    let lose: (info: LostInfo) => void = () => undefined;
    const lost = new Promise<LostInfo>((resolve) => {
      lose = resolve;
    });
    const device = { lost, lose };
    devices.push(device);
    env.backends.onnx.webgpu.device = device;
    return device;
  }
  const modelLoads = { count: 0 };
  /** False: the device outlives `dispose` (to send it a late real loss). */
  const behaviour = { destroyOnDispose: true };
  function model() {
    modelLoads.count += 1;
    const device = newDevice();
    return {
      dispose: () => {
        if (behaviour.destroyOnDispose) {
          device.lose({ reason: 'destroyed', message: 'Device was destroyed.' });
        }
        return Promise.resolve();
      },
    };
  }
  return { behaviour, devices, env, model, modelLoads };
});

vi.mock('./modelStore', () => ({ modelStore: {}, opfsAvailable: () => false }));
vi.mock('@huggingface/transformers', () => ({
  env: fake.env,
  AutoTokenizer: { from_pretrained: () => Promise.resolve({}) },
  AutoProcessor: { from_pretrained: () => Promise.resolve({}) },
  AutoModelForCausalLM: { from_pretrained: () => Promise.resolve(fake.model()) },
  Gemma4ForConditionalGeneration: { from_pretrained: () => Promise.resolve(fake.model()) },
  RawImage: {},
  // Not used here: no answer is generated.
  TextStreamer: vi.fn(),
}));

const posted: { kind: string; id?: number; message?: string }[] = [];
const workerSelf: {
  postMessage: (out: { kind: string }) => void;
  onmessage: ((event: { data: unknown }) => Promise<void>) | null;
} = {
  postMessage: (out) => {
    posted.push(out);
  },
  onmessage: null,
};
vi.stubGlobal('self', workerSelf);
await import('./webGemmaWorker');

async function send(data: unknown): Promise<void> {
  await workerSelf.onmessage?.({ data });
}
const load = (modelId: string) =>
  send({
    kind: 'load',
    modelId,
    repo: `onnx-community/${modelId}`,
    revision: 'main',
    modality: 'text',
    dtype: 'q4',
    device: 'webgpu',
  });
/** Lets the `device.lost` listeners run. */
const settle = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
const deviceLost = () => posted.filter((o) => o.kind === 'device-lost');

describe('Gemma worker: GPU device loss', () => {
  beforeEach(async () => {
    fake.behaviour.destroyOnDispose = true;
    await send({ kind: 'unload' });
    await settle();
    posted.length = 0;
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('a device destroyed by unloading the model is not a fault', async () => {
    await load('gemma3-1b');
    expect(posted.map((o) => o.kind)).toContain('loaded');
    await send({ kind: 'unload' });
    await settle();
    expect(fake.devices.at(-1)).toBeDefined();
    expect(deviceLost()).toEqual([]);
  });

  it('switching models (e.g. to the photo model) is not a fault and keeps the new model', async () => {
    await load('gemma3-1b');
    await load('gemma4-e2b');
    await settle();
    expect(deviceLost()).toEqual([]);
    // The new model is still loaded: asking for it again does not load it a second time.
    const loads = fake.modelLoads.count;
    await load('gemma4-e2b');
    expect(fake.modelLoads.count).toBe(loads);
  });

  it('a late real loss of a replaced model never drops the new one', async () => {
    fake.behaviour.destroyOnDispose = false;
    await load('gemma3-1b');
    const oldDevice = fake.devices.at(-1);
    await load('gemma3-270m');
    await settle();
    oldDevice?.lose({ reason: 'unknown', message: 'stale' });
    await settle();
    expect(deviceLost()).toEqual([]);
    const loads = fake.modelLoads.count;
    await load('gemma3-270m');
    expect(fake.modelLoads.count).toBe(loads);
  });

  it('a real loss of the current model is reported', async () => {
    await load('gemma3-1b');
    await settle();
    fake.devices.at(-1)?.lose({ reason: 'unknown', message: 'DXGI_ERROR_DEVICE_HUNG' });
    await settle();
    expect(deviceLost()).toEqual([{ kind: 'device-lost', message: 'DXGI_ERROR_DEVICE_HUNG' }]);
    // The model went with its device: the next load really loads it again.
    const loads = fake.modelLoads.count;
    await load('gemma3-1b');
    expect(fake.modelLoads.count).toBe(loads + 1);
  });
});
