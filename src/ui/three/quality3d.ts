/**
 * What a 3D view draws at each quality tier (pure; one table for every 3D view). Tiers change
 * only how things are drawn — never a count, a position or a number shown (MASTER_PROMPT §4.3).
 * The Low tier has no 3D at all: the view shows its 2D picture (`availability.ts`).
 *
 * The High tier's post-processing (ambient occlusion, bloom, see-through glass with refraction,
 * shadow maps) runs only on a discrete GPU. High on an integrated or software GPU draws the
 * Medium look with High's extra detail (segments, labels, sheen): no heavier than before.
 * Software WebGL (no GPU: SwiftShader, WARP) also leaves out the look's accents (`accents`).
 */
import type { QualityTier, TierConfig } from '@/perf/tiers';
import { detectGpuClass, type GpuClass } from './gpuInfo';

export interface Quality3D {
  tier: QualityTier;
  /** GPU class the table was made for (`gpuInfo.ts`). */
  gpu: GpuClass;
  /** Sphere / tube segments (never below 8). */
  segments: number;
  /** Real shadow maps from the key light (High on a discrete GPU), map size in texels. */
  shadows: boolean;
  shadowMapSize: number;
  /** Shadow maps for opaque grounded subjects (habitats, boards, tank floors) only. */
  shadowScenes: boolean;
  /** A soft shadow disc under the subject (cheap fake ambient occlusion). */
  contactShadow: boolean;
  /** Prefiltered environment lighting (reflections and soft ambient light). */
  envMap: boolean;
  /** Scale of the look's environment intensity (0 without 3D). */
  envIntensity: number;
  /** Most instances (individuals, particles, vesicles) one view draws. */
  maxInstances: number;
  /** Most name labels shown at once (more would cover the picture). */
  labelCap: number;
  /** Physically based extras (sheen, clear coat, double nuclear envelope, pore rings…). */
  detail: boolean;
  pixelRatioCap: number;
  antialias: boolean;
  /** 'full': render through the post-processing chain (`postfx.ts`, loaded on demand). */
  postFx: 'none' | 'full';
  /** Screen-space ambient occlusion (GTAO) in the chain. */
  ao: boolean;
  /** Bloom of HDR highlights (only while a highlight is shown). */
  bloom: boolean;
  /** Multisampling of the chain's render target (0: the canvas's own antialiasing). */
  msaaSamples: 0 | 4;
  /** The outermost shell / glassware refracts (MeshPhysicalMaterial transmission). */
  transmission: boolean;
  /**
   * The look's per-pixel accents: fill and rim lights, the lit back face of see-through shells,
   * the clear coat of the cell-division solids. Off only with software WebGL, where every pixel
   * costs CPU time (+24 % per mitosis frame at High, `mitosis3d.spec.ts` @perf); any real GPU
   * keeps them. Look only: never a count, a position or a number shown.
   */
  accents: boolean;
}

/**
 * Share of the tier's particle budget (`maxParticles`, sized for 2D canvases and point sprites)
 * that a 3D view may spend on lit instanced meshes: each instance costs a whole small mesh, so
 * about 15 % — Medium 4000 → 600, High 10 000 → 1500.
 */
export const INSTANCE_SHARE = 0.15;

/** Labels per tier: a few on Medium (smaller canvases, slower machines), more on High. */
const LABELS: Record<QualityTier, number> = { low: 0, medium: 6, high: 10 };

/**
 * The table. `gpu` defaults to the GPU this browser draws on (probed once; 'unknown' in tests).
 */
export function quality3d(
  tier: QualityTier,
  cfg: TierConfig,
  gpu: GpuClass = detectGpuClass(),
): Quality3D {
  const high = tier === 'high';
  const full = high && gpu === 'discrete';
  const shadows = full && cfg.shadows;
  return {
    tier,
    gpu,
    segments: Math.max(8, Math.round(cfg.sphereSegments)),
    shadows,
    shadowMapSize: shadows ? 1024 : 0,
    shadowScenes: shadows,
    contactShadow: tier !== 'low',
    envMap: tier !== 'low',
    envIntensity: tier === 'low' ? 0 : 1,
    maxInstances: Math.max(1, Math.round(cfg.maxParticles * INSTANCE_SHARE)),
    labelCap: LABELS[tier],
    detail: high,
    pixelRatioCap: cfg.pixelRatioCap,
    antialias: cfg.antialias,
    postFx: full ? 'full' : 'none',
    ao: full,
    bloom: full,
    msaaSamples: full ? 4 : 0,
    transmission: full,
    accents: gpu !== 'software',
  };
}
