/**
 * The light of the 3D views. Two presets (one look for every lesson):
 *
 * - STUDIO (cells, molecules, lab objects): a warm key high on the right, a cool low fill from the
 *   left, a rim from behind that outlines shapes against the backdrop (stronger and tinted in the
 *   dark theme), a faint sky/ground ambient, and a prefiltered "room" environment whose bright
 *   panel reflects from the upper left in every lesson.
 * - OUTDOOR (habitats): a warm sun that may cast shadow maps (High on a discrete GPU), a sky/soil
 *   hemisphere, a weak back light, a dimmer environment and fog towards the horizon.
 *
 * Kelvin values are light temperatures (physical constants), not UI colours. Lighting only changes
 * how things look, never a count or a position. The rig lives in the scene; the view's host applies
 * the theme-dependent part (`applyStageLook`) whenever it is given a scene.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { kelvinLinear } from './color';
import { LAYER } from './layers';
import { isWebGLRenderer, type RendererLike } from './renderer';

export type LookPreset = 'studio' | 'outdoor';
export type StageTheme = 'light' | 'dark';

const DEG = Math.PI / 180;

/** Style-guide values of the two presets. */
export const LOOK = {
  studio: {
    hemisphere: 0.25,
    key: { kelvin: 5200, intensity: 2.4, azimuth: 40, elevation: 50 },
    fill: { kelvin: 7500, intensity: 0.45, azimuth: -65, elevation: 10 },
    rim: { intensity: { light: 1.8, dark: 2.4 }, tint: { light: 0, dark: 0.3 }, elevation: 30 },
    environment: { light: 0.7, dark: 0.5 },
    exposure: { light: 1, dark: 1.05 },
  },
  outdoor: {
    hemisphere: 0.6,
    key: { kelvin: 4800, intensity: 3, azimuth: 35, elevation: 55 },
    back: { intensity: 0.5, azimuth: 215, elevation: 25 },
    environment: { light: 0.35, dark: 0.35 },
    exposure: { light: 1, dark: 1.05 },
  },
  /** The environment's bright panel reflects from the upper left in every lesson. */
  environmentRotationY: -30 * DEG,
} as const;

export interface Environment {
  /** Prefiltered environment map, or null without a real WebGL renderer (tests). */
  texture: THREE.Texture | null;
  dispose(): void;
}

/** One environment per renderer (shared by every scene the renderer draws). */
export function createEnvironment(renderer: RendererLike): Environment {
  if (!isWebGLRenderer(renderer)) return { texture: null, dispose: () => undefined };
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const target = pmrem.fromScene(room, 0.04);
  room.dispose();
  pmrem.dispose();
  return {
    texture: target.texture,
    dispose: () => {
      target.dispose();
    },
  };
}

/** Unit direction of a light at `azimuth` (from +z towards +x) and `elevation` (degrees). */
export function lightDirection(azimuth: number, elevation: number): THREE.Vector3 {
  const a = azimuth * DEG;
  const e = elevation * DEG;
  return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
}

const kelvin = (k: number) =>
  new THREE.Color().setRGB(...kelvinLinear(k), THREE.LinearSRGBColorSpace);

export interface RigOptions {
  preset?: LookPreset;
  /** Shadow maps from the key light / sun (High on a discrete GPU, grounded subjects only). */
  shadows?: boolean;
  /** Distance of the lights and half-size of the shadow camera (world units). */
  size?: number;
  /** Outdoor hemisphere colours (theme tokens: sky above, soil below). */
  sky?: string;
  ground?: string;
}

/** Roles of the rig's lights (userData.role), for `applyStageLook` and tests. */
export type LightRole = 'hemisphere' | 'key' | 'fill' | 'rim' | 'back';

function place(light: THREE.DirectionalLight, az: number, el: number, size: number): void {
  light.position.copy(lightDirection(az, el).multiplyScalar(size * 1.5));
}

/**
 * The preset's lights as one group (`light-rig`). Studio: hemisphere, key, fill, rim. Outdoor:
 * hemisphere (sky / soil), sun (key) and a weak back light.
 */
export function lightRig(opts: RigOptions = {}): THREE.Group {
  const preset = opts.preset ?? 'studio';
  const size = opts.size ?? 10;
  const rig = new THREE.Group();
  rig.name = 'light-rig';
  rig.userData.preset = preset;
  const tag = <L extends THREE.Light>(l: L, role: LightRole): L => {
    l.userData.role = role;
    rig.add(l);
    return l;
  };
  let key: THREE.DirectionalLight;
  if (preset === 'outdoor') {
    const o = LOOK.outdoor;
    tag(
      new THREE.HemisphereLight(opts.sky ?? 0xffffff, opts.ground ?? 0x808080, o.hemisphere),
      'hemisphere',
    );
    key = tag(new THREE.DirectionalLight(kelvin(o.key.kelvin), o.key.intensity), 'key');
    place(key, o.key.azimuth, o.key.elevation, size);
    const back = tag(new THREE.DirectionalLight(0xffffff, o.back.intensity), 'back');
    place(back, o.back.azimuth, o.back.elevation, size);
  } else {
    const s = LOOK.studio;
    tag(new THREE.HemisphereLight(0xf4f7ff, 0x3a3f4a, s.hemisphere), 'hemisphere');
    key = tag(new THREE.DirectionalLight(kelvin(s.key.kelvin), s.key.intensity), 'key');
    place(key, s.key.azimuth, s.key.elevation, size);
    const fill = tag(new THREE.DirectionalLight(kelvin(s.fill.kelvin), s.fill.intensity), 'fill');
    place(fill, s.fill.azimuth, s.fill.elevation, size);
    // Opposite the key, from behind.
    const rim = tag(new THREE.DirectionalLight(0xffffff, s.rim.intensity.light), 'rim');
    place(rim, s.key.azimuth + 180, s.rim.elevation, size);
  }
  if (opts.shadows) enableKeyShadow(rig, [0, 0, 0], size);
  return rig;
}

