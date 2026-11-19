import * as THREE from 'three';
import type { Actor } from '../render/body/actor';
import { DRAPE_N, type DrapeUniforms } from './drape';
import { PRESS_N, PRESS_SOFT, type PressUniforms } from './press';

/*
 * The wallpaper's people, raised past the game's look (Phase W-4, Phú: "nâng cấp tối đa"): every
 * toon material of an actor gets a rim of light on the side towards the sun (the sun's colour by
 * day, the city's neon by night), its hair sways in the wind and its clothes ripple — the same
 * motion in the outline, so the ink never lags the hair. Which vertices are hair or cloth is
 * found once, by position, in the outline's merged geometry (`aWind`: x hair, y cloth). Uniforms
 * are the actor's own; `update` feeds them each frame.
 */

export interface LookUniforms {
  /** The light's direction in view space (towards it). */
  readonly uSunView: { value: THREE.Vector3 };
  readonly uRimColor: { value: THREE.Color };
  readonly uRim: { value: number };
  /** The wind in the actor's own frame (m/s-ish strength in its length). */
  readonly uWind: { value: THREE.Vector3 };
  readonly uGust: { value: number };
  readonly uTime: { value: number };
  /** The head's middle in the bind pose (the actor's frame): hair farther from it sways more. */
  readonly uHead: { value: THREE.Vector3 };
}

/** The wind's attribute, uniforms and `windOffset` (also the game's Max motion: render/body/motion.ts). */
export const VERTEX_HEAD = /* glsl */ `
attribute vec2 aWind;
uniform vec3 uWind;
uniform float uGust;
uniform float uTime;
uniform vec3 uHead;
vec3 windOffset(vec3 bind, vec3 n) {
  float phase = dot(bind, vec3(9.0, 13.0, 7.0));
  // The scalp's own hair (within ~13 cm of the head's middle) stays put: moved, it bared the
  // scalp (Phú: "bị hói"); locks and the ponytail past it sway.
  float reach = smoothstep(0.14, 0.32, distance(bind, uHead));
  float sway = 0.55 + 0.45 * sin(uTime * 2.3 + phase) + 0.25 * sin(uTime * 5.1 + phase * 1.7);
  vec3 hair = uWind * (0.03 * reach * sway * (0.5 + uGust));
  hair.y -= 0.004 * reach * sway;
  float ripple = sin(uTime * 7.0 + dot(bind, vec3(23.0, 17.0, 29.0))) * (0.3 + uGust);
  vec3 cloth = n * (0.0035 * ripple) + uWind * (0.004 * (0.5 + 0.5 * ripple));
  return hair * aWind.x + cloth * aWind.y;
}
`;
// The bust giving way (press.ts): each vertex of it pushed back out of the capsules pressing on
// it — along the way out of each, by a smooth curve (exp) that keeps layers in their order and
// eases in from PRESS_SOFT out — weighed by how much of the bust it is (by its bind position,
// front only), never more than the bust's depth. The lit surface turns with it.
const VERTEX_PRESS_HEAD = /* glsl */ `
uniform vec4 uPressA[${PRESS_N}];
uniform vec4 uPressB[${PRESS_N}];
uniform vec4 uBust[2];
uniform float uBustDepth;
vec3 pressTurn;
float pressBy;
vec3 pressed(vec3 p, vec3 bind) {
  pressTurn = vec3(0.0);
  pressBy = 0.0;
  float m = 0.0;
  for (int i = 0; i < 2; i++) {
    float inside = 1.0 - smoothstep(0.55, 1.0, distance(bind, uBust[i].xyz) / uBust[i].w);
    m = max(m, inside * smoothstep(-0.01, 0.03, uBust[i].z - bind.z));
  }
  if (m <= 0.0) return p;
  const float K = ${PRESS_SOFT.toFixed(4)};
  for (int i = 0; i < ${PRESS_N}; i++) {
    float r = uPressA[i].w;
    if (r <= 0.0) continue;
    vec3 a = uPressA[i].xyz;
    vec3 ab = uPressB[i].xyz - a;
    float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-8), 0.0, 1.0);
    vec3 radial = p - (a + ab * t);
    float d = length(radial);
    float x = d - r;
    if (x >= K) continue;
    float push = m * min(K * exp((x - K) / K) - x, uBustDepth);
    vec3 out1 = radial / max(d, 1e-5);
    p += out1 * push;
    pressTurn -= out1 * push;
    pressBy += push;
  }
  return p;
}
`;
/**
 * Long hair in waves (after Phú's reference): below the scalp, each lock pushed in and out from
 * the head's axis along its fall, the waves turning a little round the head; up to 1.6 cm.
 */
