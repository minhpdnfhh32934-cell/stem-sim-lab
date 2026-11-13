import * as THREE from 'three';
import type { Game } from '../../game/Game';
import type { CharacterDefinition } from '../../gameplay/character';
import type { WornOn } from '../../gameplay/item';
import type { RemotePlayer } from '../../multiplayer/Peers';
import { Actor } from './body/actor';
import type { Gesture, PersonView } from './body/person';
import type { Doing } from '../../multiplayer/protocol';

/** What another player is doing, as their body acts it out (2026-11-12). */
const DOING_GESTURE: Readonly<Record<Doing, Gesture>> = {
  paper: 'test',
  talk: 'listen',
  work: 'type',
  call: 'phone',
  dial: 'dial',
  hands: 'hands',
};
import type { ContactShadows } from './contactShadows';

const CONTACT_RADIUS = 0.42;
/** The name over a player's head: its height (m) and the gap over the head. */
const TAG_H = 0.16;
const TAG_GAP = 0.22;
/** The seat height the actor's sitting pose is made for (m): `body/actor.ts` SEAT. */
const ACTOR_SEAT = 0.47;
/** A held object drawn no bigger than this (m) on its longest side. */
const HELD_MAX_M = 0.45;
/** The "z"s over a sleeper: how many, how long each rises (s), how high (m). */
const ZZZ = 3;
const ZZZ_S = 2.4;
const ZZZ_RISE = 0.55;

type Writable<T> = { -readonly [K in keyof T]: T[K] };

interface Entry {
  actor: Actor;
  character: CharacterDefinition;
  person: Writable<PersonView>;
  key: string;
  tag: THREE.Sprite;
  /** What is worn, as last shown (item ids joined). */
  gear: string;
  /** The held object's box, and its item (null: nothing in the hand). */
  held: THREE.Mesh;
  heldItem: string | null;
  zzz: THREE.Sprite[];
}

/**
 * The other players in the room drawn (Phase M): each one an actor in their character (the same
 * body the NPCs and the player have), walking as fast as they walk, at their scene's offset, with
 * their name over their head. Only while their scene is resident here; made when they come, freed
 * when they leave, built again when their character changes.
 *
 * Phase F-3: what they wear (the lab coat, goggles, gloves), what their hand holds (the object, a
 * phone), their hands at work during an action, seated on a seat, lying on a bed, and asleep (the
 * "z"s over them, rising, growing and fading); what they throw flies here too.
 */
export class RemotePlayers {
  private readonly actors = new Map<string, Entry>();
  private readonly shadow = new THREE.MeshBasicMaterial({ colorWrite: false });
  private readonly seen = new Set<string>();
  private readonly box = new THREE.BoxGeometry(1, 1, 1);
  private zTexture: THREE.CanvasTexture | null = null;
  private readonly ghosts: THREE.Mesh[] = [];
  private readonly point = { x: 0, y: 0, z: 0 };
  private time = 0;

  constructor(
    private readonly parent: THREE.Object3D,
    private readonly game: Game,
    private readonly contact: ContactShadows,
  ) {}

