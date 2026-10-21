/**
 * Scene building blocks for the biology 3D views: one `SceneKit` per built scene owns every
 * geometry, material, texture and label it hands out and frees them all in `dispose()`. Shared
 * pieces (unit sphere, unit cylinder, rounded box, materials of a colour) are made once per
 * scene. The studio look (light rig) is added on creation; the environment map comes from the
 * view (it needs the renderer).
 */
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { QualityTier } from '@/perf/tiers';
import { enableKeyShadow, type LookPreset } from '@/ui/three/lighting';
import { contactShadow, disposeLightRig, lightRig } from './look';
import { glass, roundedBox, solid, type GlassOptions, type SolidOptions } from './materials';

import type { Vec3 } from './numbers';

export type { Vec3 };

/**
 * White: the base colour of a material whose instances carry their own colours (theme tokens set
 * per instance multiply it). Not a design colour.
 */
export const NEUTRAL = '#ffffff';

export interface KitOptions {
  tier: QualityTier;
  /** Sphere segments of the tier. */
  segments: number;
  /** Most individual objects (particles, organisms) the tier draws. */
  maxParticles: number;
  /** Reads a CSS colour token (e.g. '--chart-1'). */
  token: (name: string) => string;
  /** Light preset: studio (cells, molecules, lab objects; default) or outdoor (habitats). */
  look?: LookPreset | undefined;
  /** The outermost shell and glassware may refract (High tier on a discrete GPU). */
  transmission?: boolean;
  /** Highlights glow in HDR and bloom (High tier on a discrete GPU). */
  hdr?: boolean;
  /** Shadow maps for grounded opaque subjects (High tier on a discrete GPU). */
  shadows?: boolean;
}

/**
 * What the camera frames: a sphere holding the subject (orbit centre and zoom limits) and,
 * optionally, points of its outline for a tighter fit (flat subjects).
 */
export interface Bounds {
  center: Vec3;
  radius: number;
  points?: Vec3[];
}

export interface Bio3DScene {
  kit: SceneKit;
  bounds: Bounds;
  /** Moves the scene to time t (s, the lesson's own time); no allocation. */
  setTime?: (t: number) => void;
  /** Illustrative motion (Brownian particles): advances by dt seconds of animation. */
  tick?: (dt: number) => void;
  /** The motion stopped: show the resting picture (transitions finished). */
  rest?: () => void;
  /** What a tap's ray hits: an id the lesson defines, or null (nothing pickable). */
  pick?: (ray: THREE.Raycaster) => string | null;
  /** Marks the picked part (null: none). */
  select?: (id: string | null) => void;
  /** What the scene draws now, read back from it (development test hooks). */
  state?: () => unknown;
}

/** CSS classes of the kit's labels: the same tag look as every other 3D view. */
const LABEL_CLASS = {
  plain: 'three-label',
  strong: 'three-label three-label--title',
  muted: 'three-tag three-tag--tick',
} as const;

export class SceneKit {
  readonly scene = new THREE.Scene();
  readonly tier: QualityTier;
  readonly seg: number;
  readonly maxParticles: number;
  readonly look: LookPreset;
  readonly transmission: boolean;
  readonly hdr: boolean;
  readonly shadows: boolean;
  /** The scene's light rig (`fitShadow` frames its sun on a habitat). */
  readonly rig: THREE.Group;
  private readonly token: (name: string) => string;
  private readonly owned: { dispose: () => void }[] = [];
  private readonly materials = new Map<string, THREE.Material>();
  private readonly geometries = new Map<string, THREE.BufferGeometry>();

  constructor(o: KitOptions) {
    this.tier = o.tier;
    this.seg = Math.max(8, Math.round(o.segments));
    this.maxParticles = Math.max(1, Math.floor(o.maxParticles));
    this.token = o.token;
    this.look = o.look ?? 'studio';
    this.transmission = o.transmission ?? false;
    this.hdr = o.hdr ?? false;
    this.shadows = o.shadows ?? false;
    const outdoor = this.look === 'outdoor';
    const rig = lightRig({
      preset: this.look,
      size: 12,
      shadows: outdoor && this.shadows,
      ...(outdoor ? { sky: o.token('--bio3d-sky-top'), ground: o.token('--bio3d-soil') } : {}),
    });
    this.rig = rig;
    this.scene.add(rig);
    this.owned.push({
      dispose: () => {
        disposeLightRig(rig);
      },
    });
  }

  /** A theme colour (CSS token value). */
  color(name: string): string {
    return this.token(name);
  }

  keep<T extends { dispose: () => void }>(x: T): T {
    this.owned.push(x);
    return x;
  }

  /**
   * A material or geometry made once per scene under `key` (recipes share them; the kit frees
   * them).
   */
  shared<T extends THREE.Material | THREE.BufferGeometry>(key: string, make: () => T): T {
    return this.cached(this.sharedStore, key, make);
  }

  private readonly sharedStore = new Map<string, THREE.Material | THREE.BufferGeometry>();