/**
 * Lets the rig's key light cast shadow maps (1024², soft PCF) fitted to a subject's bounding
 * sphere. Used by habitats (outdoor) and by grounded studio subjects (a bench, a tank's base);
 * the renderer draws them only where its shadow map is on (High on a discrete GPU).
 */
export function enableKeyShadow(
  rig: THREE.Object3D,
  center: readonly [number, number, number],
  radius: number,
): void {
  const key = rigLight(rig, 'key');
  if (!(key instanceof THREE.DirectionalLight)) return;
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  fitShadow(rig, center, radius);
}

/** The rig's light with a role, if any. */
export function rigLight(rig: THREE.Object3D, role: LightRole): THREE.Light | undefined {
  let found: THREE.Light | undefined;
  rig.traverse((o) => {
    if (!found && o instanceof THREE.Light && o.userData.role === role) found = o;
  });
  return found;
}

/**
 * Fits the key light's shadow camera to a subject's bounding sphere (the habitat, the board): the
 * light looks at the centre from its own direction, and the camera just holds the sphere.
 */
export function fitShadow(
  rig: THREE.Object3D,
  center: readonly [number, number, number],
  radius: number,
): void {
  const key = rigLight(rig, 'key');
  if (!(key instanceof THREE.DirectionalLight)) return;
  const dir = key.position.clone().sub(key.target.position).normalize();
  const c = new THREE.Vector3(...center);
  key.position.copy(c).addScaledVector(dir, radius * 3);
  key.target.position.copy(c);
  if (!key.target.parent) rig.add(key.target);
  const cam = key.shadow.camera;
  const r = radius * 1.1;
  cam.left = -r;
  cam.right = r;
  cam.top = r;
  cam.bottom = -r;
  cam.near = radius * 0.5;
  cam.far = radius * 5.5;
  cam.updateProjectionMatrix();
}

/** Shadow maps the rig's key light makes (disposed with the scene that owns the rig). */
export function disposeLightRig(rig: THREE.Group): void {
  rig.traverse((o) => {
    if (o instanceof THREE.DirectionalLight) o.shadow.map?.dispose();
  });
}

export interface StageLook {
  theme: StageTheme;
  /** Rim tint of the dark theme (a theme token's value), or '' for none. */
  rimTint: string;
  /** The quality tier's scale of the environment intensity. */
  envScale: number;
}

/**
 * Applies the theme-dependent part of a scene's look: rim strength and tint, environment
 * intensity and rotation. Returns the preset found (studio when the scene has no rig) and the
 * exposure the renderer should use.
 */
export function applyStageLook(
  scene: THREE.Scene,
  look: StageLook,
): { preset: LookPreset; exposure: number } {
  const rig = scene.getObjectByName('light-rig');
  const preset: LookPreset = rig?.userData.preset === 'outdoor' ? 'outdoor' : 'studio';
  if (rig && preset === 'studio') {
    const rim = rigLight(rig, 'rim');
    if (rim) {
      const s = LOOK.studio.rim;
      rim.intensity = s.intensity[look.theme];
      rim.color.set(0xffffff);
      const amount = s.tint[look.theme];
      if (amount > 0 && /^#[0-9a-f]{3,6}$/i.test(look.rimTint)) {
        rim.color.lerp(new THREE.Color(look.rimTint), amount);
      }
    }
  }
  scene.environmentIntensity = LOOK[preset].environment[look.theme] * look.envScale;
  scene.environmentRotation.set(0, LOOK.environmentRotationY, 0);
  return { preset, exposure: LOOK[preset].exposure[look.theme] };
}

const SHADOW_SIZE = 64;

/** A radial fall-off texture (white, alpha 1 → 0), built from numbers: no canvas needed. */
function shadowTexture(): THREE.DataTexture {
  const data = new Uint8Array(SHADOW_SIZE * SHADOW_SIZE * 4);
  for (let y = 0; y < SHADOW_SIZE; y++) {
    for (let x = 0; x < SHADOW_SIZE; x++) {
      const dx = (x + 0.5) / SHADOW_SIZE - 0.5;
      const dy = (y + 0.5) / SHADOW_SIZE - 0.5;
      const r = Math.min(1, Math.hypot(dx, dy) * 2);
      // Smooth (Gaussian-like) edge.
      const a = Math.exp(-4.5 * r * r) * (1 - r);
      const k = 4 * (y * SHADOW_SIZE + x);
      data[k] = 0;
      data[k + 1] = 0;
      data[k + 2] = 0;
      data[k + 3] = Math.round(255 * a);
    }
  }
  const tex = new THREE.DataTexture(data, SHADOW_SIZE, SHADOW_SIZE, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

export interface ContactShadow {
  mesh: THREE.Mesh;
  dispose(): void;
}

/**
 * A soft dark ellipse on a horizontal plane at height `y`, `rx` × `rz` wide (world units). Not
 * pickable; drawn before see-through parts and never writes depth; kept out of the ambient
 * occlusion pass (LAYER.FX).
 */
export function contactShadow(y: number, rx: number, rz: number, opacity = 0.32): ContactShadow {
  const geometry = new THREE.PlaneGeometry(2, 2);
  const map = shadowTexture();
  const material = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    depthWrite: false,
    opacity,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'contact-shadow';
  mesh.userData.layer = LAYER.FX;
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.scale.set(rx, rz, 1);
  mesh.renderOrder = -1;
  mesh.raycast = () => undefined;
  return {
    mesh,
    dispose: () => {
      geometry.dispose();
      material.dispose();
      map.dispose();
    },
  };
}
