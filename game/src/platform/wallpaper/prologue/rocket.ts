import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Swoop } from '../../../simulation/rocketSwoop';
import { setOutlineWidth, toonGradient } from '../../render/body/BodyModel';

/*
 * SimLab-1 for the live menu's opening (Phú 2026-11-18), in the wallpaper's near pass: drawn as
 * the two are, toon light in steps, an ink outline, solid colours. A lathe-turned hull, white with
 * a red and a black band, four fins, nine methane engines; the flame in inked layers with shock
 * diamonds; the trail it leaves in the air. Its cabin in the nose: a sliding door with a porthole
 * (Khoa looks out of it, opens it, hangs from the bar over it), a floor, a panel of screens.
 *
 * Its frame: y along its axis from its centre of mass (m), z out of its door. Placed each frame
 * from the swoop's track (simulation/rocketSwoop.ts).
 */

const INK = '#111417';
const TAIL = -24;
export const NOZZLE_END = -25.7;
const BODY_TOP = 16;
const TIP = 28;
const RADIUS = 2;
/** The cabin's floor, and the doorway: centre height, half its height, half its width (rad). */
export const FLOOR = 17.25;
const DOOR = { y: 18.32, half: 1.04, angle: 0.3 };
/** The porthole in the door. */
const PORTHOLE = { y: 18.78, half: 0.25, angle: 0.15 };
/** How far round the hull the door slides open (rad, towards the tail's side). */
const DOOR_SLIDE = 0.78;
/** Where round the hull the handle is on the door, shut (rad): by its front edge. */
const HANDLE_AT = -0.24;
/** The trail: a puff every this many seconds of the rocket's time, from the engines lighting. */
const PUFF_EVERY = 0.018;

/** The hull's radius at a height on its axis (the nose an ogive). */
export function hullRadius(y: number): number {
  if (y <= BODY_TOP) return RADIUS;
  const s = Math.min(1, (y - BODY_TOP) / (TIP - BODY_TOP));
  return RADIUS * Math.pow(Math.cos((Math.PI / 2) * s), 0.75);
}

/** Points of the cabin Khoa uses (the rocket's frame). */
export const CABIN = {
  /** Where he stands, facing the door. */
  stand: new THREE.Vector3(0.05, FLOOR, 0.92),
  /** His feet there. */
  footL: new THREE.Vector3(0.18, FLOOR, 0.95),
  footR: new THREE.Vector3(-0.12, FLOOR, 0.9),
  /** The porthole's centre on the door (closed), and his palms either side of it. */
  porthole: new THREE.Vector3(0, PORTHOLE.y, hullRadius(PORTHOLE.y) - 0.04),
  palmL: new THREE.Vector3(0.36, PORTHOLE.y - 0.12, hullRadius(PORTHOLE.y) - 0.08),
  palmR: new THREE.Vector3(-0.36, PORTHOLE.y - 0.1, hullRadius(PORTHOLE.y) - 0.08),
  /**
   * The door's handle inside, by its front edge: pulled, it crosses the doorway as the door slides
   * back (by its rear edge it went behind the wall at once, his hand through it).
   */
  handle: new THREE.Vector3(
    hullRadius(18.25) * Math.sin(-0.24) * 0.94,
    18.25,
    hullRadius(18.25) * Math.cos(-0.24) * 0.94,
  ),
  /** The doorway's rear edge inside, chest high: his left hand braced on it for the yank. */
  frameRear: new THREE.Vector3(
    hullRadius(18.45) * Math.sin(0.36) * 0.95,
    18.45,
    hullRadius(18.45) * Math.cos(0.36) * 0.95,
  ),
  /** The doorway's front edge, shoulder high: held as he steps to the edge. */
  frameFront: new THREE.Vector3(
    hullRadius(18.6) * Math.sin(-0.33),
    18.6,
    hullRadius(18.6) * Math.cos(-0.33),
  ),
  /** The bar over the doorway, outside: what he hangs from (in reach from the doorway's edge). */
  grip: new THREE.Vector3(-0.08, DOOR.y + DOOR.half + 0.07, hullRadius(19.43) + 0.12),
  /** Where he stands at the doorway's edge, and his feet there. */
  sill: new THREE.Vector3(0.02, FLOOR, hullRadius(FLOOR) - 0.3),
  sillL: new THREE.Vector3(0.16, FLOOR, hullRadius(FLOOR) - 0.26),
  sillR: new THREE.Vector3(-0.12, FLOOR, hullRadius(FLOOR) - 0.3),
};

