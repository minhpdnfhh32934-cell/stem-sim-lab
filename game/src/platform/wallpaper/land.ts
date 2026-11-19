import * as THREE from 'three';
import { CITY_REACH } from './site';

/*
 * The land round the small city (Phase W): flat where the city and our tower stand, then fields
 * rising into wooded hills, and mountains far off. The game never shows past its city (its haze),
 * so this is the wallpaper's own. Heights in the city's frame (y 0 the street); `landHeight` is
 * pure (tested), `landMesh` draws it on rings that widen with distance (fine near, coarse far).
 */

/** The flat ground's radius round the city's origin (m): its corners, our tower, a margin. */
export const FLAT_RADIUS = CITY_REACH * 1.45;
/** Where the land ends (m): past it, the haze. */
const OUTER = 16000;

/** A seeded hash of a lattice point: 0–1. */
function hash(i: number, j: number): number {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise (0–1). */
function noise(x: number, z: number): number {
  const i = Math.floor(x);
  const j = Math.floor(z);
  const fx = x - i;
  const fz = z - j;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const a = hash(i, j);
  const b = hash(i + 1, j);
  const c = hash(i, j + 1);
  const d = hash(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, z: number, octaves: number): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(x, z);
    norm += amp;
    x = x * 2.03 + 17.1;
    z = z * 2.03 - 9.7;
    amp *= 0.5;
  }
  return sum / norm;
}

const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/** How wooded the land is at a point (0–1): the woods' trees and their darker ground. */
export function woodsAt(x: number, z: number): number {
  return smooth((fbm(x / 420, z / 420, 3) - 0.48) * 6);
}

/** The land's height (m over the street) at a point of the city's frame. */
export function landHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  // The flat's edge wanders a little, as a town's edge does.
  const edge = FLAT_RADIUS + 120 * fbm(x / 600 + 3, z / 600 - 5, 2);
  const past = r - edge;
  if (past <= 0) return -0.5;
  const hills = smooth(past / 1500) * (25 + 190 * fbm(x / 1700, z / 1700, 5));
  const ridge = 1 - Math.abs(2 * fbm(x / 5200 + 11, z / 5200 + 4, 4) - 1);
  const mountains = smooth((past - 2600) / 4200) * 900 * ridge * ridge;
  return -0.5 + hills + mountains;
}

/**
 * Fields on the open, low land: plots of their own crop (a tint each), hedges between them, laid
 * on a grid turned off the city's. Worked out per pixel from the world position; `aField` says
 * how much of a point is field (none in the town, the woods or up the mountains).
 */
const FIELDS_VERTEX = /* glsl */ `
attribute float aField;
varying float vField;
varying vec2 vLandXZ;
`;
const FIELDS_FRAGMENT = /* glsl */ `
varying float vField;
varying vec2 vLandXZ;
float landHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.7); }
`;
const FIELDS_COLOUR = /* glsl */ `
vec2 q = mat2(0.94, -0.34, 0.34, 0.94) * vLandXZ;
vec2 size = vec2(110.0, 70.0);
// Rows of plots shifted along each other: no grid of crossing hedges.
float row = floor(q.y / size.y);
q.x += landHash(vec2(row, 7.0)) * size.x;
size.x *= 0.7 + 0.8 * landHash(vec2(row, 3.0));
vec2 cellF = q / size;
vec2 plot = floor(cellF);
vec2 inPlot = fract(cellF);
vec2 fwF = max(fwidth(cellF), vec2(1e-4));
float detailF = clamp(1.5 - max(fwF.x, fwF.y) * 6.0, 0.0, 1.0);
float h = landHash(plot);
vec3 crop = h < 0.3 ? vec3(0.62, 0.66, 0.36) : (h < 0.55 ? vec3(0.78, 0.7, 0.42) : (h < 0.8 ? vec3(0.5, 0.62, 0.32) : vec3(0.6, 0.5, 0.36)));
vec2 edge = smoothstep(vec2(0.0), 3.0 * fwF + 0.02, inPlot) * smoothstep(vec2(0.0), 3.0 * fwF + 0.02, 1.0 - inPlot);
float hedge = 1.0 - min(edge.x, edge.y);
vec3 fieldColour = mix(crop, vec3(0.32, 0.38, 0.22), hedge * 0.5);
diffuseColor.rgb *= mix(vec3(1.0), mix(vec3(1.0), fieldColour * 1.5, detailF * 0.6 + 0.15), vField);
`;

export function landMesh(): { mesh: THREE.Mesh; dispose(): void } {
  const rings = 170;
  const around = 360;
  const inner = 6;
  const positions = new Float32Array((rings + 1) * around * 3);
  const colors = new Float32Array((rings + 1) * around * 3);
  const field = new Float32Array((rings + 1) * around);
  const town = new THREE.Color('#57544f');
  const verge = new THREE.Color('#6b6d4c');
  const grass = new THREE.Color('#5d6b3c');
  const wood = new THREE.Color('#2c3b24');
  const dry = new THREE.Color('#857a5c');
  const rock = new THREE.Color('#7d7a74');
  const c = new THREE.Color();
  for (let i = 0; i <= rings; i++) {
    // Rings from the city's middle out to the edge, spaced ever wider.
    const r = inner * Math.pow(OUTER / inner, i / rings);
    for (let j = 0; j < around; j++) {
      const angle = (j / around) * Math.PI * 2;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = landHeight(x, z);
      const k = (i * around + j) * 3;
      positions[k] = x;
      positions[k + 1] = y;
      positions[k + 2] = z;
      const woods = woodsAt(x, z);
      // The town's ground under the streets and blocks, a verge round it, then the land.
      const out = smooth((Math.max(Math.abs(x), Math.abs(z)) - CITY_REACH) / 60);
      c.copy(town).lerp(verge, out);
      const open = smooth((r - FLAT_RADIUS + 80) / 160);
      c.lerp(grass, open).lerp(wood, woods * open);
      c.lerp(dry, smooth((y - 140) / 220) * 0.7);
      c.lerp(rock, smooth((y - 380) / 300));
      const grain = 0.9 + 0.2 * noise(x / 37, z / 37);
      colors[k] = c.r * grain;
      colors[k + 1] = c.g * grain;
      colors[k + 2] = c.b * grain;
      field[i * around + j] = open * (1 - woods) * (1 - smooth((y - 90) / 120));
    }
  }
  const index: number[] = [];
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < around; j++) {
      const p = i * around + j;
      const q = i * around + ((j + 1) % around);
      const d = (i + 1) * around + j;
      const e = (i + 1) * around + ((j + 1) % around);
      index.push(p, q, d, q, e, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aField', new THREE.BufferAttribute(field, 1));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97 });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
${FIELDS_VERTEX}`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vField = aField;
        vLandXZ = (modelMatrix * vec4(transformed, 1.0)).xz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
${FIELDS_FRAGMENT}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
${FIELDS_COLOUR}`,
      );
  };
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'wallpaper-land';
  mesh.receiveShadow = true;
  return {
    mesh,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
