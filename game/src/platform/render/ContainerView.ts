import * as THREE from 'three';
import type { BenchPose, StationView } from '../../gameplay/experiment/StationSystem';
import type { ContainerDefinition } from '../../gameplay/item';
import { pointOf } from '../../gameplay/lab/pour';
import type { Quat, Vec3 } from '../../core/math';
import {
  type ContainerState,
  heldBelow,
  levelIn,
  type Profile,
  totalUl,
  UL_PER_ML,
} from '../../simulation/liquid';
import type { WorldEntity } from '../../world/World';
import { appearanceOf, type LiquidAppearance, type LiquidInput, tintOf } from './liquidAppearance';
import { GLASSWARE_LOOK, LOOKS, liquidLook, transmit } from './looks';
import { PRINT_COLOR, SQUARE_SCALE, VesselKit } from './vessels';

/**
 * Containers of the physical lab, drawn only from their state (`docs/physical-lab-architecture.md`
 * §2.13). A container's glass and liquid are two lathes built once per profile and shared by every
 * item with it; nothing is built or rebuilt while liquid moves. The liquid is its inside clipped by
 * a horizontal plane in world space at the height the profile gives its volume (`levelIn`, the
 * mapping the 2D chemistry visuals use), plus a surface disc at that height, kept flat in the
 * world as the glass tilts. The level is exact for an upright vessel; a tilted one is drawn at
 * the upright height measured along its axis — a drawing only, it never feeds a number. Colour
 * comes only from the model's state (liquidAppearance.ts). The views poll each container's
 * `version`; the stream is one shared mesh drawn only while liquid is moving.
 */

/** The state side: read-only (`StationSystem` is the only writer). */
export interface ContainerSource {
  container(entityId: string): Readonly<ContainerState> | null;
  /** Grows on every write to the container; the view redraws when it moves. */
  containerVersion(entityId: string): number;
  view(stationId: string): StationView | null;
  /** Whether a burette's tap is open (its key drawn in line with the bore). */
  tapOpen?(entityId: string): boolean;
  /** The open tap running now, from which burette into which vessel, or null. */
  tapping?(): { readonly from: string; readonly to: string } | null;
}

/** Which held source pours into which receiver (the pour that was accepted), or null. */
export interface PourSource {
  readonly pouringFrom: string | null;
  readonly pouringInto: string | null;
}

export interface ContainerViewDeps {
  source: ContainerSource;
  pour: PourSource;
  /** The name printed on a reagent bottle's label (the item's display name, in the language). */
  nameOf?: (entity: WorldEntity) => string;
}

/** What a profile gives, shared by every item with it. */
export interface Shape {
  readonly profile: Profile;
  /** mL held below each profile point. */
  readonly held: Float64Array;
  /** The glass (outside, rim, inside) and the liquid (the inside, open at the top). */
  readonly glass: THREE.BufferGeometry;
  readonly liquid: THREE.BufferGeometry;
  /** Across the widest part of the inside (m): the path the colour is seen across. */
  readonly width: number;
  /** Square in section (a cuvette): 4 segments, the same area as the profile's circle. */
  readonly square: boolean;
}

/** Glass wall (m) and the liquid's gap to it. */
export const WALL = 0.0015;
const INSET = 0.0003;
const SEGMENTS = 32;
/** The stream's radius (m), its fall below the spout to a vessel with nothing in it (m). */
const STREAM_RADIUS = 0.003;
/** A burette's stream (m): 0.25 mL/s runs as a thin thread from its tip. */
const TAP_STREAM_RADIUS = 0.0009;
/** Seconds the stream stays drawn after the last write to the source (a pour writes every step). */
const STREAM_HOLD_S = 0.12;
/** Seconds between looks for a station that is not there yet. */
const RETRY_S = 0.5;
/** Glass finishes: the water the stream is drawn from (linear). */
const WATER: readonly [number, number, number] = [0.74, 0.82, 0.87];
/**
 * The liquid body's own dimming of what is behind it (linear), whatever its colour: even clear
 * water bends and reflects some light, so the liquid stands out from its glass. A look value; the
 * colour itself comes only from the model (`tintOf`).
 */
