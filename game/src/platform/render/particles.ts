import * as THREE from 'three';

const ATTRIBUTES = ['position', 'aSize', 'aAlpha', 'aT'] as const;

/** What a pool's sprites are made from: its buffers (attributes by name) and its uniforms. */
export interface ParticleSource {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.ShaderMaterial;
  readonly capacity: number;
}
/**
 * Under WebGPU (Ultra, Phase G2) a pool is drawn as instanced sprites the device makes
 * (gpu/particles.ts): points there are one pixel. Set by the device while it draws, null else.
 */
export type ParticleSprites = (pool: ParticleSource) => THREE.Object3D;
let sprites: ParticleSprites | null = null;
const pools = new Set<Particles>();
/** Every pool's points, in the order made (effectsPass.ts draws them itself under Max). */
const poolPoints: THREE.Points[] = [];
/** Max's soft particles on (softParticles): pools made meanwhile start soft. */
let softOn = false;

/** Every pool's points (no copy: read, never changed). */
export function particlePools(): readonly THREE.Points[] {
  return poolPoints;
}

/** Shows or hides every pool (their materials): Max's world pass leaves them to its own pass. */
export function showParticles(shown: boolean): void {
  for (const points of poolPoints) (points.material as THREE.Material).visible = shown;
}

/**
 * Max's soft particles (effectsPass.ts): each pool drawn into the particles' own picture, at
 * `pointScale` of the resolution, hidden behind the opaque scene's `depth` and fading as it nears
 * it (premultiplied, laid over after). Null depth: every pool drawn as before.
 */
export function softParticles(
  depth: THREE.Texture | null,
  near: number,
  far: number,
  invWidth: number,
  invHeight: number,
  pointScale: number,
): void {
  const on = depth !== null;
  for (const pool of pools) pool.soften(on, depth, near, far, invWidth, invHeight, pointScale);
  softOn = on;
}

/** Every pool, and each made from now, drawn by `make`'s sprites (null: by its points again). */
export function useParticleSprites(make: ParticleSprites | null): void {
  sprites = make;
  for (const pool of pools) pool.drawWith(make);
}

export interface ParticleLook {
  /** Opacity at birth, how much it grows over its life, how fast it rises (m/s²), its drag (1/s). */
  readonly opacity: number;
  readonly grow: number;
  readonly lift: number;
  readonly drag: number;
  /**
   * round: a soft disc · flame: a tongue, narrow at its tip, flickering (Phase E-2b) · puff: a
   * billow of smoke or dust — a ragged edge, curls inside that turn slowly, lit from above and
   * shaded below (2026-11-14: the blast's dust).
   */
  readonly shape?: 'round' | 'flame' | 'puff';
  /** Its colour over its life (young → old); one colour without. */
  readonly ramp?: readonly [string, string, string];
  /**
   * How much it hazes the air it fills (dust, smoke, steam: Ultra's light in the air, G2-2;
   * `airClouds`), 0 or none: not at all (flames, sparks, water).
   */
  readonly air?: number;
}

/** Where a pool's particles hang (its weighted centre and spread, m) and how thick (`airClouds`). */
export interface AirCloud {
  x: number;
  y: number;
  z: number;
  radius: number;
  thickness: number;
}

/**
 * The live pools that haze the air, into `out` (its objects reused), the thickest first when there
 * are more; returns how many were written.
 */
export function airClouds(out: AirCloud[]): number {
  let n = 0;
  for (const pool of pools) {
    const c = pool.cloud;
    if (!c || c.thickness <= 0) continue;
    // Kept the thickest: the thinnest written is replaced.
    let at = n < out.length ? n++ : -1;
    if (at < 0) {
      at = 0;
      for (let i = 1; i < out.length; i++) {
        if ((out[i]?.thickness ?? 0) < (out[at]?.thickness ?? 0)) at = i;
      }
      if ((out[at]?.thickness ?? 0) >= c.thickness) continue;
    }
    const o = out[at];
    if (o) Object.assign(o, c);
  }
  return n;
}

/**
 * A pool of particles (Phase E-2: flames, smoke, sparks, an extinguisher's jet): each lives a few
 * seconds, rises or falls as emitted, grows and fades; a flame is a flickering tongue whose colour
 * runs through its ramp as it ages. One draw for the pool; its buffers are made once and reused
 * (nothing allocated per frame); a full pool drops new particles.
 */
