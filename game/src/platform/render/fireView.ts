import * as THREE from 'three';
import type { Game } from '../../game/Game';
import type { GraphicsQuality } from '../../persistence/settings';
import { Particles } from './particles';

/**
 * How fire is drawn under each preset (Phú, Phase E-2b): Low a few soft blobs and a little smoke;
 * Medium more; High tongues of flame running yellow to red, sparks; Ultra many more tongues,
 * swaying, a glowing ember bed under each fire, its own flickering light and heavy smoke.
 */
interface Tier {
  /** Flames a second at a full-size fire (more over a wider one). */
  readonly flames: number;
  readonly smoke: number;
  readonly sparks: number;
  /** Tongues (a ramp, swaying) or plain soft blobs. */
  readonly tongues: boolean;
  readonly bed: boolean;
  readonly light: boolean;
}
const TIERS: Readonly<Record<GraphicsQuality, Tier>> = {
  low: { flames: 45, smoke: 6, sparks: 0, tongues: false, bed: false, light: false },
  medium: { flames: 110, smoke: 18, sparks: 0, tongues: false, bed: false, light: false },
  high: { flames: 170, smoke: 26, sparks: 10, tongues: true, bed: false, light: false },
  ultra: { flames: 260, smoke: 40, sparks: 22, tongues: true, bed: true, light: true },
};
const JET_PER_S = 70;
/** At most this many ember beds drawn (the fires' own cap is 16). */
const BEDS = 16;

/**
 * Fire drawn (Phase E-2): each fire (`game.fires.list`) as flames over its burning face, smoke
 * rising from it and, by preset, sparks, an ember bed and light (`TIERS`); the CO₂ extinguisher's
 * white jet while it is sprayed. The smoke pool is shared: the circuit bench's hot parts smoke
 * into it too.
 */
