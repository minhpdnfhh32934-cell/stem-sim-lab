import * as THREE from 'three';
import type { PrepareReal } from '../body/realBody';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Game } from '../../../game/Game';
import {
  type EmergencyPhase,
  ROPES,
  type ResponderView,
} from '../../../gameplay/emergency/EmergencySystem';
import type { ResponderSquad } from '../../../gameplay/emergency/squad';
import { daylight } from '../../../world/clock';
import { Actor } from '../body/actor';
import type { Gesture, PersonView } from '../body/person';
import type { ContactShadows } from '../contactShadows';
import { Particles } from '../particles';
import { QUALITY } from '../quality';
import { CeilingBreach } from './breach';
import { arrivalRoom, type HungPlacement, hungUnder } from '../../../gameplay/emergency/hung';
import { type Hung, HungFall } from './fall';
import { Helicopter, ROPE_TOP } from './helicopter';

/** What the renderer lends this view. */
export interface EmergencyViewDeps {
  /** Room `roomId`'s ceiling box as drawn now, or null. */
  ceilingOf(roomId: string): THREE.Mesh | null;
  /** Hides a world object where it stands, or shows it again (the fittings round the hole). */
  hide(entityId: string, hidden: boolean): void;
  /**
   * A copy of a world object as drawn (its geometries and materials shared), at its place in the
   * world, to be moved on its own (the fall: `HungFall`); null where it is not drawn.
   */
  copyOf(entityId: string): THREE.Object3D | null;
  /** The sky's colour now (the hub's clerestories). */
  sky(): THREE.Color;
  /** Compiles these objects' shaders now, off the frame where they first show (hidden ones too). */
  prepare(objects: readonly THREE.Object3D[]): void;
}

type Writable<T> = { -readonly [K in keyof T]: T[K] };

/** Water from a lance, by preset (particles a second, each firefighter). */
const WATER_PER_S = { low: 50, medium: 120, high: 170, ultra: 240 } as const;
/** How far behind their rope a body hangs (m): the rope runs in front of them, between the hands. */
const ROPE_GAP = 0.24;
/** The slap: winding up, then across (s). */
const WIND_S = 0.3;
const SWING_S = 0.16;
const HOVERING: ReadonlySet<EmergencyPhase> = new Set([
  'breach',
  'rappel',
  'mission',
  'regroup',
  'ascend',
]);

interface Member {
  readonly actor: Actor;
  readonly person: Writable<PersonView>;
  readonly key: string;
  readonly lance: THREE.Group | null;
  /** When their slap began (s, this view's clock), or −1. */
  hitAt: number;
  /** On their rope (1) or off it (0), eased: where they are drawn and which way they face. */
  rope: number;
  crouch: number;
  water: number;
  steam: number;
}

/**
 * The emergency call drawn (Phú 2026-11-13): the squad's helicopter, its ropes, the hub's ceiling
 * blown open and mended (`CeilingBreach`), and the four responders — their own bodies and uniforms
 * with a helmet, an air tank or a radio, their squad's name on their backs — sliding down, running,
 * spraying, asking, slapping, climbing back. Reads `game.emergency` only; everything it makes is
 * made when a call starts and freed when it ends.
 */