const VERTEX_WAVE_HEAD = /* glsl */ `
vec3 hairWave(vec3 bind) {
  vec2 r = bind.xz - uHead.xz;
  float len = length(r);
  float down = uHead.y - bind.y;
  float k = smoothstep(0.06, 0.2, down) * step(1e-4, len);
  float a = atan(r.x, r.y);
  // Outward only (pressed in, the curtain went under the scalp beneath it and that showed).
  float w = 0.016 * k * (0.5 + 0.5 * sin(down * 34.0 + a * 2.0));
  vec2 out2 = r / max(len, 1e-4) * w;
  return vec3(out2.x, 0.0, out2.y);
}
`;
/**
 * Strands drawn in the hair (after Phú's reference): fine darker lines falling from the crown,
 * ~56 round the head, each a little off its place and of its own weight, bending with the waves;
 * thinned out at the crown where they meet; anti-aliased by their own rate of change.
 */
const FRAGMENT_STRANDS_HEAD = /* glsl */ `
varying vec3 vHairBind;
uniform vec3 uHead;
float hairStrands(vec3 bind) {
  vec2 r = bind.xz - uHead.xz;
  float down = uHead.y - bind.y;
  float a = atan(r.x, r.y);
  float u = a * 9.0 + 0.25 * sin(down * 34.0 + a * 2.0);
  float id = floor(u);
  float h = fract(sin(id * 12.9898) * 43758.5453);
  float d = abs(fract(u) - 0.5 - 0.3 * (h - 0.5));
  float w = 0.05 + 0.05 * h;
  float aa = fwidth(u) + 1e-4;
  float line = 1.0 - smoothstep(w - aa, w + aa, d);
  line *= smoothstep(0.02, 0.06, length(r)) * step(0.25, h);
  // The waves shaded too, lighter on their crests (seen from behind they read only so).
  float crest = 0.5 + 0.5 * sin(down * 34.0 + a * 2.0);
  float wave = mix(1.0, 0.86 + 0.18 * crest, smoothstep(0.06, 0.2, down));
  return (1.0 - 0.42 * line) * wave;
}
`;
/** The ink's colour: near black, a touch warm. */
const INK_COLOUR = '#120e10';
/** The ink line's pressure along the body (0.65–1.35 of its width), slow over a hand's length. */
const VERTEX_INK_HEAD = /* glsl */ `
#define INK
float inkScale = 1.0;
float inkVary(vec3 p) {
  float n = 0.5 * sin(dot(p, vec3(13.1, 17.3, 11.7)))
    + 0.3 * sin(dot(p, vec3(-23.7, 9.1, 19.3)) + 1.7)
    + 0.2 * sin(dot(p, vec3(7.3, -29.1, 5.9)) + 4.1);
  return 1.0 + 0.35 * n;
}
`;
// Long hair hanging (drape.ts): below the scalp turned back from the head's tilt (more the lower),
// then pushed out of the bodies it lies on, by the same soft curve as the bust.
const VERTEX_DRAPE_HEAD = /* glsl */ `
uniform vec4 uDrapeA[${DRAPE_N}];
uniform vec4 uDrapeB[${DRAPE_N}];
uniform mat3 uDrapeTurn;
uniform vec3 uDrapeHead;
vec3 drapeOut;
float drapeBy;
vec3 draped(vec3 p, vec3 bind) {
  drapeOut = vec3(0.0);
  drapeBy = 0.0;
  float k = smoothstep(0.04, 0.24, uHead.y - bind.y);
  vec3 off = p - uDrapeHead;
  // (Two thirds of the way to hanging: all the way, with her head on his shoulder, the hair
  // fell from the raised side of her head onto her shoulder and spread there like a cape.)
  p = uDrapeHead + mix(off, uDrapeTurn * off, k * 0.65);
  const float K = 0.02;
  for (int i = 0; i < ${DRAPE_N}; i++) {
    float r = uDrapeA[i].w;
    if (r <= 0.0) continue;
    vec3 a = uDrapeA[i].xyz;
    vec3 ab = uDrapeB[i].xyz - a;
    float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-8), 0.0, 1.0);
    vec3 radial = p - (a + ab * t);
    float d = length(radial);
    float x = d - r - 0.012;
    if (x >= K) continue;
    float push = (K * exp((x - K) / K) - x) * k;
    p += radial / max(d, 1e-5) * push;
    drapeOut += radial / max(d, 1e-5) * push;
    drapeBy += push;
  }
  return p;
}
`;
const VERTEX_MOVE = /* glsl */ `
#include <skinning_vertex>
transformed += windOffset(position, objectNormal);
#ifdef DRAPE
if (aWind.x > 0.0) {
  transformed = draped(transformed, position);
  // Its normal turned with it: the ink swells along it, the light falls by it.
  float hang = smoothstep(0.04, 0.24, uHead.y - position.y);
  objectNormal = normalize(mix(objectNormal, uDrapeTurn * objectNormal, hang * 0.65));
#ifdef INK
  // Where it lies on something it is not inked (its ink, swelling into what it lies on, showed
  // through it in shards).
  inkScale = 1.0 - clamp(drapeBy / 0.006, 0.0, 1.0);
#endif
#if defined(DRAPE_NORMAL) && !defined(FLAT_SHADED)
  vNormal = normalize(normalMatrix * objectNormal);
#endif
}
#endif
#ifdef PRESS
transformed = pressed(transformed, position);
#if defined(PRESS_NORMAL) && !defined(FLAT_SHADED)
if (pressBy > 0.0) {
  vNormal = normalize(mix(vNormal, normalize(normalMatrix * pressTurn), clamp(pressBy / 0.02, 0.0, 1.0) * 0.8));
}
#endif
#endif
`;
const FRAGMENT_HEAD = /* glsl */ `
uniform vec3 uSunView;
uniform vec3 uRimColor;
uniform float uRim;
`;
const FRAGMENT_NEON_HEAD = /* glsl */ `
varying vec3 vBind;
uniform vec3 uNeonColor;
uniform float uTime;
uniform vec3 uArmJ[6];
// x hem, y shoulders, z boots' tops (or < 0), w sleeves (1) or not (0)
uniform vec4 uNeonAt;
float neonLine(float d, float w) {
  float f = fwidth(d) + 1e-5;
  return 1.0 - smoothstep(w - f, w + f, abs(d));
}
// Distance from a segment (x) and the place along it (y, 0-1); radial: from the axis out.
vec2 neonSeg(vec3 p, vec3 a, vec3 b, out vec3 radial) {
  vec3 ab = b - a;
  float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
  radial = p - (a + ab * t);
  return vec2(length(radial), t);
}
float neonMask(vec3 p) {
  float m = 0.0;
  bool sleeve = false;
  for (int i = 0; i < 2; i++) {
    vec3 s = uArmJ[i * 3];
    vec3 e = uArmJ[i * 3 + 1];
    vec3 w = uArmJ[i * 3 + 2];
    vec3 ru;
    vec3 rl;
    vec2 up = neonSeg(p, s, e, ru);
    vec2 lo = neonSeg(p, e, w, rl);
    if (min(up.x, lo.x) > 0.085) continue;
    sleeve = true;
    bool lower = lo.x < up.x;
    vec3 r = lower ? rl : ru;
    float dist = lower ? lo.x : up.x;
    // A stripe down the back of the sleeve, a little to the outside; a ring above the cuff.
    vec3 aim = normalize(vec3(sign(s.x) * 0.55, 0.0, 0.83));
    float c = dot(normalize(r), aim);
    float along = lower ? 1.0 + lo.y : up.y;
    if (uNeonAt.w > 0.5 && along > 0.08 && along < 1.8) {
      m += neonLine(acos(clamp(c, -1.0, 1.0)) * dist, 0.0042);
    }
    if (lower) m += neonLine((lo.y - 0.82) * distance(e, w), 0.0035);
  }
  if (!sleeve && p.y > uNeonAt.x - 0.01 && p.y < uNeonAt.y + 0.05) {
    // The back: a seam up the middle that forks to the shoulders (a Y), and a ring at the hem.
    if (p.z > 0.0) {
      float fork = uNeonAt.y - 0.2;
      if (p.y < fork) m += neonLine(p.x, 0.0035);
      else if (p.y < uNeonAt.y - 0.03) m += neonLine(abs(p.x) - (p.y - fork) * 0.55, 0.0038);
    }
    m += neonLine(p.y - (uNeonAt.x + 0.012), 0.0035);
  }
  if (uNeonAt.z > 0.0 && p.y > 0.3) m += neonLine(p.y - uNeonAt.z, 0.004);
  // A light that runs along the lines now and then (up the body), on a steady glow.
  float run = pow(0.5 + 0.5 * sin(uTime * 1.7 - p.y * 7.0), 10.0);
  return min(m, 1.0) * (0.85 + 0.9 * run);
}
`;
const FRAGMENT_RIM = /* glsl */ `
#include <emissivemap_fragment>
#ifdef NEON
totalEmissiveRadiance += uNeonColor * (2.6 * neonMask(vBind));
#endif
{
  vec3 nn = normalize(normal);
  float facing = clamp(dot(nn, normalize(vViewPosition)), 0.0, 1.0);
  float towards = clamp(dot(nn, uSunView) * 0.6 + 0.4, 0.0, 1.0);
  totalEmissiveRadiance += uRimColor * (pow(1.0 - facing, 5.0) * towards * towards * uRim * RIM_SCALE);
}
`;

