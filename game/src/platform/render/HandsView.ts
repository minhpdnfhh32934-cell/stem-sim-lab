import * as THREE from 'three';
import type { Disposables } from '../../core/EventBus';
import type { Game } from '../../game/Game';
import type { WornOn } from '../../gameplay/item';
import type { HandMotion } from '../../gameplay/procedure/procedure';

const SHIRT = '#5b6b7d';
const FOAM = '#ffffff';
/** A quick step's motion (wet, soap, rinse, dry) plays this long after it is done. */
const AFTER_S = 0.9;

type Motion = HandMotion | 'rest' | 'raised';
const BOTH = [0, 1] as const;
const ONLY_RIGHT = [1] as const;
/**
 * Camera-space pose: position x, y, z (m), then rotation x, y, z (rad). Unturned, a hand lies palm
 * down, fingers ahead (−z), its thumb inwards — the body's hand (BodyView) — so palms come to face
 * each other turned thumbs up: the left hand by +z, the right by −z.
 */
type Pose = [number, number, number, number, number, number];

function set(o: Pose, px: number, py: number, pz: number, rx: number, ry: number, rz: number) {
  o[0] = px;
  o[1] = py;
  o[2] = pz;
  o[3] = rx;
  o[4] = ry;
  o[5] = rz;
}

/** The right hand as the mirror image of the left one. */
function mirror(from: Pose, to: Pose) {
  set(to, -from[0], from[1], from[2], from[3], -from[4], -from[5]);
}

/** Writes the left and right hand poses for a motion at time `t` (no allocation: per frame). */
export function posesFor(motion: Motion, t: number, l: Pose, r: Pose): void {
  const s = Math.sin(t * 9);
  switch (motion) {
    case 'rest':
      set(l, -0.2, -0.25, -0.42, 0.15, 0.15, 0);
      mirror(l, r);
      break;
    case 'raised': // after disinfection: hands kept up, touching nothing, until the gloves
      set(l, -0.16, -0.1, -0.42, 1.1, 0.1, 0);
      mirror(l, r);
      break;
    case 'wet':
    case 'rinse':
      set(l, -0.07, -0.27 + 0.006 * s, -0.5, -0.25, 0.1, 0.3);
      set(r, 0.07, -0.27 - 0.006 * s, -0.5, -0.25, -0.1, -0.3);
      break;
    case 'soap':
      set(l, -0.2, -0.25, -0.42, 0.15, 0.15, 0);
      set(r, 0.12, -0.2 - 0.012 * Math.abs(s), -0.5, 0, -0.2, -1.2);
      break;
    case 'rub-palms':
    case 'sanitize':
      set(l, -0.045, -0.22, -0.42 + 0.03 * s, 0.2, 0, 1.45);
      set(r, 0.045, -0.22, -0.42 - 0.03 * s, 0.2, 0, -1.45);
      break;
    case 'rub-backs':
      set(l, 0, -0.24, -0.42, 0.1, 0, 0);
      set(r, 0.02 * s, -0.215, -0.43, 0.1, 0.2 * s, 0);
      break;
    case 'rub-fingers':
      set(l, -0.04, -0.22, -0.44 + 0.025 * s, 0.2, 0.35, 1.45);
      set(r, 0.04, -0.22, -0.44 - 0.025 * s, 0.2, -0.35, -1.45);
      break;
    case 'rub-thumbs':
      set(l, -0.045, -0.22, -0.42, 0.2, 0, 1.45 + 0.35 * s);
      set(r, 0.045, -0.22, -0.42, 0.2, 0, -1.45 + 0.35 * s);
      break;
    case 'dry':
      set(l, -0.05, -0.23 + 0.01 * s, -0.45, 0.3, 0, 1.3);
      set(r, 0.05, -0.23 - 0.01 * s, -0.45, 0.3, 0, -1.3);
      break;
  }
}

interface Hand {
  readonly root: THREE.Group;
  readonly foam: THREE.Mesh;
  readonly pose: Pose;
}

