/**
 * Ultra's minimum (Phú 2026-11-16) against this computer, as far as a browser can tell, and how
 * playing at Ultra goes here: expected from the machine before it is turned on, measured while
 * playing after (`experienceOf`). The minimum is our estimate from the RTX 5070 Laptop's frame
 * times (docs/phase-g2-report.md); no other card was tried.
 */

/** Good to play · playable (lower frame rate, hotter machine) · not advised. */
export type Experience = 'good' | 'ok' | 'poor';

/** What the browser tells of this computer (`readMachine`). */
export interface MachineFacts {
  /** The GPU drawing the game (WEBGL_debug_renderer_info), '' when the browser hides it. */
  readonly gpu: string;
  /** Drawn without a graphics card (SwiftShader and the like). */
  readonly software: boolean;
  /** Processor threads (navigator.hardwareConcurrency). */
  readonly threads: number;
  /** Memory in GB as the browser rounds it (navigator.deviceMemory, at most 8), or null. */
  readonly memoryGb: number | null;
}

/** The minimum for Ultra. Video memory cannot be read in a browser: it is listed, not checked. */
export const ULTRA_MINIMUM = { gpu: 'RTX 4060 / RX 7600', vramGb: 8, threads: 8, memoryGb: 8 };

/** How the GPU stands against Ultra's: of the RTX 4060 class or better, a smaller card, … */
export type GpuClass = 'strong' | 'dedicated' | 'integrated' | 'software' | 'unknown';

/** Graphics in the processor: Intel HD/UHD/Iris, AMD's APUs (Radeon Graphics, Vega, 610M…). */
const INTEGRATED =
  /Intel\(R\) (HD|UHD|Iris)|Intel.*\b(HD|UHD|Iris)\b.*Graphics|Radeon\(TM\) (Vega \d+ )?Graphics|Radeon Vega|Radeon\s*\d{3}M\b|Mali|Adreno|PowerVR/i;

export function gpuClass(name: string, software: boolean): GpuClass {
  if (software) return 'software';
  if (!name) return 'unknown';
  if (INTEGRATED.test(name)) return 'integrated';
  const rtx = /RTX\s*(\d{2})(\d{2})/i.exec(name);
  if (rtx) {
    const series = Number(rtx[1]);
    const tier = Number(rtx[2]);
    // The RTX 4060's class: a 2080, a 3060 or more, a 4060 or more, a 5050 or more.
    const strong =
      (series === 20 && tier >= 80) || (series >= 30 && series < 50 && tier >= 60) || series >= 50;
    return strong ? 'strong' : 'dedicated';
  }
  if (/TITAN|RTX\s*A[4-6]\d{3}|Quadro RTX [5-8]/i.test(name)) return 'strong';
  const rx = /RX\s*(\d)(\d)\d{2}/i.exec(name);
  if (rx) {
    const gen = Number(rx[1]);
    const tier = Number(rx[2]);
    const strong = (gen === 6 && tier >= 6) || (gen === 7 && tier >= 6) || gen >= 9;
    return strong ? 'strong' : 'dedicated';
  }
  if (/Arc\(TM\)\s*[AB](7\d\d|5[89]\d)|Arc\s*[AB](7\d\d|5[89]\d)/i.test(name)) return 'strong';
  if (/GeForce|NVIDIA|Radeon|Arc|Apple/i.test(name)) return 'dedicated';
  return 'unknown';
}

/** Each part of the minimum: met (true), not (false), or not readable here (null). */
export interface UltraCheck {
  readonly gpu: boolean | null;
  readonly threads: boolean;
  readonly memory: boolean | null;
  /** Video memory: never readable in a browser. */
  readonly vram: null;
  readonly expected: Experience;
}

export function checkUltra(f: MachineFacts): UltraCheck {
  const cls = gpuClass(f.gpu, f.software);
  const gpu = cls === 'strong' ? true : cls === 'unknown' ? null : false;
  const threads = f.threads >= ULTRA_MINIMUM.threads;
  const memory = f.memoryGb === null ? null : f.memoryGb >= ULTRA_MINIMUM.memoryGb;
  const expected: Experience =
    cls === 'software' || cls === 'integrated'
      ? 'poor'
      : cls === 'strong' && threads && memory !== false
        ? 'good'
        : 'ok';
  return { gpu, threads, memory, vram: null, expected };
}

/**
 * How playing goes at the frame rate measured (`fps`, the median of a few seconds' play) under the
 * frame-rate cap (`cap`, 0 none): reaching a cap says no more than the cap itself.
 */
export function experienceOf(fps: number, cap: number): Experience {
  const reached = cap > 0 && fps >= cap * 0.9;
  const rate = reached ? cap : fps;
  return rate >= 55 ? 'good' : rate >= 30 ? 'ok' : 'poor';
}

let probedGpu: string | null = null;

/** The GPU's name from a canvas outside the page, released at once, for before the renderer loads. */
function probeGpu(): string {
  if (probedGpu !== null) return probedGpu;
  const gl = document.createElement('canvas').getContext('webgl2');
  const info = gl?.getExtension('WEBGL_debug_renderer_info');
  probedGpu = gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
  gl?.getExtension('WEBGL_lose_context')?.loseContext();
  return probedGpu;
}

/**
 * This computer's facts, from the browser: the GPU's name read by the renderer, or (from the main
 * menu, before the renderer loads) from a canvas of its own.
 */
export function readMachine(gpu: string, software: boolean): MachineFacts {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const name = gpu || probeGpu();
  return {
    gpu: name,
    software: software || /SwiftShader|llvmpipe|Software|Basic Render/i.test(name),
    threads: navigator.hardwareConcurrency || 0,
    memoryGb: typeof memory === 'number' ? memory : null,
  };
}
