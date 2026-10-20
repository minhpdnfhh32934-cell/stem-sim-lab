/**
 * Materials of the 3D views (generic: no biology in here). Solid parts are physically based
 * (environment-lit, a soft sheen on organic parts at the High quality tier); see-through shells
 * (membranes, envelopes, glass) get a Fresnel rim so their outline reads against both themes'
 * backgrounds while the inside stays visible. Fades of solid parts use `alphaHash` (no sorting
 * against glass).
 */
import * as THREE from 'three';
import type { QualityTier } from '@/perf/tiers';

export interface RimOptions {
  /** Rim colour (a theme token's value). */
  color: string;
  /** Sharpness of the rim: higher = thinner edge. */
  power?: number;
  /** Light added at the edge (0…1). */
  strength?: number;
  /** Opacity added at the edge (0…1): the outline of a faint shell. */
  alpha?: number;
}

/**
 * Adds a view-dependent Fresnel rim to a standard/physical material (no extra mesh or draw
 * call). Runs in the material's own shader; jsdom never compiles it, which is fine.
 */
export function withRim<M extends THREE.MeshStandardMaterial>(material: M, rim: RimOptions): M {
  const uniforms = {
    uRimColor: { value: new THREE.Color(rim.color) },
    uRimPower: { value: rim.power ?? 2.6 },
    uRimStrength: { value: rim.strength ?? 0.6 },
    uRimAlpha: { value: rim.alpha ?? 0.5 },
  };
  material.userData.rim = uniforms;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        'uniform vec3 uRimColor;\nuniform float uRimPower;\nuniform float uRimStrength;\nuniform float uRimAlpha;\nvoid main() {',
      )
      .replace(
        '#include <opaque_fragment>',
        [
          'float rimF = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), uRimPower);',
          'outgoingLight += uRimColor * rimF * uRimStrength;',
          'diffuseColor.a = clamp(diffuseColor.a + rimF * uRimAlpha, 0.0, 1.0);',
          '#include <opaque_fragment>',
        ].join('\n'),
      );
  };
  // Rim and plain materials with the same settings must not share a shader program.
  material.customProgramCacheKey = () => 'simlab-rim';
  return material;
}

/**
 * Mixes a material's surface colour (after vertex colours) towards `color` by `amount` (0…1),
 * before lighting: a picked part stands out while the others fade towards the stage colour,
 * even when each vertex carries its own colour. Runs in the material's own shader.
 */
export function withTint<M extends THREE.MeshStandardMaterial>(
  material: M,
  color: THREE.ColorRepresentation,
  amount: number,
): M {
  const uniforms = {
    uTintColor: { value: new THREE.Color(color) },
    uTintAmount: { value: amount },
  };
  material.userData.tint = uniforms;
  const previous = material.onBeforeCompile.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        'uniform vec3 uTintColor;\nuniform float uTintAmount;\nvoid main() {',
      )
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, uTintColor, uTintAmount);',
      );
  };
  const key = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${key()}|simlab-tint`;
  return material;
}

/** Updates a rim's opacity term (e.g. a membrane that fades). */
export function setRimAlpha(material: THREE.Material, alpha: number): void {
  const u = material.userData.rim as { uRimAlpha: { value: number } } | undefined;
  if (u) u.uRimAlpha.value = alpha;
}

export interface SolidOptions {
  roughness?: number;
  metalness?: number;
  /** Soft velvety sheen (cells, chromatin) on the High tier. */
  sheen?: number;
  /** Thin clear coat (wet, glossy look) on the High tier. */
  clearcoat?: number;
  emissive?: string;
  emissiveIntensity?: number;
  /** Fades with alphaHash (stochastic, no sorting) instead of blending. */
  fades?: boolean;
  side?: THREE.Side;
}

/**
 * An opaque, environment-lit material. High tier: MeshPhysicalMaterial (sheen, clear coat);
 * Medium/Low: MeshStandardMaterial (cheaper shader, same colours).
 */
export function solid(
  color: string,
  tier: QualityTier,
  o: SolidOptions = {},
): THREE.MeshStandardMaterial {
  const base: THREE.MeshStandardMaterialParameters = {
    color,
    roughness: o.roughness ?? 0.45,
    metalness: o.metalness ?? 0,
    envMapIntensity: 1,
    ...(o.emissive ? { emissive: o.emissive, emissiveIntensity: o.emissiveIntensity ?? 1 } : {}),
    ...(o.fades ? { alphaHash: true } : {}),
    ...(o.side !== undefined ? { side: o.side } : {}),
  };
  if (tier !== 'high') return new THREE.MeshStandardMaterial(base);
  const sheen = o.sheen ?? 0;
  return new THREE.MeshPhysicalMaterial({
    ...base,
    ...(sheen > 0 ? { sheen, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffffff) } : {}),
    clearcoat: o.clearcoat ?? 0,
    clearcoatRoughness: 0.35,
  });
}

export interface GlassOptions {
  opacity: number;
  roughness?: number;
  rim?: RimOptions;
  side?: THREE.Side;
}

/** A see-through shell: blended, never writes depth, one pass; outlined by a rim if given. */
export function glass(color: string, o: GlassOptions): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness: o.roughness ?? 0.2,
    metalness: 0,
    transparent: true,
    depthWrite: false,
    opacity: o.opacity,
    side: o.side ?? THREE.FrontSide,
    forceSinglePass: true,
  });
  return o.rim ? withRim(m, o.rim) : m;
}

/** Sphere / tube detail for a tier (the tier's own setting, never below 8). */
export function segmentsFor(sphereSegments: number): number {
  return Math.max(8, Math.round(sphereSegments));
}

/**
 * A box with rounded edges spanning [−1, 1]³ (a superellipsoid |x|ᵖ + |y|ᵖ + |z|ᵖ = 1, built
 * from a sphere's vertices, with exact normals: no seam). Plant cells, chambers, tiles.
 */
export function roundedBox(segments: number, power = 8): THREE.SphereGeometry {
  const g = new THREE.SphereGeometry(
    1,
    Math.max(8, segments),
    Math.max(6, Math.round(segments * 0.75)),
  );
  const pos = g.attributes.position as THREE.BufferAttribute;
  const nor = g.attributes.normal as THREE.BufferAttribute;
  const p = Math.max(2, power);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const s = (Math.abs(x) ** p + Math.abs(y) ** p + Math.abs(z) ** p) ** (-1 / p);
    const px = x * s;
    const py = y * s;
    const pz = z * s;
    pos.setXYZ(i, px, py, pz);
    // Gradient of |x|ᵖ + |y|ᵖ + |z|ᵖ.
    const nx = Math.sign(px) * Math.abs(px) ** (p - 1);
    const ny = Math.sign(py) * Math.abs(py) ** (p - 1);
    const nz = Math.sign(pz) * Math.abs(pz) ** (p - 1);
    const l = Math.hypot(nx, ny, nz) || 1;
    nor.setXYZ(i, nx / l, ny / l, nz / l);
  }
  pos.needsUpdate = true;
  nor.needsUpdate = true;
  g.computeBoundingSphere();
  return g;
}