export const LIQUID_BODY: readonly [number, number, number] = [0.9, 0.94, 0.96];
/**
 * The meniscus: where the surface curves up the wall, a band as tall as water's capillary length
 * (≈ 2.7 mm), seen edge-on where the flat surface is not. Two-toned so the level reads on any
 * background: light on top (the curve reflecting the room, lit), dark below (the light it bends
 * away). Look values; the level itself comes only from the volume.
 */
const MENISCUS_HEIGHT = 0.0027;
const MENISCUS_LIGHT = new THREE.Color('#eef4f6');
const MENISCUS_DARK = new THREE.Color('#1f282d');

/** An open band round the wall (unit radius, from the level down), light on top, dark below. */
function meniscusBand(segments: number): THREE.BufferGeometry {
  const band = new THREE.CylinderGeometry(1, 1, MENISCUS_HEIGHT, segments, 2, true).translate(
    0,
    -MENISCUS_HEIGHT / 2,
    0,
  );
  const position = band.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  for (let k = 0; k < position.count; k++) {
    const top = position.getY(k) > -MENISCUS_HEIGHT / 4;
    (top ? MENISCUS_LIGHT : MENISCUS_DARK).toArray(colors, k * 3);
  }
  band.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return band;
}

/**
 * Where the profile's liquid-side lathe stands: the glass, then the inside, built once. A square
 * one (a cuvette) has 4 segments scaled so its section has the circle's area (the level mapping
 * stays exact), turned square to the item's axes.
 */
function lathe(
  points: readonly (readonly [number, number])[],
  square = false,
): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(
    points.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y)),
    square ? 4 : SEGMENTS,
  );
  if (square) g.rotateY(Math.PI / 4).scale(SQUARE_SCALE, 1, SQUARE_SCALE);
  // three's lathe leaves its last ring's normals unnormalised.
  const normal = g.getAttribute('normal');
  const n = new THREE.Vector3();
  for (let k = 0; k < normal.count; k++) {
    n.fromBufferAttribute(normal, k).normalize();
    normal.setXYZ(k, n.x, n.y, n.z);
  }
  return g;
}

/** The glass: up its outside from the floor, over the rim, down its inside. */
export function glassPoints(profile: Profile): [number, number][] {
  const first = profile[0] ?? [0, 0];
  const last = profile[profile.length - 1] ?? first;
  return [
    [0, first[1] - WALL],
    [first[0] + WALL, first[1] - WALL],
    ...profile.slice(1).map(([r, y]): [number, number] => [r + WALL, y]),
    [last[0] + WALL, last[1]],
    ...[...profile].reverse().map(([r, y]): [number, number] => [r, y]),
    [0, first[1]],
  ];
}

/** The liquid's inside: closed at the floor, open at the top (the level plane cuts it). */
export function liquidPoints(profile: Profile): [number, number][] {
  const first = profile[0] ?? [0, 0];
  // Off the floor by the same gap as off the walls: a liquid floor on the glass's own inner floor
  // fights it for depth (a saw-tooth seen through the glass).
  const floor = first[1] + INSET;
  return [
    ...(first[0] > INSET ? [[0, floor] as [number, number]] : []),
    ...profile.map(([r, y]): [number, number] => [Math.max(r - INSET, 0), Math.max(y, floor)]),
  ];
}

/** Everything a profile gives (geometry included: the caller shares and frees it). */
export function shapeOf(profile: Profile, square = false): Shape {
  let widest = 0;
  for (const [r] of profile) widest = Math.max(widest, r);
  return {
    profile,
    held: heldBelow(profile),
    glass: lathe(glassPoints(profile), square),
    liquid: lathe(liquidPoints(profile), square),
    width: 2 * widest,
    square,
  };
}

/** The height (m, item frame) and inside radius at which the profile holds `ul` µL. */
export function levelOf(shape: Shape, ul: number, out: { y: number; r: number }): void {
  levelIn(shape.profile, shape.held, ul / UL_PER_ML, out);
}

/** A station's live side of one container, once found. */
interface Reading {
  readonly pose: BenchPose | null;
  readonly appearance: LiquidAppearance | undefined;
  readonly input: LiquidInput;
}

