import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { daylight, sunDirection, twilight } from '../../../world/clock';
import { cityPlan, type Kind, lampPlan, type Lane, lanePlan, PERIOD, type Placed } from './layout';
import { carBody, carLights, glowTexture, lampHead, lampPool, lampPost } from './street';

// The city seen through the hub's glass floor (Phase V-2), drawn in a pass of its own before the
// world: its own sun, sky and haze follow the time of day, and none of it lights the rooms (which
// stay evenly lit). By night (V-3) its windows light up, building by building, its street lights
// glow and pool on the roads, and under Ultra its traffic drives with its lights on. Its models are the CC0 Downtown City MegaKit by Quaternius
// (public/hub-city/README.md), loaded with the hub under High and Ultra only, and freed with it.

/** How far below the hub's floor the street is (m): a tower's top. */
export const CITY_DEPTH = 120;
/**
 * Parts a building leaves out outside Ultra's inner rings (and under High): it keeps its walls,
 * windows and roof. The window trims are most of a building's triangles (the medium building's
 * `MI_Trim` 17 k of its 26 k, the large one's metal trim 39 k of 45 k) and too fine to see from
 * 120 m up.
 */
const SIMPLE_DROPS = new Set([
  'MI_Trim',
  'MI_Trim_MetalConcrete',
  'MI_Glass',
  'MI_InteriorWall',
  'MI_InteriorFloor',
]);
/** The city per preset: rings of blocks, and how many inner ones in full detail. */
export const CITY_RINGS = { simple: { rings: 3, full: 0 }, full: { rings: 5, full: 1 } } as const;
/** Street lights to a block's side, each sidewalk: a few (High) or every 14 m (Ultra). */
const LAMPS = { simple: 1, full: 3 } as const;
/** Ultra's traffic: cars per lane, and their speed (m/s, about 40 km/h). */
const CARS_PER_LANE = 4;
const CAR_SPEED = 11;
const WINDOW_GLOW = new THREE.Color('#ffd9a3');
const LAMP_GLOW = new THREE.Color('#ffc477');
const PAINTS = ['#c8ccd0', '#1d2228', '#8a1f1f', '#2a4a7a', '#e8e6df', '#5b5f63'].map(
  (c) => new THREE.Color(c),
);
export type CityDetail = keyof typeof CITY_RINGS;

const KINDS: readonly Kind[] = [
  'Building_Small_1',
  'Building_Medium_2_001',
  'Building_Large_2',
  'Street_4Lane',
  'Street_4WayIntersection',
  'Sidewalk_Straight_3m',
];

// The sky by the time of day: its haze at the horizon (the background and the fog).
const HAZE_DAY = new THREE.Color('#a9c6df');
const HAZE_NIGHT = new THREE.Color('#0b1426');
const HAZE_TWILIGHT = new THREE.Color('#e3a27c');
const SUN_DAY = new THREE.Color('#fff4e2');
const SUN_LOW = new THREE.Color('#ffb070');
const scratch: [number, number, number] = [0, 0, 0];

