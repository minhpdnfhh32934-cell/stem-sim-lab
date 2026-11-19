import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { type GraphicsQuality, highOrMore } from '../../../persistence/settings';
import { Particles } from '../particles';
import { glow } from './helicopter';

// The hub's ceiling blown open (Phú 2026-11-13) and mended: the ceiling slab swapped for the same
// slab with a jagged hole (its broken concrete edge, rebar sticking out, cables hanging, soot and
// cracks round it); the blast's flash, fireball, sparks, falling debris that bounces and settles,
// and the dust; daylight (or the night) through the hole. Mending, the hole closes from its edge
// inwards behind a glowing rim, the soot fades and the rubble goes. Only drawn: nothing collides.

/** Outline points round the hole, and how much of the radius its jags take. */
const OUTLINE = 48;
/** Debris pieces, sparks and dust by preset: Low stays light. */
const TIERS: Record<
  GraphicsQuality,
  { debris: number; dust: number; sparks: number; ring: number; motes: number }
> = {
  low: { debris: 28, dust: 40, sparks: 24, ring: 14, motes: 6 },
  medium: { debris: 64, dust: 110, sparks: 60, ring: 34, motes: 22 },
  high: { debris: 90, dust: 170, sparks: 90, ring: 48, motes: 34 },
  ultra: { debris: 90, dust: 240, sparks: 130, ring: 64, motes: 48 },
};
const MAX_DEBRIS = 90;
const G = 9.81;

/** A small, fixed pseudo-random sequence: the same hole and the same fall on every machine. */
function random(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvas(size: number): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c.getContext('2d');
}

/** The slab built for a ceiling (its own frame: the slab's centre, its local x and z). */
interface Built {
  readonly slab: THREE.Mesh;
  readonly holed: THREE.Mesh;
  readonly patch: THREE.Mesh;
  readonly decal: THREE.Mesh;
  readonly rebar: THREE.Mesh;
  readonly cables: THREE.Mesh[];
  /** The hole's centre in the slab's frame, and its outline there (x, z pairs). */
  readonly cx: number;
  readonly cz: number;
  readonly outline: Float32Array;
  readonly width: number;
  readonly depth: number;
  readonly thickness: number;
}

/**
 * The breach in one ceiling slab. `open` swaps the slab for the holed one and starts the blast;
 * `update` runs the blast, the debris and the mending from the call's numbers; `close` puts the
 * slab back. Nothing allocated per frame.
 */