/**
 * The night clothes' neon (Phú: cyberpunk, glowing): lines drawn on the jacket and the boots'
 * tops by where they are on the body in its bind pose, so they read from behind too (the
 * wallpaper sees the two from behind; the game's own trims run down the front and the sides).
 */
export interface Neon {
  readonly color: THREE.ColorRepresentation;
  /** A stripe down the back of each sleeve (for a jacket without stripes of its own). */
  readonly sleeves: boolean;
}

/** Surfaces the neon is drawn on. */
const NEON_ON = new Set(['outer', 'shoes']);

/** Surfaces that move as cloth in the wind (not skin, hair or shoes). */
const CLOTH = new Set(['top', 'outer', 'outerTrim', 'bottom', 'coat', 'coatTrim']);

const key = (x: number, y: number, z: number) =>
  `${Math.round(x * 2000)},${Math.round(y * 2000)},${Math.round(z * 2000)}`;

/**
 * Marks which vertices are hair (`aWind` x) and which cloth (y): in their own meshes, then found
 * by bind position in the outline's and shadow's merged geometry. Once per body (the attribute's
 * presence says it is done).
 */
export function markWind(actor: Actor): void {
  const model = actor.model;
  if (model.meshes.some((m) => m.geometry.hasAttribute('aWind'))) return;
  const hair = new Set<string>();
  const cloth = new Set<string>();
  for (const mesh of model.meshes) {
    const surface = mesh.userData.surface as string;
    const set = surface === 'hair' ? hair : CLOTH.has(surface) ? cloth : null;
    const p = mesh.geometry.getAttribute('position');
    const w = new Float32Array(p.count * 2);
    if (set) {
      for (let i = 0; i < p.count; i++) set.add(key(p.getX(i), p.getY(i), p.getZ(i)));
      w.fill(0);
      for (let i = 0; i < p.count; i++) w[i * 2 + (set === hair ? 0 : 1)] = 1;
    }
    mesh.geometry.setAttribute('aWind', new THREE.BufferAttribute(w, 2));
  }
  const outlines = model.outlines ? [model.outlines.body, model.outlines.coat] : [];
  for (const mesh of [...outlines, model.shadows.body, model.shadows.coat]) {
    const geometry = mesh.geometry;
    if (geometry.hasAttribute('aWind')) continue; // shared with its shadow
    const p = geometry.getAttribute('position');
    const w = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      const k = key(p.getX(i), p.getY(i), p.getZ(i));
      if (hair.has(k)) w[i * 2] = 1;
      else if (cloth.has(k)) w[i * 2 + 1] = 1;
    }
    geometry.setAttribute('aWind', new THREE.BufferAttribute(w, 2));
  }
}

