/**
 * Material recipes of the biology 3D kit (0.7.1 style guide §3): one named function per kind of
 * thing, so every lesson draws membranes, chromosomes, DNA, proteins, particles, glassware,
 * liquids, organisms, terrain and annotation the same way. Each returns kit-owned materials and
 * geometries (`SceneKit.dispose` frees them) and is tier-aware:
 *
 * - Medium (and High without a discrete GPU): MeshStandardMaterial; see-through shells in two
 *   draws (a faint back face for volume + a front face with a Fresnel rim).
 * - High with extras: MeshPhysicalMaterial (sheen, clear coat); on a discrete GPU the outermost
 *   shell and glassware refract (transmission) and highlights glow in HDR (bloom).
 *
 * Rule 0: saturation = data. Data roles (bases, alleles, prey, substrates…) get their chart token
 * as albedo, unchanged; structures are muted (`palette.ts`). Shapes and textures are
 * illustration (covered by each lesson's "Minh họa" caption); no count or value comes from here.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { deepen, mixLinear } from '@/ui/three/color';
import { LAYER } from '@/ui/three/layers';
import { withRim } from '@/ui/three/materials';
import { withRelief } from '@/ui/three/relief';
import type { SceneKit, Vec3 } from './kit';
import { noiseTexture, fbm3 } from './noise';
import { ROLES, structureColor, type BioRole } from './palette';
import { proteinBlob } from './proteinBlob';

const physical = (kit: SceneKit) => kit.tier === 'high';

/** A theme token's value (CSS custom property) through the kit. */
const tok = (kit: SceneKit, name: string) => kit.color(name);

const tiles = new WeakMap<SceneKit, THREE.DataTexture>();

/** The shared 64² seamless noise tile (bump maps), one per scene (freed with the kit). */
export function noiseTile(kit: SceneKit): THREE.DataTexture {
  const existing = tiles.get(kit);
  if (existing) return existing;
  const tex = kit.keep(noiseTexture());
  tiles.set(kit, tex);
  return tex;
}

// ── Shells and membranes ─────────────────────────────────────────────────────────────────

export interface ShellOptions {
  /** Radius of the shell (world units): thickness and attenuation scale with it. */
  radius: number;
  /** Only the outermost shell of a subject may refract. */
  outermost?: boolean;
  /** Front-face opacity (default: the theme's --m3d-membrane-opacity). */
  opacity?: number;
  /** Fresnel rim strength (default: the theme's --m3d-rim). */
  rim?: number;
}

export interface ShellLook {
  /** Physical refracting shell (one draw), or null. */
  refract: THREE.MeshPhysicalMaterial | null;
  /** Faint back faces (volume), drawn first. */
  back: THREE.MeshStandardMaterial | null;
  /** Front faces with the rim. */
  front: THREE.MeshStandardMaterial | null;
}

function themeNumber(kit: SceneKit, name: string, fallback: number): number {
  const v = parseFloat(kit.color(name));
  return Number.isFinite(v) ? v : fallback;
}

/**
 * Materials of a see-through shell in `color` (already a structure colour). High tier on a
 * discrete GPU, outermost shell: one physical refracting material (transmission 0.9, thickness
 * 0.15 R, IOR 1.36, attenuation over 2 R, clear coat, Fresnel rim). Otherwise two draws: back
 * faces at opacity 0.07 in a darker tint, front faces at the theme's membrane opacity with the
 * rim.
 */
