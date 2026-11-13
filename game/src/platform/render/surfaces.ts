import * as THREE from 'three';
import type { MATERIALS } from '../../gameplay/item';
import type { Floor } from '../../world/definitions';
import type { Finish } from './palette';

/** An item's look (`visual.material`). */
type Material = (typeof MATERIALS)[number];

/**
 * Ultra's real surfaces (Phase G-2, docs/phase-g-ultra-contract.md §4.2): photographed CC0
 * materials from ambientCG (public/ultra/textures, their sources in its README) laid on the labs'
 * floors, walls, ceilings, furniture and props — under Ultra only, loaded when it is chosen and
 * freed when it is left.
 *
 * Mapped in world space from three sides (triplanar), not by the geometry's UVs: the models are
 * procedural boxes and lathes whose UVs stretch one image over a whole bench, while a world-space
 * mapping gives every surface the same real grain size. A material keeps its own colour, roughness
 * and metalness: the photo's colour adds only its variation in brightness around them (its mean
 * brought to 1), its roughness map varies the material's own roughness the same way, its normal map
 * adds the relief, its ambient occlusion map (where there is one) darkens the crevices' indirect
 * light. Glass, liquids, lights and anything already customised are left as they are.
 */

export interface SurfaceSet {
  /** The folder under public/ultra/textures. */
  readonly folder: string;
  /** Metres one image covers. */
  readonly scale: number;
  /** Texels a side once loaded (2048 for the large surfaces, 1024 for props: video memory). */
  readonly size: 2048 | 1024;
  /** How much the photo's brightness varies the colour (0 none, 1 all of it). */
  readonly detail: number;
  /** How much its roughness map varies the material's roughness. */
  readonly rough: number;
  /** The normal map's strength. */
  readonly normal: number;
  /** Whether it has an ambient occlusion map. */
  readonly ao: boolean;
}

export const SURFACE_SETS = {
  'floor-terrazzo': {
    folder: 'Tiles043',
    scale: 2.4,
    size: 2048,
    detail: 0.35, // its chips stay a speckle under the room's own colour (G-4 look)
    rough: 0.35,
    normal: 0.8,
    ao: false,
  },
  'floor-concrete': {
    folder: 'Concrete048',
    scale: 3,
    size: 2048,
    detail: 0.8,
    rough: 0.7,
    normal: 1,
    ao: true,
  },
  // The room's own tiles stay (their map): only a fine stone grain over them. A tiled set laid its
  // own smaller grid over the Biology Lab's (G-4 bench look).
  'floor-stone': {
    folder: 'Concrete048',
    scale: 1.5,
    size: 2048,
    detail: 0.25,
    rough: 0.3,
    normal: 0.4,
    ao: false,
  },
  'floor-wood': {
    folder: 'WoodFloor051',
    scale: 2,
    size: 2048,
    detail: 0.8,
    rough: 0.6,
    normal: 0.8,
    ao: false,
  },
  plaster: {
    folder: 'PaintedPlaster017',
    scale: 2.5,
    size: 2048,
    detail: 0.35,
    rough: 0.5,
    normal: 0.6,
    ao: false,
  },
  steel: {
    folder: 'Metal012',
    scale: 0.6,
    size: 1024,
    // Subtle: on thin rails and trims a stronger set read as crumpled foil (G-3 bench look).
    detail: 0.15,
    rough: 0.12, // patches of roughness on a mirror-like metal read as galvanised spangle
    normal: 0.25,
    ao: false,
  },
  aluminium: {
    folder: 'Metal051A',
    scale: 0.25,
    size: 1024,
    detail: 0.12,
    rough: 0.12,
    normal: 0.2,
    ao: false,
  },
  'painted-metal': {
    folder: 'Metal027',
    scale: 0.8,
    size: 1024,
    detail: 0.3,
    rough: 0.6,
    normal: 0.6,
    ao: false,
  },
  'plastic-white': {
    folder: 'Plastic010',
    scale: 0.6,
    size: 1024,
    detail: 0.25,
    rough: 0.25,
    normal: 0.5,
    ao: false,
  },
  'plastic-glossy': {
    folder: 'Plastic006',
    scale: 0.8,
    size: 1024,
    detail: 0.15,
    rough: 0.25,
    normal: 0.4,
    ao: false,
  },
  rubber: {
    folder: 'Rubber004',
    scale: 0.3,
    size: 1024,
    detail: 0.4,
    rough: 0.4,
    normal: 0.8,
    ao: false,
  },
  wood: {
    folder: 'Wood092',
    scale: 1,
    size: 1024,
    detail: 0.8,
    rough: 0.6,
    normal: 0.6,
    ao: false,
  },
} as const satisfies Record<string, SurfaceSet>;

