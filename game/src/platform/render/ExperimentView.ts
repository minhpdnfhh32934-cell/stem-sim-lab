import * as THREE from 'three';
import type { Disposables } from '../../core/EventBus';
import type { Texts } from '../../core/i18n';
import type { Vec3 } from '../../core/math';
import type { Game } from '../../game/Game';
import {
  type BenchPose,
  dropHeight,
  type LauncherView,
  releaseHeight,
  springExtension,
  type StationView,
  swingAngle,
  swingLength,
} from '../../gameplay/experiment/StationSystem';
import { type ExperimentDefinition, shownInputs, theoryShown } from '../../simulation/experiment';
import type { SessionState } from '../../simulation/ExperimentSession';
import type { WorldEntity } from '../../world/World';
import { formatQuantity } from '../ui/dom';
import { extent, niceAxis, scale, tickLabel } from '../ui/plot';
import {
  changedSettings,
  graphFor,
  parameterValue,
  resultsColumn,
  resultSummary,
} from '../ui/results';
import { benchModel, type BenchRig } from './bench/registry';
import { buildSpringHanger, type SpringHanger, springLayout } from './hookeModel';
import { buildPendulumSwing, type PendulumSwing, scaleLayout } from './pendulumModel';
import { QUALITY } from './quality';
import { buildTowerCarriage, type TowerCarriage, towerLayout } from './towerModel';

/** Live repaint rate while a run is in progress (screens and trail), per second. */
const LIVE_HZ = 10;
/**
 * Texels per metre, one value for every graphics preset (render-quality audit F2, sharp from about
 * 1 m at native resolution): the pendulum/tower ruler (was 914) and the launcher's floor tape
 * along the lane (was 96), drawn once. Live screens take the preset's (quality.ts
 * `screenPxPerM`). A canvas is at most MAX_PX a side.
 */
const RULER_PX_PER_M = 2000;
const TAPE_PX_PER_M = 512;
const MAX_PX = 4096;
const INK = '#e8eef4';
const DIM = '#8fa3b5';
const ACCENT = '#4fb3d9';
const AMBER = '#f0b54a';
const GREEN = '#7bd88f';
// The desk display, in layout units (1/100 of its width): first results row and their spacing;
// the footer's line height, its first line FOOTER_UP above the bottom edge.
const ROWS_TOP = 22;
const ROW_PITCH = 5.5;
const FOOTER_LINE = 4.2;
const FOOTER_UP = 9;

/** Graph series colours (as on the results panel); a legend names them too. */
const SERIES = [ACCENT, '#f0a35a', GREEN];
const DEG = Math.PI / 180;

interface Screen {
  readonly kind: 'status' | 'graph';
  /** Its face's width and height (m). */
  readonly size: readonly [number, number];
  readonly stationId: string;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly texture: THREE.CanvasTexture;
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
}

/** A launcher station's lane visuals. */
interface StationVisuals {
  readonly trail: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  readonly positions: Float32Array;
  readonly marker: THREE.Group;
  readonly tape: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  /** Run whose samples the trail holds, and how many of them. */
  runId: string | null;
  drawn: number;
}

/**
 * A pendulum stand's scales and its swinging parts, posed from the session every frame. (Its frame
 * is the entity's own apparatus: WorldRenderer draws it, pendulumModel builds both.)
 */
interface PendulumRig {
  readonly kind: 'pendulum';
  readonly stationId: string;
  /** Hub, rod and bob about the pivot; it frees its own resources. */
  readonly model: PendulumSwing;
  /** The protractor and the length scale. */
  readonly parts: readonly THREE.Object3D[];
}

/**
 * A free-fall tower's scale, carriage and ball, posed from the session every frame. (Its frame is
 * the entity's own apparatus: WorldRenderer draws it, towerModel builds both.)
 */
interface TowerRig {
  readonly kind: 'drop';
  readonly stationId: string;
  /** The carriage with the release clamp, and the ball; it frees its own resources. */
  readonly model: TowerCarriage;
  /** The scale. */
  readonly parts: readonly THREE.Object3D[];
}

/**
 * A spring stand's ruler and what hangs from its hook, posed from the session every frame. (Its
 * frame is the entity's own apparatus: WorldRenderer draws it, hookeModel builds both.)
 */
interface SpringRig {
  readonly kind: 'spring';
  readonly stationId: string;
  /** The spring, the mass hanger and its pointer; it frees its own resources. */
  readonly model: SpringHanger;
  readonly naturalLength: number;
  /** The ruler. */
  readonly parts: readonly THREE.Object3D[];
  /** Its extension (m) while the mass is held before RUN: at y₀ from rest (the station's view). */
  held: number;
}

/**
 * A bench's moving parts, built by its registered model (none for a model without a rig, or an
 * unknown one) and posed every frame from its station. (Its frame: WorldRenderer.)
 */
interface BenchRigView {
  readonly kind: 'bench';
  readonly stationId: string;
  readonly model: BenchRig | null;
  readonly parts: readonly THREE.Object3D[];
  /** The station's own live pose; null until the station is attached. */
  pose: BenchPose | null;
}

