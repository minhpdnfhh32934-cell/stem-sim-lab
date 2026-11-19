import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import type { WorldEntity } from '../../world/World';
import { SELF_LAYER } from './body/BodyModel';

/** The farthest a mirror reflects from (m): beyond it its glass shows no reflection (cost). */
const RANGE = 6;
/** The glass's tint: the washroom mirror's silvered glass (palette `mirror`). */
const TINT = 0xdfe8ec;

/** Where a mirror's glass is on the drawing buffer (pixels from its top left). */
export interface ScreenRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** A camera a reflection is taken for, and its part of the view (see Mirrors.cropped). */
export interface GlassView {
  readonly camera: THREE.Camera;
  /** [x, y, w, h] of the view from its top left, in fractions of it, mirrored left to right. */
  readonly part: readonly [number, number, number, number];
}

/** What a mirror's glass made by another device needs from Mirrors. */
export interface GlassSpec {
  /** Its target's size, in fractions of the drawing buffer. */
  readonly scale: number;
  readonly tint: number;
  /** The camera the reflection is taken for when `camera` draws (its layers too). */
  view(camera: THREE.Camera): GlassView;
  /** What a reflection must not show (the first-person hands, the mirrors) hidden or shown. */
  hide(hidden: boolean): void;
}

/** A mirror's glass, freed by `dispose`. */
export type Glass = THREE.Mesh & { dispose(): void };

/** Makes a mirror's glass for a device other than WebGL (Ultra's WebGPU: gpu/mirror.ts). */
export type MirrorGlass = (geometry: THREE.PlaneGeometry, spec: GlassSpec) => Glass;

const clip = new THREE.Vector4();

/**
 * The rectangle of the drawing buffer (`width` × `height` px) that points cover, seen through
 * `viewProjection`, two pixels wider each way; null when any of them is behind the eye (the
 * reflection then renders the whole view) or when it covers almost all of it anyway.
 */
