import * as THREE from 'three';
import { markWind, VERTEX_HEAD } from '../../wallpaper/look';
import type { Actor } from './actor';

/**
 * Max (Phase Max): hair and clothes follow the body. The air a person moves through pushes their
 * loose hair and clothes back, eased so they lag a start and settle after a stop; standing, they
 * barely stir (indoors there is no wind). The wallpaper's motion (wallpaper/look.ts `windOffset`)
 * without its look: no rim of light, no ink or colour change — the game's own people, moving
 * like cloth and hair do. The outline moves with them, so the ink never lags.
 *
 * And their clothes' cloth (public/max/textures/fabric.png): a fine weave on shirts, jackets and
 * coats, a denim twill on blue trousers, as brightness only (the cloth keeps its colour and its
 * toon light), mapped on the body's bind pose so the weave moves with the cloth.
 *
 * A shader change only (no per-frame geometry work): the body's materials compile once more.
 * Off (another level), `uMotion` is 0: the body as drawn before, still and plain.
 */
export interface Motion {
  /** Each frame: the room's clock, and how fast (m/s) the body walks forward. */
  update(dt: number, time: number, speed: number): void;
  /** 1 under Max, 0 otherwise (eased). */
  setOn(on: boolean): void;
}

/** The air's push (m/s-ish) standing still: a breath of stirring, no more. */
const STILL_AIR = 0.12;
/** Seconds hair and cloth take to follow a change of pace (most of the way). */
const LAG_S = 0.35;

/** Surfaces that are cloth to the eye (fabric.png); trims and legwear keep their own look. */
const CLOTH = new Set(['top', 'outer', 'bottom', 'coat']);
/** Metres one fabric image covers (the weave's size), its brightness's mean, how much it shows. */
const FABRIC = {
  woven: { scale: 0.1, mean: 0.737, gain: 3.5, channel: 0 }, // R: Fabric082A's occlusion, faint
  denim: { scale: 0.12, mean: 0.408, gain: 1, channel: 1 }, // G: Fabric077's brightness
} as const;

const MOVE = /* glsl */ `
#include <skinning_vertex>
transformed += uMotion * windOffset(position, objectNormal);
`;

const FABRIC_VERTEX = /* glsl */ `
varying vec3 vFabPos;
varying vec3 vFabN;
`;
const FABRIC_HEAD = /* glsl */ `
varying vec3 vFabPos;
varying vec3 vFabN;
uniform sampler2D tFabric;
uniform float uMotion;
uniform vec4 uFabric; // scale, mean, gain, channel (0 R woven, 1 G denim)
`;
const FABRIC_COLOR = /* glsl */ `
{
  vec3 fw = pow( abs( normalize( vFabN ) ), vec3( 4.0 ) );
  fw /= fw.x + fw.y + fw.z;
  vec3 fp = vFabPos / uFabric.x;
  vec2 f = texture2D( tFabric, fp.zy ).rg * fw.x + texture2D( tFabric, fp.xz ).rg * fw.y
    + texture2D( tFabric, fp.xy ).rg * fw.z;
  float v = mix( f.r, f.g, uFabric.w );
  diffuseColor.rgb *= 1.0 + uMotion * clamp( ( v - uFabric.y ) * uFabric.z, -0.3, 0.3 );
}
`;

/** Blue trousers are denim: a blue hue, enough colour in it. */
function denim(color: THREE.Color): boolean {
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  return hsl.h > 0.53 && hsl.h < 0.72 && hsl.s > 0.15;
}

export function secondaryMotion(actor: Actor, fabric: THREE.Texture | null): Motion {
  markWind(actor);
  const model = actor.model;
  const uniforms = {
    uWind: { value: new THREE.Vector3(0, 0, STILL_AIR) },
    uGust: { value: 0 },
    uTime: { value: 0 },
    uMotion: { value: 1 },
    // The head's middle in the bind pose: its bone at the skull's base, the middle 0.1 m up.
    uHead: {
      value: model.bones.head
        .getWorldPosition(new THREE.Vector3())
        .sub(actor.group.position)
        .add(new THREE.Vector3(0, 0.1 * (actor.character.appearance.heightM / 1.75), 0)),
    },
  };
  const outlines = model.outlines ? [model.outlines.body, model.outlines.coat] : [];
  const done = new Set<THREE.Material>();
  for (const mesh of [...model.meshes, ...outlines]) {
    const material = mesh.material as THREE.Material;
    if (done.has(material)) continue;
    done.add(material);
    const surface = mesh.userData.surface as string | undefined;
    const color = (material as Partial<THREE.MeshToonMaterial>).color;
    const cloth = fabric !== null && color !== undefined && CLOTH.has(surface ?? '');
    const kind = cloth && surface === 'bottom' && denim(color) ? FABRIC.denim : FABRIC.woven;
    const own = {
      tFabric: { value: fabric },
      uFabric: { value: new THREE.Vector4(kind.scale, kind.mean, kind.gain, kind.channel) },
    };
    const before = material.onBeforeCompile.bind(material);
    material.onBeforeCompile = (shader, renderer) => {
      before(shader, renderer);
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\nuniform float uMotion;\n${VERTEX_HEAD}`)
        .replace('#include <skinning_vertex>', MOVE);
      if (!cloth) return;
      Object.assign(shader.uniforms, own);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${FABRIC_VERTEX}`)
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvFabPos = position;\nvFabN = normal;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${FABRIC_HEAD}`)
        .replace('#include <map_fragment>', `#include <map_fragment>\n${FABRIC_COLOR}`);
    };
    const cacheKey = material.customProgramCacheKey.bind(material);
    material.customProgramCacheKey = () => `${cacheKey()}|max-motion${cloth ? '|fabric' : ''}`;
    material.needsUpdate = true;
  }
  let on = 1;
  return {
    setOn(value) {
      on = value ? 1 : 0;
    },
    update(dt, time, speed) {
      uniforms.uTime.value = time;
      const k = dt > 0 ? 1 - Math.exp(-dt / LAG_S) : 1;
      // The body faces −z: walking forward, the air comes from the front (+z back along it).
      const wind = uniforms.uWind.value;
      wind.z += (STILL_AIR + speed - wind.z) * k;
      uniforms.uGust.value += (Math.min(1, speed / 3) - uniforms.uGust.value) * k;
      uniforms.uMotion.value += (on - uniforms.uMotion.value) * k;
    },
  };
}

let fabricShared: THREE.Texture | null = null;

/**
 * Max's cloth (public/max/textures/fabric.png), loaded the first time a body asks and shared by
 * every body after it: one upload, not one per person. None outside a browser (tests).
 * shortcut: a module-level asset cache, never freed; move it to the renderer if Max's assets grow.
 */
export function fabricTexture(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  if (!fabricShared) {
    const t = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}max/textures/fabric.png`);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.NoColorSpace;
    fabricShared = t;
  }
  return fabricShared;
}
