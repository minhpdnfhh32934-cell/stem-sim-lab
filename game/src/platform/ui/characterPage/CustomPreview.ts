import * as THREE from 'three';
import { FrameClock } from '../../../core/FrameClock';
import type { CharacterDefinition } from '../../../gameplay/character';
import { SELF_LAYER } from '../../render/body/BodyModel';
import type { QualityConfig } from '../../render/quality';
import { Actor } from '../../render/body/actor';

/*
 * The customiser's picture (C-9): the character being made, standing on a lit disc, turned by
 * dragging; drawn again whole whenever a choice changes (`show`). Its own canvas, made when the
 * customiser opens and freed when it closes, in the character page's lazy chunk.
 */

export class CustomPreview {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(28, 1, 0.1, 20);
  private readonly shadowMaterial = new THREE.MeshBasicMaterial({ colorWrite: false });
  private readonly floor: THREE.Mesh;
  private readonly resize: ResizeObserver;
  private actor: Actor | null = null;
  private yaw = -0.35;
  private dragFrom: number | null = null;
  private frame = 0;
  /** Its own frame loop, kept to the game's frame-rate cap. */
  private readonly clock = new FrameClock(performance.now(), 0.1);
  private time = 0;

  constructor(
    private readonly host: HTMLElement,
    quality: QualityConfig,
    /** The game's frame-rate cap (0: none), read each frame. */
    private readonly cap: () => number,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.maxPixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = 'custom-preview-canvas';
    host.append(this.renderer.domElement);
    this.camera.layers.enable(SELF_LAYER);
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#8a7a66', 2.2));
    const key = new THREE.DirectionalLight('#ffffff', 1.5);
    key.position.set(-1.5, 3, 3);
    this.scene.add(key);
    this.floor = new THREE.Mesh(
      new THREE.CircleGeometry(0.6, 48),
      new THREE.MeshBasicMaterial({ color: '#cfdbe5' }),
    );
    this.floor.rotation.x = -Math.PI / 2;
    this.scene.add(this.floor);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', (e) => {
      this.dragFrom = e.clientX;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (this.dragFrom === null) return;
      this.yaw += (e.clientX - this.dragFrom) * 0.012;
      this.dragFrom = e.clientX;
    });
    canvas.addEventListener('pointerup', () => (this.dragFrom = null));
    canvas.addEventListener('pointercancel', () => (this.dragFrom = null));

    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(host);
    this.fit();
    this.frame = requestAnimationFrame(this.tick);
  }

  /** Draws `character` in place of the one before. */
  show(character: CharacterDefinition): void {
    if (this.actor) {
      this.scene.remove(this.actor.group);
      this.actor.dispose();
    }
    this.actor = new Actor(character, this.shadowMaterial, 0);
    this.scene.add(this.actor.group);
    const h = character.appearance.heightM;
    this.camera.position.set(0, h * 0.55, 4.6);
    this.camera.lookAt(0, h * 0.5, 0);
  }

  private fit(): void {
    const { clientWidth: w, clientHeight: h } = this.host;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private readonly tick = (now: number) => {
    this.frame = requestAnimationFrame(this.tick);
    const dt = this.clock.tick(now, this.cap());
    if (dt === null) return;
    this.time += dt;
    this.actor?.update(
      {
        id: this.actor.character.id,
        x: 0,
        z: 0,
        heading: Math.PI + this.yaw,
        speed: 0,
        sit: false,
        gesture: 'idle',
        look: null,
        called: false,
      },
      dt,
      this.time,
      null,
    );
    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.resize.disconnect();
    this.actor?.dispose();
    this.floor.geometry.dispose();
    (this.floor.material as THREE.Material).dispose();
    this.shadowMaterial.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