type Rig = PendulumRig | TowerRig | SpringRig | BenchRigView;

/**
 * What a station shows in the world, all read from its session through the StationSystem view:
 * the screens (desk status, results monitor graph); for a launcher the trajectory trail — the
 * run's own samples, put in the world by the same mapping that places the ball — the landing
 * marker and the measuring tape along the lane; for a pendulum the stand, rod and bob, posed
 * every frame from the session (the model's angle while a run exists, the release angle
 * otherwise); for a free-fall tower the clamp and the ball, posed the same way (the model's height
 * while a run exists, the release height otherwise). Screens repaint on station events, and at
 * most LIVE_HZ times a second while a run is in progress; nothing is allocated per frame.
 */
export class ExperimentView {
  readonly group = new THREE.Group();
  private readonly screens = new Map<string, Screen>();
  private readonly stations = new Map<string, StationVisuals>();
  private readonly rigs = new Map<string, Rig>();
  private readonly point: Vec3 = [0, 0, 0];
  private clock = 0;
  private nextLive = 0;

  constructor(private readonly game: Game) {}

  attach(subscriptions: Disposables): void {
    const { events } = this.game;
    subscriptions.add(
      events.subscribe('ExperimentStationChanged', ({ stationId }) => this.refresh(stationId)),
    );
    subscriptions.add(events.subscribe('SceneUnloaded', () => this.clearStations()));
    // A launcher's lane goes with its apparatus (a neighbour scene released).
    subscriptions.add(
      events.subscribe('EntityDespawned', ({ entityId }) => this.removeStation(entityId)),
    );
    // Every screen shows its texts again in the new language.
    subscriptions.add(
      events.subscribe('LanguageChanged', () => {
        for (const screen of this.screens.values()) {
          const view = this.game.stations.view(screen.stationId);
          if (view) this.paint(screen, view);
        }
      }),
    );
    // A screen at the new preset's density: its canvas resized, uploaded anew at that size.
    subscriptions.add(
      events.subscribe('GraphicsQualityChanged', () => {
        for (const screen of this.screens.values()) {
          if (!this.fit(screen.canvas, screen.kind, ...screen.size)) continue;
          screen.texture.dispose(); // its GPU copy at the old size; three uploads it again
          const view = this.game.stations.view(screen.stationId);
          if (view) this.paint(screen, view);
          else this.blank(screen);
        }
      }),
    );
  }

  /** A screen's canvas sized to the preset's density (quality.ts); true when it changed. */
  private fit(canvas: HTMLCanvasElement, kind: Screen['kind'], w: number, h: number): boolean {
    const density = QUALITY[this.game.graphicsQuality].screenPxPerM * (kind === 'graph' ? 1 : 1.2);
    const width = Math.min(MAX_PX, Math.round(w * density));
    const height = Math.round((width * h) / w);
    if (canvas.width === width && canvas.height === height) return false;
    canvas.width = width; // clears it: the caller paints it again
    canvas.height = height;
    return true;
  }

  update(dt: number): void {
    for (const rig of this.rigs.values()) this.pose(rig, dt);
    this.clock += dt;
    if (this.clock < this.nextLive) return;
    this.nextLive = this.clock + 1 / LIVE_HZ;
    // Launcher stations (trail and screens) and rigs (screens) are disjoint.
    for (const id of this.stations.keys()) this.refreshRunning(id);
    for (const id of this.rigs.keys()) this.refreshRunning(id);
  }

  private refreshRunning(stationId: string): void {
    if (this.game.experiments.find(stationId)?.state === 'running') this.refresh(stationId);
  }