export function shellLook(kit: SceneKit, color: string, o: ShellOptions): ShellLook {
  const rimStrength = o.rim ?? themeNumber(kit, '--m3d-rim', 0.7);
  const opacity = o.opacity ?? themeNumber(kit, '--m3d-membrane-opacity', 0.14);
  const rim = { color, strength: 0.55 * rimStrength, alpha: 0.45 * rimStrength };
  if (o.outermost && kit.transmission) {
    const m = new THREE.MeshPhysicalMaterial({
      color,
      transmission: 0.9,
      thickness: 0.15 * o.radius,
      roughness: 0.18,
      ior: 1.36,
      attenuationColor: new THREE.Color(color),
      attenuationDistance: 2 * o.radius,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
      specularIntensity: 0.5,
      metalness: 0,
    });
    return { refract: kit.own(withRim(m, rim)), back: null, front: null };
  }
  const back = new THREE.MeshStandardMaterial({
    color: mixLinear(color, '#000000', 0.3),
    roughness: 0.4,
    transparent: true,
    opacity: 0.07,
    depthWrite: false,
    side: THREE.BackSide,
  });
  const front = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.25,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.FrontSide,
    forceSinglePass: true,
  });
  return { refract: null, back: kit.own(back), front: kit.own(withRim(front, rim)) };
}

/**
 * A see-through shell as meshes of `geometry` (one refracting draw, or back + front). Every mesh
 * is on LAYER.SHELL (kept out of ambient occlusion) and not pickable through its back face.
 */
export function shell(
  kit: SceneKit,
  geometry: THREE.BufferGeometry,
  color: string,
  o: ShellOptions,
  parent: THREE.Object3D = kit.scene,
): THREE.Group {
  const look = shellLook(kit, color, o);
  const group = new THREE.Group();
  group.name = 'shell';
  const add = (m: THREE.Material, order: number) => {
    const mesh = new THREE.Mesh(geometry, m);
    mesh.userData.layer = LAYER.SHELL;
    mesh.renderOrder = order;
    group.add(mesh);
    return mesh;
  };
  if (look.refract) add(look.refract, 0);
  if (look.back) {
    const b = add(look.back, 1);
    b.raycast = () => undefined;
  }
  if (look.front) add(look.front, 2);
  parent.add(group);
  return group;
}

/** A membrane (cell, envelope): muted --subject-biology unless a colour is given. */
export function membrane(
  kit: SceneKit,
  geometry: THREE.BufferGeometry,
  o: ShellOptions & { color?: string },
  parent?: THREE.Object3D,
): THREE.Group {
  return shell(
    kit,
    geometry,
    o.color ?? structureColor(tok.bind(null, kit), 'membrane'),
    o,
    parent,
  );
}

// ── Chromosomes ───────────────────────────────────────────────────────────────────────────

export interface ChromosomeOptions {
  /** Geometry carries baked vertex-colour AO (`bakeContactAO`). */
  vertexColors?: boolean;
}

/**
 * A chromosome (maternal / paternal segment colours stay exact as albedo): soft sheen, a faint
 * clear coat and an isotropic noise bump (no stripes — bands would be invented cytogenetics).
 */
export function chromosome(
  kit: SceneKit,
  color: string,
  o: ChromosomeOptions = {},
): THREE.MeshStandardMaterial {
  return kit.shared(`chromosome|${color}|${String(o.vertexColors ?? false)}`, () => {
    const base: THREE.MeshStandardMaterialParameters = {
      color,
      roughness: 0.55,
      metalness: 0,
      bumpMap: noiseTile(kit),
      bumpScale: 0.6,
      vertexColors: o.vertexColors ?? false,
    };
    if (!physical(kit)) return new THREE.MeshStandardMaterial(base);
    return new THREE.MeshPhysicalMaterial({
      ...base,
      sheen: 0.7,
      sheenColor: new THREE.Color(mixLinear(color, '#ffffff', 0.3)),
      sheenRoughness: 0.5,
      clearcoat: 0.1,
      clearcoatRoughness: 0.4,
    });
  });
}

/**
 * Bakes soft vertex-colour occlusion (down to `darkest`) on the side of a chromatid that faces
 * its sister (`towards`, a unit direction in the geometry's space).
 */
