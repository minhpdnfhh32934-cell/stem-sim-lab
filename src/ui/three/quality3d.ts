/**
 * What a 3D view draws at each quality tier (pure; one table for every 3D view). Tiers change
 * only how things are drawn — never a count, a position or a number shown (MASTER_PROMPT §4.3).
 * The Low tier has no 3D at all: the view shows its 2D picture (`availability.ts`).
 */
import type { QualityTier, TierConfig } from '@/perf/tiers';

export interface Quality3D {
  tier: QualityTier;
  /** Sphere / tube segments (never below 8). */
  segments: number;
  /** Real shadow maps from the key light (High only), map size in texels. */
  shadows: boolean;
  shadowMapSize: number;
  /** A soft shadow disc under the subject (cheap fake ambient occlusion). */
  contactShadow: boolean;
  /** Prefiltered environment lighting (reflections and soft ambient light). */
  envMap: boolean;
  /** Most instances (individuals, particles, vesicles) one view draws. */
  maxInstances: number;
  /** Most name labels shown at once (more would cover the picture). */
  labelCap: number;
  /** Physically based extras (sheen, clear coat, double nuclear envelope, pore rings…). */
  detail: boolean;
  pixelRatioCap: number;
  antialias: boolean;
}

/**
 * Share of the tier's particle budget (`maxParticles`, sized for 2D canvases and point sprites)
 * that a 3D view may spend on lit instanced meshes: each instance costs a whole small mesh, so
 * about 15 % — Medium 4000 → 600, High 10 000 → 1500.
 */
export const INSTANCE_SHARE = 0.15;

/** Labels per tier: a few on Medium (smaller canvases, slower machines), more on High. */
const LABELS: Record<QualityTier, number> = { low: 0, medium: 6, high: 10 };

export function quality3d(tier: QualityTier, cfg: TierConfig): Quality3D {
  const high = tier === 'high';
  return {
    tier,
    segments: Math.max(8, Math.round(cfg.sphereSegments)),
    shadows: high && cfg.shadows,
    shadowMapSize: high && cfg.shadows ? 1024 : 0,
    contactShadow: tier !== 'low',
    envMap: tier !== 'low',
    maxInstances: Math.max(1, Math.round(cfg.maxParticles * INSTANCE_SHARE)),
    labelCap: LABELS[tier],
    detail: high,
    pixelRatioCap: cfg.pixelRatioCap,
    antialias: cfg.antialias,
  };
}
