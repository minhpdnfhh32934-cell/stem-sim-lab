import * as THREE from 'three';
import { TOWER } from './site';

/*
 * Our tower's glass curtain wall (Phase W): floors and mullions worked out per pixel from where a
 * point is, each pane its own (blinds drawn on some, lit by night). Fades to its average where a
 * pane is smaller than a pixel or two, so it never shimmers far below. Drawn in two pieces — its
 * top in the near pass, the rest in the far pass (`Wallpaper.ts`) — with one material.
 */

const VERTEX = /* glsl */ `
varying vec3 vTowerPos;
varying vec3 vTowerNormal;
`;
const FRAGMENT = /* glsl */ `
uniform float uNight;
uniform float uTime;
uniform float uGround;
varying vec3 vTowerPos;
varying vec3 vTowerNormal;
float towerHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
`;
const COLOUR = /* glsl */ `
vec3 tn = normalize(vTowerNormal);
float along = abs(tn.x) > abs(tn.z) ? vTowerPos.z : vTowerPos.x;
float up = vTowerPos.y - uGround;
vec2 cell = vec2(along / 1.6, up / 3.9);
vec2 f = fract(cell);
vec2 id = floor(cell);
vec2 fw = max(fwidth(cell), vec2(1e-4));
float detail = clamp(1.6 - max(fw.x, fw.y) * 2.2, 0.0, 1.0);
float wx = smoothstep(0.04 - fw.x, 0.04 + fw.x, f.x) * (1.0 - smoothstep(0.96 - fw.x, 0.96 + fw.x, f.x));
float wy = smoothstep(0.12 - fw.y, 0.12 + fw.y, f.y) * (1.0 - smoothstep(0.97 - fw.y, 0.97 + fw.y, f.y));
float win = mix(0.8, wx * wy, detail);
float own = towerHash(id);
float blinds = step(0.78, own) * detail;
vec3 glass = mix(vec3(0.06, 0.09, 0.12), vec3(0.52, 0.5, 0.47), blinds * 0.55);
diffuseColor.rgb = mix(vec3(0.15, 0.16, 0.18), glass, win);
`;
const ROUGHNESS = /* glsl */ `
roughnessFactor = mix(0.35, 0.04 + 0.3 * blinds, win);
`;
const METALNESS = /* glsl */ `
metalnessFactor = mix(0.6, 0.75 - 0.5 * blinds, win);
`;
const EMISSIVE = /* glsl */ `
float lit = step(0.6, towerHash(id * 1.7 + 0.37)) * (1.0 - step(0.985, towerHash(id + floor(uTime / 23.0 + own * 9.0))));
totalEmissiveRadiance += vec3(1.0, 0.78, 0.5) * (mix(0.4, lit, detail) * win * uNight * 2.0);
`;

export interface TowerFacade {
  /** A piece of the tower's walls from `y0` to `y1` (m, the roof's frame). */
  piece(y0: number, y1: number): THREE.Mesh;
  setNight(night: number): void;
  setTime(seconds: number): void;
  dispose(): void;
}

export function towerFacade(ground: number): TowerFacade {
  const uniforms = { uNight: { value: 0 }, uTime: { value: 0 }, uGround: { value: ground } };
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff' });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX}`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vTowerPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vTowerNormal = mat3(modelMatrix) * objectNormal;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${COLOUR}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${ROUGHNESS}`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n${METALNESS}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${EMISSIVE}`);
  };
  const geometries: THREE.BufferGeometry[] = [];
  return {
    piece(y0, y1) {
      const geometry = new THREE.BoxGeometry(TOWER.x1 - TOWER.x0, y1 - y0, TOWER.z1 - TOWER.z0);
      geometries.push(geometry);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set((TOWER.x0 + TOWER.x1) / 2, (y0 + y1) / 2, (TOWER.z0 + TOWER.z1) / 2);
      mesh.receiveShadow = true;
      return mesh;
    },
    setNight: (night) => void (uniforms.uNight.value = night),
    setTime: (seconds) => void (uniforms.uTime.value = seconds),
    dispose: () => {
      for (const g of geometries) g.dispose();
      material.dispose();
    },
  };
}