export function bakeContactAO(g: THREE.BufferGeometry, towards: Vec3, darkest = 0.85): void {
  const nor = g.attributes.normal as THREE.BufferAttribute | undefined;
  const pos = g.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const d = nor
      ? nor.getX(i) * towards[0] + nor.getY(i) * towards[1] + nor.getZ(i) * towards[2]
      : 0;
    const t = Math.min(1, Math.max(0, d));
    const shade = 1 - (1 - darkest) * t * t * (3 - 2 * t);
    colors[i * 3] = shade;
    colors[i * 3 + 1] = shade;
    colors[i * 3 + 2] = shade;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

/** The kinetochore: a small dark disc (the theme's text colour, matte). */
export function kinetochore(kit: SceneKit): THREE.MeshStandardMaterial {
  return kit.shared(
    'kinetochore',
    () => new THREE.MeshStandardMaterial({ color: tok(kit, '--text'), roughness: 0.5 }),
  );
}

// ── DNA / RNA ─────────────────────────────────────────────────────────────────────────────

export type Strand = 'coding' | 'template' | 'mrna';
const STRAND_TOKEN: Record<Strand, string> = {
  coding: '--dna3d-coding',
  template: '--dna3d-template',
  mrna: '--dna3d-mrna',
};

/** A backbone material (roughness 0.35, clear coat 0.5 on High). */
export function backboneMaterial(kit: SceneKit, strand: Strand): THREE.MeshStandardMaterial {
  const color = tok(kit, STRAND_TOKEN[strand]);
  return kit.shared(`backbone|${strand}|${color}`, () =>
    physical(kit)
      ? new THREE.MeshPhysicalMaterial({
          color,
          roughness: 0.35,
          clearcoat: 0.5,
          clearcoatRoughness: 0.3,
        })
      : new THREE.MeshStandardMaterial({ color, roughness: 0.35 }),
  );
}

/**
 * One continuous tube through backbone points (Catmull–Rom), e.g. the positions of `bdna.ts`.
 * The mRNA is thinner (`radius` × 0.75). The points are the model's; the tube only joins them.
 */
export function backboneGeometry(
  kit: SceneKit,
  points: readonly Vec3[],
  strand: Strand,
  radius: number,
): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const r = strand === 'mrna' ? radius * 0.75 : radius;
  const radial = Math.max(6, Math.round(kit.seg / 2));
  const tubular = Math.max(8, points.length * (kit.tier === 'high' ? 6 : 4));
  return kit.geometry(new THREE.TubeGeometry(curve, tubular, r, radial, false));
}

/** Purine bases are slabs, pyrimidines bars (the shape cue the lessons already use). */
export type BaseShape = 'slab' | 'bar';

/** A base's half of a base pair: its own base token as albedo (roughness 0.4, clear coat 0.3). */
export function basePairMaterial(kit: SceneKit, color: string): THREE.MeshStandardMaterial {
  return kit.shared(`basepair|${color}`, () =>
    physical(kit)
      ? new THREE.MeshPhysicalMaterial({
          color,
          roughness: 0.4,
          clearcoat: 0.3,
          clearcoatRoughness: 0.35,
        })
      : new THREE.MeshStandardMaterial({ color, roughness: 0.4 }),
  );
}

/**
 * Half of a base pair as a rounded slab from the backbone (x = 0) to the pair's midline (x = 1),
 * centred on y and z. A slab is wide (purine), a bar narrow (pyrimidine).
 */
export function basePairHalfGeometry(kit: SceneKit, shape: BaseShape): THREE.BufferGeometry {
  return kit.shared(`basepair-geo|${shape}`, () => {
    const g = kit.roundedBox(6).clone();
    const w = shape === 'slab' ? 0.34 : 0.22;
    g.scale(0.5, w, 0.1);
    g.translate(0.5, 0, 0);
    return g;
  });
}

// ── Proteins ──────────────────────────────────────────────────────────────────────────────

export interface ProteinOptions {
  seed: number;
  /** Body colour (default --bio3d-protein; an enzyme passes muted --chart-6). */
  color?: string;
  /** The inside must show (polymerase bubble, ribosome channel): opacity 0.55 + rim. */
  seeThrough?: boolean;
}

