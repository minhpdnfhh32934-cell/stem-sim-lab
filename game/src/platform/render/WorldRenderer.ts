import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Disposables } from '../../core/EventBus';
import type { Quat, Vec3 } from '../../core/math';
import type { GameSystem } from '../../core/SystemRunner';
import type { Game } from '../../game/Game';
import { LIGHTS_OFF, ROOM_LIGHTS } from '../../gameplay/interaction/behaviors';
import type { ItemDefinition } from '../../gameplay/item';
import { inspectFov } from '../../gameplay/player/inspect';
import { leanDirection } from '../../gameplay/player/lean';
import { highOrMore } from '../../persistence/settings';
import type { RoomDefinition, SceneDefinition } from '../../world/definitions';
import { DAY_S, daylight } from '../../world/clock';
import { roomLights } from '../../world/lighting';
import { roomSlabs, WALL_THICKNESS } from '../../world/roomGeometry';
import type { WorldEntity } from '../../world/World';
import { benchModel, type BenchFrame } from './bench/registry';
import { swapsOf } from './assembly';
import { ContainerViews } from './ContainerView';
import { Reveals } from './reveal';
import { SharedMaterials } from './sharedMaterials';
import { ExperimentView } from './ExperimentView';
import { HandsView } from './HandsView';
import { buildLauncher, type LauncherModel } from './launcherModel';
import { type ControlModel, type ControlShapes, controlShapes } from './consoleModel';
import { ContactShadows } from './contactShadows';
import { DecorBatches } from './decorBatches';
import { ASLEEP_LAYER, RoomSleep } from './roomSleep';
import { FLOOR_SURFACES, SHELL_SURFACES, Surfaces } from './surfaces';
import { ModelDetail } from './detail';
import type * as PostModule from './post';
import type { Post, PostOptions } from './post';
import type { SeeThrough } from './effectsPass';
import { softerShadows } from './shadowTaps';
import { Finishes } from './finishes';
import { FloorPath } from './floorPath';
import { Outlines } from './outlines';
import { buildSpringFrame, type SpringFrame } from './hookeModel';
import { Palette } from './palette';
import { swingAngle } from '../../world/hinge';
import { attachParts, type Leaf, PropCache, type PropPart } from './props';
import { buildPendulumFrame, type PendulumFrame } from './pendulumModel';
import { buildTowerFrame, type TowerFrame } from './towerModel';
import { SHADOW_LAYER } from './body/BodyModel';
import { BodyView } from './body/BodyView';
import { type PrepareReal, realTextures } from './body/realBody';
import { LOOKS } from './looks';
import { CardReaders } from './cardReaders';
import { mergeStill } from './mergeStill';
import { Mirrors } from './mirrors';
import { BoardWriting } from './boardWriting';
import { NpcActors } from './npcActors';
import { EmergencyView } from './emergency/EmergencyView';
import { RemotePlayers } from './remotePlayers';
import { PeriodicBoard } from './periodicBoard';
import { ProgressBoard } from './progressBoard';
import { CircuitView } from './circuitView';
import { FireView } from './fireView';
import { PhoneView } from './phoneView';
import { LaptopView } from './laptopView';
import { QUALITY } from './quality';
import { RoomLightPool } from './roomLights';
import { ShadowCache } from './shadowCache';
import { drawFormula } from './formulaCanvas';
import { decimalComma, layoutFormula } from '../../core/formula';
import { INTEGRATED_GPU, lowerQuality, QualityWatch, SLOW_FPS, WINDOW_S } from './qualityWatch';
import { type ExplainAnchor, ExplainFraming } from './explainFraming';
import { type DressPart, dressRoom } from './dress';
import { fittings } from './dress/fittings';
import { paintSky } from './sky';
import type * as CityModule from './city/CityView';
import type * as GpuModule from './gpu/GpuDevice';
import type { GpuDevice } from './gpu/GpuDevice';
import { around, glassGrid, glassPane, type Rect } from './glassFloor';
import { baseboards, tileImage, tiles } from './roomShell';
import { WaterStreams } from './water';

type StandardMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
type Lighting = Extract<SceneDefinition, { kind: 'world' }>['lighting'];
/** The materials a room's indirect light reaches (an ambient-occlusion map darkens it). */
type RoomLitMaterial =
  THREE.MeshStandardMaterial | THREE.MeshLambertMaterial | THREE.MeshPhongMaterial;
const roomLit = (m: THREE.Material | THREE.Material[]): m is RoomLitMaterial =>
  m instanceof THREE.MeshStandardMaterial ||
  m instanceof THREE.MeshLambertMaterial ||
  m instanceof THREE.MeshPhongMaterial;

/** One scene's room shells: their meshes (own geometry each) and the materials they share. */
interface SceneRooms {
  readonly group: THREE.Group;
  readonly materials: readonly THREE.Material[];
  /** Its floors' and ceilings' tiles (one texture per slab size). */
  readonly textures: readonly THREE.Texture[];
  /** What they were built from: Ultra's fittings come and go with the preset. */
  readonly rooms: readonly RoomDefinition[];
  readonly enhanced: boolean;
  /** Its glass floor, if it has one drawn (High, Ultra): where it is, and the city's detail. */
  readonly glass: {
    readonly box: THREE.Box3;
    readonly detail: CityModule.CityDetail;
    /** Its room: the city is drawn while the player is in it (walls hide it from anywhere else). */
    readonly roomId: string;
    readonly room: RoomDefinition;
  } | null;
}

interface EntityView {
  readonly group: THREE.Group;
  /** Its prop's hinged leaves (a cabinet's doors), turned as the hinge system says (turnLeaves). */
  readonly leaves: readonly Leaf[];
  readonly mesh: StandardMesh;
  readonly entity: WorldEntity;
  /** A launcher's barrel pivot, turned by the `param.angle` state (degrees). */
  readonly barrel: THREE.Group | null;
  /** A launcher's drawn apparatus (its geometry and materials are freed with the view). */
  readonly launcher: LauncherModel | null;
  /** A pendulum stand's drawn frame (its geometry and materials are freed with the view). */
  readonly pendulum: PendulumFrame | null;
  /** A spring stand's drawn frame (its geometry and materials are freed with the view). */
  readonly spring: SpringFrame | null;
  /** A free-fall tower's drawn frame (its geometry and materials are freed with the view). */
  readonly tower: TowerFrame | null;
  /** A bench apparatus' frame, by its registered model (freed with the view). */
  readonly bench: BenchFrame | null;
  /** Its frames' fixed parts, merged (mergeStill.ts): freed with the view. */
  readonly merged: readonly THREE.BufferGeometry[];
  /** Its body's batch (addEntity), or null: its own mesh always draws it. */
  readonly bodyKey: string | null;
  /** Glow it has of its own (light panels); focus adds to it, `active` replaces it. */
  readonly baseEmissive: THREE.Color;
  /**
   * Its look's material, shared with every entity of that look and colour (`mesh.material` is a
   * copy of its own while it is focused, active or charred); null: its own for good (glass, a
   * light, a reveal: changed in place).
   */
  readonly shared: THREE.MeshStandardMaterial | null;
  /** A free-standing glass vessel: a contact shadow under it (contactShadows.ts). */
  readonly grounded: boolean;
}

/** Objects compiled together while the game is played (a neighbour scene's shaders). */
const COMPILE_BATCH = 24;
/**
 * How long ANGLE/D3D11 takes to compile one of the lit programs (ms, the Phase G trace: 200–220 ms
 * on the RTX 5070 Laptop) and on how many threads at once: the wait before asking if they are ready.
 */
const PROGRAM_MS = 230;
const COMPILERS = 4;
/** Milliseconds a frame may spend building Ultra's detailed parts (render/detail.ts). */
const DETAIL_BUDGET_MS = 2.5;
const FOCUS_EMISSIVE = new THREE.Color('#2a3440');
const DEG = Math.PI / 180;
const CEILING = '#f7f8fa';
/** Enhanced rooms' skirting: one dark painted trim for every room. */
const SKIRTING = '#3d434a';
/** A layer no camera or light renders: objects wait in it while their shaders compile. */
/** The longest a world load waits for Ultra's chunk and surfaces (ultraReady). */
const ULTRA_WAIT_MS = 20_000;
const PENDING_LAYER = 31;
/** The layer of the objects being drawn off screen once (warmDraw), and how many a frame. */
const WARM_LAYER = 30;
const WARM_BATCH = 40;
const WARM_START = 8;
/** Idle work: more than one task a callback only with this much spare time left (ms); at the latest after (ms). */
const IDLE_MIN_MS = 3;
const IDLE_TIMEOUT_MS = 200;
const WARM_TAIL = 3;
/** The warm-up batch shrinks after a frame over SLOW × the usual interval + SLACK, grows under FAST ×. */
const WARM_SLOW = 1.5;
const WARM_SLACK_S = 0.002;
const WARM_FAST = 1.2;
/**
 * Slow frames shrink the batch only this long (s): where frames are slow anyway, not from the
 * warm-up, one a frame kept a door preparing for seconds (SwiftShader: 121 at ~9 FPS, 13 s).
 */
const WARM_MAX_S = 1;
/**
 * New texture data a warm-up batch may upload (bytes; at least one object a frame): a batch of the
 * hub's boards and signs uploaded 61 MB of canvases in one frame, the Physics Lab's 50 MB, and the
 * page waited 100–130 ms on the GPU process (RTX 5070, High; 2026-11-14).
 */
const WARM_BYTES = 8e6;
/**
 * Enhanced scenes: the ceiling's own soft glow (emissive, its colour × this). No light here reaches
 * a downward face but the hemisphere's ground, so the whitest paint rendered darker than the walls
 * (113 against 167–179 of 255); 0.2 brings it level with them and below the lamps at every graphics
 * quality (measured, P3.11), standing in for the lamps' light and the bounce off the walls.
 */
const CEILING_GLOW = 0.2;
/**
 * High: the generated room light (RoomEnvironment) turned about x. Its brightest panel lies 31°
 * above the horizon towards +z, so unturned it lit every surface facing +z from the front: the
 * pendulum bay's back wall and sign were 24 % brighter than under Medium, a veil. Turned 40°, the
 * panel shines from above, as the lab's lamps do, and its light falls more evenly on the walls
 * (measured, docs/phase-high-clarity-report.md).
 */
const ROOM_LIGHT_TILT = -40 * DEG;
/**
 * The hemisphere light dims by this much per unit of room light, so the room is not lit twice:
 * High keeps Medium's brightness. Measured: the factor that brings matte walls to Medium's
 * brightness (median of 10 wall patches in four views, 3.8–5.1; ceilings need less, floors more).
 * 3, set by eye (P3.5), left every surface brighter.
 */
const HEMISPHERE_GIVES_WAY = 4.9;
/**
 * Enhanced scenes: the hemisphere's share, the soft light the rooms' own lights bounce about; the
 * room lights (world/lighting.ts) are the key. Below it shadowed sides went black. 0.55 in phase
 * UX2 (set on the RTX 5070 Laptop stills); 0.8 since Phase T-1a (Phú, 2026-11-05: every lab
 * clearly lit, no dim corners): walls far from a key — the 18 m Physics Lab's west end, its
 * whiteboard — were dark grey. Flatter shading, traded for seeing everything.
 */
const INDOOR_AMBIENT = 0.8;
/**
 * The share of the indirect light (ambient, environment, reflections) a room keeps with its lights
 * switched off, and of Low's sun and fill where the player stands in one: daylight through the door
 * and the corridor. A look value.
 */
const SWITCHED_OFF_AMBIENT = 0.12;
const BLACK = new THREE.Color(0x000000);
/** WebGL renderer names of rasterisers that run on the CPU (the bench tells them apart the same way). */
const SOFTWARE_RENDERER = /SwiftShader|llvmpipe|Software|Basic Render/i;
/**
 * Signs and item labels: texels per metre of their face, and the widest canvas (render-quality
 * audit F2: sharp from about 1 m; was 400 and 2048). One value for every preset.
 */
const LABEL_PX_PER_M = 1000;
const LABEL_MAX_PX = 4096;
/** A contact shadow's radius against its vessel's widest half (a look value). */
const CONTACT_SPREAD = 1.2;

/**
 * Three.js view of the world. It owns no game data: it mirrors World/GameState through events
 * (spawn, despawn, state change, focus) and, once per frame, copies the player transform and the
 * poses of dynamic (physics-driven) entities. Physics is the authority for those poses.
 * shortcut: placeholder primitives and flat lighting; real assets/PBR arrive in Phase 14.
 */
/** A see-through display's text: light on a tinted glass, framed (Phase T-1a). */
const GLASS_LABEL = {
  background: 'rgba(8, 22, 34, 0.55)',
  color: '#e8f6ff',
  frame: '#8fd8ff',
} as const;

/**
 * The close view of a board while the teacher works an example on it (its frame, m): in front and
 * a little to its right, looking a little below its middle — the board left of the middle, above
 * the dialogue box, the teacher beside it on the right; not shifted aside as for the Explain panel.
 */
const BOARD_VIEW = { from: [0.55, 0, 1.75], to: [0.55, -0.2, 0] } as const satisfies {
  from: Vec3;
  to: Vec3;
};

/** How long after a failed load the city is asked for again (s). */
const CITY_RETRY_S = 5;
/** How long the city stays loaded after the player leaves its room (s): a doorway's step back. */
const CITY_LINGER = 2;
/**
 * Paused or in the main menu nothing moves (systems run with dt 0): the picture is drawn this many
 * times a second, not at the display's rate — a settings change still shows within 50 ms.
 */
const IDLE_HZ = 20;
/** Ultra: rooms this near (m) the player have their reflections captured ahead of a visit. */
const CAPTURE_AHEAD_M = 3;

