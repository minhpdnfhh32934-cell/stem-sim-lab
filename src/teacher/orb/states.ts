/**
 * What AI Teacher's orb shows (#234), as numbers the drawing (step 2) reads each frame. Pure:
 * which state, its parameters, the eased change between two states, and which picture to draw
 * (the orb, the orb drawn once, or the SVG rings).
 */
import type { QualityTier } from '@/perf/tiers';

export type OrbState = 'boot' | 'idle' | 'listening' | 'thinking' | 'speaking' | 'done';

export interface OrbParams {
  /** Radius, relative to the resting orb. */
  scale: number;
  /** Turn speed, rad/s. */
  spin: number;
  /** Brightness of the points and lines, 0–1. */
  glow: number;
  /** Strength of the bright band that sweeps the orb while it thinks, 0–1. */
  band: number;
  /** Breathing / pulsing of the brightness, Hz; never above 3 (WCAG 2.3.1: three flashes). */
  pulseHz: number;
  /** How much the voice level swells the orb while it speaks, 0–1. */
  voice: number;
}

/** WCAG 2.3.1: no more than three flashes a second. */
export const MAX_PULSE_HZ = 3;

export const ORB_STATES: Readonly<Record<OrbState, OrbParams>> = {
  boot: { scale: 0.9, spin: 0.6, glow: 0.55, band: 0, pulseHz: 1.2, voice: 0 },
  idle: { scale: 1, spin: 0.12, glow: 0.6, band: 0, pulseHz: 0.25, voice: 0 },
  listening: { scale: 1.04, spin: 0.18, glow: 0.75, band: 0, pulseHz: 0.5, voice: 0 },
  thinking: { scale: 1, spin: 0.45, glow: 0.8, band: 1, pulseHz: 0.8, voice: 0 },
  speaking: { scale: 1.02, spin: 0.2, glow: 0.85, band: 0, pulseHz: 0, voice: 1 },
  done: { scale: 1, spin: 0.15, glow: 0.7, band: 0, pulseHz: 0.4, voice: 0 },
};

/** A change of state eases over this long (400–600 ms in the plan). */
export const TRANSITION_MS = 500;

/** Smoothstep: no jump in speed at either end. */
const ease = (t: number) => t * t * (3 - 2 * t);

/** Parameters `elapsedMs` after a change from `from` to `to` began. */
export function paramsAt(from: OrbParams, to: OrbParams, elapsedMs: number): OrbParams {
  const t = ease(Math.min(1, Math.max(0, elapsedMs / TRANSITION_MS)));
  const mix = (a: number, b: number) => a + (b - a) * t;
  return {
    scale: mix(from.scale, to.scale),
    spin: mix(from.spin, to.spin),
    glow: mix(from.glow, to.glow),
    band: mix(from.band, to.band),
    pulseHz: mix(from.pulseHz, to.pulseHz),
    voice: mix(from.voice, to.voice),
  };
}

/** Reduced motion: drawn once and still; the state shows in brightness (and the chip's words). */
export function still(p: OrbParams): OrbParams {
  return { ...p, spin: 0, band: 0, pulseHz: 0, voice: 0 };
}

/**
 * The state from what the page already knows: the first open boots; then a voice reading speaks,
 * an answer on its way thinks, a question being typed listens, a finished answer is done until
 * the learner does something else, and otherwise the orb waits.
 */
export function orbStateOf(now: {
  booting: boolean;
  speaking: boolean;
  answering: boolean;
  typing: boolean;
  justAnswered: boolean;
}): OrbState {
  if (now.booting) return 'boot';
  if (now.speaking) return 'speaking';
  if (now.answering) return 'thinking';
  if (now.typing) return 'listening';
  if (now.justAnswered) return 'done';
  return 'idle';
}

export type OrbPicture = 'orb' | 'still' | 'rings';

/**
 * Which picture: the SVG rings on Low quality, without WebGL 2 or after a lost context; the orb
 * drawn once with reduced motion; otherwise the moving orb.
 */
export function orbPicture(env: {
  tier: QualityTier;
  webgl2: boolean;
  contextLost: boolean;
  reducedMotion: boolean;
}): OrbPicture {
  if (env.tier === 'low' || !env.webgl2 || env.contextLost) return 'rings';
  return env.reducedMotion ? 'still' : 'orb';
}