/** The lumpy blob geometry of a protein (cached per seed in the scene). */
export function proteinGeometry(kit: SceneKit, seed: number): THREE.BufferGeometry {
  return kit.shared(`blob|${String(seed)}|${kit.tier}`, () => proteinBlob(kit.tier, { seed }));
}

/**
 * A protein body (roughness 0.62, soft sheen, faint clear coat, cavity shading from vertex
 * colours). Its data state (free / ES / EI…) is shown by what is bound and by `stateRing`, never
 * by recolouring the body.
 */
export function proteinMaterial(
  kit: SceneKit,
  o: Omit<ProteinOptions, 'seed'> = {},
): THREE.MeshStandardMaterial {
  const color = o.color ?? structureColor(tok.bind(null, kit), 'protein');
  const see = o.seeThrough ?? false;
  return kit.shared(`protein|${color}|${String(see)}`, () => {
    const base: THREE.MeshStandardMaterialParameters = {
      color,
      roughness: 0.62,
      metalness: 0,
      vertexColors: true,
      ...(see ? { transparent: true, opacity: 0.55, depthWrite: false } : {}),
    };
    const m = physical(kit)
      ? new THREE.MeshPhysicalMaterial({
          ...base,
          sheen: 0.35,
          sheenRoughness: 0.6,
          sheenColor: new THREE.Color(mixLinear(color, '#ffffff', 0.4)),
          clearcoat: 0.1,
          clearcoatRoughness: 0.5,
        })
      : new THREE.MeshStandardMaterial(base);
    return see ? withRim(m, { color, strength: 0.4, alpha: 0.35 }) : m;
  });
}

/** A protein mesh: see-through bodies are drawn after the opaque ones and kept out of AO. */
export function protein(
  kit: SceneKit,
  o: ProteinOptions,
  parent: THREE.Object3D = kit.scene,
): THREE.Mesh {
  const mesh = kit.mesh(proteinGeometry(kit, o.seed), proteinMaterial(kit, o), parent);
  if (o.seeThrough) {
    mesh.userData.layer = LAYER.SHELL;
    mesh.renderOrder = 3;
  }
  return mesh;
}

export interface ProteinShellOptions {
  seed: number;
  /** Body colour (default --bio3d-protein). */
  color?: string;
  /** Opacity (default 0.55: what is inside must show). */
  opacity?: number;
  /**
   * Cut the shell open (world-space plane: what lies on its negative side is not drawn) so the
   * inside faces the camera; the inner wall is drawn too, darker in its hollows.
   */
  cut?: THREE.Plane;
}

/**
 * A see-through protein whose inside must show (RNA polymerase around its bubble, a ribosome
 * subunit around its tRNAs): the seeded blob at opacity 0.55 with a rim, fine grain that catches
 * the light, soft sheen and a faint clear coat on High. Its material is its own (the view fades
 * it and makes it glow when picked), and it may be cut open by a plane: the inner wall is then
 * drawn darker, so the hollow reads as a hollow. Drawn after the opaque parts, kept out of
 * ambient occlusion. Illustration only.
 */