/**
 * First-person hands and sleeves, drawn in front of the camera and on top of the world. What
 * they show is derived from game state when it changes (equipment, procedure events): sleeves
 * and hands take the colour of the PPE worn on the body and hands (white coat, blue gloves),
 * hands are foamy from soaping until rinsing, glossy while wet, raised after disinfection until
 * gloved, and they act out the hand-hygiene step being done (while a timed step runs, or briefly
 * after a quick one). Per frame only the animation runs, without allocating.
 * shortcut: box primitives and procedural motion; real rigged hands arrive with assets.
 */
export class HandsView {
  readonly group = new THREE.Group();
  private readonly skin = new THREE.MeshStandardMaterial({ roughness: 0.7 });
  private readonly sleeve = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  private readonly foamMaterial = new THREE.MeshStandardMaterial({ color: FOAM, roughness: 1 });
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly hands: readonly [Hand, Hand];
  /**
   * The left and right hands' poses (palm centre, fingers −z), in the camera's space: the body's
   * arms reach them (BodyView). Phase H-1: these hands are no longer drawn, the body's are.
   */
  readonly roots: readonly [THREE.Object3D, THREE.Object3D];
  /** Motion of the timed step in progress, from its start until it completes or is cancelled. */
  private timed: HandMotion | null = null;
  private recent: HandMotion | null = null;
  private recentLeft = 0;
  private raised = false;
  /** Acting out a motion (a hygiene step, raised after disinfection), not at rest. */
  posing = false;
  /** Soap on the hands, from taking it until rinsing (the body's hands draw the foam). */
  foamy = false;
  private time = 0;
  private readonly anchor = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly turn = new THREE.Quaternion();
  private readonly euler = new THREE.Euler();

  constructor(private readonly game: Game) {
    this.hands = [this.buildHand(), this.buildHand()];
    this.roots = [this.hands[0].root, this.hands[1].root];
  }

  /** Subscriptions live in the renderer's set, so they end with it. */
  attach(subscriptions: Disposables): void {
    const { events } = this.game;
    const s = subscriptions;
    s.add(
      events.subscribe('ProcedureStepStarted', ({ procedureId, stepId }) => {
        this.timed = this.stepOf(procedureId, stepId)?.hands ?? null;
      }),
    );
    s.add(events.subscribe('ProcedureStepCancelled', () => (this.timed = null)));
    s.add(
      events.subscribe('ProcedureStepCompleted', ({ procedureId, stepId }) => {
        const step = this.stepOf(procedureId, stepId);
        if (step?.hands && this.timed === null) {
          this.recent = step.hands;
          this.recentLeft = AFTER_S;
        }
        this.timed = null;
        this.refresh();
      }),
    );
    const refresh = () => this.refresh();
    for (const type of [
      'EquipmentChanged',
      'ProcedureEntered',
      'SceneLoaded',
      'SceneEntered',
    ] as const) {
      s.add(events.subscribe(type, refresh));
    }
    s.add(events.subscribe('GameLoaded', refresh));
    this.refresh();
  }

  update(dt: number): void {
    this.group.visible = this.game.state.session.phase === 'playing';
    if (!this.group.visible) return;
    this.time += dt;
    this.recentLeft = Math.max(0, this.recentLeft - dt);
    const motion =
      this.timed ?? (this.recentLeft > 0 ? this.recent : null) ?? (this.raised ? 'raised' : 'rest');
    this.posing = motion !== 'rest';
    const [left, right] = this.hands;
    posesFor(motion, this.time, left.pose, right.pose);
    this.atWork(motion, left.pose, right.pose);
    const ease = Math.min(1, dt * 14);
    for (let i = 0; i < 2; i++) {
      const { root, pose } = this.hands[i] ?? left;
      root.position.lerp(this.target.set(pose[0], pose[1], pose[2]), ease);
      root.quaternion.slerp(
        this.turn.setFromEuler(this.euler.set(pose[3], pose[4], pose[5])),
        ease,
      );
    }
  }

