import * as THREE from 'three';
import { GLASSWARE, METAL, SHEEN, STEAM } from './looks';
import { setNodeLook } from './nodeLooks';
import type { QualityConfig } from './quality';

/**
 * Glassware as a filter (presets with `sheen`): the light behind it × this colour, a near-clear glass
 * with a faint cool tint. A starting look for the user's eyes, not a measured transmittance.
 */
const GLASS_FILTER = '#e9f3f5';
/** The glassware sheen's roughness (render-quality audit F4: 0.03–0.05). */
const GLASS_SHEEN_ROUGHNESS = 0.04;
/** Small print and sheen passes further than this (m) from the eye are not drawn (audit §5.3). */
export const DETAIL_DISTANCE = 4;
/** How often (s) the distance is checked: a few times a second, never per frame. */
const DETAIL_INTERVAL_S = 0.25;
/** Bench print meshes (by the name their model gives them; none of them toggles their visibility). */
const PRINT = new Set(['print', 'marks', 'label']);

/**
 * Glass seen edge-on (graphics-fidelity audit §4): a Fresnel term on every glassware material, on
 * every preset — a wall looked at along its surface crosses more glass and reflects more, so the
 * outline and the wall's thickness read and thin glass does not vanish. As paint (no `sheen`)
 * it is clearer face-on and more opaque and lighter towards the rim; as a filter (premultiplied
 * multiply) it lets less of what is behind through towards the rim. A shader change, no draw.
 */
const GLASS_EDGE = /* glsl */ `
float glassFacing = abs(dot(normalize(normal), normalize(vViewPosition)));
float glassEdge = pow(1.0 - glassFacing, 3.0);
#ifdef PREMULTIPLIED_ALPHA
gl_FragColor.rgb *= 1.0 - 0.45 * glassEdge;
#else
gl_FragColor.a = clamp(gl_FragColor.a * (0.6 + 2.2 * glassEdge), 0.0, 0.92);
gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0), 0.25 * glassEdge);
#endif
`;

/** Installs GLASS_EDGE after the lit colour is set (one program for every glassware material). */
export function glassEdge(shader: { fragmentShader: string }): void {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <opaque_fragment>',
    `#include <opaque_fragment>
${GLASS_EDGE}`,
  );
}

const PRINTS_VARYINGS = /* glsl */ `
varying vec3 vWearPos;
varying vec3 vWearN;
`;
/** The glassware sheen's world position, for Max's fingerprints (instanced glassware too). */
const PRINTS_VERTEX = /* glsl */ `
{
  vec4 wearPos = vec4( transformed, 1.0 );
  mat3 wearM = mat3( modelMatrix );
  #ifdef USE_INSTANCING
    wearPos = instanceMatrix * wearPos;
    wearM = wearM * mat3( instanceMatrix );
  #endif
  vWearPos = ( modelMatrix * wearPos ).xyz;
  vWearN = normalize( wearM * objectNormal );
}
`;
/**
 * Fingerprints on glass (Max): sampled from three sides like the surfaces' wear, at a hand's
 * scale, gathered in clusters; where they are the sheen is rougher (a greasy, dull smear).
 */
const PRINTS_FRAGMENT = /* glsl */ `
{
  vec3 pw = pow( abs( normalize( vWearN ) ), vec3( 4.0 ) );
  pw /= pw.x + pw.y + pw.z;
  vec3 pf = vWearPos / 0.3;
  vec3 pb = vWearPos / 1.2;
  float g = texture2D( tWear, pf.zy ).g * pw.x + texture2D( tWear, pf.xz ).g * pw.y
    + texture2D( tWear, pf.xy ).g * pw.z;
  float r = texture2D( tWear, pb.zy ).r * pw.x + texture2D( tWear, pb.xz ).r * pw.y
    + texture2D( tWear, pb.xy ).r * pw.z;
  roughnessFactor = clamp( roughnessFactor + 0.4 * g * smoothstep( 0.1, 0.28, r ), 0.04, 1.0 );
}
`;

/** A glassware material's own paint, kept to give it back below Medium. */
interface Paint {
  readonly color: THREE.Color;
  readonly emissive: THREE.Color;
  readonly opacity: number;
  filtered: boolean;
}