export function proteinShell(
  kit: SceneKit,
  o: ProteinShellOptions,
  parent: THREE.Object3D = kit.scene,
): THREE.Mesh {
  const color = o.color ?? structureColor(tok.bind(null, kit), 'protein');
  const base: THREE.MeshStandardMaterialParameters = {
    color,
    roughness: 0.55,
    metalness: 0,
    vertexColors: true,
    transparent: true,
    opacity: o.opacity ?? 0.55,
    depthWrite: false,
    ...(o.cut ? { side: THREE.DoubleSide, clippingPlanes: [o.cut] } : {}),
  };
  const m = physical(kit)
    ? new THREE.MeshPhysicalMaterial({
        ...base,
        sheen: 0.35,
        sheenRoughness: 0.6,
        sheenColor: new THREE.Color(mixLinear(color, '#ffffff', 0.4)),
        clearcoat: 0.15,
        clearcoatRoughness: 0.45,
      })
    : new THREE.MeshStandardMaterial(base);
  // On the light stage a darker outline (--m3d-shell-ink) keeps the pale shell readable.
  const ink = themeNumber(kit, '--m3d-shell-ink', 0);
  const rim = {
    color,
    strength: 0.45,
    alpha: 0.4,
    ...(ink > 0
      ? {
          ink: { color: deepen(color, 0.28, 3.4, 0.085), amount: 0.8 * ink, power: 1.8, fill: 0.4 },
        }
      : {}),
  };
  // The rim replaces the shader hook; relief and the inner wall chain onto it.
  const mat = kit.own(withRelief(withRim(m, rim), { frequency: 5, height: 0.018 }));
  if (o.cut) innerWall(mat, 0.45);
  const mesh = kit.mesh(proteinGeometry(kit, o.seed), mat, parent);
  mesh.userData.layer = LAYER.SHELL;
  mesh.renderOrder = 3;
  return mesh;
}

/** Darkens the back faces of a cut-open shell (its inner wall) by `shade` (lighting only). */
function innerWall(material: THREE.MeshStandardMaterial, shade: number): void {
  const previous = material.onBeforeCompile.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
diffuseColor.rgb *= gl_FrontFacing ? 1.0 : ${shade.toFixed(3)};`,
    );
  };
  const key = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${key()}|simlab-inner`;
}

/** A thin ring in a role's colour around a protein: its data state (bound substrate, inhibitor). */
export function stateRing(kit: SceneKit, role: BioRole): THREE.MeshStandardMaterial {
  const color = tok(kit, ROLES[role].token);
  return kit.shared(
    `ring|${color}`,
    () => new THREE.MeshStandardMaterial({ color, roughness: 0.4 }),
  );
}

// ── Particles ─────────────────────────────────────────────────────────────────────────────

export type ParticleRole = 'solute' | 'substrate' | 'product' | 'inhibitor' | 'water';

/** Particle size relative to a solute (water is drawn smaller). */
export const PARTICLE_SCALE: Record<ParticleRole, number> = {
  solute: 1,
  substrate: 1,
  product: 1,
  inhibitor: 1,
  water: 0.7,
};

/**
 * Instanced particles: the role's token as albedo (roughness 0.3, clear coat 0.6); water is a
 * muted --chart-6, matte (roughness 0.5), so solutes stand out.
 */
export function particleMaterial(kit: SceneKit, role: ParticleRole): THREE.MeshStandardMaterial {
  const water = role === 'water';
  const token = tok(kit, ROLES[role].token);
  const color = water ? structureColor(tok.bind(null, kit), 'nucleus') : token;
  return kit.shared(`particle|${role}|${color}`, () =>
    physical(kit) && !water
      ? new THREE.MeshPhysicalMaterial({
          color,
          roughness: 0.3,
          clearcoat: 0.6,
          clearcoatRoughness: 0.2,
        })
      : new THREE.MeshStandardMaterial({ color, roughness: water ? 0.5 : 0.3 }),
  );
}

// ── Glassware and liquids ─────────────────────────────────────────────────────────────────

/**
 * Glass (tubes, jar, tank walls with real thickness — no wire-box edges). High on a discrete GPU:
 * physical transmission 1, thickness 0.05, roughness 0.05, IOR 1.5 (one draw). Otherwise the
 * see-through look of a shell (back face + rimmed front).
 */
export function glassware(kit: SceneKit): ShellLook {
  const color = structureColor(tok.bind(null, kit), 'glass');
  if (kit.transmission) {
    const m = new THREE.MeshPhysicalMaterial({
      color,
      transmission: 1,
      thickness: 0.05,
      roughness: 0.05,
      ior: 1.5,
      metalness: 0,
      specularIntensity: 1,
    });
    return { refract: kit.own(m), back: null, front: null };
  }
  const look = shellLook(kit, color, { radius: 1, opacity: 0.12, rim: 0.8 });
  return look;
}

