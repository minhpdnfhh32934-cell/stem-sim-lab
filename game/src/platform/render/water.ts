import * as THREE from 'three';
import type { ItemDefinition } from '../../gameplay/item';

/**
 * Running water (items with `visual.stream`, drawn while `running`): a thin tapered column from
 * the spout's mouth down to what is below, and a ripple where it lands. One geometry each for
 * every stream, one pair of unlit shader materials per colour, one time uniform; the pattern
 * scrolls down the column in the shader, so a running stream costs nothing per frame here. Only
 * turning on (the head falls from the mouth) and off (the tail falls away) moves meshes.
 * A stylised effect drawn from primitives, not a fluid simulation.
 */

/** How fast the head falls in and the tail falls away (m/s): ~0.12 s for the faucet's 0.3 m. */
export const FALL_SPEED = 2.5;
/** The column's radius at the mouth (m), and the fraction of it left at the bottom. */
const RADIUS = 0.0075;
const TAPER = 0.6;
/** The ripple's radius (m). */
const SPLASH = 0.03;
/**
 * The time uniform wraps at 2π: every time factor in the shaders is a whole number, so the pattern
 * runs on seamlessly, and float precision never wears out over a long session.
 */
const PERIOD = 2 * Math.PI;

/** Where water is between the mouth (0) and the end (`length`), m below the mouth. */
export interface Flow {
  /** Its lowest point. */
  head: number;
  /** Its highest point: 0 while it leaves the mouth. */
  tail: number;
}

/**
 * One frame of a stream turned on (its head falls to the end) or off (what has left the mouth
 * falls on, the tail after it, then nothing is left). True while it still changes.
 */
export function flowStep(flow: Flow, running: boolean, length: number, dt: number): boolean {
  const fall = FALL_SPEED * dt;
  if (running) {
    // Turned on again while it drained: a new head from the mouth.
    if (flow.tail > 0) flow.head = flow.tail = 0;
    flow.head = Math.min(length, flow.head + fall);
    return flow.head < length;
  }
  if (flow.head === 0) return false;
  flow.head = Math.min(length, flow.head + fall);
  flow.tail = Math.min(flow.head, flow.tail + fall);
  if (flow.tail < length) return true;
  flow.head = flow.tail = 0;
  return false;
}

/** One entity's water: its meshes hang from a group at the mouth, in the entity's group. */
interface Stream {
  readonly column: THREE.Mesh;
  readonly splash: THREE.Mesh;
  readonly length: number;
  readonly flow: Flow;
  running: boolean;
}

const COLUMN_VERTEX = /* glsl */ `
uniform float uTime;
varying vec3 vNormal;
varying vec3 vView;
varying float vY;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vY = world.y;
  // A slight swell and pinch running down with the water (world metres: the column's scale does
  // not stretch it).
  float swell = 1.0 + 0.1 * sin(world.y * 45.0 + uTime * 54.0);
  vec4 mv = modelViewMatrix * vec4(position.x * swell, position.y, position.z * swell, 1.0);
  vView = -mv.xyz;
  vNormal = normalMatrix * normal;
  gl_Position = projectionMatrix * mv;
}`;

