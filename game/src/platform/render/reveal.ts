import * as THREE from 'three';
import type { WorldEntity } from '../../world/World';

/** Seconds a display takes to come out or go away. */
const DURATION_S = 0.6;
/** Shown within `radius` m; hidden only past `radius` + this (no flicker at the edge). */
const HYSTERESIS_M = 0.4;
/** An overhead panel's tilt down towards the player (rad). */
const TILT = (25 * Math.PI) / 180;
/** How far (m) an overhead panel slides down as it fades in. */
const SLIDE_M = 0.12;
/** The glass of a panel's body and a screen's: their opacity when shown. */
const PANEL_GLASS = 0.08;
const SCREEN_GLASS = 0.12;
const SCREEN_OPACITY = 0.88;
const HOUSING = '#1c232b';

/** Whether a display wants to be shown at `distance`: in, out, or as it was in between. */
export function revealWanted(distance: number, radius: number, shown: boolean): boolean {
  if (distance <= radius) return true;
  if (distance > radius + HYSTERESIS_M) return false;
  return shown;
}

/** The reveal's progress `t` (0 hidden … 1 shown) after `dt` s towards `shown`. */
export function revealStep(t: number, shown: boolean, dt: number): number {
  const step = dt / DURATION_S;
  return shown ? Math.min(1, t + step) : Math.max(0, t - step);
}

/** Smoothstep: the drawn amount of a reveal at progress `t`. */
export const revealEase = (t: number): number => t * t * (3 - 2 * t);

interface Fade {
  material: THREE.Material & { opacity: number };
  /** Its opacity when fully shown. */
  full: number;
  /** Cloned here (a shared label's): freed here. */
  own: boolean;
}

interface Reveal {
  kind: 'rise' | 'overhead';
  x: number;
  z: number;
  radius: number;
  lift: THREE.Group;
  fades: Fade[];
  housing: THREE.Mesh | null;
  shown: boolean;
  t: number;
}

/**
 * The see-through displays shown only near the player (Phú, Phase T-1a): a results screen rolls
 * up out of a slot under it, an instruction panel hung over its station fades in tilted down.
 * Drawing only (aiming uses the item's box, actions are unchanged); per frame only distances,
 * scales and opacities, no allocation.
 */
export class Reveals {
  private readonly entries = new Map<string, Reveal>();

  /**
   * Makes `group` (an entity's view, fully built: body, label, screen) a reveal: its parts on a
   * lift (scaled up from its bottom edge, or tilted and faded), their materials see-through.
   * `body` is the entity's own material; a label's is shared, so it is cloned here.
   */
  add(entity: WorldEntity, group: THREE.Group, body: THREE.MeshStandardMaterial): void {
    const reveal = entity.item.visual.reveal;
    if (!reveal || this.entries.has(entity.id)) return;
    const [w, h, d] = entity.item.visual.size;
    const lift = new THREE.Group();
    for (const child of [...group.children]) lift.add(child);
    group.add(lift);
    const fades: Fade[] = [];
    lift.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const mesh = object;
      mesh.castShadow = false;
      const material = mesh.material as THREE.Material & { opacity: number };
      if (material === body) {
        body.transparent = true;
        body.depthWrite = false;
        body.color.set(reveal.kind === 'rise' ? '#0b1a26' : '#8fd3ff');
        body.roughness = 0.08;
        body.metalness = 0;
        fades.push({
          material: body,
          full: reveal.kind === 'rise' ? SCREEN_GLASS : PANEL_GLASS,
          own: false,
        });
        return;
      }
      const own = mesh.userData.sharedMaterial === true;
      const used = own ? material.clone() : material;
      if (own) mesh.material = used;
      used.transparent = true;
      used.depthWrite = false;
      fades.push({ material: used, full: reveal.kind === 'rise' ? SCREEN_OPACITY : 1, own });
    });
    let housing: THREE.Mesh | null = null;
    if (reveal.kind === 'rise') {
      // Rolls up from its bottom edge, out of a slot that stays in sight.
      lift.position.y = -h / 2;
      for (const child of lift.children) child.position.y += h / 2;
      housing = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.04, 0.035, d + 0.03),
        new THREE.MeshStandardMaterial({ color: HOUSING, roughness: 0.5 }),
      );
      housing.position.y = -h / 2 - 0.0175;
      housing.castShadow = false;
      group.add(housing);
    } else {
      lift.rotation.x = TILT;
    }
    const [x, , z] = entity.pose.position;
    const entry: Reveal = {
      kind: reveal.kind,
      x,
      z,
      radius: reveal.radius,
      lift,
      fades,
      housing,
      shown: false,
      t: 0,
    };
    this.entries.set(entity.id, entry);
    this.draw(entry);
  }

  remove(entityId: string): void {
    const entry = this.entries.get(entityId);
    if (!entry) return;
    for (const fade of entry.fades) if (fade.own) fade.material.dispose();
    if (entry.housing) {
      entry.housing.removeFromParent();
      entry.housing.geometry.dispose();
      (entry.housing.material as THREE.Material).dispose();
    }
    this.entries.delete(entityId);
  }

  /** Each frame: every display towards shown or hidden by the player's distance to it. */
  update(dt: number, x: number, z: number): void {
    for (const entry of this.entries.values()) {
      const distance = Math.hypot(entry.x - x, entry.z - z);
      entry.shown = revealWanted(distance, entry.radius, entry.shown);
      const t = revealStep(entry.t, entry.shown, dt);
      if (t === entry.t) continue;
      entry.t = t;
      this.draw(entry);
    }
  }

  dispose(): void {
    for (const id of [...this.entries.keys()]) this.remove(id);
  }

  private draw(entry: Reveal): void {
    const s = revealEase(entry.t);
    entry.lift.visible = s > 0.002;
    if (entry.kind === 'rise') {
      entry.lift.scale.y = Math.max(s, 0.001);
    } else {
      entry.lift.position.y = (1 - s) * SLIDE_M;
      for (const fade of entry.fades) fade.material.opacity = fade.full * s;
      return;
    }
    for (const fade of entry.fades) fade.material.opacity = fade.full;
  }
}