/** A liquid in glassware: --bio3d-liquid at opacity 0.85. */
export function liquid(kit: SceneKit): THREE.MeshStandardMaterial {
  const color = structureColor(tok.bind(null, kit), 'liquid');
  return kit.shared(
    `liquid|${color}`,
    () =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.15,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
  );
}

/**
 * A concave meniscus cap for a liquid column of `radius` (top surface at y = 0, dipping `depth`
 * in the middle): a shallow bowl, facing up.
 */
export function meniscusGeometry(
  kit: SceneKit,
  radius: number,
  depth: number,
): THREE.BufferGeometry {
  const rings = 6;
  const sides = Math.max(12, kit.seg);
  // A lathe of the profile y(r) = −depth (1 − (r/R)²).
  const profile: THREE.Vector2[] = [];
  for (let i = 0; i <= rings; i++) {
    const r = (radius * i) / rings;
    profile.push(new THREE.Vector2(r, -depth * (1 - (r / radius) ** 2)));
  }
  const bowl = new THREE.LatheGeometry(profile, sides);
  return kit.geometry(bowl);
}

// ── Organisms and terrain (habitats) ──────────────────────────────────────────────────────

export type OrganismKind = 'prey' | 'predator';

/**
 * One merged low-poly figure with vertex colours: white body (tinted per instance by the data
 * token: the tint multiplies, so the eyes stay dark), dark eyes, neutral feet. Flat shaded.
 */
export function organismGeometry(kit: SceneKit, kind: OrganismKind): THREE.BufferGeometry {
  return kit.shared(`organism|${kind}`, () => {
    const big = kind === 'predator';
    const k = big ? 1.3 : 1;
    const parts: THREE.BufferGeometry[] = [];
    const add = (g: THREE.BufferGeometry, shade: number, at: Vec3, scale: Vec3, tilt = 0) => {
      const flat = g.toNonIndexed();
      g.dispose();
      flat.deleteAttribute('uv');
      flat.applyMatrix4(
        new THREE.Matrix4().compose(
          new THREE.Vector3(...at),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, 0, 0)),
          new THREE.Vector3(...scale),
        ),
      );
      const n = flat.attributes.position?.count ?? 0;
      flat.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(shade), 3));
      parts.push(flat);
    };
    add(new THREE.IcosahedronGeometry(1, 1), 1, [0, 0.36 * k, 0], [0.42 * k, 0.32 * k, 0.6 * k]);
    add(
      new THREE.IcosahedronGeometry(1, 1),
      1,
      [0, 0.62 * k, 0.5 * k],
      [0.26 * k, 0.24 * k, 0.26 * k],
    );
    for (const side of [-1, 1]) {
      // Eyes (dark), ears (body), feet (neutral).
      add(
        new THREE.IcosahedronGeometry(1, 0),
        0.08,
        [side * 0.1 * k, 0.68 * k, 0.72 * k],
        [0.05 * k, 0.05 * k, 0.04 * k],
      );
      add(
        big ? new THREE.ConeGeometry(0.08, 0.24, 5) : new THREE.IcosahedronGeometry(1, 0),
        1,
        [side * 0.12 * k, 0.9 * k, 0.45 * k],
        big ? [k, k, k] : [0.06, 0.18, 0.07],
        -0.3,
      );
      for (const z of [-0.3, 0.3]) {
        add(
          new THREE.BoxGeometry(1, 1, 1),
          0.55,
          [side * 0.22 * k, 0.05 * k, z * k],
          [0.1 * k, 0.1 * k, 0.12 * k],
        );
      }
    }
    const merged = mergeGeometries(parts);
    for (const p of parts) p.dispose();
    merged.computeVertexNormals();
    merged.computeBoundingSphere();
    return merged;
  });
}