  /** A live display on the front face of a `visual.screen` item, added to its view group. */
  addScreen(entity: WorldEntity, group: THREE.Group): void {
    const kind = entity.item.visual.screen;
    const station = entity.params.station;
    if (!kind || typeof station !== 'string') return;
    const [w, h, d] = entity.item.visual.size;
    const canvas = document.createElement('canvas');
    this.fit(canvas, kind, w, h);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Uploaded as plain RGBA8 and decoded from sRGB in the shader, as three does for video:
    // Chrome/ANGLE copies a canvas into an sRGB texture through the CPU, ~35 ms a repaint at
    // 1600 px/m on an RTX 5070 (render-quality audit §12). The define is three's own (map_fragment).
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
    material.defines = { DECODE_VIDEO_TEXTURE: '' };
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.94, h * 0.9), material);
    mesh.position.z = d / 2 + 0.002;
    group.add(mesh);
    const screen: Screen = {
      kind,
      size: [w, h],
      stationId: `${entity.roomId}/${station}`,
      canvas,
      ctx,
      texture,
      mesh,
    };
    this.screens.set(entity.id, screen);
    const view = this.game.stations.view(screen.stationId);
    if (view) this.paint(screen, view);
    else this.blank(screen);
  }

  removeScreen(entityId: string): void {
    const screen = this.screens.get(entityId);
    if (!screen) return;
    screen.mesh.removeFromParent();
    screen.mesh.geometry.dispose();
    screen.mesh.material.dispose();
    screen.texture.dispose();
    this.screens.delete(entityId);
  }

  /** The parts of an apparatus drawn from its session: a pendulum, a tower, a spring, a bench. */
  addRig(entity: WorldEntity, group: THREE.Group): void {
    const { pendulum, dropTower, springStand, bench } = entity.item;
    if (pendulum) this.addPendulum(entity, group, pendulum);
    else if (dropTower) this.addTower(entity, group, dropTower);
    else if (springStand) this.addSpring(entity, group, springStand);
    else if (bench) {
      // Kept without moving parts too: its screens still follow a run live (update).
      const model = benchModel(bench.model)?.rig?.(entity.item) ?? null;
      if (model) group.add(model.group);
      const view = this.game.stations.view(entity.id);
      const pose = view?.kind === 'bench' ? view.pose : null;
      const rig: BenchRigView = { kind: 'bench', stationId: entity.id, model, parts: [], pose };
      this.rigs.set(entity.id, rig);
      this.pose(rig);
    }
  }

  /** Adds a part to the apparatus' group and to the rig's list (casting shadows unless asked). */
  private attachPart(
    group: THREE.Group,
    parts: THREE.Object3D[],
    object: THREE.Object3D,
    shadow = true,
  ) {
    object.traverse((node) => {
      if (node instanceof THREE.Mesh) node.castShadow = shadow;
    });
    group.add(object);
    parts.push(object);
  }

  /**
   * A pendulum stand's scales and swing, in the apparatus' own frame (the view group sits at the
   * centre of its base): the protractor and the length scale behind the swing plane, clear of the
   * bob passing in front, where the frame's clip and arm hold them (`scaleLayout`); and the hub,
   * rod and bob, posed from the run.
   */
  private addPendulum(
    entity: WorldEntity,
    group: THREE.Group,
    pendulum: NonNullable<WorldEntity['item']['pendulum']>,
  ): void {
    const [, h] = entity.item.visual.size;
    const [px, py, pz] = pendulum.pivot;
    const layout = scaleLayout(entity.item, pendulum);
    const parts: THREE.Object3D[] = [];
    const protractor = this.protractor(layout.protractor.radius);
    protractor.name = 'protractor'; // named: the Explain view labels it
    protractor.position.copy(layout.protractor.center);
    this.attachPart(group, parts, protractor, false);
    const ruler = this.ruler(layout.ruler.length);
    ruler.name = 'length-scale';
    ruler.position.copy(layout.ruler.center);
    this.attachPart(group, parts, ruler, false);

    const model = buildPendulumSwing(pendulum, new THREE.Vector3(px, py - h / 2, pz));
    group.add(model.swing);
    const rig: PendulumRig = { kind: 'pendulum', stationId: entity.id, model, parts };
    this.rigs.set(entity.id, rig);
    this.pose(rig);
  }

  /**
   * A free-fall tower's scale and moving parts, in the apparatus' own frame (the view group sits
   * at the centre of the column): the scale on the column's face reading heights from the floor
   * (`towerLayout`), and the carriage with the release clamp and the ball, posed from the station.
   */
  private addTower(
    entity: WorldEntity,
    group: THREE.Group,
    tower: NonNullable<WorldEntity['item']['dropTower']>,
  ): void {
    const layout = towerLayout(entity.item, tower);
    const parts: THREE.Object3D[] = [];
    const ruler = this.ruler(layout.scale.length, true);
    ruler.name = 'height-scale';
    ruler.position.copy(layout.scale.center);
    this.attachPart(group, parts, ruler, false);

    const model = buildTowerCarriage(entity.item, tower);
    group.add(model.group);
    const rig: TowerRig = { kind: 'drop', stationId: entity.id, model, parts };
    this.rigs.set(entity.id, rig);
    this.pose(rig);
  }

  /**
   * A spring stand's ruler and hanging parts, in the apparatus' own frame (the view group sits at
   * the centre of the column): the ruler on the frame's scale board, zeroed where the pointer rests
   * while nothing hangs, so it reads the extension from the natural length (`springLayout`); and
   * the spring with the mass hanger, posed from the run.
   */
  private addSpring(
    entity: WorldEntity,
    group: THREE.Group,
    stand: NonNullable<WorldEntity['item']['springStand']>,
  ): void {
    const layout = springLayout(entity.item, stand);
    const parts: THREE.Object3D[] = [];
    // Marks every centimetre, down past the elastic limit.
    const ruler = this.ruler(layout.ruler.length, false, 0.01);
    ruler.name = 'ruler';
    ruler.position.copy(layout.ruler.center);
    this.attachPart(group, parts, ruler, false);

    const model = buildSpringHanger(stand, layout.hook);
    group.add(model.group);
    const rig: SpringRig = {
      kind: 'spring',
      stationId: entity.id,
      model,
      naturalLength: stand.naturalLength,
      parts,
      held: this.heldOf(entity.id),
    };
    this.rigs.set(entity.id, rig);
    this.pose(rig);
  }

  removeRig(entityId: string): void {
    const rig = this.rigs.get(entityId);
    if (!rig) return;
    for (const part of rig.parts) {
      part.removeFromParent();
      part.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        (node.geometry as THREE.BufferGeometry).dispose();
        const material = node.material as THREE.MeshStandardMaterial;
        material.map?.dispose();
        material.dispose();
      });
    }
    if (rig.kind === 'pendulum') {
      rig.model.swing.removeFromParent();
      rig.model.dispose();
    } else if (rig.model) {
      rig.model.group.removeFromParent();
      rig.model.dispose();
    }
    this.rigs.delete(entityId);
  }

  dispose(): void {
    for (const id of [...this.screens.keys()]) this.removeScreen(id);
    for (const id of [...this.rigs.keys()]) this.removeRig(id);
    this.clearStations();
  }

  // ---- pendulum and tower -------------------------------------------------------------------

  /**
   * The model is the only source of the bob's angle and the ball's height: this only copies them
   * (no allocation). A bench's model poses itself from its station's pose.
   */
  private pose(rig: Rig, dt = 0): void {
    if (rig.kind === 'bench') {
      if (rig.model && rig.pose) rig.model.pose(rig.pose, dt);
      return;
    }
    if (rig.kind === 'spring') {
      // Held at y₀ from rest until a run exists; the model's extension after that.
      const session = this.game.experiments.find(rig.stationId);
      rig.model.pose(rig.naturalLength + (session?.run ? springExtension(session) : rig.held));
      return;
    }
    const session = this.game.experiments.find(rig.stationId);
    if (!session) return;
    if (rig.kind === 'drop') {
      // Let go once a run exists (RESET clears it: held again).
      rig.model.pose(releaseHeight(session), dropHeight(session), session.run !== null);
      return;
    }
    rig.model.pose(swingLength(session), swingAngle(session));
  }

  /** A clear protractor hanging below the pivot: ticks every 5°, figures every 15°. */
  private protractor(radius: number): THREE.Mesh {
    const w = 2 * (radius + 0.04);
    const h = radius + 0.08;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = Math.round((512 * h) / w);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const s = canvas.width / w; // px per metre
      const cx = canvas.width / 2;
      const cy = 0.04 * s;
      const r = radius * s;
      ctx.fillStyle = 'rgba(240, 246, 250, 0.82)';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, (20 * Math.PI) / 180, (160 * Math.PI) / 180);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#1d2731';
      ctx.fillStyle = '#1d2731';
      ctx.font = '600 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (let a = -70; a <= 70; a += 5) {
        const t = (90 - a) * DEG; // 0° hangs straight down, positive angles towards +x
        const long = a % 15 === 0;
        const inner = r - (long ? 0.06 : 0.035) * s;
        ctx.lineWidth = long ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(t) * inner, cy + Math.sin(t) * inner);
        ctx.lineTo(cx + Math.cos(t) * r, cy + Math.sin(t) * r);
        ctx.stroke();
        if (long && Math.abs(a) <= 60) {
          const at = r - 0.1 * s;
          ctx.fillText(`${Math.abs(a)}°`, cx + Math.cos(t) * at, cy + Math.sin(t) * at + 5);
        }
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide }),
    );
  }

  /**
   * A length scale: a mark every 0.1 m, figures every 0.5 m, read from its top (a pendulum's
   * pivot) or, `fromFloor`, from its bottom (a tower's floor).
   */
  private ruler(length: number, fromFloor = false, step = 0.1): THREE.Mesh {
    const width = 0.07;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * RULER_PX_PER_M);
    canvas.height = Math.min(MAX_PX, Math.round(length * RULER_PX_PER_M));
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const s = canvas.height / length; // px per metre
      const k = canvas.width / 64; // the layout was drawn 64 px wide
      ctx.fillStyle = '#f2d75a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#1d2731';
      ctx.font = `600 ${22 * k}px system-ui, sans-serif`;
      ctx.textAlign = 'right';
      for (let i = 1; i * step <= length + 1e-9; i++) {
        const y = (fromFloor ? length - i * step : i * step) * s;
        const half = i % 5 === 0;
        ctx.fillRect(0, y - k, (half ? 28 : 16) * k, 2 * k);
        if (half) {
          ctx.fillText((i * step).toFixed(step < 0.1 ? 2 : 1), canvas.width - 4 * k, y + 8 * k);
        }
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Mesh(
      new THREE.PlaneGeometry(width, length),
      new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
    );
  }

  // ---- launcher lane ------------------------------------------------------------------------

  private refresh(stationId: string): void {
    const view = this.game.stations.view(stationId);
    if (!view) return;
    const rig = this.rigs.get(stationId);
    if (rig?.kind === 'spring' && view.kind === 'spring') rig.held = view.held;
    if (rig?.kind === 'bench' && view.kind === 'bench') rig.pose = view.pose;
    // No lane for an apparatus already gone (its run stopped as its scene was released).
    if (view.kind === 'launcher' && this.game.world.entity(stationId)) {
      const visuals = this.stations.get(stationId) ?? this.createStation(view);
      this.updateTrail(view, visuals);
      this.updateMarker(view, visuals);
    }
    for (const screen of this.screens.values()) {
      if (screen.stationId === stationId) this.paint(screen, view);
    }
  }

  /** Where a spring stand's mass is held before RUN, from its station's view (0 before it has one). */
  private heldOf(stationId: string): number {
    const view = this.game.stations.view(stationId);
    return view?.kind === 'spring' ? view.held : 0;
  }

  private createStation(view: LauncherView): StationVisuals {
    const { simulation } = view.definition;
    const capacity = Math.ceil(simulation.maxDuration / simulation.sampleInterval) + 2;
    const positions = new Float32Array(capacity * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setDrawRange(0, 0);
    const trail = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: ACCENT }));
    trail.frustumCulled = false; // its bounds change as it grows

    const marker = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.1, 0.16, 32),
      new THREE.MeshBasicMaterial({ color: AMBER, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.7, 8),
      new THREE.MeshStandardMaterial({ color: AMBER }),
    );
    post.position.y = 0.35;
    marker.add(ring, post);
    marker.visible = false;

    const tape = this.createTape(view);
    this.group.add(trail, marker, tape);
    const visuals: StationVisuals = { trail, positions, marker, tape, runId: null, drawn: 0 };
    this.stations.set(view.id, visuals);
    return visuals;
  }

  /** A floor tape along the lane with a mark every 0.5 m, numbered every metre from launch. */
  private createTape(
    view: LauncherView,
  ): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial> {
    const length = Math.max(1, Math.floor(view.lane));
    const width = 0.36;
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(MAX_PX, length * TAPE_PX_PER_M);
    // Across at the density along (the figures keep their shape); the layout was drawn 48 px high.
    canvas.height = Math.round(width * (canvas.width / length));
    const k = canvas.height / 48;
    const ctx = canvas.getContext('2d');
    const perMetre = canvas.width / length;
    if (ctx) {
      ctx.fillStyle = '#f2d75a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#1d2731';
      ctx.font = `600 ${20 * k}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      for (let half = 0; half <= length * 2; half++) {
        const x = Math.min(canvas.width - 2 * k, half * (perMetre / 2));
        const metre = half % 2 === 0;
        ctx.fillRect(x - k, 0, 2 * k, (metre ? 18 : 10) * k);
        if (metre && half > 0 && half < length * 2) ctx.fillText(String(half / 2), x, 42 * k);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4; // the preset may raise it (finishes.ts)
    const tape = new THREE.Mesh(
      new THREE.PlaneGeometry(length, width),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8 }),
    );
    // Flat on the floor, centred on the launch line, starting under the launch point.
    const start = view.toWorld(0, 0, this.point);
    const [dx, , dz] = view.direction;
    tape.rotation.order = 'YXZ';
    tape.rotation.set(-Math.PI / 2, Math.atan2(-dz, dx), 0);
    tape.position.set(
      start[0] + (dx * length) / 2,
      view.floor + 0.003,
      start[2] + (dz * length) / 2,
    );
    tape.receiveShadow = true;
    return tape;
  }

  /** New samples of the run are appended; a new run starts the trail again. */
  private updateTrail(view: LauncherView, visuals: StationVisuals): void {
    const run = view.session.run;
    const geometry = visuals.trail.geometry;
    if (!run) {
      visuals.runId = null;
      visuals.drawn = 0;
      geometry.setDrawRange(0, 0);
      return;
    }
    if (visuals.runId !== run.runId) {
      visuals.runId = run.runId;
      visuals.drawn = 0;
    }
    const xs = run.sampleValues[view.definition.measurements.findIndex((m) => m.id === 'x')];
    const ys = run.sampleValues[view.definition.measurements.findIndex((m) => m.id === 'y')];
    const count = Math.min(run.sampleCount, visuals.positions.length / 3);
    if (!xs || !ys || count === visuals.drawn) return;
    for (let i = visuals.drawn; i < count; i++) {
      const p = view.toWorld(xs[i] ?? 0, ys[i] ?? 0, this.point);
      visuals.positions[i * 3] = p[0];
      visuals.positions[i * 3 + 1] = p[1];
      visuals.positions[i * 3 + 2] = p[2];
    }
    visuals.drawn = count;
    geometry.setDrawRange(0, count);
    const attribute = geometry.getAttribute('position');
    attribute.needsUpdate = true;
  }

  private updateMarker(view: LauncherView, visuals: StationVisuals): void {
    const range =
      view.session.run?.status === 'completed' ? view.session.run.results?.range : undefined;
    visuals.marker.visible = range !== undefined;
    if (range === undefined) return;
    const p = view.toWorld(range, 0, this.point);
    visuals.marker.position.set(p[0], view.floor + 0.004, p[2]);
  }

  private clearStations(): void {
    for (const id of [...this.stations.keys()]) this.removeStation(id);
  }

  /** Frees one launcher station's trail, marker and tape (none: nothing happens). */
  private removeStation(stationId: string): void {
    const visuals = this.stations.get(stationId);
    if (!visuals) return;
    visuals.trail.removeFromParent();
    visuals.trail.geometry.dispose();
    visuals.trail.material.dispose();
    visuals.marker.removeFromParent();
    visuals.marker.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        (node.geometry as THREE.BufferGeometry).dispose();
        (node.material as THREE.Material).dispose();
      }
    });
    visuals.tape.removeFromParent();
    visuals.tape.geometry.dispose();
    visuals.tape.material.map?.dispose();
    visuals.tape.material.dispose();
    this.stations.delete(stationId);
  }

  // ---- screens ------------------------------------------------------------------------------

  private blank(screen: Screen): void {
    const { ctx, canvas } = screen;
    if (screen.kind === 'graph') {
      // The results screen is glass (reveal.ts, Phase T-1a): a dark see-through tint, a lit edge.
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(8, 22, 34, 0.62)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const line = Math.max(2, Math.round(canvas.width / 260));
      ctx.strokeStyle = '#8fd8ff';
      ctx.lineWidth = line;
      ctx.strokeRect(line / 2, line / 2, canvas.width - line, canvas.height - line);
    } else {
      ctx.fillStyle = '#0b1016';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    screen.texture.needsUpdate = true;
  }

  private paint(screen: Screen, view: StationView): void {
    this.blank(screen);
    if (screen.kind === 'status') this.paintStatus(screen, view);
    else this.paintGraph(screen, view);
    screen.texture.needsUpdate = true;
  }

  /** The desk display: state, parameters, live time, last results or why RUN would refuse. */
  private paintStatus({ ctx, canvas }: Screen, view: StationView): void {
    const { definition, session } = view;
    const { texts: t } = this.game;
    const run = session.run;
    const u = canvas.width / 100; // layout unit
    const footerY = canvas.height / u - FOOTER_UP;
    const state = session.state.toUpperCase();
    ctx.textBaseline = 'alphabetic';
    ctx.font = `700 ${3.6 * u}px system-ui, sans-serif`;
    const stateColor = { RUNNING: ACCENT, COMPLETED: GREEN, STOPPED: AMBER }[state] ?? DIM;
    const stateText = t.ui('desk.state', 'STATE: {state}', {
      state: stateName(session.state, t),
    });
    const stateWidth = ctx.measureText(stateText).width;
    ctx.fillStyle = stateColor;
    ctx.textAlign = 'right';
    ctx.fillText(stateText, 96 * u, 8 * u);
    ctx.textAlign = 'left';
    ctx.fillStyle = INK;
    // The title in what the state leaves of the row, 3 units clear of it.
    const titleWidth = 89 * u - stateWidth;
    fitTitle(ctx, t.of(definition, 'name').toUpperCase(), 4 * u, 8 * u, titleWidth, 5 * u, 3.4 * u);

    const inputs = run?.inputs ?? session.parameters;
    let y = 16 * u;
    let leftEnd = 0; // where the settings column's text ends, in layout units
    const row = 5 * u; // six rows (four dials, two apparatus inputs) clear the footer
    ctx.font = `600 ${4.2 * u}px system-ui, sans-serif`;
    // Values from 14, or 2 past the widest symbol ("pH_end"), so no symbol runs into its value.
    let valueX = 14;
    const widen = (symbol: string | undefined) => {
      if (symbol !== undefined) valueX = Math.max(valueX, 6 + ctx.measureText(symbol).width / u);
    };
    for (const p of definition.parameters) widen(p.symbol);
    // A hidden input (an unknown the student works out) is never on the desk.
    const supplied = shownInputs(definition);
    for (const [, shown] of supplied) {
      if (shown.desk !== false) widen(shown.symbol);
    }
    // A setting with no symbol is its value alone, from the left edge ("Wood on wood").
    const setting = (symbol: string | undefined, value: string, color: string) => {
      const x = symbol === undefined ? 4 : valueX;
      if (symbol !== undefined) {
        ctx.fillStyle = DIM;
        ctx.fillText(symbol, 4 * u, y);
      }
      ctx.fillStyle = color;
      ctx.fillText(value, x * u, y);
      leftEnd = Math.max(leftEnd, x + ctx.measureText(value).width / u);
      y += row;
    };
    for (const p of definition.parameters) {
      // A dial turned since the run shown is amber; the footer names what the run used.
      const turned = run !== null && inputs[p.id] !== session.parameters[p.id];
      const v = session.parameters[p.id] ?? NaN;
      // shortcut: a symbol-less parameter is named by its preset (all shipped ones have presets);
      // one without presets would show a bare number, give it a symbol then.
      const value = p.symbol === undefined ? parameterValue(p, v, t) : formatQuantity(v, p.unit);
      setting(p.symbol, value, turned ? AMBER : INK);
    }
    // What the apparatus supplied to the run (e.g. the launch height, the bob's mass).
    for (const [id, shown] of supplied) {
      const value = run?.inputs[id];
      if (value !== undefined && shown.desk !== false) {
        setting(shown.symbol, formatQuantity(value, shown.unit), INK);
      }
    }

    ctx.font = `600 ${4 * u}px system-ui, sans-serif`;
    if (run) {
      const results = run.status === 'completed' ? run.results : null;
      // The results once completed; before, a bench reads out its key values live.
      const lines = results
        ? resultSummary(definition, results, t)
        : view.kind === 'bench'
          ? deskReadings(definition, view.pose.sample, t)
          : [];
      // Only the rows above the footer (4 on the low display, 7 on the tall one); "…" says more
      // follow, all of them on the results monitor and in the results panel.
      const fit = Math.floor((footerY - FOOTER_LINE - ROWS_TOP) / ROW_PITCH) + 1;
      if (lines.length > fit) lines.splice(fit - 1, lines.length, ['…', '']);
      const width = (text: string) => ctx.measureText(text).width / u;
      const column = resultsColumn(
        lines.map(([label]) => width(label)),
        lines.map(([, value]) => width(value)),
        leftEnd,
      );
      ctx.fillStyle = INK;
      ctx.fillText(`t = ${run.time.toFixed(2)} s`, column.x * u, 16 * u);
      lines.forEach(([label, value], i) => {
        ctx.fillStyle = DIM;
        ctx.fillText(label, column.x * u, (ROWS_TOP + i * ROW_PITCH) * u);
        ctx.fillStyle = results ? GREEN : INK;
        ctx.fillText(value, column.valueX * u, (ROWS_TOP + i * ROW_PITCH) * u);
      });
    }
    ctx.font = `500 ${3.4 * u}px system-ui, sans-serif`;
    // No-break spaces keep each setting's value and unit together when the line wraps.
    const ranWith = run
      ? changedSettings(run, session.parameters, t).map((s) => s.replace(/ /g, '\u00a0'))
      : [];
    const footer =
      ranWith.length > 0
        ? {
            text: t.ui(
              'desk.ranWith',
              'The run shown used {settings}. RESET, then RUN with the new settings.',
              { settings: ranWith.join(', ') },
            ),
            color: AMBER,
          }
        : session.state === 'configured' && view.runBlock
          ? { text: view.runBlock, color: AMBER }
          : view.next < view.checklist.length
            ? {
                text: t.ui('desk.next', 'Next: {step}', {
                  step: view.checklist[view.next]?.instruction ?? '',
                }),
                color: DIM,
              }
            : {
                text: t.ui('desk.allDone', 'All steps done: change a dial, RESET and RUN again.'),
                color: DIM,
              };
    ctx.fillStyle = footer.color;
    wrap(ctx, footer.text, 4 * u, footerY * u, 92 * u, FOOTER_LINE * u);
  }

  /**
   * The results monitor: the experiment's monitor graph, live from the run's samples (the same
   * data as the results panel), with the theory's mark on the horizontal axis where it has one.
   */
  private paintGraph({ ctx, canvas }: Screen, view: StationView): void {
    const { definition, session } = view;
    const { texts: t } = this.game;
    const name = t.of(definition, 'name');
    const run = session.run;
    const graph =
      definition.graphs.find((g) => g.id === definition.monitor) ?? definition.graphs[0];
    const W = canvas.width;
    const H = canvas.height;
    const u = W / 100;
    ctx.fillStyle = INK;
    const title = graph ? `${name} — ${t.of(graph, 'title').toLowerCase()}` : name;
    fitTitle(ctx, title, 4 * u, 6 * u, 92 * u, 3.6 * u, 2.6 * u);
    if (!graph || !run || run.sampleCount === 0) {
      ctx.fillStyle = DIM;
      ctx.font = `500 ${3 * u}px system-ui, sans-serif`;
      ctx.fillText(
        definition.presentation === 'physical-lab'
          ? t.ui(
              'monitor.noRunPhysical',
              'No run yet: it starts when you add the first drop by hand.',
            )
          : t.ui('monitor.noRun', 'No run yet: set up the apparatus and press RUN on the desk.'),
        4 * u,
        14 * u,
      );
      return;
    }
    const data = graphFor(definition, run, graph, t);
    const mark =
      graph.mark === undefined || !theoryShown(definition) ? undefined : run.theory()?.[graph.mark];
    let top = 15 * u; // below the title and the results line
    const results = run.status === 'completed' ? run.results : null;
    if (results) {
      ctx.fillStyle = GREEN;
      ctx.font = `600 ${2.1 * u}px system-ui, sans-serif`;
      ctx.textAlign = 'left';
      const text = resultSummary(definition, results, t)
        .map(([label, value]) => `${label} ${value}`)
        .join('  ·  ');
      const lines = wrap(ctx, text, 4 * u, 10.5 * u, 92 * u, 2.7 * u);
      top += (lines - 1) * 2.7 * u;
    }
    let [x0, x1] = extent(data.x.values, data.count);
    if (mark !== undefined && Number.isFinite(mark)) {
      x0 = Math.min(x0, mark);
      x1 = Math.max(x1, mark);
    }
    let y0 = 0;
    let y1 = 0;
    for (const s of data.y) {
      const [lo, hi] = extent(s.values, data.count);
      y0 = Math.min(y0, lo);
      y1 = Math.max(y1, hi);
    }
    const ax = niceAxis(x0, x1);
    const ay = niceAxis(y0, y1);
    const left = 10 * u;
    const right = W - 4 * u;
    const bottom = H - 9 * u;
    const sx = scale(ax.min, ax.max, left, right);
    const sy = scale(ay.min, ay.max, bottom, top);
    ctx.strokeStyle = '#26323e';
    ctx.lineWidth = Math.max(1, 0.13 * u); // the grid's 1 px on a 1.2 m screen at 640 px/m, kept
    ctx.fillStyle = DIM;
    ctx.font = `500 ${2.4 * u}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    for (const t of ax.ticks) {
      line(ctx, sx(t), top, sx(t), bottom);
      ctx.fillText(tickLabel(t, ax.step), sx(t), bottom + 3.4 * u);
    }
    ctx.textAlign = 'right';
    for (const t of ay.ticks) {
      line(ctx, left, sy(t), right, sy(t));
      ctx.fillText(tickLabel(t, ay.step), left - 1.2 * u, sy(t) + 0.8 * u);
    }
    ctx.textAlign = 'left';
    ctx.fillText(data.xLabel, right - 9 * u, H - 1.5 * u);
    ctx.fillText(data.yLabel, 1 * u, top - 2 * u);
    data.y.forEach((s, k) => {
      ctx.strokeStyle = SERIES[k % SERIES.length] ?? ACCENT;
      ctx.lineWidth = 0.5 * u;
      ctx.beginPath();
      for (let i = 0; i < data.count; i++) {
        const px = sx(data.x.values[i] ?? 0);
        const py = sy(s.values[i] ?? 0);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      if (data.y.length > 1) {
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fillText(s.label, left + 2 * u + k * 10 * u, top + 3 * u);
      }
    });
    if (mark !== undefined && Number.isFinite(mark)) {
      // Where theory puts it (e.g. the landing), to compare with where the data ends.
      ctx.strokeStyle = AMBER;
      ctx.lineWidth = 0.3 * u;
      line(ctx, sx(mark), bottom - 3 * u, sx(mark), bottom + 0.5 * u);
    }
  }
}

/** A bench's key readings for its desk: its first two measured model variables (not the clock). */
export function deskReadings(
  definition: ExperimentDefinition,
  sample: BenchPose['sample'],
  t: Texts,
): [string, string][] {
  return definition.measurements
    .filter((m) => m.variable !== 'time')
    .slice(0, 2)
    .map((m) => [m.symbol ?? t.of(m, 'label'), formatQuantity(sample[m.variable] ?? NaN, m.unit)]);
}

/** A session's state as its desk screen names it, in capitals. */
function stateName(state: SessionState, t: Texts): string {
  switch (state) {
    case 'idle':
      return t.ui('desk.idle', 'IDLE');
    case 'configured':
      return t.ui('desk.configured', 'CONFIGURED');
    case 'running':
      return t.ui('desk.running', 'RUNNING');
    case 'stopped':
      return t.ui('desk.stopped', 'STOPPED');
    case 'completed':
      return t.ui('desk.completed', 'COMPLETED');
  }
}

function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

type TitleContext = Pick<CanvasRenderingContext2D, 'font' | 'measureText' | 'fillText'>;

/**
 * A screen's title within `width` from x, its baseline at y: at `size` if it fits, else smaller
 * down to `min`, else on two lines at `min` centred on y (each squeezed to `width` if still too
 * long). Never runs into what stands beside or below it (Phú, 2026-11-05: titles over the state).
 * Returns the lines drawn.
 */
export function fitTitle(
  ctx: TitleContext,
  text: string,
  x: number,
  y: number,
  width: number,
  size: number,
  min: number,
): number {
  ctx.font = `700 ${size}px system-ui, sans-serif`;
  const full = ctx.measureText(text).width;
  if (full <= width) {
    ctx.fillText(text, x, y);
    return 1;
  }
  const fitted = (size * width) / full;
  if (fitted >= min) {
    ctx.font = `700 ${fitted}px system-ui, sans-serif`;
    ctx.fillText(text, x, y);
    return 1;
  }
  ctx.font = `700 ${min}px system-ui, sans-serif`;
  const words = text.split(' ');
  let first = words[0] ?? '';
  let i = 1;
  for (; i < words.length; i++) {
    const next = `${first} ${words[i]}`;
    if (ctx.measureText(next).width > width) break;
    first = next;
  }
  const rest = words.slice(i).join(' ');
  if (!rest) {
    ctx.fillText(first, x, y, width);
    return 1;
  }
  const half = 0.6 * min;
  ctx.fillText(first, x, y - half, width);
  ctx.fillText(rest, x, y + half, width);
  return 2;
}

/** Word-wrapped text starting at (x, y), at most `width` wide; returns the lines drawn. */
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  lineHeight: number,
): number {
  let lineText = '';
  let row = y;
  let lines = 0;
  for (const word of text.split(' ')) {
    const next = lineText ? `${lineText} ${word}` : word;
    if (ctx.measureText(next).width > width && lineText) {
      ctx.fillText(lineText, x, row);
      lines++;
      lineText = word;
      row += lineHeight;
    } else {
      lineText = next;
    }
  }
  if (lineText) {
    ctx.fillText(lineText, x, row);
    lines++;
  }
  return lines;
}