/**
 * What a graphics preset changes on materials and textures (render-quality audit §5.2), applied
 * to whatever the renderer adds (`adopt`) and to its whole scene again when the preset changes —
 * never per frame:
 * - every texture's anisotropy: max(its own, the preset's) (F3);
 * - glassware (looks.ts GLASSWARE): its paint, or where the preset has `sheen` a filter plus a
 *   shared sheen pass, one more draw per glassware mesh or instanced batch (F4); sheen passes
 *   are made only then, so a preset without sheen never compiles their program;
 * - metal and sheen: on High the room light as their own environment map, metal then fully
 *   metallic (F5, F6); sheen materials are drawn only where the preset has `sheen` (F13);
 * - small print and sheen passes are hidden beyond DETAIL_DISTANCE (draws saved, §5.3);
 * - steam's mist (looks.ts STEAM) where the preset has `effects` (Ultra): soft and torn (`wisps`).
 * Each material's and texture's own values are remembered on first sight, so a switch back gives
 * exactly what the builder made.
 */
/**
 * Ultra's steam (WISPS): a puff of mist instead of a pale ball — drawn out upward, thin towards its
 * rim (where the eye looks through less of it) and torn by noise in the puff's own space, its
 * pattern turning as it rises. The colour and the opacity the builder gave stay; only how it fades is shaped.
 */
const wisps = (shader: THREE.WebGLProgramParametersWithUniforms): void => {
  shader.vertexShader = shader.vertexShader
    .replace(
      'void main() {',
      `#ifdef WISPS
varying vec3 vWispNormal;
varying vec3 vWispView;
varying vec3 vWispAt;
#endif
void main() {`,
    )
    .replace(
      '#include <project_vertex>',
      `#ifdef WISPS
  transformed *= vec3( 0.75, 1.7, 0.75 ); // drawn out upward, as it streams off
#endif
#include <project_vertex>
#ifdef WISPS
  vec3 wispNormal = normal;
  vec3 wispSeed = vec3( 0.0 );
  #ifdef USE_INSTANCING
    wispNormal = mat3( instanceMatrix ) * wispNormal;
    wispSeed = instanceMatrix[ 3 ].xyz * 23.0; // its curls turn as it rises
  #endif
  vWispNormal = normalize( normalMatrix * wispNormal );
  vWispView = -mvPosition.xyz;
  vWispAt = position * vec3( 2.6, 1.4, 2.6 ) + wispSeed;
#endif`,
    );
  shader.fragmentShader = shader.fragmentShader
    .replace(
      'void main() {',
      `#ifdef WISPS
varying vec3 vWispNormal;
varying vec3 vWispView;
varying vec3 vWispAt;
float wispHash( vec3 p ) {
  return fract( sin( dot( p, vec3( 12.9898, 78.233, 37.719 ) ) ) * 43758.5453 );
}
float wispNoise( vec3 p ) {
  vec3 i = floor( p );
  vec3 f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  vec2 e = vec2( 1.0, 0.0 );
  return mix(
    mix( mix( wispHash( i ), wispHash( i + e.xyy ), f.x ),
         mix( wispHash( i + e.yxy ), wispHash( i + e.xxy ), f.x ), f.y ),
    mix( mix( wispHash( i + e.yyx ), wispHash( i + e.xyx ), f.x ),
         mix( wispHash( i + e.yxx ), wispHash( i + e.xxx ), f.x ), f.y ),
    f.z );
}
#endif
void main() {`,
    )
    .replace(
      '#include <alphamap_fragment>',
      `#include <alphamap_fragment>
#ifdef WISPS
  float facing = abs( dot( normalize( vWispNormal ), normalize( vWispView ) ) );
  float mist = 0.6 * wispNoise( vWispAt ) + 0.4 * wispNoise( vWispAt * 2.7 + 5.0 );
  diffuseColor.a *= smoothstep( 0.1, 0.9, facing ) * smoothstep( 0.42, 0.85, mist + 0.3 * facing ) * 1.5;
#endif`,
    );
};