export class CeilingBreach {
  readonly group = new THREE.Group();
  private built: Built | null = null;
  private readonly rim = new THREE.MeshStandardMaterial({ color: '#8f8b84', roughness: 0.97 });
  private readonly mend = new THREE.MeshStandardMaterial({
    color: '#bff6ff',
    emissive: '#3fd8ff',
    emissiveIntensity: 2.2,
    roughness: 0.4,
    side: THREE.DoubleSide,
  });
  private readonly steel = new THREE.MeshStandardMaterial({
    color: '#5d4b3d',
    metalness: 0.55,
    roughness: 0.65,
  });
  private readonly wire = new THREE.MeshStandardMaterial({ color: '#16171a', roughness: 0.6 });
  private decalMaterial: THREE.MeshBasicMaterial | null = null;
  // The blast.
  private readonly flash: THREE.Sprite;
  private readonly fireball = new Particles(160, '#ffb347', true, {
    opacity: 0.95,
    grow: 1.6,
    lift: 1.2,
    drag: 2.6,
    ramp: ['#fffbe6', '#ffa630', '#6e2410'],
  });
  // Billows of dust (2026-11-14, Phú: as a real blast's): sooty and dark as they burst out,
  // lighter and greyer as they spread and hang, settling slowly.
  private readonly dust = new Particles(1100, '#cfc8bc', false, {
    opacity: 0.5,
    grow: 1.5,
    lift: -0.05,
    drag: 0.85,
    shape: 'puff',
    ramp: ['#5e564c', '#9d9487', '#cdc5b8'],
    air: 1,
  });
  /** Motes of dust lit in the daylight's shaft, drifting. */
  private readonly motes = new Particles(260, '#fff2d6', true, {
    opacity: 0.85,
    grow: 0,
    lift: -0.02,
    drag: 0.6,
  });
  private motesOwed = 0;
  private readonly sparks = new Particles(300, '#ffcf6b', true, {
    opacity: 1,
    grow: -0.6,
    lift: -G,
    drag: 0.3,
  });
  private readonly glints = new Particles(240, '#8ff0ff', true, {
    opacity: 0.9,
    grow: -0.7,
    lift: 0.15,
    drag: 1.4,
  });
  private readonly pools: readonly Particles[];
  // The debris: one instanced draw, simulated here (falling, bouncing, settling).
  private readonly debris: THREE.InstancedMesh;
  private readonly debrisGeometry: THREE.BufferGeometry;
  private readonly debrisMaterial = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.95,
    flatShading: true,
  });
  private readonly piece = {
    position: new Float32Array(MAX_DEBRIS * 3),
    velocity: new Float32Array(MAX_DEBRIS * 3),
    axis: new Float32Array(MAX_DEBRIS * 3),
    spin: new Float32Array(MAX_DEBRIS),
    angle: new Float32Array(MAX_DEBRIS),
    size: new Float32Array(MAX_DEBRIS * 3),
    /** Seconds after the blast it falls (the edge keeps crumbling), and whether it lies still. */
    delay: new Float32Array(MAX_DEBRIS),
    still: new Uint8Array(MAX_DEBRIS),
  };
  private count = 0;
  private settled = false;
  /** Ultra: the blast's dust settled on the floor round the spot under the hole (G2-4). */
  private readonly floorDust: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  // Daylight through the hole, and the sky over it.
  private readonly shaft: THREE.Mesh;
  private readonly shaftMaterial: THREE.MeshBasicMaterial;
  private readonly sky: THREE.Mesh;
  private readonly skyMaterial = new THREE.MeshBasicMaterial({
    color: '#eaf2fb',
    side: THREE.BackSide,
    fog: false,
    vertexColors: true,
  });
  /** The hole's centre (world) and radius, its ceiling's underside height (world). */
  private readonly center = new THREE.Vector3();
  private radius = 3;
  private floor = 0;
  private blastSeen = false;
  private held = false;
  private dustOwed = 0;
  private glintOwed = 0;
  private readonly matrix = new THREE.Matrix4();
  private readonly turn = new THREE.Quaternion();
  private readonly axis = new THREE.Vector3();
  private readonly at = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();

  constructor(private readonly quality: () => GraphicsQuality) {
    this.group.name = 'ceiling-breach';
    const flash = new THREE.SpriteMaterial({
      map: glow(),
      color: '#fff1cf',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.flash = new THREE.Sprite(flash);
    this.flash.visible = false;
    this.flash.renderOrder = 20;
    this.group.add(this.flash);
    this.pools = [this.fireball, this.dust, this.sparks, this.glints, this.motes];
    for (const pool of this.pools) this.group.add(pool.points);
    // Chunks: an icosahedron pushed out of shape, flat-shaded; tile shards are flat ones.
    const rock = new THREE.IcosahedronGeometry(1, 0);
    const pos = rock.getAttribute('position') as THREE.BufferAttribute;
    const rand = random(7);
    for (let i = 0; i < pos.count; i++) {
      const k = 0.7 + 0.5 * rand();
      pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
    }
    rock.computeVertexNormals();
    this.debrisGeometry = rock;
    this.debris = new THREE.InstancedMesh(rock, this.debrisMaterial, MAX_DEBRIS);
    this.debris.count = 0;
    this.debris.frustumCulled = false;
    this.debris.castShadow = false;
    this.debris.visible = false;
    const tones = ['#ece9e3', '#d8d4cc', '#a29e96', '#6a665f'];
    const tint = new THREE.Color();
    for (let i = 0; i < MAX_DEBRIS; i++) {
      this.debris.setColorAt(i, tint.set(tones[i % tones.length] ?? '#ffffff'));
    }
    this.group.add(this.debris);
    // The shaft of daylight: bright under the hole, fading towards the floor.
    const shaftTexture = shaftCanvas();
    this.shaftMaterial = new THREE.MeshBasicMaterial({
      map: shaftTexture,
      color: '#fff3d6',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, 40, 1, true),
      this.shaftMaterial,
    );
    this.shaft.visible = false;
    this.shaft.renderOrder = 8;
    this.group.add(this.shaft);
    // The sky over the hole: a dome lighter at its horizon.
    const dome = new THREE.SphereGeometry(80, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const dp = dome.getAttribute('position') as THREE.BufferAttribute;
    const colors = new Float32Array(dp.count * 3);
    for (let i = 0; i < dp.count; i++) {
      const up = Math.max(0, dp.getY(i) / 80);
      const k = 1.08 - 0.25 * up;
      colors.set([k, k, k + 0.04 * up], i * 3);
    }
    dome.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.sky = new THREE.Mesh(dome, this.skyMaterial);
    this.sky.visible = false;
    this.group.add(this.sky);
    // Lit as the floor is (a layer on it), drawn over it.
    const dust = new THREE.PlaneGeometry(1, 1);
    dust.rotateX(-Math.PI / 2);
    this.floorDust = new THREE.Mesh(
      dust,
      new THREE.MeshStandardMaterial({
        color: '#b8b0a3',
        alphaMap: dustCanvas(),
        transparent: true,
        opacity: 0,
        roughness: 1,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );
    this.floorDust.name = 'floor-dust';
    this.floorDust.visible = false;
    this.floorDust.receiveShadow = true;
    this.floorDust.renderOrder = 1;
    this.group.add(this.floorDust);
    this.group.traverse((o) => (o.castShadow = false));
  }

  /** Whether the ceiling `slab` is the one opened now (shown or held). */
  opened(slab: THREE.Mesh): boolean {
    return this.built?.slab === slab;
  }

  /** Whether a holed slab is built (shown or held). */
  get ready(): boolean {
    return this.built !== null;
  }

  /** The holed slab's pieces (in the room, not in `group`): to compile ahead. */
  pieces(): THREE.Object3D[] {
    const b = this.built;
    return b ? [b.holed, b.patch, b.decal, b.rebar, ...b.cables] : [];
  }

  /**
   * Held: built ahead while the squad comes (2026-11-14: building and compiling it at the blast
   * stalled the frame ~0.4 s, RTX 5070), the whole slab still shown; let go, the hole shows.
   */
  hold(held: boolean): void {
    const b = this.built;
    if (!b || held === this.held) return;
    this.held = held;
    b.slab.visible = held;
    for (const o of this.pieces()) o.visible = !held;
  }

  /**
   * Opens `slab` (a room's ceiling box) round `x, z` (world) by `radius` m: the slab hidden, the
   * holed one in its place. Built once per slab and call.
   */
  open(slab: THREE.Mesh, x: number, z: number, radius: number): void {
    if (this.built?.slab === slab) return;
    this.close();
    const box = slab.geometry as THREE.BoxGeometry;
    const { width, height, depth } = box.parameters;
    const parent = slab.parent;
    if (!parent || !(slab.material instanceof THREE.Material)) return;
    slab.updateWorldMatrix(true, false);
    const local = slab.worldToLocal(new THREE.Vector3(x, 0, z));
    const rand = random(Math.round(x * 13 + z * 7 + radius * 101));
    // The outline: jagged, a few deep bites into the slab.
    const outline = new Float32Array(OUTLINE * 2);
    let wobble = 0;
    for (let k = 0; k < OUTLINE; k++) {
      const a = (k / OUTLINE) * Math.PI * 2;
      wobble = 0.6 * wobble + 0.4 * (rand() - 0.5);
      const bite = rand() < 0.12 ? 0.18 * rand() : 0;
      const r = radius * (0.9 + 0.22 * wobble + bite + 0.05 * Math.sin(a * 3 + rand()));
      outline[k * 2] = local.x + r * Math.cos(a);
      outline[k * 2 + 1] = local.z + r * Math.sin(a);
    }
    const holed = this.holedSlab(slab, width, height, depth, outline);
    const patch = this.patchRing(slab, height, local.x, local.z, outline);
    const decal = this.soot(height, local.x, local.z, radius, outline, rand);
    const rebar = this.rebar(height, local.x, local.z, outline, rand);
    const cables = this.cables(height, local.x, local.z, outline, rand);
    for (const o of [holed, patch, decal, rebar, ...cables]) {
      o.position.add(slab.position);
      o.castShadow = false;
      parent.add(o);
    }
    holed.castShadow = slab.castShadow;
    holed.receiveShadow = slab.receiveShadow;
    patch.receiveShadow = slab.receiveShadow;
    holed.userData = { ...slab.userData };
    slab.visible = false;
    this.built = {
      slab,
      holed,
      patch,
      decal,
      rebar,
      cables,
      cx: local.x,
      cz: local.z,
      outline,
      width,
      depth,
      thickness: height,
    };
    slab.getWorldPosition(this.center);
    this.center.set(x, this.center.y - height / 2, z);
    this.radius = radius;
    this.blastSeen = false;
  }

  /** The slab whole again, everything of the breach gone. */
  close(): void {
    const b = this.built;
    if (b) {
      b.slab.visible = true;
      for (const o of [b.holed, b.patch, b.decal, b.rebar, ...b.cables]) {
        o.removeFromParent();
        o.geometry.dispose();
      }
      this.built = null;
    }
    this.held = false;
    this.decalMaterial?.map?.dispose();
    this.decalMaterial?.dispose();
    this.decalMaterial = null;
    this.debris.visible = false;
    this.debris.count = 0;
    this.shaft.visible = false;
    this.sky.visible = false;
    this.flash.visible = false;
    this.floorDust.visible = false;
  }

  /**
   * One frame: `breach` 1 open … 0 mended, `blast` seconds since the blast (−1 none), the floor's
   * height (world), the sky's colour now, daylight 0…1, `hover` the rotor's wash over the hole.
   */
  update(
    dt: number,
    time: number,
    breach: number,
    blast: number,
    floor: number,
    sky: THREE.Color,
    day: number,
    hover: number,
    heightPx: number,
    fov: number,
  ): void {
    for (const pool of this.pools) pool.setView(heightPx, fov);
    const b = this.built;
    if (b && !this.held) {
      this.floor = floor;
      if (blast >= 0 && !this.blastSeen) {
        // Its fireball and debris only at the moment itself (not on coming back into the hall).
        this.blastSeen = true;
        if (blast < 0.6) this.burst();
      }
      this.blastFrame(blast);
      this.mendFrame(b, breach, dt, time);
      this.fall(dt, breach);
      // The cables sway in the rotor's wash.
      for (let i = 0; i < b.cables.length; i++) {
        const cable = b.cables[i];
        if (!cable) continue;
        const w = 0.05 + 0.18 * hover;
        cable.rotation.x = w * Math.sin(time * (2.1 + i * 0.37) + i);
        cable.rotation.z = w * Math.cos(time * (1.7 + i * 0.29) + i * 2);
      }
      // Daylight down the hole (night: none), stronger while the dust hangs in it.
      const dusty = blast >= 0 ? Math.max(0, 1 - blast / 18) : 0;
      // The dust makes the light a solid beam; clear air, a faint one.
      this.shaftMaterial.opacity = breach * day * (0.05 + 0.24 * dusty);
      this.shaft.visible = this.shaftMaterial.opacity > 0.002;
      const h = this.center.y - floor;
      this.shaft.scale.set(this.radius * 0.95, h, this.radius * 0.95);
      this.shaft.position.set(this.center.x, floor + h / 2, this.center.z);
      // Ultra: the dust coming down on the floor over ten seconds, gone as the hole is mended.
      const settled = blast < 0 ? 1 : Math.min(1, Math.max(0, (blast - 2) / 10));
      const dust = highOrMore(this.quality()) ? breach * settled * 0.85 : 0;
      this.floorDust.material.opacity = dust;
      this.floorDust.visible = dust > 0.005;
      this.floorDust.position.set(this.center.x, floor + 0.004, this.center.z);
      this.floorDust.scale.set(this.radius * 5, 1, this.radius * 5);
      this.sky.visible = breach > 0.001;
      this.sky.position.set(this.center.x, this.center.y + b.thickness, this.center.z);
      this.skyMaterial.color.copy(sky);
      this.wash(dt, hover, blast);
      this.motesIn(dt, day * breach * (0.3 + dusty));
    }
    for (const pool of this.pools) pool.update(dt);
  }

  dispose(): void {
    this.close();
    this.group.removeFromParent();
    for (const pool of this.pools) pool.dispose();
    this.debrisGeometry.dispose();
    this.debris.dispose();
    this.shaft.geometry.dispose();
    this.sky.geometry.dispose();
    this.floorDust.geometry.dispose();
    this.floorDust.material.alphaMap?.dispose();
    this.floorDust.material.dispose();
    this.shaftMaterial.map?.dispose();
    for (const m of [
      this.rim,
      this.mend,
      this.steel,
      this.wire,
      this.debrisMaterial,
      this.shaftMaterial,
      this.skyMaterial,
      this.flash.material,
    ]) {
      m.dispose();
    }
  }

  // ---- the blast ---------------------------------------------------------------------------------

  /** The moment of the blast: the fireball, sparks, the dust cloud, and the debris let go. */
  private burst(): void {
    const tier = TIERS[this.quality()];
    const { x, y, z } = this.center;
    const r = this.radius;
    const rand = Math.random;
    for (let i = 0; i < 46; i++) {
      const a = rand() * Math.PI * 2;
      const d = rand() * r * 0.7;
      const out = 2 + 5 * rand();
      this.fireball.emit(
        x + Math.cos(a) * d,
        y - 0.3 - rand() * 0.8,
        z + Math.sin(a) * d,
        Math.cos(a) * out,
        -1 - 4 * rand(),
        Math.sin(a) * out,
        1.2 + 2.2 * rand(),
        0.35 + 0.55 * rand(),
      );
    }
    for (let i = 0; i < tier.sparks; i++) {
      const a = rand() * Math.PI * 2;
      const out = 3 + 8 * rand();
      this.sparks.emit(
        x + Math.cos(a) * r * 0.5 * rand(),
        y - 0.2,
        z + Math.sin(a) * r * 0.5 * rand(),
        Math.cos(a) * out,
        -2 + 6 * (rand() - 0.6),
        Math.sin(a) * out,
        0.035,
        0.6 + rand(),
      );
    }
    // The curtain: a column of dust pouring down through the hole.
    for (let i = 0; i < tier.dust; i++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * r * 1.1;
      const out = 0.4 + 1.6 * rand();
      this.dust.emit(
        x + Math.cos(a) * d,
        y - 0.3 - rand() * 3,
        z + Math.sin(a) * d,
        Math.cos(a) * out,
        -1.2 - 3.2 * rand(),
        Math.sin(a) * out,
        1.2 + 1.8 * rand(),
        6 + 4 * rand(),
      );
    }
    // The ring: the blast's push, a wall of dust flung out under the ceiling.
    for (let i = 0; i < tier.ring; i++) {
      const a = (i / tier.ring) * Math.PI * 2 + rand() * 0.3;
      const out = 4 + 5 * rand();
      this.dust.emit(
        x + Math.cos(a) * r * 0.8,
        y - 0.5 - rand() * 0.8,
        z + Math.sin(a) * r * 0.8,
        Math.cos(a) * out,
        -0.4 - rand(),
        Math.sin(a) * out,
        1.4 + 1.4 * rand(),
        6 + 3 * rand(),
      );
    }
    // The debris: from inside the hole, flung out and down; some of the edge crumbles later.
    const n = tier.debris;
    const p = this.piece;
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * r * 0.95;
      const out = 0.6 + 3.2 * rand();
      p.position.set([x + Math.cos(a) * d, y - 0.05, z + Math.sin(a) * d], i * 3);
      p.velocity.set([Math.cos(a) * out, -0.5 - 4 * rand(), Math.sin(a) * out], i * 3);
      this.axis.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
      p.axis.set([this.axis.x, this.axis.y, this.axis.z], i * 3);
      p.spin[i] = 3 + 9 * rand();
      p.angle[i] = rand() * 6;
      const shard = i % 5 === 0; // a piece of a ceiling panel: flat
      const s = 0.05 + 0.2 * rand() * rand() + (i < 6 ? 0.12 : 0);
      if (shard) p.size.set([s * 2.4, 0.015, s * 1.8], i * 3);
      else p.size.set([s, s * (0.6 + 0.5 * rand()), s * (0.7 + 0.6 * rand())], i * 3);
      p.delay[i] = i < n * 0.8 ? 0 : 0.4 + 3.5 * rand();
      p.still[i] = 0;
    }
    this.count = n;
    this.settled = false;
    this.debris.count = n;
    this.debris.visible = true;
    if (this.debris.instanceColor) this.debris.instanceColor.needsUpdate = true;
  }

  /** The flash: a white-hot bloom, gone in under half a second. */
  private blastFrame(blast: number): void {
    const u = blast / 0.45;
    const on = blast >= 0 && u < 1;
    this.flash.visible = on;
    if (!on) return;
    this.flash.position.set(this.center.x, this.center.y - 0.6, this.center.z);
    this.flash.scale.setScalar(4 + 22 * Math.sqrt(u));
    this.flash.material.opacity = (1 - u) * (1 - u);
  }

  /** Motes lit in the shaft, drifting down through it: `light` how much there is to see them in. */
  private motesIn(dt: number, light: number): void {
    const tier = TIERS[this.quality()];
    this.motesOwed += dt * tier.motes * light;
    const { x, y, z } = this.center;
    while (this.motesOwed >= 1) {
      this.motesOwed -= 1;
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * this.radius * 0.85;
      this.motes.emit(
        x + Math.cos(a) * d,
        this.floor + 0.3 + Math.random() * (y - this.floor - 0.5),
        z + Math.sin(a) * d,
        (Math.random() - 0.5) * 0.15,
        -0.05 - Math.random() * 0.1,
        (Math.random() - 0.5) * 0.15,
        0.025 + Math.random() * 0.03,
        4 + 3 * Math.random(),
      );
    }
  }

  /** Dust: falling from the broken edge for a while, and blown about by the rotor's wash. */
  private wash(dt: number, hover: number, blast: number): void {
    const { x, y, z } = this.center;
    const r = this.radius;
    // The curtain landing: dust rolling out along the floor, the first seconds.
    if (blast > 0.6 && blast < 3.2) {
      const tier = TIERS[this.quality()];
      for (let k = 0; k < Math.ceil(tier.ring * dt * 1.6); k++) {
        const a = Math.random() * Math.PI * 2;
        const out = 2.5 + 3.5 * Math.random();
        this.dust.emit(
          x + Math.cos(a) * r * 0.6,
          this.floor + 0.3 + Math.random() * 0.4,
          z + Math.sin(a) * r * 0.6,
          Math.cos(a) * out,
          0.15 + 0.3 * Math.random(),
          Math.sin(a) * out,
          1.4 + 1.4 * Math.random(),
          7 + 6 * Math.random(),
        );
      }
    }
    const crumble = blast >= 0 && blast < 6 ? 1 - blast / 6 : 0;
    this.dustOwed += dt * (16 * crumble + 7 * hover);
    while (this.dustOwed >= 1) {
      this.dustOwed -= 1;
      const a = Math.random() * Math.PI * 2;
      if (Math.random() < crumble / (crumble + hover * 0.45 + 1e-6)) {
        // A trickle off the edge.
        this.dust.emit(
          x + Math.cos(a) * r * 0.95,
          y - 0.1,
          z + Math.sin(a) * r * 0.95,
          0,
          -1.4 - Math.random(),
          0,
          0.5 + 0.5 * Math.random(),
          2.2 + Math.random(),
        );
      } else {
        // Swirled off the floor under the hole, outwards.
        const d = 0.5 + Math.random() * r;
        this.dust.emit(
          x + Math.cos(a) * d,
          this.floor + 0.25,
          z + Math.sin(a) * d,
          Math.cos(a) * 1.8,
          0.25,
          Math.sin(a) * 1.8,
          0.9 + Math.random(),
          1.8 + Math.random(),
        );
      }
    }
  }

  // ---- debris -------------------------------------------------------------------------------------

  /** The pieces fall, bounce on the floor and lie still; mending, they shrink away. */
  private fall(dt: number, breach: number): void {
    const n = this.count;
    if (n === 0) return;
    const mending = breach < 0.999;
    if (this.settled && !mending) return;
    const p = this.piece;
    let moving = 0;
    const shrink = mending ? Math.max(0, (breach - 0.15) / 0.85) : 1;
    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      const sy = (p.size[i3 + 1] ?? 0.05) * shrink;
      if (!p.still[i]) {
        const delay = p.delay[i] ?? 0;
        if (delay > 0) {
          p.delay[i] = delay - dt;
          moving++;
          continue;
        }
        moving++;
        let vy = (p.velocity[i3 + 1] ?? 0) - G * dt;
        const px = (p.position[i3] ?? 0) + (p.velocity[i3] ?? 0) * dt;
        let py = (p.position[i3 + 1] ?? 0) + vy * dt;
        const pz = (p.position[i3 + 2] ?? 0) + (p.velocity[i3 + 2] ?? 0) * dt;
        const rest = this.floor + Math.max(0.01, sy * 0.6);
        if (py < rest) {
          py = rest;
          // A thud: most of the speed gone, a little bounce while it is fast.
          vy = Math.abs(vy) > 1.2 ? -vy * 0.28 : 0;
          p.velocity[i3] = (p.velocity[i3] ?? 0) * 0.55;
          p.velocity[i3 + 2] = (p.velocity[i3 + 2] ?? 0) * 0.55;
          p.spin[i] = (p.spin[i] ?? 0) * 0.5;
          if (vy === 0) {
            const vx = p.velocity[i3] ?? 0;
            const vz = p.velocity[i3 + 2] ?? 0;
            if (vx * vx + vz * vz < 0.04) p.still[i] = 1;
          }
        }
        p.velocity[i3 + 1] = vy;
        p.position[i3] = px;
        p.position[i3 + 1] = py;
        p.position[i3 + 2] = pz;
        p.angle[i] = (p.angle[i] ?? 0) + (p.spin[i] ?? 0) * dt;
      }
      this.axis.set(p.axis[i3] ?? 0, p.axis[i3 + 1] ?? 1, p.axis[i3 + 2] ?? 0);
      this.turn.setFromAxisAngle(this.axis, p.angle[i] ?? 0);
      this.at.set(p.position[i3] ?? 0, p.position[i3 + 1] ?? 0, p.position[i3 + 2] ?? 0);
      if (mending && p.still[i]) this.at.y = this.floor + sy * 0.6;
      this.scale.set(
        (p.size[i3] ?? 0.05) * shrink,
        Math.max(0.0001, sy),
        (p.size[i3 + 2] ?? 0.05) * shrink,
      );
      this.debris.setMatrixAt(i, this.matrix.compose(this.at, this.turn, this.scale));
    }
    this.debris.instanceMatrix.needsUpdate = true;
    this.settled = moving === 0;
    this.debris.visible = shrink > 0.001;
  }

  // ---- mending ------------------------------------------------------------------------------------

  /**
   * The patch closing the hole from its edge in: its inner edge at `breach` of the outline (1: the
   * whole hole open), lit as it grows; the soot fading, the rebar and cables gone at once.
   */
  private mendFrame(b: Built, breach: number, dt: number, time: number): void {
    const mending = breach < 0.999;
    b.rebar.visible = !mending;
    for (const cable of b.cables) cable.visible = !mending;
    if (this.decalMaterial) this.decalMaterial.opacity = Math.min(1, breach * 1.4);
    b.patch.visible = mending;
    if (!mending) return;
    const k = Math.max(0, breach);
    const geometry = b.patch.geometry;
    const position = geometry.getAttribute('position') as THREE.BufferAttribute;
    const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
    const n = OUTLINE;
    const h = b.thickness / 2;
    for (let i = 0; i < n; i++) {
      const ox = b.outline[i * 2] ?? 0;
      const oz = b.outline[i * 2 + 1] ?? 0;
      const ix = b.cx + (ox - b.cx) * k;
      const iz = b.cz + (oz - b.cz) * k;
      // Inner ring: bottom (n + i), top (3n + i), the wall's bottom and top (4n + i, 5n + i).
      position.setXYZ(n + i, ix, -h, iz);
      position.setXYZ(3 * n + i, ix, h, iz);
      position.setXYZ(4 * n + i, ix, -h, iz);
      position.setXYZ(5 * n + i, ix, h, iz);
      const u = (ix + b.width / 2) / b.width;
      const v = (b.depth / 2 - iz) / b.depth;
      uv.setXY(n + i, u, v);
      uv.setXY(3 * n + i, u, v);
    }
    position.needsUpdate = true;
    uv.needsUpdate = true;
    geometry.computeBoundingSphere();
    // Its rim glows while it grows; sparkles run along it.
    this.mend.emissiveIntensity = k > 0.02 ? 1.6 + 0.8 * Math.sin(time * 11) : 0;
    this.glintOwed += dt * 36 * (k > 0.02 ? 1 : 0);
    while (this.glintOwed >= 1) {
      this.glintOwed -= 1;
      const i = Math.floor(Math.random() * n);
      const x = b.cx + ((b.outline[i * 2] ?? 0) - b.cx) * k;
      const z = b.cz + ((b.outline[i * 2 + 1] ?? 0) - b.cz) * k;
      this.at.set(x, -h - 0.02, z);
      b.patch.localToWorld(this.at);
      this.glints.emit(
        this.at.x,
        this.at.y,
        this.at.z,
        (Math.random() - 0.5) * 0.6,
        -0.4 - 0.6 * Math.random(),
        (Math.random() - 0.5) * 0.6,
        0.07,
        0.5 + 0.4 * Math.random(),
      );
    }
  }

  // ---- what is built for a slab -------------------------------------------------------------------

  /** The slab with the hole cut through it: its faces the ceiling's, the hole's walls concrete. */
  private holedSlab(
    slab: THREE.Mesh,
    width: number,
    height: number,
    depth: number,
    outline: Float32Array,
  ): THREE.Mesh {
    // Shape coordinates (x, −z): extruded upwards once turned about x.
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, -depth / 2);
    shape.lineTo(width / 2, -depth / 2);
    shape.lineTo(width / 2, depth / 2);
    shape.lineTo(-width / 2, depth / 2);
    shape.closePath();
    const hole = new THREE.Path();
    for (let k = 0; k < OUTLINE; k++) {
      const x = outline[k * 2] ?? 0;
      const y = -(outline[k * 2 + 1] ?? 0);
      if (k === 0) hole.moveTo(x, y);
      else hole.lineTo(x, y);
    }
    hole.closePath();
    shape.holes.push(hole);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false })
      .rotateX(-Math.PI / 2)
      .translate(0, -height / 2, 0);
    // The box's own mapping (its underside's): u along x, v from its far edge in z.
    const position = geometry.getAttribute('position') as THREE.BufferAttribute;
    const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < position.count; i++) {
      uv.setXY(i, (position.getX(i) + width / 2) / width, (depth / 2 - position.getZ(i)) / depth);
    }
    const mesh = new THREE.Mesh(geometry, [slab.material as THREE.Material, this.rim]);
    mesh.name = 'ceiling-breached';
    return mesh;
  }

  /**
   * The mending patch: a flat ring from the outline in to its inner edge (moved each frame), its
   * faces the ceiling's, its inner edge's wall glowing. 6 rings of points: bottom outer, bottom
   * inner, top outer, top inner, and the wall's bottom and top.
   */
  private patchRing(
    slab: THREE.Mesh,
    height: number,
    cx: number,
    cz: number,
    outline: Float32Array,
  ): THREE.Mesh {
    const n = OUTLINE;
    const h = height / 2;
    const position = new Float32Array(6 * n * 3);
    const normal = new Float32Array(6 * n * 3);
    const uv = new Float32Array(6 * n * 2);
    for (let i = 0; i < n; i++) {
      const x = outline[i * 2] ?? 0;
      const z = outline[i * 2 + 1] ?? 0;
      const rx = cx - x;
      const rz = cz - z;
      const l = Math.hypot(rx, rz) || 1;
      const rings: [number, number, number, number, number, number][] = [
        [x, -h, z, 0, -1, 0],
        [cx, -h, cz, 0, -1, 0],
        [x, h, z, 0, 1, 0],
        [cx, h, cz, 0, 1, 0],
        [cx, -h, cz, -rx / l, 0, -rz / l],
        [cx, h, cz, -rx / l, 0, -rz / l],
      ];
      rings.forEach(([px, py, pz, nx, ny, nz], ring) => {
        const j = ring * n + i;
        position.set([px, py, pz], j * 3);
        normal.set([nx, ny, nz], j * 3);
      });
    }
    const index: number[] = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      // Underside (seen from below), then the top.
      index.push(i, j, n + j, i, n + j, n + i);
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      index.push(2 * n + i, 3 * n + j, 2 * n + j, 2 * n + i, 3 * n + i, 3 * n + j);
    }
    const wall = index.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      index.push(4 * n + i, 4 * n + j, 5 * n + j, 4 * n + i, 5 * n + j, 5 * n + i);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geometry.setIndex(index);
    geometry.addGroup(0, wall, 0);
    geometry.addGroup(wall, index.length - wall, 1);
    const mesh = new THREE.Mesh(geometry, [slab.material as THREE.Material, this.mend]);
    mesh.name = 'ceiling-mending';
    mesh.visible = false;
    mesh.frustumCulled = false;
    return mesh;
  }

  /** Soot and cracks round the hole on the ceiling's underside (none inside the hole). */
  private soot(
    height: number,
    cx: number,
    cz: number,
    radius: number,
    outline: Float32Array,
    rand: () => number,
  ): THREE.Mesh {
    const reach = radius * 2.3;
    const S = 512;
    const ctx = canvas(S);
    const geometry = new THREE.PlaneGeometry(2 * reach, 2 * reach).rotateX(Math.PI / 2);
    geometry.translate(cx, -height / 2 - 0.004, cz);
    let texture: THREE.CanvasTexture | null = null;
    if (ctx) {
      // Canvas from the slab's x, z (the plane's u along x, v along z, the canvas's top v = 1).
      const X = (x: number) => ((x - cx + reach) / (2 * reach)) * S;
      const Y = (z: number) => (1 - (z - cz + reach) / (2 * reach)) * S;
      const soot = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      soot.addColorStop(0.3, 'rgba(22,19,17,0.92)');
      soot.addColorStop(0.5, 'rgba(40,33,28,0.6)');
      soot.addColorStop(0.75, 'rgba(60,52,45,0.22)');
      soot.addColorStop(1, 'rgba(60,52,45,0)');
      ctx.fillStyle = soot;
      ctx.fillRect(0, 0, S, S);
      // Cracks: short, fine, wandering out from the edge and fading as they go.
      ctx.lineCap = 'round';
      for (let c = 0; c < 14; c++) {
        const k = Math.floor(rand() * OUTLINE);
        let x = outline[k * 2] ?? cx;
        let z = outline[k * 2 + 1] ?? cz;
        let a = Math.atan2(z - cz, x - cx);
        const steps = 3 + Math.floor(rand() * 4);
        for (let s = 0; s < steps; s++) {
          a += (rand() - 0.5) * 1.1;
          const step = radius * (0.035 + 0.045 * rand());
          const nx = x + Math.cos(a) * step;
          const nz = z + Math.sin(a) * step;
          const fade = 1 - s / steps;
          ctx.strokeStyle = `rgba(32,28,24,${(0.65 * fade).toFixed(2)})`;
          ctx.lineWidth = Math.max(0.6, 2 * fade);
          ctx.beginPath();
          ctx.moveTo(X(x), Y(z));
          ctx.lineTo(X(nx), Y(nz));
          ctx.stroke();
          x = nx;
          z = nz;
        }
      }
      // Nothing over the hole itself.
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      for (let k = 0; k < OUTLINE; k++) {
        const x = X(outline[k * 2] ?? cx);
        const y = Y(outline[k * 2 + 1] ?? cz);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      texture = new THREE.CanvasTexture(ctx.canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
    }
    this.decalMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      color: texture ? '#ffffff' : '#000000',
      transparent: true,
      opacity: texture ? 1 : 0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const mesh = new THREE.Mesh(geometry, this.decalMaterial);
    mesh.name = 'ceiling-soot';
    mesh.renderOrder = 2;
    return mesh;
  }

  /** Bent reinforcing bars sticking out of the broken edge into the hole. */
  private rebar(
    height: number,
    cx: number,
    cz: number,
    outline: Float32Array,
    rand: () => number,
  ): THREE.Mesh {
    const bars: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 12; i++) {
      const k = Math.floor((i / 12) * OUTLINE + rand() * 3) % OUTLINE;
      const x = outline[k * 2] ?? cx;
      const z = outline[k * 2 + 1] ?? cz;
      const ix = cx - x;
      const iz = cz - z;
      const l = Math.hypot(ix, iz) || 1;
      const reach = 0.25 + 0.55 * rand();
      const droop = 0.1 + 0.45 * rand();
      const y = (rand() - 0.5) * height * 0.6;
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(x - (ix / l) * 0.15, y, z - (iz / l) * 0.15),
        new THREE.Vector3(x + (ix / l) * reach * 0.6, y, z + (iz / l) * reach * 0.6),
        new THREE.Vector3(x + (ix / l) * reach, y - droop, z + (iz / l) * reach + 0.1 * rand()),
      );
      bars.push(new THREE.TubeGeometry(curve, 6, 0.011, 5, false));
    }
    const mesh = new THREE.Mesh(mergeGeometries(bars), this.steel);
    for (const bar of bars) bar.dispose();
    mesh.name = 'ceiling-rebar';
    return mesh;
  }

  /** Cables torn loose, hanging from the edge (each its own mesh: they sway). */
  private cables(
    height: number,
    cx: number,
    cz: number,
    outline: Float32Array,
    rand: () => number,
  ): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const k = Math.floor(((i + 0.3 * rand()) / 4) * OUTLINE) % OUTLINE;
      const x = outline[k * 2] ?? cx;
      const z = outline[k * 2 + 1] ?? cz;
      const ix = (cx - x) / (Math.hypot(cx - x, cz - z) || 1);
      const iz = (cz - z) / (Math.hypot(cx - x, cz - z) || 1);
      const fall = 0.6 + 1.1 * rand();
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(ix * 0.2, -fall * 0.35, iz * 0.2),
        new THREE.Vector3(ix * 0.3, -fall * 0.7, iz * 0.3),
        new THREE.Vector3(ix * 0.25 + 0.05, -fall, iz * 0.25),
      ]);
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.009, 5, false), this.wire);
      // Hung from the edge: its own origin there (the slab's position is added by `open`).
      mesh.position.set(x, -height / 2, z);
      mesh.name = 'ceiling-cable';
      out.push(mesh);
    }
    return out;
  }
}

