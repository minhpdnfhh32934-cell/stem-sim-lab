import * as THREE from 'three';
import { FrameClock } from '../../../core/FrameClock';
import type { CharacterDefinition } from '../../../gameplay/character';
import { SELF_LAYER, SHADOW_LAYER } from '../../render/body/BodyModel';
import type { QualityConfig } from '../../render/quality';
import { Actor } from '../../render/body/actor';
import { commonRoom } from './room';
import { Seating } from './seating';

/*
 * The character page's 3D stage (contract D5: its own lazy chunk and WebGL canvas, made when the
 * page opens, freed when it closes): the common room with everyone in it at once, in their places
 * (`seating.ts`), seen from a fixed camera (C-9, Phú 2026-11-08). "<" and ">" (or a click on a
 * person) choose, left to right; the one chosen stays where they are, looks at the camera and is
 * lit up. The last place is the player's own character: a black silhouette until they make one.
 */

const CAMERA = { x: 0.3, y: 1.5, z: 6.2, lookY: 0.95, lookZ: -2.4, fov: 36 };

export class CharacterStage {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, 0.1, 40);
  private readonly room;
  private readonly actors: Actor[];
  private readonly seating: Seating;
  private readonly shadowMaterial = new THREE.MeshBasicMaterial({ colorWrite: false });
  private readonly resize: ResizeObserver;
  private frame = 0;
  /** Its own frame loop, kept to the game's frame-rate cap (it was every display frame). */
  private readonly clock = new FrameClock(performance.now(), 0.1);
  private time = 0;
  private readonly looks = new Map<string, { x: number; z: number }>();
  private readonly point = new THREE.Vector3();

  /**
   * `people`: who is where, by place (left to right; the last the player's own, drawn as a
   * silhouette while `silhouette`); `first`: chosen.
   */
  constructor(
    private readonly host: HTMLElement,
    people: readonly CharacterDefinition[],
    first: string,
    quality: QualityConfig,
    silhouette: boolean,
    /** The game's frame-rate cap (0: none), read each frame. */
    private readonly cap: () => number,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.maxPixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = quality.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.className = 'character-stage-canvas';
    host.append(this.renderer.domElement);

    this.scene.background = new THREE.Color('#dfe6ea');
    this.scene.fog = new THREE.Fog('#dfe6ea', 11, 20);
    this.room = commonRoom(quality.shadows);
    this.scene.add(this.room.group);
    // The body's head and arms are hidden from the player's own eyes in the world; here they are
    // seen, and its shadow-only meshes cast the shadows.
    this.camera.layers.enable(SELF_LAYER);
    this.scene.traverse((o) => {
      if (o instanceof THREE.DirectionalLight && o.castShadow) {
        o.shadow.camera.layers.enable(SHADOW_LAYER);
      }
    });
    this.camera.position.set(CAMERA.x, CAMERA.y, CAMERA.z);
    this.camera.lookAt(CAMERA.x, CAMERA.lookY, CAMERA.lookZ);

    const last = people.length - 1;
    this.actors = people.map(
      (c, i) => new Actor(c, this.shadowMaterial, i, silhouette && i === last),
    );
    for (const a of this.actors) this.scene.add(a.group);
    this.seating = new Seating(
      people.map((c) => c.id),
      first,
    );

    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(host);
    this.fit();
    this.frame = requestAnimationFrame(this.tick);
  }

  /** Who is chosen. */
  get chosen(): string {
    return this.seating.selected;
  }

  /** The next (1) or previous (−1) place to the right or left, wrapping; returns who. */
  step(direction: 1 | -1): string {
    return this.seating.step(direction);
  }

  select(id: string): void {
    this.seating.select(id);
  }

  /**
   * Who stands or sits under the screen point (client px), the nearest to the camera if two
   * overlap, or null: each person as an upright box from the floor to the top of their head.
   */
  pick(clientX: number, clientY: number): string | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = 1 - ((clientY - rect.top) / rect.height) * 2;
    let best: string | null = null;
    let nearest = Infinity;
    for (const actor of this.actors) {
      const g = actor.group.position;
      const top = actor.top();
      const feet = this.point.set(g.x, g.y, g.z).project(this.camera);
      const fy = feet.y;
      const fx = feet.x;
      const head = this.point.set(g.x, g.y + top, g.z).project(this.camera);
      const half = (head.y - fy) * 0.16 * (rect.height / rect.width);
      if (y < fy || y > head.y || Math.abs(x - fx) > half) continue;
      const distance = this.camera.position.distanceTo(actor.group.position);
      if (distance < nearest) {
        nearest = distance;
        best = actor.character.id;
      }
    }
    return best;
  }

  private fit(): void {
    const { clientWidth: w, clientHeight: h } = this.host;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // A narrow window still has everyone in view: as much width as a 16:9 one.
    const wide = 16 / 9;
    const half = Math.tan(THREE.MathUtils.degToRad(CAMERA.fov / 2));
    this.camera.fov =
      w / h < wide ? THREE.MathUtils.radToDeg(2 * Math.atan((half * wide * h) / w)) : CAMERA.fov;
    this.camera.updateProjectionMatrix();
  }

  private readonly tick = (now: number) => {
    this.frame = requestAnimationFrame(this.tick);
    const dt = this.clock.tick(now, this.cap());
    if (dt === null) return;
    this.time += dt;
    this.seating.update(dt);
    const views = this.seating.view();
    for (const v of views) this.looks.set(v.id, { x: v.x, z: v.z });
    const camera = { x: CAMERA.x, z: CAMERA.z };
    for (const [i, v] of views.entries()) {
      const look = v.look === 'camera' ? camera : v.look ? (this.looks.get(v.look) ?? null) : null;
      this.actors[i]?.update(v, dt, this.time, look);
    }
    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.resize.disconnect();
    for (const a of this.actors) a.dispose();
    this.room.dispose();
    this.shadowMaterial.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}

/**
 * A head-and-shoulders picture of `character` (a data URL), for the menu's row: drawn once on a
 * small canvas of its own, then freed.
 */
export function portrait(character: CharacterDefinition, size = 128): string {
  const canvas = document.createElement('canvas');
  canvas.dataset.role = 'portrait'; // never in the page: drawn, read and freed
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const shadow = new THREE.MeshBasicMaterial({ colorWrite: false });
  const actor = new Actor(character, shadow, 0);
  actor.update(
    {
      id: character.id,
      x: 0,
      z: 0,
      heading: Math.PI,
      speed: 0,
      sit: false,
      gesture: 'idle',
      look: null,
      called: false,
    },
    1,
    0,
    null,
  );
  scene.add(actor.group, new THREE.HemisphereLight('#ffffff', '#8a7a66', 2.2));
  const key = new THREE.DirectionalLight('#ffffff', 1.4);
  key.position.set(-1, 2, 3);
  scene.add(key);
  const h = character.appearance.heightM;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 10);
  camera.layers.enable(SELF_LAYER);
  camera.position.set(0, h * 0.86, 1.05);
  camera.lookAt(0, h * 0.86, 0);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  actor.dispose();
  shadow.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return url;
}