export class EmergencyView {
  /** Where a real person that did not load is reported (Max). */
  private readonly warn = (message: string) => this.game.log.warn(message);
  /** Makes a real person ready before it is shown (WorldRenderer), or none. */
  prepareReal: PrepareReal | null = null;
  private readonly group = new THREE.Group();
  private squad: ResponderSquad | null = null;
  private helicopter: Helicopter | null = null;
  /** Made at the first call (nothing of it is in the scene before), kept for the next. */
  private breach: CeilingBreach | null = null;
  private readonly members: Member[] = [];
  private readonly shadow = new THREE.MeshBasicMaterial({ colorWrite: false });
  private readonly ropes: THREE.Mesh[] = [];
  private readonly coils: THREE.Mesh[] = [];
  private readonly ropeGeometry = new THREE.CylinderGeometry(0.019, 0.019, 1, 6, 1, true).translate(
    0,
    -0.5,
    0,
  );
  private readonly coilGeometry = new THREE.TorusGeometry(0.22, 0.022, 6, 22).rotateX(Math.PI / 2);
  private ropeMaterial: THREE.MeshStandardMaterial | null = null;
  /** What the gear is made of, freed with the squad. */
  private readonly gear = {
    geometries: [] as THREE.BufferGeometry[],
    materials: [] as THREE.Material[],
    textures: [] as THREE.Texture[],
  };
  private readonly water = new Particles(1400, '#e3f1fb', false, {
    opacity: 0.5,
    grow: 3.2,
    lift: -6,
    drag: 0.5,
  });
  private readonly steam = new Particles(500, '#f4f5f6', false, {
    opacity: 0.38,
    grow: 2.2,
    lift: 0.9,
    drag: 0.8,
    air: 0.6,
  });
  /** Ultra's steam off a fire (`effects`): billows of mist, white, thinning as they rise. */
  private readonly wisps = new Particles(500, '#f4f5f6', false, {
    opacity: 0.3,
    grow: 2.6,
    lift: 0.9,
    drag: 0.8,
    air: 0.6,
    shape: 'puff',
    ramp: ['#ffffff', '#eef1f3', '#dde2e6'],
  });
  /** The hole's room (its ceiling), and the fittings hidden while it is open. */
  private roomId: string | null = null;
  private hidden: string[] = [];
  /** What hangs under the hole (items `visual.hanging`): it falls at the blast (`HungFall`). */
  private hung: HungPlacement[] = [];
  private readonly fall = new HungFall();
  /** What fell: its copy (moved), its world object hidden meanwhile. */
  private fallen: { id: string; copy: THREE.Object3D }[] = [];
  private open = false;
  private hover = 0;
  private searching = 0;
  private time = 0;
  /** The stun filter last set on the canvas (−1: none yet). */
  private stunKey = -1;
  private readonly anchor = new THREE.Vector3();
  private readonly hand = new THREE.Vector3();
  private readonly tip = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly look = { x: 0, z: 0 };

  constructor(
    parent: THREE.Object3D,
    private readonly game: Game,
    private readonly contact: ContactShadows,
    private readonly deps: EmergencyViewDeps,
  ) {
    this.group.name = 'emergency';
    parent.add(this.group);
    this.group.add(this.water.points, this.steam.points, this.wisps.points, this.fall.group);
  }

  update(dt: number, heightPx: number, fovDeg: number): void {
    this.time += dt;
    const e = this.game.emergency;
    if (e.squad !== this.squad) {
      this.teardown();
      if (e.squad) this.setup(e.squad);
    }
    const squad = this.squad;
    this.water.setView(heightPx, fovDeg);
    this.steam.setView(heightPx, fovDeg);
    this.wisps.setView(heightPx, fovDeg);
    if (!squad) {
      this.water.update(dt);
      this.steam.update(dt);
      this.wisps.update(dt);
      this.breach?.update(dt, this.time, 0, -1, 0, this.deps.sky(), 0, 0, heightPx, fovDeg);
      return;
    }
    const at = this.game.scenes.offsetOf(squad.arrival.scene);
    const hovering = HOVERING.has(e.phase) && e.heli.visible;
    const k = Math.min(1, dt * 1.5);
    this.hover += ((hovering ? 1 : 0) - this.hover) * k;
    this.searching +=
      ((hovering && e.phase !== 'mission' ? 1 : hovering ? 0.6 : 0) - this.searching) * k;
    const day = daylight(this.game.state.world.clockS);
    if (at && this.helicopter) {
      this.helicopter.update(
        e.heli,
        at[0],
        at[1],
        at[2],
        dt,
        this.time,
        this.searching * (0.45 + 0.55 * (1 - day)),
      );
    } else if (this.helicopter) this.helicopter.group.visible = false;
    this.ceiling(at, e.breach, e.blast);
    this.drop(at, e.breach, e.blast, dt);
    this.breach?.update(
      dt,
      this.time,
      e.breach,
      e.blast,
      at?.[1] ?? 0,
      this.deps.sky(),
      day,
      this.hover,
      heightPx,
      fovDeg,
    );
    this.hang(at, e.ropes, e.phase);
    for (let i = 0; i < this.members.length; i++) {
      const member = this.members[i];
      const view = e.views[i];
      if (member && view) this.pose(member, view, i, dt, squad);
    }
    this.water.update(dt);
    this.steam.update(dt);
    this.wisps.update(dt);
  }