export type SurfaceId = keyof typeof SURFACE_SETS;

/** A room's floor by its kind (rooms.json `floor`). */
export const FLOOR_SURFACES: Record<Floor, SurfaceId> = {
  vinyl: 'floor-terrazzo',
  tile: 'floor-stone',
  stone: 'floor-stone',
  wood: 'floor-wood',
  concrete: 'floor-concrete',
};

/** The rooms' walls and ceilings, and their skirting. */
export const SHELL_SURFACES = { wall: 'plaster', ceiling: 'plaster', skirting: 'rubber' } as const;

/** The props' and decor's finishes (palette.ts) that have a real surface. */
export const FINISH_SURFACES: Partial<Record<Finish, SurfaceId>> = {
  steel: 'steel',
  aluminium: 'aluminium',
  'frame-dark': 'painted-metal',
  trim: 'plastic-glossy',
  'worktop-epoxy': 'plastic-glossy',
  'worktop-white': 'plastic-white',
  'seat-white': 'plastic-white',
  hull: 'plastic-white',
  stone: 'floor-stone',
  wood: 'wood',
  'wood-light': 'wood',
  rubber: 'rubber',
  seal: 'rubber',
  linen: 'plastic-white',
};

/** Entities' own materials (an item's `visual.material`). */
export const LOOK_SURFACES: Partial<Record<Material, SurfaceId>> = {
  metal: 'steel',
  painted: 'painted-metal',
  plastic: 'plastic-white',
  rubber: 'rubber',
  satin: 'plastic-white',
};

/** Which surface a material takes, from the tags its maker gave it (`userData`). */
export function surfaceOf(material: THREE.Material): SurfaceId | null {
  const data = material.userData as { surface?: SurfaceId; finish?: Finish; look?: Material };
  const glow = (material as Partial<THREE.MeshStandardMaterial>).emissive;
  if (material.transparent || (glow !== undefined && glow.getHex() !== 0)) {
    return null; // glass, liquids, lights
  }
  if (data.surface) return data.surface;
  if (data.finish) return FINISH_SURFACES[data.finish] ?? null;
  if (data.look) return LOOK_SURFACES[data.look] ?? null;
  return null;
}

/** One set loaded: its textures and the means its variations are taken about. */
interface Loaded {
  readonly color: THREE.Texture;
  readonly normal: THREE.Texture;
  readonly roughness: THREE.Texture;
  readonly ao: THREE.Texture | null;
  readonly colorMean: number;
  readonly roughMean: number;
}

