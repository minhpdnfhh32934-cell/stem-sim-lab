/**
 * Rendering quality tiers (MASTER_PROMPT §4.3). Tiers change only how things are *drawn*,
 * never the physics: numbers are identical on every tier.
 */
export type QualityTier = 'low' | 'medium' | 'high';
export type QualityPreference = 'auto' | QualityTier;

export interface TierConfig {
  /** Upper bound for devicePixelRatio used by canvases. */
  pixelRatioCap: number;
  antialias: boolean;
  shadows: boolean;
  /** Maximum simulated particles drawn individually (beyond that: representative particles). */
  maxParticles: number;
  /** Molecule rendering detail (sphere segments). */
  sphereSegments: number;
  /** Graph refresh rate in Hz. */
  graphHz: number;
}

export const TIERS: Record<QualityTier, TierConfig> = {
  low: {
    pixelRatioCap: 1,
    antialias: false,
    shadows: false,
    maxParticles: 1500,
    sphereSegments: 8,
    graphHz: 8,
  },
  medium: {
    pixelRatioCap: 1.5,
    antialias: true,
    shadows: false,
    maxParticles: 4000,
    sphereSegments: 16,
    graphHz: 15,
  },
  high: {
    pixelRatioCap: 2,
    antialias: true,
    shadows: true,
    maxParticles: 10000,
    sphereSegments: 24,
    graphHz: 30,
  },
};

export const TIER_ORDER: readonly QualityTier[] = ['low', 'medium', 'high'];

export function lowerTier(t: QualityTier): QualityTier {
  const i = TIER_ORDER.indexOf(t);
  return TIER_ORDER[Math.max(0, i - 1)] ?? 'low';
}