export class CityView {
  readonly scene = new THREE.Scene();
  /** How far below the glass its street is (m). */
  readonly depth = CITY_DEPTH;
  /** The world camera's pose and lens, seeing far enough for the city. */
  readonly camera = new THREE.PerspectiveCamera(50, 1, 1, 2500);
  private readonly sun = new THREE.DirectionalLight('#ffffff', 3);
  private readonly sky = new THREE.HemisphereLight('#bcd4ea', '#5a5148', 1.2);
  private readonly fog = new THREE.FogExp2('#a9c6df', 0.0022);
  private readonly background = new THREE.Color();
  private readonly owned: { dispose(): void }[] = [];
  private paintedAt = -Infinity;
  /** The sun's direction its shadows were last drawn for: drawn again once it has moved. */
  private readonly shadowSun = new THREE.Vector3();
  /** The buildings' window interiors (they glow by night), the lamps' heads and pools, the cars' lights. */
  private readonly windows: THREE.MeshStandardMaterial[] = [];
  private readonly lampHeads = new THREE.MeshStandardMaterial({
    color: '#2b2b2b',
    emissive: LAMP_GLOW,
  });
  private readonly pools = new THREE.MeshBasicMaterial({
    color: LAMP_GLOW,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  private readonly carLamps = new THREE.MeshBasicMaterial({ vertexColors: true });
  /** Ultra's traffic: each car's lane and distance along it; the body and the lights it moves. */
  private readonly traffic: { lane: Lane; s: number }[] = [];
  private cars: THREE.InstancedMesh | null = null;
  private carGlow: THREE.InstancedMesh | null = null;
  private span = 0;

  private constructor(private readonly detail: CityDetail) {
    this.scene.background = this.background;
    this.scene.fog = this.fog;
    this.scene.add(this.sky, this.sun, this.sun.target);
    if (detail === 'full') {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(4096, 4096);
      const c = this.sun.shadow.camera;
      [c.left, c.right, c.top, c.bottom, c.near, c.far] = [-220, 220, 220, -220, 10, 900];
      this.sun.shadow.bias = -0.0004;
      // The sun moves a little each game minute: its shadows are drawn again then, not every frame.
      this.sun.shadow.autoUpdate = false;
    }
  }

  /** Loads the city's models from `base` (the site's root) and lays out the city. */
  static async load(base: string, detail: CityDetail): Promise<CityView> {
    const view = new CityView(detail);
    const loader = new GLTFLoader();
    const models = await Promise.all(
      KINDS.map((kind) => loader.loadAsync(`${base}hub-city/${kind}.gltf`)),
    );
    const { rings, full } = CITY_RINGS[detail];
    const plan = cityPlan(rings, full);
    KINDS.forEach((kind, i) =>
      view.lay(
        models[i]?.scene,
        plan.filter((p) => p.kind === kind),
      ),
    );
    // The ground between the blocks, under the streets (their tops are at y 0, 0.2 m thick).
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2).translate(0, -0.21, 0),
      new THREE.MeshStandardMaterial({ color: '#6f6a63', roughness: 0.95 }),
    );
    ground.receiveShadow = detail === 'full';
    view.owned.push(ground.geometry, ground.material);
    view.scene.add(ground);
    view.street(rings, detail);
    return view;
  }

  /** The city's origin (the intersection under the glass) in world coordinates. */
  place(x: number, y: number, z: number): void {
    for (const child of this.scene.children) {
      if (child !== this.sun && child !== this.sky && child !== this.sun.target)
        child.position.set(x, y, z);
    }
    this.sun.target.position.set(x, y, z);
    this.paintedAt = -Infinity;
  }

  /** Follows the world camera, and the sky and the sun the time of day (repainted once a game minute). */
  update(view: THREE.PerspectiveCamera, clockS: number, dt: number): void {
    this.drive(dt);
    this.camera.position.copy(view.position);
    this.camera.quaternion.copy(view.quaternion);
    if (this.camera.fov !== view.fov || this.camera.aspect !== view.aspect) {
      this.camera.fov = view.fov;
      this.camera.aspect = view.aspect;
      this.camera.updateProjectionMatrix();
    }
    this.camera.updateMatrixWorld();
    if (Math.abs(clockS - this.paintedAt) < 0.6) return;
    this.paintedAt = clockS;
    const day = daylight(clockS);
    const dusk = twilight(clockS);
    this.background.lerpColors(HAZE_NIGHT, HAZE_DAY, day).lerp(HAZE_TWILIGHT, 0.55 * dusk);
    this.fog.color.copy(this.background);
    sunDirection(clockS, scratch);
    const up = Math.max(0, scratch[1]);
    this.sun.position
      .set(scratch[0], scratch[1], scratch[2])
      .multiplyScalar(400)
      .add(this.sun.target.position);
    this.sun.color.lerpColors(SUN_LOW, SUN_DAY, Math.min(1, up * 2.5));
    this.sun.intensity = 3.2 * Math.min(1, up * 4);
    this.sun.visible = up > 0;
    // The city's shadows (Ultra: every building into a 4096² map) are drawn again only once the
    // sun has moved SHADOW_TURN (every ~2 s of play): drawn every repaint, they cost a long frame
    // twice a second.
    const sunNow = SUN_NOW.set(scratch[0], scratch[1], scratch[2]).normalize();
    if (this.shadowSun.lengthSq() === 0 || sunNow.dot(this.shadowSun) < Math.cos(SHADOW_TURN)) {
      this.shadowSun.copy(sunNow);
      this.sun.shadow.needsUpdate = true;
    }
    this.sky.intensity = 0.25 + 1.1 * day;
    // The night's lights: full from dusk to dawn, fading in and out through the twilight.
    const night = 1 - day;
    for (const m of this.windows) m.emissiveIntensity = 1.6 * night;
    this.lampHeads.emissiveIntensity = 3 * night;
    this.pools.opacity = 0.55 * night;
    this.pools.visible = night > 0.01;
    this.carLamps.color.setScalar(0.35 + 1.8 * night);
  }

