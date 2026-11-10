/**
 * "Nghe": the partial sum being drawn, played through Web Audio. Only after the learner presses
 * the button (browsers allow sound only then), quiet (gain ≤ MAX_GAIN, ramped in and out), never
 * the microphone. A PeriodicWave built from the same sine coefficients b_n repeats the drawn
 * shape at f₁ (the browser scales it so its peak is 1).
 */
export const MAX_GAIN = 0.15;
const RAMP_S = 0.05;

interface AudioLike {
  currentTime: number;
  destination: AudioNode;
  state: string;
  resume(): Promise<void>;
  close(): Promise<void>;
  createOscillator(): OscillatorNode;
  createGain(): GainNode;
  createPeriodicWave(real: Float32Array, imag: Float32Array): PeriodicWave;
}

export type AudioFactory = () => AudioLike | null;

const browserAudio: AudioFactory = () => {
  const Ctx =
    (globalThis as { AudioContext?: new () => AudioLike }).AudioContext ??
    (globalThis as { webkitAudioContext?: new () => AudioLike }).webkitAudioContext;
  return Ctx ? new Ctx() : null;
};

export class SumPlayer {
  private ctx: AudioLike | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;

  constructor(private readonly make: AudioFactory = browserAudio) {}

  get playing(): boolean {
    return this.osc !== null;
  }

  /** Starts (or retunes) the sound: f₁ in Hz, coefficients b_n for n = 1…N. False: no audio here. */
  play(f1: number, b: number[]): boolean {
    if (!this.ctx) this.ctx = this.make();
    const ctx = this.ctx;
    if (!ctx) return false;
    if (ctx.state === 'suspended') void ctx.resume();
    // Index 0 is the constant term; real (cosine) parts are 0 for these odd waves.
    const imag = new Float32Array(b.length + 1);
    b.forEach((v, i) => (imag[i + 1] = v));
    const wave = ctx.createPeriodicWave(new Float32Array(b.length + 1), imag);
    if (this.osc) {
      this.osc.setPeriodicWave(wave);
      this.osc.frequency.setValueAtTime(f1, ctx.currentTime);
      return true;
    }
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(MAX_GAIN, ctx.currentTime + RAMP_S);
    gain.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(wave);
    osc.frequency.setValueAtTime(f1, ctx.currentTime);
    osc.connect(gain);
    osc.start();
    this.osc = osc;
    this.gain = gain;
    return true;
  }

  /** Fades out and stops; nothing keeps playing after leaving the lesson or the tab. */
  stop(): void {
    const ctx = this.ctx;
    const osc = this.osc;
    const gain = this.gain;
    this.osc = null;
    this.gain = null;
    if (!ctx || !osc || !gain) return;
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + RAMP_S);
    osc.stop(t + RAMP_S);
  }

  dispose(): void {
    this.stop();
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx) void ctx.close();
  }
}