const VERTEX_HEAD = /* glsl */ `
varying vec3 vTriPos;
varying vec3 vTriNormal;
`;
const VERTEX_BODY = /* glsl */ `
{
  vec4 triPos = vec4( transformed, 1.0 );
  mat3 triM = mat3( modelMatrix );
  #ifdef USE_INSTANCING
    triPos = instanceMatrix * triPos;
    triM = triM * mat3( instanceMatrix );
  #endif
  vTriPos = ( modelMatrix * triPos ).xyz;
  vTriNormal = normalize( triM * objectNormal );
}
`;
const FRAGMENT_HEAD = /* glsl */ `
varying vec3 vTriPos;
varying vec3 vTriNormal;
uniform sampler2D tTriColor;
uniform sampler2D tTriNormal;
uniform sampler2D tTriRough;
#ifdef TRI_AO
  uniform sampler2D tTriAo;
#endif
uniform float uTriScale;
uniform float uTriDetail;
uniform float uTriRough;
uniform float uTriNormal;
uniform float uTriColorMean;
uniform float uTriRoughMean;
vec4 triSample( sampler2D t, vec3 p, vec3 w ) {
  return texture2D( t, p.zy ) * w.x + texture2D( t, p.xz ) * w.y + texture2D( t, p.xy ) * w.z;
}
`;
const FRAGMENT_COLOR = /* glsl */ `
vec3 triN = normalize( vTriNormal );
vec3 triWt = pow( abs( triN ), vec3( 4.0 ) );
triWt /= triWt.x + triWt.y + triWt.z;
vec3 triP = vTriPos / uTriScale;
{
  float triL = dot( triSample( tTriColor, triP, triWt ).rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
  diffuseColor.rgb *= mix( 1.0, triL / uTriColorMean, uTriDetail );
}
`;
const FRAGMENT_ROUGH = /* glsl */ `
{
  float triR = triSample( tTriRough, triP, triWt ).g;
  roughnessFactor = clamp( roughnessFactor * mix( 1.0, triR / uTriRoughMean, uTriRough ), 0.04, 1.0 );
}
`;
// The tangent-space normals of the three projections, blended in world space ("whiteout"), then to
// view space, where three lights.
const FRAGMENT_NORMAL = /* glsl */ `
{
  vec3 nX = texture2D( tTriNormal, triP.zy ).xyz * 2.0 - 1.0;
  vec3 nY = texture2D( tTriNormal, triP.xz ).xyz * 2.0 - 1.0;
  vec3 nZ = texture2D( tTriNormal, triP.xy ).xyz * 2.0 - 1.0;
  nX.xy *= uTriNormal; nY.xy *= uTriNormal; nZ.xy *= uTriNormal;
  nX = vec3( nX.xy + triN.zy, abs( nX.z ) * triN.x );
  nY = vec3( nY.xy + triN.xz, abs( nY.z ) * triN.y );
  nZ = vec3( nZ.xy + triN.xy, abs( nZ.z ) * triN.z );
  vec3 triWorld = normalize( nX.zyx * triWt.x + nY.xzy * triWt.y + nZ.xyz * triWt.z );
  normal = normalize( ( viewMatrix * vec4( triWorld, 0.0 ) ).xyz ) * faceDirection;
}
`;
const FRAGMENT_AO = /* glsl */ `
#ifdef TRI_AO
  reflectedLight.indirectDiffuse *= mix( 1.0, triSample( tTriAo, triP, triWt ).r, 0.8 );
#endif
`;