  /** Uploads its textures now, so the first look down does not stall on them. */
  upload(renderer: THREE.WebGLRenderer): void {
    for (const thing of this.owned)
      if (thing instanceof THREE.Texture) renderer.initTexture(thing as THREE.Texture);
  }

  dispose(): void {
    for (const thing of this.owned) thing.dispose();
    this.owned.length = 0;
    this.scene.clear();
  }

  /** An interior material lit by night: its picture glows, each copy as much as its colour says. */
  private lit(material: THREE.MeshStandardMaterial): void {
    material.emissive.copy(WINDOW_GLOW);
    material.emissiveMap = material.map;
    material.emissiveIntensity = 0;
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n#ifdef USE_INSTANCING_COLOR\n  totalEmissiveRadiance *= vColor;\n#endif',
      );
    };
    this.windows.push(material);
  }

  /** The street lights (High: a few; Ultra: every 14 m) and, under Ultra, the traffic. */
  private street(rings: number, detail: CityDetail): void {
    const matrix = new THREE.Matrix4();
    const lamps = lampPlan(rings, LAMPS[detail]);
    const post = new THREE.MeshStandardMaterial({
      color: '#3b3f44',
      roughness: 0.6,
      metalness: 0.4,
    });
    const glow = glowTexture();
    this.pools.map = glow;
    const parts: [THREE.BufferGeometry, THREE.Material][] = [
      [lampPost(), post],
      [lampHead(), this.lampHeads],
      [lampPool(), this.pools],
    ];
    for (const [geometry, material] of parts) {
      const mesh = new THREE.InstancedMesh(geometry, material, lamps.length);
      lamps.forEach((lamp, i) => {
        mesh.setMatrixAt(i, matrix.makeRotationY(lamp.turn).setPosition(lamp.x, 0, lamp.z));
      });
      mesh.computeBoundingSphere();
      this.owned.push(geometry);
      this.scene.add(mesh);
    }
    this.owned.push(post, this.lampHeads, this.pools, this.carLamps);
    if (glow) this.owned.push(glow);
    if (detail !== 'full') return;
    // Traffic: cars spread along every lane, each its own paint.
    this.span = 2 * rings * PERIOD;
    for (const lane of lanePlan(rings)) {
      for (let k = 0; k < CARS_PER_LANE; k++) {
        this.traffic.push({ lane, s: ((k + hash(lane.offset, k)) / CARS_PER_LANE) * this.span });
      }
    }
    const paint = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.5 });
    const cars = new THREE.InstancedMesh(carBody(), paint, this.traffic.length);
    const glowing = new THREE.InstancedMesh(carLights(), this.carLamps, this.traffic.length);
    this.traffic.forEach((car, i) => {
      const color = PAINTS[Math.floor(hash(car.lane.offset, car.s) * PAINTS.length)];
      if (color) cars.setColorAt(i, color);
    });
    for (const mesh of [cars, glowing]) {
      mesh.frustumCulled = false; // they move: their bounds would go stale
      this.owned.push(mesh.geometry);
      this.scene.add(mesh);
    }
    this.owned.push(paint);
    [this.cars, this.carGlow] = [cars, glowing];
    this.drive(0);
  }

  /** The traffic moved on by `dt` (no allocation: per frame). */
  private drive(dt: number): void {
    const { cars, carGlow } = this;
    if (!cars || !carGlow) return;
    const half = this.span / 2;
    for (let i = 0; i < this.traffic.length; i++) {
      const car = this.traffic[i];
      if (!car) continue;
      const { lane } = car;
      car.s = (car.s + CAR_SPEED * dt) % this.span;
      const along = (car.s - half) * lane.direction;
      const forward = lane.direction > 0;
      CAR.makeRotationY(
        lane.alongX ? (forward ? 0 : Math.PI) : forward ? -Math.PI / 2 : Math.PI / 2,
      );
      if (lane.alongX) CAR.setPosition(along, 0, lane.offset);
      else CAR.setPosition(lane.offset, 0, along);
      cars.setMatrixAt(i, CAR);
      carGlow.setMatrixAt(i, CAR);
    }
    cars.instanceMatrix.needsUpdate = true;
    carGlow.instanceMatrix.needsUpdate = true;
  }

  /**
   * One model's copies: an InstancedMesh per part (per material), a matrix per copy — a draw per
   * part, not per copy. A copy outside the full rings leaves out the parts `SIMPLE_DROPS` names.
   */
  private lay(model: THREE.Object3D | undefined, copies: readonly Placed[]): void {
    if (!model || copies.length === 0) return;
    model.updateMatrixWorld(true);
    const matrix = new THREE.Matrix4();
    const turn = new THREE.Quaternion();
    const at = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);
    const up = new THREE.Vector3(0, 1, 0);
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const material = object.material as THREE.MeshStandardMaterial;
      // The kit's vertex colours are its source shader's wear masks, not colours: a red cast here.
      material.vertexColors = false;
      const used = SIMPLE_DROPS.has(material.name) ? copies.filter((c) => c.full) : copies;
      if (used.length === 0) return;
      const mesh = new THREE.InstancedMesh(object.geometry, material, used.length);
      const interior = material.name.startsWith('MI_FakeInterior');
      if (interior) this.lit(material);
      const shade = new THREE.Color();
      used.forEach((copy, i) => {
        turn.setFromAxisAngle(up, copy.turn);
        matrix.compose(at.set(copy.x, 0, copy.z), turn, one).multiply(object.matrixWorld);
        mesh.setMatrixAt(i, matrix);
        // How many of a building's rooms are lit at night (fixed, from where it stands): 25–100 %.
        if (interior) mesh.setColorAt(i, shade.setScalar(0.25 + 0.75 * hash(copy.x, copy.z)));
      });
      mesh.computeBoundingSphere();
      // The trim and glass cast none: the walls' shadow is the building's, at a sixth of the triangles.
      mesh.castShadow = this.detail === 'full' && !SIMPLE_DROPS.has(material.name);
      mesh.receiveShadow = this.detail === 'full';
      this.owned.push(object.geometry as THREE.BufferGeometry, material);
      for (const map of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'] as const) {
        const texture = material[map];
        if (texture) this.owned.push(texture);
      }
      this.scene.add(mesh);
    });
  }
}

/** How far the sun turns (rad) before the city's shadows are drawn again. */
const SHADOW_TURN = THREE.MathUtils.degToRad(0.8);
const SUN_NOW = new THREE.Vector3();

/** A car's place this frame (scratch: the traffic moves every frame). */
const CAR = new THREE.Matrix4();

/** A fixed number in [0, 1) from two numbers: the same city every time. */
function hash(a: number, b: number): number {
  const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return h - Math.floor(h);
}