  /**
   * The camera shaken by the blast (less the farther from it) or by a slap: a few centimetres and
   * a fraction of a degree, quick and settling.
   */
  shake(camera: THREE.Camera): void {
    const e = this.game.emergency;
    const s = e.stun;
    if (s > 0.001) {
      // Dazed: the head swaying slowly, out of step on each axis.
      const t = this.time;
      camera.rotation.z += s * 0.06 * Math.sin(t * 1.1);
      camera.rotation.x += s * 0.03 * Math.sin(t * 0.73 + 1);
      camera.rotation.y += s * 0.025 * Math.sin(t * 0.51 + 2);
    }
    if (e.shake <= 0.001) return;
    let k = e.shake * e.shake;
    const at = this.squad ? this.game.scenes.offsetOf(this.squad.arrival.scene) : null;
    if (this.squad && at && e.blast >= 0 && e.blast < 2.5) {
      const [ax, az] = this.squad.arrival.at;
      const d = Math.hypot(camera.position.x - ax - at[0], camera.position.z - az - at[2]);
      k *= Math.max(0.15, Math.min(1, 1.25 - d / 30));
    }
    const t = this.time;
    camera.position.x += k * 0.06 * Math.sin(t * 47);
    camera.position.y += k * 0.045 * Math.sin(t * 53 + 1.3);
    camera.position.z += k * 0.05 * Math.sin(t * 43 + 2.1);
    camera.rotation.x += k * 0.018 * Math.sin(t * 39 + 0.7);
    camera.rotation.z += k * 0.022 * Math.sin(t * 31 + 2.9);
  }

  /**
   * The picture as a stunned player sees it (Phú 2026-11-14): white for an instant at the blast,
   * then blurred and drained of colour, clearing as the stun fades. A CSS filter on the canvas,
   * set only when its (stepped) value changes; none when not stunned.
   */
  stunned(canvas: HTMLCanvasElement): void {
    const e = this.game.emergency;
    const s = Math.round(e.stun * 40) / 40;
    const flash = e.blast >= 0 && e.blast < 0.4 ? Math.round(s * (1 - e.blast / 0.4) * 20) / 20 : 0;
    const key = s * 100 + flash;
    if (key === this.stunKey) return;
    this.stunKey = key;
    canvas.style.filter =
      s > 0
        ? `blur(${(2.5 * s * s).toFixed(2)}px) saturate(${(1 - 0.7 * s).toFixed(3)}) contrast(${(1 - 0.15 * s).toFixed(3)}) brightness(${(1 + 1.2 * flash).toFixed(2)})`
        : '';
  }

  dispose(): void {
    this.teardown();
    this.breach?.dispose();
    this.fall.dispose();
    this.water.dispose();
    this.steam.dispose();
    this.wisps.dispose();
    this.ropeGeometry.dispose();
    this.coilGeometry.dispose();
    this.shadow.dispose();
    this.group.removeFromParent();
  }

  // ---- the call starts and ends ------------------------------------------------------------------

  private setup(squad: ResponderSquad): void {
    this.squad = squad;
    this.helicopter = new Helicopter(squad);
    this.group.add(this.helicopter.group);
    this.ropeMaterial = new THREE.MeshStandardMaterial({
      color: squad.behavior === 'fire-rescue' ? '#d4602a' : '#26282c',
      roughness: 0.85,
    });
    for (let i = 0; i < ROPES.length; i++) {
      const rope = new THREE.Mesh(this.ropeGeometry, this.ropeMaterial);
      const coil = new THREE.Mesh(this.coilGeometry, this.ropeMaterial);
      rope.visible = false;
      coil.visible = false;
      this.ropes.push(rope);
      this.coils.push(coil);
      this.group.add(rope, coil);
    }
    squad.members.forEach((character, i) => {
      const actor = new Actor(character, this.shadow, 10 + i);
      for (const mesh of actor.model.meshes) mesh.layers.set(0);
      actor.model.shadows.body.castShadow = false;
      actor.model.shadows.coat.castShadow = false;
      actor.group.name = `responder-${squad.id}-${i}`;
      actor.group.visible = false;
      // What the uniform adds to the drawn body: hidden for a real person (who wears their own).
      const had = new Set<THREE.Object3D>();
      actor.model.root.traverse((o) => had.add(o));
      this.dress(actor, squad);
      const gear: THREE.Object3D[] = [];
      actor.model.root.traverse((o) => {
        if (!had.has(o) && o.parent && had.has(o.parent)) gear.push(o);
      });
      actor.drawnOnly(gear);
      this.group.add(actor.group);
      const lance = squad.pack === 'air-tank' ? this.lance() : null;
      if (lance) this.group.add(lance);
      this.members.push({
        actor,
        key: `responder-${i}`,
        lance,
        hitAt: -1,
        rope: 1,
        crouch: 0,
        water: 0,
        steam: 0,
        person: {
          id: `responder-${i}`,
          x: 0,
          z: 0,
          heading: 0,
          speed: 0,
          sit: false,
          gesture: 'idle',
          look: null,
          called: false,
          stride: 0,
          card: false,
          paper: false,
        },
      });
    });
    const scene = this.game.content.scenes.tryGet(squad.arrival.scene);
    const [ax, az] = squad.arrival.at;
    const room =
      scene?.kind === 'world'
        ? arrivalRoom(
            scene.rooms.map((id) => this.game.content.rooms.tryGet(id)),
            squad,
          )
        : undefined;
    this.roomId = room?.id ?? null;
    // The fittings in the way (the oculus, its coffer): what hangs at the ceiling over the hole.
    this.hidden = (room?.placements ?? [])
      .filter(
        (p) =>
          p.position[1] > squad.arrival.ceiling - 1.2 &&
          Math.hypot(p.position[0] - ax, p.position[2] - az) < squad.arrival.radius + 1.2,
      )
      .map((p) => `${room?.id}/${p.id}`);
    // What hangs under the hole, within the same reach: it falls at the blast.
    this.hung = room ? hungUnder(room, (id) => this.game.content.items.tryGet(id), squad) : [];
    // The helicopter, ropes and squad (hidden till they show): compiled while they fly in.
    this.deps.prepare([this.group]);
  }

