import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { SELF_LAYER, SHADOW_LAYER } from '../render/body/BodyModel';
import { CityView } from '../render/city/CityView';
import { castAsync } from './cast';
import { blackCard, karambit } from './props';
import { type Hour, hourAt, raidAllowed, togetherAt } from './cycle';
import { floatingLab } from './floatingLab';
import {
  type Framing,
  orbitPoint,
  restingOrbit,
  restingSway,
  scrollOrbit,
  stepOrbit,
  stepSway,
} from './framing';
import { landMesh } from './land';
import { wallpaperPost } from './post';
import { type Anchor, Prologue, type PrologueView } from './prologue/Prologue';
import type { StuntFrame } from './prologue/stunt';
import type { Swoop } from '../../simulation/rocketSwoop';
import { raidView } from './raid';
import { RAID } from './raidPlan';
import { random } from './random';
import { rooftop } from './rooftop';
import { cycleTime, due, type Settings } from './settings';
import { CITY_ORIGIN, LAB_AT, ROOF_HEIGHT, TOWER } from './site';
import { cityRoofs } from './cityRoofs';
import { nightSky } from './sky';
import { towerFacade } from './towerFacade';
import { streetTrees, treeMeshes, woodTrees } from './trees';

/*
 * The live wallpaper (Phase W): Linh and Khoa on a tower's roof at the edge of the game's own
 * small city (`render/city`, as seen through the hub's glass floor), SimLab floating over its
 * middle. A seven-minute day (`cycle.ts`): afternoon, a golden evening when Khoa sits by Linh,
 * sunset, night in their glowing clothes, dawn; raids on the lab every few minutes (`raid.ts`).
 * Drawn in two passes so both ends keep their depth precision (`post.ts`): the far pass (sky,
 * land, city, lab, raid; 1 m – 30 km) then, depth cleared, the near pass (the roof, our tower's
 * top, the two; 5 cm – 300 m). Nothing in the far pass is nearer than our tower's top, so the near
 * pass is always in front. The mouse sways the eye (`framing.ts`).
 */

export interface WallpaperOptions {
  readonly framing: Framing;
  /** A fixed canvas size (stills); otherwise the window's, at its pixel ratio. */
  readonly size: { w: number; h: number } | null;
  /** A frozen clock (s): stills are the same every time. */
  readonly frozen: number | null;
  /** A fixed mouse (−1…1) for stills. */
  readonly mouse: { x: number; y: number } | null;
  /** Parts left out, to measure what each costs (`hide=trees,land,…` in the address). */
  readonly hide: ReadonlySet<string>;
  /** Brightness, time of day, frame rate, quality: changed live (Lively's panel). */
  readonly settings: Settings;
  /** When Khoa lies down, Linh turns to talk, anyway (s, stills of those scenes), or null. */
  readonly lapAt: number | null;
  readonly chatAt: number | null;
  /** The view turned round the two for a still (rad, negative: left, to Linh's right side at most). */
  readonly orbit: number | null;
  /**
   * The city's model files by name, packed into the build (Lively opens it from disk, where fetches
   * are refused); none, they are fetched from the site (the game's menu, the dev server).
   */
  readonly cityFiles?: Readonly<Record<string, string>>;
  /** Which wheel turns go to the view (the game's menu keeps those over its pages); all if none. */
  readonly wheel?: (event: WheelEvent) => boolean;
  /**
   * Awaited between the building's steps (the game's menu: a frame given back each time, so the
   * page keeps moving; it throws to stop the building, which then frees what it made). None: built
   * in one go (Lively, stills).
   */
  readonly yieldTo?: (step: string) => Promise<void>;
  /**
   * The rocket opening played first in this world (prologue/; Phú 2026-11-18): the app's start with
   * the live menu. Its world runs on the rocket's clock until Khoa sits by Linh.
   */
  readonly prologue?: boolean;
  /** Dev, for stills: the opening started this far in (s), and held there or not. */
  readonly prologueAt?: { readonly t: number; readonly hold: boolean };
}

/** What the scene shows now, for a page laid out over it (the game's menu). */
export interface WallpaperView {
  /** 0 day … 1 night. */
  readonly night: number;
  /** 0 … 1: how golden the light is (the low sun of the evening). */
  readonly golden: number;
  /** The scene's clock (s since midnight): its hour and minute. */
  readonly clockS: number;
  /** How far the wheel has turned the view (rad, negative: left), and as far as it goes. */
  readonly yaw: number;
  readonly stop: number;
  /** The rocket opening, while it plays (and once it is done), or none. */
  readonly prologue: PrologueView | null;
}

