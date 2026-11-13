import * as THREE from 'three';
import type { Vec3 } from '../../core/math';

/** Seconds to glide from the player's eye to the close view and back. */
const GLIDE_S = 0.45;
/** The close view looks down at the apparatus by this much (rad). */
const ELEVATION = 0.5;
/** Never nearer than this (m): a small apparatus is not filled edge to edge. */
const NEAREST_M = 0.8;
/** Room around the labelled parts in the view (×), and around each of them (m). */
const MARGIN = 1.2;
const PART_PAD_M = 0.12;
/** The close view keeps this far (m) inside the apparatus' room: never in a wall or a neighbour. */
const ROOM_MARGIN = 0.35;
/** The panel covers the right of the screen: the apparatus is drawn this far left of the middle. */
const LEFT_SHIFT = 0.3;

/** Where an Explain label points, on the screen (CSS px from the top left). */
export interface ExplainAnchor {
  readonly id: string;
  x: number;
  y: number;
  /** In front of the camera and on the screen. */
  shown: boolean;
}

/** A part of the apparatus to point at: a named object of its model, or a point in its frame. */
export type AnchorSpec = { readonly part: string } | { readonly at: Vec3 };

/**
 * The Explain view's camera (Phase X): from the player's eye it glides to a close view of a
 * station's apparatus — in front of it, a little above, far enough to hold all of it — and back
 * when the view closes. The player's own camera is set first each frame; this blends it. It also
 * puts the view's labels on the screen. Nothing here is allocated per frame.
 */
export class ExplainFraming {
  private amount = 0;
  private target: THREE.Object3D | null = null;
  private readonly goal = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly goalTurn = new THREE.Quaternion();
  private readonly box = new THREE.Box3();
  private readonly sphere = new THREE.Sphere();
  private readonly point = new THREE.Vector3();
  private readonly turn = new THREE.Matrix4();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly anchors: ExplainAnchor[] = [];

  /**
   * Frames `group` (an apparatus' view, turned by its entity's yaw), or none (glides back): what
   * is held in view is its labelled `parts` (what the view is about; the whole apparatus without
   * any), and the close view stays inside `room` (its bounds, m), nearer if it must; looked at
   * `shift` (of the view's half-width) to its right, so it stands left of the panel (a board: none).
   */
  frame(
    group: THREE.Object3D | null,
    yaw: number,
    camera: THREE.PerspectiveCamera,
    parts: readonly { readonly anchor: AnchorSpec }[] = [],
    room?: { readonly min: Readonly<Vec3>; readonly max: Readonly<Vec3> },
    view?: { readonly from: Vec3; readonly to?: Vec3 | undefined },
    shift = LEFT_SHIFT,
  ): void {
    this.target = group;
    if (!group) return;
    group.updateWorldMatrix(true, true);
    const held = new THREE.Box3();
    for (const part of parts) {
      if (this.locate(group, part.anchor)) held.expandByPoint(this.point);
    }
    if (held.isEmpty()) held.setFromObject(group);
    held.getBoundingSphere(this.sphere);
    this.sphere.radius += PART_PAD_M;
    const vertical = THREE.MathUtils.degToRad(camera.fov) / 2;
    const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
    const half = Math.min(vertical, horizontal);
    const distance = Math.max(NEAREST_M, (this.sphere.radius * MARGIN) / Math.sin(half));
    // In front of it (its +z), raised by ELEVATION.
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const c = this.sphere.center;
    const across = distance * Math.cos(ELEVATION);
    this.goal.set(c.x + fx * across, c.y + distance * Math.sin(ELEVATION), c.z + fz * across);
    if (view) {
      this.goal.fromArray(view.from).applyMatrix4(group.matrixWorld);
      if (view.to) c.fromArray(view.to).applyMatrix4(group.matrixWorld);
    }
    if (room) {
      const clamp = (v: number, lo: number, hi: number) =>
        lo + ROOM_MARGIN <= hi - ROOM_MARGIN
          ? Math.min(Math.max(v, lo + ROOM_MARGIN), hi - ROOM_MARGIN)
          : (lo + hi) / 2;
      this.goal.set(
        clamp(this.goal.x, room.min[0], room.max[0]),
        clamp(this.goal.y, room.min[1], room.max[1]),
        clamp(this.goal.z, room.min[2], room.max[2]),
      );
    }
    // Looked at a little to its right (across the view), so it stands left of the panel.
    const ax = c.x - this.goal.x;
    const az = c.z - this.goal.z;
    const along = Math.hypot(ax, az) || 1;
    const aside = shift * Math.hypot(ax, c.y - this.goal.y, az) * Math.tan(horizontal);
    this.look.set(c.x - (az / along) * aside, c.y, c.z + (ax / along) * aside);
    // A camera looks down its −z: Matrix4.lookAt's convention (Object3D.lookAt turns +z instead).
    this.goalTurn.setFromRotationMatrix(this.turn.lookAt(this.goal, this.look, this.up));
  }

  /** How far into the close view (0 the player's eye, 1 framed). */
  get blend(): number {
    return this.amount;
  }

  /** Blends `camera`, already at the player's eye, towards the close view while one is framed. */
  apply(camera: THREE.PerspectiveCamera, dt: number): void {
    const step = dt / GLIDE_S;
    this.amount = this.target ? Math.min(1, this.amount + step) : Math.max(0, this.amount - step);
    if (this.amount <= 0) return;
    const t = this.amount * this.amount * (3 - 2 * this.amount); // smoothstep
    camera.position.lerp(this.goal, t);
    camera.quaternion.slerp(this.goalTurn, t);
    camera.updateMatrixWorld();
  }

  /** The framed apparatus' part `spec` (world, m) into `out`; false if none is framed or it is not there. */
  pointAt(spec: AnchorSpec, out: THREE.Vector3): boolean {
    if (!this.target || !this.locate(this.target, spec)) return false;
    out.copy(this.point);
    return true;
  }

  /** Puts the anchor's point (world) in `point`; false when its named object is not there. */
  private locate(group: THREE.Object3D, spec: AnchorSpec): boolean {
    if ('part' in spec) {
      const object = group.getObjectByName(spec.part);
      if (!object?.visible) return false; // not there, or hidden (a ray before the run)
      // An instanced part with nothing drawn yet (cells before the run) has an empty box: its origin.
      if (this.box.setFromObject(object).isEmpty()) object.getWorldPosition(this.point);
      else this.box.getCenter(this.point);
    } else {
      this.point.fromArray(spec.at).applyMatrix4(group.matrixWorld);
    }
    return true;
  }

  /**
   * The labels' points on a `width` × `height` CSS px view, in `parts`' order: a named object's
   * centre (it follows the object) or a point in the apparatus' frame. Reuses its array.
   */
  place(
    parts: readonly { readonly id: string; readonly anchor: AnchorSpec }[],
    camera: THREE.Camera,
    width: number,
    height: number,
  ): readonly ExplainAnchor[] {
    const group = this.target;
    this.anchors.length = parts.length;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;
      const anchor = (this.anchors[i] ??= { id: part.id, x: 0, y: 0, shown: false });
      (anchor as { id: string }).id = part.id;
      anchor.shown = false;
      if (!group) continue;
      if (!this.locate(group, part.anchor)) continue;
      this.point.project(camera);
      anchor.x = ((this.point.x + 1) / 2) * width;
      anchor.y = ((1 - this.point.y) / 2) * height;
      anchor.shown = this.point.z < 1 && Math.abs(this.point.x) <= 1 && Math.abs(this.point.y) <= 1;
    }
    return this.anchors;
  }
}