  private teardown(): void {
    this.ceiling(null, 0, -1);
    this.mendFall();
    this.hung = [];
    this.helicopter?.dispose();
    this.helicopter = null;
    for (const member of this.members) {
      member.actor.group.removeFromParent();
      member.actor.dispose();
      member.lance?.removeFromParent();
      this.contact.remove(member.key);
    }
    this.members.length = 0;
    for (const o of [...this.ropes, ...this.coils]) o.removeFromParent();
    this.ropes.length = 0;
    this.coils.length = 0;
    this.ropeMaterial?.dispose();
    this.ropeMaterial = null;
    for (const g of this.gear.geometries) g.dispose();
    for (const m of this.gear.materials) m.dispose();
    for (const t of this.gear.textures) t.dispose();
    this.gear.geometries.length = 0;
    this.gear.materials.length = 0;
    this.gear.textures.length = 0;
    this.squad = null;
    this.roomId = null;
    this.hidden = [];
    this.hover = 0;
    this.searching = 0;
  }

  // ---- the ceiling --------------------------------------------------------------------------------

  /**
   * The hole built ahead as soon as the room is drawn (held, its shaders compiled while they come),
   * shown while there is one; whole again, the slab and fittings back.
   */
  private ceiling(at: readonly number[] | null, breach: number, blast: number): void {
    const slab =
      at !== null && this.squad !== null && this.roomId !== null
        ? this.deps.ceilingOf(this.roomId)
        : null;
    if (slab && at && this.squad) {
      if (!this.breach) {
        this.breach = new CeilingBreach(() => this.game.graphicsQuality);
        this.group.add(this.breach.group);
      }
      if (!this.breach.opened(slab)) {
        const [ax, az] = this.squad.arrival.at;
        this.breach.open(slab, ax + (at[0] ?? 0), az + (at[2] ?? 0), this.squad.arrival.radius);
        this.breach.hold(true);
        this.deps.prepare([this.breach.group, ...this.breach.pieces()]);
      }
      const want = breach > 0 || blast >= 0;
      this.breach.hold(!want);
      if (want !== this.open) {
        for (const id of this.hidden) this.deps.hide(id, want);
        this.open = want;
      }
      return;
    }
    if (!this.breach?.ready) return;
    this.breach.close();
    if (this.open) for (const id of this.hidden) this.deps.hide(id, false);
    this.open = false;
  }

  /**
   * What hangs under the hole falls at the blast and breaks (`HungFall`); walked in long after,
   * it lies broken already; whole again once the ceiling is mended.
   */
  private drop(at: readonly number[] | null, breach: number, blast: number, dt: number): void {
    if (blast >= 0 && at && !this.fall.down && this.hung.length > 0) {
      const hung: Hung[] = [];
      for (const { entityId: id, bottom, size } of this.hung) {
        const copy = this.deps.copyOf(id);
        if (!copy) continue;
        // The copy falls; the world object is hidden where it hung until the ceiling is mended.
        this.fall.group.add(copy);
        this.deps.hide(id, true);
        this.fallen.push({ id, copy });
        hung.push({ object: copy, bottom, size });
      }
      this.fall.start(hung, at[1] ?? 0, blast > 3);
    }
    if (this.fall.down && breach <= 0 && blast < 0) this.mendFall();
    else this.fall.update(dt, breach);
  }

  /** Whole again where it hung: the copies gone, the world objects shown. */
  private mendFall(): void {
    this.fall.restore();
    for (const { id, copy } of this.fallen) {
      copy.removeFromParent();
      this.deps.hide(id, false);
    }
    this.fallen = [];
  }