/** Settled dust (an alpha map): thick in the middle, in soft patches thinning outwards. */
function dustCanvas(): THREE.CanvasTexture | null {
  const ctx = canvas(256);
  if (!ctx) return null;
  // An alpha map reads its green: black (clear) under white patches added up.
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 256, 256);
  ctx.globalCompositeOperation = 'lighter';
  const rand = random(11);
  for (let i = 0; i < 260; i++) {
    // Nearer the middle more often, as dust falls thickest under the hole.
    const r = 118 * Math.sqrt(rand()) * (0.35 + 0.65 * rand());
    const a = rand() * Math.PI * 2;
    const x = 128 + r * Math.cos(a);
    const y = 128 + r * Math.sin(a);
    const size = 10 + 34 * rand();
    const g = ctx.createRadialGradient(x, y, 0, x, y, size);
    const k = 0.1 * (1 - r / 128) + 0.03;
    g.addColorStop(0, `rgba(255,255,255,${k.toFixed(3)})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - size, y - size, size * 2, size * 2);
  }
  const texture = new THREE.CanvasTexture(ctx.canvas);
  texture.colorSpace = THREE.NoColorSpace; // an alpha map: its values as they are
  return texture;
}

/** The daylight shaft's fade: bright at its top (the cylinder's v = 1), none at the floor. */
function shaftCanvas(): THREE.CanvasTexture | null {
  const ctx = canvas(64);
  if (!ctx) return null;
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.4)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(ctx.canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
