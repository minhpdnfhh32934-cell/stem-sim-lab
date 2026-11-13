import * as THREE from 'three';
import type { Game } from '../../game/Game';
import type { WorldEntity } from '../../world/World';
import { laptopKeyboard, laptopLightBar, laptopScreen } from './props/laptop';

/** How fast the light bar's colours run round (hue turns a second). */
const RGB_TURNS_PER_S = 0.12;

/**
 * The hub's laptop alive (Phase F-2): its screen lit (the SimLab wallpaper and "E" to use it), its
 * light bar along the front running through the colours, the keyboard's backlight following it.
 * Unlit materials over the prop (`props/laptop.ts`, which lays out where they are). One laptop is
 * looked for while its scene is in.
 */
export class LaptopView {
  private readonly holder = new THREE.Group();
  private readonly screenMaterial = new THREE.MeshBasicMaterial({ toneMapped: false });
  private readonly barMaterial = new THREE.MeshBasicMaterial({ toneMapped: false });
  private readonly keysMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.12,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  private readonly geometries: THREE.BufferGeometry[] = [];
  private texture: THREE.CanvasTexture | null = null;
  private entityId: string | null = null;
  private clock = 0;
  private sinceLook = Infinity;

  constructor(
    parent: THREE.Object3D,
    private readonly game: Game,
  ) {
    this.holder.name = 'laptop';
    this.holder.visible = false;
    parent.add(this.holder);
  }

  update(dt: number): void {
    this.clock += dt;
    this.sinceLook += dt;
    if (this.sinceLook > 1) {
      this.sinceLook = 0;
      const entity = this.find();
      if (!entity) {
        this.holder.visible = false;
        this.entityId = null;
      } else if (entity.id !== this.entityId) this.build(entity);
    }
    if (!this.holder.visible || !this.entityId) return;
    const entity = this.game.world.entity(this.entityId);
    if (!entity) return;
    this.holder.position.fromArray(entity.pose.position);
    this.holder.quaternion.fromArray(entity.pose.rotation);
    const hue = (this.clock * RGB_TURNS_PER_S) % 1;
    this.barMaterial.color.setHSL(hue, 1, 0.55);
    this.keysMaterial.color.setHSL((hue + 0.15) % 1, 1, 0.5);
  }

  dispose(): void {
    this.holder.removeFromParent();
    for (const g of this.geometries) g.dispose();
    this.screenMaterial.dispose();
    this.barMaterial.dispose();
    this.keysMaterial.dispose();
    this.texture?.dispose();
  }

  private find(): WorldEntity | undefined {
    for (const entity of this.game.world.allEntities()) {
      if (entity.item.tags.includes('laptop')) return entity;
    }
    return undefined;
  }

  private build(entity: WorldEntity): void {
    this.holder.clear();
    for (const g of this.geometries.splice(0)) g.dispose();
    this.entityId = entity.id;
    const size = entity.item.visual.size;
    const screen = laptopScreen(size);
    const plane = new THREE.PlaneGeometry(screen.width, screen.height);
    this.geometries.push(plane);
    const display = new THREE.Mesh(plane, this.screenMaterial);
    display.position.copy(screen.center);
    display.rotation.x = -screen.tilt;
    this.drawScreen();
    const lightBar = laptopLightBar(size);
    const barGeometry = new THREE.BoxGeometry(lightBar.length, 0.0025, 0.0016);
    this.geometries.push(barGeometry);
    const bar = new THREE.Mesh(barGeometry, this.barMaterial);
    bar.position.copy(lightBar.center);
    // The backlight: a glow over the whole keyboard, the number pad too (the prop's own layout).
    const board = laptopKeyboard(size);
    const keysGeometry = new THREE.PlaneGeometry(board.width, board.depth).rotateX(-Math.PI / 2);
    this.geometries.push(keysGeometry);
    const keys = new THREE.Mesh(keysGeometry, this.keysMaterial);
    keys.position.copy(board.center);
    this.holder.add(display, bar, keys);
    this.holder.visible = true;
  }

  /** The lock screen: the wallpaper, the emblem, the name, "E" to use it. */
  private drawScreen(): void {
    if (this.texture) return;
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 500;
    const c = canvas.getContext('2d');
    if (!c) return;
    const g = c.createLinearGradient(0, 0, 800, 500);
    g.addColorStop(0, '#0b1d33');
    g.addColorStop(1, '#1a0f2e');
    c.fillStyle = g;
    c.fillRect(0, 0, 800, 500);
    c.strokeStyle = '#6cc2ff';
    c.lineWidth = 6;
    c.shadowColor = '#6cc2ff';
    c.shadowBlur = 18;
    for (const turn of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
      c.beginPath();
      c.ellipse(400, 200, 120, 44, turn, 0, Math.PI * 2);
      c.stroke();
    }
    c.fillStyle = '#ffb454';
    c.shadowColor = '#ffb454';
    c.beginPath();
    c.arc(400, 200, 18, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;
    c.fillStyle = '#eef6ff';
    c.font = "800 64px 'Segoe UI', system-ui, sans-serif";
    c.textAlign = 'center';
    c.fillText('SIMLAB', 400, 360);
    c.fillStyle = '#9fb3c8';
    c.font = "28px 'Segoe UI', system-ui, sans-serif";
    c.fillText(this.game.texts.ui('laptop.lockHint', 'Press E to use it'), 400, 420);
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.screenMaterial.map = this.texture;
    this.screenMaterial.needsUpdate = true;
  }
}
