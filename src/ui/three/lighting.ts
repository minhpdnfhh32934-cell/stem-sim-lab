/**
 * The "studio" look shared by the 3D views: a soft prefiltered environment (reflections
 * and ambient light for the PBR materials), a key / fill / rim light rig, and a soft contact
 * shadow that grounds an object without a shadow map. Lighting only changes how things look,
 * never a count or a position.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { isWebGLRenderer, type RendererLike } from './renderer';

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

/**
 * Key light (warm, high front right), fill (cool, low left), rim (behind, outlines the shapes
 * against the background in both themes) and a faint sky/ground ambient. Returned as one group.
 */
export function lightRig(opts: { shadows?: boolean; size?: number } = {}): THREE.Group {
  const size = opts.size ?? 10;
  const rig = new THREE.Group();
  rig.name = 'light-rig';
  rig.add(new THREE.HemisphereLight(0xf4f7ff, 0x3a3f4a, 0.45));
  const key = new THREE.DirectionalLight(0xfff3e4, 2.1);
  key.position.set(0.6 * size, 1.1 * size, 0.9 * size);
  const fill = new THREE.DirectionalLight(0xdce8ff, 0.7);
  fill.position.set(-1.0 * size, 0.2 * size, 0.6 * size);
  const rim = new THREE.DirectionalLight(0xffffff, 1.5);
  rim.position.set(-0.3 * size, 0.8 * size, -1.1 * size);
  if (opts.shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const cam = key.shadow.camera;
    cam.left = -size;
    cam.right = size;
    cam.top = size;
    cam.bottom = -size;
    cam.near = 0.1;
    cam.far = 4 * size;
    key.shadow.bias = -0.0005;
    key.shadow.radius = 4;
  }
  rig.add(key, fill, rim);
  return rig;
}

/** Shadow maps the rig's key light makes (disposed with the scene that owns the rig). */
export function disposeLightRig(rig: THREE.Group): void {
  rig.traverse((o) => {
    if (o instanceof THREE.DirectionalLight) o.shadow.map?.dispose();
  });
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
 * pickable; drawn before see-through parts and never writes depth.
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