interface Entry {
  readonly id: string;
  readonly group: THREE.Group;
  readonly def: ContainerDefinition;
  readonly shape: Shape | null;
  readonly axis: readonly [number, number];
  readonly body: THREE.Mesh | null;
  readonly cap: THREE.Mesh | null;
  /** Shown only while closed: a stopper or a cap. */
  readonly closedParts: readonly THREE.Object3D[];
  /** A burette's stopcock key, open and shut (shown by its tap's state). */
  readonly tapOpen: readonly THREE.Object3D[];
  readonly tapShut: readonly THREE.Object3D[];
  /** A bench rig's readout, shown only while this (receiver-only) container holds a sample. */
  readonly reading: THREE.Object3D | null;
  readonly look: ReturnType<typeof liquidLook>;
  readonly plane: THREE.Plane;
  readonly extras: THREE.Object3D[];
  /** The placement it names as its station (entity id), if any. */
  readonly named: string | null;
  readonly lvl: { y: number; r: number };
  readonly tint: [number, number, number];
  version: number;
  state: Readonly<ContainerState> | null;
  ul: number;
  /** What the colour was last made from (NaN is a value: no reading); undefined: not yet. */
  absorbance: number | undefined;
  station: Reading | null;
  retry: number;
}

export class ContainerViews {
  /** The shared pour stream: add this to the scene. */
  readonly group = new THREE.Group();
  private readonly entries = new Map<string, Entry>();
  private readonly list: Entry[] = [];
  private readonly shapes = new Map<string, Shape>();
  private built = 0;
  private readonly glassMaterial = new THREE.MeshStandardMaterial({
    color: '#cfe8f0',
    ...GLASSWARE_LOOK,
    depthWrite: false,
  });
  private readonly markMaterial = new THREE.MeshStandardMaterial({
    color: PRINT_COLOR,
    ...LOOKS.satin,
  });
  private readonly kit = new VesselKit();
  private readonly unitCircle = new THREE.CircleGeometry(1, SEGMENTS).rotateX(-Math.PI / 2);
  private readonly unitSquare = new THREE.CircleGeometry(1, 4)
    .rotateZ(Math.PI / 4)
    .rotateX(-Math.PI / 2)
    .scale(SQUARE_SCALE, 1, SQUARE_SCALE);
  private readonly unitRing = new THREE.CylinderGeometry(1, 1, 1, SEGMENTS, 1, true);
  /** The level's meniscus: a band round the wall under the surface, at the surface's own scale. */
  private readonly meniscusRound = meniscusBand(SEGMENTS);
  private readonly meniscusSquare = meniscusBand(4)
    .rotateY(Math.PI / 4)
    .scale(SQUARE_SCALE, 1, SQUARE_SCALE);
  private readonly meniscusMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.6,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  private readonly unitPlug = new THREE.CylinderGeometry(1, 0.82, 1, 16);
  private readonly streamGeometry = new THREE.CylinderGeometry(1, 0.6, 1, 10, 1, true).translate(
    0,
    -0.5,
    0,
  );
  private readonly streamMaterial = new THREE.MeshStandardMaterial({
    ...LOOKS.glass,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
  });
  private readonly stream = new THREE.Mesh(this.streamGeometry, this.streamMaterial);
  private streamFrom: string | null = null;
  private streamVersion = -1;
  private streamUntil = -1;
  private clock = 0;
  // Reused by every frame: nothing is allocated there.
  private readonly position: Vec3 = [0, 0, 0];
  private readonly rotation: Quat = [0, 0, 0, 1];
  private readonly spout: Vec3 = [0, 0, 0];
  private readonly local = new THREE.Vector3();
  private readonly through: [number, number, number] = [1, 1, 1];

  constructor(private readonly deps: ContainerViewDeps) {
    this.stream.visible = false;
    this.stream.renderOrder = 3;
    this.stream.castShadow = false;
    this.stream.frustumCulled = false; // scaled and moved every frame
    this.group.add(this.stream);
  }

  /** Geometries built so far for profiles: constant once every container has been seen. */
  get geometriesBuilt(): number {
    return this.built;
  }

