import * as THREE from 'three';
import {
  exp,
  float,
  interleavedGradientNoise,
  mx_fractal_noise_float,
  screenCoordinate,
  screenUV,
  time,
  uniformArray,
  vec3,
} from 'three/tsl';
import { type Node, type TextureNode, VolumeNodeMaterial } from 'three/webgpu';
import { type AirCloud, airClouds } from '../particles';
import { AIR_LAYER } from '../roomLights';

/** Clouds the air holds at once (the thickest; each pool of dust, smoke or steam is one). */
const CLOUDS = 4;

/**
 * Ultra's light in the air (Phase G2-2): where dust, smoke or steam hang (the particle pools'
 * clouds, particles.ts `airClouds`), the room's lamps and a fire's glow are seen in them, cut by
 * the lamps' shadows — three's VolumeNodeMaterial, a box round the clouds marched from the eye,
 * each step lit by the lights on AIR_LAYER and stopped by the frame's depth. Drawn by a pass of its
 * own at a quarter of the frame (pipeline.ts); clear air shows nothing and costs no pass.
 */
export class GpuAir {
  readonly mesh: THREE.Mesh;
  private readonly clouds: AirCloud[] = Array.from({ length: CLOUDS }, () => ({
    x: 0,
    y: 0,
    z: 0,
    radius: 0,
    thickness: 0,
  }));
  /** Each cloud's centre and radius (xyz, w), and how thick it is. */
  private readonly spots = Array.from({ length: CLOUDS }, () => new THREE.Vector4());
  private readonly thick = uniformArray<'float'>(new Array<number>(CLOUDS).fill(0), 'float');
  private readonly box = new THREE.Box3();

  constructor(depth: TextureNode) {
    const spots = uniformArray<'vec4'>(this.spots, 'vec4');
    const thick = this.thick;
    const material = new VolumeNodeMaterial();
    material.steps = 24;
    material.offsetNode = interleavedGradientNoise(screenCoordinate); // no banding between steps
    material.depthNode = depth.sample(screenUV); // what stands in the air hides what is behind it
    material.scatteringNode = ({ positionRay }) => {
      let density: Node<'float'> = float(0);
      for (let i = 0; i < CLOUDS; i++) {
        const spot = spots.element(i);
        const r2 = spot.w.mul(spot.w).max(1e-4);
        const d2 = positionRay.sub(spot.xyz).dot(positionRay.sub(spot.xyz));
        density = density.add(thick.element(i).mul(exp(d2.div(r2).negate())));
      }
      // Billows drifting up through it: thicker and thinner, not an even fog.
      const drift = positionRay.mul(0.7).add(vec3(0, time.mul(-0.08), 0));
      return density.mul(mx_fractal_noise_float(drift, 3, 2, 0.5).mul(0.9).add(0.7).max(0));
    };
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
    this.mesh.layers.set(AIR_LAYER);
    this.mesh.receiveShadow = true; // the lamps' shadows cut their light in the air
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = false;
  }

  /** The clouds now, the box placed round them; false where the air is clear. */
  update(): boolean {
    const n = airClouds(this.clouds);
    const thick = this.thick.array as number[];
    this.box.makeEmpty();
    for (let i = 0; i < CLOUDS; i++) {
      const c = this.clouds[i];
      const spot = this.spots[i];
      if (!c || !spot) continue;
      const on = i < n;
      thick[i] = on ? c.thickness : 0;
      spot.set(c.x, c.y, c.z, on ? c.radius : 0);
      if (!on) continue;
      // Twice the radius: past it the haze is under 2 % of its centre's.
      const r = 2 * c.radius;
      this.box.expandByPoint(_p.set(c.x - r, c.y - r, c.z - r));
      this.box.expandByPoint(_p.set(c.x + r, c.y + r, c.z + r));
    }
    if (n === 0) return false;
    this.box.getCenter(_p);
    this.mesh.position.copy(_p);
    this.box.getSize(this.mesh.scale);
    this.mesh.updateMatrix();
    this.mesh.updateMatrixWorld();
    return true;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

const _p = new THREE.Vector3();
