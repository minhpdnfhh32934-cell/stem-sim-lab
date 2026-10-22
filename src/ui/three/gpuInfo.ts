/**
 * What kind of GPU draws the 3D views (pure classification + one cached probe). Only the High
 * tier's post-processing depends on it: an integrated or software GPU never gets heavier than
 * before (the owner's laptop draws the app on its Radeon 780M iGPU). It never changes the
 * quality tier, the benchmark or anything a learner reads — only how much the picture is polished.
 */

export type GpuClass = 'software' | 'integrated' | 'discrete' | 'unknown';

const SOFTWARE = /swiftshader|llvmpipe|softpipe|lavapipe|basic render|microsoft basic|software/i;
/** Intel Arc discrete cards carry a model number (A770, B580); the Arc iGPU does not. */
const INTEL_DISCRETE = /\barc\b(\(tm\))?\s*(pro\s*)?[ab]\d{3}/i;
/** AMD APUs: "Radeon(TM) Graphics", "Radeon 780M", "Radeon Vega 8 Graphics". */
const AMD_INTEGRATED = /radeon(\(tm\))?\s*(graphics|\d{3}m\b|vega\s*\d+\s*graphics)/i;
const MOBILE_OR_APPLE = /apple|mali|adreno|powervr|videocore/i;
const DISCRETE = /nvidia|geforce|quadro|rtx|gtx|radeon\s*(\(tm\)\s*)?(rx|pro|r9|r7|vii)|firepro/i;

/**
 * Class of a WebGL renderer string (`UNMASKED_RENDERER_WEBGL`, or `RENDERER` when that is
 * hidden), e.g. "ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Laptop GPU …)". Unknown strings are
 * 'unknown' (treated like an integrated GPU).
 */
export function gpuClass(renderer: string | null | undefined): GpuClass {
  const s = (renderer ?? '').trim();
  if (!s) return 'unknown';
  if (SOFTWARE.test(s)) return 'software';
  if (/intel/i.test(s)) return INTEL_DISCRETE.test(s) ? 'discrete' : 'integrated';
  if (AMD_INTEGRATED.test(s)) return 'integrated';
  if (MOBILE_OR_APPLE.test(s)) return 'integrated';
  if (DISCRETE.test(s)) return 'discrete';
  return 'unknown';
}

/** Renderer string of a WebGL context (unmasked when the browser allows it). */
export function rendererString(gl: WebGLRenderingContext | WebGL2RenderingContext): string {
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const unmasked = ext ? (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as unknown) : null;
  if (typeof unmasked === 'string' && unmasked) return unmasked;
  const plain = gl.getParameter(gl.RENDERER) as unknown;
  return typeof plain === 'string' ? plain : '';
}

/** Development builds only: `stemsim.debug.postfx` = on | off forces the post-processing. */
export const POSTFX_OVERRIDE_KEY = 'stemsim.debug.postfx';

/** The development override in force ('on' | 'off'), or null (always null in production). */
export function postFxOverride(): 'on' | 'off' | null {
  if (!import.meta.env.DEV) return null;
  try {
    const v = localStorage.getItem(POSTFX_OVERRIDE_KEY);
    return v === 'on' || v === 'off' ? v : null;
  } catch {
    // Storage blocked: no override.
    return null;
  }
}

function devOverride(): GpuClass | null {
  // 'on': probe the art pipeline (e.g. under SwiftShader); 'off': the integrated-GPU look.
  const v = postFxOverride();
  return v === 'on' ? 'discrete' : v === 'off' ? 'integrated' : null;
}

let cached: GpuClass | null = null;

/**
 * The GPU the 3D views will use, probed once with the views' own context settings (low-power
 * preference, so a laptop reports the GPU it really draws on). jsdom and browsers without WebGL 2
 * give 'unknown'.
 */
function probe(): GpuClass {
  if (typeof document === 'undefined' || typeof navigator === 'undefined') return 'unknown';
  // jsdom has no WebGL (and reports every canvas context as "not implemented").
  if (/jsdom/i.test(navigator.userAgent)) return 'unknown';
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { powerPreference: 'low-power' });
    if (!gl) return 'unknown';
    const cls = gpuClass(rendererString(gl));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return cls;
  } catch {
    return 'unknown';
  }
}

/** The GPU class the quality table uses (dev override first, then the cached probe). */
export function detectGpuClass(): GpuClass {
  const forced = devOverride();
  if (forced) return forced;
  cached ??= probe();
  return cached;
}

/** For tests: forget the cached probe. */
export function resetGpuClassCache(): void {
  cached = null;
}
