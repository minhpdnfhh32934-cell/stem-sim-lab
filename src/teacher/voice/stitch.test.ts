import { describe, expect, it } from 'vitest';
import {
  FADE_IN_MS,
  PEAK_LIMIT,
  TARGET_RMS_DB,
  TRIM_MARGIN_MS,
  VOICE_SAMPLE_RATE,
  applyFades,
  clippingShare,
  concat,
  hasNonFinite,
  leadingSilenceMs,
  normalizeLoudness,
  peakOf,
  resample,
  shapeChunk,
  silence,
  timeStretch,
  toDb,
  trailingSilenceMs,
  trimSilence,
  voicedRms,
} from './stitch';

/**
 * Joining the on-device voice's chunks (stitch.ts): pure functions on samples, tested with
 * synthetic tones (nothing here runs a model or plays a sound).
 */
const SR = VOICE_SAMPLE_RATE;

function tone(ms: number, hz: number, amplitude: number, sr = SR): Float32Array {
  const n = Math.round((sr * ms) / 1000);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amplitude * Math.sin((2 * Math.PI * hz * i) / sr);
  return out;
}

/** Frequency of a tone from its rising zero crossings (middle 80 %, away from the edges). */
function frequency(samples: Float32Array, sr = SR): number {
  const a = Math.floor(samples.length * 0.1);
  const b = Math.floor(samples.length * 0.9);
  let crossings = 0;
  for (let i = a + 1; i < b; i++)
    if ((samples[i - 1] ?? 0) < 0 && (samples[i] ?? 0) >= 0) crossings++;
  return crossings / ((b - a) / sr);
}

/** Largest jump between neighbouring samples (a click shows as a jump). */
function maxStep(samples: Float32Array): number {
  let step = 0;
  for (let i = 1; i < samples.length; i++) {
    step = Math.max(step, Math.abs((samples[i] ?? 0) - (samples[i - 1] ?? 0)));
  }
  return step;
}

describe('trimming and pauses', () => {
  it('cuts leading and trailing silence, keeping a short margin', () => {
    const chunk = concat([silence(300, SR), tone(500, 200, 0.3), silence(400, SR)]);
    expect(leadingSilenceMs(chunk, SR)).toBeCloseTo(300, -1);
    expect(trailingSilenceMs(chunk, SR)).toBeCloseTo(400, -1);
    const trimmed = trimSilence(chunk, SR);
    expect(leadingSilenceMs(trimmed, SR)).toBeLessThanOrEqual(TRIM_MARGIN_MS + 10);
    expect(trailingSilenceMs(trimmed, SR)).toBeLessThanOrEqual(TRIM_MARGIN_MS + 10);
    expect(trimmed.length / SR).toBeCloseTo(0.5 + (2 * TRIM_MARGIN_MS) / 1000, 1);
  });

  it('silence alone trims to nothing', () => {
    expect(trimSilence(silence(200, SR), SR)).toHaveLength(0);
  });

  it('puts exactly the planned pause after the speech', () => {
    const shaped = shapeChunk(
      {
        samples: concat([silence(250, SR), tone(400, 220, 0.2), silence(350, SR)]),
        sampleRate: SR,
      },
      { rate: 1, pauseMs: 400 },
    );
    expect(shaped.sampleRate).toBe(SR);
    expect(trailingSilenceMs(shaped.samples, SR)).toBeGreaterThanOrEqual(400);
    expect(trailingSilenceMs(shaped.samples, SR)).toBeLessThanOrEqual(400 + TRIM_MARGIN_MS + 10);
    expect(leadingSilenceMs(shaped.samples, SR)).toBeLessThanOrEqual(TRIM_MARGIN_MS + 10);
  });
});