export interface Wallpaper {
  view(): WallpaperView;
  /** The opening straight to its end (he sits by her); nothing without one. */
  skip(): void;
  /** Where on the page (CSS px, from the scene's top left) one of the opening's notes points. */
  anchor(name: Anchor, out: THREE.Vector3): THREE.Vector3 | null;
  /** An arrow of the opening's forces as drawn (m), or none. */
  arrowVector(i: number): THREE.Vector2 | null;
  /** The opening as it plays (one object, rewritten each call), or none. */
  prologueView(): Readonly<PrologueView> | null;
  /** The opening's rocket's swoop (its notes' numbers), or none. */
  swoop(): Swoop | null;
  dispose(): void;
}

/** How near our tower a building is drawn in full detail (m): at 230 m a window trim is a pixel. */
const NEAR_US = 230;

/** three's sky's uniforms (its type leaves them a plain record). */
interface SkyUniforms {
  turbidity: { value: number };
  rayleigh: { value: number };
  mieCoefficient: { value: number };
  mieDirectionalG: { value: number };
  cloudCoverage: { value: number };
  cloudDensity: { value: number };
  sunPosition: { value: THREE.Vector3 };
  time: { value: number };
}

/** The sky's brightness against the game's exposure (three's sky is made for about half). */
const SKY_GAIN = 0.5;
const HAZE_DAY = new THREE.Color('#aebfcd');
const HAZE_GOLD = new THREE.Color('#a99aa6');
const HAZE_NIGHT = new THREE.Color('#0c1322');
const SUN_DAY = new THREE.Color('#fff4e2');
const SUN_GOLD = new THREE.Color('#ffae6a');
/** The wind (world): from the west, a little from behind them. */
const WIND = new THREE.Vector3(0.8, 0, 0.35);