  /**
   * Draws the entity's container inside its view group, from its state: its glass (unless a prop
   * is its glass), liquid, volume mark and stopper. True when it drew the glass, so the entity's
   * own box is hidden. The caller applies the graphics preset (finishes.ts) to the group after.
   */
  mount(entity: WorldEntity, group: THREE.Group, box: THREE.Mesh): boolean {
    const def = entity.item.container;
    if (!def || this.entries.has(entity.id)) return false;
    const shape = def.profile ? this.shapeFor(def.profile, def.vessel === 'cuvette') : null;
    const drawGlass = shape !== null && !entity.item.visual.prop;
    const axis: [number, number] = [def.mouth?.center[0] ?? 0, def.mouth?.center[2] ?? 0];
    const look = liquidLook();
    const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    const extras: THREE.Object3D[] = [];
    const add = (object: THREE.Object3D, order = object.renderOrder) => {
      object.renderOrder = order;
      object.traverse((node) => {
        node.castShadow = false;
      });
      group.add(object);
      extras.push(object);
      return object;
    };

    let body: THREE.Mesh | null = null;
    let cap: THREE.Mesh | null = null;
    if (shape) {
      if (drawGlass) {
        // A wash bottle is polyethylene, not glass: translucent white, no glassware finish.
        const wall = def.vessel === 'wash-bottle' ? this.kit.bottle : this.glassMaterial;
        const glass = new THREE.Mesh(shape.glass, wall);
        glass.name = 'glass';
        glass.position.set(axis[0], 0, axis[1]);
        add(glass, 2);
        // The ring on the neck that marks the volume of volumetric glassware.
        const mark = def.fillLimitMl;
        if (mark !== undefined && mark < def.capacityMl * 0.999) {
          const at = { y: 0, r: 0 };
          levelIn(shape.profile, shape.held, mark, at);
          const ring = new THREE.Mesh(this.unitRing, this.markMaterial);
          const radius = at.r + WALL + 0.0004;
          ring.name = 'mark';
          ring.scale.set(radius, 0.0012, radius);
          ring.position.set(axis[0], at.y, axis[1]);
          add(ring, 2);
        }
      }
      look.filter.side = THREE.DoubleSide;
      look.filter.clippingPlanes = [plane];
      body = new THREE.Mesh(shape.liquid, look.filter);
      body.name = 'liquid';
      body.position.set(axis[0], 0, axis[1]);
      body.visible = false;
      add(body, 1);
      // Its edge's reflection of the room: the same shell, lit, added (clear water on a dark ground).
      look.rim.clippingPlanes = [plane];
      const rim = new THREE.Mesh(shape.liquid, look.rim);
      rim.name = 'liquid-rim';
      rim.renderOrder = 2;
      rim.castShadow = false;
      body.add(rim);
      cap = new THREE.Mesh(shape.square ? this.unitSquare : this.unitCircle, look.sheen);
      cap.name = 'liquid-surface';
      cap.visible = false;
      add(cap, 1);
      // The level reads as a line, as a real meniscus does: it moves only with the cap (the volume).
      const meniscus = new THREE.Mesh(
        shape.square ? this.meniscusSquare : this.meniscusRound,
        this.meniscusMaterial,
      );
      meniscus.name = 'meniscus';
      meniscus.renderOrder = 2;
      cap.add(meniscus);
    }

    // The vessel's own parts (render/vessels.ts); a plain plug for a closable vessel without one.
    const fittings = this.kit.build(def, this.deps.nameOf?.(entity) ?? entity.item.displayName);
    for (const part of fittings.fixed) add(part);
    const closedParts = [...fittings.closed];
    if (def.closable && def.mouth && closedParts.length === 0) {
      const { center, radius } = def.mouth;
      const r = radius + WALL + 0.0005;
      const plug = new THREE.Mesh(this.unitPlug, this.kit.stopper);
      plug.name = 'stopper';
      plug.scale.set(r, 0.02, r);
      plug.position.set(center[0], center[1] + 0.004, center[2]);
      closedParts.push(plug);
    }
    for (const part of closedParts) {
      part.visible = false;
      add(part, 2);
    }
    for (const part of fittings.tapOpen) {
      part.visible = false;
      add(part, 2);
    }
    for (const part of fittings.tapShut) add(part, 2);

    const entry: Entry = {
      id: entity.id,
      group,
      def,
      shape,
      axis,
      body,
      cap,
      closedParts,
      tapOpen: fittings.tapOpen,
      tapShut: fittings.tapShut,
      reading: group.getObjectByName('reading') ?? null,
      look,
      plane,
      extras,
      named:
        typeof entity.params.station === 'string'
          ? `${entity.roomId}/${entity.params.station}`
          : null,
      lvl: { y: 0, r: 0 },
      tint: [1, 1, 1],
      version: -1,
      state: null,
      ul: 0,
      absorbance: undefined,
      station: null,
      retry: 0,
    };
    this.entries.set(entity.id, entry);
    this.list.push(entry);
    this.sync(entry);
    // The box stands in for the vessel, unless it is a bench's body (a colorimeter's case: its
    // cuvette is the container drawn here, the case is the entity's mesh).
    if (drawGlass && !entity.item.bench) box.visible = false;
    return drawGlass;
  }