export class WorldRenderer implements GameSystem {
  readonly id = 'renderer';
  /** The WebGL device (every preset but Ultra on WebGPU); null while `gpu` draws. */
  private renderer: THREE.WebGLRenderer | null = null;
  /** Ultra's WebGPU device (gpu/GpuDevice.ts, its own chunk), while it draws; then no `renderer`. */
  private gpu: GpuDevice | null = null;
  private gpuModule: typeof GpuModule | null = null;
  /** A change of device on its way (the WebGPU one starts asynchronously). */
  private switching: Promise<void> | null = null;
  /** WebGPU refused to start here: Ultra stays on WebGL this session (warned once). */
  private gpuFailed = false;
  private disposed = false;
  private resizeObserver: ResizeObserver | null = null;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly rooms = new THREE.Group();
  /** Room shells by scene: the current scene's and each resident neighbour's. */
  private readonly sceneRooms = new Map<string, SceneRooms>();
  private readonly views = new Map<string, EntityView>();
  /** Views whose pose physics changes every step; static views are positioned once. */
  private readonly dynamicViews = new Set<EntityView>();
  /** Walk-through door leaves: drawn slid along their own +x by their pair's opening fraction. */
  private readonly leafViews = new Set<EntityView>();
  /** Views with hinged leaves (an item with `hinged`): turned each frame by its swing. */
  private readonly hingedViews = new Set<EntityView>();
  /** Running water (items with `visual.stream`), its shaders compiled before it is first shown. */
  private readonly water = new WaterStreams((object) => {
    if (this.gpu) {
      this.gpuCompile([object], 'Water shaders did not compile');
      return;
    }
    const renderer = this.renderer;
    if (!renderer) return;
    void renderer
      .compileAsync(object, this.camera, this.scene)
      .then(() => this.keepPrograms(renderer)) // linked now, not at the first 'Turn on water'
      .catch((error: unknown) => this.game.log.warn('Water shaders did not compile', error));
  });
  private readonly geometries = new Map<string, THREE.BufferGeometry>();
  /** Shader programs already used once and kept for the session (precompile). */
  private readonly warmPrograms = new WeakSet<object>();
  /** Kinds of shadow caster (instanced or not) already drawn once in a shadow pass. */
  private readonly warmShadows = new Set<string>();
  /** The usual frame interval (s), averaged while nothing is warmed. */
  private frameDt = 1 / 60;
  /**
   * Rooms' dressings by room and place (dressOf): built in a door's attach frame, the Physics
   * Lab's took ~12 ms of it (RTX 5070, 2026-11-14). Their geometry is freed with the room's shells
   * and uploaded again; a load (a new session frame) forgets them.
   */
  private readonly dresses = new Map<string, DressPart[]>();
  /** The renderer's prefilter (pmremOf), made with its first environment. */
  private pmrem: THREE.PMREMGenerator | null = null;
  /** Work for idle time (prewarmNeighbours), and the idle callback waiting to run it. */
  private readonly idle: (() => void)[] = [];
  private idleHandle: number | null = null;
  /** Objects being drawn once before they are shown (warmDraw), a batch a frame. */
  private warming: {
    objects: THREE.Object3D[];
    culled: boolean[];
    next: number;
    tail: number;
    /** How many it draws a frame now (adapted to the frame time). */
    batch: number;
    /** Seconds since it started (WARM_MAX_S). */
    elapsed: number;
    done: () => void;
  } | null = null;
  private readonly canvasSize = new THREE.Vector2();
  /** The lights that may cast shadows (warmStep). */
  private readonly shadowLights: (THREE.SpotLight | THREE.DirectionalLight)[] = [];
  /** Their maps drawn again only when what they show changed (shadowCache.ts). */
  private shadowCache: ShadowCache | null = null;
  /** Slow frames held while playing: one preset lower, if the player never picked one. */
  private readonly qualityWatch = new QualityWatch();
  /** The Explain view's close camera and labels (Phase X). */
  private readonly explainFraming = new ExplainFraming();
  /** The station the Explain view frames, or null. */
  private explainFramed: string | null = null;
  private readonly explainTurn = new THREE.Euler();
  private readonly explainQuat = new THREE.Quaternion();
  /** When the last frame was drawn while idle (paused, the main menu): performance.now(), ms. */
  private idleDrawnAt = -Infinity;
  /** Set just before the frame's own draw: the scene's first draw then checks the casters. */
  private shadowArmed = false;
  /** GpuDevice.settled as last seen (its shadows drawn again since). */
  private gpuSettled = 0;
  /** Label planes, one per item and language, shared by every view of the item. */
  private readonly labels = new Map<
    string,
    { geometry: THREE.PlaneGeometry; material: THREE.MeshStandardMaterial }
  >();
  // Reused each frame: a drawn (blended) position and rotation.
  private readonly drawnPosition: Vec3 = [0, 0, 0];
  /** The entity an action acted out shows where it was, until its `place` moment (Phase H-3). */
  private placing: string | null = null;
  /** The player's drawn feet and the view's lean direction this frame (scratch). */
  private readonly drawnFeet: Vec3 = [0, 0, 0];
  private readonly lean: Vec3 = [0, 0, 0];
  private readonly drawnRotation: Quat = [0, 0, 0, 1];
  /** Station controls' shapes, one set per model and size, shared by every copy. */
  private readonly controls = new Map<string, ControlShapes>();
  /** Bench model keys without a model, warned about once each (drawn as their item's box). */
  private readonly unknownBenches = new Set<string>();
  /** Their dark trim (desk plinths, button bezels, display feet): one material for all. */
  private readonly trim = new THREE.MeshStandardMaterial({ color: '#25292e', ...LOOKS.plastic });
  /** Props' finishes and decor's surfaces: one material each, shared by every copy. */
  private readonly palette = new Palette();
  /** Props' parts, one set per prop and size, shared by entities and decor alike. */
  private readonly props = new PropCache();
  /** Decor items: per scene, one instanced mesh per part of each item instead of a view per copy. */
  private readonly decor = new DecorBatches(
    this.scene,
    this.palette,
    (item) => this.partsOf(item),
    (mesh) => {
      // In the preset's finishes, whenever a batch is drawn (a scene's build, a copy added later).
      this.finishes.adopt(mesh);
      this.adoptUltra(mesh);
      this.darknessDirty = true;
    },
  );
  /** Ultra's model detail (render/detail.ts): bevelled boxes, rounder round parts. */
  private readonly detail = new ModelDetail();
  /** The time of day the sky was last painted for (sky.ts); −∞: not yet. */
  private skyPaintedAt = -Infinity;
  /** The rooms of a neighbour scene being attached: what spawns in them waits to be compiled. */
  private readonly attaching = new Set<string>();
  /** The city under a glass floor (Phase V-2): loading, or drawn; its scene's id and detail. */
  private city: {
    view: CityModule.CityView | null;
    sceneId: string;
    detail: CityModule.CityDetail;
  } | null = null;
  /**
   * Which scene's glass floor each glass-floored room has (its city loads while the player is in
   * that room: Phú 2026-11-08, no city loaded anywhere else).
   */
  private readonly glassRooms = new Map<string, string>();
  /** Seconds before a city that failed to load is asked for again. */
  private cityRetry = 0;
  /** How long the player has been out of the city's room (s): it is freed after CITY_LINGER. */
  private cityAway = 0;
  private readonly cityFrustum = new THREE.Frustum();
  private readonly cityMatrix = new THREE.Matrix4();
  /** Ultra's real surfaces (render/surfaces.ts), loaded only for it. */
  private readonly surfaces = new Surfaces(import.meta.env.BASE_URL, () =>
    this.gpu
      ? this.gpu.renderer.getMaxAnisotropy()
      : this.renderer
        ? this.renderer.capabilities.getMaxAnisotropy()
        : 1,
  );
  /** Ultra's post-processing (render/post.ts, its own chunk), while Ultra is chosen. */
  private post: Post | null = null;
  /** The chunk's import (one for every caller), and the chunk once here. */
  private postFetch: Promise<void> | null = null;
  private postModule: typeof PostModule | null = null;
  /** What the chain was made with (Ultra's, or Max's grade and AO samples). */
  private postOptions: PostOptions | null = null;
  /** The glassware and the stirred liquids Ultra's see-through pass draws (effectsPass.ts). */
  private readonly seeThrough: SeeThrough = {
    glass: () => this.finishes.glassMeshes(),
    showGlass: (shown) => this.finishes.showGlass(shown),
    stirred: () => this.containers.stirred(),
  };
  private readonly postSize = new THREE.Vector2();
  /** Rooms out of sight left undrawn and off the GPU (world/dormancy.ts, Settings). */
  private readonly sleep = new RoomSleep({
    on: () => this.game.roomSleep,
    rooms: () => this.residentRooms(),
    closers: () => {
      const out: { id: string; x: number; z: number }[] = [];
      for (const entity of this.game.world.allEntities()) {
        if (!entity.item.slider && !entity.item.door) continue;
        out.push({ id: entity.id, x: entity.pose.position[0], z: entity.pose.position[2] });
      }
      return out;
    },
    opening: (id) => Math.max(this.game.doors.fraction(id), this.game.sliders.fraction(id)),
    roomAt: (x, z) => this.game.world.roomAt(x, z)?.id ?? null,
    objectsOf: (roomId) => this.objectsOf(roomId),
    scene: this.scene,
    warm: (objects) => this.warmRoom(objects),
    hurry: () => {
      this.warming?.done();
      this.warming = null;
    },
    changed: () => this.placeRoomLights(),
  });
  private readonly subscriptions = new Disposables();
  private focusedId: string | null = null;
  private readonly hands: HandsView;
  private readonly experiment: ExperimentView;
  /** The see-through displays shown near the player (Phase T-1a). */
  private readonly reveals = new Reveals();
  private readonly hemisphere = new THREE.HemisphereLight('#ffffff', '#56606b', 1.6);
  private readonly sun = new THREE.DirectionalLight('#ffffff', 1.4);
  /** Enhanced scenes only: a low light from the side the sun is not, no shadows — walls facing
   * different ways read apart, and fronts of desks and apparatus are not flat. */
  private readonly fill = new THREE.DirectionalLight('#dfe8f5', 0.7);
  private enhanced = false;
  /** Enhanced and the preset lights rooms by their fixtures (quality.ts `roomLights`). */
  private roomLit = false;
  /** Rooms whose light switch is off (its `lightsOff` state): their lights, glow and fixtures dark. */
  private readonly darkRooms = new Set<string>();
  /**
   * A dark room's surfaces take their indirect light (ambient, environment, reflections) at
   * SWITCHED_OFF_AMBIENT through this ambient-occlusion map, per room: a lit room seen through a
   * door keeps its own (applyDarkness).
   */
  private readonly unlit = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  /** Materials darkened in place (drawn only in dark rooms). */
  private readonly darkened = new Set<RoomLitMaterial>();
  /** A dark copy of each material a lit room draws too, and the meshes wearing one (→ original). */
  private readonly darkTwins = new Map<RoomLitMaterial, RoomLitMaterial>();
  private readonly twinned = new Map<THREE.Mesh, RoomLitMaterial>();
  /**
   * Entity materials by look and colour: 175 entities of the Physics Lab drew with 175 materials
   * of 21 looks, a material change (uniforms) between each two (2026-11-13, Low/Medium).
   */
  private readonly paints = new SharedMaterials<THREE.MeshStandardMaterial>();
  /** Something that changes which meshes are dark: applied once before the next frame. */
  private darknessDirty = false;
  /** Each built room's ceiling material (its glow goes with the room's lights). */
  private readonly ceilings = new Map<string, THREE.MeshStandardMaterial>();
  /** Enhanced scenes' key and fill: each room's own lights, in a fixed pool (roomLights.ts). */
  private readonly roomLights = new RoomLightPool(this.scene);
  /** The player's body: its shadow, its reflection, and what the player sees looking down. */
  private readonly body: BodyView;
  /** The world's people (Phase Y: the hub's teacher). */
  private readonly npcActors: NpcActors;
  /** An emergency call answered (Phú 2026-11-13): the helicopter, the ceiling, the squad. */
  private readonly emergency: EmergencyView;
  /** The other players in the room (Phase M). */
  private readonly remotePlayers: RemotePlayers;
  /** The hub's learning progress board, drawn from the save. */
  private readonly progressBoard: ProgressBoard;
  private readonly periodicBoard: PeriodicBoard;
  /** The circuit bench's boards: sockets, parts, leads, readings (Phase E-1). */
  private readonly circuits: CircuitView;
  /** Fire, smoke and the extinguisher's jet (Phase E-2). */
  private readonly fire: FireView;
  /** The player's phone in the hand (Phase E-2b). */
  private readonly phone: PhoneView;
  /** The hub laptop's screen and lights (Phase F-2). */
  private readonly laptop: LaptopView;
  /** What the hub's teacher writes on a board (Phase Y-3). */
  private readonly boardWriting: BoardWriting;
  /** Mirrors' reflections, at `mirrorScale` of the drawing buffer (the preset's). */
  private readonly mirrors: Mirrors;
  /** The card readers beside walk-through doors (Phase H-3). */
  private readonly readers = new CardReaders();
  private mirrorScale = 0;
  private readonly bufferSize = new THREE.Vector2();
  /** The tile images of floors and ceilings (enhanced), drawn on first use and kept. */
  private tileImages: {
    floor: HTMLCanvasElement | null;
    ceiling: HTMLCanvasElement | null;
  } | null = null;
  /** The prefiltered room light (graphics quality), made once on first use, then kept. */
  private environment: THREE.Texture | null = null;
  /** Ultra: each room's reflections, captured from it once (startCapture, captureStep), while it is resident. */
  private readonly roomEnvironments = new Map<string, THREE.Texture>();
  /** The captured room reflecting now (Ultra), or null for the generated one. */
  private reflectedRoom: string | null = null;
  private reflectionClock = 0;
  /** A room's reflections being captured, a cube face a frame (captureStep). */
  private capture: {
    readonly roomId: string;
    readonly target: THREE.WebGLCubeRenderTarget | ReturnType<GpuDevice['cubeTarget']>;
    readonly cube: THREE.CubeCamera;
    face: number;
  } | null = null;
  /** What the preset changes on materials and textures (finishes.ts), applied as things come. */
  private readonly finishes: Finishes;
  /** The physical lab's glassware: glass, liquid, mark and stopper, drawn from container state. */
  private readonly containers: ContainerViews;
  /** What the held object can act on, outlined (Phase A, A2); `outlined`: the list's version drawn. */
  private readonly outlines = new Outlines();
  private outlined = '';
  /** The guided task's way on the floor (A5); `guided`: TaskGuide's version drawn. */
  private readonly floorPath = new FloorPath();
  private guided = -1;
  private readonly outlineIds: string[] = [];
  /** Soft shadows under free-standing glass vessels (Medium and up): one instanced draw. */
  private readonly contact = new ContactShadows();
  /** The experiment group's children when last adopted (its lanes come with a run's view). */
  private lanes = -1;
  private lastLane: THREE.Object3D | null = null;
  /**
   * The canvas's size in device pixels as the browser composites it (`device-pixel-content-box`),
   * once known: the drawing buffer is sized from it exactly (render-quality audit F8).
   */
  private deviceBox: { width: number; height: number } | null = null;
  private observed = false;

  constructor(
    private readonly host: HTMLElement,
    private readonly game: Game,
    /**
     * The page's canvas, in `host` (main.ts makes it). A change of device puts a fresh canvas in
     * its place (useCanvas): a canvas keeps the first kind of context it gave.
     */
    private canvas: HTMLCanvasElement,
  ) {
    softerShadows(); // Max's smoother penumbra: before any program is compiled (shadowTaps.ts)
    this.camera = new THREE.PerspectiveCamera(game.config.graphics.fov, 1, 0.05, 200);
    this.camera.rotation.order = 'YXZ';
    this.hands = new HandsView(game);
    this.body = new BodyView(game);
    this.boardWriting = new BoardWriting(this.scene, game);
    this.npcActors = new NpcActors(this.scene, game, this.contact, (partId, out) =>
      this.explainPart(partId, out),
    );
    this.emergency = new EmergencyView(this.scene, game, this.contact, {
      ceilingOf: (roomId) => this.ceilingOf(roomId),
      hide: (entityId, hidden) => {
        const view = this.views.get(entityId);
        if (view) this.showView(view, !hidden);
        else this.decor.hide(entityId, hidden);
      },
      // Its own view's twin (sharing geometry and materials), or its decor batch's.
      copyOf: (entityId) => this.views.get(entityId)?.group.clone() ?? this.decor.copyOf(entityId),
      sky: () => this.palette.finish('outside-sky').color,
      prepare: (roots) => {
        // As a neighbour scene's parts: for the frame's target (Ultra's composer), in batches.
        if (this.gpu) {
          this.gpuCompile(roots, 'Emergency shaders did not compile');
          return;
        }
        const renderer = this.renderer;
        if (!renderer) return;
        const objects: THREE.Object3D[] = [];
        for (const root of roots) {
          root.traverse((o) => {
            if ((o as Partial<THREE.Mesh>).material) objects.push(o);
          });
        }
        this.compileOnly(renderer, objects, COMPILE_BATCH).catch((error: unknown) =>
          this.game.log.warn('Emergency shaders did not compile', error),
        );
      },
    });
    this.remotePlayers = new RemotePlayers(this.scene, game, this.contact);
    // Ultra's real people ready before they are shown (no stalled frame when one appears).
    this.body.prepare = this.prepareReal;
    this.npcActors.prepareReal = this.prepareReal;
    this.emergency.prepareReal = this.prepareReal;
    this.remotePlayers.prepareReal = this.prepareReal;
    this.progressBoard = new ProgressBoard(this.scene, game);
    this.periodicBoard = new PeriodicBoard(this.scene, game, (texture) =>
      this.device?.initTexture(texture),
    );
    this.fire = new FireView(this.scene, game);
    this.phone = new PhoneView(this.scene, game);
    this.laptop = new LaptopView(this.scene, game);
    this.circuits = new CircuitView(this.scene, game, this.palette, this.props, this.fire.smoke);
    this.mirrors = new Mirrors(this.hands.group);
    this.experiment = new ExperimentView(game);
    this.finishes = new Finishes(QUALITY[game.graphicsQuality]);
    this.containers = new ContainerViews({
      source: game.stations,
      pour: game.liquids,
      nameOf: (entity) => game.texts.of(entity.item, 'displayName'),
    });
  }

  init(): void {
    const renderer = this.makeWebgl(this.canvas);
    this.renderer = renderer;
    // Under Ultra, its chunk on its way now: by the first scene's load it is here, and the chain is
    // made and compiled for during the load, not in the lab's first frames.
    if (QUALITY[this.game.graphicsQuality].post) this.fetchPost();
    if (QUALITY[this.game.graphicsQuality].surfaces) this.syncSurfaces(true);
    // A software renderer (no GPU) draws room lights at half the frame rate of the one-light
    // model: it is the default there unless the player picked a preset (quality.ts).
    const gl = renderer.getContext();
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    this.game.softwareRenderer = SOFTWARE_RENDERER.test(name);
    this.game.gpuName = name;
    if (SOFTWARE_RENDERER.test(name)) {
      this.game.preferGraphicsQuality('low', `a software renderer (${name})`);
    } else if (INTEGRATED_GPU.test(name)) {
      // A laptop's processor graphics: Medium's shadows and room lights over 2× its pixels were
      // what made it slow (Phú's friend, 2026-11-10).
      this.game.preferGraphicsQuality('low', `graphics built into the processor (${name})`);
    }
    this.setUpDevice(renderer);

    this.scene.background = new THREE.Color('#151a20');
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.assemble();
    this.setLighting('basic');

    const resize = () => this.resize();
    window.addEventListener('resize', resize);
    this.subscriptions.add(() => window.removeEventListener('resize', resize));
    this.observeDevicePixels();
    this.resize();

    const s = this.subscriptions;
    this.followScenes(s);
    s.add(this.game.addAttachSettle((sceneId) => this.precompile(sceneId)));
    this.followEntities(s);
    this.hands.attach(s);
    this.body.attach(s);
    this.experiment.attach(s);
    void this.syncDevice(); // Ultra on WebGPU: started now, in the menu
  }

  /** The device drawing now: WebGL, or Ultra's WebGPU (null before init and after dispose). */
  private get device(): THREE.WebGLRenderer | GpuDevice['renderer'] | null {
    return this.gpu?.renderer ?? this.renderer;
  }