export class FireView {
  readonly smoke = new Particles(1200, '#3b3835', false, {
    opacity: 0.45,
    grow: 4,
    lift: 0.5,
    drag: 0.6,
  });
  /** Plain soft flames (Low, Medium). */
  private readonly blobs = new Particles(1200, '#ff6a14', true, {
    opacity: 0.75,
    grow: -0.6,
    lift: 1,
    drag: 1.2,
  });
  private readonly core = new Particles(800, '#ffd772', true, {
    opacity: 0.85,
    grow: -0.6,
    lift: 1.2,
    drag: 1.5,
  });
  /** Tongues running white-yellow → orange → deep red as they rise (High, Ultra). */
  private readonly tongues = new Particles(2600, '#ff6a14', true, {
    opacity: 0.85,
    grow: -0.35,
    lift: 1.3,
    drag: 1.1,
    shape: 'flame',
    ramp: ['#fff2b0', '#ff8a1e', '#b8220c'],
  });
  private readonly sparks = new Particles(400, '#ffb347', true, {
    opacity: 1,
    grow: -0.7,
    lift: -3,
    drag: 0.4,
  });
  private readonly jet = new Particles(300, '#f2f6f8', false, {
    opacity: 0.6,
    grow: 4,
    lift: 0.1,
    drag: 1.8,
  });
  private readonly pools: readonly Particles[];
  private readonly owed = new Map<string, number>();
  private jetOwed = 0;
  /** Ultra: a glowing bed under each fire, and one light at the largest. */
  private readonly beds: THREE.Mesh[] = [];
  private readonly bedGeometry = new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2);
  private bedTexture: THREE.CanvasTexture | null = null;
  private readonly light = new THREE.PointLight('#ff8a3a', 0, 5, 2);
  private clock = 0;

  constructor(
    parent: THREE.Object3D,
    private readonly game: Game,
  ) {
    this.pools = [this.smoke, this.blobs, this.core, this.tongues, this.sparks, this.jet];
    for (const pool of this.pools) parent.add(pool.points);
    for (let i = 0; i < BEDS; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: '#ff5a14',
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const bed = new THREE.Mesh(this.bedGeometry, material);
      bed.visible = false;
      bed.renderOrder = 9;
      this.beds.push(bed);
      parent.add(bed);
    }
    this.light.visible = false;
    this.light.castShadow = false;
    parent.add(this.light);
  }

  update(dt: number, heightPx: number, fovDeg: number): void {
    this.clock += dt;
    const tier = TIERS[this.game.graphicsQuality];
    for (const pool of this.pools) pool.setView(heightPx, fovDeg);
    const fires = this.game.fires.list;
    if (dt > 0) {
      for (const fire of fires) {
        this.burn(fire.entityId, fire.position, fire.radius, fire.size, dt, tier);
      }
      this.spray(dt);
    }
    this.glow(tier);
    for (const pool of this.pools) pool.update(dt);
  }

  private burn(
    id: string,
    [x, y, z]: readonly number[],
    radius: number,
    size: number,
    dt: number,
    tier: Tier,
  ): void {
    const r = Math.max(0.03, radius);
    // More flame over a wider fire, so it stays one fire, not scattered sparks.
    let owed = (this.owed.get(id) ?? 0) + tier.flames * (0.3 + size) * (1 + 3 * r) * dt;
    // Only over what burns: its top face, as the world has it (it may have turned).
    const entity = this.game.world.entity(id);
    if (!entity) return;
    const [w, , d0] = entity.item.visual.size;
    const q = entity.pose.rotation;
    const yaw = 2 * Math.atan2(q[1], q[3]);
    const [c, sn] = [Math.cos(yaw), Math.sin(yaw)];
    const [ex, , ez] = entity.pose.position;
    const rise = 0.5 + 0.9 * size;
    while (owed >= 1) {
      owed -= 1;
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * r;
      let px = (x ?? 0) + Math.cos(a) * d;
      let pz = (z ?? 0) + Math.sin(a) * d;
      // Into the object's frame, kept on its face, and back.
      const lx = Math.max(-w / 2, Math.min(w / 2, c * (px - ex) - sn * (pz - ez)));
      const lz = Math.max(-d0 / 2, Math.min(d0 / 2, sn * (px - ex) + c * (pz - ez)));
      px = ex + c * lx + sn * lz;
      pz = ez - sn * lx + c * lz;
      const near = 1.3 - d / r; // taller and bigger at the heart of the fire
      const vy = rise * (0.7 + 0.6 * Math.random());
      if (tier.tongues) {
        const s = 0.05 + 0.13 * size * near;
        this.tongues.emit(px, y ?? 0, pz, 0, vy, 0, s, 0.3 + 0.35 * Math.random());
      } else {
        const s = 0.035 + 0.09 * size * near;
        this.blobs.emit(px, y ?? 0, pz, 0, vy, 0, s, 0.25 + 0.25 * Math.random());
        if (Math.random() < 0.6) {
          this.core.emit(px, y ?? 0, pz, 0, vy * 0.8, 0, s * 0.7, 0.18 + 0.12 * Math.random());
        }
      }
      if (Math.random() < tier.smoke / tier.flames) {
        const sy = (y ?? 0) + 0.25 + 0.4 * size;
        const s = (tier.bed ? 0.2 : 0.15) + 0.25 * size;
        this.smoke.emit(px, sy, pz, 0, 0.35, 0, s, 4 + 2 * Math.random());
      }
      if (tier.sparks > 0 && Math.random() < tier.sparks / tier.flames) {
        const jx = (Math.random() - 0.5) * 0.8;
        const jz = (Math.random() - 0.5) * 0.8;
        const up = 1.5 + 2 * Math.random();
        this.sparks.emit(px, (y ?? 0) + 0.05, pz, jx, up, jz, 0.012, 0.8 + 0.8 * Math.random());
      }
    }
    this.owed.set(id, owed);
  }

  /** Ultra: the ember beds pulsing under the fires, and the light flickering over the largest. */
  private glow(tier: Tier): void {
    const fires = this.game.fires.list;
    let largest = -1;
    let best = 0;
    for (let i = 0; i < this.beds.length; i++) {
      const bed = this.beds[i];
      const fire = fires[i];
      if (!bed) continue;
      bed.visible = tier.bed && fire !== undefined;
      if (bed.visible && !this.bedTexture) {
        // Made on the first fire it glows under (a browser's canvas).
        this.bedTexture = glowTexture();
        for (const b of this.beds) {
          const m = b.material as THREE.MeshBasicMaterial;
          m.map = this.bedTexture;
          m.needsUpdate = true;
        }
      }
      if (!fire || !bed.visible) continue;
      const [x, y, z] = fire.position;
      bed.position.set(x, y + 0.004, z);
      bed.scale.setScalar(Math.max(0.05, fire.radius * 1.15));
      const pulse =
        0.75 + 0.25 * Math.sin(this.clock * 7 + i * 1.7) * Math.sin(this.clock * 3.1 + i);
      (bed.material as THREE.MeshBasicMaterial).opacity = Math.min(1, 0.35 + fire.size) * pulse;
      if (fire.size > best) {
        best = fire.size;
        largest = i;
      }
    }
    const fire = largest >= 0 ? fires[largest] : undefined;
    // Kept in the scene all through Ultra (dark without a fire): a light coming and going would
    // have every material compiled again as the fire starts.
    this.light.visible = tier.light;
    this.light.intensity = 0;
    if (!fire || !tier.light) return;
    const flicker = 0.8 + 0.12 * Math.sin(this.clock * 23) + 0.08 * Math.sin(this.clock * 37 + 1.3);
    this.light.position.set(fire.position[0], fire.position[1] + 0.35, fire.position[2]);
    this.light.intensity = 6 * fire.size * flicker;
  }

  private spray(dt: number): void {
    const fires = this.game.fires;
    if (!fires.spraying) {
      this.jetOwed = 0;
      return;
    }
    const [x, y, z] = fires.sprayFrom;
    const [dx, dy, dz] = fires.sprayDir;
    this.jetOwed += JET_PER_S * dt;
    while (this.jetOwed >= 1) {
      this.jetOwed -= 1;
      const speed = 5 + 2 * Math.random();
      const jx = (Math.random() - 0.5) * 0.8;
      const jy = (Math.random() - 0.5) * 0.8;
      const jz = (Math.random() - 0.5) * 0.8;
      const life = 0.5 + 0.3 * Math.random();
      this.jet.emit(x, y, z, dx * speed + jx, dy * speed + jy, dz * speed + jz, 0.05, life);
    }
  }

  dispose(): void {
    for (const pool of this.pools) pool.dispose();
    for (const bed of this.beds) {
      bed.removeFromParent();
      (bed.material as THREE.Material).dispose();
    }
    this.bedGeometry.dispose();
    this.bedTexture?.dispose();
    this.light.removeFromParent();
    this.light.dispose();
  }
}

/** A soft round glow, hot at its middle. */
function glowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const c = canvas.getContext('2d');
  if (c) {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,220,150,1)');
    g.addColorStop(0.35, 'rgba(255,120,40,0.7)');
    g.addColorStop(1, 'rgba(120,20,0,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(canvas);
}
