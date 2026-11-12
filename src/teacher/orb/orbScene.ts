/**
 * AI Teacher's orb as a three.js scene (#234 step 2): the points and the thin lines share one
 * position buffer, drawn additively. `update` only turns, scales and recolours what exists: no
 * allocation per frame (the colour buffer is written in place). `dispose` frees everything.
 */
import * as THREE from 'three';
import { meanSpacing, orbPairs } from './neighbors';
import { ORB_BUDGET, orbPoints } from './points';
import type { OrbParams } from './states';

export interface OrbColors {
  /** The points (`--teacher-accent`). */
  accent: string;
  /** The lines (`--teacher-line`). */
  line: string;
  /**
   * Light added to the dark stage (glowing points); false on the light stage, where added light
   * would vanish into the pale background: the accent is drawn as ink instead.
   */
  glow: boolean;
}

export interface OrbScene {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  /** Advances the orb by `dt` seconds with these parameters and a voice level (0–1). */
  update(dt: number, params: OrbParams, level: number): void;
  setColors(colors: OrbColors): void;
  setAspect(aspect: number): void;
  readonly points: number;
  readonly pairs: number;
  dispose(): void;
}

/** Points nearer the sweeping band than this (in y, unit sphere) light up. */
const BAND_WIDTH = 0.28;
/** How much brighter the band makes a point, at full strength. */
const BAND_GAIN = 1.4;
/** How much the voice swells the orb at full level. */
const VOICE_SWELL = 0.12;
/** Depth of the brightness breathing (share of the glow). */
const PULSE_DEPTH = 0.25;

export function buildOrbScene(
  tier: keyof typeof ORB_BUDGET,
  colors: OrbColors,
  seed = 1,
): OrbScene {
  const budget = ORB_BUDGET[tier];
  const positions = orbPoints(budget.points, seed);
  const pairs = orbPairs(positions, 3, 2 * meanSpacing(budget.points), budget.pairs);
  const n = budget.points;

  const position = new THREE.BufferAttribute(positions, 3);
  const tint = new Float32Array(n * 3);
  const color = new THREE.BufferAttribute(tint, 3);
  color.setUsage(THREE.DynamicDrawUsage);

  const pointGeometry = new THREE.BufferGeometry();
  pointGeometry.setAttribute('position', position);
  pointGeometry.setAttribute('color', color);
  const pointMaterial = new THREE.PointsMaterial({
    size: tier === 'high' ? 0.035 : 0.045,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });

  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', position);
  lineGeometry.setIndex(new THREE.BufferAttribute(pairs, 1));
  const lineMaterial = new THREE.LineBasicMaterial({
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });

  const group = new THREE.Group();
  group.add(new THREE.LineSegments(lineGeometry, lineMaterial));
  group.add(new THREE.Points(pointGeometry, pointMaterial));
  group.rotation.x = 0.35;
  const scene = new THREE.Scene();
  scene.add(group);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
  camera.position.set(0, 0, 4.2);
  camera.lookAt(0, 0, 0);

  const accent = new THREE.Color();
  let glowing = true;
  let time = 0;
  let turn = 0;

  const setColors = (c: OrbColors) => {
    accent.set(c.accent);
    lineMaterial.color.set(c.line);
    glowing = c.glow;
    const blending = c.glow ? THREE.AdditiveBlending : THREE.NormalBlending;
    for (const m of [pointMaterial, lineMaterial]) {
      m.blending = blending;
      m.needsUpdate = true;
    }
  };
  setColors(colors);

  return {
    scene,
    camera,
    points: n,
    pairs: pairs.length / 2,
    update(dt, p, level) {
      time += dt;
      turn += p.spin * dt;
      group.rotation.y = turn;
      group.scale.setScalar(p.scale * (1 + VOICE_SWELL * p.voice * level));
      const pulse = 1 - PULSE_DEPTH + PULSE_DEPTH * Math.cos(2 * Math.PI * p.pulseHz * time);
      const glow = p.glow * pulse;
      // The band sweeps up and down the orb (in the orb's own frame), slowly.
      const bandY = Math.sin(time * 0.9);
      for (let i = 0; i < n; i++) {
        const off = Math.abs((positions[3 * i + 1] ?? 0) - bandY);
        const lit = off < BAND_WIDTH ? 1 + p.band * BAND_GAIN * (1 - off / BAND_WIDTH) : 1;
        // Ink on the light stage: never paler than half the accent (it must stay visible).
        const k = glowing ? glow * lit : Math.min(1, 0.5 + 0.5 * glow * lit);
        tint[3 * i] = accent.r * k;
        tint[3 * i + 1] = accent.g * k;
        tint[3 * i + 2] = accent.b * k;
      }
      color.needsUpdate = true;
      lineMaterial.opacity = 0.2 + 0.25 * glow;
    },
    setColors,
    setAspect(aspect) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    },
    dispose() {
      pointGeometry.dispose();
      lineGeometry.dispose();
      pointMaterial.dispose();
      lineMaterial.dispose();
      scene.clear();
    },
  };
}
