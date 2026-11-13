import * as THREE from 'three';
import type { MATERIALS } from '../../gameplay/item';

type Material = (typeof MATERIALS)[number];

/**
 * Material names the renderer's per-preset pass reads (finishes.ts, render-quality audit §5.2):
 * glassware gets a filter and a sheen pass on High (quality.ts `sheen`), metal and sheen the room's reflection
 * on High. A name, not a content id: render code tags its own materials with it.
 */
export const GLASSWARE = 'glassware';
export const METAL = 'metal';
export const SHEEN = 'sheen';

/**
 * How each kind of surface answers light — the items' `visual.material` and the apparatus parts
 * drawn by ExperimentView share these, each with its own colour. Each has a reason: painted walls
 * and rubber stay matte, plastic is semi-matte, bare steel shines without turning to chrome.
 * Below the High graphics quality there is no environment map (its software-WebGL cost, see
 * render/quality.ts), so a metal lit only by lights renders dark where no highlight falls: metals
 * stay half metallic, in light tones (bare steel), so they read as metal and not as black.
 * matte is the look every item had before material presets existed.
 */
export const LOOKS: Record<Material, THREE.MeshStandardMaterialParameters> = {
  matte: { roughness: 0.6, metalness: 0 },
  satin: { roughness: 0.32, metalness: 0.05 },
  // High with its reflection: fully metallic (finishes.ts); 0.5 wherever there is none.
  metal: { roughness: 0.3, metalness: 0.5, name: METAL },
  glass: { roughness: 0.05, metalness: 0, transparent: true, opacity: 0.35 },
  light: { roughness: 0.5, metalness: 0 },
  painted: { roughness: 0.55, metalness: 0.12 },
  plastic: { roughness: 0.42, metalness: 0 },
  rubber: { roughness: 0.9, metalness: 0 },
};

/**
 * Clear lab glassware (vessels, tubes, slides): the `glass` look, tagged so the renderer draws it
 * as a near-clear filter plus a sheen pass where the preset has `sheen` (audit F4). Never for the other
 * see-through finishes (a mirror, an emblem's glow, amber reagent, specimen fluid, liquids, a
 * refracting block): they keep their paint (quality.test.ts lists which are glassware).
 */
export const GLASSWARE_LOOK: THREE.MeshStandardMaterialParameters = {
  ...LOOKS.glass,
  name: GLASSWARE,
};

/**
 * How much more of what is behind a liquid's edge its filter takes, seen edge-on (a look value): a
 * real liquid bends the light from its edge away, so even clear water shows a darker rim on a light
 * background. Never coloured: the colour stays the model's (`transmit`).
 */
export const LIQUID_EDGE = 0.72;
/**
 * The liquid's Fresnel reflection of the room, seen edge-on (a look value, every preset): its share
 * of the room's diffuse light at a grazing view, falling as (1 − |n·v|)² to nothing face-on. On a
 * dark background the edge of clear water shows as this light line; it follows the room's lights.
 */
export const LIQUID_RIM = 0.6;
/**
 * The room's light a liquid bends to the eye from elsewhere (a look value, every preset): a filled
 * vessel is a lens, so against a dark background it still shows the lit room through it, coloured
 * by what it passes through (the filter's colour, both faces). Its share of the diffuse light.
 */
export const LIQUID_FILL = 0.12;

/** The view-space normal and direction to the eye the filter's edge is found from. */
const LIQUID_VARYINGS = 'varying vec3 vLiquidN;\nvarying vec3 vLiquidV;\nvoid main() {';

/** The filter's darker edge: the factor taken towards LIQUID_EDGE as the view grazes the surface. */
function edged(shader: THREE.WebGLProgramParametersWithUniforms): void {
  shader.vertexShader = shader.vertexShader.replace('void main() {', LIQUID_VARYINGS).replace(
    '#include <project_vertex>',
    `#include <project_vertex>
       vLiquidN = normalize( normalMatrix * normal );
       vLiquidV = -mvPosition.xyz;`,
  );
  shader.fragmentShader = shader.fragmentShader.replace('void main() {', LIQUID_VARYINGS).replace(
    '#include <opaque_fragment>',
    `#include <opaque_fragment>
       float liquidGraze = 1.0 - abs( dot( normalize( vLiquidN ), normalize( vLiquidV ) ) );
       gl_FragColor.rgb *= mix( 1.0, ${LIQUID_EDGE.toFixed(3)}, liquidGraze * liquidGraze );`,
  );
}

/**
 * The lit colour kept as the light bent through the liquid (tinted by `tint`, the filter's colour
 * per face) plus its reflection towards the grazing edge.
 */
function rimmed(tint: THREE.Color) {
  return (shader: THREE.WebGLProgramParametersWithUniforms): void => {
    shader.uniforms.liquidTint = { value: tint };
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform vec3 liquidTint;\nvoid main() {')
      .replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>
         float liquidGraze = 1.0 - abs( dot( normalize( normal ), normalize( vViewPosition ) ) );
         gl_FragColor.rgb *= ${LIQUID_FILL.toFixed(3)} * liquidTint * liquidTint
           + ${LIQUID_RIM.toFixed(3)} * liquidGraze * liquidGraze;`,
      );
  };
}

/**
 * The liquid look of a container (audit F13), as the titration flask's solution is drawn: a filter
 * (whatever is behind it times its colour, premultiplied multiply, a little more at its edge), the
 * edge's reflection of the room (`rim`: lit, additive, every preset, so clear liquid still shows on
 * a dark background) and the surface's reflection alone (black, additive), the sheen shown where the
 * preset has `sheen` (finishes.ts). The container view sets the filter's colour only from the
 * model's state (`transmit`) and its level only from the container's volume; nothing here animates.
 */
export function liquidLook(): {
  filter: THREE.MeshBasicMaterial;
  rim: THREE.MeshStandardMaterial;
  sheen: THREE.MeshStandardMaterial;
} {
  const filter = new THREE.MeshBasicMaterial({
    transparent: true,
    blending: THREE.MultiplyBlending,
    premultipliedAlpha: true,
    toneMapped: false,
    depthWrite: false,
  });
  filter.onBeforeCompile = edged;
  filter.customProgramCacheKey = () => 'liquid-filter';
  const rim = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1, // the room's diffuse light: no highlight of its own (the sheen has those)
    metalness: 0,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  rim.onBeforeCompile = rimmed(filter.color); // the same colour object: it follows `transmit`
  rim.customProgramCacheKey = () => 'liquid-rim';
  return {
    filter,
    rim,
    sheen: new THREE.MeshStandardMaterial({
      name: SHEEN,
      color: 0x000000,
      roughness: 0.08,
      metalness: 0,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  };
}

/**
 * The filter's colour from a transmittance (linear, 0–1 per channel, as the model reports it):
 * the light behind is multiplied by it. Pure: the same state gives the same colour.
 */
export function transmit(
  filter: THREE.MeshBasicMaterial,
  r: number,
  g: number,
  b: number,
): THREE.MeshBasicMaterial {
  filter.color.setRGB(r, g, b, THREE.LinearSRGBColorSpace);
  return filter;
}
