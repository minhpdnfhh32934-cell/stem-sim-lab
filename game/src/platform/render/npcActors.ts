import * as THREE from 'three';
import type { Game } from '../../game/Game';
import type { NpcView } from '../../gameplay/npc/NpcSystem';
import { Actor } from './body/actor';
import type { ContactShadows } from './contactShadows';
import type { PersonView } from './body/person';

/** The soft shadow under a person's feet (m). */
const CONTACT_RADIUS = 0.42;

/** A job's progress bar over a person's head (Phase Y-5): its width, height (m) and gap over the head. */
const BAR_W = 0.62;
const BAR_H = 0.07;
const BAR_GAP = 0.24;

/** A person's view for the actor, written in place each frame. */
type Writable<T> = { -readonly [K in keyof T]: T[K] };

/**
 * The world's people drawn (Phase Y): an actor (the character page's, the player characters' own
 * body and style) for each person whose scene is resident, posed every frame from the NpcSystem's
 * view of them — where they stand or walk (their legs in step with the footsteps heard), seated,
 * what their hands do (a part pointed at, a card tapped on a door's reader), where they look — at
 * their scene's offset in the session frame. Made when their scene comes in, freed when it goes.
 */
export class NpcActors {
  private readonly actors = new Map<
    string,
    {
      actor: Actor;
      person: Writable<PersonView>;
      key: string;
      bar: Bar | null;
      desk: THREE.Mesh | null;
    }
  >();
  private readonly shadow = new THREE.MeshBasicMaterial({ colorWrite: false });
  private readonly barBack = barMaterial(0x1d2433, 0.75);
  private readonly barFill = barMaterial(0x5fd38a, 1);
  /** A paper (Phase Y-5): upright in a hand, or flat on a desk; one sheet, shared. */
  private readonly sheet = new THREE.BoxGeometry(0.21, 0.297, 0.001);
  private readonly hand = new THREE.Vector3();
  private readonly sheetMaterial = new THREE.MeshStandardMaterial({
    color: '#f7f4ea',
    roughness: 0.9,
  });
  private readonly look = { x: 0, z: 0 };
  /** Where the part a person points at is (world, m), this frame. */
  private readonly target = new THREE.Vector3();
  private time = 0;

  constructor(
    private readonly parent: THREE.Object3D,
    private readonly game: Game,
    /** Their shadow on the floor: a soft disc (a shadow map would be drawn again every frame). */
    private readonly contact: ContactShadows,
    /** The open Explain view's part `partId` in the world, into `out`; false if not shown. */
    private readonly partAt: (partId: string, out: THREE.Vector3) => boolean = () => false,
  ) {}

  update(dt: number): void {
    this.time += dt;
    const views = this.game.npcs.views;
    for (let i = 0; i < views.length; i++) {
      const view = views[i];
      if (view) this.pose(view, dt);
    }
  }

  dispose(): void {
    for (const id of [...this.actors.keys()]) this.remove(id);
    this.shadow.dispose();
    this.barBack.dispose();
    this.barFill.dispose();
    this.sheet.dispose();
    this.sheetMaterial.dispose();
  }

  private pose(view: NpcView, dt: number): void {
    const offset = this.game.scenes.offsetOf(view.sceneId);
    const id = view.npc.id;
    if (!offset) {
      this.remove(id);
      return;
    }
    let entry = this.actors.get(id);
    if (!entry) {
      const actor = new Actor(view.npc.character, this.shadow, 3);
      // Seen from outside: every part drawn, the head too (the player's own is hidden from them).
      for (const mesh of actor.model.meshes) mesh.layers.set(0);
      // A person always moves a little (breathing, gestures): a shadow-map caster would have every
      // light's map drawn again each frame (the shadow cache). A contact shadow instead.
      actor.model.shadows.body.castShadow = false;
      actor.model.shadows.coat.castShadow = false;
      actor.group.name = `npc-${id}`;
      this.parent.add(actor.group);
      entry = {
        actor,
        key: `npc-${id}`,
        bar: null,
        desk: null,
        person: {
          id,
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
        },
      };
      this.actors.set(id, entry);
    }
    const person = entry.person;
    person.x = view.x + offset[0];
    person.z = view.z + offset[2];
    person.heading = view.heading;
    person.speed = view.speed;
    person.sit = view.sit > 0.5;
    person.gesture = view.gesture;
    person.stride = view.stride;
    person.card = view.card;
    person.paper = view.paper === 'hand';
    person.pen = view.pen === 'none' ? null : view.pen;
    // Pointing at a part of the apparatus explained, or a card held to a door's reader: they
    // look at it too.
    let pointing = false;
    if (view.reaching) {
      this.target.set(view.reachX + offset[0], view.reachY, view.reachZ + offset[2]);
      pointing = true;
    } else if (view.point !== null) pointing = this.partAt(view.point, this.target);
    this.look.x = pointing ? this.target.x : view.lookX + offset[0];
    this.look.z = pointing ? this.target.z : view.lookZ + offset[2];
    const look = pointing || view.looking ? this.look : null;
    entry.actor.update(person, dt, this.time, look, pointing ? this.target : null);
    this.contact.place(entry.key, person.x, 0, person.z, CONTACT_RADIUS);
    this.progress(entry, view, person);
    this.deskPaper(entry, view, offset);
  }

