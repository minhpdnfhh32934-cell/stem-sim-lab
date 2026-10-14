/**
 * Prosody controls of the on-device voice (MMS-TTS, a VITS model). In Hugging Face's VITS the
 * speaking rate and the two noise scales are config values (`speaking_rate`, `noise_scale`,
 * `noise_scale_duration`) read inside `forward()`. Transformers.js runs the exported ONNX graph
 * and feeds it only the inputs the graph names (`session.inputNames`); Optimum's VITS export
 * (behind `Xenova/mms-tts-*`) declares `input_ids` and `attention_mask` only, so these values are
 * fixed in it (1, 0.667, 0.8) — not checked on the stored file, which is why the worker reads the
 * names at load. The worker passes a control only when a graph does name it and reports
 * which ones it applied; anything else is done on the page (the pace by `timeStretch`), and the
 * noise scales then stay the model's own (docs/AI_TUTOR.md, "Teacher voice").
 */

export const VITS_CONTROLS = ['speaking_rate', 'noise_scale', 'noise_scale_duration'] as const;
export type VitsControl = (typeof VITS_CONTROLS)[number];

export interface VitsProsody {
  speakingRate: number;
  noiseScale: number;
  noiseScaleDuration: number;
}

/** The values baked into the MMS export (Hugging Face `VitsConfig` defaults). */
export const VITS_DEFAULTS: Readonly<VitsProsody> = {
  speakingRate: 1,
  noiseScale: 0.667,
  noiseScaleDuration: 0.8,
};

/** Where MMS still sounds clean: wider noise makes it rough or slurred, rates beyond ±15 % odd. */
export const VITS_SAFE: Readonly<Record<keyof VitsProsody, readonly [number, number]>> = {
  speakingRate: [0.85, 1.15],
  noiseScale: [0.5, 0.8],
  noiseScaleDuration: [0.6, 1],
};

const clamp = (v: number, [lo, hi]: readonly [number, number], fallback: number) =>
  Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;

/** Keeps every value inside its safe range (a missing or broken value is the model's own). */
export function clampProsody(p: Partial<VitsProsody> = {}): VitsProsody {
  return {
    speakingRate: clamp(p.speakingRate ?? NaN, VITS_SAFE.speakingRate, VITS_DEFAULTS.speakingRate),
    noiseScale: clamp(p.noiseScale ?? NaN, VITS_SAFE.noiseScale, VITS_DEFAULTS.noiseScale),
    noiseScaleDuration: clamp(
      p.noiseScaleDuration ?? NaN,
      VITS_SAFE.noiseScaleDuration,
      VITS_DEFAULTS.noiseScaleDuration,
    ),
  };
}

/** The controls a model's graph accepts as inputs (none for the MMS export in use). */
export function supportedControls(inputNames: readonly string[]): VitsControl[] {
  return VITS_CONTROLS.filter((c) => inputNames.includes(c));
}

/** The graph's input names, read defensively from a Transformers.js model (its "model" session). */
export function sessionInputNames(model: unknown): string[] {
  const sessions = (model as { sessions?: Record<string, { inputNames?: unknown }> } | null)
    ?.sessions;
  const names = sessions?.model?.inputNames;
  return Array.isArray(names) ? names.filter((n): n is string => typeof n === 'string') : [];
}

/** Values to feed for the controls the graph accepts, clamped to their safe ranges. */
export function controlFeeds(
  supported: readonly VitsControl[],
  prosody: Partial<VitsProsody> | undefined,
): Partial<Record<VitsControl, number>> {
  if (!prosody) return {};
  const p = clampProsody(prosody);
  const value: Record<VitsControl, number> = {
    speaking_rate: p.speakingRate,
    noise_scale: p.noiseScale,
    noise_scale_duration: p.noiseScaleDuration,
  };
  const feeds: Partial<Record<VitsControl, number>> = {};
  for (const c of supported) feeds[c] = value[c];
  return feeds;
}

/**
 * ONNX Runtime or Transformers.js refusing a value fed to the graph: a wrong name, data type,
 * rank or shape ("Invalid rank for input: noise_scale", "Unexpected input data type").
 */
const INPUT_REFUSED =
  /\binputs?\b|\bfeeds?\b|\bshape\b|\bdimensions?\b|\brank\b|data type|tensor\(/i;

/**
 * Whether a run that was fed prosody controls may run again without them: only when the graph
 * refused a value. Never on a graphics-card failure (`gpuFailure`, src/ai/gpuSafety.ts): a second
 * run would put more work on a failing card and hide its error, which must reach the page so the
 * voice leaves the card.
 */
export function retryWithoutControls(
  error: unknown,
  gpuFailure: (message: string) => boolean,
): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return !gpuFailure(message) && INPUT_REFUSED.test(message);
}

/**
 * Runs the model with the prosody controls; a graph that refuses one of them is run again
 * without (`withControls` false: stop asking). Any other error is thrown as it is.
 */
export async function runWithControls<T>(
  run: (feeds: Record<string, unknown>) => Promise<T>,
  inputs: Record<string, unknown>,
  controls: Record<string, unknown>,
  gpuFailure: (message: string) => boolean,
): Promise<{ output: T; withControls: boolean }> {
  if (Object.keys(controls).length === 0) return { output: await run(inputs), withControls: false };
  try {
    return { output: await run({ ...inputs, ...controls }), withControls: true };
  } catch (e) {
    if (!retryWithoutControls(e, gpuFailure)) throw e;
    return { output: await run(inputs), withControls: false };
  }
}