/** The mean of a texture's channel over its image, from a small copy (16² is plenty for a mean). */
async function meanOf(
  image: ImageBitmap,
  channel: 'luminance' | 'g',
  srgb: boolean,
): Promise<number> {
  const small = await createImageBitmap(image, { resizeWidth: 16, resizeHeight: 16 });
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const context = canvas.getContext('2d');
  if (!context) return 1;
  context.drawImage(small, 0, 0);
  small.close();
  const data = context.getImageData(0, 0, 16, 16).data;
  const linear = (v: number) => {
    const c = v / 255;
    if (!srgb) return c;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [linear(data[i] ?? 0), linear(data[i + 1] ?? 0), linear(data[i + 2] ?? 0)];
    sum += channel === 'g' ? g : 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  return Math.max(sum / (data.length / 4), 0.05);
}

/**
 * The surfaces under Ultra: `load` fetches every set (once), `adopt` lays them on what a root holds,
 * `drop` takes them off every material and frees the textures. A material is patched once (its
 * program keyed by its surface, so three compiles one program per surface and kind), and patched
 * materials are remembered so they can be restored.
 */
export class Surfaces {
  private loaded: Map<SurfaceId, Loaded> | null = null;
  private loading: Promise<void> | null = null;
  private readonly patched = new Set<THREE.MeshStandardMaterial>();

  constructor(
    /** The base URL the textures are served under (Vite's BASE_URL). */
    private readonly base: string,
    /** The GPU's anisotropy (renderer.capabilities.getMaxAnisotropy()). */
    private readonly anisotropy: () => number,
  ) {}

  get ready(): boolean {
    return this.loaded !== null;
  }

  /** Fetches every set once; resolves when all are here (a set that fails is left out, warned). */
  load(warn: (message: string, error: unknown) => void): Promise<void> {
    if (this.loaded) return Promise.resolve();
    this.loading ??= (async () => {
      const sets = new Map<SurfaceId, Loaded>();
      await Promise.all(
        (Object.entries(SURFACE_SETS) as [SurfaceId, SurfaceSet][]).map(async ([id, set]) => {
          try {
            sets.set(id, await this.loadSet(set));
          } catch (error) {
            warn(`Ultra surface "${id}" did not load`, error);
          }
        }),
      );
      this.loaded = sets;
    })();
    return this.loading;
  }

  /** Every texture loaded (to upload them during a load, not at their first draw). */
  textures(): THREE.Texture[] {
    const out: THREE.Texture[] = [];
    for (const set of this.loaded?.values() ?? []) {
      out.push(set.color, set.normal, set.roughness);
      if (set.ao) out.push(set.ao);
    }
    return out;
  }

  /** Lays the loaded surfaces on every standard material under `root` that has one. */
  adopt(root: THREE.Object3D): void {
    const loaded = this.loaded;
    if (!loaded) return;
    root.traverse((object) => {
      const mesh = object as Partial<THREE.Mesh>;
      if (!mesh.material) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (!(material instanceof THREE.MeshStandardMaterial) || this.patched.has(material))
          continue;
        if (Object.hasOwn(material, 'onBeforeCompile')) continue; // customised already
        const id = surfaceOf(material);
        const surface = id ? loaded.get(id) : undefined;
        if (!id || !surface) continue;
        this.patch(material, id, surface);
      }
    });
  }

  /** Every surface off (Ultra left): materials as they were, textures freed. */
  drop(): void {
    for (const material of this.patched) {
      // The patch is the instance's own: removed, the class's defaults show through again.
      delete (material as Partial<THREE.MeshStandardMaterial>).onBeforeCompile;
      delete (material as Partial<THREE.MeshStandardMaterial>).customProgramCacheKey;
      material.needsUpdate = true;
    }
    this.patched.clear();
    for (const set of this.loaded?.values() ?? []) {
      for (const texture of [set.color, set.normal, set.roughness, set.ao]) texture?.dispose();
    }
    this.loaded = null;
    this.loading = null;
  }

  private patch(material: THREE.MeshStandardMaterial, id: SurfaceId, s: Loaded): void {
    const set: SurfaceSet = SURFACE_SETS[id];
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, {
        tTriColor: { value: s.color },
        tTriNormal: { value: s.normal },
        tTriRough: { value: s.roughness },
        tTriAo: { value: s.ao },
        uTriScale: { value: set.scale },
        uTriDetail: { value: set.detail },
        uTriRough: { value: set.rough },
        uTriNormal: { value: set.normal },
        uTriColorMean: { value: s.colorMean },
        uTriRoughMean: { value: s.roughMean },
      });
      if (s.ao) shader.defines = { ...shader.defines, TRI_AO: '' };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${VERTEX_HEAD}`)
        .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n${VERTEX_BODY}`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${FRAGMENT_HEAD}`)
        .replace('#include <map_fragment>', `#include <map_fragment>\n${FRAGMENT_COLOR}`)
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>\n${FRAGMENT_ROUGH}`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>\n${FRAGMENT_NORMAL}`,
        )
        .replace('#include <aomap_fragment>', `#include <aomap_fragment>\n${FRAGMENT_AO}`);
    };
    material.customProgramCacheKey = () => `ultra-surface:${id}`;
    material.needsUpdate = true;
    this.patched.add(material);
  }

  private async loadSet(set: SurfaceSet): Promise<Loaded> {
    const url = (map: string) => `${this.base}ultra/textures/${set.folder}/${map}.jpg`;
    const bitmap = async (map: string) => {
      const response = await fetch(url(map));
      if (!response.ok) throw new Error(`${url(map)}: HTTP ${response.status}`);
      return createImageBitmap(await response.blob(), {
        resizeWidth: set.size,
        resizeHeight: set.size,
        resizeQuality: 'high',
        colorSpaceConversion: 'none',
      });
    };
    const texture = (image: ImageBitmap, srgb: boolean) => {
      const t = new THREE.Texture(image);
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = this.anisotropy();
      t.flipY = false; // an ImageBitmap is not flipped on upload; a tiling surface does not mind
      t.needsUpdate = true;
      return t;
    };
    const [color, normal, roughness, ao] = await Promise.all([
      bitmap('color'),
      bitmap('normal'),
      bitmap('roughness'),
      set.ao ? bitmap('ao') : Promise.resolve(null),
    ]);
    return {
      color: texture(color, true),
      normal: texture(normal, false),
      roughness: texture(roughness, false),
      ao: ao ? texture(ao, false) : null,
      colorMean: await meanOf(color, 'luminance', true),
      roughMean: await meanOf(roughness, 'g', false),
    };
  }
}