export function dressUp(
  actor: Actor,
  neon?: Neon,
  press?: PressUniforms,
  /** Long hair: waved, drawn in strands and hanging (Linh, after Phú's reference; `drape.ts`). */
  longHair?: DrapeUniforms,
): {
  uniforms: LookUniforms;
  update(dt: number, time: number): void;
} {
  const model = actor.model;
  const strands = longHair !== undefined;
  const uniforms: LookUniforms = {
    uSunView: { value: new THREE.Vector3(0, 1, 0) },
    uRimColor: { value: new THREE.Color('#ffd9a8') },
    uRim: { value: 0.6 },
    uWind: { value: new THREE.Vector3(1, 0, 0) },
    uGust: { value: 0.5 },
    uTime: { value: 0 },
    // The head's middle: its bone sits at the skull's base, the middle a tenth of a metre up.
    uHead: {
      value: model.bones.head
        .getWorldPosition(new THREE.Vector3())
        .sub(actor.group.position)
        .add(new THREE.Vector3(0, 0.1 * (actor.character.appearance.heightM / 1.75), 0)),
    },
  };
  // The neon's places: the arms' joints, the jacket's hem (its lowest point on the trunk), the
  // shoulders' height and, for boots over the knee, the band round their tops (BodyModel's thigh
  // boots: from 0.56 to 0.62 of the way from hip to knee; its middle).
  const bindOf = (bone: THREE.Bone) =>
    bone.getWorldPosition(new THREE.Vector3()).sub(actor.group.position);
  const b = model.bones;
  const arms = [b.upperArmL, b.foreArmL, b.handL, b.upperArmR, b.foreArmR, b.handR].map(bindOf);
  let hem = Infinity;
  let boot = -1;
  for (const mesh of model.meshes) {
    const p = mesh.geometry.getAttribute('position');
    if (mesh.userData.surface === 'outer') {
      for (let i = 0; i < p.count; i++) {
        if (Math.abs(p.getX(i)) < 0.08) hem = Math.min(hem, p.getY(i));
      }
    } else if (mesh.userData.surface === 'shoes') {
      for (let i = 0; i < p.count; i++) boot = Math.max(boot, p.getY(i));
    }
  }
  const hipY = bindOf(b.thighL).y;
  const kneeY = bindOf(b.shinL).y;
  const bootBand = boot > kneeY + 0.1 ? hipY - 0.59 * (hipY - kneeY) : -1;
  const neonUniforms = neon && {
    uNeonColor: { value: new THREE.Color(neon.color) },
    uArmJ: { value: arms },
    uNeonAt: {
      value: new THREE.Vector4(
        Number.isFinite(hem) ? hem : 0,
        arms[0]?.y ?? 0,
        bootBand,
        neon.sleeves ? 1 : 0,
      ),
    },
  };
  markWind(actor);
  const outlines = model.outlines ? [model.outlines.body, model.outlines.coat] : [];
  // Every material once: the toon ones get the rim; all of them the wind.
  const done = new Set<THREE.Material>();
  const all = [...model.meshes, ...outlines];
  for (const mesh of all) {
    const material = mesh.material as THREE.Material;
    if (done.has(material)) continue;
    done.add(material);
    const toon = material instanceof THREE.MeshToonMaterial;
    // Skin takes less rim than cloth and hair: a face lit edge-on read as a white mask by night.
    const surface = mesh.userData.surface as string | undefined;
    const rimScale =
      surface === 'skin' || surface === 'hands' || surface === 'photo' ? '0.3' : '1.0';
    const isCloth = CLOTH.has(surface ?? '');
    const isHair = strands && toon && surface === 'hair';
    const lit = toon && neonUniforms !== undefined && NEON_ON.has(surface ?? '');
    // The outline drawn as ink: near black, bolder (its width set each frame, `inkWidth`), thicker
    // and thinner along the body as a hand presses (Phú's reference, a render in that style).
    const ink = outlines.some((o) => o.material === material);
    if (ink && material instanceof THREE.MeshBasicMaterial) material.color.set(INK_COLOUR);
    const before = material.onBeforeCompile.bind(material);
    material.onBeforeCompile = (shader, renderer) => {
      before(shader, renderer);
      Object.assign(shader.uniforms, uniforms);
      if (lit) {
        Object.assign(shader.uniforms, neonUniforms);
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vBind;')
          .replace('#include <skinning_vertex>', '#include <skinning_vertex>\nvBind = position;');
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <common>',
          `#include <common>\n#define NEON\n${FRAGMENT_NEON_HEAD}`,
        );
      }
      if (press) {
        Object.assign(shader.uniforms, press);
        shader.vertexShader = shader.vertexShader.replace(
          '#include <common>',
          `#include <common>\n#define PRESS\n${toon ? '#define PRESS_NORMAL\n' : ''}${VERTEX_PRESS_HEAD}`,
        );
      }
      if (ink) {
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', `#include <common>\n${VERTEX_INK_HEAD}`)
          .replace(
            'normalize( objectNormal ) * outlineWidth;',
            'normalize( objectNormal ) * outlineWidth * inkVary(position) * inkScale;',
          );
      }
      if (longHair) {
        // The long hair in waves, made before skinning (they turn with the head), and hanging,
        // the same in the hair and in its ink.
        Object.assign(shader.uniforms, longHair);
        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            `#include <common>\n#define DRAPE\n${toon ? '#define DRAPE_NORMAL\n' : ''}${VERTEX_WAVE_HEAD}${VERTEX_DRAPE_HEAD}`,
          )
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>\ntransformed += hairWave(position) * aWind.x;${isHair ? '\nvHairBind = position;' : ''}`,
          );
      }
      if (isHair) {
        shader.vertexShader = shader.vertexShader.replace(
          '#include <common>',
          '#include <common>\nvarying vec3 vHairBind;',
        );
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', `#include <common>\n${FRAGMENT_STRANDS_HEAD}`)
          // (Before the light: the hair's own material has replaced <color_fragment>.)
          .replace(
            '#include <emissivemap_fragment>',
            'diffuseColor.rgb *= hairStrands(vHairBind);\n#include <emissivemap_fragment>',
          );
      }
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${VERTEX_HEAD}`)
        .replace('#include <skinning_vertex>', VERTEX_MOVE);
      if (toon) {
        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            `#include <common>\n#define RIM_SCALE ${rimScale}\n${FRAGMENT_HEAD}`,
          )
          .replace('#include <emissivemap_fragment>', FRAGMENT_RIM);
        // The game's fold strips kept but softened (a lighter strip on red read as gloss): the
        // colour pulled back towards the cloth's own before it is lit.
        if (isCloth) {
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <emissivemap_fragment>',
            `diffuseColor.rgb = mix(diffuse, diffuseColor.rgb, 0.45);\n#include <emissivemap_fragment>`,
          );
        }
      }
    };
    // Its own program: the wind's code is not the game's.
    const cacheKey = material.customProgramCacheKey.bind(material);
    material.customProgramCacheKey = () =>
      `${cacheKey()}|wallpaper-look|${toon}|${rimScale}|${isCloth}|${lit}|${press !== undefined}|${ink}|${strands}|${isHair}`;
    material.needsUpdate = true;
  }

  let gust = 0.5;
  let gustTarget = 0.5;
  let nextGust = 0;
  return {
    uniforms,
    update(dt, time) {
      uniforms.uTime.value = time;
      // Gusts come and go: a new strength every few seconds, eased towards.
      if (time >= nextGust) {
        gustTarget = 0.25 + 0.75 * Math.abs((Math.sin(time * 12.9898) * 43758.5453) % 1);
        nextGust = time + 2.5 + 4 * Math.abs((Math.sin(time * 78.233) * 1234.5) % 1);
      }
      gust += (gustTarget - gust) * Math.min(1, dt * 0.8);
      uniforms.uGust.value = gust;
    },
  };
}