  // ---- the ropes ----------------------------------------------------------------------------------

  /** Each rope from its arm down `ropes` of the way to the floor, swaying; coiled where it lands. */
  private hang(at: readonly number[] | null, ropes: number, phase: EmergencyPhase): void {
    const heli = this.game.emergency.heli;
    const shown = at !== null && heli.visible && ropes > 0.001;
    const floor = at?.[1] ?? 0;
    for (let i = 0; i < this.ropes.length; i++) {
      const rope = this.ropes[i];
      const coil = this.coils[i];
      if (!rope || !coil) continue;
      rope.visible = shown;
      coil.visible = shown && ropes > 0.999 && phase !== 'ascend';
      if (!at || !shown) continue;
      this.anchorOf(i, at, this.anchor);
      const length = Math.max(0.01, (this.anchor.y - floor) * ropes);
      rope.position.copy(this.anchor);
      rope.scale.set(1, length, 1);
      const sway = 0.012 + 0.02 * this.hover;
      rope.rotation.set(
        sway * Math.sin(this.time * 1.3 + i * 1.7),
        0,
        sway * Math.cos(this.time * 1.1 + i * 2.3),
      );
      coil.position.set(this.anchor.x, floor + 0.03, this.anchor.z);
    }
  }

  /** Rope `i`'s top (world): its arm on the helicopter, turned with it. */
  private anchorOf(i: number, at: readonly number[], out: THREE.Vector3): THREE.Vector3 {
    const heli = this.game.emergency.heli;
    const [right, forward] = ROPES[i] ?? [0, 0];
    const c = Math.cos(heli.yaw);
    const s = Math.sin(heli.yaw);
    return out.set(
      heli.x + (at[0] ?? 0) + right * c - forward * s,
      heli.y + (at[1] ?? 0) + ROPE_TOP,
      heli.z + (at[2] ?? 0) - right * s - forward * c,
    );
  }

  // ---- the responders -----------------------------------------------------------------------------

  private pose(
    member: Member,
    view: ResponderView,
    i: number,
    dt: number,
    squad: ResponderSquad,
  ): void {
    const { actor, person } = member;
    const offset = this.game.scenes.offsetOf(view.sceneId);
    const shown = view.visible && offset !== null;
    actor.group.visible = shown;
    if (!offset || !shown) {
      if (member.lance) member.lance.visible = false;
      this.contact.remove(member.key);
      return;
    }
    const onRope = view.action === 'rappel' || view.action === 'climb';
    member.rope += ((onRope ? 1 : 0) - member.rope) * Math.min(1, dt * (onRope ? 20 : 4));
    let x = view.x + offset[0];
    let z = view.z + offset[2];
    let heading = view.heading;
    const at = this.game.scenes.offsetOf(squad.arrival.scene);
    if (member.rope > 0.001 && at) {
      // Facing the rope (towards the helicopter's middle), hanging just behind it.
      const right = ROPES[i]?.[0] ?? 1;
      const face = this.game.emergency.heli.yaw + (right > 0 ? Math.PI / 2 : -Math.PI / 2);
      this.anchorOf(i, at, this.anchor);
      const rx = this.anchor.x + Math.sin(face) * ROPE_GAP;
      const rz = this.anchor.z + Math.cos(face) * ROPE_GAP;
      const r = member.rope;
      x += (rx - x) * r;
      z += (rz - z) * r;
      heading += Math.atan2(Math.sin(face - heading), Math.cos(face - heading)) * r;
    }
    person.x = x;
    person.z = z;
    person.heading = heading;
    person.speed = view.speed;
    person.stride = view.stride;
    person.gesture = gestureOf(view, i);
    person.paper = false;
    // Looking at whom they talk to (or the fire, the caller).
    let look: { x: number; z: number } | null = null;
    if (view.looking) {
      this.look.x = view.lookX + offset[0];
      this.look.z = view.lookZ + offset[2];
      look = this.look;
    }
    // The slap: the right hand drawn back and up, then across the face.
    let point: THREE.Vector3 | null = null;
    if (view.action === 'hit') {
      if (member.hitAt < 0) member.hitAt = this.time;
      point = this.slap(this.time - member.hitAt, x, z, heading, offset[1]);
      person.paper = true; // the right hand, whichever side the point is on (see Actor.aim)
    } else member.hitAt = -1;
    actor.setMotion(QUALITY[this.game.graphicsQuality].motion);
    actor.setReal(QUALITY[this.game.graphicsQuality].realPeople, this.warn, this.prepareReal);
    actor.update(person, dt, this.time, look, point);
    member.crouch += ((person.gesture === 'land' ? 1 : 0) - member.crouch) * Math.min(1, dt * 10);
    actor.group.position.y += view.y + offset[1] - 0.22 * member.crouch;
    const lift = Math.min(1, view.y / 6);
    this.contact.place(member.key, x, offset[1], z, 0.42 * (1 - 0.6 * lift));
    this.spray(member, view, offset, dt);
  }

