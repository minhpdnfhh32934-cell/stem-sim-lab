/**
 * Audio for AI Teacher's voices that are not the operating system's: decoding Gemini's
 * WAV / raw 16-bit PCM and playing float samples (Gemini or the on-device model) one phrase
 * after another, with the pauses the text asks for. Nothing is recorded or stored.
 */

export interface Pcm {
  samples: Float32Array;
  sampleRate: number;
}

function base64Bytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function int16ToFloat(view: DataView, offset: number, length: number): Float32Array {
  const count = Math.floor(length / 2);
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) out[i] = view.getInt16(offset + i * 2, true) / 32768;
  return out;
}

/**
 * Gemini answers with a WAV file (RIFF header) or headerless 16-bit little-endian PCM whose
 * MIME type names the rate ("audio/L16;codec=pcm;rate=24000").
 */
export function decodeAudio(b64: string, mimeType: string): Pcm {
  const bytes = base64Bytes(b64);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riff = bytes.length > 12 && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF';
  if (riff) {
    let sampleRate = 24000;
    let bits = 16;
    let offset = 12;
    while (offset + 8 <= bytes.length) {
      const id = String.fromCharCode(...bytes.subarray(offset, offset + 4));
      const size = view.getUint32(offset + 4, true);
      const body = offset + 8;
      if (id === 'fmt ') {
        sampleRate = view.getUint32(body + 4, true);
        bits = view.getUint16(body + 14, true);
      } else if (id === 'data') {
        if (bits !== 16) throw new Error(`unsupported WAV: ${String(bits)}-bit`);
        const length = Math.min(size, bytes.length - body);
        return { samples: int16ToFloat(view, body, length), sampleRate };
      }
      offset = body + size + (size % 2);
    }
    throw new Error('WAV without data');
  }
  const rate = /rate=(\d+)/i.exec(mimeType)?.[1];
  return { samples: int16ToFloat(view, 0, bytes.length), sampleRate: rate ? Number(rate) : 24000 };
}

/**
 * No sound a learner could hear: no samples, broken samples (NaN), or nothing above about
 * −60 dBFS. A voice that returns this did not speak, whatever it reported.
 */
export function isSilent(pcm: Pcm, floor = 1e-3): boolean {
  let peak = 0;
  for (const v of pcm.samples) {
    if (!Number.isFinite(v)) return true;
    const a = Math.abs(v);
    if (a > peak) peak = a;
  }
  return peak < floor;
}

let context: AudioContext | null = null;
let current: AudioBufferSourceNode | null = null;

function audioContext(): AudioContext {
  context ??= new AudioContext();
  return context;
}

/** Plays samples; resolves when they end or when `signal` aborts (the sound stops at once). */
export async function playPcm(pcm: Pcm, signal: AbortSignal, rate = 1): Promise<void> {
  if (signal.aborted || pcm.samples.length === 0) return;
  const ctx = audioContext();
  if (ctx.state === 'suspended') {
    // Autoplay rules can keep audio off until the learner clicks: never wait for ever.
    await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, 1500))]);
    if ((ctx.state as AudioContextState) !== 'running') throw new Error('audio-blocked');
  }
  const buffer = ctx.createBuffer(1, pcm.samples.length, pcm.sampleRate);
  buffer.copyToChannel(pcm.samples as Float32Array<ArrayBuffer>, 0);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = rate;
  source.connect(ctx.destination);
  current = source;
  await new Promise<void>((resolve) => {
    const stop = () => {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
      resolve();
    };
    source.onended = () => {
      signal.removeEventListener('abort', stop);
      resolve();
    };
    signal.addEventListener('abort', stop, { once: true });
    source.start();
  });
  if (current === source) current = null;
}

/** Stops whatever is playing (used by "Dừng đọc"). */
export function stopAudio(): void {
  try {
    current?.stop();
  } catch {
    /* already stopped */
  }
  current = null;
}

/** Waits `ms`, or less if `signal` aborts. */
export function pause(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0 || signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    }
    signal.addEventListener('abort', done, { once: true });
  });
}