  private makeWebgl(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: this.game.config.graphics.antialias,
        stencil: true, // outlines draw outside their object's silhouette (outlines.ts)
      });
    } catch (error) {
      throw new Error('WebGL is not available in this browser', { cause: error });
    }
    // three checks each new program's link and compile status the first time it is used: a
    // synchronous query that waits for the GPU process to finish every program queued before it.
    // ANGLE/D3D11 compiles the lit materials in ~200 ms each, so a door's shaders, compiled in the
    // background, stalled the page that long (Phase G trace: GetShaderiv waiting on the command
    // buffer). The checks only report errors: off, as three recommends for production.
    renderer.debug.checkShaderErrors = false;
    renderer.localClippingEnabled = true; // a container's liquid is cut by its level plane
    return renderer;
  }

  /** What either device draws with. Shadows are cast only where a scene asks (setLighting). */
  private setUpDevice(device: THREE.WebGLRenderer | GpuDevice['renderer']): void {
    device.shadowMap.enabled = true;
    device.shadowMap.type = THREE.PCFShadowMap;
  }

  /**
   * Ultra on WebGPU (quality.ts `webgpu`). Until G2-1's parity is accepted, only where the
   * browser preference `simlab.dev.ultraRenderer` is `webgpu`; never after WebGPU refused to start.
   */
  private wantsGpu(): boolean {
    if (!QUALITY[this.game.graphicsQuality].webgpu || this.gpuFailed) return false;
    try {
      return window.localStorage.getItem('simlab.dev.ultraRenderer') === 'webgpu';
    } catch {
      return false; // storage blocked: the default
    }
  }

  /**
   * The device the preset draws with, changed in place: a fresh canvas where the old one was, the
   * scene, its views and the game untouched. One change at a time; a preset changed again while
   * one is on its way is followed when it ends. Never fails: WebGPU that does not start is warned
   * of and Ultra stays on WebGL.
   */
  private syncDevice(): Promise<void> {
    this.switching ??= (async () => {
      while (!this.disposed && this.device !== null && this.wantsGpu() !== (this.gpu !== null)) {
        if (this.gpu) this.toWebgl();
        else await this.toGpu();
      }
    })()
      .catch((error: unknown) => this.game.log.warn('The drawing device did not change', error))
      .finally(() => {
        this.switching = null;
      });
    return this.switching;
  }

  /** From WebGL to WebGPU (Ultra). */
  private async toGpu(): Promise<void> {
    let device: GpuDevice;
    let module: typeof GpuModule;
    try {
      module = this.gpuModule ??= await import('./gpu/GpuDevice');
      device = await module.GpuDevice.create(this.newCanvas());
    } catch (error) {
      this.gpuFailed = true;
      this.game.log.warn('WebGPU did not start: Ultra stays on WebGL', error);
      return;
    }
    if (this.disposed || !this.renderer || !this.wantsGpu()) {
      device.dispose();
      return;
    }
    this.dropDeviceState();
    this.renderer.dispose();
    this.renderer.forceContextLoss(); // the old canvas's context, at once (not when collected)
    this.renderer = null;
    this.gpu = device;
    this.outlines.useStencil(false);
    this.mirrors.useGlass(module.gpuMirror);
    this.useCanvas(device.renderer.domElement);
    this.setUpDevice(device.renderer);
    this.setLighting(this.enhanced ? 'enhanced' : 'basic'); // tone mapping, environment, finishes
    this.resize();
    this.compileHidden(); // what is there, for the new device, before it is drawn
    this.game.log.info('Ultra draws with WebGPU');
  }

  /** From WebGPU back to WebGL (a preset below Ultra). */
  private toWebgl(): void {
    const gpu = this.gpu;
    if (!gpu) return;
    const renderer = this.makeWebgl(this.newCanvas());
    this.dropDeviceState();
    gpu.dispose();
    this.gpu = null;
    this.renderer = renderer;
    this.outlines.useStencil(true);
    this.mirrors.useGlass(null);
    this.useCanvas(renderer.domElement);
    this.setUpDevice(renderer);
    this.setLighting(this.enhanced ? 'enhanced' : 'basic');
    this.resize();
  }

  /**
   * What the old device made and holds (targets, prefiltered maps, programs): freed with it. The
   * new one uploads textures and geometry again as it draws them.
   */
  private dropDeviceState(): void {
    this.post?.dispose();
    this.post = null;
    this.environment?.dispose();
    this.environment = null;
    this.pmrem?.dispose();
    this.pmrem = null;
    this.dropRoomReflections(false);
    this.warming?.done(); // a load waiting on it goes on
    this.warming = null;
    this.warmShadows.clear();
    this.shadowCache?.invalidate();
  }

  /** A canvas like the page's: the next device draws on it (useCanvas puts it in place). */
  private newCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.className = this.canvas.className;
    canvas.style.cssText = this.canvas.style.cssText;
    return canvas;
  }

  /** `canvas` in the old one's place in the page, its size followed from now. */
  private useCanvas(canvas: HTMLCanvasElement): void {
    const old = this.canvas;
    if (canvas === old) return;
    old.replaceWith(canvas);
    this.canvas = canvas;
    const observer = this.resizeObserver;
    if (observer) {
      observer.unobserve(old);
      observer.observe(canvas, { box: 'device-pixel-content-box' });
    }
  }

  /** What the scene always holds, without WebGL (quality.test.ts builds the same scene). */
  private assemble(): void {
    // The camera joins the scene so the first-person hands attached to it are drawn.
    this.camera.add(this.hands.group);
    this.scene.add(
      this.hemisphere,
      this.sun,
      this.sun.target,
      this.fill,
      this.fill.target,
      this.rooms,
      this.camera,
      this.experiment.group,
      this.body.group,
      this.mirrors.group,
      this.readers.group,
      this.contact.mesh,
      this.containers.group,
      this.outlines.warm,
      this.outlines.markers,
      this.floorPath.mesh,
    );
    // Lights are seen from the warm layer too: three keys a program by the lights, so a warm draw
    // without them would compile programs nothing else uses.
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Light)) return;
      object.layers.enable(WARM_LAYER);
      if (object instanceof THREE.SpotLight || object instanceof THREE.DirectionalLight) {
        this.shadowLights.push(object);
        object.shadow.camera.layers.enable(SHADOW_LAYER); // the body's shadow-only meshes
      }
    });
    const cache = new ShadowCache(this.shadowLights);
    cache.minInterval = 1 / QUALITY[this.game.graphicsQuality].shadowRateHz;
    this.shadowCache = cache;
    // After three's matrix update, before its shadow pass; once, on the frame's own draw (not a
    // mirror's, a room reflection's or the AO's, which draw no shadows).
    this.scene.onBeforeRender = () => {
      if (!this.shadowArmed) return;
      this.shadowArmed = false;
      cache.update(this.scene, performance.now() / 1000);
    };
  }

  update(dt: number): void {
    const { session } = this.game.state;
    if (session.paused || session.phase !== 'playing' || this.warming) this.qualityWatch.reset();
    else if (this.qualityWatch.frame(dt)) this.tooSlow();
    // Ultra's own frame rate, for the settings' experience line (kept through a pause).
    if (!highOrMore(this.game.graphicsQuality)) this.game.ultraFps = null;
    else if (this.qualityWatch.lastFps > 0) this.game.ultraFps = this.qualityWatch.lastFps;
    // (Not while warming: a world being prepared draws its warm-up batches every frame.)
    if ((session.paused || session.phase === 'menu') && !this.warming) {
      const now = performance.now();
      if (now - this.idleDrawnAt < 1000 / IDLE_HZ) return;
      this.idleDrawnAt = now;
    } else this.idleDrawnAt = -Infinity; // the first idle frame is drawn
    if (this.darknessDirty) this.applyDarkness(); // what is drawn, not how: before WebGL too
    this.detail.update(DETAIL_BUDGET_MS); // Ultra's detailed parts, a few at a time
    // The hub's sky by the time of day: repainted once a game minute (0.625 s), not every frame.
    const clockS = this.game.state.world.clockS;
    if (Math.abs(clockS - this.skyPaintedAt) >= DAY_S / 1440) {
      this.skyPaintedAt = clockS;
      paintSky(this.palette.finish('outside-sky'), clockS);
    }
    const device = this.device;
    if (!device) return;
    const p = this.game.state.player;
    const { physics } = this.game;
    // Positions physics steps are drawn blended between its last two steps (renderPlayer,
    // renderPose), so they move evenly at any frame rate; the view turns with the latest input.
    // Its own array: drawnPosition is reused for every dynamic body below, before the body stands.
    const feet = physics.renderPlayer(this.drawnFeet);
    // The eye, leaned in along the view as the player system eased it (gameplay/player/lean.ts).
    leanDirection(p.yaw, p.pitch, this.lean);
    this.camera.position.set(
      feet[0] + this.lean[0] * p.lean,
      feet[1] + p.eyeHeight + this.lean[1] * p.lean,
      feet[2] + this.lean[2] * p.lean,
    );
    // Sitting or lying (Phase F-1): the view from the seat or the pillow; getting up, eased back
    // to the eye (a start from sleep goes faster: it began part way).
    if (p.rest) this.camera.position.fromArray(p.rest.eye);
    else if (p.rising) {
      const t = p.rising.t * p.rising.t * (3 - 2 * p.rising.t);
      const [x, y, z] = p.rising.from;
      this.camera.position.set(
        x + (this.camera.position.x - x) * t,
        y + (this.camera.position.y - y) * t,
        z + (this.camera.position.z - z) * t,
      );
    }
    device.getDrawingBufferSize(this.bufferSize);
    this.mirrors.setScale(this.mirrorScale, this.bufferSize.x, this.bufferSize.y);
    this.mirrors.update(this.camera.position);
    this.camera.rotation.set(p.pitch + p.glance, p.yaw, 0);
    this.emergency.shake(this.camera); // a blast or a slap
    this.emergency.stunned(device.domElement);
    // The close-inspection view: the field of view the player system has eased to.
    const fov = inspectFov(this.game.config.graphics.fov, this.game.player.inspectAmount);
    if (fov !== this.camera.fov) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    this.sleep.update(dt, feet[0], feet[2]);
    this.followRoomReflections(dt, feet[0], feet[2]);
    this.captureStep();
    this.hands.update(dt);
    this.experiment.update(dt);
    this.reveals.update(dt, feet[0], feet[2]);
    this.slideLeaves();
    for (const view of this.hingedViews) this.turnLeaves(view);
    this.water.update(dt);
    for (const view of this.dynamicViews) {
      const { group, entity } = view;
      const blended = physics.renderPose(entity.id, this.drawnPosition, this.drawnRotation);
      group.position.fromArray(blended ? this.drawnPosition : entity.pose.position);
      group.quaternion.fromArray(blended ? this.drawnRotation : entity.pose.rotation);
      if (view.grounded) this.ground(view);
    }
    // The body after what it holds is posed: its hands close on the held object where it is drawn.
    const heldId = this.game.interaction.heldId;
    // The phone, when it is out, is what the hand holds (it is never a world object).
    this.phone.update(this.camera);
    const held = heldId === null ? this.phone.held : (this.views.get(heldId) ?? null);
    this.body.foamy = this.hands.foamy;
    this.body.update(dt, feet, this.camera, this.hands.roots, this.hands.posing, held);
    // Resting, the body stays standing where the player was: not drawn from the seat or the bed.
    this.body.group.visible = p.rest === null;
    this.npcActors.update(dt);
    this.emergency.update(dt, this.canvas.height || 720, this.camera.fov);
    this.remotePlayers.update(dt);
    this.boardWriting.update();
    this.progressBoard.update(dt);
    this.periodicBoard.update(dt);
    this.circuits.update(dt);
    this.laptop.update(dt);
    this.fire.update(dt, this.canvas.height || 720, this.camera.fov);
    this.frameExplain(dt);
    this.placeActed();
    this.containers.update(dt);
    this.outline(dt);
    // A run's lane (its tape) joins the experiment group after its view: its finish then. The
    // last child too: one lane removed and another added in a frame keep the count.
    const lanes = this.experiment.group.children;
    const last = lanes[lanes.length - 1] ?? null;
    if (lanes.length !== this.lanes || last !== this.lastLane) {
      this.lanes = lanes.length;
      this.lastLane = last;
      this.finishes.adopt(this.experiment.group);
      this.adoptUltra(this.experiment.group);
    }
    this.finishes.update(dt, this.camera.position);
    // The usual frame interval, learnt while nothing is being warmed (the warm-up's yardstick).
    if (!this.warming && dt > 0) this.frameDt += (dt - this.frameDt) * 0.05;
    if (this.renderer) this.warmStep(this.renderer, dt);
    // WebGPU: the shadow maps drawn while pipelines were being made left their objects out
    // (GpuDevice.inBackground); all made, they are drawn again (a cached map is drawn when asked).
    if (this.gpu && this.gpu.settled !== this.gpuSettled) {
      this.gpuSettled = this.gpu.settled;
      this.shadowCache?.invalidate();
    }
    this.syncCity(dt);
    const city = this.cityInView();
    if (city) city.update(this.camera, this.game.state.world.clockS, dt);
    const background = this.scene.background;
    if (city) this.scene.background = null; // a colour background would clear the city away
    this.shadowArmed = true;
    try {
      if (this.post) {
        this.post.setUnder(city?.scene ?? null, city?.camera ?? null);
        // Under Max, coloured as the room the player stands in, by the time of day (as WebGPU's).
        const [px, , pz] = this.game.state.player.position;
        const grade = this.game.world.roomAt(px, pz)?.grade ?? 'neutral';
        this.post.render(dt, grade, daylight(this.game.state.world.clockS));
      } else if (this.gpu?.post) {
        this.gpu.post.setUnder(city?.scene ?? null, city?.camera ?? null);
        // Coloured as the room the player stands in (G2-2), by the time of day where it sees out.
        const [px, , pz] = this.game.state.player.position;
        const grade = this.game.world.roomAt(px, pz)?.grade ?? 'neutral';
        this.gpu.post.render(dt, grade, daylight(this.game.state.world.clockS));
      } else if (city) {
        device.render(city.scene, city.camera);
        device.autoClear = false;
        device.clearDepth();
        device.render(this.scene, this.camera);
      } else device.render(this.scene, this.camera);
    } finally {
      this.shadowArmed = false;
      device.autoClear = true;
      this.scene.background = background;
    }
  }

  /**
   * The city follows the player: loaded when they stand in a glass-floored room, freed CITY_LINGER
   * seconds after they leave it (a step back through the doorway keeps it). No allocation: per frame.
   */
  private syncCity(dt: number): void {
    const roomId = this.game.state.player.roomId;
    const sceneId = roomId === null ? undefined : this.glassRooms.get(roomId);
    const glass = sceneId === undefined ? null : (this.sceneRooms.get(sceneId)?.glass ?? null);
    if (this.cityRetry > 0) this.cityRetry -= dt;
    if (glass && sceneId !== undefined) {
      this.cityAway = 0;
      if (this.cityRetry > 0) return;
      if (this.city?.sceneId !== sceneId || this.city.detail !== glass.detail) {
        this.loadCity(sceneId, glass.room, glass.detail);
      }
      return;
    }
    if (!this.city) return;
    this.cityAway += dt;
    if (this.cityAway > CITY_LINGER) this.dropCity();
  }

  /** The city, if loaded, the player in its glass floor's room and the glass in the camera's view. */
  private cityInView(): CityModule.CityView | null {
    const view = this.city?.view;
    const glass = this.city ? this.sceneRooms.get(this.city.sceneId)?.glass : null;
    if (!view || !glass || this.game.state.player.roomId !== glass.roomId) return null;
    this.camera.updateMatrixWorld();
    this.cityMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    return this.cityFrustum.setFromProjectionMatrix(this.cityMatrix).intersectsBox(glass.box)
      ? view
      : null;
  }

  /**
   * Compiles the shaders of a neighbour scene just attached off the frame
   * (KHR_parallel_shader_compile), keeping everything it brought — its rooms, decor and entities —
   * out of the camera's and the lights' layer until then. Drawn at once, they compiled inside one
   * frame: ~130 ms on an RTX 5070, the stall at the start of a door's opening. All of it, not only
   * new materials: a material already drawn may still need a new program for an object (instanced
   * or not), and nothing of the scenes already there is touched.
   */
  private async precompile(sceneId: string): Promise<void> {
    const renderer = this.renderer;
    const gpu = this.gpu;
    if (!renderer && !gpu) return;
    const roots: THREE.Object3D[] = [...this.decor.meshesOf(sceneId)];
    const rooms = this.sceneRooms.get(sceneId);
    if (rooms) roots.push(rooms.group);
    // Its entities where they are now (one carried away into a scene already there stays shown).
    const { world } = this.game;
    const own = new Set(world.roomsOf(sceneId).map((room) => room.id));
    for (const { group, entity } of this.views.values()) {
      const [x, , z] = entity.pose.position;
      if (own.has(world.roomAt(x, z)?.id ?? entity.roomId)) roots.push(group);
    }
    const pending: THREE.Object3D[] = [];
    const swapped: THREE.Object3D[] = [];
    for (const root of roots) {
      this.standIns(root, swapped);
      root.traverse((object) => {
        if (!(object as Partial<THREE.Mesh>).material) return;
        if (!object.layers.isEnabled(0) && !object.layers.isEnabled(PENDING_LAYER)) return;
        object.layers.set(PENDING_LAYER);
        pending.push(object);
      });
    }
    if (pending.length === 0) return;
    const start = performance.now();
    try {
      // Not in the attach's own task (its spawning is a long frame already): from the next frame.
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (this.renderer !== renderer || this.gpu !== gpu) return;
      // Only what is pending is compiled (and the materials it switches to), lit by the scene.
      if (gpu) await gpu.compile([...pending, ...swapped], this.camera, this.scene);
      else if (renderer) {
        await this.compileOnly(renderer, [...pending, ...swapped], COMPILE_BATCH);
        await this.warmDraw(this.firstDraws(renderer, pending));
      }
    } finally {
      // Shown, but for a room put to sleep meanwhile (roomSleep.ts): it stays asleep.
      for (const object of pending) {
        if (this.sleep.holds(object)) object.layers.set(ASLEEP_LAYER);
        else object.layers.set(0);
      }
    }
    const ms = Math.round(performance.now() - start);
    this.game.log.info(`Shaders of ${pending.length} new objects ready in ${ms} ms`);
  }

  /**
   * Compiles `objects` alone (not their children), lit by the scene, and keeps the programs.
   * shortcut: a stand-in root whose traverse walks them — three r186's compile() calls only
   * traverse and traverseVisible on it; recheck on a three.js upgrade.
   */
  /**
   * A real person (Ultra; body/realBody.ts) made ready before it is shown: its maps uploaded, one a
   * frame, then its programs compiled for the frame's target in batches, as a neighbour scene's.
   */
  private readonly prepareReal: PrepareReal = async (root, maps) => {
    if (this.gpu) {
      await this.gpu.compile(meshesIn([root]), this.camera, this.scene);
      return;
    }
    const renderer = this.renderer;
    if (!renderer) return;
    for (const texture of realTextures(maps)) {
      renderer.initTexture(texture);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (this.renderer !== renderer) return;
    }
    await this.compileOnly(renderer, meshesIn([root]), COMPILE_BATCH);
  };

  private async compileOnly(
    renderer: THREE.WebGLRenderer,
    objects: THREE.Object3D[],
    batchOf = objects.length,
  ) {
    // In batches while the game is played (a neighbour scene): every program at once kept the GPU
    // process compiling for ~200 ms (ANGLE/D3D11), no frame shown meanwhile (Phase G profile).
    for (let from = 0; from < objects.length; from += Math.max(1, batchOf)) {
      const some = objects.slice(from, from + Math.max(1, batchOf));
      const batch = new THREE.Object3D();
      batch.traverse = (visit) => {
        for (const object of some) visit(object);
      };
      batch.traverseVisible = () => undefined;
      // Under Ultra the frame draws into the composer's target, whose programs are not the
      // canvas's: compiled for it.
      const target = renderer.getRenderTarget();
      if (this.post) renderer.setRenderTarget(this.post.target);
      const before = renderer.info.programs?.length ?? 0;
      renderer.compile(batch, this.camera, this.scene); // issued: the GPU process compiles them
      renderer.setRenderTarget(target);
      // Asked too soon whether a program is ready, Chromium waits for it to be (its program info
      // needs the link): ~200 ms a program under ANGLE/D3D11, the page stalled meanwhile (Phase G
      // trace). So first left alone as long as the new programs take, then asked (compileAsync).
      const added = (renderer.info.programs?.length ?? 0) - before;
      if (added > 0) {
        await new Promise((done) => setTimeout(done, PROGRAM_MS * Math.ceil(added / COMPILERS)));
      }
      if (this.renderer !== renderer) return;
      if (this.post) renderer.setRenderTarget(this.post.target);
      const compiled = renderer.compileAsync(batch, this.camera, this.scene);
      renderer.setRenderTarget(target);
      await compiled;
      if (this.renderer !== renderer) return;
    }
    this.keepPrograms(renderer);
  }

  /**
   * A loaded scene's hidden parts and other materials, compiled during the load: a frame draws
   * only what is shown, so the pour stream, an empty vessel's liquid or a lamp's lit material
   * (swaps) linked at their first use instead, in a long frame (9.6–70 ms on an RTX 5070, labs
   * bench). What is shown compiles here too, in parallel, for the first frame.
   */
  private compileHidden(): void {
    const renderer = this.renderer;
    if (!renderer && !this.gpu) return;
    const objects: THREE.Object3D[] = [];
    this.scene.traverse((object) => {
      if ((object as Partial<THREE.Mesh>).material) objects.push(object);
    });
    this.standIns(this.scene, objects);
    if (!renderer) {
      this.gpuCompile(objects, 'Hidden parts did not compile');
      return;
    }
    this.compileOnly(renderer, objects).catch((error: unknown) =>
      this.game.log.warn('Hidden parts did not compile', error),
    );
  }

  /**
   * Every mesh under `roots` given its WebGPU pipelines in the background (GpuDevice.compile), a
   * failure warned of: they are then made at their first draw.
   */
  private gpuCompile(roots: readonly THREE.Object3D[], failure: string): void {
    this.gpu
      ?.compile(meshesIn(roots), this.camera, this.scene)
      .catch((error: unknown) => this.game.log.warn(failure, error));
  }

  /** Copies of `root`'s parts in the materials they switch to later (swaps), to compile. */
  private standIns(root: THREE.Object3D, out: THREE.Object3D[]): void {
    root.traverse((object) => {
      for (const material of swapsOf(object)) {
        const copy = (object as THREE.Mesh).clone(false); // an instanced part stays instanced
        copy.material = material;
        out.push(copy);
      }
    });
  }

  /**
   * Every new program used once and kept for the session (a few dozen in all). A program's first
   * use (its uniforms, its link status) still blocks on the GPU process for ~60 ms on ANGLE/D3D11:
   * done here, out of sight, not in a door's first frames. And three frees a program with its last
   * material, so a scene attached again linked and stalled again.
   */
  private keepPrograms(renderer: THREE.WebGLRenderer): void {
    for (const program of renderer.info.programs ?? []) {
      if (this.warmPrograms.has(program)) continue;
      this.warmPrograms.add(program);
      // A custom shader's key holds an id three forgets with its last material: a later copy gets
      // a new key and program, so a kept one would leak (one per visit). It lives as long as its
      // material instead (the water's last the session); its first use is still done here.
      const { type } = program as { type?: string }; // set by three, missing from its types
      if (type !== 'ShaderMaterial' && type !== 'RawShaderMaterial') program.usedTimes++;
      program.getUniforms();
      program.getAttributes();
    }
  }

  /**
   * The objects whose first draw does work of its own: one per geometry, program and textures
   * (the driver's vertex layout for a program, buffers, an upload); the rest draw like those.
   */
  private firstDraws(renderer: THREE.WebGLRenderer, objects: THREE.Object3D[]): THREE.Object3D[] {
    const seen = new Set<string>();
    return objects.filter((object) => {
      const { geometry, material } = object as THREE.Mesh;
      const one = Array.isArray(material) ? material[0] : material;
      const program = one
        ? (renderer.properties.get(one) as { currentProgram?: { id: number } }).currentProgram?.id
        : undefined;
      // Every texture it samples (a map, a finish's normal or roughness map…): each is uploaded
      // at its first draw, so two objects alike but for one of them are both drawn.
      let maps = '';
      if (one)
        for (const value of Object.values(one))
          if (value instanceof THREE.Texture) maps += value.uuid;
      const key = `${geometry.uuid}|${program}|${maps}|${object instanceof THREE.InstancedMesh}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Draws `objects` once, a batch a frame (warmStep): the driver's work at an object's first draw
   * (~65 ms of GPU-process time for a lab, in one frame) is spread out while the door is closed.
   */
  private warmDraw(objects: THREE.Object3D[]): Promise<void> {
    this.warming?.done(); // superseded (a second attach): its objects are shown unwarmed
    return new Promise((done) => {
      this.warming = {
        objects,
        culled: objects.map((o) => o.frustumCulled),
        next: 0,
        tail: 0,
        batch: WARM_START,
        elapsed: 0,
        done,
      };
    });
  }

  /**
   * The next batch of `warming`, drawn into one pixel of the canvas just before the frame clears
   * and draws it whole — the canvas's own programs (a render target would need others), its
   * frame's shadows drawn after as usual.
   */
  private warmStep(renderer: THREE.WebGLRenderer, dt: number): void {
    const w = this.warming;
    if (!w) return;
    // As many a frame as the frame time allows: fewer after a slow frame, more after fast ones.
    // A frame the warm-up made slow (well over the usual interval, whatever the display or cap):
    // fewer; one at the usual pace: more.
    w.elapsed += dt;
    w.batch = warmBatch(w.batch, dt, this.frameDt, w.elapsed);
    if (w.next >= w.objects.length) {
      // A few frames more before they are shown, for the GPU process to finish the batches.
      if (++w.tail < WARM_TAIL) return;
      this.warming = null;
      w.done();
      return;
    }
    const end = warmEnd(w.objects, w.next, w.batch, (object) => newTextureBytes(renderer, object));
    let shadows = false; // a shadow program or caster of a kind not drawn yet
    for (let i = w.next; i < end; i++) {
      const object = w.objects[i];
      if (!object) continue;
      object.layers.set(WARM_LAYER);
      object.frustumCulled = false;
      if (object.castShadow) {
        const kind = object instanceof THREE.InstancedMesh ? 'i' : 'm';
        if (!this.warmShadows.has(kind)) shadows = true;
        this.warmShadows.add(kind);
      }
    }
    this.camera.layers.set(WARM_LAYER);
    renderer.getSize(this.canvasSize);
    renderer.autoClear = false;
    // Its shadow programs too: the lights' shadow cameras see only the batch (the frame's own
    // shadows are drawn again just after, by the frame).
    for (const light of this.shadowLights) light.shadow.camera.layers.set(WARM_LAYER);
    renderer.shadowMap.autoUpdate = shadows; // else no shadow pass: its programs are there
    if (shadows) this.shadowCache?.invalidate(); // a cached map draws only when asked
    // Into the composer's target under Ultra: the programs a target draws with are not the canvas's.
    if (this.post) renderer.setRenderTarget(this.post.target);
    renderer.setScissorTest(true);
    renderer.setScissor(0, 0, 1, 1);
    renderer.setViewport(0, 0, 1, 1);
    try {
      renderer.render(this.scene, this.camera);
    } finally {
      // The renderer and the batch as they were, whatever the draw did (a throw ends the warm-up).
      renderer.setScissorTest(false);
      if (this.post) renderer.setRenderTarget(null);
      renderer.setViewport(0, 0, this.canvasSize.x, this.canvasSize.y);
      for (const light of this.shadowLights) {
        light.shadow.camera.layers.set(0);
        light.shadow.camera.layers.enable(SHADOW_LAYER);
      }
      renderer.shadowMap.autoUpdate = true;
      if (shadows) this.shadowCache?.invalidate(); // the batch's maps: the frame's again
      renderer.autoClear = true;
      this.camera.layers.set(0);
      for (let i = w.next; i < end; i++) {
        const object = w.objects[i];
        if (!object) continue;
        object.layers.set(PENDING_LAYER);
        object.frustumCulled = w.culled[i] ?? true;
      }
      w.next = end;
    }
  }

  /**
   * Each door leaf drawn slid along its own +x by its opening fraction (every frame): a walk-through
   * door's by its pair's, a sliding door's (Phase U) by its own.
   */
  private slideLeaves(): void {
    for (const { mesh, entity } of this.leafViews) {
      const { door, slider } = entity.item;
      mesh.position.x = door
        ? this.game.doors.fraction(entity.id) * door.travel
        : slider
          ? this.game.sliders.fraction(entity.id) * slider.travel
          : 0;
    }
  }

  dispose(): void {
    this.subscriptions.dispose();
    this.clearRooms();
    this.dropCity();
    this.dropRoomReflections(false);
    for (const id of [...this.views.keys()]) this.removeEntity(id);
    this.reveals.dispose();
    this.water.dispose();
    // The batches, then what they and the views shared: prop parts, then their materials.
    this.decor.dispose();
    this.props.dispose();
    this.palette.dispose();
    for (const geometry of this.geometries.values()) geometry.dispose();
    this.geometries.clear();
    for (const { geometry, material } of this.labels.values()) {
      geometry.dispose();
      material.map?.dispose();
      material.dispose();
    }
    this.labels.clear();
    for (const { body, trim } of this.controls.values()) {
      body.dispose();
      trim?.dispose();
    }
    this.controls.clear();
    this.trim.dispose();
    this.hands.dispose();
    this.experiment.dispose();
    this.environment?.dispose();
    this.environment = null;
    this.finishes.dispose();
    this.contact.dispose();
    this.containers.dispose();
    this.outlines.dispose();
    this.floorPath.dispose();
    this.roomLights.dispose();
    this.body.dispose();
    this.npcActors.dispose();
    this.emergency.dispose();
    this.remotePlayers.dispose();
    this.progressBoard.dispose();
    this.periodicBoard.dispose();
    this.circuits.dispose();
    this.fire.dispose();
    this.phone.dispose();
    this.laptop.dispose();
    this.boardWriting.dispose();
    this.mirrors.dispose();
    this.readers.dispose();
    this.warming?.done();
    this.warming = null;
    if (this.idleHandle !== null) {
      if (typeof cancelIdleCallback === 'function') cancelIdleCallback(this.idleHandle);
      else window.clearTimeout(this.idleHandle);
    }
    this.idleHandle = null;
    this.idle.length = 0;
    this.post?.dispose();
    this.post = null;
    this.pmrem?.dispose();
    this.pmrem = null;
    this.renderer?.dispose(); // its GPU resources; the canvas stays with the page
    this.renderer = null;
    this.gpu?.dispose();
    this.gpu = null;
    this.disposed = true;
  }

  /**
   * Room shells, decor and lighting follow the scenes: a load lights its scene and builds its
   * rooms and decor; a neighbour's come with it, in its own lighting, and go with it, the lights
   * refitted over what is resident; walking into a neighbour lights it (scenes joined by a door
   * share their lighting, checked at boot, so nothing changes there).
   */
  private followScenes(s: Disposables): void {
    const { events, world } = this.game;
    s.add(
      events.subscribe('SceneLoaded', ({ sceneId }) => {
        this.setLighting(this.lightingOf(sceneId));
        this.buildRooms(sceneId, world.activeRooms, this.enhanced);
        this.buildDecor(sceneId);
        this.prewarmNeighbours(sceneId, true); // during the load, before its first frame
        // Its people and those next door, hidden until seen: compiled here, built in no door's frame.
        const near = this.neighbours(sceneId).map((scene) => scene.id);
        this.npcActors.prepare(new Set([sceneId, ...near]));
        this.compileHidden();
      }),
    );
    s.add(
      events.subscribe('SceneUnloaded', ({ sceneId }) => {
        this.sleep.forgetAll();
        this.clearRooms();
        this.dresses.clear();
        this.decor.clear(sceneId);
        this.dropRoomReflections();
      }),
    );
    s.add(
      events.subscribe('SceneAttached', ({ sceneId }) => {
        const enhanced = this.lightingOf(sceneId) === 'enhanced';
        this.buildRooms(sceneId, world.roomsOf(sceneId), enhanced);
        this.buildDecor(sceneId);
        this.placeLights();
      }),
    );
    s.add(
      events.subscribe('SceneDetached', ({ sceneId }) => {
        this.sleep.forget(this.game.world.roomsOf(sceneId).map((room) => room.id));
        this.clearRooms(sceneId);
        this.decor.clear(sceneId);
        this.placeLights(); // no longer resident: left out
      }),
    );
    s.add(
      events.subscribe('SceneEntered', ({ sceneId }) => {
        this.setLighting(this.lightingOf(sceneId));
        this.prewarmNeighbours(sceneId);
      }),
    );
    s.add(
      events.subscribe('RoomSleepChanged', () => {
        const [x, , z] = this.game.state.player.position;
        this.sleep.judge(x, z);
      }),
    );
    // The preset may change the lighting model (room lights or one light), the pixel ratio and
    // the finishes of materials and textures (applyQuality).
    s.add(
      events.subscribe('GraphicsQualityChanged', () => {
        this.setLighting(this.enhanced ? 'enhanced' : 'basic');
        this.resize();
        void this.syncDevice(); // Ultra on WebGPU, or back
      }),
    );
  }

  /**
   * Entities follow the world: each spawn, despawn, state change and focus from now on, and the
   * entities already there (spawned before the renderer), their scenes' decor built.
   */
  private followEntities(s: Disposables): void {
    const { events, world, scenes } = this.game;
    s.add(
      events.subscribe('SceneAttaching', ({ sceneId }) => {
        for (const room of world.roomsOf(sceneId)) {
          this.attaching.add(room.id);
          // Built in idle time while its entities spawn, not all in SceneAttached's frame.
          this.idle.push(() => void this.dressOf(room));
        }
        this.runIdle();
      }),
    );
    // Its entities are in (precompile hides them, then shows them compiled); or it was given up.
    const attached = ({ sceneId }: { sceneId: string }) => {
      for (const room of world.roomsOf(sceneId)) this.attaching.delete(room.id);
    };
    s.add(events.subscribe('SceneAttached', attached));
    s.add(events.subscribe('SceneDetached', attached));
    s.add(events.subscribe('EntitySpawned', ({ entity }) => this.addEntity(entity)));
    s.add(
      events.subscribe('EntityDespawned', ({ entityId }) => {
        this.mirrors.remove(entityId);
        this.readers.remove(entityId);
        this.decor.remove(entityId); // decor, or a viewed entity's batched part (a trim)
        this.removeEntity(entityId);
      }),
    );
    s.add(events.subscribe('EntityStateChanged', ({ entityId }) => this.refresh(entityId)));
    // Low's sun and fill follow the room the player stands in (applyAmbient).
    s.add(events.subscribe('PlayerEnteredRoom', () => this.applyAmbient()));
    s.add(
      events.subscribe('InteractionFocusChanged', ({ entityId }) => {
        const previous = this.focusedId;
        this.focusedId = entityId;
        if (previous !== null) this.refresh(previous);
        if (entityId !== null) this.refresh(entityId);
      }),
    );
    for (const entity of world.allEntities()) this.addEntity(entity);
    for (const sceneId of scenes.residentIds) this.buildDecor(sceneId);
  }

  /** A scene's decor batches (each in the preset's finishes as it is drawn). */
  private buildDecor(sceneId: string): void {
    this.decor.build(sceneId);
    this.darknessDirty = true;
  }

  private lightingOf(sceneId: string): Lighting {
    const scene = this.game.content.scenes.tryGet(sceneId);
    return scene?.kind === 'world' ? scene.lighting : 'basic';
  }

  /**
   * The canvas sized to the page, at the preset's pixel ratio (quality.ts `maxPixelRatio`). Where
   * the browser reports the canvas's device pixels, the drawing buffer is exactly that many (times
   * the preset's ratio over the screen's) and the canvas fills its host by CSS: three alone sizes
   * the buffer floor(clientWidth × ratio), half a device pixel short of the box at 150 % on an
   * odd width, and the browser then resamples the whole frame (render-quality audit F8).
   */
  private resize(): void {
    const renderer = this.device;
    if (!renderer) return; // nothing drawn before init
    const width = this.host.clientWidth || window.innerWidth;
    const height = this.host.clientHeight || window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    const ratio = Math.min(
      dpr,
      this.game.config.graphics.maxPixelRatio,
      QUALITY[this.game.graphicsQuality].maxPixelRatio,
    );
    const box = this.deviceBox;
    this.camera.aspect = box ? box.width / box.height : width / height;
    this.camera.updateProjectionMatrix();
    if (box) {
      // The buffer in device pixels, at one pixel per unit; the CSS size stays the host's.
      if (renderer.getPixelRatio() !== 1) renderer.setPixelRatio(1);
      const scale = ratio / dpr;
      renderer.setSize(
        Math.max(1, Math.round(box.width * scale)),
        Math.max(1, Math.round(box.height * scale)),
        false,
      );
      this.sizePost();
      return;
    }
    // Only a change: setPixelRatio resizes the drawing buffer.
    if (renderer.getPixelRatio() !== ratio) renderer.setPixelRatio(ratio);
    if (this.observed)
      renderer.setSize(width, height, false); // until the first device box
    else renderer.setSize(width, height);
    this.sizePost();
  }

  /** Ultra's surfaces and model detail on what is attached; under any other preset, its own parts. */
  private adoptUltra(root: THREE.Object3D): void {
    this.surfaces.adopt(root);
    if (QUALITY[this.game.graphicsQuality].modelDetail) this.detail.adoptLater(root);
    else this.detail.restore(root); // a part kept aside while Ultra was on
  }

  /**
   * Ultra's surfaces on or off with the preset: fetched once (all sets in parallel, a few seconds
   * the first time), laid on everything drawn and compiled for, then on what comes later as it is
   * adopted; taken off and freed when the player leaves Ultra.
   */
  private syncSurfaces(on: boolean): void {
    if (!on) {
      if (this.surfaces.ready) this.surfaces.drop();
      this.finishes.setWear(null);
      return;
    }
    // Max's wear on them (loaded the first time); the surfaces compile again when it changes.
    void this.surfaces
      .setWear(QUALITY[this.game.graphicsQuality].wear, (message, error) =>
        this.game.log.warn(message, error),
      )
      .then(() => {
        if (this.disposed) return;
        const wear = QUALITY[this.game.graphicsQuality].wear ? this.surfaces.wear : null;
        if (wear) this.device?.initTexture(wear);
        this.finishes.setWear(wear); // fingerprints on the glassware's sheen too
      });
    if (this.surfaces.ready) {
      // WebGPU: a material's pipelines are made per look, so the new ones ahead (WebGL's programs
      // were compiled with the first adopt). Not made, a room's first capture built them (1.1 s).
      if (this.surfaces.adopt(this.scene) > 0 && this.gpu) this.compileHidden();
      return;
    }
    this.surfaces
      .load((message, error) => this.game.log.warn(message, error))
      .then(() => {
        // (Laid on whichever device draws by then: Ultra's WebGPU starts while they load.)
        if (this.disposed || !QUALITY[this.game.graphicsQuality].surfaces) return;
        this.surfaces.adopt(this.scene);
        this.compileHidden(); // the surfaces' programs, before they are first drawn
      })
      .catch((error: unknown) => this.game.log.warn('Ultra surfaces did not load', error));
  }

  /**
   * Under Ultra, its chunk and its surfaces here before a world scene is built (awaited with the
   * load, RendererHost): what the scene shows is then compiled during the load, not in its first
   * frames. Never fails the load (a part that does not come is warned of and drawn without), and
   * waits ULTRA_WAIT_MS at most.
   */
  ultraReady(): Promise<void> {
    const q = QUALITY[this.game.graphicsQuality];
    const steps: Promise<unknown>[] = [];
    if (q.webgpu) steps.push(this.syncDevice()); // its device, before the scene is built
    if (q.post) {
      this.fetchPost();
      if (this.postFetch) steps.push(this.postFetch);
    }
    if (q.surfaces) {
      steps.push(
        this.surfaces
          .load((message, error) => this.game.log.warn(message, error))
          .then(() => {
            // Uploaded now, behind the loading screen: ~40 maps of 1–2 K, a long first frame else.
            for (const texture of this.surfaces.textures()) this.device?.initTexture(texture);
          })
          .catch(() => undefined),
      );
    }
    if (steps.length === 0) return Promise.resolve();
    return Promise.race([
      Promise.all(steps).then(() => undefined),
      new Promise<void>((done) => window.setTimeout(done, ULTRA_WAIT_MS)),
    ]);
  }

  /** The composer at the drawing buffer's size (device pixels). */
  private sizePost(): void {
    if (!this.post || !this.renderer) return;
    this.renderer.getDrawingBufferSize(this.postSize);
    this.post.setSize(this.postSize.x, this.postSize.y);
  }

  /**
   * Ultra's post-processing on or off with the preset: its chunk imported the first time Ultra is
   * chosen (never by another preset), the chain freed when the player leaves it. Basic scenes
   * (one light) are drawn without it.
   */
  private syncPost(on: boolean): void {
    if (this.gpu) {
      const had = this.gpu.post !== null;
      this.gpu.usePost(on, this.scene, this.camera);
      if (!had && this.gpu.post) this.compileHidden(); // its target's pipelines differ
      return;
    }
    const renderer = this.renderer;
    if (!on || !renderer) {
      this.post?.dispose();
      this.post = null;
      return;
    }
    // Max's chain differs from Ultra's (its grade, its AO samples): made again on a change.
    const q = QUALITY[this.game.graphicsQuality];
    const options: PostOptions = {
      grade: q.grade,
      aoSamples: q.aoSamples,
      seeThrough: q.effects ? this.seeThrough : null,
    };
    const same = (a: PostOptions | null) =>
      a !== null &&
      a.grade === options.grade &&
      a.aoSamples === options.aoSamples &&
      a.seeThrough === options.seeThrough;
    if (this.post && same(this.postOptions)) return;
    this.post?.dispose();
    this.post = null;
    if (this.postModule) {
      // Here already (fetched at start): made at once, so a load compiles for it (compileOnly).
      renderer.getDrawingBufferSize(this.postSize);
      this.post = this.postModule.createPost(
        renderer,
        this.scene,
        this.camera,
        this.postSize.x,
        this.postSize.y,
        options,
      );
      this.postOptions = options;
      return;
    }
    this.fetchPost(() => {
      if (this.renderer !== renderer || !QUALITY[this.game.graphicsQuality].post) return;
      this.syncPost(true);
      this.compileHidden(); // the target's programs, before they are first drawn
    });
  }

  /** Imports the post-processing chunk once; `then` runs when it is here. */
  private fetchPost(then?: () => void): void {
    if (this.postModule) {
      then?.();
      return;
    }
    // One import; every caller waits on it (a load asking while the start's fetch is on its way
    // was dropped, and Ultra drew without its post-processing).
    this.postFetch ??= import('./post').then(
      (module) => {
        this.postModule = module;
      },
      (error: unknown) => {
        this.postFetch = null;
        this.game.log.warn('Ultra post-processing did not load; drawing without it', error);
      },
    );
    if (then) void this.postFetch.then(() => (this.postModule ? then() : undefined));
  }

  /**
   * Follows the canvas's size in device pixels where the browser reports it (Chromium, Firefox;
   * not Safari, which keeps three's sizing): the canvas then fills its host by CSS.
   */
  private observeDevicePixels(): void {
    if (typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      // Missing where the browser lacks it (typed as always there).
      if (!entry || !('devicePixelContentBoxSize' in entry)) return;
      const box = entry.devicePixelContentBoxSize[0];
      if (!box || box.inlineSize === 0 || box.blockSize === 0) return;
      this.deviceBox = { width: box.inlineSize, height: box.blockSize };
      this.resize();
    });
    try {
      observer.observe(this.canvas, { box: 'device-pixel-content-box' });
    } catch {
      observer.disconnect(); // that box is not supported here
      return;
    }
    this.observed = true;
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.resizeObserver = observer;
    this.subscriptions.add(() => observer.disconnect());
  }

  /**
   * basic: the look every scene had (hemisphere + sun, no shadows). enhanced, by the preset:
   * - room lights (Medium, High; phase UX2): each room lit by its own fixtures (world/lighting.ts)
   *   — a key spot with shadows under one fixture, fills under others — over a soft hemisphere,
   *   and no sun: a closed room is not lit from outside;
   * - one light (Low, and by default on a software renderer): the sun and a fill fitted over every
   *   resident scene, as before UX2, without shadows at Low.
   * Both with filmic tone mapping. Walls and ceilings cast only under room lights (they keep each
   * key in its room); under the sun they would put every room in their shade.
   */
  private setLighting(mode: 'basic' | 'enhanced'): void {
    this.enhanced = mode === 'enhanced';
    this.roomLit = this.enhanced && QUALITY[this.game.graphicsQuality].roomLights;
    this.hemisphere.color.set(this.enhanced ? '#f2f6ff' : '#ffffff');
    this.hemisphere.groundColor.set(this.enhanced ? '#a9a8a4' : '#56606b');
    // Hidden lights are left out of the shaders; only a change of preset or model changes them.
    this.sun.visible = !this.roomLit;
    this.fill.visible = this.enhanced && !this.roomLit;
    this.roomLights.visible = this.roomLit;
    this.applyQuality();
    const device = this.device;
    if (device) {
      // Filmic tone mapping keeps lit walls from clipping to white (enhanced scenes only).
      device.toneMapping = this.enhanced ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
      device.toneMappingExposure = 1.05;
    }
    for (const { group } of this.sceneRooms.values()) this.shadeShells(group);
    this.placeLights();
  }

  /** Which shell surfaces cast and receive, for the lighting model now in use. */
  private shadeShells(group: THREE.Group): void {
    for (const child of group.children) {
      const part = child.userData.part as 'floor' | 'ceiling' | 'wall' | 'skirting' | undefined;
      if (!(child instanceof THREE.Mesh) || !part) continue;
      child.castShadow = this.roomLit && (part === 'wall' || part === 'ceiling');
      child.receiveShadow = this.roomLit ? part !== 'ceiling' : this.enhanced && part === 'floor';
    }
  }

  /** The lights that follow the resident scenes: the room lights, or the fitted sun. */
  private placeLights(): void {
    this.placeRoomLights();
    this.fitSun();
  }

  /**
   * One-light model: the sun, its shadow box and the fill fitted to the rooms of every resident
   * scene — so what is seen through an open door is lit and shadowed with the rest (phase UX1).
   */
  private fitSun(): void {
    this.sun.position.set(3, 6, 2);
    this.sun.target.position.set(0, 0, 0);
    if (!this.enhanced || this.roomLit) return;
    const { world, scenes } = this.game;
    let min = [Infinity, Infinity];
    let max = [-Infinity, -Infinity];
    const add = (rooms: readonly RoomDefinition[]) => {
      for (const room of rooms) {
        min = [
          Math.min(min[0] ?? 0, room.bounds.min[0]),
          Math.min(min[1] ?? 0, room.bounds.min[2]),
        ];
        max = [
          Math.max(max[0] ?? 0, room.bounds.max[0]),
          Math.max(max[1] ?? 0, room.bounds.max[2]),
        ];
      }
    };
    add(world.activeRooms);
    for (const id of scenes.residentIds) {
      if (id !== scenes.currentSceneId) add(world.roomsOf(id));
    }
    const cx = ((min[0] ?? 0) + (max[0] ?? 0)) / 2;
    const cz = ((min[1] ?? 0) + (max[1] ?? 0)) / 2;
    const half = Math.max((max[0] ?? 0) - (min[0] ?? 0), (max[1] ?? 0) - (min[1] ?? 0)) / 2 + 2;
    this.sun.position.set(cx + 9, 22, cz + 6);
    this.sun.target.position.set(cx, 0, cz);
    this.fill.position.set(cx - 10, 6, cz - 8);
    this.fill.target.position.set(cx, 1, cz);
    const camera = this.sun.shadow.camera;
    camera.left = -half;
    camera.right = half;
    camera.top = half;
    camera.bottom = -half;
    camera.near = 1;
    camera.far = 60;
    camera.updateProjectionMatrix();
  }

  /**
   * The room lights of every resident scene, the current one's first (they keep their slots if a
   * third scene is left open), in the pool. Called whenever a scene comes, goes or is walked into.
   */
  private placeRoomLights(): void {
    const { world, scenes, content } = this.game;
    const itemOf = (id: string) => content.items.tryGet(id);
    const rooms = [...world.activeRooms];
    for (const id of scenes.residentIds) {
      if (id !== scenes.currentSceneId) rooms.push(...world.roomsOf(id));
    }
    const lit = rooms.filter(
      (room) => !this.darkRooms.has(room.id) && !this.sleep.isAsleep(room.id),
    );
    this.roomLights.assign(this.roomLit ? lit.flatMap((room) => roomLights(room, itemOf)) : []);
    this.applyAmbient(); // the player may have walked into, or out of, a dark room
    this.darknessDirty = true; // and their body with them
    if (this.roomLights.dropped > 0) {
      this.game.log.warn(
        `${this.roomLights.dropped} room lights left out: more scenes open than lit`,
      );
    }
  }

  /**
   * The graphics quality preset (render/quality.ts), in enhanced scenes: the sun's shadows and the
   * room light, the key lights' shadow map size, contact shadows, and the finishes of materials
   * and textures (finishes.ts: the whole scene walked again, only when they change). Applied on
   * every scene load and at once when the setting changes; three recompiles what changed.
   */
  private applyQuality(): void {
    const q = QUALITY[this.game.graphicsQuality];
    this.sun.castShadow = this.enhanced && !this.roomLit && q.shadows;
    this.roomLights.shadows = this.roomLit && q.shadows;
    this.roomLights.mapSize = q.shadowMapSize;
    this.roomLights.softness = q.shadowRadius;
    if (this.shadowCache) this.shadowCache.minInterval = 1 / q.shadowRateHz;
    this.syncPost(this.enhanced && q.post);
    this.syncSurfaces(q.surfaces); // by the preset alone: a scene change passes through basic lighting
    this.containers.setDetail(q.liquids); // Ultra: the meniscus and the ripples
    if (!q.modelDetail) this.detail.drop(this.scene);
    this.syncFittings(q.modelDetail);
    for (const [sceneId, { rooms, enhanced, glass }] of [...this.sceneRooms]) {
      const wanted = q.city === 'none' ? null : q.city;
      if (rooms.some((r) => r.glassFloor) && (glass?.detail ?? null) !== wanted) {
        this.buildRooms(sceneId, rooms, enhanced);
      }
    }
    this.contact.visible = this.enhanced && q.contactShadows;
    // Ultra: the room the player stands in, captured upright; otherwise the generated room, tilted.
    const captured =
      q.roomReflections && this.reflectedRoom !== null
        ? (this.roomEnvironments.get(this.reflectedRoom) ?? null)
        : null;
    const tilt = captured ? 0 : ROOM_LIGHT_TILT;
    if (!q.roomReflections && this.roomEnvironments.size > 0) this.dropRoomReflections(false);
    const reflected = this.enhanced && q.reflections > 0 ? this.reflectionOf(captured) : null;
    if (this.finishes.set(q, reflected, tilt)) {
      this.finishes.adopt(this.scene);
      this.adoptUltra(this.scene);
      for (const [mesh, original] of this.twinned) mesh.material = original;
      this.twinned.clear();
      for (const twin of this.darkTwins.values()) twin.dispose();
      this.darkTwins.clear(); // copies of the old finishes
      this.darknessDirty = true;
    }
    this.body.castShadow = this.enhanced && q.shadows;
    this.mirrorScale = this.enhanced ? q.mirrorScale : 0;
    const environment = this.enhanced ? q.environment : 0;
    this.scene.environment = environment > 0 ? this.reflectionOf(captured) : null;
    this.scene.environmentIntensity = environment;
    this.scene.environmentRotation.x = tilt;
    this.applyAmbient();
  }

  /**
   * The ambient lights. Low's sun and fill (direct lights, of no room) at SWITCHED_OFF_AMBIENT of
   * themselves where the room the player stands in is dark (between rooms: where all the scene's
   * are); the indirect light is darkened per room (applyDarkness), so a lit room seen through a
   * door keeps its own, and a dark one its dark.
   */
  private applyAmbient(): void {
    const [px, , pz] = this.game.state.player.position;
    const here = this.game.world.roomAt(px, pz);
    const rooms = this.game.world.activeRooms;
    let dark = rooms.length > 0;
    for (const room of rooms) dark &&= this.darkRooms.has(room.id);
    if (here) dark = this.darkRooms.has(here.id);
    const share = dark ? SWITCHED_OFF_AMBIENT : 1;
    const environment = this.enhanced ? QUALITY[this.game.graphicsQuality].environment : 0;
    this.sun.intensity = (this.enhanced ? 2.2 : 1.4) * share;
    this.fill.intensity = 0.7 * share;
    this.hemisphere.intensity =
      (this.roomLit ? INDOOR_AMBIENT : this.enhanced ? 1.25 : 1.6) -
      HEMISPHERE_GIVES_WAY * environment;
    this.scene.environmentIntensity = environment;
  }

  /**
   * Each mesh of a dark room takes its indirect light (ambient, environment, reflections; not the
   * lamps) at SWITCHED_OFF_AMBIENT through an ambient-occlusion map: in place where its material is
   * drawn only in dark rooms, on a dark twin where a lit room draws it too. On events only
   * (darknessDirty), never per frame.
   */
  private applyDarkness(): void {
    this.darknessDirty = false;
    if (this.darkRooms.size === 0 && this.darkened.size === 0 && this.twinned.size === 0) return;
    for (const [mesh, original] of this.twinned) mesh.material = original;
    this.twinned.clear();
    const uses = new Map<RoomLitMaterial, { dark: THREE.Mesh[]; lit: boolean }>();
    const visit = (root: THREE.Object3D, roomId: string | undefined) =>
      root.traverse((object) => {
        if (!(object as Partial<THREE.Mesh>).isMesh) return;
        const mesh = object as THREE.Mesh;
        if (!roomLit(mesh.material)) return;
        const room = (mesh.userData.roomId as string | undefined) ?? roomId;
        const use = uses.get(mesh.material) ?? { dark: [], lit: false };
        if (room !== undefined && this.darkRooms.has(room)) use.dark.push(mesh);
        else use.lit = true;
        uses.set(mesh.material, use);
      });
    for (const { group } of this.sceneRooms.values()) visit(group, undefined);
    for (const { group, entity } of this.views.values()) visit(group, entity.roomId);
    // The player's body and first-person hands: in the room the player stands in.
    const [px, , pz] = this.game.state.player.position;
    const here = this.game.world.roomAt(px, pz)?.id;
    visit(this.body.group, here);
    visit(this.hands.group, here);
    // Decor is batched per room.
    for (const sceneId of this.game.scenes.residentIds) {
      for (const mesh of this.decor.meshesOf(sceneId)) visit(mesh, this.decor.roomOf(mesh));
    }
    for (const m of this.darkened) {
      const use = uses.get(m);
      if (use && use.dark.length > 0 && !use.lit) continue;
      this.shade(m, false);
      this.darkened.delete(m);
    }
    for (const [m, use] of uses) {
      if (use.dark.length === 0) continue;
      if (!use.lit) {
        if (!this.darkened.has(m)) this.shade(m, true);
        this.darkened.add(m);
        continue;
      }
      let twin = this.darkTwins.get(m);
      if (!twin) {
        twin = m.clone();
        this.shade(twin, true);
        this.darkTwins.set(m, twin);
      }
      for (const mesh of use.dark) {
        this.twinned.set(mesh, m);
        mesh.material = twin;
      }
    }
    this.surfaces.adopt(this.scene); // the dark twins, copies without the surface's patch
  }

  private shade(m: RoomLitMaterial, dark: boolean): void {
    m.aoMap = dark ? this.unlit : null;
    m.aoMapIntensity = dark ? 1 - SWITCHED_OFF_AMBIENT : 1;
    m.needsUpdate = true;
  }

  /**
   * A light switch's room went dark or lit again: its spots leave or rejoin the pool, its ceiling's
   * glow and its fixtures follow, and the ambient where the player stands.
   */
  private switched(roomId: string, off: boolean): void {
    if (off === this.darkRooms.has(roomId)) return;
    if (off) this.darkRooms.add(roomId);
    else this.darkRooms.delete(roomId);
    const ceiling = this.ceilings.get(roomId);
    if (ceiling) ceiling.emissiveIntensity = off ? 0 : CEILING_GLOW;
    this.placeRoomLights();
    for (const view of this.views.values()) {
      const { entity } = view;
      if (entity.roomId === roomId && entity.item.visual.material === 'light')
        this.refresh(entity.id);
    }
    this.darknessDirty = true;
  }

  /** The room light, prefiltered (PMREM) once; never per frame. Null before WebGL exists. */
  /**
   * Ultra: four times a second, the room under the player; on entering one, its captured
   * reflections (captured the first time, once nothing is being warmed) become the scene's. A room
   * within CAPTURE_AHEAD_M is captured ahead (Phú, 2026-11-14: a lab's first visit came in with the
   * hall's reflections and changed a moment later): walked into, its own show at once.
   */
  private followRoomReflections(dt: number, x: number, z: number): void {
    this.reflectionClock += dt;
    if (this.reflectionClock < 0.25) return;
    this.reflectionClock = 0;
    if (!this.enhanced || !QUALITY[this.game.graphicsQuality].roomReflections) return;
    const room = this.game.world.roomAt(x, z)?.id ?? null;
    if (room === null || this.warming) return;
    if (room === this.reflectedRoom) {
      if (!this.capture) this.captureAhead(x, z);
      return;
    }
    if (!this.roomEnvironments.has(room)) {
      if (this.capture?.roomId !== room) this.startCapture(room);
      return; // taken over the next frames (captureStep), then applied
    }
    this.reflectedRoom = room;
    this.applyQuality();
  }

  /**
   * The first room of a neighbour scene (through a door: the lab beyond the hall's) near the player
   * whose reflections are not taken. Not the current scene's other rooms: they are captured on
   * entering as before (ahead, Ultra under software WebGL fell to 1 frame a second, settings.spec).
   */
  private captureAhead(x: number, z: number): void {
    const { scenes, world } = this.game;
    for (const id of scenes.residentIds) {
      if (id === scenes.currentSceneId) continue;
      for (const room of world.roomsOf(id)) {
        if (this.roomEnvironments.has(room.id)) continue;
        const { min, max } = room.bounds;
        const dx = Math.max(min[0] - x, 0, x - max[0]);
        const dz = Math.max(min[2] - z, 0, z - max[2]);
        if (Math.hypot(dx, dz) > CAPTURE_AHEAD_M) continue;
        this.startCapture(room.id);
        return;
      }
    }
  }

  /** A resident room by id: the current scene's or a neighbour's. */
  private residentRoom(roomId: string) {
    const { scenes, world } = this.game;
    for (const id of scenes.residentIds) {
      const room = world.roomsOf(id).find((r) => r.id === roomId);
      if (room) return room;
    }
    return world.activeRooms.find((r) => r.id === roomId);
  }

  /**
   * A room's reflections: six views from its middle at eye height into a small cube (the hands and
   * body hidden), prefiltered for rough and smooth surfaces alike. Once per room per visit. Taken a
   * face a frame, with the frame's shadows as they are: all six at once, each drawing every light's
   * shadows again, stalled the frame a door opened on (~200 ms on the RTX 5070, Phase G profile).
   */
  private startCapture(roomId: string): void {
    this.dropCapture();
    const room = this.residentRoom(roomId);
    const device = this.device;
    if (!device || !room) return;
    const { min, max } = room.bounds;
    const target = this.gpu
      ? this.gpu.cubeTarget() // the device's own, kept
      : new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
    const cube = new THREE.CubeCamera(0.1, 60, target);
    cube.position.set(
      (min[0] + max[0]) / 2,
      Math.min(min[1] + 1.6, max[1] - 0.2),
      (min[2] + max[2]) / 2,
    );
    cube.coordinateSystem = device.coordinateSystem;
    cube.updateCoordinateSystem();
    cube.updateMatrixWorld(true);
    this.capture = { roomId, target, cube, face: 0 };
  }

  /** One face of the capture under way; after the sixth, its reflections prefiltered and applied. */
  private captureStep(): void {
    const job = this.capture;
    const { renderer, gpu } = this;
    if (!job || (!renderer && !gpu)) return;
    const here = this.game.world.roomAt(this.camera.position.x, this.camera.position.z)?.id;
    if (!this.game.world.hasRoom(job.roomId)) {
      this.dropCapture();
      return;
    } // its scene gone before it was done
    // WebGPU: what a pipeline is being made for is not drawn yet (GpuDevice.inBackground), and what
    // is being compiled ahead would be built again by the face (0.5 s at the first room): no face
    // is taken meanwhile, and a face that asked for new ones is taken again once they are made.
    if (gpu?.compiling) return;
    const shown = { hands: this.hands.group.visible, body: this.body.group.visible };
    this.hands.group.visible = false;
    this.body.group.visible = false;
    // A room reflecting its own old reflection would brighten: none, by its strength — not by
    // taking the map away, which changes every lit material's program (all compiled again, in
    // one frame: 2.4–3.3 s in the pendulum bay at Ultra, G-2).
    const strength = this.scene.environmentIntensity;
    this.scene.environmentIntensity = 0;
    // WebGL: the frame's own shadows serve. (WebGPU's are drawn once a frame whatever draws.)
    const autoShadows = renderer?.shadowMap.autoUpdate ?? true;
    if (renderer) renderer.shadowMap.autoUpdate = false;
    const before = renderer?.getRenderTarget() ?? null;
    try {
      const camera = job.cube.children[job.face] as THREE.Camera;
      if (gpu) gpu.drawFace(this.scene, camera, job.target, job.face);
      else if (renderer) {
        renderer.setRenderTarget(job.target as THREE.WebGLCubeRenderTarget, job.face);
        renderer.render(this.scene, camera);
      }
      if (!gpu?.compiling) job.face++;
    } finally {
      if (renderer) {
        renderer.setRenderTarget(before);
        renderer.shadowMap.autoUpdate = autoShadows;
      }
      this.scene.environmentIntensity = strength;
      this.hands.group.visible = shown.hands;
      this.body.group.visible = shown.body;
    }
    if (job.face < 6) return;
    try {
      const cube = job.target.texture;
      const prefiltered = gpu
        ? gpu.prefilter(cube)
        : renderer && this.pmremOf(renderer).fromCubemap(cube).texture;
      if (prefiltered) this.roomEnvironments.set(job.roomId, prefiltered);
    } finally {
      this.dropCapture();
    }
    if (here !== job.roomId) return; // taken ahead: applied when walked into
    this.reflectedRoom = job.roomId;
    this.applyQuality();
  }

  private dropCapture(): void {
    // (WebGPU's cube is the device's, kept: GpuDevice.cubeTarget.)
    if (this.capture?.target instanceof THREE.WebGLCubeRenderTarget) this.capture.target.dispose();
    this.capture = null;
  }

  /** Frees the captured rooms (a scene unloaded, or Ultra left); the generated room comes back. */
  private dropRoomReflections(apply = true): void {
    this.dropCapture();
    for (const texture of this.roomEnvironments.values()) texture.dispose();
    this.roomEnvironments.clear();
    this.reflectedRoom = null;
    if (apply) this.applyQuality();
  }

  /**
   * What reflects: the room captured, or else the generated one. Under WebGPU, in the device's
   * one map (GpuDevice.reflection): a texture changed builds every lit material again.
   */
  private reflectionOf(captured: THREE.Texture | null): THREE.Texture | null {
    return this.gpu ? this.gpu.reflection(captured) : (captured ?? this.environmentMap());
  }

  private environmentMap(): THREE.Texture | null {
    if (!this.renderer) return null;
    if (!this.environment) {
      const pmrem = this.pmremOf(this.renderer);
      const room = new RoomEnvironment();
      this.environment = pmrem.fromScene(room, 0.04).texture;
      room.dispose();
    }
    return this.environment;
  }

  /**
   * The one prefilter (three keeps its programs with it), its cubemap program compiled with it:
   * one made and freed per room capture compiled and linked again each time, in the frame a room
   * was walked into (~130 ms on the RTX 5070 at Ultra, 2026-11-14).
   */
  private pmremOf(renderer: THREE.WebGLRenderer): THREE.PMREMGenerator {
    if (!this.pmrem) {
      this.pmrem = new THREE.PMREMGenerator(renderer);
      this.pmrem.compileCubemapShader();
    }
    return this.pmrem;
  }

  /** Room `roomId`'s ceiling box as drawn now (an emergency blows a hole in it), or null. */
  private ceilingOf(roomId: string): THREE.Mesh | null {
    for (const { group } of this.sceneRooms.values()) {
      for (const child of group.children) {
        if (
          child instanceof THREE.Mesh &&
          child.userData.part === 'ceiling' &&
          child.userData.roomId === roomId &&
          child.geometry instanceof THREE.BoxGeometry
        ) {
          return child;
        }
      }
    }
    return null;
  }

  /**
   * Floor, ceiling and wall boxes per room of scene `sceneId` from `roomSlabs`, the shapes physics
   * collides with, in that scene's lighting (`enhanced`).
   */
  private buildRooms(sceneId: string, rooms: readonly RoomDefinition[], enhanced: boolean): void {
    this.clearRooms(sceneId);
    const group = new THREE.Group();
    const { city } = QUALITY[this.game.graphicsQuality];
    let glass: SceneRooms['glass'] = null;
    let glassScene: RoomDefinition | null = null;
    const all: THREE.Material[] = [];
    const textures: THREE.Texture[] = [];
    for (const room of rooms) {
      // Enhanced: matte paint on walls and ceiling, a sealed floor with a little sheen under the
      // sun, the ceiling's glow; basic keeps the look every room had (fully rough, no glow).
      const materials = {
        wall: new THREE.MeshStandardMaterial({
          color: room.wallColor,
          roughness: enhanced ? 0.92 : 1,
        }),
        floor: new THREE.MeshStandardMaterial({
          color: room.floorColor,
          roughness: enhanced ? 0.62 : 1,
        }),
        ceiling: new THREE.MeshStandardMaterial({
          color: CEILING,
          ...(enhanced ? { emissive: CEILING, emissiveIntensity: CEILING_GLOW } : {}),
        }),
      };
      all.push(materials.wall, materials.floor, materials.ceiling);
      materials.floor.userData.surface = FLOOR_SURFACES[room.floor]; // Ultra (surfaces.ts)
      materials.wall.userData.surface = SHELL_SURFACES.wall;
      materials.ceiling.userData.surface = SHELL_SURFACES.ceiling;
      this.ceilings.set(room.id, materials.ceiling);
      if (enhanced && this.darkRooms.has(room.id)) materials.ceiling.emissiveIntensity = 0;
      // Half thickness: the two rooms either side of a doorway each draw their half of the
      // shared wall, so their faces never coincide (no z-fighting). Inner faces are unchanged.
      const slabs = roomSlabs(room, WALL_THICKNESS / 2);
      const hole = enhanced && room.glassFloor && city !== 'none' ? glassRect(room) : null;
      for (const { part, center, halfExtents: h } of slabs) {
        if (part === 'floor' && hole) {
          this.layGlassFloor(group, room, materials.floor, textures, center, h, hole);
          glass = {
            box: glassBox(hole, room.bounds.min[1]),
            detail: city === 'full' ? 'full' : 'simple',
            roomId: room.id,
            room,
          };
          glassScene = room;
          continue;
        }
        const geometry = new THREE.BoxGeometry(2 * h[0], 2 * h[1], 2 * h[2]);
        // Enhanced: floors in 0.6 m tiles, ceilings in 0.6 m panels (their top/bottom face spans
        // the slab, so the texture repeats once per tile).
        if (enhanced && part !== 'wall') {
          this.tileImages ??= { floor: tileImage(false), ceiling: tileImage(true) };
          const image = this.tileImages[part];
          if (image) {
            const map = tiles(image, 2 * h[0], 2 * h[2]);
            materials[part].map = map;
            textures.push(map);
          }
        }
        const mesh = new THREE.Mesh(geometry, materials[part]);
        mesh.position.fromArray(center);
        mesh.userData.part = part; // what casts and receives follows the model (shadeShells)
        mesh.userData.roomId = room.id; // its light goes with the room's (applyDarkness)
        group.add(mesh);
      }
      // Enhanced: a dark skirting where the walls meet the floor (a room's one more draw).
      const skirting = enhanced ? baseboards(room, slabs) : null;
      if (skirting) {
        const trim = new THREE.MeshStandardMaterial({ color: SKIRTING, roughness: 0.55 });
        trim.userData.surface = SHELL_SURFACES.skirting;
        all.push(trim);
        const mesh = new THREE.Mesh(skirting, trim);
        mesh.userData.part = 'skirting';
        mesh.userData.roomId = room.id;
        group.add(mesh);
      }
      // Its style's cladding and decoration (Phase U): a draw per finish, in the shared palette.
      for (const { finish, geometry } of this.dressOf(room)) {
        const mesh = new THREE.Mesh(geometry, this.palette.finish(finish));
        mesh.userData.part = 'skirting'; // receives shadows, casts none
        mesh.userData.roomId = room.id;
        group.add(mesh);
      }
      if (enhanced && QUALITY[this.game.graphicsQuality].modelDetail)
        this.addFittings(group, room, rooms);
    }
    this.shadeShells(group);
    this.finishes.adopt(group); // the tiles' filtering
    this.adoptUltra(group);
    this.rooms.add(group);
    this.darknessDirty = true;
    this.sceneRooms.set(sceneId, { group, materials: all, textures, rooms, enhanced, glass });
    // Its city is loaded when the player walks onto the glass's room (`syncCity`), not with the
    // scene: a neighbour scene attached while the player is elsewhere brings no city.
    if (glass && glassScene) this.glassRooms.set(glass.roomId, sceneId);
  }

  /** Ultra's fittings in a room (dress/fittings.ts): a draw per finish, like its dressing. */
  private addFittings(
    group: THREE.Group,
    room: RoomDefinition,
    scene: readonly RoomDefinition[],
  ): THREE.Mesh[] {
    const sizeOf = (id: string) => this.game.content.items.tryGet(id)?.visual.size;
    return fittings(room, sizeOf, scene).map(({ finish, geometry }) => {
      const mesh = new THREE.Mesh(geometry, this.palette.finish(finish));
      mesh.userData.part = 'skirting'; // receives shadows, casts none
      mesh.userData.roomId = room.id;
      mesh.userData.fitting = true;
      group.add(mesh);
      return mesh;
    });
  }

  /** Ultra's fittings added to every enhanced scene's rooms, or taken away and freed. */
  private syncFittings(on: boolean): void {
    for (const { group, rooms, enhanced } of this.sceneRooms.values()) {
      const had = group.children.filter((child) => child.userData.fitting === true);
      if (on === had.length > 0 || !enhanced) continue;
      if (!on) {
        for (const mesh of had) {
          mesh.removeFromParent();
          (mesh as THREE.Mesh).geometry.dispose();
        }
        continue;
      }
      for (const room of rooms) {
        for (const mesh of this.addFittings(group, room, rooms)) {
          this.adoptUltra(mesh);
          this.sleep.adopt(room.id, mesh);
        }
      }
      this.shadeShells(group);
    }
    this.darknessDirty = true;
  }

  /**
   * A floor slab with a glass area (Phase V-2): the slab laid round it in its tiles (their joints
   * where the whole slab's are), the glass, and its steel grid.
   */
  private layGlassFloor(
    group: THREE.Group,
    room: RoomDefinition,
    floor: THREE.MeshStandardMaterial,
    textures: THREE.Texture[],
    center: readonly number[],
    h: readonly number[],
    hole: Rect,
  ): void {
    const [cx = 0, cy = 0, cz = 0] = center;
    const [hx = 0, hy = 0, hz = 0] = h;
    const slab: Rect = [cx - hx, cx + hx, cz - hz, cz + hz];
    for (const [x0, x1, z0, z1] of around(slab, hole)) {
      const geometry = new THREE.BoxGeometry(x1 - x0, 2 * hy, z1 - z0).translate(
        (x0 + x1) / 2,
        cy,
        (z0 + z1) / 2,
      );
      // The whole slab's texture coordinates (BoxGeometry's top face: u east, v north).
      const p = geometry.getAttribute('position');
      const uv = geometry.getAttribute('uv');
      for (let i = 0; i < p.count; i++) {
        uv.setXY(i, (p.getX(i) - slab[0]) / (2 * hx), 1 - (p.getZ(i) - slab[2]) / (2 * hz));
      }
      const mesh = new THREE.Mesh(geometry, floor);
      mesh.userData.part = 'floor';
      mesh.userData.roomId = room.id;
      group.add(mesh);
    }
    this.tileImages ??= { floor: tileImage(false), ceiling: tileImage(true) };
    if (this.tileImages.floor && !floor.map) {
      floor.map = tiles(this.tileImages.floor, 2 * hx, 2 * hz);
      textures.push(floor.map);
    }
    const top = room.bounds.min[1];
    const glassMaterial = this.palette.finish('floor-glass');
    // Looked down through, clear glass shows what is under it: the room's reflection only faint.
    glassMaterial.envMapIntensity = 0.3;
    const pane = new THREE.Mesh(glassPane(hole, top), glassMaterial);
    pane.userData.roomId = room.id; // no part: it neither casts nor receives a shadow
    const grid = new THREE.Mesh(glassGrid(hole, top), this.palette.finish('frame-dark'));
    grid.userData.part = 'skirting';
    grid.userData.roomId = room.id;
    group.add(pane, grid);
  }

  /** Loads the city under scene `sceneId`'s glass floor (its chunk and models), once. */
  private loadCity(sceneId: string, room: RoomDefinition, detail: CityModule.CityDetail): void {
    if (this.city?.sceneId === sceneId && this.city.detail === detail) return;
    this.dropCity();
    const city: {
      view: CityModule.CityView | null;
      sceneId: string;
      detail: CityModule.CityDetail;
    } = {
      view: null,
      sceneId,
      detail,
    };
    this.city = city;
    const renderer = this.renderer;
    const gpu = this.gpu;
    const device = this.device;
    void import('./city/CityView')
      .then(async ({ CityView, CITY_DEPTH }) => {
        const view = await CityView.load(import.meta.env.BASE_URL, detail);
        if (this.city !== city || !device || this.device !== device) {
          view.dispose();
          return;
        } // left, or another preset or device
        const [x0, x1, z0, z1] = glassRect(room);
        view.place((x0 + x1) / 2, room.bounds.min[1] - CITY_DEPTH, (z0 + z1) / 2);
        view.update(this.camera, this.game.state.world.clockS, 0);
        // Its programs, for where it is drawn (under Ultra the composer's target, not the canvas):
        // no stall at the first look down.
        // shortcut: under WebGPU compiled for the canvas, not the city's own pass (its target is
        // made with the pass): a stall at the first look down stays possible there (G2-1).
        if (gpu) await gpu.renderer.compileAsync(view.scene, view.camera);
        else if (renderer) {
          if (this.post) renderer.setRenderTarget(this.post.target);
          const compiled = renderer.compileAsync(view.scene, view.camera);
          renderer.setRenderTarget(null);
          await compiled;
        }
        // Its textures one a frame, so the first look down does not stall on them: all at once
        // they took one frame of 180–260 ms on an RTX 5070 (High, Ultra; 2026-11-14).
        for (const texture of view.textures) {
          if (this.city !== city || this.device !== device) break;
          device.initTexture(texture);
          await new Promise((next) => requestAnimationFrame(next));
        }
        if (this.city !== city) {
          view.dispose();
          return;
        }
        city.view = view;
      })
      .catch((error: unknown) => {
        this.game.log.warn('The city under the glass could not be loaded', error);
        // Not kept as loaded-without-a-view (it was then never asked for again): the next frame in
        // its room asks again, after a pause.
        if (this.city === city) {
          this.city = null;
          this.cityRetry = CITY_RETRY_S;
        }
      });
  }

  /** Frees the city (its models, textures and programs' uses): loaded again on the next visit. */
  private dropCity(): void {
    this.city?.view?.dispose();
    this.city = null;
    this.cityAway = 0;
    this.post?.setUnder(null, null);
    this.gpu?.post?.setUnder(null, null);
  }

  /** Frees scene `sceneId`'s room shells, or every scene's without it. */
  private clearRooms(sceneId?: string): void {
    for (const [id, { group, materials, textures }] of [...this.sceneRooms]) {
      if (sceneId !== undefined && id !== sceneId) continue;
      if (this.city?.sceneId === id) this.dropCity();
      for (const [room, scene] of [...this.glassRooms])
        if (scene === id) this.glassRooms.delete(room);
      for (const child of group.children) {
        if (child instanceof THREE.Mesh) (child.geometry as THREE.BufferGeometry).dispose();
      }
      group.removeFromParent();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
      for (const [room, ceiling] of [...this.ceilings]) {
        if (materials.includes(ceiling)) this.ceilings.delete(room);
      }
      this.sceneRooms.delete(id);
    }
  }

  /** The rooms asleep and waking (the debug panel's line). */
  /**
   * The Explain view's camera (after the body, which poses from the player's eye): framed on the
   * open view's apparatus, gliding there and back; the player's hands and body hidden meanwhile.
   */
  private frameExplain(dt: number): void {
    const station = this.game.state.session.explain?.stationId ?? null;
    // Or the board the teacher works an example on (Phase Y-3): framed the same way.
    const board = station === null ? this.game.npcs.boardFramed : null;
    const open = station ?? board;
    if (open !== this.explainFramed) {
      // The station's desk display stands between the player and the apparatus: hidden meanwhile.
      const shown = this.explainFramed && this.views.get(`${this.explainFramed}-display`);
      if (shown) this.showView(shown, true);
      const hidden = open && this.views.get(`${open}-display`);
      if (hidden) this.showView(hidden, false);
      this.explainFramed = open;
      const view =
        open === null
          ? undefined
          : board !== null
            ? { group: this.boardWriting.holder }
            : this.views.get(open);
      const entity = open === null ? undefined : this.game.world.entity(open);
      let yaw = 0;
      if (entity) {
        this.explainQuat.fromArray(entity.pose.rotation);
        yaw = this.explainTurn.setFromQuaternion(this.explainQuat, 'YXZ').y;
      }
      const room = entity
        ? this.game.world.roomAt(entity.pose.position[0], entity.pose.position[2])
        : undefined;
      const explain = this.game.explain.explain;
      this.explainFraming.frame(
        view?.group ?? null,
        yaw,
        this.camera,
        board !== null ? [] : (explain?.parts ?? []),
        room?.bounds,
        board !== null ? BOARD_VIEW : explain?.view,
        board !== null ? 0 : undefined,
      );
    }
    this.explainFraming.apply(this.camera, dt);
    if (this.explainFraming.blend > 0) {
      this.hands.group.visible = false;
      this.body.group.visible = false;
    }
  }

  /** Where the open Explain view's part `partId` is in the world (the teacher points at it). */
  private explainPart(partId: string, out: THREE.Vector3): boolean {
    const parts = this.game.explain.explain?.parts ?? [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part?.id === partId) return this.explainFraming.pointAt(part.anchor, out);
    }
    return false;
  }

  /** The open Explain view's labels on the screen (`width` × `height` CSS px), in its parts' order. */
  explainAnchors(width: number, height: number): readonly ExplainAnchor[] {
    const parts = this.game.explain.explain?.parts ?? [];
    return this.explainFraming.place(parts, this.camera, width, height);
  }

  /** Shadow maps drawn since the renderer began (the debug panel). */
  get shadowMapsDrawn(): number {
    return this.shadowCache?.mapsDrawn ?? 0;
  }

  /** What made the last shadow map draw: its name and its parents' (the debug panel). */
  get shadowCause(): string {
    const names: string[] = [];
    for (let o = this.shadowCache?.lastCause ?? null; o && names.length < 4; o = o.parent)
      names.push(o.name || o.type);
    return names.join(' < ') || '—';
  }

  get sleepingRooms(): { asleep: string[]; waking: string[] } {
    return this.sleep.rooms;
  }

  /** Every room of the resident scenes, the current one's first. */
  private residentRooms(): RoomDefinition[] {
    const { world, scenes } = this.game;
    const rooms = [...world.activeRooms];
    for (const id of scenes.residentIds) {
      if (id !== scenes.currentSceneId) rooms.push(...world.roomsOf(id));
    }
    return rooms;
  }

  /** The room a view stands in now (an object moved keeps none of its placement's). */
  private roomOfView({ entity }: EntityView): string {
    const [x, , z] = entity.pose.position;
    return this.game.world.roomAt(x, z)?.id ?? entity.roomId;
  }

  /** What is drawn of a room: its shells and dressing, its decor, its entities but the held one. */
  private objectsOf(roomId: string): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const { group } of this.sceneRooms.values()) {
      for (const child of group.children) if (child.userData.roomId === roomId) out.push(child);
    }
    for (const sceneId of this.game.scenes.residentIds) {
      for (const mesh of this.decor.meshesOf(sceneId)) {
        if (this.decor.roomOf(mesh) === roomId) out.push(mesh);
      }
    }
    const held = this.game.interaction.heldId;
    for (const view of this.views.values()) {
      if (view.entity.id !== held && this.roomOfView(view) === roomId) out.push(view.group);
    }
    return out;
  }

  /**
   * A room waking: its objects compiled and drawn into one pixel a few a frame (warmDraw), out of
   * the camera's layer until then, as a neighbour scene's are.
   */
  private async warmRoom(objects: THREE.Object3D[]): Promise<void> {
    const renderer = this.renderer;
    for (const object of objects) object.layers.set(PENDING_LAYER);
    if (this.gpu) {
      await this.gpu.compile(meshesIn(objects), this.camera, this.scene);
      return;
    }
    if (!renderer) return;
    await this.compileOnly(renderer, objects);
    await this.warmDraw(this.firstDraws(renderer, objects));
  }

  private addEntity(entity: WorldEntity): void {
    if (this.views.has(entity.id)) return;
    this.mirrors.add(entity); // a mirror's reflection, beside its view or decor
    this.readers.add(entity, this.game.world); // a door's card reader, on the wall beside it
    // Decor has no view: its scene's batches draw it (built and freed with the scene).
    const decorScene = DecorBatches.accepts(entity.item) ? this.sceneOf(entity.roomId) : undefined;
    if (decorScene !== undefined) {
      this.decor.add(decorScene, entity);
      return;
    }
    const { visual } = entity.item;
    // Glass (finishes filter it), a light (dark with its room) and a reveal change their own.
    const shared =
      visual.material === 'glass' || visual.material === 'light' || visual.reveal
        ? null
        : this.paints.take(paintKey(visual), () => paintOf(visual));
    const material = shared ?? paintOf(visual);
    const baseEmissive = new THREE.Color(visual.material === 'light' ? visual.color : '#000000');
    // A launcher is drawn as its apparatus; its pedestal is the entity's mesh (focus shows on it
    // and on every painted part, which share its material). The collider stays the item's box.
    const launcher = entity.item.launcher
      ? buildLauncher(entity.item, entity.item.launcher, material)
      : null;
    const pendulum = entity.item.pendulum
      ? buildPendulumFrame(entity.item, entity.item.pendulum, material)
      : null;
    const spring = entity.item.springStand
      ? buildSpringFrame(entity.item, entity.item.springStand, material)
      : null;
    const tower = entity.item.dropTower
      ? buildTowerFrame(entity.item, entity.item.dropTower, material)
      : null;
    const bench = entity.item.bench ? this.benchFrame(entity.item, material) : null;
    // Their fixed parts drawn as few times as they have materials (mergeStill.ts).
    const merged = [launcher, pendulum, spring, tower, bench].flatMap((frame) =>
      frame ? mergeStill(frame.parts) : [],
    );
    // A prop's body is the entity's mesh (focus and glow show on it); its other parts are the
    // mesh's children, so a physics pose moves them too; a leaf's parts turn about its hinge.
    const parts = visual.prop ? this.props.get(visual.prop, visual.size) : null;
    const mesh = new THREE.Mesh(
      launcher?.body ??
        pendulum?.body ??
        spring?.body ??
        tower?.body ??
        bench?.body ??
        parts?.find((part) => part.finish === 'body' && !part.hinge)?.geometry ??
        this.geometryFor(entity.item),
      material,
    );
    mesh.castShadow = visual.material !== 'light' && visual.material !== 'glass';
    mesh.receiveShadow = true;
    const leaves = parts ? attachParts(mesh, parts, entity.item, this.palette) : [];
    const group = new THREE.Group();
    group.name = entity.id; // (named for three's tools and frame breakdowns)
    group.position.fromArray(entity.pose.position);
    group.quaternion.fromArray(entity.pose.rotation);
    group.add(mesh);
    // A control's trim shares the cached geometry and material: nothing of its own to free. The
    // same on every desk, button and display and never lit on its own, it is drawn with the others
    // of its room (decorBatches.ts addPart: ~110 draws fewer in the Physics Lab); a moving one, or
    // one of no world scene, with its view.
    const trim = visual.model ? this.controlFor(visual.model, visual.size).trim : null;
    const trimScene = trim ? this.sceneOf(entity.roomId) : undefined;
    if (trim && trimScene !== undefined && entity.item.physical.body !== 'dynamic') {
      this.decor.addPart(trimScene, entity, `trim:${trim.uuid}`, {
        geometry: trim,
        material: this.trim,
        casts: false,
      });
    } else if (trim) {
      const part = new THREE.Mesh(trim, this.trim);
      part.receiveShadow = true;
      group.add(part);
    }
    // A body of a shared shape and look, the same on many (a knob, a button, a desk, a bench, a
    // monitor: ~400 draws in the Physics Lab), is drawn with the others of its room too; its own
    // mesh draws it only while it looks otherwise (focused, lit, charred) or is outlined, the
    // copy in the batch then at no size (placeBody). The batch takes the shape as made: Ultra's
    // detail is laid on the batch as on the mesh.
    const bodyScene = this.sceneOf(entity.roomId);
    const bodyKey =
      shared && bodyScene !== undefined && this.batchable(entity, mesh)
        ? `body:${mesh.geometry.uuid}:${shared.uuid}:${mesh.castShadow}`
        : null;
    if (bodyKey && bodyScene !== undefined && shared) {
      this.decor.addPart(bodyScene, entity, bodyKey, {
        geometry: mesh.geometry,
        material: shared,
        casts: mesh.castShadow,
      });
    }
    const running = this.game.entityStates.get(entity.id, 'running') === true;
    this.water.add(entity.id, entity.item, group, running);
    const label = this.labelFor(entity.item);
    if (label) group.add(label);
    if (launcher) group.add(launcher.parts, launcher.pivot);
    if (pendulum) group.add(pendulum.parts);
    if (spring) group.add(spring.parts);
    if (tower) group.add(tower.parts);
    if (bench) group.add(bench.parts);
    if (visual.screen) this.experiment.addScreen(entity, group);
    const { dropTower, springStand } = entity.item;
    if (entity.item.pendulum || dropTower || springStand || entity.item.bench) {
      this.experiment.addRig(entity, group);
    }
    this.containers.mount(entity, group, mesh); // after the rig: a bench readout is found by name
    this.reveals.add(entity, group, material);
    this.finishes.adopt(group);
    this.adoptUltra(group);
    this.scene.add(group);
    const view: EntityView = {
      group,
      leaves,
      mesh,
      entity,
      barrel: launcher?.pivot ?? null,
      launcher,
      pendulum,
      spring,
      tower,
      bench,
      merged,
      bodyKey,
      baseEmissive,
      shared,
      // A loose vessel: a physical lab's container, or (shortcut: no better sign of one) a glass
      // item with no prop. Bench glass is merged per rig and not grounded (audit §12).
      grounded:
        entity.item.physical.body === 'dynamic' &&
        (entity.item.container !== undefined || (visual.material === 'glass' && !visual.prop)),
    };
    this.views.set(entity.id, view);
    this.sleep.adopt(this.roomOfView(view), group); // spawned in a room asleep: asleep too
    // A neighbour coming in a few placements a frame: kept out of every draw until its shaders
    // are compiled (precompile), or the frames between would compile them, stalling each.
    if (this.attaching.has(entity.roomId)) {
      group.traverse((object) => {
        if (object.layers.isEnabled(0)) object.layers.set(PENDING_LAYER);
      });
    }
    if (this.darkRooms.size > 0) this.darknessDirty = true;
    if (entity.item.physical.body === 'dynamic') this.dynamicViews.add(view);
    if (entity.item.door || entity.item.slider) this.leafViews.add(view);
    if (leaves.length > 0 && entity.item.hinged) this.hingedViews.add(view);
    this.turnLeaves(view);
    this.refresh(entity.id);
  }

  /**
   * Outlines follow what the held object can act on and the guided task step's objects; the floor
   * path follows the task's way. New lists only when one changed.
   */
  private outline(dt: number): void {
    const { heldTargets, taskGuide, state } = this.game;
    const key = `${heldTargets.version}/${taskGuide.version}`;
    if (key !== this.outlined) {
      this.outlined = key;
      const ids = this.outlineIds;
      const before = [...ids];
      ids.length = 0;
      ids.push(...heldTargets.ids);
      for (const id of taskGuide.objects) if (!ids.includes(id)) ids.push(id);
      // An outlined body is its own mesh's (the outline is drawn by it): out of its batch first.
      for (const id of [...before, ...ids]) {
        const view = this.views.get(id);
        if (view && before.includes(id) !== ids.includes(id)) this.placeBody(view);
      }
      this.outlines.sync(ids, this.outlineMesh, taskGuide.objects);
    }
    if (taskGuide.version !== this.guided) {
      this.guided = taskGuide.version;
      this.floorPath.set(taskGuide.path, state.player.position[1]);
    }
    this.outlines.update(dt, this.camera.position);
    this.floorPath.update(dt);
  }

  /**
   * Frames stayed under SLOW_FPS while playing: one preset lower (unless the player picked one, or
   * capped the frame rate under it themselves); the HUD says so.
   */
  private tooSlow(): void {
    this.qualityWatch.reset();
    const cap = this.game.frameCap;
    if (cap !== 0 && cap < SLOW_FPS) return;
    const lower = lowerQuality(this.game.graphicsQuality);
    if (lower) {
      this.game.preferGraphicsQuality(lower, `under ${SLOW_FPS} fps for ${WINDOW_S} s`, true);
    }
  }

  /** The mesh an entity is outlined by: its drawn glass (a vessel), else its own mesh. */
  private readonly outlineMesh = (entityId: string): THREE.Mesh | null => {
    const view = this.views.get(entityId);
    if (!view) return null;
    const glass = view.group.getObjectByName('glass');
    if (glass instanceof THREE.Mesh) return glass;
    if (view.mesh.visible) return view.mesh;
    // A prop is drawn by its parts (its box is hidden): the largest one shown, its body.
    let best: THREE.Mesh | null = null;
    let size = 0;
    view.group.traverseVisible((object) => {
      if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh) return;
      const mesh = object as THREE.Mesh;
      const geometry: THREE.BufferGeometry = mesh.geometry;
      if (!geometry.boundingSphere) geometry.computeBoundingSphere();
      const radius = geometry.boundingSphere?.radius ?? 0;
      if (radius > size) {
        best = mesh;
        size = radius;
      }
    });
    return best;
  };

  private removeEntity(entityId: string): void {
    const view = this.views.get(entityId);
    if (!view) return;
    this.scene.remove(view.group);
    this.finishes.release(view.group);
    this.contact.remove(entityId);
    this.outlines.forget(entityId);
    this.containers.unmount(entityId);
    if (view.mesh.material !== view.shared) view.mesh.material.dispose(); // its own, or its copy
    if (view.shared) this.paints.release(paintKey(view.entity.item.visual));
    view.launcher?.dispose();
    view.pendulum?.dispose();
    view.spring?.dispose();
    view.tower?.dispose();
    view.bench?.dispose();
    for (const geometry of view.merged) geometry.dispose();
    this.water.remove(entityId);
    this.reveals.remove(entityId);
    this.experiment.removeScreen(entityId);
    this.experiment.removeRig(entityId);
    this.views.delete(entityId);
    this.dynamicViews.delete(view);
    this.leafViews.delete(view);
    this.hingedViews.delete(view);
  }

  /** A bench's frame by its registered model; without one, null (its plain box), warned once. */
  private benchFrame(item: ItemDefinition, painted: THREE.MeshStandardMaterial): BenchFrame | null {
    const key = item.bench?.model ?? '';
    const model = benchModel(key);
    if (model) return model.frame(item, painted);
    if (!this.unknownBenches.has(key)) {
      this.unknownBenches.add(key);
      this.game.log.warn(`No bench model "${key}" (item "${item.id}"): drawn as its box`);
    }
    return null;
  }

  /**
   * A vessel's contact shadow under its drawn box's lowest point, as wide as the box; none while it
   * is held or hidden (it would float). Assigns only: called every frame for a moving vessel.
   */
  private ground({ entity, group }: EntityView): void {
    if (!group.visible || this.game.interaction.heldId === entity.id) {
      this.contact.place(entity.id, 0, 0, 0, 0);
      return;
    }
    const { size } = entity.item.visual;
    // Indexed, not destructured: called every frame for a moving vessel.
    const w = size[0];
    const h = size[1];
    const d = size[2];
    const { x, y, z, w: s } = group.quaternion;
    // Half the box's height in the world: its axes' vertical parts (the rotation's second row).
    const reach =
      (Math.abs(2 * (x * y + s * z)) * w +
        Math.abs(1 - 2 * (x * x + z * z)) * h +
        Math.abs(2 * (y * z - s * x)) * d) /
      2;
    const p = group.position;
    this.contact.place(entity.id, p.x, p.y - reach, p.z, (Math.max(w, d) / 2) * CONTACT_SPREAD);
  }

  /**
   * Whether an entity's body can be drawn among its room's (addEntity): still (never moved,
   * turned or opened), a body of a shape it shares (no prop's parts on it, no apparatus frame of
   * its own), nothing that reads or changes its mesh (a vessel, a circuit part, a reveal).
   */
  private batchable(entity: WorldEntity, mesh: THREE.Mesh): boolean {
    const { item } = entity;
    return (
      item.physical.body !== 'dynamic' &&
      mesh.children.length === 0 &&
      !item.visual.prop &&
      !item.visual.reveal &&
      !item.container &&
      !item.circuit &&
      !item.hinged &&
      !item.door &&
      !item.slider &&
      !item.launcher &&
      !item.pendulum &&
      !item.springStand &&
      !item.dropTower &&
      !item.bench
    );
  }

  /**
   * A batched body drawn where it is to be: by its own mesh while it looks otherwise than its
   * shared look (focused, lit, charred: repaint) or is outlined (the outline is drawn by the mesh),
   * else by its room's batch. On those events only.
   */
  private placeBody(view: EntityView): void {
    if (view.bodyKey === null) return;
    const own = view.mesh.material !== view.shared || this.outlineIds.includes(view.entity.id);
    view.mesh.visible = own;
    this.decor.hidePart(view.entity.id, view.bodyKey, own);
  }

  /** A view shown or hidden, its part drawn among its room's with it (a control's trim). */
  private showView(view: EntityView, shown: boolean): void {
    if (view.group.visible === shown) return;
    view.group.visible = shown;
    this.decor.hide(view.entity.id, !shown);
  }

  /** Its leaves turned to the hinge system's fraction, eased as physics turns their bodies. */
  private turnLeaves(view: EntityView): void {
    const hinged = view.entity.item.hinged;
    if (!hinged) return;
    const f = this.game.hinges.fraction(view.entity.id);
    const angle = swingAngle(f, hinged.angleDeg * DEG);
    for (const leaf of view.leaves) leaf.pivot.rotation.y = leaf.opens * angle;
  }

  /**
   * Until the playing action's `place` moment, its target keeps the look it had before the
   * action (a coat taken from the wardrobe still hangs there while the hand reaches for it, one
   * put back appears on its hook once hung); then its own state's look again.
   */
  private placeActed(): void {
    const action = this.game.actions.current;
    const place = action?.sequence.place;
    const id = action && place !== undefined && action.t < place ? action.target.id : null;
    if (id !== this.placing) {
      const was = this.placing;
      this.placing = id;
      if (was !== null) this.refresh(was);
    }
    const view = id === null ? undefined : this.views.get(id);
    if (view && id !== null) this.showView(view, this.game.entityStates.get(id, 'taken') === true);
  }

  /**
   * Applies entity state (active → glow, open → its leaves swing (turnLeaves, every frame), running → water, taken → hidden while
   * the player wears it) and focus highlight to the mesh.
   */
  private refresh(entityId: string): void {
    const view = this.views.get(entityId);
    if (!view) return;
    const states = this.game.entityStates;
    this.showView(view, states.get(entityId, 'taken') !== true);
    if (view.grounded) this.ground(view);
    this.water.refresh(entityId, states.get(entityId, 'running') === true);
    const angle = states.get(entityId, 'param.angle');
    if (view.barrel && typeof angle === 'number') view.barrel.rotation.z = angle * DEG;
    if (view.entity.item.interactions.includes(ROOM_LIGHTS)) {
      this.switched(view.entity.roomId, states.get(entityId, LIGHTS_OFF) === true);
    }
    const active = states.get(entityId, 'active') === true;
    const { color } = view.entity.item.visual;
    // Blackened by a fire, or a circuit part ruined by heat (Phase E-2); its own colour again once
    // cleaned or swapped. Only an entity that was ever so is touched.
    const charred =
      states.get(entityId, 'charred') === true || states.get(entityId, 'broken') === true;
    this.repaint(view, active || charred || entityId === this.focusedId);
    this.placeBody(view);
    const material = view.mesh.material;
    if (charred || material.userData.charred === true) {
      material.color.set(color);
      if (charred) material.color.multiplyScalar(0.2);
      material.userData.charred = charred;
    }
    if (active) {
      material.emissive.set(color);
      material.emissiveIntensity = 0.9;
    } else {
      // A light fixture glows only while its room's lights are on.
      const off =
        this.darkRooms.has(view.entity.roomId) && view.entity.item.visual.material === 'light';
      material.emissive.copy(off ? BLACK : view.baseEmissive);
      if (entityId === this.focusedId) material.emissive.add(FOCUS_EMISSIVE);
      material.emissiveIntensity = 1;
    }
  }

  /**
   * A shared view in a copy of its own while it differs from its look (`changed`: focused, active,
   * charred), in the shared material again after. Every part painted with the one (a rig's parts
   * share the body's) takes the other; the copy is made as the shared one was, so it draws with
   * the same program.
   */
  private repaint(view: EntityView, changed: boolean): void {
    const { shared } = view;
    const from = view.mesh.material;
    if (!shared || changed === (from !== shared)) return;
    const to = changed ? paintOf(view.entity.item.visual) : shared;
    view.group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (this.twinned.get(mesh) === from)
        this.twinned.delete(mesh); // its dark copy: redone
      else if (mesh.material !== from) return;
      mesh.material = to;
    });
    this.finishes.adopt(view.group);
    this.surfaces.adopt(view.group);
    if (this.darkRooms.has(view.entity.roomId) || this.darkened.has(from) || this.darkened.has(to))
      this.darknessDirty = true;
    if (changed) return;
    this.darkened.delete(from);
    from.dispose();
  }

  /**
   * A sign's text on a plane over the front (+z) face, drawn once per item, in the language
   * of that moment (it is only chosen in the main menu, before any world scene).
   */
  private labelFor(item: ItemDefinition): THREE.Mesh | null {
    const label = item.visual.label;
    if (!label) return null;
    const shared = this.labelPlane(item, label);
    const mesh = new THREE.Mesh(shared.geometry, shared.material);
    mesh.position.z = item.visual.size[2] / 2 + 0.002;
    mesh.receiveShadow = !item.visual.reveal;
    mesh.userData.sharedMaterial = true; // a reveal clones it to fade it on its own
    return mesh;
  }

  /**
   * The label's plane, drawn once per item and language (~27 ms of a door's first
   * attach before), shared by every view of it — or ahead of it (prewarmNeighbours).
   */
  private labelPlane(
    item: ItemDefinition,
    label: NonNullable<ItemDefinition['visual']['label']>,
  ): { geometry: THREE.PlaneGeometry; material: THREE.MeshStandardMaterial } {
    const key = `${item.id}|${this.game.language}`;
    let shared = this.labels.get(key);
    if (!shared) {
      const [w, h] = item.visual.size;
      shared = this.drawLabel(
        this.game.texts.of(label, 'text'),
        item.visual.reveal ? GLASS_LABEL : label,
        w,
        h,
      );
      this.labels.set(key, shared);
      // Its anisotropy set before its first upload. Uploaded when its scene is first drawn (a
      // door's attach warm-up, out of sight: warmDraw), never here: an idle upload made GL
      // textures for scenes not attached, seconds after a door, so a scene never settled.
      const { map } = shared.material;
      if (map) this.finishes.texture(map);
    }
    return shared;
  }

  /**
   * The scenes a door joins to `sceneId`: their props' geometry and their labels built in idle
   * time, a little at a time, before a door attaches them (else built in that attach's frame:
   * ~30 ms of a lab's first open). Bounded by those scenes (2–4); nothing else is preloaded.
   */
  private prewarmNeighbours(sceneId: string, now = false): void {
    const { content } = this.game;
    const done = new Set<string>();
    for (const scene of this.neighbours(sceneId)) {
      for (const roomId of scene.rooms) {
        for (const p of content.rooms.get(roomId).placements) {
          const item = content.items.tryGet(p.item);
          if (!item || done.has(item.id)) continue;
          done.add(item.id);
          const { prop, label } = item.visual;
          if (prop) this.idle.push(() => this.props.get(prop, item.visual.size));
          if (label) this.idle.push(() => this.labelPlane(item, label));
        }
      }
    }
    if (now) {
      while (this.idle.length > 0) this.idle.shift()?.();
      return;
    }
    this.runIdle();
  }

  /** The world scenes a door joins to `sceneId`, each once. */
  private neighbours(sceneId: string): Extract<SceneDefinition, { kind: 'world' }>[] {
    const out: Extract<SceneDefinition, { kind: 'world' }>[] = [];
    for (const { a, b } of this.game.scenes.doorPairs) {
      const other = a.sceneId === sceneId ? b.sceneId : b.sceneId === sceneId ? a.sceneId : null;
      const scene = other ? this.game.content.scenes.tryGet(other) : undefined;
      if (scene?.kind === 'world' && !out.includes(scene)) out.push(scene);
    }
    return out;
  }

  /** `room`'s dressing where it is in the session frame, built the first time (dresses). */
  private dressOf(room: RoomDefinition): DressPart[] {
    const key = `${room.id}@${room.bounds.min.join(',')}`;
    let dress = this.dresses.get(key);
    if (!dress) {
      dress = dressRoom(room, (id) => this.game.content.items.tryGet(id)?.visual.size);
      this.dresses.set(key, dress);
    }
    return dress;
  }

  /**
   * The queued work, a task when the browser is idle (a few ms each: at 300 Hz the spare time of
   * a frame is shorter than one, so one a callback, never more than the spare time allows).
   */
  private runIdle(): void {
    if (this.idleHandle !== null || this.idle.length === 0) return;
    const run = (deadline?: IdleDeadline) => {
      this.idleHandle = null;
      do this.idle.shift()?.();
      while (this.idle.length > 0 && (deadline?.timeRemaining() ?? 0) > IDLE_MIN_MS);
      this.runIdle();
    };
    this.idleHandle =
      typeof requestIdleCallback === 'function'
        ? requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS })
        : window.setTimeout(run, IDLE_TIMEOUT_MS);
  }

  private drawLabel(
    text: string,
    label: { background: string; color: string; frame?: string },
    w: number,
    h: number,
  ): { geometry: THREE.PlaneGeometry; material: THREE.MeshStandardMaterial } {
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(LABEL_MAX_PX, Math.round(w * LABEL_PX_PER_M));
    canvas.height = Math.max(16, Math.round((canvas.width * h) / w));
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = label.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (label.frame) {
        // A glass panel's lit edge, and a brighter line along its top.
        const line = Math.max(2, Math.round(canvas.width / 220));
        ctx.strokeStyle = label.frame;
        ctx.lineWidth = line;
        ctx.strokeRect(line / 2, line / 2, canvas.width - line, canvas.height - line);
        ctx.fillStyle = label.frame;
        ctx.fillRect(0, 0, canvas.width, line * 2);
      }
      // Formulas as a teacher writes them (subscripts, exponents, fractions; 0,5 in Vietnamese).
      const vi = this.game.language === 'vi';
      const lines = text.split('\n').map((l) => layoutFormula(vi ? decimalComma(l) : l));
      const bold = (px: number) => `700 ${px.toFixed(1)}px system-ui, sans-serif`;
      const widthOf = (items: (typeof lines)[number], px: number) =>
        drawFormula(ctx, items, bold, px, 0, 0, Infinity, false);
      // The largest font that fits both the longest line and all lines.
      let size = canvas.height / (lines.length * 1.3);
      const widest = Math.max(...lines.map((l) => widthOf(l, size)));
      if (widest > canvas.width * 0.9) size *= (canvas.width * 0.9) / widest;
      ctx.fillStyle = label.color;
      ctx.strokeStyle = label.color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      lines.forEach((line, i) => {
        const y = canvas.height / 2 + (i - (lines.length - 1) / 2) * size * 1.25;
        const width = widthOf(line, size);
        drawFormula(ctx, line, bold, size, (canvas.width - width) / 2, y, Infinity, true);
      });
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return {
      geometry: new THREE.PlaneGeometry(w * 0.98, h * 0.96),
      material: new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.7,
        // Glass: the text lit by itself, the tint see-through.
        ...(label.frame && { transparent: true, emissive: '#ffffff', emissiveMap: texture }),
      }),
    };
  }

  /** The world scene listing room `roomId` (content puts a room in one at most). */
  private sceneOf(roomId: string): string | undefined {
    return this.game.content.scenes
      .all()
      .find((scene) => scene.kind === 'world' && scene.rooms.includes(roomId))?.id;
  }

  /** A decor item's parts: its prop's, or (no prop, or none built yet) its primitive as the body. */
  private partsOf(item: ItemDefinition): readonly PropPart[] {
    const { prop, size } = item.visual;
    return (
      (prop && this.props.get(prop, size)) || [
        { finish: 'body', geometry: this.geometryFor(item), casts: true },
      ]
    );
  }

  private geometryFor(item: ItemDefinition): THREE.BufferGeometry {
    const { shape, size, model } = item.visual;
    if (model) return this.controlFor(model, size).body;
    const key = `${shape}:${size.join(',')}`;
    let geometry = this.geometries.get(key);
    if (!geometry) {
      const [w, h, d] = size;
      geometry =
        shape === 'sphere'
          ? new THREE.SphereGeometry(w / 2, 24, 16)
          : shape === 'cylinder'
            ? new THREE.CylinderGeometry(w / 2, w / 2, h, 24)
            : new THREE.BoxGeometry(w, h, d);
      this.geometries.set(key, geometry);
    }
    return geometry;
  }

  private controlFor(model: ControlModel, size: readonly number[]): ControlShapes {
    const key = `${model}:${size.join(',')}`;
    let shapes = this.controls.get(key);
    if (!shapes) {
      shapes = controlShapes(model, size);
      this.controls.set(key, shapes);
    }
    return shapes;
  }
}

/**
 * The warm-up's next batch: halved after a frame well over the usual interval `frameDt`, doubled
 * after a quick one; past WARM_MAX_S of it, doubled whatever the frame time, so it ends in a few.
 */
export function warmBatch(batch: number, dt: number, frameDt: number, elapsed: number): number {
  if (elapsed > WARM_MAX_S || dt < frameDt * WARM_FAST) return Math.min(WARM_BATCH, batch * 2);
  if (dt > frameDt * WARM_SLOW + WARM_SLACK_S) return Math.max(1, batch >> 1);
  return batch;
}

/**
 * Where the warm-up's batch from `next` ends: at most `batch` objects, and no more new texture data
 * than WARM_BYTES (`bytes` of an object), but always one.
 */
export function warmEnd(
  objects: readonly THREE.Object3D[],
  next: number,
  batch: number,
  bytes: (object: THREE.Object3D) => number,
): number {
  const last = Math.min(next + batch, objects.length);
  let end = next;
  let total = 0;
  while (end < last) {
    const object = objects[end];
    const b = object ? bytes(object) : 0;
    if (end > next && total + b > WARM_BYTES) break;
    total += b;
    end++;
  }
  return end;
}

/** Bytes of `object`'s textures not on the GPU yet: its first draw uploads them. */
/** What is drawn under `roots` (each object with a material, the roots too). */
function meshesIn(roots: readonly THREE.Object3D[]): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  for (const root of roots) {
    root.traverse((object) => {
      if ((object as Partial<THREE.Mesh>).material) out.push(object);
    });
  }
  return out;
}

function newTextureBytes(renderer: THREE.WebGLRenderer, object: THREE.Object3D): number {
  let bytes = 0;
  for (const material of [(object as Partial<THREE.Mesh>).material ?? []].flat()) {
    for (const value of Object.values(material)) {
      if (!(value instanceof THREE.Texture)) continue;
      // three's own record: the version it last uploaded.
      if ((renderer.properties.get(value) as { __version?: number }).__version === value.version)
        continue;
      const image = value.image as { width?: number; height?: number } | null;
      bytes += (image?.width ?? 0) * (image?.height ?? 0) * 4;
    }
  }
  return bytes;
}

/** An entity's paint: its colour in its look. */
function paintOf(visual: ItemDefinition['visual']): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: visual.color,
    ...LOOKS[visual.material],
  });
  material.userData.look = visual.material; // its Ultra surface (surfaces.ts)
  return material;
}

/** Which entities share a paint. */
const paintKey = (visual: ItemDefinition['visual']) => visual.material + ' ' + visual.color;

/** A room's glass floor as a rectangle [x0, x1, z0, z1]. */
function glassRect(room: RoomDefinition): Rect {
  const g = room.glassFloor;
  return g ? [g.x[0], g.x[1], g.z[0], g.z[1]] : [0, 0, 0, 0];
}

/** The glass floor's box (its top the floor's), for the city's view test. */
function glassBox([x0, x1, z0, z1]: Rect, floor: number): THREE.Box3 {
  return new THREE.Box3(new THREE.Vector3(x0, floor - 0.1, z0), new THREE.Vector3(x1, floor, z1));
}