  /** Where the slapping hand points, `u` s into it, in the world. */
  private slap(u: number, x: number, z: number, heading: number, floor: number): THREE.Vector3 {
    // Right, up and forward of the body (it faces −z turned by `heading`).
    let r = 0.55;
    let up = 1.95;
    let f = -0.25;
    if (u > WIND_S) {
      const s = Math.min(1, (u - WIND_S) / SWING_S);
      const e = s * s * (3 - 2 * s);
      r = 0.55 - 1.0 * e;
      up = 1.95 - 0.45 * e;
      f = -0.25 + 1.0 * e;
    }
    if (u > WIND_S + SWING_S + 0.35) {
      r = 0.25;
      up = 1.1;
      f = 0.35;
    }
    const c = Math.cos(heading);
    const s = Math.sin(heading);
    return this.target.set(x + r * c - f * s, floor + up, z - r * s - f * c);
  }

  /** A firefighter at a fire: the lance in their hands, aimed; water arcing to it, steam off it. */
  private spray(member: Member, view: ResponderView, offset: readonly number[], dt: number): void {
    const lance = member.lance;
    const spraying = view.action === 'spray' && lance !== null;
    if (lance) lance.visible = spraying || view.action === 'walk' || view.action === 'none';
    if (!lance || !lance.visible) return;
    member.actor.model.bones.handR.getWorldPosition(this.hand);
    lance.position.copy(this.hand);
    const ox = offset[0] ?? 0;
    const oy = offset[1] ?? 0;
    const oz = offset[2] ?? 0;
    if (!spraying) {
      // Carried: pointing ahead and a little down.
      const h = member.person.heading;
      this.target.set(
        this.hand.x - Math.sin(h) * 0.8,
        this.hand.y - 0.45,
        this.hand.z - Math.cos(h) * 0.8,
      );
      lance.lookAt(this.target);
      return;
    }
    this.target.set(view.aimX + ox, view.aimY + oy, view.aimZ + oz);
    lance.lookAt(this.target);
    this.tip.set(0, 0, 0.62);
    lance.localToWorld(this.tip);
    const dx = this.target.x - this.tip.x;
    const dy = this.target.y - this.tip.y;
    const dz = this.target.z - this.tip.z;
    const d = Math.hypot(dx, dy, dz) || 1;
    const speed = 9;
    const flight = d / speed;
    // Aimed above the fire so the arc (the pool's fall of 6 m/s²) lands on it.
    const rise = 3 * flight;
    member.water += WATER_PER_S[this.game.graphicsQuality] * dt;
    while (member.water >= 1) {
      member.water -= 1;
      const j = 0.35;
      this.water.emit(
        this.tip.x,
        this.tip.y,
        this.tip.z,
        (dx / d) * speed + (Math.random() - 0.5) * j,
        (dy / d) * speed + rise + (Math.random() - 0.5) * j,
        (dz / d) * speed + (Math.random() - 0.5) * j,
        0.05,
        flight * (0.9 + 0.3 * Math.random()),
      );
    }
    member.steam += 10 * dt;
    while (member.steam >= 1) {
      member.steam -= 1;
      (QUALITY[this.game.graphicsQuality].effects ? this.wisps : this.steam).emit(
        this.target.x + (Math.random() - 0.5) * 0.5,
        this.target.y + 0.1,
        this.target.z + (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.3,
        0.4,
        (Math.random() - 0.5) * 0.3,
        0.45,
        2 + Math.random(),
      );
    }
  }

  // ---- uniforms ----------------------------------------------------------------------------------

  /**
   * The squad's gear on a body, on its bones at their resting places (the body is made standing
   * at the origin): a helmet over the head, an air tank or a radio, the squad's name on the back.
   */
  private dress(actor: Actor, squad: ResponderSquad): void {
    const { geometries, materials } = this.gear;
    const own = <T extends THREE.Material>(m: T) => (materials.push(m), m);
    const bones = actor.model.bones;
    actor.group.updateMatrixWorld(true);
    const h = actor.top();
    // The drawn head's cranium (BodyModel: an anime head, a little large for the body).
    const k = (1.72 + (h - 1.72) * 0.3) / 1.72;
    const cy = 0.93 * h + 0.036 * k;
    const [rx, ry, rz] = [0.083 * k + 0.03, 0.112 * k + 0.028, 0.094 * k + 0.034];
    const head = bones.head.getWorldPosition(new THREE.Vector3());
    const fire = squad.helmet === 'fire';
    const shell = own(
      new THREE.MeshStandardMaterial({
        color: fire ? squad.livery.body : '#1d222b',
        metalness: fire ? 0.15 : 0.05,
        roughness: fire ? 0.28 : 0.75,
      }),
    );
    const trim = own(
      new THREE.MeshStandardMaterial({
        color: fire ? '#d8ff3a' : '#30353f',
        emissive: fire ? '#5a6a10' : '#000000',
        roughness: 0.4,
      }),
    );
    const parts: THREE.BufferGeometry[] = [
      new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI * (fire ? 0.55 : 0.53)).scale(
        rx,
        ry,
        rz,
      ),
    ];
    const bands: THREE.BufferGeometry[] = [
      new THREE.CylinderGeometry(1, 1, 0.026, 32, 1, true)
        .scale(rx * 1.012, 1, rz * 1.012)
        .translate(0, 0.012, 0),
    ];
    if (fire) {
      // A brim, longer at the back; a comb along the crown.
      parts.push(
        new THREE.CylinderGeometry(1, 1, 0.012, 32)
          .scale(rx + 0.045, 1, rz + 0.075)
          .translate(0, -0.018, 0.03),
        new THREE.BoxGeometry(0.022, 0.032, rz * 1.7).translate(0, ry - 0.004, 0),
      );
    } else {
      // Rails on its sides, a mount at its front.
      parts.push(
        new THREE.BoxGeometry(0.014, 0.022, rz * 1.2).translate(rx - 0.004, 0.02, 0),
        new THREE.BoxGeometry(0.014, 0.022, rz * 1.2).translate(-rx + 0.004, 0.02, 0),
        new THREE.BoxGeometry(0.06, 0.035, 0.018).translate(0, ry * 0.55, -rz + 0.004),
      );
    }
    const helmet = mergeOwned(parts, geometries);
    const helmetMesh = new THREE.Mesh(helmet, shell);
    helmetMesh.position.set(-head.x, cy - head.y - 0.004, 0.01 - head.z);
    bones.head.add(helmetMesh);
    const bandMesh = new THREE.Mesh(mergeOwned(bands, geometries), trim);
    bandMesh.position.copy(helmetMesh.position);
    bones.head.add(bandMesh);

    // The torso's back and front at chest height, from the body's own surface (its outer layer).
    const chest = bones.chest.getWorldPosition(new THREE.Vector3());
    const { back, front } = torsoDepth(actor, chest.y);
    if (squad.pack === 'air-tank') {
      const metal = own(
        new THREE.MeshStandardMaterial({ color: '#c9ced4', metalness: 0.8, roughness: 0.3 }),
      );
      const black = own(new THREE.MeshStandardMaterial({ color: '#16181c', roughness: 0.7 }));
      const tankY = chest.y - 0.1;
      const tank = mergeOwned(
        [
          new THREE.CapsuleGeometry(0.085, 0.4, 4, 16).translate(0, tankY - chest.y, back + 0.12),
          new THREE.CylinderGeometry(0.03, 0.03, 0.08, 10).translate(
            0,
            tankY - chest.y + 0.3,
            back + 0.12,
          ),
        ],
        geometries,
      );
      const plate = mergeOwned(
        [
          new THREE.BoxGeometry(0.28, 0.5, 0.025).translate(0, tankY - chest.y, back + 0.02),
          // Shoulder straps over to the front.
          new THREE.BoxGeometry(0.05, 0.02, front === null ? 0.2 : back - front + 0.04).translate(
            0.09,
            0.17,
            (back + (front ?? back - 0.2)) / 2,
          ),
          new THREE.BoxGeometry(0.05, 0.02, front === null ? 0.2 : back - front + 0.04).translate(
            -0.09,
            0.17,
            (back + (front ?? back - 0.2)) / 2,
          ),
        ],
        geometries,
      );
      for (const [g, m] of [
        [tank, metal],
        [plate, black],
      ] as const) {
        const mesh = new THREE.Mesh(g, m);
        mesh.position.set(-chest.x, 0, -chest.z);
        bones.chest.add(mesh);
      }
    } else {
      const black = own(new THREE.MeshStandardMaterial({ color: '#121418', roughness: 0.6 }));
      const radio = mergeOwned(
        [
          new THREE.BoxGeometry(0.06, 0.11, 0.035).translate(-0.1, 0.03, (front ?? -0.13) - 0.02),
          new THREE.CylinderGeometry(0.006, 0.006, 0.16, 6).translate(
            -0.12,
            0.16,
            (front ?? -0.13) - 0.02,
          ),
        ],
        geometries,
      );
      const mesh = new THREE.Mesh(radio, black);
      mesh.position.set(-chest.x, 0, -chest.z);
      bones.chest.add(mesh);
    }
    // Their squad's name across the back.
    const label = backLabel(squad.back);
    if (label) {
      const material = own(
        new THREE.MeshStandardMaterial({
          map: label,
          transparent: true,
          roughness: 0.5,
          emissive: '#ffffff',
          emissiveMap: label,
          emissiveIntensity: 0.25,
        }),
      );
      this.gear.textures.push(label);
      // Under the tank's foot (fire), or across the shoulders (police).
      const y = squad.pack === 'air-tank' ? -0.45 : 0.06;
      const { back: at } = torsoDepth(actor, chest.y + y);
      const plane = new THREE.PlaneGeometry(0.34, 0.085);
      geometries.push(plane);
      const mesh = new THREE.Mesh(plane, material);
      mesh.position.set(-chest.x, y, at + 0.006 - chest.z);
      bones.chest.add(mesh);
    }
  }