export class Particles {
  readonly points: THREE.Points;
  private readonly position: Float32Array;
  private readonly size: Float32Array;
  private readonly alpha: Float32Array;
  private readonly ageShare: Float32Array;
  private readonly velocity: Float32Array;
  private readonly age: Float32Array;
  private readonly life: Float32Array;
  private readonly start: Float32Array;
  private readonly geometry = new THREE.BufferGeometry();
  private readonly material: THREE.ShaderMaterial;
  private next = 0;
  private live = 0;
  private clock = 0;
  /** The device's sprites, drawn in its points' stead (their layers then off), or null. */
  private sprite: THREE.Object3D | null = null;
  /** Where it hazes the air, updated with it (look.air), or null: it does not. */
  readonly cloud: AirCloud | null;
  private readonly pointLayers: number;

  constructor(
    private readonly capacity: number,
    color: string,
    private readonly additive: boolean,
    private readonly look: ParticleLook,
  ) {
    this.cloud = look.air ? { x: 0, y: 0, z: 0, radius: 0, thickness: 0 } : null;
    this.position = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.ageShare = new Float32Array(capacity);
    this.velocity = new Float32Array(capacity * 3);
    this.age = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.start = new Float32Array(capacity);
    const seed = new Float32Array(capacity);
    for (let i = 0; i < capacity; i++) seed[i] = Math.random();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.position, 3));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.geometry.setAttribute('aT', new THREE.BufferAttribute(this.ageShare, 1));
    this.geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const [c0, c1, c2] = look.ramp ?? [color, color, color];
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uScale: { value: 600 },
        uTime: { value: 0 },
        // Max's soft particles (softParticles): the opaque scene's depth, and the half resolution.
        uPointScale: { value: 1 },
        tSceneDepth: { value: null },
        uSceneInvSize: { value: new THREE.Vector2(1, 1) },
        uNear: { value: 0.05 },
        uFar: { value: 200 },
        uC0: { value: new THREE.Color(c0) },
        uC1: { value: new THREE.Color(c1) },
        uC2: { value: new THREE.Color(c2) },
      },
      defines: look.shape === 'flame' ? { FLAME: '' } : look.shape === 'puff' ? { PUFF: '' } : {},
      vertexShader: `
        attribute float aSize;
        attribute float aAlpha;
        attribute float aT;
        attribute float aSeed;
        varying float vAlpha;
        varying float vT;
        varying float vSeed;
        uniform float uScale;
        uniform float uPointScale;
        #ifdef SOFT
          varying float vViewZ;
          varying float vSoft;
        #endif
        void main() {
          vAlpha = aAlpha;
          vT = aT;
          vSeed = aSeed;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uScale * uPointScale / max(0.05, -mv.z);
          #ifdef SOFT
            vViewZ = -mv.z;
            vSoft = aSize * 0.5; // fades over the last half of its size to what is behind it
          #endif
          #ifdef PUFF
            // Faded as the eye comes into it: a billow is seen, not a grey wall over the view.
            vAlpha *= smoothstep(1.0, 4.0, -mv.z);
          #endif
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uC0;
        uniform vec3 uC1;
        uniform vec3 uC2;
        uniform float uTime;
        varying float vAlpha;
        varying float vT;
        varying float vSeed;
        #ifdef SOFT
          #include <packing>
          uniform sampler2D tSceneDepth;
          uniform vec2 uSceneInvSize;
          uniform float uNear;
          uniform float uFar;
          varying float vViewZ;
          varying float vSoft;
        #endif
        #ifdef PUFF
          float hash(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
          float noise(vec2 q) {
            vec2 i = floor(q);
            vec2 f = fract(q);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                       mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
          }
          float fbm(vec2 q) {
            float v = 0.0;
            float a = 0.5;
            for (int k = 0; k < 4; k++) { v += a * noise(q); q = q * 2.03 + 7.1; a *= 0.5; }
            return v;
          }
        #endif
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          #ifdef PUFF
            // Turned by its seed, the curls drifting with time; the edge torn by them.
            float ang = vSeed * 6.2831 + uTime * (0.05 + 0.1 * vSeed) * (vSeed > 0.5 ? 1.0 : -1.0);
            vec2 q = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * p;
            float n = fbm(q * 3.2 + vSeed * 19.0 + vec2(0.0, uTime * 0.06));
            float r = length(p) * 2.0 + (n - 0.5) * 0.7;
            float a = vAlpha * smoothstep(1.0, 0.3, r) * (0.55 + 0.6 * n);
            // Lit from above, darker below and in its folds: a volume, not a disc.
            float lit = clamp(0.58 + (-p.y) * 0.85 + (n - 0.5) * 0.55, 0.3, 1.25);
          #elif defined(FLAME)
            // A tongue: wide at its foot, narrowing to a tip above, swaying as it flickers.
            float y = -p.y + 0.5;                       // 0 at the foot, 1 at the tip
            float sway = sin(uTime * 9.0 + vSeed * 40.0 + y * 6.0) * 0.08 * y;
            float width = mix(0.42, 0.06, pow(y, 0.8));
            float d = length(vec2((p.x - sway) / max(width, 0.02), (y - 0.38) * 2.2));
            float a = vAlpha * smoothstep(1.0, 0.35, d);
          #else
            float a = vAlpha * smoothstep(1.0, 0.2, length(p) * 2.0);
          #endif
          #ifdef SOFT
            // Hidden behind the opaque scene, and fading as it nears the surface behind it.
            float sceneZ = -perspectiveDepthToViewZ(
              texture2D(tSceneDepth, gl_FragCoord.xy * uSceneInvSize).x, uNear, uFar);
            a *= clamp((sceneZ - vViewZ) / max(vSoft, 0.02), 0.0, 1.0);
          #endif
          if (a < 0.01) discard;
          vec3 c = vT < 0.5 ? mix(uC0, uC1, vT * 2.0) : mix(uC1, uC2, vT * 2.0 - 1.0);
          #ifdef PUFF
            c *= lit;
          #endif
          #ifdef SOFT
            // Premultiplied into the particles' own picture (effectsPass.ts lays it over).
            #ifdef ADD
              gl_FragColor = vec4(c * a, 0.0);
            #else
              gl_FragColor = vec4(c * a, a);
            #endif
          #else
            gl_FragColor = vec4(c, a);
          #endif
        }`,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    // Drawn once (its program compiled with the scene's, not at the first fire), then hidden until
    // a particle lives: an empty pool was drawn every frame, every point zero-sized.
    this.points.onAfterRender = () => {
      if (this.live === 0) this.points.visible = false;
    };
    this.pointLayers = this.points.layers.mask;
    pools.add(this);
    poolPoints.push(this.points);
    if (softOn) this.soften(true, null, 0.05, 200, 1, 1, 1);
    if (sprites) this.drawWith(sprites);
  }

  /** Drawn by `make`'s sprites (a child: shown and hidden with the points), or by the points. */
  drawWith(make: ParticleSprites | null): void {
    if (this.sprite) {
      this.points.remove(this.sprite);
      this.sprite.traverse((o) =>
        (o as Partial<THREE.Mesh<never, THREE.Material>>).material?.dispose(),
      );
      this.sprite = null;
    }
    // No layer: the camera passes the points by (their children are still drawn).
    this.points.layers.mask = make ? 0 : this.pointLayers;
    if (!make) return;
    this.sprite = make({
      geometry: this.geometry,
      material: this.material,
      capacity: this.capacity,
    });
    this.points.add(this.sprite);
  }

  /** The screen's height in pixels and the view's field: particle sizes are in metres. */
  setView(heightPx: number, fovDeg: number): void {
    const uniform = this.material.uniforms.uScale;
    if (uniform) uniform.value = heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
  }

  /** A particle at (x, y, z) flying at (vx, vy, vz) m/s, `size` m across, for `life` s. */
  emit(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    size: number,
    life: number,
  ): void {
    let i = -1;
    for (let k = 0; k < this.capacity; k++) {
      const j = (this.next + k) % this.capacity;
      if ((this.life[j] ?? 0) <= (this.age[j] ?? 0)) {
        i = j;
        break;
      }
    }
    if (i < 0) return;
    this.next = (i + 1) % this.capacity;
    this.position[i * 3] = x;
    this.position[i * 3 + 1] = y;
    this.position[i * 3 + 2] = z;
    this.velocity[i * 3] = vx;
    this.velocity[i * 3 + 1] = vy;
    this.velocity[i * 3 + 2] = vz;
    this.start[i] = size;
    this.age[i] = 0;
    this.life[i] = life;
    this.live = Math.max(this.live, 1);
  }

  update(dt: number): void {
    this.clock += dt;
    const time = this.material.uniforms.uTime;
    if (time) time.value = this.clock;
    if (this.live === 0) return; // nothing alive and nothing new: the pool is hidden already
    const { opacity, grow, lift, drag } = this.look;
    const keep = Math.exp(-drag * dt);
    let live = 0;
    // The cloud: each particle weighed by how much it covers (alpha × its area).
    let w = 0;
    let wx = 0;
    let wy = 0;
    let wz = 0;
    let wr = 0;
    let bulk = 0;
    for (let i = 0; i < this.capacity; i++) {
      const life = this.life[i] ?? 0;
      let age = this.age[i] ?? 0;
      if (age >= life) {
        this.alpha[i] = 0;
        continue;
      }
      age += dt;
      this.age[i] = age;
      const t = Math.min(1, age / life);
      for (let k = 0; k < 3; k++) {
        const v = (this.velocity[i * 3 + k] ?? 0) * keep + (k === 1 ? lift * dt : 0);
        this.velocity[i * 3 + k] = v;
        this.position[i * 3 + k] = (this.position[i * 3 + k] ?? 0) + v * dt;
      }
      this.size[i] = (this.start[i] ?? 0) * Math.max(0.05, 1 + grow * t);
      this.ageShare[i] = t;
      // Fades in over its first tenth, out over the rest.
      const alpha = opacity * Math.min(1, t * 10) * (1 - t);
      this.alpha[i] = alpha;
      live++;
      if (this.cloud) {
        const s = this.size[i] ?? 0;
        const x = this.position[i * 3] ?? 0;
        const y = this.position[i * 3 + 1] ?? 0;
        const z = this.position[i * 3 + 2] ?? 0;
        const a = alpha * s * s;
        w += a;
        wx += a * x;
        wy += a * y;
        wz += a * z;
        wr += a * (x * x + y * y + z * z);
        bulk += a * s;
      }
    }
    this.live = live;
    const cloud = this.cloud;
    if (cloud) {
      if (w > 0) {
        cloud.x = wx / w;
        cloud.y = wy / w;
        cloud.z = wz / w;
        const spread = wr / w - (cloud.x ** 2 + cloud.y ** 2 + cloud.z ** 2);
        // Its spread, and half a particle more (one alone is a puff, not a point).
        cloud.radius = Math.sqrt(Math.max(0, spread)) + (0.5 * bulk) / w;
        // What the particles fill (alpha × size³) over the cloud's volume, by how much it hazes.
        cloud.thickness = ((this.look.air ?? 0) * bulk) / Math.max(0.05, cloud.radius ** 3);
      } else cloud.thickness = 0;
    }
    for (const name of ATTRIBUTES) this.geometry.getAttribute(name).needsUpdate = true;
    this.points.visible = live > 0;
  }

  get count(): number {
    return this.live;
  }

  /** Its soft mode (softParticles): its defines and blend changed only when it turns. */
  soften(
    on: boolean,
    depth: THREE.Texture | null,
    near: number,
    far: number,
    invWidth: number,
    invHeight: number,
    pointScale: number,
  ): void {
    const m = this.material;
    const u = m.uniforms;
    if (u.uPointScale) u.uPointScale.value = on ? pointScale : 1;
    if (on) {
      if (u.tSceneDepth) u.tSceneDepth.value = depth;
      if (u.uNear) u.uNear.value = near;
      if (u.uFar) u.uFar.value = far;
      (u.uSceneInvSize?.value as THREE.Vector2 | undefined)?.set(invWidth, invHeight);
    }
    if (Object.hasOwn(m.defines, 'SOFT') === on) return;
    const defines = m.defines as Record<string, string>;
    if (on) {
      defines.SOFT = '';
      if (this.additive) defines.ADD = '';
      // Premultiplied into a cleared picture: over for smoke, added for flames and sparks.
      m.blending = THREE.CustomBlending;
      m.blendSrc = THREE.OneFactor;
      m.blendDst = this.additive ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor;
      m.blendSrcAlpha = this.additive ? THREE.ZeroFactor : THREE.OneFactor;
      m.blendDstAlpha = this.additive ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor;
    } else {
      delete defines.SOFT;
      delete defines.ADD;
      m.blending = this.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    }
    m.needsUpdate = true;
  }

  dispose(): void {
    pools.delete(this);
    const at = poolPoints.indexOf(this.points);
    if (at >= 0) poolPoints.splice(at, 1);
    this.drawWith(null);
    this.points.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
