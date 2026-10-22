/**
 * Surface shading for standard/physical materials (illustration, no extra draw call).
 *
 * Procedural surface relief: fine bumps from a small 3D value
 * noise, evaluated in the fragment shader and turned into a perturbed normal (the same screen-
 * space method as three.js bump maps). No texture, no UVs and no extra vertex or draw call, so it
 * suits generated tubes and blobs, and the light catches the surface instead of a smooth plastic
 * shell. Illustration only — the bumps are random and say nothing about real structure.
 *
 * The noise is sampled at a stable coordinate: the object-space position by default (instances
 * keep theirs), or a vertex attribute the geometry provides (e.g. a tube that rewrites its
 * vertices as it moves gives each vertex a fixed coordinate on its surface, so the bumps stay
 * on it).
 */
import type * as THREE from 'three';

export interface ReliefOptions {
  /** Bumps per world unit (noise frequency in the sampled coordinate). */
  frequency: number;
  /** Height of the bumps in world units. */
  height: number;
  /** A vec3 vertex attribute with a stable surface coordinate (default: the position). */
  attribute?: string;
}

/** GLSL: hashed value noise, one octave (values 0…1; cheap enough for software rendering). */
const NOISE = /* glsl */ `
float simlabReliefHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float simlabReliefNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(simlabReliefHash(i), simlabReliefHash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(simlabReliefHash(i + vec3(0.0, 1.0, 0.0)), simlabReliefHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(simlabReliefHash(i + vec3(0.0, 0.0, 1.0)), simlabReliefHash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(simlabReliefHash(i + vec3(0.0, 1.0, 1.0)), simlabReliefHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}
float simlabRelief(vec3 p) {
  return simlabReliefNoise(p);
}`;

/** GLSL: the bump, as three.js's perturbNormalArb with a procedural height. */
const PERTURB = /* glsl */ `
{
  float reliefH = simlabRelief(vSimlabRelief * uReliefFrequency) * uReliefHeight;
  vec2 reliefD = vec2(dFdx(reliefH), dFdy(reliefH));
  vec3 reliefSx = dFdx(-vViewPosition);
  vec3 reliefSy = dFdy(-vViewPosition);
  vec3 reliefR1 = cross(reliefSy, normal);
  vec3 reliefR2 = cross(normal, reliefSx);
  float reliefDet = dot(reliefSx, reliefR1) * faceDirection;
  vec3 reliefGrad = sign(reliefDet) * (reliefD.x * reliefR1 + reliefD.y * reliefR2);
  normal = normalize(abs(reliefDet) * normal - reliefGrad);
}`;

/** Uniforms of a material's relief (`material.userData.relief`). */
export interface ReliefUniforms {
  uReliefFrequency: { value: number };
  uReliefHeight: { value: number };
}

/**
 * Adds procedural relief to `material` (chains with an earlier `onBeforeCompile`, e.g. a rim, and
 * with a later one, e.g. a tint). Runs in the material's own shader; jsdom never compiles it.
 */
export function withRelief<M extends THREE.MeshStandardMaterial>(material: M, o: ReliefOptions): M {
  const uniforms: ReliefUniforms = {
    uReliefFrequency: { value: o.frequency },
    uReliefHeight: { value: o.height },
  };
  const attribute = o.attribute ?? 'position';
  material.userData.relief = uniforms;
  const previous = material.onBeforeCompile.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    const declare = attribute === 'position' ? '' : `attribute vec3 ${attribute};\n`;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `${declare}varying vec3 vSimlabRelief;\nvoid main() {`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvSimlabRelief = ${attribute};`);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        `uniform float uReliefFrequency;\nuniform float uReliefHeight;\nvarying vec3 vSimlabRelief;\n${NOISE}\nvoid main() {`,
      )
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${PERTURB}`);
  };
  const key = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${key()}|simlab-relief-${attribute}`;
  return material;
}

export interface EdgeShadeOptions {
  /** How much the silhouette darkens (0…1; the theme's --m3d-edge-shade). */
  strength: number;
  /** Sharpness: higher = a thinner dark edge. */
  power?: number;
}

/**
 * Darkens a solid towards its silhouette (the soft outline of scientific illustration): a pale
 * blob reads as a volume against a pale backdrop without a drawn outline or an extra pass.
 * Lighting only — the albedo (a data colour) is unchanged where the surface faces the viewer.
 */
export function withEdgeShade<M extends THREE.MeshStandardMaterial>(
  material: M,
  o: EdgeShadeOptions,
): M {
  const uniforms = {
    uEdgeShade: { value: Math.min(1, Math.max(0, o.strength)) },
    uEdgePower: { value: o.power ?? 2.4 },
  };
  material.userData.edgeShade = uniforms;
  const previous = material.onBeforeCompile.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        'uniform float uEdgeShade;\nuniform float uEdgePower;\nvoid main() {',
      )
      .replace(
        '#include <opaque_fragment>',
        [
          'float edgeF = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), uEdgePower);',
          'outgoingLight *= 1.0 - uEdgeShade * edgeF;',
          '#include <opaque_fragment>',
        ].join('\n'),
      );
  };
  const key = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${key()}|simlab-edge`;
  return material;
}

/**
 * Darkens the albedo by a per-vertex factor (a float attribute, 1 = unshaded): baked occlusion,
 * e.g. where two touching parts face each other. The colour attribute (data colours) stays exact;
 * only the lit result is darker. Lighting only, no draw call.
 */
export function withVertexShade<M extends THREE.MeshStandardMaterial>(
  material: M,
  attribute: string,
): M {
  const previous = material.onBeforeCompile.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace(
        'void main() {',
        `attribute float ${attribute};\nvarying float vSimlabShade;\nvoid main() {`,
      )
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvSimlabShade = ${attribute};`);
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'varying float vSimlabShade;\nvoid main() {')
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\ndiffuseColor.rgb *= vSimlabShade;',
      );
  };
  const key = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${key()}|simlab-shade-${attribute}`;
  return material;
}