  /** A firefighter's lance: a pistol grip, the barrel, its nozzle (along +z, the tip at 0.62). */
  private lance(): THREE.Group {
    const { geometries, materials } = this.gear;
    const dark = new THREE.MeshStandardMaterial({
      color: '#1e2126',
      metalness: 0.5,
      roughness: 0.5,
    });
    const brass = new THREE.MeshStandardMaterial({
      color: '#c9a443',
      metalness: 0.9,
      roughness: 0.3,
    });
    materials.push(dark, brass);
    const body = mergeOwned(
      [
        new THREE.CylinderGeometry(0.024, 0.024, 0.5, 10)
          .rotateX(Math.PI / 2)
          .translate(0, 0, 0.27),
        new THREE.BoxGeometry(0.035, 0.11, 0.04).translate(0, -0.05, 0.02),
      ],
      geometries,
    );
    const nozzle = mergeOwned(
      [
        new THREE.CylinderGeometry(0.018, 0.034, 0.1, 12)
          .rotateX(Math.PI / 2)
          .translate(0, 0, 0.57),
      ],
      geometries,
    );
    const group = new THREE.Group();
    group.add(new THREE.Mesh(body, dark), new THREE.Mesh(nozzle, brass));
    group.visible = false;
    return group;
  }
}

/** What their body does, by what they are doing. */
function gestureOf(view: ResponderView, i: number): Gesture {
  switch (view.action) {
    case 'rappel':
    case 'climb':
      return 'rope';
    case 'land':
      return 'land';
    case 'spray':
      return 'lance';
    case 'look':
      return i % 2 === 0 ? 'scratch' : 'listen';
    case 'hit':
      return 'idle';
    default:
      return view.gesture === 'talk' ? 'talk' : view.talking ? 'talk' : view.gesture;
  }
}