  /** Frees the entity's own materials (the shared geometry stays with the profile). */
  unmount(entityId: string): void {
    const entry = this.entries.get(entityId);
    if (!entry) return;
    this.entries.delete(entityId);
    this.list.splice(this.list.indexOf(entry), 1);
    for (const object of entry.extras) object.removeFromParent();
    entry.look.filter.dispose();
    entry.look.rim.dispose();
    entry.look.sheen.dispose();
    if (this.streamFrom === entityId) this.stream.visible = false;
  }

  /** Every frame: redraws what a changed container needs, moves the level planes, the stream. */
  update(dt: number): void {
    this.clock += dt;
    for (const entry of this.list) this.step(entry, dt);
    this.flow();
  }

  dispose(): void {
    for (const id of [...this.entries.keys()]) this.unmount(id);
    for (const shape of this.shapes.values()) {
      shape.glass.dispose();
      shape.liquid.dispose();
    }
    this.shapes.clear();
    for (const g of [
      this.unitCircle,
      this.unitSquare,
      this.unitRing,
      this.meniscusRound,
      this.meniscusSquare,
      this.unitPlug,
      this.streamGeometry,
    ]) {
      g.dispose();
    }
    for (const m of [
      this.glassMaterial,
      this.markMaterial,
      this.meniscusMaterial,
      this.streamMaterial,
    ]) {
      m.dispose();
    }
    this.kit.dispose();
    this.group.removeFromParent();
  }

  private shapeFor(profile: Profile, square: boolean): Shape {
    const key = (square ? 'square:' : '') + profile.map(([r, y]) => `${r},${y}`).join(';');
    let shape = this.shapes.get(key);
    if (!shape) {
      shape = shapeOf(profile, square);
      this.shapes.set(key, shape);
      this.built += 2;
    }
    return shape;
  }

  /** Reads the container's state into the drawn parts (when its version moved). */
  private sync(e: Entry): void {
    const { source } = this.deps;
    e.version = source.containerVersion(e.id);
    e.state = source.container(e.id);
    const state = e.state;
    e.ul = state ? totalUl(state.contents) : 0;
    for (const part of e.closedParts) part.visible = state?.closed === true;
    if (e.reading) e.reading.visible = e.ul > 0;
    const { shape, body, cap } = e;
    if (!shape || !body || !cap) return;
    const filled = e.ul > 0;
    body.visible = filled;
    cap.visible = filled;
    if (!filled) return;
    levelOf(shape, e.ul, e.lvl);
    const r = Math.max(e.lvl.r - INSET, 0);
    cap.scale.set(r, 1, r);
    cap.position.set(e.axis[0], e.lvl.y, e.axis[1]);
    e.absorbance = undefined; // redrawn with the new contents
  }

  private step(e: Entry, dt: number): void {
    if (this.deps.source.containerVersion(e.id) !== e.version) this.sync(e);
    if (e.tapShut.length > 0) {
      const open = this.deps.source.tapOpen?.(e.id) === true;
      for (const part of e.tapOpen) part.visible = open;
      for (const part of e.tapShut) part.visible = !open;
    }
    if (e.ul <= 0 || !e.shape || !e.body || !e.cap || !e.state) return;
    // The level plane in the world: horizontal, through the axis point at the drawn height.
    const g = e.group;
    this.local.set(e.axis[0], e.lvl.y, e.axis[1]).applyQuaternion(g.quaternion);
    e.plane.constant = g.position.y + this.local.y;
    e.cap.quaternion.copy(g.quaternion).invert(); // flat in the world
    // The colour, from the model's state; looked for until the station is there.
    const reading = e.station ?? this.station(e, dt);
    const through = reading?.appearance?.transmittance !== undefined;
    const a = !reading
      ? 0 // no station: no model to colour it
      : through
        ? this.transmittanceOf(e, reading)
        : this.absorbanceOf(e, reading, e.shape.width);
    if (!Object.is(a, e.absorbance)) {
      e.absorbance = a;
      if (through) {
        // The whole path's light left (NaN: no reading, clear); each face of the shell takes √.
        for (let i = 0; i < 3; i++) {
          e.tint[i] = Number.isNaN(a) ? 1 : Math.sqrt(this.through[i] ?? 1);
        }
      } else tintOf(reading?.appearance, a, e.tint);
      transmit(
        e.look.filter,
        e.tint[0] * LIQUID_BODY[0],
        e.tint[1] * LIQUID_BODY[1],
        e.tint[2] * LIQUID_BODY[2],
      );
    }
  }