/** Organism material: flat shaded, matte; the instance colour (data token) tints the body. */
export function organismMaterial(kit: SceneKit): THREE.MeshStandardMaterial {
  return kit.shared(
    'organism-mat',
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.8,
        flatShading: true,
        vertexColors: true,
      }),
  );
}

export interface TerrainOptions {
  radius: number;
  seed: number;
  /** Height of the gentle hills (world units). */
  relief?: number;
}

/**
 * A round patch of ground: low hills from seeded noise, rising slightly at the rim; vertex colours
 * blend grass / grass-2 by noise, soil on slopes and rock on the highest ground. Flat shaded,
 * matte (roughness 0.95, weak reflections). Returns the height function for placing things on it.
 */
export function terrain(
  kit: SceneKit,
  o: TerrainOptions,
): {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
  heightAt: (x: number, z: number) => number;
} {
  const relief = o.relief ?? o.radius * 0.03;
  const heightAt = (x: number, z: number) => {
    const r = Math.hypot(x, z) / o.radius;
    const rim = Math.max(0, r - 0.82) / 0.18;
    return (
      relief *
      (0.5 * fbm3(x / (o.radius * 0.35), 0, z / (o.radius * 0.35), o.seed) + 1.6 * rim * rim)
    );
  };
  const rings = Math.max(8, Math.round(kit.seg * 0.75));
  const sides = Math.max(24, kit.seg * 3);
  const ring = new THREE.RingGeometry(0, o.radius, sides, rings);
  ring.rotateX(-Math.PI / 2);
  const flat = ring.toNonIndexed();
  ring.dispose();
  const pos = flat.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  flat.computeVertexNormals();
  const nor = flat.attributes.normal as THREE.BufferAttribute;
  const c = (name: string) => new THREE.Color(tok(kit, name));
  const grass = c('--bio3d-grass');
  const grass2 = c('--bio3d-grass-2');
  const soil = c('--bio3d-soil');
  const rock = c('--bio3d-rock');
  const colors = new Float32Array(pos.count * 3);
  const col = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const mix = 0.5 + 0.5 * fbm3(x / (o.radius * 0.2), 5, z / (o.radius * 0.2), o.seed + 3);
    col.copy(grass).lerp(grass2, mix);
    const slope = 1 - Math.abs(nor.getY(i));
    col.lerp(soil, Math.min(1, Math.max(0, (slope - 0.12) / 0.25)));
    const high = (pos.getY(i) - relief * 1.2) / Math.max(1e-6, relief);
    col.lerp(rock, Math.min(1, Math.max(0, high)));
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  flat.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  flat.computeBoundingSphere();
  const material = kit.shared(
    'terrain-mat',
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        flatShading: true,
        roughness: 0.95,
        envMapIntensity: 0.3,
      }),
  );
  return { geometry: kit.geometry(flat), material, heightAt };
}

// ── Annotation and highlight ──────────────────────────────────────────────────────────────

/** Rulers, rings, plates: solid --text-muted, roughness 0.6 (ticks are geometry, numbers DOM). */
export function annotation(kit: SceneKit): THREE.MeshStandardMaterial {
  const color = structureColor(tok.bind(null, kit), 'annotation');
  return kit.shared(
    `annotation|${color}`,
    () => new THREE.MeshStandardMaterial({ color, roughness: 0.6 }),
  );
}

/** Emissive strength of a highlight: ×1 on Medium; ×3 in HDR (the only thing that blooms). */
export function highlightIntensity(kit: SceneKit): number {
  return kit.hdr ? 3 : 1;
}

/**
 * Makes `material` glow in --m3d-highlight (the one attention cue at a time). In HDR it is marked
 * to bloom; the host runs bloom only while such a material is visible.
 */
export function highlight<M extends THREE.MeshStandardMaterial>(
  kit: SceneKit,
  material: M,
  strength = 1,
): M {
  material.emissive.set(tok(kit, '--m3d-highlight'));
  material.emissiveIntensity = strength * highlightIntensity(kit);
  material.userData.bloom = kit.hdr;
  return material;
}