/** Parts merged into one geometry, kept in `owned` (freed with the squad); the parts freed now. */
function mergeOwned(
  parts: THREE.BufferGeometry[],
  owned: THREE.BufferGeometry[],
): THREE.BufferGeometry {
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  owned.push(merged);
  return merged;
}

/**
 * The body's back and front (z, m) at height `y`, near its middle: the outermost of its drawn
 * surfaces there (a jacket over a shirt), read from the shadow mesh's resting shape.
 */
function torsoDepth(actor: Actor, y: number): { back: number; front: number | null } {
  const position = actor.model.shadows.body.geometry.getAttribute('position');
  let back = -Infinity;
  let front = Infinity;
  for (let i = 0; i < position.count; i++) {
    if (Math.abs(position.getX(i)) > 0.06 || Math.abs(position.getY(i) - y) > 0.04) continue;
    const z = position.getZ(i);
    if (z > back) back = z;
    if (z < front) front = z;
  }
  return {
    back: Number.isFinite(back) ? back : 0.12,
    front: Number.isFinite(front) ? front : null,
  };
}

/** The squad's name in reflective letters, for the back of the jacket. */
function backLabel(text: string): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.font = '800 88px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const width = ctx.measureText(text).width;
  const fit = Math.min(1, 480 / width);
  ctx.translate(256, 66);
  ctx.scale(fit, 1);
  ctx.fillStyle = '#e8edf0';
  ctx.fillText(text, 0, 0);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