  /**
   * A hand-hygiene motion is done where it really is (Phú, 2026-11-04): its poses moved, as they
   * are, so that the hands are at what the hands work (`game.actions.work`: under the tap, under
   * the soap's nozzle, at the towels) — the soap's right hand under the nozzle, the left as it is.
   */
  private atWork(motion: Motion, l: Pose, r: Pose): void {
    if (motion === 'rest' || motion === 'raised') return;
    const work = this.game.actions.work;
    if (!work) return;
    this.group.updateWorldMatrix(true, false);
    this.group.worldToLocal(this.anchor.set(work[0], work[1], work[2]));
    const solo = motion === 'soap';
    const dx = this.anchor.x - (solo ? r[0] : (l[0] + r[0]) / 2);
    const dy = this.anchor.y - (solo ? r[1] : (l[1] + r[1]) / 2);
    const dz = this.anchor.z - (solo ? r[2] : (l[2] + r[2]) / 2);
    // Level, as hands are held over a basin, whatever the eyes' pitch: turned with the view they
    // pointed down along it, under the forearms, out of sight (Phú: only the sleeves were seen).
    const { pitch, glance } = this.game.state.player;
    for (const pose of solo ? ONLY_RIGHT : BOTH) {
      const p = pose === 0 ? l : r;
      p[0] += dx;
      p[1] += dy;
      p[2] += dz;
      p[3] -= pitch + glance;
    }
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    this.skin.dispose();
    this.sleeve.dispose();
    this.foamMaterial.dispose();
  }

  /** Colours, foam, wetness and the raised pose, from equipment and procedure progress. */
  private refresh(): void {
    const { state, procedures, content } = this.game;
    const active = procedures.activeProcedure();
    const view = active ? procedures.view(active.id) : null;
    const last = view?.lastHands ?? null;
    const gloves = this.wornOn('hands');
    const skinTone = state.player.characterId
      ? content.characters.tryGet(state.player.characterId)?.appearance.skinTone
      : undefined;
    this.skin.color.set(gloves ?? skinTone ?? '#c99a7a');
    this.skin.roughness = !gloves && (last === 'wet' || last === 'rinse') ? 0.2 : 0.7;
    this.sleeve.color.set(this.wornOn('body') ?? SHIRT);
    // The body's hands show the foam (BodyView); these boxes only pose, never drawn (Phú: their
    // foam showed as two white blocks at the bottom of the view once the soap was taken).
    this.foamy = !gloves && (last === 'soap' || (last?.startsWith('rub-') ?? false));
    this.raised = last === 'sanitize' && !gloves && view?.status !== 'entered';
    if (!active) this.timed = null;
  }

  private stepOf(procedureId: string, stepId: string) {
    return this.game.content.procedures.tryGet(procedureId)?.steps.find((s) => s.id === stepId);
  }

  /** Colour of what is worn on `slot`, if anything. */
  private wornOn(slot: WornOn): string | undefined {
    const { equipment, content } = this.game;
    for (const id of equipment.worn) {
      const item = content.items.tryGet(id);
      if (item?.wornOn === slot) return item.visual.color;
    }
    return undefined;
  }

  /** A palm (fingers towards −z), its sleeve behind it and a foam layer on top. */
  private buildHand(): Hand {
    const root = new THREE.Group();
    const part = (size: [number, number, number], material: THREE.Material, z: number) => {
      const geometry = new THREE.BoxGeometry(...size);
      this.geometries.push(geometry);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.z = z;
      // Always drawn over the world, so hands never vanish into a wall in front of the player.
      material.depthTest = false;
      mesh.renderOrder = 10;
      mesh.visible = false; // the body's hands are drawn (BodyView); this one only poses
      root.add(mesh);
      return mesh;
    };
    part([0.085, 0.028, 0.17], this.skin, 0);
    part([0.095, 0.095, 0.3], this.sleeve, 0.23);
    const foam = part([0.075, 0.012, 0.12], this.foamMaterial, 0.01);
    foam.position.y = 0.02;
    foam.renderOrder = 11;
    this.group.add(root);
    return { root, foam, pose: [0, 0, 0, 0, 0, 0] };
  }
}
