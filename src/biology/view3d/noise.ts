/**
 * Seeded value noise for the biology 3D kit (pure, deterministic): the lumpy surface of a protein
 * blob, the soft grain of a chromosome (a bump map, never stripes — banding would be invented
 * cytogenetics), and terrain. Shapes and textures are illustration; no number a learner reads
 * comes from here.
 */
import * as THREE from 'three';

/** Integer hash → [0, 1). */
function hash3(x: number, y: number, z: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647);
  h = Math.imul(h ^ Math.imul(seed | 0, 1274126177), 1103515245);
  h ^= h >>> 13;
  h = Math.imul(h, 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const fade = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const wrap = (i: number, p: number) => (p > 0 ? ((i % p) + p) % p : i);

/**
 * Value noise in 3D, in [0, 1]. With `period` > 0 the lattice repeats every `period` units on
 * each axis (seamless tiles).
 */
export function valueNoise3(x: number, y: number, z: number, seed = 0, period = 0): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = fade(x - ix);
  const fy = fade(y - iy);
  const fz = fade(z - iz);
  const h = (dx: number, dy: number, dz: number) =>
    hash3(wrap(ix + dx, period), wrap(iy + dy, period), wrap(iz + dz, period), seed);
  const x00 = lerp(h(0, 0, 0), h(1, 0, 0), fx);
  const x10 = lerp(h(0, 1, 0), h(1, 1, 0), fx);
  const x01 = lerp(h(0, 0, 1), h(1, 0, 1), fx);
  const x11 = lerp(h(0, 1, 1), h(1, 1, 1), fx);
  return lerp(lerp(x00, x10, fy), lerp(x01, x11, fy), fz);
}

/** Sum of `octaves` noise layers (each twice the frequency, half the weight), in [−1, 1]. */
export function fbm3(x: number, y: number, z: number, seed = 0, octaves = 3): number {
  let sum = 0;
  let weight = 0;
  let amp = 1;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * (valueNoise3(x * f, y * f, z * f, seed + o * 101) * 2 - 1);
    weight += amp;
    amp *= 0.5;
    f *= 2;
  }
  return weight > 0 ? sum / weight : 0;
}

export const NOISE_SIZE = 64;

/**
 * A seamless, isotropic grey noise tile (64², two octaves, RGBA bytes) for bump maps. Built from
 * numbers (jsdom-safe); repeats without a seam in both directions.
 */
export function noiseTexture(seed = 7, cells = 8): THREE.DataTexture {
  const n = NOISE_SIZE;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = (x / n) * cells;
      const v = (y / n) * cells;
      const a = valueNoise3(u, v, 0, seed, cells);
      const b = valueNoise3(u * 2, v * 2, 0, seed + 1, cells * 2);
      const g = Math.round(255 * Math.min(1, Math.max(0, 0.65 * a + 0.35 * b)));
      const k = 4 * (y * n + x);
      data[k] = g;
      data[k + 1] = g;
      data[k + 2] = g;
      data[k + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}