  private cached<T extends THREE.Material | THREE.BufferGeometry>(
    map: Map<string, THREE.Material | THREE.BufferGeometry>,
    key: string,
    make: () => T,
  ): T {
    const hit = map.get(key);
    if (hit) return hit as T;
    const made = make();
    map.set(key, made);
    return made;
  }

  /** Opaque, environment-lit material (shared per colour and options). */
  solid(color: string, o: SolidOptions = {}): THREE.MeshStandardMaterial {
    return this.cached(this.materials, `s|${color}|${JSON.stringify(o)}`, () =>
      solid(color, this.tier, o),
    );
  }

  /** See-through material with a Fresnel outline (shared per colour and options). */
  glass(color: string, o: GlassOptions): THREE.MeshStandardMaterial {
    return this.cached(this.materials, `g|${color}|${JSON.stringify(o)}`, () => glass(color, o));
  }

  /** A material only this caller uses (its own opacity or colour changes over time). */
  own<M extends THREE.Material>(m: M): M {
    this.owned.push(m);
    return m;
  }

  /** Unit sphere (radius 1). */
  sphere(detail = 1): THREE.BufferGeometry {
    const s = Math.max(8, Math.round(this.seg * detail));
    return this.cached(
      this.geometries,
      `sphere|${String(s)}`,
      () => new THREE.SphereGeometry(1, s, Math.round(s * 0.75)),
    );
  }

  /** Unit cylinder: radius 1, height 1 along +y, centred. */
  cylinder(sides = Math.max(8, Math.round(this.seg / 2)), open = false): THREE.BufferGeometry {
    return this.cached(
      this.geometries,
      `cyl|${String(sides)}|${String(open)}`,
      () => new THREE.CylinderGeometry(1, 1, 1, sides, 1, open),
    );
  }

  /** Box with rounded edges spanning [−1, 1]³. */
  roundedBox(power = 8): THREE.BufferGeometry {
    return this.cached(this.geometries, `rbox|${String(power)}`, () =>
      roundedBox(this.seg * 2, power),
    );
  }

  /** Capsule of radius r and total length l, along +y. */
  capsule(r: number, l: number): THREE.BufferGeometry {
    return this.cached(
      this.geometries,
      `cap|${r.toFixed(3)}|${l.toFixed(3)}`,
      () => new THREE.CapsuleGeometry(r, Math.max(0.001, l - 2 * r), 3, Math.max(6, this.seg / 2)),
    );
  }

  /** A geometry only this caller uses (built from the lesson's data). */
  geometry<G extends THREE.BufferGeometry>(g: G): G {
    this.owned.push(g);
    return g;
  }

  mesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    parent: THREE.Object3D = this.scene,
  ): THREE.Mesh {
    const m = new THREE.Mesh(geometry, material);
    parent.add(m);
    return m;
  }

  /** `count` copies of one shape in one draw call (positions/colours set by the caller). */
  instanced(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    count: number,
    parent: THREE.Object3D = this.scene,
  ): THREE.InstancedMesh {
    const m = new THREE.InstancedMesh(geometry, material, Math.max(1, count));
    m.count = count;
    m.frustumCulled = false;
    parent.add(m);
    this.owned.push({
      dispose: () => {
        m.dispose();
      },
    });
    return m;
  }

  /**
   * Shadow maps from the studio key light onto a grounded subject (a bench, a tank's base) held
   * in a sphere of `radius` around `center`: only when the kit draws shadows (High tier on a
   * discrete GPU). Returns whether they are on; callers then mark what casts and receives.
   */
  groundShadows(center: Vec3, radius: number): boolean {
    if (!this.shadows) return false;
    enableKeyShadow(this.rig, center, radius);
    return true;
  }

  /** Soft shadow ellipse on the floor at height y. */
  shadow(y: number, rx: number, rz: number, opacity = 0.28): THREE.Mesh {
    const s = contactShadow(y, rx, rz, opacity);
    this.scene.add(s.mesh);
    this.owned.push(s);
    return s.mesh;
  }

  /**
   * A text label drawn by the page (sharp at any zoom) at a point of the scene. The text comes
   * from the lesson (its model's names and values), never invented here.
   */
  label(text: string, at: Vec3, variant: 'plain' | 'strong' | 'muted' = 'plain'): CSS2DObject {
    const el = document.createElement('div');
    // The shared 3D tag look (ui.css): a glass pill, a heading pill, or a muted tick.
    el.className = LABEL_CLASS[variant];
    el.textContent = text;
    const o = new CSS2DObject(el);
    o.position.set(...at);
    this.scene.add(o);
    return o;
  }

  /** Frees everything made through the kit and empties the scene. */
  dispose(): void {
    for (const m of this.materials.values()) m.dispose();
    for (const g of this.geometries.values()) g.dispose();
    for (const x of this.sharedStore.values()) x.dispose();
    this.sharedStore.clear();
    for (const o of this.owned) o.dispose();
    this.materials.clear();
    this.geometries.clear();
    this.owned.length = 0;
    // Removing a CSS2D label also removes its element from the page.
    this.scene.clear();
  }
}

export { discPoints, representative } from './numbers';
