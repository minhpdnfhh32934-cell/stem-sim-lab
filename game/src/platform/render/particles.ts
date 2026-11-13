import * as THREE from 'three';

const ATTRIBUTES = ['position', 'aSize', 'aAlpha', 'aT'] as const;

export interface ParticleLook {
  /** Opacity at birth, how much it grows over its life, how fast it rises (m/s²), its drag (1/s). */
  readonly opacity: number;
  readonly grow: number;
  readonly lift: number;
  readonly drag: number;
  /** round: a soft disc · flame: a tongue, narrow at its tip, flickering (Phase E-2b). */
  readonly shape?: 'round' | 'flame';
  /** Its colour over its life (young → old); one colour without. */
  readonly ramp?: readonly [string, string, string];
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

  constructor(
    private readonly capacity: number,
    color: string,
    additive: boolean,
    private readonly look: ParticleLook,
  ) {
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
        uC0: { value: new THREE.Color(c0) },
        uC1: { value: new THREE.Color(c1) },
        uC2: { value: new THREE.Color(c2) },
      },
      defines: look.shape === 'flame' ? { FLAME: '' } : {},
      vertexShader: `
        attribute float aSize;
        attribute float aAlpha;
        attribute float aT;
        attribute float aSeed;
        varying float vAlpha;
        varying float vT;
        varying float vSeed;
        uniform float uScale;
        void main() {
          vAlpha = aAlpha;
          vT = aT;
          vSeed = aSeed;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uScale / max(0.05, -mv.z);
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
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          #ifdef FLAME
            // A tongue: wide at its foot, narrowing to a tip above, swaying as it flickers.
            float y = -p.y + 0.5;                       // 0 at the foot, 1 at the tip
            float sway = sin(uTime * 9.0 + vSeed * 40.0 + y * 6.0) * 0.08 * y;
            float width = mix(0.42, 0.06, pow(y, 0.8));
            float d = length(vec2((p.x - sway) / max(width, 0.02), (y - 0.38) * 2.2));
            float a = vAlpha * smoothstep(1.0, 0.35, d);
          #else
            float a = vAlpha * smoothstep(1.0, 0.2, length(p) * 2.0);
          #endif
          if (a < 0.01) discard;
          vec3 c = vT < 0.5 ? mix(uC0, uC1, vT * 2.0) : mix(uC1, uC2, vT * 2.0 - 1.0);
          gl_FragColor = vec4(c, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
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
      this.alpha[i] = opacity * Math.min(1, t * 10) * (1 - t);
      live++;
    }
    this.live = live;
    for (const name of ATTRIBUTES) this.geometry.getAttribute(name).needsUpdate = true;
    this.points.visible = live > 0;
  }

  get count(): number {
    return this.live;
  }

  dispose(): void {
    this.points.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