describe('loudness', () => {
  it('brings quiet and loud chunks to the same voiced level', () => {
    const quiet = normalizeLoudness(concat([tone(300, 200, 0.03), silence(300, SR)]), SR);
    const loud = normalizeLoudness(tone(300, 200, 0.6), SR);
    const a = toDb(voicedRms(quiet.samples, SR));
    const b = toDb(voicedRms(loud.samples, SR));
    expect(Math.abs(a - b)).toBeLessThan(0.5);
    expect(a).toBeCloseTo(TARGET_RMS_DB, 0);
  });

  it('never clips: a peaky chunk gets less gain instead', () => {
    const peaky = tone(300, 200, 0.02);
    peaky[1000] = 0.9;
    const { samples, gain } = normalizeLoudness(peaky, SR);
    expect(peakOf(samples)).toBeLessThanOrEqual(PEAK_LIMIT + 1e-6);
    expect(gain).toBeCloseTo(PEAK_LIMIT / 0.9, 3);
    expect(clippingShare(samples)).toBe(0);
  });

  it('does not blow up a near-silent chunk', () => {
    const { gain } = normalizeLoudness(tone(300, 200, 0.0005), SR);
    expect(toDb(gain)).toBeLessThanOrEqual(18 + 1e-9);
  });
});

describe('edges', () => {
  it('fades in and out so a chunk starts and ends at zero (no click)', () => {
    // A square-ish start: full amplitude from the first sample.
    const loud = new Float32Array(SR / 2).fill(0.5);
    const faded = applyFades(loud, SR);
    expect(Math.abs(faded[0] ?? 1)).toBeLessThan(1e-6);
    expect(Math.abs(faded.at(-1) ?? 1)).toBeLessThan(0.01);
    const ramp = Math.round((SR * FADE_IN_MS) / 1000);
    expect(maxStep(faded)).toBeLessThan((0.5 / ramp) * 2);
  });

  it('a shaped chunk followed by another has no jump at the joint', () => {
    const a = shapeChunk({ samples: tone(300, 330, 0.4), sampleRate: SR }, { rate: 1, pauseMs: 0 });
    const b = shapeChunk({ samples: tone(300, 330, 0.1), sampleRate: SR }, { rate: 1, pauseMs: 0 });
    const joined = concat([a.samples, b.samples]);
    const joint = a.samples.length;
    expect(Math.abs(joined[joint - 1] ?? 1)).toBeLessThan(0.01);
    expect(Math.abs(joined[joint] ?? 1)).toBeLessThan(1e-6);
  });
});

describe('sample rate and broken samples', () => {
  it('brings every chunk to 16 kHz', () => {
    const at24k = tone(500, 300, 0.3, 24000);
    const shaped = shapeChunk({ samples: at24k, sampleRate: 24000 }, { rate: 1, pauseMs: 0 });
    expect(shaped.sampleRate).toBe(SR);
    expect(frequency(shaped.samples)).toBeCloseTo(300, -1);
    expect(resample(at24k, 24000, SR).length).toBe(Math.round((at24k.length * SR) / 24000));
  });

  it('turns NaN or infinite samples into silence', () => {
    const broken = tone(300, 200, 0.3);
    broken[10] = NaN;
    broken[20] = Infinity;
    const shaped = shapeChunk({ samples: broken, sampleRate: SR }, { rate: 1, pauseMs: 100 });
    expect(hasNonFinite(shaped.samples)).toBe(false);
  });
});

describe('pace without a pitch change (time stretch)', () => {
  it('leaves the samples alone at rate 1', () => {
    const t = tone(200, 200, 0.3);
    expect([...timeStretch(t, 1, SR)]).toEqual([...t]);
    expect(timeStretch(new Float32Array(0), 0.9, SR)).toHaveLength(0);
  });

  it.each([0.9, 0.94, 1.03, 1.1])('rate %s changes the length, not the pitch', (rate) => {
    const t = tone(1000, 220, 0.3);
    const out = timeStretch(t, rate, SR);
    expect(out.length).toBe(Math.round(t.length / rate));
    expect(frequency(out)).toBeGreaterThan(220 * 0.97);
    expect(frequency(out)).toBeLessThan(220 * 1.03);
    expect(hasNonFinite(out)).toBe(false);
    expect(peakOf(out)).toBeLessThanOrEqual(0.3 * 1.05);
  });

  it('a slower role makes the chunk longer by its rate', () => {
    const t = tone(800, 200, 0.3);
    const normal = shapeChunk({ samples: t, sampleRate: SR }, { rate: 1, pauseMs: 0 });
    const slow = shapeChunk({ samples: t, sampleRate: SR }, { rate: 0.9, pauseMs: 0 });
    expect(slow.samples.length / normal.samples.length).toBeCloseTo(1 / 0.9, 1);
  });
});