/**
 * Ink for unskinned shapes: the shape pushed out along its normals by a width (`setOutlineWidth`
 * sets it, as for the bodies' ink), its back faces drawn.
 */
function inkMaterial(
  width: number,
  hole: { y: number; half: number; angle: number } | null = null,
): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  const uniform = { value: width };
  material.userData.outlineWidth = uniform;
  const cut = hole ? new THREE.Vector3(hole.y, hole.half, hole.angle) : null;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.outlineWidth = uniform;
    shader.vertexShader =
      'uniform float outlineWidth;\nvarying vec3 vInk;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvInk = position;\ntransformed += normalize( normal ) * outlineWidth;',
      );
    if (!cut) return;
    shader.uniforms.uHole = { value: cut };
    shader.fragmentShader =
      'varying vec3 vInk;\nuniform vec3 uHole;\n' +
      shader.fragmentShader.replace(
        '#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\n' +
          '  vec2 hole = vec2(atan(vInk.x, vInk.z) / uHole.z, (vInk.y - uHole.x) / uHole.y);\n' +
          '  if (dot(hole * hole, hole * hole) < 1.0) discard;',
      );
  };
  material.customProgramCacheKey = () => (cut ? 'rocket-ink-cut' : 'rocket-ink');
  return material;
}

/** A small deterministic random in [0, 1) for a whole number. */
const hash = (k: number) => {
  const x = Math.sin(k * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export class PrologueRocket {
  /** The rocket, in its own frame. */
  readonly group = new THREE.Group();
  /** The trail (world). */
  readonly trail: THREE.InstancedMesh;
  private readonly plume = new THREE.Group();
  private readonly door = new THREE.Group();
  private handle: THREE.Object3D | null = null;
  private readonly gradient = toonGradient([135, 200, 255]);
  readonly ink = inkMaterial(0.1);
  /** The hull's ink: cut where the doorway is, as the hull is (from inside it filled it black). */
  private readonly hullInk = inkMaterial(0.1, DOOR);
  private readonly flameCore: THREE.MeshBasicMaterial;
  private readonly glow: THREE.Sprite;
  private readonly textures: THREE.Texture[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly puffCount: number;
  private readonly from: number;
  // Scratch.
  private readonly at = [0, 0, 0];
  private readonly axis = [0, 0, 0];
  private readonly v = new THREE.Vector3();
  private readonly basisX = new THREE.Vector3();
  private readonly basisY = new THREE.Vector3();
  private readonly basisZ = new THREE.Vector3();
  private readonly m4 = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly s3 = new THREE.Vector3();
  private readonly flameBase = new THREE.Color('#fffbe8');
  private readonly flameDim = new THREE.Color('#fff2c4');
  private readonly flameHot = new THREE.Color('#ffffff');

  constructor(
    private readonly swoop: Swoop,
    /** Where the swoop's origin is in the world (its centre of mass when Khoa lets go). */
    readonly origin: THREE.Vector3,
    ignite: number,
  ) {
    this.flameCore = this.basic('#fffbe8');
    this.glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.radial(),
        color: '#ffb347',
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0.85,
        toneMapped: false,
      }),
    );
    this.materials.push(this.glow.material);
    this.buildHull();
    this.buildDoor();
    this.buildCabin();
    this.buildEngines();
    this.buildPlume();
    this.from = ignite;
    this.puffCount = Math.ceil((swoop.span[1] - ignite) / PUFF_EVERY) + 4;
    const puff = this.geo(new THREE.IcosahedronGeometry(1, 2));
    this.trail = new THREE.InstancedMesh(puff, this.toon('#f3f6f8'), this.puffCount);
    this.trail.frustumCulled = false;
    this.trail.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.name = 'prologue-rocket';
  }

  // --- building ---------------------------------------------------------------------------

  private geo<T extends THREE.BufferGeometry>(g: T): T {
    this.geometries.push(g);
    return g;
  }

  private toon(color: string, side: THREE.Side = THREE.FrontSide): THREE.MeshToonMaterial {
    const m = new THREE.MeshToonMaterial({ color, gradientMap: this.gradient, side });
    this.materials.push(m);
    return m;
  }

  private basic(color: string): THREE.MeshBasicMaterial {
    const m = new THREE.MeshBasicMaterial({
      color,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.materials.push(m);
    return m;
  }

  /** A mesh and its ink. */
  private inked(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    ink: THREE.Material = this.ink,
  ): THREE.Group {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, ink));
    return group;
  }

  /**
   * The hull's material: its bands and skirt drawn by height, a hole cut (`hole`: centre height,
   * half height, half width in rad), dark inside.
   */
  private shell(
    hole: { y: number; half: number; angle: number },
    key: string,
  ): THREE.MeshToonMaterial {
    const material = this.toon('#f2f3f5', THREE.DoubleSide);
    const uniforms = {
      uHole: { value: new THREE.Vector3(hole.y, hole.half, hole.angle) },
      uRed: { value: new THREE.Color('#a3242b') },
      uBlack: { value: new THREE.Color('#16181c') },
      uSkirt: { value: new THREE.Color('#3a3d42') },
      uInside: { value: new THREE.Color('#5a6b80') },
    };
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = `varying vec3 vHull;\n${shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvHull = position;',
      )}`;
      shader.fragmentShader = `varying vec3 vHull;
uniform vec3 uHole;
uniform vec3 uRed;
uniform vec3 uBlack;
uniform vec3 uSkirt;
uniform vec3 uInside;
${shader.fragmentShader
  .replace(
    '#include <clipping_planes_fragment>',
    `#include <clipping_planes_fragment>
  vec2 hole = vec2(atan(vHull.x, vHull.z) / uHole.z, (vHull.y - uHole.x) / uHole.y);
  if (dot(hole * hole, hole * hole) < 1.0) discard;`,
  )
  .replace(
    '#include <color_fragment>',
    `#include <color_fragment>
  if (!gl_FrontFacing) diffuseColor.rgb = uInside;
  else if (abs(vHull.y - 10.0) < 0.6) diffuseColor.rgb = uRed;
  else if (abs(vHull.y + 18.0) < 1.0) diffuseColor.rgb = uBlack;
  else if (vHull.y < -21.5) diffuseColor.rgb = uSkirt;`,
  )}`;
    };
    material.customProgramCacheKey = () => key;
    return material;
  }

  private profile(from: number, to: number, out = 0): THREE.Vector2[] {
    const points: THREE.Vector2[] = [];
    const n = 24;
    for (let i = 0; i <= n; i++) {
      const y = from + ((to - from) * i) / n;
      points.push(new THREE.Vector2(Math.max(0.001, hullRadius(y) + out), y));
    }
    return points;
  }

  private buildHull(): void {
    const r = this.group;
    const profile = [
      new THREE.Vector2(0.001, TAIL),
      new THREE.Vector2(2.08, TAIL),
      new THREE.Vector2(2.1, TAIL + 0.6),
      new THREE.Vector2(RADIUS, -21.5),
      new THREE.Vector2(RADIUS, BODY_TOP),
    ];
    for (let i = 1; i <= 28; i++) {
      const y = BODY_TOP + ((TIP - BODY_TOP) * i) / 28;
      profile.push(new THREE.Vector2(Math.max(0.001, hullRadius(y)), y));
    }
    r.add(
      this.inked(
        this.geo(new THREE.LatheGeometry(profile, 72)),
        this.shell(DOOR, 'rocket-hull'),
        this.hullInk,
      ),
    );

    // Its name, up the side under the door.
    const name = new THREE.Mesh(
      this.geo(
        new THREE.CylinderGeometry(RADIUS + 0.012, RADIUS + 0.012, 15, 12, 1, true, -0.42, 0.84),
      ),
      new THREE.MeshToonMaterial({
        map: this.nameTexture(),
        gradientMap: this.gradient,
        transparent: true,
      }),
    );
    this.materials.push(name.material);
    name.position.y = -6;
    r.add(name);

    const fin = new THREE.Shape();
    fin.moveTo(RADIUS - 0.05, -15.5);
    fin.lineTo(4.3, -21.4);
    fin.lineTo(4.3, -24.6);
    fin.lineTo(RADIUS - 0.05, -23.4);
    fin.closePath();
    const fins = [0, 1, 2, 3].map((i) => {
      const g = new THREE.ExtrudeGeometry(fin, { depth: 0.26, bevelEnabled: false });
      g.translate(0, 0, -0.13);
      g.rotateY(Math.PI / 4 + (i * Math.PI) / 2);
      return g;
    });
    r.add(this.inked(this.geo(mergeGeometries(fins)), this.toon('#a3242b')));
  }

  /** The door: a piece of the nose's skin with a porthole, sliding round the hull to open. */
  private buildDoor(): void {
    const half = DOOR.angle + 0.035;
    const skin = this.geo(
      new THREE.LatheGeometry(
        this.profile(DOOR.y - DOOR.half - 0.04, DOOR.y + DOOR.half + 0.04, 0.03),
        12,
        -half,
        2 * half,
      ),
    );
    this.door.add(new THREE.Mesh(skin, this.shell(PORTHOLE, 'rocket-door')));
    // Its rim: an ink-dark frame round its edge.
    const rim: THREE.Vector3[] = [];
    for (let i = 0; i < 48; i++) {
      const phi = (i / 48) * Math.PI * 2;
      const y =
        DOOR.y + Math.sign(Math.sin(phi)) * Math.sqrt(Math.abs(Math.sin(phi))) * (DOOR.half + 0.04);
      const a = Math.sign(Math.cos(phi)) * Math.sqrt(Math.abs(Math.cos(phi))) * half;
      const rr = hullRadius(y) + 0.065;
      rim.push(new THREE.Vector3(rr * Math.sin(a), y, rr * Math.cos(a)));
    }
    this.door.add(
      new THREE.Mesh(
        this.geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim, true), 96, 0.05, 6, true)),
        this.toon('#1d2127'),
      ),
    );
    const glass = new THREE.Mesh(
      this.geo(new THREE.CylinderGeometry(1.86, 1.86, 0.7, 12, 1, true, -0.24, 0.48)),
      new THREE.MeshBasicMaterial({
        color: '#a8dcff',
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      }),
    );
    this.materials.push(glass.material);
    glass.position.y = PORTHOLE.y;
    this.door.add(glass);
    // The handle inside, by its rear edge.
    const handle = new THREE.Mesh(
      this.geo(new THREE.BoxGeometry(0.06, 0.32, 0.06)),
      this.toon('#ffd23f'),
    );
    handle.position.copy(CABIN.handle);
    this.door.add(handle);
    this.handle = handle;
    this.group.add(this.door);
    // The doorway's frame on the hull, and the bar over it.
    const frame: THREE.Vector3[] = [];
    for (let i = 0; i < 64; i++) {
      const phi = (i / 64) * Math.PI * 2;
      const y = DOOR.y + Math.sign(Math.sin(phi)) * Math.sqrt(Math.abs(Math.sin(phi))) * DOOR.half;
      const a = Math.sign(Math.cos(phi)) * Math.sqrt(Math.abs(Math.cos(phi))) * DOOR.angle;
      const rr = hullRadius(y) + 0.01;
      frame.push(new THREE.Vector3(rr * Math.sin(a), y, rr * Math.cos(a)));
    }
    this.group.add(
      new THREE.Mesh(
        this.geo(
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(frame, true), 128, 0.06, 6, true),
        ),
        this.toon('#1d2127'),
      ),
    );
    const bar = new THREE.Mesh(
      this.geo(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 10)),
      this.toon('#ffd23f'),
    );
    bar.rotation.z = Math.PI / 2;
    bar.position.copy(CABIN.grip);
    this.group.add(bar);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(
        this.geo(new THREE.BoxGeometry(0.05, 0.05, 0.2)),
        this.toon('#1d2127'),
      );
      post.position.set(CABIN.grip.x + side * 0.42, CABIN.grip.y, CABIN.grip.z - 0.09);
      this.group.add(post);
    }
  }

  private buildCabin(): void {
    const box = (
      w: number,
      h: number,
      d: number,
      color: string,
      x: number,
      y: number,
      z: number,
    ) => {
      const m = new THREE.Mesh(this.geo(new THREE.BoxGeometry(w, h, d)), this.toon(color));
      m.position.set(x, y, z);
      this.group.add(m);
    };
    const floor = new THREE.Mesh(
      this.geo(new THREE.CylinderGeometry(1.94, 1.94, 0.08, 32)),
      this.toon('#3a4250'),
    );
    floor.position.y = FLOOR - 0.04;
    this.group.add(floor);
    // A seat at the back, the panel of screens behind it.
    box(0.6, 0.1, 0.5, '#2a3646', 0, FLOOR + 0.45, -0.7);
    box(0.6, 0.86, 0.1, '#2a3646', 0, FLOOR + 0.9, -0.98);
    box(1.9, 1.4, 0.08, '#4a586c', 0, FLOOR + 1.2, -1.18);
    const screens: [string, number, number, number, number][] = [
      ['#19f0ff', -0.68, 1.5, 0.4, 0.26],
      ['#4fbf7a', -0.66, 1.12, 0.36, 0.2],
      ['#ffb03b', 0.68, 1.46, 0.34, 0.3],
      ['#19f0ff', 0.64, 1.06, 0.42, 0.14],
    ];
    for (const [color, x, y, w, h] of screens) {
      const m = new THREE.Mesh(
        this.geo(new THREE.PlaneGeometry(w, h)),
        new THREE.MeshBasicMaterial({ color, toneMapped: false }),
      );
      this.materials.push(m.material);
      m.position.set(x, FLOOR + y, -1.13);
      this.group.add(m);
    }
  }

  private buildEngines(): void {
    const bell = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.5, NOZZLE_END - TAIL),
        new THREE.Vector2(0.43, -1.1),
        new THREE.Vector2(0.37, -0.6),
        new THREE.Vector2(0.33, -0.2),
        new THREE.Vector2(0.3, 0),
      ],
      24,
    );
    const places: [number, number][] = [[0, 0]];
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + Math.PI / 8;
      places.push([1.3 * Math.cos(a), 1.3 * Math.sin(a)]);
    }
    const material = this.toon('#44484f', THREE.DoubleSide);
    const glow = { value: new THREE.Color('#ff9a3c') };
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uGlow = glow;
      shader.fragmentShader = `uniform vec3 uGlow;\n${shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\nif (!gl_FrontFacing) totalEmissiveRadiance = uGlow;',
      )}`;
    };
    material.customProgramCacheKey = () => 'rocket-bell';
    this.group.add(
      this.inked(
        this.geo(mergeGeometries(places.map(([x, z]) => bell.clone().translate(x, TAIL, z)))),
        material,
      ),
    );
    bell.dispose();
    const jets = places.map(([x, z]) => {
      const g = new THREE.ConeGeometry(0.44, 3.2, 14, 1, true);
      g.rotateX(Math.PI);
      return g.translate(x, -1.5, z);
    });
    const jet = new THREE.Mesh(this.geo(mergeGeometries(jets)), this.flameCore);
    jet.renderOrder = 3;
    this.plume.add(jet);
  }

  /** The flame in layers (outer orange inked, yellow, a white core, shock diamonds) and its glow. */
  private buildPlume(): void {
    const layer = (length: number, radii: [number, number][]) =>
      this.geo(
        new THREE.LatheGeometry(
          [...radii]
            .reverse()
            .map(([x, r]) => new THREE.Vector2(Math.max(0.001, r), 0.2 - x * length)),
          40,
        ),
      );
    const outer = layer(34, [
      [0, 2.0],
      [0.1, 2.8],
      [0.25, 3.3],
      [0.45, 3.2],
      [0.65, 2.6],
      [0.82, 1.7],
      [0.94, 0.8],
      [1, 0],
    ]);
    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, order: number) => {
      const m = new THREE.Mesh(geometry, material);
      m.renderOrder = order;
      this.plume.add(m);
    };
    add(outer, this.ink, 1);
    add(outer, this.basic('#ff8a1e'), 2);
    add(
      layer(25, [
        [0, 1.6],
        [0.12, 2.1],
        [0.3, 2.2],
        [0.55, 1.8],
        [0.8, 1.0],
        [1, 0],
      ]),
      this.basic('#ffd23f'),
      3,
    );
    add(
      layer(13, [
        [0, 1.3],
        [0.2, 1.35],
        [0.5, 1.0],
        [0.8, 0.5],
        [1, 0],
      ]),
      this.flameCore,
      4,
    );
    const diamonds = [3.2, 6.6, 10, 13.4].map((l, i) => {
      const s = 1 - i * 0.14;
      return new THREE.OctahedronGeometry(1).scale(0.75 * s, 1.5 * s, 0.75 * s).translate(0, -l, 0);
    });
    add(this.geo(mergeGeometries(diamonds)), this.basic('#ffffff'), 5);
    this.glow.scale.setScalar(15);
    this.glow.position.y = -3;
    this.glow.renderOrder = 6;
    this.plume.add(this.glow);
    this.plume.position.y = NOZZLE_END;
    this.group.add(this.plume);
  }

  private nameTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.translate(64, 512);
      ctx.rotate(-Math.PI / 2);
      ctx.font = '900 92px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = INK;
      ctx.letterSpacing = '18px';
      ctx.fillText('SIMLAB-1', 0, 4);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    this.textures.push(texture);
    return texture;
  }

  private radial(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    }
    const texture = new THREE.CanvasTexture(canvas);
    this.textures.push(texture);
    return texture;
  }

  /** The textures to upload before the first frame. */
  get uploads(): readonly THREE.Texture[] {
    return this.textures;
  }

  // --- per frame --------------------------------------------------------------------------

  /** Its frame from a nose direction: y along it, z out of its door (towards the world's +z). */
  orient(axis: THREE.Vector3, out: THREE.Quaternion): THREE.Quaternion {
    this.basisY.copy(axis).normalize();
    this.basisZ.set(0, 0, 1).addScaledVector(this.basisY, -this.basisY.z);
    if (this.basisZ.lengthSq() < 1e-6) this.basisZ.set(1, 0, 0);
    this.basisZ.normalize();
    this.basisX.crossVectors(this.basisY, this.basisZ);
    return out.setFromRotationMatrix(this.m4.makeBasis(this.basisX, this.basisY, this.basisZ));
  }

  /**
   * Placed at the rocket's time tau: on its track, turned to its nose, its flame sized to its
   * thrust (none before the engines light), its trail left behind; `door` 0 shut … 1 open;
   * `burn` a flare of the flame (0–1); `ink` the outline's width a metre from the eye.
   */
  update(tau: number, door: number, burn: number, inkPerMetre: number, eye: THREE.Vector3): void {
    this.swoop.poseAt(tau, this.at, this.axis);
    const g = this.group;
    g.position.set(this.at[0] ?? 0, this.at[1] ?? 0, this.at[2] ?? 0).add(this.origin);
    this.orient(this.v.set(this.axis[0] ?? 0, this.axis[1] ?? 1, this.axis[2] ?? 0), g.quaternion);
    g.updateMatrixWorld();
    this.door.rotation.y = DOOR_SLIDE * door;
    if (this.handle) this.handle.visible = HANDLE_AT + DOOR_SLIDE * door < DOOR.angle - 0.03;
    // The flame: as long as its thrust is strong, flickering on the rocket's own clock.
    const s = this.swoop.stateAt(tau);
    const thrust = Math.hypot(...s.thrust);
    this.plume.visible = thrust > 0;
    const size = 0.55 + 0.45 * Math.min(1.4, thrust / 3e6);
    const f = tau * 2 * Math.PI;
    this.plume.scale.set(
      size * (1 + 0.035 * Math.sin(f * 11.3)),
      size * (1 + 0.06 * Math.sin(f * 13.7) + 0.04 * Math.sin(f * 7.1 + 1)),
      size * (1 + 0.035 * Math.sin(f * 9.7 + 2)),
    );
    this.flameCore.color.lerpColors(this.flameDim, this.flameBase, 0.5 + 0.5 * Math.sin(f * 17));
    this.flameCore.color.lerp(this.flameHot, burn);
    this.glow.scale.setScalar((15 + 7 * burn + 1.2 * Math.sin(f * 15)) * size);
    const ink = 2.6 * inkPerMetre * eye.distanceTo(g.position);
    setOutlineWidth(this.ink, ink);
    setOutlineWidth(this.hullInk, ink);
    this.updateTrail(tau);
  }

  /** The puffs left where the nozzles were, growing and spreading, from when the engines lit. */
  private updateTrail(tau: number): void {
    const trail = this.trail;
    for (let i = 0; i < this.puffCount; i++) {
      const born = this.from + i * PUFF_EVERY;
      const age = tau - born;
      let size = 0;
      if (age > 0.09) {
        const grow = Math.min(1, (age - 0.09) / 0.12);
        // Grown, then thinning away after ~2 s (none left in front of the roof by its end).
        const fade = 1 - Math.min(1, Math.max(0, (age - 2.2) / 2));
        size = (2.4 + 5.5 * (1 - Math.exp(-age / 1.4)) + hash(i) * 2.6) * grow * fade;
      }
      this.swoop.poseAt(born, this.at, this.axis);
      const spread = 0.9 + 1.6 * Math.min(Math.max(age, 0), 3);
      this.v
        .set(this.at[0] ?? 0, this.at[1] ?? 0, this.at[2] ?? 0)
        .add(this.origin)
        .add(
          this.s3
            .set(this.axis[0] ?? 0, this.axis[1] ?? 0, this.axis[2] ?? 0)
            .multiplyScalar(NOZZLE_END - 1),
        );
      this.v.x += (hash(i + 7) - 0.5) * spread;
      this.v.y += (hash(i + 3) - 0.5) * spread - 0.4 * Math.min(Math.max(age, 0), 3);
      this.v.z += (hash(i + 5) - 0.5) * spread;
      this.s3.setScalar(Math.max(size, 0.0001));
      this.m4.compose(this.v, this.q.identity(), this.s3);
      trail.setMatrixAt(i, this.m4);
    }
    trail.instanceMatrix.needsUpdate = true;
  }

  /** A point of its frame, in the world (written into `out`). */
  local(point: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    return out.copy(point).applyMatrix4(this.group.matrixWorld);
  }

  /** A point of the door (which slides), in the world. */
  onDoor(point: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    this.door.updateMatrixWorld();
    return out.copy(point).applyMatrix4(this.door.matrixWorld);
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    for (const t of this.textures) t.dispose();
    this.ink.dispose();
    this.hullInk.dispose();
    this.gradient.dispose();
  }
}