export async function startWallpaper(
  host: HTMLElement,
  options: WallpaperOptions,
): Promise<Wallpaper> {
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05; // the game's
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.localClippingEnabled = true; // the outfits' scan
  host.append(renderer.domElement);
  // Undone if the building is stopped part way (the listeners, the observer: added below).
  const undo: (() => void)[] = [];
  const step = async (name: string) => {
    performance.mark(`wallpaper:${name}`);
    await options.yieldTo?.(name);
  };
  try {
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    // The far pass: the game's city placed where it lies from our roof, our land, sky and lab.
    // Packed into the build (Lively opens it from disk, where fetches are refused); served in dev.
    const manager = new THREE.LoadingManager();
    const packed = options.cityFiles;
    if (packed) manager.setURLModifier((url) => packed[url.slice(url.lastIndexOf('/') + 1)] ?? url);
    // The buildings near our tower in full detail (their window trims; Phú: the city's houses
    // finer, only where seen): within NEAR_US of it, close enough for a trim to show.
    const towerInCity = { x: -CITY_ORIGIN.x, z: (TOWER.z0 + TOWER.z1) / 2 - CITY_ORIGIN.z };
    const city = await CityView.load(
      import.meta.env.BASE_URL,
      'full',
      manager,
      (x, z) => Math.hypot(x - towerInCity.x, z - towerInCity.z) < NEAR_US,
    );
    city.place(CITY_ORIGIN.x, CITY_ORIGIN.y, CITY_ORIGIN.z);
    const far = city.scene;
    await step('city');
    // Their roofs, busy (`cityRoofs.ts`).
    const cityTops = cityRoofs(city.plan, city.models);
    cityTops.group.position.set(CITY_ORIGIN.x, CITY_ORIGIN.y, CITY_ORIGIN.z);
    far.add(cityTops.group);
    await step('roofs');
    const fog = new THREE.Fog(HAZE_DAY.clone(), 300, 14000);
    far.fog = fog;
    city.camera.far = 30000;
    city.camera.updateProjectionMatrix();
    // The game's flat ground plane goes: the land under and round the city is ours.
    far.traverse((o) => {
      if (
        o instanceof THREE.Mesh &&
        o.geometry instanceof THREE.PlaneGeometry &&
        o.geometry.parameters.width >= 6000
      ) {
        o.visible = false;
      }
    });
    /**
     * The city's sun kept in the scene at night, dark (its intensity 0 under the horizon): hidden,
     * the far pass had one light fewer and three built every program in it again at dusk and at
     * dawn (and at the first frame, the warm-up having been at night: 0.9 s).
     */
    const keepSun = () => {
      if (citySun) citySun.visible = true;
    };
    const citySun = far.children.find(
      (o): o is THREE.DirectionalLight => o instanceof THREE.DirectionalLight,
    );
    if (citySun) {
      const c = citySun.shadow.camera;
      [c.left, c.right, c.top, c.bottom, c.near, c.far] = [-420, 420, 420, -420, 10, 1600];
      c.updateProjectionMatrix();
    }
    const land = landMesh();
    await step('land');
    land.mesh.position.set(CITY_ORIGIN.x, CITY_ORIGIN.y, CITY_ORIGIN.z);
    far.add(land.mesh);
    const viewer = { x: -CITY_ORIGIN.x, z: -CITY_ORIGIN.z };
    const cityTrees = treeMeshes(streetTrees(), true, viewer);
    await step('street trees');
    const woods = treeMeshes(woodTrees(), false, viewer);
    await step('woods');
    for (const t of [cityTrees, woods]) {
      t.group.position.set(CITY_ORIGIN.x, CITY_ORIGIN.y, CITY_ORIGIN.z);
      far.add(t.group);
    }
    const sky = new Sky();
    sky.scale.setScalar(2000);
    const skyU = sky.material.uniforms as unknown as SkyUniforms;
    skyU.turbidity.value = 4.5;
    skyU.rayleigh.value = 1.3;
    skyU.mieCoefficient.value = 0.004;
    skyU.mieDirectionalG.value = 0.82;
    skyU.cloudCoverage.value = 0.34;
    skyU.cloudDensity.value = 0.5;
    const skyGain = { value: SKY_GAIN };
    sky.material.onBeforeCompile = (shader) => {
      shader.uniforms.skyGain = skyGain;
      shader.fragmentShader = `uniform float skyGain;\n${shader.fragmentShader.replace(
        'gl_FragColor = vec4( texColor, 1.0 );',
        'gl_FragColor = vec4( texColor * skyGain, 1.0 );',
      )}`;
    };
    far.add(sky);
    const night = nightSky();
    far.add(night.mesh);
    const lab = floatingLab();
    await step('lab');
    far.add(lab.group);
    const raid = raidView();
    far.add(raid.group, raid.light);
    const facade = towerFacade(-ROOF_HEIGHT);
    far.add(facade.piece(-ROOF_HEIGHT, -60));
    const moonFar = new THREE.DirectionalLight('#8fb0ff', 0);
    moonFar.position.copy(night.moon).multiplyScalar(500);
    far.add(moonFar);

    // The near pass: the roof, our tower's top, Linh and Khoa.
    const near = new THREE.Scene();
    near.fog = fog;
    const roof = rooftop();
    await step('roof');
    near.add(roof.group);
    near.add(facade.piece(-60, -0.6));
    // A step per body (four of them, each a tenth of a second or more).
    const people = await castAsync(
      {
        ...(options.lapAt === null ? {} : { lapAt: options.lapAt }),
        ...(options.chatAt === null ? {} : { chatAt: options.chatAt }),
      },
      { karambit, card: blackCard },
      () => step('body'),
    );
    near.add(people.group);
    await step('cast');
    // The rocket opening, in the near pass (before the warm-up, so its shaders are built with
    // the rest).
    const prologue =
      options.prologue && options.frozen === null
        ? new Prologue(near, options.prologueAt?.t ?? 0, options.prologueAt?.hold ?? false)
        : null;
    if (prologue) undo.push(() => prologue.dispose());
    const sun = new THREE.DirectionalLight(SUN_DAY.clone(), 3.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    const box = sun.shadow.camera;
    [box.left, box.right, box.top, box.bottom, box.near, box.far] = [-8, 8, 8, -8, 1, 80];
    box.layers.enable(SHADOW_LAYER); // the bodies' shadow-only meshes
    sun.shadow.bias = -0.0002;
    sun.shadow.normalBias = 0.02;
    sun.target.position.set(0, 0, 1);
    const fill = new THREE.HemisphereLight('#bcd4ea', '#5a5148', 0.75);
    const moonNear = new THREE.DirectionalLight('#8fb0ff', 0);
    moonNear.position.copy(night.moon).multiplyScalar(30);
    near.add(sun, sun.target, fill, moonNear);

    // Reflections and fill from the sky: made once each for day, the golden hour and night.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const envSky = new Sky();
    envSky.scale.setScalar(1000);
    envSky.material.uniforms = sky.material.uniforms;
    envSky.material.onBeforeCompile = (shader, r) => sky.material.onBeforeCompile(shader, r);
    const envNight = nightSky();
    envScene.add(envSky, envNight.mesh);
    const hour: Hour = { night: 0, elevation: 0, azimuth: 0, golden: 0, outfit: 0, clockS: 0 };
    const sunDir = new THREE.Vector3();
    const setSun = (h: Hour) =>
      sunDir.set(
        -Math.sin(h.azimuth) * Math.cos(h.elevation),
        Math.sin(h.elevation),
        Math.cos(h.azimuth) * Math.cos(h.elevation),
      );
    const envAt = (t: number) => {
      hourAt(t, hour);
      setSun(hour);
      skyU.sunPosition.value.copy(sunDir);
      envNight.update(hour.night, 0);
      return pmrem.fromScene(envScene).texture;
    };
    const day = envAt(10);
    await step('env day');
    const golden = envAt(175);
    await step('env golden');
    const envs = { day, golden, night: envAt(300) };
    await step('env night');

    const framing = options.framing;
    const camera = new THREE.PerspectiveCamera(framing.fov, 16 / 10, 0.05, 300);
    camera.layers.enable(SELF_LAYER); // the bodies' heads and arms
    const eye = new THREE.Vector3(...framing.eye);
    const target = new THREE.Vector3(...framing.target);
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().subVectors(target, eye).cross(up).normalize();
    const sway = restingSway();
    const mouse = { x: options.mouse?.x ?? 0, y: options.mouse?.y ?? 0 };
    // The wheel turns the view round the two, from the framing to side-on to Linh's right (`framing.ts`);
    // a still may set the turn.
    const orbit = restingOrbit(framing);
    orbit.yaw = orbit.yawTo = Math.max(orbit.stop, Math.min(0, options.orbit ?? 0));
    const onMove = (e: PointerEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    const onWheel = (e: WheelEvent) => {
      if (prologue && !prologue.done) return; // the opening's camera is its own
      if (options.wheel && !options.wheel(e)) return;
      // (Lines or pages as pixels: a line ~16 px.)
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
      scrollOrbit(orbit, e.deltaY * unit);
    };
    if (options.mouse)
      stepSway(sway, mouse.x, mouse.y, 10); // a still starts settled
    else {
      window.addEventListener('pointermove', onMove);
      window.addEventListener('wheel', onWheel, { passive: true });
      undo.push(() => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('wheel', onWheel);
      });
    }
    const turned = { x: 0, y: 0, z: 0 };
    /** The framing turned by the orbit, into `eye` and `target` (and `right` with them). */
    const placeView = () => {
      orbitPoint(orbit, framing.eye, turned);
      eye.set(turned.x, turned.y, turned.z);
      orbitPoint(orbit, framing.target, turned);
      target.set(turned.x, turned.y, turned.z);
      right.subVectors(target, eye).cross(up).normalize();
    };
    placeView();

    const post = wallpaperPost(renderer, far, city.camera, near, camera, 1, 1);
    // Measuring (dev): what each part costs.
    const hide = options.hide;
    if (hide.has('trees')) cityTrees.group.visible = woods.group.visible = false;
    if (hide.has('land')) land.mesh.visible = false;
    if (hide.has('lab')) lab.group.visible = false;
    if (hide.has('near')) people.group.visible = roof.group.visible = false;
    if (hide.has('city')) {
      for (const o of far.children)
        if (o instanceof THREE.Mesh || o instanceof THREE.InstancedMesh || o instanceof THREE.Group)
          if (
            o !== land.mesh &&
            o !== lab.group &&
            o !== raid.group &&
            o !== cityTrees.group &&
            o !== woods.group
          )
            o.visible = false;
    }
    if (hide.has('shadows')) renderer.shadowMap.enabled = false;
    const size = new THREE.Vector2();
    const fit = () => {
      const w = options.size?.w ?? host.clientWidth;
      const h = options.size?.h ?? host.clientHeight;
      // Low quality: a smaller picture, scaled up (the screen's own resolution under High).
      const scale = options.settings.quality === 'low' ? 0.7 : 1;
      renderer.setPixelRatio(options.size ? 1 : Math.min(window.devicePixelRatio, 2) * scale);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Kept to its framing's width on a narrower screen.
      camera.fov = framing.fov * Math.max(1, 1.6 / camera.aspect);
      camera.updateProjectionMatrix();
      renderer.getDrawingBufferSize(size);
      post.setSize(size.x, size.y);
    };
    const resize = new ResizeObserver(fit);
    resize.observe(host);
    undo.push(() => resize.disconnect());
    fit();

    // What the two look at: the hall's roof.
    const labLook = new THREE.Vector3(LAB_AT.x, LAB_AT.y + 8, LAB_AT.z);
    const castFrame = {
      lab: labLook,
      canLap: true,
      night: 0,
      outfit: 0,
      sun: sunDir,
      wind: WIND,
      camera,
      together: -1,
      inkPx: 0.001,
      stunt: null as StuntFrame | null,
      attention: null as THREE.Vector3 | null,
    };
    // Raids: the first soon after the start, then every two and a half to four and a half minutes.
    const raidRandom = random(97);
    let raidStart = -1000;
    let nextRaid = 38;
    const lastSun = new THREE.Vector3();

    /** The world's logic at `clock` (also run ahead, without drawing, for a still). */
    const advance = (clock: number, dt: number) => {
      const day = cycleTime(options.settings, clock);
      if (clock >= nextRaid) {
        if (raidAllowed(day)) {
          raidStart = clock;
          nextRaid = clock + 150 + raidRandom() * 110;
        } else nextRaid = clock + 20;
      }
      const r = clock - raidStart;
      if (r >= RAID.blast && r - dt < RAID.blast) people.startle(clock);
      hourAt(day, hour);
      setSun(hour);
      castFrame.night = hour.night;
      castFrame.outfit = hour.outfit;
      castFrame.together = togetherAt(day);
      castFrame.inkPx =
        (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / Math.max(1, size.y);
      // Khoa lies down only when the sunset scene is not near (it would cut in), and not held at sunset.
      castFrame.canLap =
        togetherAt(day) < 0 && togetherAt(day + 70) < 0 && options.settings.time !== 'sunset';
      people.update(dt, clock, castFrame);
    };

    let last = performance.now();
    let clock = options.frozen ?? (prologue ? prologue.step(0).clock : 0);
    // The opening's camera sees far (the rocket comes from 300 m out); the wallpaper's, to 300 m.
    if (prologue) {
      camera.far = 3000;
      camera.updateProjectionMatrix();
    }
    const normal = { eye: new THREE.Vector3(), target: new THREE.Vector3(), fov: framing.fov };
    let prologueOn = prologue !== null;
    let frame = 0;
    let drawn = 0;
    let warmed = false;
    let quality = options.settings.quality;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      // Kept to the chosen frame rate: a 300 Hz screen does not draw it 300 times a second.
      if (options.frozen === null && !due(now, last, options.settings.fps)) return;
      const dt = options.frozen === null ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
      last = now;
      if (quality !== options.settings.quality) {
        quality = options.settings.quality;
        fit();
      }
      if (!warmed && options.frozen !== null) {
        // A still: live the minutes up to its moment first, so what goes on then shows.
        for (let s = 0; s < options.frozen; s += 1 / 30) advance(s, 1 / 30);
      }
      warmed = true;
      let worldDt = dt;
      if (prologue) {
        // The opening: its world on the rocket's clock (slowed, sped up), the clock set by it,
        // and after it (or a skip to its end) still counted from it.
        const p = prologue.step(dt);
        clock = p.clock;
        worldDt = p.dt;
        prologue.update(castFrame.inkPx, camera.position);
        castFrame.stunt = prologue.stuntNow();
        castFrame.attention = prologue.attentionNow();
      } else {
        if (options.frozen === null) clock += dt;
        castFrame.stunt = null;
        castFrame.attention = null;
      }
      advance(clock, worldDt);

      // The light of the hour.
      const n = hour.night;
      const g = hour.golden;
      skyU.sunPosition.value.copy(sunDir);
      // A low sun: thicker air, redder light (Rayleigh and Mie up), the sky round it in gold and red.
      skyU.turbidity.value = 4.5 + 5 * g;
      skyU.rayleigh.value = 1.3 + 2.4 * g;
      skyU.mieCoefficient.value = 0.004 + 0.008 * g;
      skyU.cloudCoverage.value = 0.34 + 0.08 * g;
      skyU.time.value = clock;
      night.update(n, clock);
      const above = THREE.MathUtils.smoothstep(sunDir.y, -0.03, 0.12);
      sun.color.lerpColors(SUN_DAY, SUN_GOLD, g);
      sun.intensity = 3.2 * above * (1 - 0.35 * g);
      sun.position.copy(sunDir).multiplyScalar(30).add(sun.target.position);
      fill.intensity = 0.75 * (1 - n) + 0.35 * n;
      fill.color.set(n > 0.5 ? '#40507a' : '#bcd4ea');
      moonNear.intensity = 0.6 * n;
      moonFar.intensity = 0.45 * n;
      fog.color.lerpColors(HAZE_DAY, HAZE_GOLD, g).lerp(HAZE_NIGHT, n);
      fog.near = 300 - 150 * n;
      fog.far = 14000 - 8000 * n;
      const env = n > 0.5 ? envs.night : g > 0.5 ? envs.golden : envs.day;
      far.environment = env;
      near.environment = env;
      far.environmentIntensity = 0.6 * (1 - 0.8 * n);
      near.environmentIntensity = 0.55 * (1 - 0.8 * n);
      renderer.toneMappingExposure = (1.05 + 0.5 * n) * options.settings.brightness;
      post.grade.warmth = 0.35 + 0.6 * g - 0.85 * n;
      post.grade.saturation = 1.06 + 0.08 * g + 0.06 * n;
      post.grade.contrast = 1.04 + 0.05 * n;
      post.grade.vignette = 0.22 + 0.14 * n;
      post.bloom.enabled =
        n > 0.05 || (clock - raidStart > RAID.blast - 0.5 && clock - raidStart < RAID.blast + 45);
      post.bloom.strength = 0.28 + 0.5 * n;
      post.bloom.threshold = 2.4 - 1.5 * n;
      post.bloom.radius = 0.5 + 0.15 * n;

      stepSway(sway, mouse.x, mouse.y, dt);
      stepOrbit(orbit, dt);
      placeView();
      camera.position.copy(eye).addScaledVector(right, sway.x).addScaledVector(up, sway.y);
      camera.lookAt(target);
      camera.updateMatrixWorld();
      if (prologue && !prologue.done) {
        normal.eye.copy(camera.position);
        normal.target.copy(target);
        normal.fov = framing.fov * Math.max(1, 1.6 / camera.aspect);
        prologue.camera(camera, normal, dt);
      } else if (prologueOn) {
        // The opening over: the wallpaper's own camera, as it left it.
        prologueOn = false;
        camera.far = 300;
        fit();
      }
      lab.update(clock, n);
      facade.setTime(clock);
      facade.setNight(n);
      cityTops.setNight(n);
      city.update(camera, hour.clockS, dt);
      keepSun();
      if (citySun) {
        // The city's sun: ours (its shadows redrawn once it has moved half a degree).
        citySun.position.copy(sunDir).multiplyScalar(800).add(citySun.target.position);
        if (lastSun.dot(sunDir) < Math.cos(0.02)) {
          lastSun.copy(sunDir);
          citySun.shadow.needsUpdate = true;
        }
      }
      lab.group.updateMatrixWorld(true);
      const r = clock - raidStart;
      raid.update(r, dt, lab.roofTop, n, city.camera, size.y);
      lab.oculus.visible = !raid.blown(r);
      (roof.beacon.material as THREE.MeshStandardMaterial).emissiveIntensity =
        clock % 1.5 < 0.4 ? 4 : 0.15;
      if (hide.has('post')) {
        renderer.autoClear = false;
        renderer.clear();
        renderer.render(far, city.camera);
        renderer.clearDepth();
        renderer.render(near, camera);
      } else post.render();
      // Ready once a few frames are drawn (programs compiled, shadows made): stills wait for it.
      if (++drawn === 4) host.dataset.ready = '1';
    };
    // Every program compiled before the first frame: all that can show, shown once unseen (a
    // karambit, the night clothes, the raid, the night sky first appearing stalled the page
    // ~300 ms each as its shaders were built).
    {
      const shown: [THREE.Object3D, boolean][] = [];
      for (const scene of [far, near]) {
        scene.traverse((o) => {
          shown.push([o, o.visible]);
          o.visible = true;
        });
      }
      // With the scenes' reflections set: a program built without them is built again later.
      far.environment = envs.day;
      near.environment = envs.day;
      camera.position.copy(eye);
      camera.lookAt(target);
      camera.updateMatrixWorld();
      city.update(camera, hour.clockS, 0);
      keepSun();
      // Compiled side by side, off the page's thread where the browser can (a second or more of
      // shaders, built in one go, froze the game's opening behind it).
      await step('post');
      await post.compile(people.group);
      await step('shaders');
      // The pictures uploaded one a step, then each pass drawn once on its own (its shapes
      // uploaded, its shadow map's programs built): the first frame did all of it at once.
      for (const texture of texturesOf(far, near)) {
        renderer.initTexture(texture);
        await step('texture');
      }
      post.warm(0);
      await step('far drawn');
      // The near pass a mesh at a time: drawn the first time, each one's shaders are made ready
      // for the graphics card (on Direct3D, at the first draw: the whole near pass at once held
      // the page 1.4 s, one body 0.65 s).
      const meshes: THREE.Mesh[] = [];
      near.traverse((o) => {
        if (o instanceof THREE.Mesh) meshes.push(o as THREE.Mesh);
      });
      const was = meshes.map((m) => m.visible);
      for (const mesh of meshes) {
        for (const m of meshes) m.visible = m === mesh;
        post.warm(1);
        await step('near part');
      }
      meshes.forEach((m, i) => (m.visible = was[i] ?? true));
      post.render();
      for (const [o, v] of shown) o.visible = v;
      await step('first frame');
    }
    // Nothing drawn while the page is hidden (a full-screen window over the desktop).
    const onVisibility = () => {
      cancelAnimationFrame(frame);
      if (document.visibilityState === 'visible') {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    frame = requestAnimationFrame(tick);

    const dispose = () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('wheel', onWheel);
      resize.disconnect();
      people.dispose();
      roof.dispose();
      lab.dispose();
      raid.dispose();
      land.dispose();
      cityTrees.dispose();
      woods.dispose();
      facade.dispose();
      cityTops.dispose();
      city.dispose();
      night.dispose();
      envNight.dispose();
      for (const t of Object.values(envs)) t.dispose();
      pmrem.dispose();
      for (const s of [sky, envSky]) {
        s.geometry.dispose();
        s.material.dispose();
      }
      post.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
    return {
      view: () => ({
        night: hour.night,
        golden: hour.golden,
        clockS: hour.clockS,
        yaw: orbit.yaw,
        stop: orbit.stop,
        prologue: prologue ? prologue.view() : null,
      }),
      skip: () => {
        if (!prologue || prologue.done) return;
        prologue.skip();
        // Both put where the scene now has them at once (he was in the rocket a moment ago).
        people.snap();
      },
      anchor: (name, out) => {
        if (!prologue || prologue.done) return null;
        prologue.anchor(name, out);
        if (!Number.isFinite(out.x)) return null;
        out.project(camera);
        if (out.z > 1) return null;
        return out.set(
          ((out.x + 1) / 2) * host.clientWidth,
          ((1 - out.y) / 2) * host.clientHeight,
          0,
        );
      },
      arrowVector: (i) => prologue?.arrowVector(i) ?? null,
      prologueView: () => prologue?.view() ?? null,
      swoop: () => prologue?.swoop ?? null,
      dispose,
    };
  } catch (error) {
    // Stopped part way (or failed): what was made goes, the graphics context with it.
    for (const u of undo) u();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
    throw error;
  }
}

/** Every picture the scenes' materials use (maps, normal maps, glow maps…), once each. */
function texturesOf(...scenes: THREE.Object3D[]): Set<THREE.Texture> {
  const found = new Set<THREE.Texture>();
  for (const scene of scenes) {
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const materials: unknown[] = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of materials) {
        if (!(m instanceof THREE.Material)) continue;
        for (const value of Object.values(m) as unknown[]) {
          if (value instanceof THREE.Texture && !value.isRenderTargetTexture) {
            found.add(value as THREE.Texture);
          }
        }
      }
    });
  }
  return found;
}