const COLUMN_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
varying vec3 vNormal;
varying vec3 vView;
varying float vY;
void main() {
  vec3 n = normalize(vNormal);
  float rim = 1.0 - abs(dot(n, normalize(vView)));
  // Streaks falling at ~1.2 m/s (slow enough not to strobe at 30 frames a second).
  float streak = 0.5 + 0.5 * sin(vY * 60.0 + uTime * 72.0 + 1.5 * sin(vY * 23.0 + uTime * 27.0));
  // A highlight down one side, fixed to the view as a lamp's reflection on a wet rod.
  float glint = pow(max(dot(n, normalize(vec3(0.55, 0.35, 1.0))), 0.0), 24.0);
  float alpha = mix(0.22, 0.8, rim * rim) * (0.8 + 0.2 * streak) + 0.5 * glint;
  vec3 color = uColor * (0.75 + 0.35 * streak) + vec3(0.9) * (glint + 0.2 * rim * streak);
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const SPLASH_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SPLASH_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
varying vec2 vUv;
void main() {
  float r = length(vUv * 2.0 - 1.0);
  // Rings running out from where the water lands, over a bright spot under it.
  float ring = 0.5 + 0.5 * sin(r * 14.0 - uTime * 60.0);
  float alpha = (1.0 - smoothstep(0.35, 1.0, r)) * (0.12 + 0.3 * ring)
    + 0.45 * (1.0 - smoothstep(0.0, 0.3, r));
  gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.5 + 0.3 * ring), alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** The streams of the view, by entity id. */
export class WaterStreams {
  /** Top at y 0, the end at y −1, narrowing down; open, so no cap shows. */
  private readonly columnGeometry = new THREE.CylinderGeometry(1, TAPER, 1, 12, 16, true).translate(
    0,
    -0.5,
    0,
  );
  private readonly splashGeometry = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2);
  private readonly time = { value: 0 };
  private readonly materials = new Map<
    string,
    { column: THREE.ShaderMaterial; splash: THREE.ShaderMaterial }
  >();
  private readonly streams = new Map<string, Stream>();
  /** Streams turning on or off (only those move each frame). */
  private readonly flowing = new Set<Stream>();
  /** Streams just added, compiled on the next frame: their scene is lit by then. */
  private readonly uncompiled: THREE.Object3D[] = [];

  /** `compile` builds the shaders of an object (hidden) before it is first drawn. */
  constructor(private readonly compile: (object: THREE.Object3D) => void) {}

  /** The item's stream added to `group` (its entity's), drawn full at once if already running. */
  add(entityId: string, item: ItemDefinition, group: THREE.Group, running: boolean): void {
    const data = item.visual.stream;
    if (!data) return;
    const { column, splash } = this.materialsFor(data.color);
    const root = new THREE.Group();
    root.position.fromArray(data.from ?? [0, -item.visual.size[1] / 2, 0]);
    const columnMesh = new THREE.Mesh(this.columnGeometry, column);
    columnMesh.scale.set(RADIUS, 1, RADIUS);
    const splashMesh = new THREE.Mesh(this.splashGeometry, splash);
    splashMesh.scale.setScalar(SPLASH);
    splashMesh.position.y = -data.length;
    root.add(columnMesh, splashMesh);
    group.add(root);
    this.uncompiled.push(root); // for each scene's lights: a cache hit when already compiled
    const stream: Stream = {
      column: columnMesh,
      splash: splashMesh,
      length: data.length,
      flow: { head: running ? data.length : 0, tail: 0 }, // running in a save: shown at once
      running,
    };
    this.streams.set(entityId, stream);
    this.place(stream);
  }

  /** Its `running` state: the water falls in or away from where it is (update). */
  refresh(entityId: string, running: boolean): void {
    const stream = this.streams.get(entityId);
    if (!stream) return;
    stream.running = running;
    this.flowing.add(stream);
  }

  /** Every frame: the time, and the streams turning on or off. */
  update(dt: number): void {
    this.time.value = (this.time.value + dt) % PERIOD;
    if (this.uncompiled.length > 0) {
      for (const object of this.uncompiled) this.compile(object);
      this.uncompiled.length = 0;
    }
    for (const stream of this.flowing) {
      if (!flowStep(stream.flow, stream.running, stream.length, dt)) this.flowing.delete(stream);
      this.place(stream);
    }
  }

  /** Forgets the entity's stream (its meshes go with the entity's group; nothing to free). */
  remove(entityId: string): void {
    const stream = this.streams.get(entityId);
    if (!stream) return;
    this.flowing.delete(stream);
    this.streams.delete(entityId);
  }

  dispose(): void {
    this.columnGeometry.dispose();
    this.splashGeometry.dispose();
    for (const { column, splash } of this.materials.values()) {
      column.dispose();
      splash.dispose();
    }
    this.materials.clear();
    this.streams.clear();
    this.flowing.clear();
    this.uncompiled.length = 0;
  }

  private place({ column, splash, flow, length }: Stream): void {
    column.visible = flow.head > flow.tail;
    column.position.y = -flow.tail;
    column.scale.y = Math.max(flow.head - flow.tail, 1e-4);
    splash.visible = flow.head >= length && flow.tail < length;
  }

  private materialsFor(color: string): {
    column: THREE.ShaderMaterial;
    splash: THREE.ShaderMaterial;
  } {
    let pair = this.materials.get(color);
    if (pair) return pair;
    const uniforms = { uColor: { value: new THREE.Color(color) }, uTime: this.time };
    // Unlit and see-through: one look at every graphics quality, nothing written to depth.
    const look = { uniforms, transparent: true, depthWrite: false };
    pair = {
      column: new THREE.ShaderMaterial({
        ...look,
        vertexShader: COLUMN_VERTEX,
        fragmentShader: COLUMN_FRAGMENT,
      }),
      splash: new THREE.ShaderMaterial({
        ...look,
        vertexShader: SPLASH_VERTEX,
        fragmentShader: SPLASH_FRAGMENT,
      }),
    };
    this.materials.set(color, pair);
    return pair;
  }
}