  /**
   * Their paper: flat on the desk while they write on it (or mark it), facing as they do; or
   * upright under their right hand, its face to whom they hold it out (along their heading).
   */
  private deskPaper(
    entry: { actor: Actor; desk: THREE.Mesh | null },
    view: NpcView,
    offset: readonly [number, number, number],
  ): void {
    if (view.paper === 'none') {
      if (entry.desk) entry.desk.visible = false;
      return;
    }
    if (!entry.desk) {
      entry.desk = new THREE.Mesh(this.sheet, this.sheetMaterial);
      entry.desk.name = `npc-paper-${view.npc.id}`;
      entry.desk.rotation.order = 'YXZ';
      this.parent.add(entry.desk);
    }
    const sheet = entry.desk;
    sheet.visible = true;
    sheet.rotation.y = view.heading;
    if (view.paper === 'desk') {
      sheet.rotation.x = -Math.PI / 2;
      sheet.position.set(view.paperX + offset[0], view.paperY, view.paperZ + offset[2]);
      return;
    }
    // Held by its top edge between thumb and fingers: hanging below the hand.
    sheet.rotation.x = 0;
    entry.actor.model.bones.handR.getWorldPosition(this.hand);
    sheet.position.set(this.hand.x, this.hand.y - 0.13, this.hand.z);
  }

  /** A job's progress (writing a test) as a bar over their head, facing the camera; none: hidden. */
  private progress(
    entry: { actor: Actor; bar: Bar | null },
    view: NpcView,
    person: PersonView,
  ): void {
    const p = view.progress;
    if (p === null) {
      if (entry.bar) entry.bar.back.visible = false;
      return;
    }
    if (!entry.bar) {
      const back = new THREE.Sprite(this.barBack);
      const fill = new THREE.Sprite(this.barFill);
      back.scale.set(BAR_W, BAR_H, 1);
      back.renderOrder = 10;
      fill.renderOrder = 11;
      back.add(fill);
      back.name = `npc-progress-${view.npc.id}`;
      this.parent.add(back);
      entry.bar = { back, fill };
    }
    const { back, fill } = entry.bar;
    back.visible = true;
    back.position.set(person.x, view.npc.character.appearance.heightM + BAR_GAP, person.z);
    const k = Math.min(1, Math.max(0.001, p));
    // The fill is a child: its scale is a fraction of the bar, its left edge held at the bar's.
    fill.scale.set(k * 0.94, 0.6, 1);
    fill.center.set(0.5 / k, 0.5);
  }

  private remove(id: string): void {
    const entry = this.actors.get(id);
    if (!entry) return;
    entry.actor.group.removeFromParent();
    entry.bar?.back.removeFromParent();
    entry.desk?.removeFromParent();
    entry.actor.dispose();
    this.contact.remove(entry.key);
    this.actors.delete(id);
  }
}

interface Bar {
  readonly back: THREE.Sprite;
  readonly fill: THREE.Sprite;
}

/** A flat bar colour: not lit, not tone mapped, drawn over what is at its depth. */
function barMaterial(color: number, opacity: number): THREE.SpriteMaterial {
  return new THREE.SpriteMaterial({
    color,
    opacity,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
}
