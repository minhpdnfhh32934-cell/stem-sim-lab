import type { QualityTier } from './tiers';

export interface BenchmarkResult {
  /** Relative CPU score: thousands of RK4 body-steps per millisecond. */
  cpuScore: number;
  /** Relative 2D drawing score: circles drawn per millisecond. */
  drawScore: number;
  webgl2: boolean;
  cores: number;
  tier: QualityTier;
  /** ISO date of the measurement. */
  measuredAt: string;
  durationMs: number;
}

const now = () => performance.now();

/**
 * CPU probe: a small N-body gravity integration with RK4-like work, the same kind of
 * arithmetic the simulations do. Runs for `budgetMs`.
 */
export function cpuProbe(budgetMs: number): number {
  const n = 48;
  const x = new Float64Array(n * 2);
  const v = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) {
    x[2 * i] = Math.cos(i);
    x[2 * i + 1] = Math.sin(i * 1.3);
  }
  let bodySteps = 0;
  const start = now();
  while (now() - start < budgetMs) {
    for (let rep = 0; rep < 10; rep++) {
      for (let i = 0; i < n; i++) {
        let ax = 0;
        let ay = 0;
        const xi = x[2 * i] ?? 0;
        const yi = x[2 * i + 1] ?? 0;
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          const dx = (x[2 * j] ?? 0) - xi;
          const dy = (x[2 * j + 1] ?? 0) - yi;
          const r2 = dx * dx + dy * dy + 0.01;
          const inv = 1 / (r2 * Math.sqrt(r2));
          ax += dx * inv;
          ay += dy * inv;
        }
        v[2 * i] = (v[2 * i] ?? 0) + 1e-4 * ax;
        v[2 * i + 1] = (v[2 * i + 1] ?? 0) + 1e-4 * ay;
      }
      for (let k = 0; k < 2 * n; k++) x[k] = (x[k] ?? 0) + 1e-4 * (v[k] ?? 0);
      bodySteps += n;
    }
  }
  return bodySteps / (now() - start) / 1000;
}

/** Canvas probe: draws filled circles and forces a pixel read-back to include GPU time. */
export function drawProbe(budgetMs: number): number {
  if (typeof document === 'undefined') return 0;
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;
  let drawn = 0;
  const start = now();
  while (now() - start < budgetMs) {
    ctx.clearRect(0, 0, 800, 600);
    for (let i = 0; i < 400; i++) {
      ctx.beginPath();
      ctx.arc((i * 37) % 800, (i * 53) % 600, 6 + (i % 5), 0, Math.PI * 2);
      ctx.fillStyle = i % 2 ? '#3a6ee8' : '#1c9c8c';
      ctx.fill();
    }
    ctx.getImageData(0, 0, 1, 1); // flush
    drawn += 400;
  }
  return drawn / (now() - start);
}

export function hasWebGL2(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}

/**
 * Maps probe scores to a tier. Thresholds are heuristics calibrated so that an
 * i3-8th-gen laptop with Intel UHD 620 lands on "low"/"medium" and a gaming laptop on
 * "high"; they only affect visual quality and can be overridden in Settings.
 */
export function classify(
  cpuScore: number,
  drawScore: number,
  webgl2: boolean,
  cores: number,
): QualityTier {
  if (!webgl2 || cores <= 2 || cpuScore < 4 || drawScore < 40) return 'low';
  if (cpuScore >= 12 && drawScore >= 150 && cores >= 6) return 'high';
  return 'medium';
}

/** Runs the ~1.5 s startup benchmark, yielding to the UI between probes. */
export async function runBenchmark(): Promise<BenchmarkResult> {
  const t0 = now();
  const pause = () => new Promise((r) => setTimeout(r, 0));
  await pause();
  const cpu = cpuProbe(600);
  await pause();
  const draw = drawProbe(600);
  const webgl2 = hasWebGL2();
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2;
  return {
    cpuScore: Math.round(cpu * 100) / 100,
    drawScore: Math.round(draw),
    webgl2,
    cores,
    tier: classify(cpu, draw, webgl2, cores),
    measuredAt: new Date().toISOString(),
    durationMs: Math.round(now() - t0),
  };
}