  update(dt: number): void {
    this.time += dt;
    const players = this.game.peers.players;
    this.drawGhosts();
    if (players.length === 0 && this.actors.size === 0) return;
    this.seen.clear();
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      if (player && this.pose(player, dt)) this.seen.add(player.id);
    }
    for (const id of this.actors.keys()) if (!this.seen.has(id)) this.remove(id);
  }

  dispose(): void {
    for (const id of [...this.actors.keys()]) this.remove(id);
    for (const ghost of this.ghosts) {
      ghost.removeFromParent();
      (ghost.material as THREE.Material).dispose();
    }
    this.shadow.dispose();
    this.box.dispose();
    this.zTexture?.dispose();
  }

  /** Draws `player`; false when they are not in a scene resident here. */
  private pose(player: RemotePlayer, dt: number): boolean {
    const offset = player.sceneId ? this.game.scenes.offsetOf(player.sceneId) : null;
    const target = player.target;
    if (!offset || !target) return false;
    let entry = this.actors.get(player.id);
    if (entry && entry.character !== player.character) {
      this.remove(player.id);
      entry = undefined;
    }
    if (!entry) entry = this.make(player);
    this.dress(entry, target.gear ?? []);
    this.hold(entry, target.held ?? null);
    const person = entry.person;
    const rest = target.rest ?? null;
    const seat = rest === 'sit' ? (target.restAt ?? null) : null;
    const bed = rest === 'lie' || rest === 'asleep' ? (target.restAt ?? null) : null;
    person.x = seat ? seat[0] + offset[0] : player.x + offset[0];
    person.z = seat ? seat[2] + offset[2] : player.z + offset[2];
    person.heading = seat ? seat[3] : bed ? bed[3] : player.heading;
    person.speed = seat || bed ? 0 : player.speed;
    person.sit = seat !== null;
    const doing = target.doing ?? null;
    person.gesture = doing
      ? DOING_GESTURE[doing]
      : target.held === 'phone'
        ? 'dial'
        : target.act
          ? 'type'
          : 'idle';
    person.pen = doing === 'paper' ? 'blue' : null;
    person.pitch = target.pitch ?? 0;
    // An object in the hand: held out in front of the chest, the arm towards it.
    let point: typeof this.point | null = null;
    if (entry.heldItem !== null && !seat && !bed && !doing) {
      point = this.point;
      point.x = person.x - Math.sin(person.heading) * 0.45;
      point.y = player.y + offset[1] + 1.2;
      point.z = person.z - Math.cos(person.heading) * 0.45;
    }
    entry.actor.update(person, dt, this.time, null, point);
    const group = entry.actor.group;
    let headY = player.character.appearance.heightM + TAG_GAP;
    let tagX = person.x;
    let tagZ = person.z;
    if (seat) {
      // The actor sits at a chair's height: lowered or raised onto this seat.
      group.position.y += seat[1] + offset[1] - ACTOR_SEAT;
      headY += seat[1] + offset[1] - ACTOR_SEAT;
    }
    if (bed) {
      // On their back along the bed, the head on the pillow, the feet down the bed.
      const f = bed[3];
      const reach = player.character.appearance.heightM - 0.12;
      group.rotation.set(Math.PI / 2, f, 0, 'YXZ');
      tagX = bed[0] + offset[0];
      tagZ = bed[2] + offset[2];
      group.position.set(
        tagX - Math.sin(f) * reach,
        bed[1] + offset[1] + 0.09,
        tagZ - Math.cos(f) * reach,
      );
      headY = bed[1] + offset[1] + 0.45;
    } else {
      group.rotation.x = 0;
      group.rotation.order = 'XYZ';
    }
    entry.tag.position.set(tagX, headY, tagZ);
    this.sleep(entry, rest === 'asleep', tagX, headY - 0.15, tagZ);
    this.contact.place(entry.key, person.x, 0, person.z, CONTACT_RADIUS);
    return true;
  }

  /** Shows what they wear (only when it changed). */
  private dress(entry: Entry, gear: readonly string[]): void {
    const key = gear.join(',');
    if (key === entry.gear) return;
    entry.gear = key;
    const worn: Partial<Record<WornOn, string>> = {};
    for (const id of gear) {
      const item = this.game.content.items.tryGet(id);
      if (item?.wornOn) worn[item.wornOn] = item.visual.color;
    }
    entry.actor.wear(worn);
  }

  /** The object in their right hand: a box its size and colour (the phone: the actor's own). */
  private hold(entry: Entry, itemId: string | null): void {
    const id = itemId === 'phone' ? null : itemId;
    if (id === entry.heldItem) return;
    entry.heldItem = id;
    const item = id === null ? undefined : this.game.content.items.tryGet(id);
    if (!item) {
      entry.held.visible = false;
      return;
    }
    const [w, h, d] = item.visual.size;
    const k = Math.min(1, HELD_MAX_M / Math.max(w, h, d));
    entry.held.scale.set(w * k, h * k, d * k);
    (entry.held.material as THREE.MeshStandardMaterial).color.set(item.visual.color);
    entry.held.position.set(-0.03, -0.08 - (h * k) / 2, 0);
    entry.held.visible = true;
  }

  /** The "z"s rising from a sleeper's head, each growing and fading as it goes. */
  private sleep(entry: Entry, asleep: boolean, x: number, y: number, z: number): void {
    if (asleep && entry.zzz.length === 0) {
      const map = this.zLetter();
      for (let i = 0; i < ZZZ; i++) {
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false }),
        );
        sprite.name = `zzz-${entry.key}`;
        this.parent.add(sprite);
        entry.zzz.push(sprite);
      }
    } else if (!asleep && entry.zzz.length > 0) this.dropZzz(entry);
    for (let i = 0; i < entry.zzz.length; i++) {
      const sprite = entry.zzz[i];
      if (!sprite) continue;
      const t = (((this.time / ZZZ_S + i / ZZZ) % 1) + 1) % 1;
      const size = 0.08 + 0.16 * t;
      sprite.scale.set(size, size, 1);
      sprite.position.set(x + 0.12 * t + 0.03 * Math.sin(t * 9), y + ZZZ_RISE * t, z);
      sprite.material.opacity = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
    }
  }

  private dropZzz(entry: Entry): void {
    for (const sprite of entry.zzz) {
      sprite.removeFromParent();
      sprite.material.dispose();
    }
    entry.zzz.length = 0;
  }

  /** One "Z" drawn once, shared by every sleeper. */
  private zLetter(): THREE.CanvasTexture {
    if (this.zTexture) return this.zTexture;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const g = canvas.getContext('2d');
    if (g) {
      g.font = "800 54px 'Segoe UI', system-ui, sans-serif";
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 6;
      g.strokeStyle = 'rgba(20, 30, 60, 0.85)';
      g.strokeText('Z', 32, 34);
      g.fillStyle = '#ffffff';
      g.fillText('Z', 32, 34);
    }
    this.zTexture = new THREE.CanvasTexture(canvas);
    this.zTexture.colorSpace = THREE.SRGBColorSpace;
    return this.zTexture;
  }

  /** What the others threw, flying here (`peers.ghosts`): a box its size and colour each. */
  private drawGhosts(): void {
    const ghosts = this.game.peers.ghosts;
    while (this.ghosts.length < ghosts.length) {
      const mesh = new THREE.Mesh(this.box, new THREE.MeshStandardMaterial());
      mesh.name = 'thrown-ghost';
      this.parent.add(mesh);
      this.ghosts.push(mesh);
    }
    for (let i = 0; i < this.ghosts.length; i++) {
      const mesh = this.ghosts[i];
      const ghost = ghosts[i];
      if (!mesh) continue;
      const item = ghost ? this.game.content.items.tryGet(ghost.item) : undefined;
      mesh.visible = ghost !== undefined && item !== undefined;
      if (!ghost || !item) continue;
      const [w, h, d] = item.visual.size;
      mesh.scale.set(w, h, d);
      (mesh.material as THREE.MeshStandardMaterial).color.set(item.visual.color);
      mesh.position.set(ghost.at[0], ghost.at[1], ghost.at[2]);
    }
  }

  private make(player: RemotePlayer): Entry {
    const actor = new Actor(player.character, this.shadow, 3);
    for (const mesh of actor.model.meshes) mesh.layers.set(0);
    actor.model.shadows.body.castShadow = false;
    actor.model.shadows.coat.castShadow = false;
    actor.group.name = `player-${player.id}`;
    this.parent.add(actor.group);
    const tag = nameTag(player.name);
    this.parent.add(tag);
    const held = new THREE.Mesh(this.box, new THREE.MeshStandardMaterial({ roughness: 0.6 }));
    held.name = `held-${player.id}`;
    held.visible = false;
    actor.model.bones.handR.add(held);
    const entry: Entry = {
      actor,
      character: player.character,
      key: `player-${player.id}`,
      tag,
      // Nothing shown yet: the first pose dresses them (the profile's coat until then).
      gear: '\u0000',
      held,
      heldItem: null,
      zzz: [],
      person: {
        id: `player-${player.id}`,
        x: 0,
        z: 0,
        heading: 0,
        speed: 0,
        sit: false,
        gesture: 'idle',
        look: null,
        called: false,
        card: false,
        pen: null,
        pitch: 0,
      },
    };
    this.actors.set(player.id, entry);
    return entry;
  }

  private remove(id: string): void {
    const entry = this.actors.get(id);
    if (!entry) return;
    entry.actor.group.removeFromParent();
    entry.actor.dispose();
    (entry.held.material as THREE.Material).dispose();
    entry.tag.removeFromParent();
    entry.tag.material.map?.dispose();
    entry.tag.material.dispose();
    this.dropZzz(entry);
    this.contact.remove(entry.key);
    this.actors.delete(id);
  }
}

/** A name on a dark rounded label, always facing the camera, drawn over walls (never hidden). */
function nameTag(name: string): THREE.Sprite {
  const scale = 2;
  const font = `600 ${28 * scale}px system-ui, sans-serif`;
  const canvas = document.createElement('canvas');
  const g = canvas.getContext('2d');
  if (!g) throw new Error('No 2D canvas for a name tag');
  g.font = font;
  const width = Math.ceil(g.measureText(name).width) + 28 * scale;
  const height = 44 * scale;
  canvas.width = width;
  canvas.height = height;
  g.font = font;
  g.fillStyle = 'rgba(16, 22, 34, 0.72)';
  g.beginPath();
  g.roundRect(0, 0, width, height, height / 2);
  g.fill();
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(name, width / 2, height / 2 + scale);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set((TAG_H * width) / height, TAG_H, 1);
  sprite.renderOrder = 10;
  sprite.name = `name-${name}`;
  return sprite;
}