export function screenRect(
  points: readonly THREE.Vector3[],
  viewProjection: THREE.Matrix4,
  width: number,
  height: number,
): ScreenRect | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    clip.set(p.x, p.y, p.z, 1).applyMatrix4(viewProjection);
    if (clip.w <= 1e-4) return null;
    const x = ((clip.x / clip.w + 1) / 2) * width;
    const y = ((1 - clip.y / clip.w) / 2) * height;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  x0 = Math.max(0, Math.floor(x0) - 2);
  y0 = Math.max(0, Math.floor(y0) - 2);
  x1 = Math.min(width, Math.ceil(x1) + 2);
  y1 = Math.min(height, Math.ceil(y1) + 2);
  if (x1 - x0 < 4 || y1 - y0 < 4) return null;
  if ((x1 - x0) * (y1 - y0) > 0.9 * width * height) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * Where the glass's rectangle (`rect` on a view `width` px wide) is in the reflection's camera:
 * mirrored left to right. The reflected camera is a turn, not a mirror (three's Reflector), so a
 * point of the glass at x across the view is at −x across its own; only a glass in the middle of
 * the view is where it is. (Cropped where it is, an off-middle glass got the wrong part of the
 * reflection: streaks pulled from its edges, Phú 2026-11-08.)
 */
export function reflectedOffset(rect: ScreenRect, width: number): [number, number] {
  return [width - rect.x - rect.w, rect.y];
}

/**
 * Real mirrors (Phase H-1, contract H3): a reflection (a mirrored camera into a render target,
 * three's Reflector) over the glass of every mirror prop, at the preset's scale of the drawing
 * buffer (High 1, Medium 0.5, Low none: the glass alone). A mirror reflects only while it is in view
 * (three draws it only then) and within RANGE; it sees the player's whole body (SELF_LAYER) and
 * never the first-person hands drawn over the view, nor another mirror. The reflection is drawn
 * for the glass's own rectangle of the view only (a view offset of the camera it reflects), so
 * the whole render target goes on the glass: sharp at any preset (it was a blurred half-size view
 * at Medium, Phú 2026-11-08), at no more cost.
 */
export class Mirrors {
  readonly group = new THREE.Group();
  private readonly entities = new Map<string, WorldEntity>();
  private readonly reflectors = new Map<string, Glass>();
  /** The glass's maker under WebGPU; null: three's Reflector (WebGL). */
  private glass: MirrorGlass | null = null;
  private scale = 0;
  private width = 1;
  private height = 1;
  private readonly at = new THREE.Vector3();
  /** The view a reflection is drawn for: the player's camera cropped to the glass. */
  private readonly crop = new THREE.PerspectiveCamera();
  private readonly viewProjection = new THREE.Matrix4();
  private readonly corners = [0, 1, 2, 3].map(() => new THREE.Vector3());
  /** cropped's answer, reused (no allocation a frame). */
  private readonly seen: { camera: THREE.Camera; part: [number, number, number, number] } = {
    camera: this.crop,
    part: [0, 0, 1, 1],
  };

  /** `hidden`: what the reflection must not show (the first-person hands). */
  constructor(private readonly hidden: THREE.Object3D) {}

  /** The device's glass (null: WebGL's Reflector): every mirror made again with it. */
  useGlass(make: MirrorGlass | null): void {
    if (make === this.glass) return;
    for (const id of [...this.reflectors.keys()]) this.drop(id);
    this.glass = make;
    for (const entity of this.entities.values()) this.build(entity);
  }

  /** A spawned entity: a mirror if its prop is one. */
  add(entity: WorldEntity): void {
    if (entity.item.visual.prop !== 'mirror') return;
    this.entities.set(entity.id, entity);
    this.build(entity);
  }

  remove(entityId: string): void {
    this.entities.delete(entityId);
    this.drop(entityId);
  }

  /** The preset's scale of the drawing buffer (`width` × `height` device pixels); 0: none. */
  setScale(scale: number, width: number, height: number): void {
    const size = (v: number) => Math.max(1, Math.round(v * scale));
    if (scale === this.scale && width === this.width && height === this.height) return;
    const rebuild = scale !== this.scale;
    this.scale = scale;
    this.width = width;
    this.height = height;
    if (rebuild) {
      for (const id of [...this.reflectors.keys()]) this.drop(id);
      for (const entity of this.entities.values()) this.build(entity);
      return;
    }
    for (const reflector of this.reflectors.values()) {
      // (WebGPU's reflector sizes its target by the drawing buffer itself.)
      if (reflector instanceof Reflector)
        reflector.getRenderTarget().setSize(size(width), size(height));
    }
  }

  /** Each frame: a mirror out of range is not drawn (its reflection not rendered). */
  update(eye: THREE.Vector3): void {
    for (const reflector of this.reflectors.values()) {
      reflector.visible = reflector.getWorldPosition(this.at).distanceTo(eye) < RANGE;
    }
  }

  dispose(): void {
    for (const id of [...this.reflectors.keys()]) this.drop(id);
    this.entities.clear();
  }

  /**
   * The player's camera cropped to a mirror's glass on the view, seeing what a reflection sees,
   * and that crop's part of the view; uncropped (the whole view) where the glass's rectangle
   * cannot be had, the camera itself if it is not a plain perspective one.
   */
  private cropped(
    glass: THREE.Object3D,
    camera: THREE.Camera,
    half: readonly [number, number],
  ): GlassView {
    const { seen } = this;
    seen.part[0] = 0;
    seen.part[1] = 0;
    seen.part[2] = 1;
    seen.part[3] = 1;
    seen.camera = camera;
    // A camera with a view offset (WebGPU's TRAA jitter) is cropped too, its jitter dropped: given
    // back as it was, its reflection lost the body's head (SELF_LAYER), Phú 2026-11-17.
    if (!(camera instanceof THREE.PerspectiveCamera)) return seen;
    this.corners.forEach((p, i) =>
      p
        .set(i % 2 === 0 ? -half[0] : half[0], i < 2 ? -half[1] : half[1], 0)
        .applyMatrix4(glass.matrixWorld),
    );
    this.viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const rect = screenRect(this.corners, this.viewProjection, this.width, this.height);
    this.crop.copy(camera, false); // never its children (the first-person hands)
    // The whole body and neither the hands drawn over the view nor a mirror (WebGPU's reflection
    // takes this camera's layers; WebGL's Reflector sets its own, in build).
    this.crop.layers.set(0);
    this.crop.layers.enable(SELF_LAYER);
    seen.camera = this.crop;
    if (!rect) {
      this.crop.clearViewOffset();
      return seen;
    }
    const [x, y] = reflectedOffset(rect, this.width);
    this.crop.setViewOffset(this.width, this.height, x, y, rect.w, rect.h);
    seen.part[0] = x / this.width;
    seen.part[1] = y / this.height;
    seen.part[2] = rect.w / this.width;
    seen.part[3] = rect.h / this.height;
    return seen;
  }

  private hide(hidden: boolean): void {
    this.hidden.visible = !hidden;
    this.group.visible = !hidden;
  }

  private build(entity: WorldEntity): void {
    if (this.scale <= 0) return;
    const [w, h, d] = entity.item.visual.size;
    // The glass inside the prop's frame (props/washroom.ts `mirror`), 0.5 mm in front of it.
    const frame = Math.min(0.015, w / 10, h / 10);
    const front = d / 2 - Math.min(0.004, d / 5) + 0.0005;
    const plane = new THREE.PlaneGeometry(w - 2 * frame, h - 2 * frame);
    const half = [(w - 2 * frame) / 2, (h - 2 * frame) / 2] as const;
    let reflector: Glass;
    if (this.glass) {
      reflector = this.glass(plane, {
        scale: this.scale,
        tint: TINT,
        view: (camera) => this.cropped(reflector, camera, half), // when drawn: made by then
        hide: (hidden) => this.hide(hidden),
      });
    } else reflector = this.reflector(plane, half);
    reflector.name = `mirror ${entity.id}`;
    reflector.position.fromArray(entity.pose.position);
    reflector.quaternion.fromArray(entity.pose.rotation);
    reflector.translateZ(front);
    this.group.add(reflector);
    this.reflectors.set(entity.id, reflector);
  }

  /** WebGL's glass: three's Reflector, drawn for the crop (cropped) with what it must not show hidden. */
  private reflector(plane: THREE.PlaneGeometry, half: readonly [number, number]): Reflector {
    const reflector = new Reflector(plane, {
      textureWidth: Math.max(1, Math.round(this.width * this.scale)),
      textureHeight: Math.max(1, Math.round(this.height * this.scale)),
      color: TINT,
      clipBias: 0.003,
      multisample: this.scale >= 1 ? 4 : 0,
    });
    // The reflection sees the whole body, and neither the hands drawn over the view nor a mirror.
    const camera = reflector.getReflectionCamera.bind(reflector);
    reflector.getReflectionCamera = (from: THREE.Camera) => {
      const reflection = camera(from);
      reflection.layers.set(0);
      reflection.layers.enable(SELF_LAYER);
      return reflection;
    };
    const render = reflector.onBeforeRender.bind(reflector);
    reflector.onBeforeRender = (renderer, scene, camera, ...rest) => {
      this.hide(true);
      try {
        render(renderer, scene, this.cropped(reflector, camera, half).camera, ...rest);
      } finally {
        this.hide(false);
      }
    };
    return reflector;
  }

  private drop(entityId: string): void {
    const reflector = this.reflectors.get(entityId);
    if (!reflector) return;
    reflector.removeFromParent();
    reflector.geometry.dispose();
    reflector.dispose();
    this.reflectors.delete(entityId);
  }
}