  /** What a transmittance look made the colour from (`through` holds it); NaN: no reading. */
  private transmittanceOf(e: Entry, reading: Reading): number {
    const { input, appearance, pose } = reading;
    input.contents = e.state?.contents ?? input.contents;
    if (pose) {
      input.sample = pose.sample;
      input.parameters = pose.parameters;
    }
    return appearance?.transmittance?.(input, this.through) ?? 0;
  }

  private absorbanceOf(e: Entry, reading: Reading, width: number): number {
    const { input, appearance, pose } = reading;
    if (!appearance) return 0;
    input.contents = e.state?.contents ?? input.contents;
    if (pose) {
      input.sample = pose.sample;
      input.parameters = pose.parameters;
    }
    return appearance.absorbance(input, width);
  }

  /** Finds the station this container belongs to (itself, else the placement it names). */
  private station(e: Entry, dt: number): Reading | null {
    e.retry -= dt;
    if (e.retry > 0) return null;
    e.retry = RETRY_S;
    const { source } = this.deps;
    const view = source.view(e.id) ?? (e.named === null ? null : source.view(e.named));
    if (!view) return null;
    const sets = new Map<string, { parameter: string; value: number }>();
    for (const m of view.definition.workspace?.materials ?? []) {
      if (m.sets) sets.set(m.id, m.sets);
    }
    const input: LiquidInput = {
      contents: {},
      sample: {},
      parameters: {},
      sets: (id) => sets.get(id),
    };
    e.station = {
      pose: view.kind === 'bench' ? view.pose : null,
      appearance: appearanceOf(view.definition.model),
      input,
    };
    return e.station;
  }

  /** The stream between a pouring source's spout and the surface of its receiver. */
  private flow(): void {
    const { pour, source } = this.deps;
    const tap = pour.pouringFrom === null ? (source.tapping?.() ?? null) : null;
    const from = tap ? tap.from : pour.pouringFrom;
    const to = tap ? tap.to : pour.pouringInto;
    const src = from === null ? undefined : this.entries.get(from);
    const dst = to === null ? undefined : this.entries.get(to);
    const spout = tap ? src?.def.tap?.tip : src?.def.pour?.spout;
    if (!src || !dst || !spout) {
      this.stream.visible = false;
      this.streamFrom = null;
      return;
    }
    // Liquid moves while the source's state keeps being written (every step of a pour).
    const version = source.containerVersion(src.id);
    if (src.id !== this.streamFrom || version !== this.streamVersion) {
      this.streamFrom = src.id;
      this.streamVersion = version;
      this.streamUntil = this.clock + STREAM_HOLD_S;
    }
    const moving = this.clock < this.streamUntil;
    this.stream.visible = moving;
    if (!moving) return;
    src.group.position.toArray(this.position);
    src.group.quaternion.toArray(this.rotation);
    pointOf(this.position, this.rotation, spout, this.spout);
    let floor: number;
    if (dst.ul > 0) floor = dst.plane.constant;
    else {
      const bottom = dst.shape?.profile[0]?.[1] ?? 0;
      this.local.set(dst.axis[0], bottom, dst.axis[1]).applyQuaternion(dst.group.quaternion);
      floor = dst.group.position.y + this.local.y;
    }
    this.stream.position.set(this.spout[0], this.spout[1], this.spout[2]);
    const radius = tap ? TAP_STREAM_RADIUS : STREAM_RADIUS;
    this.stream.scale.set(radius, Math.max(this.spout[1] - floor, 0.001), radius);
    // The water, through whatever the source holds.
    const t = src.tint;
    this.streamMaterial.color.setRGB(
      WATER[0] * t[0] * t[0],
      WATER[1] * t[1] * t[1],
      WATER[2] * t[2] * t[2],
      THREE.LinearSRGBColorSpace,
    );
  }
}