export class Finishes {
  private quality: QualityConfig;
  private environment: THREE.Texture | null = null;
  private tilt = 0;
  private readonly anisotropy = new WeakMap<THREE.Texture, number>();
  private readonly paints = new WeakMap<THREE.Material, Paint>();
  private readonly metalness = new WeakMap<THREE.Material, number>();
  /** Each glassware mesh's sheen pass by its owner (not in `userData`: three copies that). */
  private readonly twins = new WeakMap<THREE.Mesh, THREE.Mesh>();
  /** The sheen pass every glassware mesh shares: the reflection alone (black, additive). */
  readonly sheen = new THREE.MeshStandardMaterial({
    name: SHEEN,
    color: 0x000000,
    roughness: GLASS_SHEEN_ROUGHNESS,
    metalness: 0,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  /** Print and sheen meshes, hidden far away, with their geometry's bounds. */
  private readonly details = new Map<THREE.Object3D, THREE.Sphere>();
  private sinceDetail = Infinity;
  /** Every glassware mesh adopted (and not released). */
  private readonly glassware = new Set<THREE.Mesh>();
  /** Max's wear texture on the sheen (setWear), or null. */
  private wear: THREE.Texture | null = null;
  // Reused by the distance check: nothing is allocated there.
  private readonly eye = new THREE.Vector3();
  private readonly centre = new THREE.Vector3();

  constructor(quality: QualityConfig) {
    this.quality = quality;
  }

  /**
   * The preset and the room light to reflect (High; `tilt`: its turn about x). True when this
   * changed anything: the caller then adopts its scene again.
   */
  set(quality: QualityConfig, environment: THREE.Texture | null, tilt: number): boolean {
    const env = quality.reflections > 0 ? environment : null;
    if (quality === this.quality && env === this.environment && tilt === this.tilt) return false;
    this.quality = quality;
    this.environment = env;
    this.tilt = tilt;
    this.sinceDetail = Infinity; // checked again at the next update
    return true;
  }

  /** Applies the preset to everything under `root` (idempotent; adds a glassware's sheen once). */
  adopt(root: THREE.Object3D): void {
    root.traverse(this.visit);
  }

  /** Forgets what `root` brought (its view removed). */
  release(root: THREE.Object3D): void {
    root.traverse(this.forget);
  }

  /** A texture's anisotropy for the preset: never below its own (three caps it at the GPU's). */
  texture(texture: THREE.Texture): void {
    let own = this.anisotropy.get(texture);
    if (own === undefined) {
      own = texture.anisotropy;
      this.anisotropy.set(texture, own);
    }
    const wanted = Math.max(own, this.quality.anisotropy);
    if (texture.anisotropy === wanted) return;
    texture.anisotropy = wanted;
    texture.needsUpdate = true; // three applies it at upload only
  }

  /** Hides print and sheen passes far from `eye` (a world position), a few times a second. */
  update(dt: number, eye: THREE.Vector3): void {
    this.sinceDetail += dt;
    if (this.sinceDetail < DETAIL_INTERVAL_S) return;
    this.sinceDetail = 0;
    this.eye.copy(eye);
    this.details.forEach(this.near);
  }

  /**
   * Max's fingerprints on glassware (Phase Max; wear.png's G, gathered by its R, in world space as
   * on the surfaces): where a hand has been, the glass's reflection dulls and blurs. Null takes it
   * off. The shared sheen pass compiles once more on a change.
   */
  setWear(texture: THREE.Texture | null): void {
    if (texture === this.wear) return;
    this.wear = texture;
    const sheen = this.sheen;
    if (!texture) {
      delete (sheen as Partial<THREE.MeshStandardMaterial>).onBeforeCompile;
      delete (sheen as Partial<THREE.MeshStandardMaterial>).customProgramCacheKey;
    } else {
      sheen.onBeforeCompile = (shader) => {
        shader.uniforms.tWear = { value: texture };
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', `#include <common>\n${PRINTS_VARYINGS}`)
          .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n${PRINTS_VERTEX}`);
        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            `#include <common>\n${PRINTS_VARYINGS}\nuniform sampler2D tWear;`,
          )
          .replace(
            '#include <roughnessmap_fragment>',
            `#include <roughnessmap_fragment>\n${PRINTS_FRAGMENT}`,
          );
      };
      sheen.customProgramCacheKey = () => 'max-glass-prints';
    }
    sheen.needsUpdate = true;
  }

  /** The glassware meshes there are (Max's see-through pass draws them itself: effectsPass.ts). */
  readonly glassMeshes = (): ReadonlySet<THREE.Mesh> => this.glassware;

  /** Shows or hides the glassware (their own materials; their sheen passes stay). */
  readonly showGlass = (shown: boolean): void => {
    for (const mesh of this.glassware) (mesh.material as THREE.Material).visible = shown;
  };

  /** A glassware mesh's sheen pass, if it has one (tests). */
  sheenOf(mesh: THREE.Mesh): THREE.Mesh | undefined {
    return this.twins.get(mesh);
  }

  dispose(): void {
    this.sheen.dispose();
    this.details.clear();
  }

  private readonly visit = (object: THREE.Object3D): void => {
    if (!(object instanceof THREE.Mesh)) return;
    const mesh = object as THREE.Mesh;
    const { material } = mesh;
    for (const m of Array.isArray(material) ? material : [material]) this.finish(m);
    const glassware = !Array.isArray(material) && material.name === GLASSWARE;
    if (glassware) this.glassware.add(mesh);
    if (glassware && this.quality.sheen) this.twin(mesh);
    if (PRINT.has(mesh.name)) this.detail(mesh);
  };

  private readonly forget = (object: THREE.Object3D): void => {
    this.details.delete(object);
    this.glassware.delete(object as THREE.Mesh);
  };

  private readonly near = (bounds: THREE.Sphere, object: THREE.Object3D): void => {
    const centre = this.centre.copy(bounds.center).applyMatrix4(object.matrixWorld);
    object.visible = centre.distanceTo(this.eye) - bounds.radius < DETAIL_DISTANCE;
  };

  private finish(m: THREE.Material): void {
    const { map } = m as THREE.MeshBasicMaterial;
    if (map) this.texture(map);
    if (m.name === STEAM) this.steam(m);
    if (!(m instanceof THREE.MeshStandardMaterial)) return;
    if (m.name === GLASSWARE) this.glass(m);
    else if (m.name === METAL) this.metal(m);
    else if (m.name === SHEEN) {
      this.reflect(m);
      m.visible = this.quality.sheen; // three draws nothing with an invisible material
    }
  }

  /** Steam's puffs: on Ultra a mist thinning to its rim and torn (`wisps`), else as built. */
  private steam(m: THREE.Material): void {
    if (m.onBeforeCompile !== wisps) {
      m.onBeforeCompile = wisps;
      m.customProgramCacheKey = () => 'steam-wisps';
    }
    const defines = (m.defines ??= {}) as Record<string, string>;
    const on = this.quality.effects;
    if (on === 'WISPS' in defines) return;
    if (on) defines.WISPS = '';
    else delete defines.WISPS;
    m.needsUpdate = true;
  }

  /** Paint without `sheen`; with it a filter (unlit, multiplied, the sheen pass adds light). */
  private glass(m: THREE.MeshStandardMaterial): void {
    if (m.onBeforeCompile !== glassEdge) {
      m.onBeforeCompile = glassEdge;
      setNodeLook(m, { kind: 'glass-edge' });
      m.needsUpdate = true;
    }
    let paint = this.paints.get(m);
    if (!paint) {
      paint = {
        color: m.color.clone(),
        emissive: m.emissive.clone(),
        opacity: m.opacity,
        filtered: false,
      };
      this.paints.set(m, paint);
    }
    const filter = this.quality.sheen;
    if (paint.filtered === filter) return;
    paint.filtered = filter;
    if (filter) {
      m.color.set(0x000000);
      m.emissive.set(GLASS_FILTER);
      m.opacity = 1;
    } else {
      m.color.copy(paint.color);
      m.emissive.copy(paint.emissive);
      m.opacity = paint.opacity;
    }
    m.blending = filter ? THREE.MultiplyBlending : THREE.NormalBlending;
    m.premultipliedAlpha = filter; // three's multiply needs it
    m.toneMapped = !filter; // a factor, not a light
    m.needsUpdate = true;
  }

  private metal(m: THREE.MeshStandardMaterial): void {
    let own = this.metalness.get(m);
    if (own === undefined) {
      own = m.metalness;
      this.metalness.set(m, own);
    }
    this.reflect(m);
    m.metalness = m.envMap ? 1 : own; // full metal without a reflection renders black
  }

  private reflect(m: THREE.MeshStandardMaterial): void {
    const env = this.environment;
    if (m.envMap !== env) {
      m.envMap = env;
      m.needsUpdate = true;
    }
    m.envMapIntensity = env ? this.quality.reflections : 1;
    m.envMapRotation.x = this.tilt;
  }

  /**
   * The glassware mesh's sheen: its own geometry again, as a child (it moves and hides with it);
   * an instanced (decor) batch's shares the batch's matrices. Just before it is drawn it follows
   * the batch's count and a geometry the builder swapped (drawn so from the next frame).
   */
  private twin(mesh: THREE.Mesh): void {
    if (this.twins.has(mesh)) return;
    const batch = mesh instanceof THREE.InstancedMesh ? mesh : null;
    const copies = batch ? new THREE.InstancedMesh(mesh.geometry, this.sheen, 0) : null;
    const sheen = copies ?? new THREE.Mesh(mesh.geometry, this.sheen);
    if (batch && copies) {
      copies.instanceMatrix = batch.instanceMatrix;
      copies.count = batch.count;
      copies.boundingSphere = batch.boundingSphere; // the same copies, in the same place
    }
    sheen.onBeforeRender = () => {
      if (sheen.geometry !== mesh.geometry) sheen.geometry = mesh.geometry;
      if (batch && copies) copies.count = batch.count;
    };
    sheen.name = 'glass-sheen';
    sheen.renderOrder = mesh.renderOrder;
    this.twins.set(mesh, sheen);
    mesh.add(sheen);
    // A batch spans the room: its geometry's bounds say nothing of its distance.
    if (!batch) this.detail(sheen);
  }

  private detail(object: THREE.Mesh): void {
    if (!object.geometry.boundingSphere) object.geometry.computeBoundingSphere();
    const bounds = object.geometry.boundingSphere;
    if (bounds) this.details.set(object, bounds);
  }
}
