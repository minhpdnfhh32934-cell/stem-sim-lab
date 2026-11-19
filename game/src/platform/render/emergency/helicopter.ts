import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  DOOR_UNDER_M,
  type HelicopterView,
  ROPES,
} from '../../../gameplay/emergency/EmergencySystem';
import type { ResponderSquad } from '../../../gameplay/emergency/squad';

// The squad's helicopter (Phú 2026-11-13): a light twin-engine utility type, made here from simple
// solids — a lathed fuselage painted in the squad's livery (stripes, windows, the open doors and
// its lettering, on one canvas), a glass canopy, the tail boom and fin, skids, the engine cowling,
// a four-bladed main rotor with its blur disc, the tail rotor, rappelling arms over both doors,
// navigation lights, beacons, strobes and a searchlight. A generic machine, not a real model.

/** The fuselage's length from the nose (m), and its radius along it (from the nose, m). */
const LENGTH = 5.6;
const PROFILE: readonly [number, number][] = [
  [0, 0],
  [0.1, 0.38],
  [0.35, 0.68],
  [0.75, 0.92],
  [1.3, 1.06],
  [2, 1.12],
  [3, 1.12],
  [3.8, 1.04],
  [4.5, 0.8],
  [5.1, 0.5],
  [5.6, 0.34],
];
/** The nose's z in the body's frame (the cabin centred on the rotor). */
const NOSE_Z = -2.5;
/** The body's axis over the helicopter's point (that point is DOOR_UNDER_M over the skids' top). */
const AXIS_Y = 0.6;
/** The skids' centre line, under the helicopter's point. */
const SKID_Y = -DOOR_UNDER_M - 0.05;
const SKID_X = 1.25;
/** The rotor's hub over the helicopter's point, and the blades' reach. */
const ROTOR_Y = AXIS_Y + 1.95;
const ROTOR_R = 5.5;
/** The rope arms' height over the helicopter's point: above a responder's raised hands. */
export const ROPE_TOP = 1.4;
/** Visual turn rates (rev/s at full speed): slow enough not to strobe, the blur disc does the rest. */
const MAIN_REV = 1.35;
const TAIL_REV = 6;

const TAU = Math.PI * 2;

/** The fuselage's radius `s` m from the nose (a smooth curve through PROFILE). */
function radiusAt(s: number): number {
  const p = PROFILE;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i];
    const b = p[i + 1];
    if (!a || !b || s > b[0]) continue;
    const u = (s - a[0]) / (b[0] - a[0] || 1);
    const before = p[i - 1] ?? a;
    const after = p[i + 2] ?? b;
    // Catmull-Rom through the four keys around s.
    const u2 = u * u;
    const u3 = u2 * u;
    return (
      0.5 *
      (2 * a[1] +
        (-before[1] + b[1]) * u +
        (2 * before[1] - 5 * a[1] + 4 * b[1] - after[1]) * u2 +
        (-before[1] + 3 * a[1] - 3 * b[1] + after[1]) * u3)
    );
  }
  return p[p.length - 1]?.[1] ?? 0;
}

/**
 * The fuselage (and, with a narrower φ range, its canopy): lathed round its length at even steps,
 * so the texture's v is the distance from the nose. u runs round from the top (0), the left side
 * (0.25), the belly (0.5) to the right side (0.75). Laid along z, nose at NOSE_Z, a flat belly.
 */
function lathe(
  from: number,
  to: number,
  grow: number,
  phiStart = Math.PI,
  phiLength = TAU,
): THREE.BufferGeometry {
  const steps = Math.max(2, Math.round((to - from) / 0.2));
  const points: THREE.Vector2[] = [];
  for (let i = 0; i <= steps; i++) {
    const s = from + ((to - from) * i) / steps;
    points.push(new THREE.Vector2(Math.max(0.001, radiusAt(s) * grow), s));
  }
  const geometry = new THREE.LatheGeometry(points, 48, phiStart, phiLength);
  geometry.rotateX(Math.PI / 2); // its axis along +z: the nose at z = 0
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    let y = position.getY(i);
    if (y < -0.62) y = -0.62 + (y + 0.62) * 0.4; // a flat belly
    position.setXYZ(i, position.getX(i) * 0.9, y + AXIS_Y, position.getZ(i) + NOSE_Z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** A tube through `points` (m). */
function tube(points: readonly [number, number, number][], radius: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  return new THREE.TubeGeometry(curve, Math.max(8, points.length * 6), radius, 8, false);
}

function canvas(width: number, height: number): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c.getContext('2d');
}

/**
 * Text along a body's length: `run` is the text's direction on the canvas (rad), `stretch` evens
 * out the canvas's pixels per metre along it and across it.
 */
function letter(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  run: number,
  px: number,
  stretch: number,
  color: string,
  maxRun: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(run);
  ctx.font = `800 ${px}px "Segoe UI", Arial, sans-serif`;
  const width = ctx.measureText(text).width * stretch;
  const fit = Math.min(1, maxRun / width);
  ctx.scale(stretch * fit, 1);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // A thin dark keyline, as painted lettering has, so it reads on any colour.
  ctx.lineWidth = px * 0.08;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/**
 * The fuselage's paint (1024 × 1024: u round it, v along it, the nose at the bottom): the body
 * colour, a stripe down each side, the canopy and chin windows, cabin windows, the open doors, the
 * squad's number on the rear cabin and its lettering along the belly (read from under it).
 */
function paintFuselage(squad: ResponderSquad): THREE.CanvasTexture | null {
  const W = 1024;
  const H = 1024;
  const ctx = canvas(W, H);
  if (!ctx) return null;
  const { body, stripe } = squad.livery;
  const X = (u: number) => u * W;
  const Y = (s: number) => (1 - s / LENGTH) * H;
  /** A rectangle from u0..u1 round and s0..s1 along. */
  const rect = (u0: number, u1: number, s0: number, s1: number, fill: string | CanvasGradient) => {
    ctx.fillStyle = fill;
    ctx.fillRect(X(u0), Y(s1), X(u1) - X(u0), Y(s0) - Y(s1));
  };
  ctx.fillStyle = body;
  ctx.fillRect(0, 0, W, H);
  // A slightly darker belly and a lighter back: the paint as light catches it.
  const shade = ctx.createLinearGradient(0, 0, W, 0);
  shade.addColorStop(0, 'rgba(255,255,255,0.10)');
  shade.addColorStop(0.25, 'rgba(255,255,255,0)');
  shade.addColorStop(0.5, 'rgba(0,0,0,0.16)');
  shade.addColorStop(0.75, 'rgba(255,255,255,0)');
  shade.addColorStop(1, 'rgba(255,255,255,0.10)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);
  // The stripes, a dark pinline over each.
  for (const [u0, u1] of [
    [0.262, 0.3],
    [0.7, 0.738],
  ] as const) {
    rect(u0, u1, 0.6, LENGTH, stripe);
  }
  rect(0.256, 0.262, 0.6, LENGTH, '#1a1d22');
  rect(0.738, 0.744, 0.6, LENGTH, '#1a1d22');
  // Glass: deep blue-black, a little lighter at its top edge.
  const glass = ctx.createLinearGradient(0, Y(0.12), 0, Y(1.5));
  glass.addColorStop(0, '#0a1520');
  glass.addColorStop(1, '#1d3448');
  // The canopy over the nose (both sides of u = 0), its frame, and the chin windows under it.
  rect(0, 0.29, 0.14, 1.45, glass);
  rect(0.71, 1, 0.14, 1.45, glass);
  rect(0, 0.006, 0.1, 1.5, '#15181d');
  rect(0.994, 1, 0.1, 1.5, '#15181d');
  rect(0.115, 0.13, 0.1, 1.5, '#15181d');
  rect(0.87, 0.885, 0.1, 1.5, '#15181d');
  rect(0.41, 0.485, 0.28, 0.85, glass);
  rect(0.515, 0.59, 0.28, 0.85, glass);
  // Cabin windows (front, and behind the doors) and the open sliding doors: the dark cabin inside.
  for (const side of [0, 1] as const) {
    const u = (a: number, b: number): [number, number] => (side === 0 ? [a, b] : [1 - b, 1 - a]);
    const [d0, d1] = u(0.16, 0.39);
    rect(d0, d1, 1.6, 3.4, '#0b0d10');
    // The door's rail above the opening; the door slid back behind it, with its window.
    const [r0, r1] = u(0.15, 0.158);
    rect(r0, r1, 1.55, 4.45, '#2a2e35');
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 3;
    ctx.strokeRect(X(d0), Y(4.4), X(d1) - X(d0), Y(3.45) - Y(4.4));
    const [w0, w1] = u(0.17, 0.245);
    rect(w0, w1, 3.6, 4.1, glass);
  }
  // The number on each side of the rear cabin, above the stripe, upright to someone beside it.
  // `ratio`: pixels per metre along the body over those round it (radius about 1 m).
  const number = squad.numbers[0] ?? '';
  const ratio = H / LENGTH / (W / (TAU * 1.05 * 0.95));
  letter(ctx, number, X(0.2), Y(4.85), -Math.PI / 2, 110, ratio, '#ffffff', Y(4.25) - Y(5.45));
  letter(ctx, number, X(0.8), Y(4.85), Math.PI / 2, 110, ratio, '#ffffff', Y(4.25) - Y(5.45));
  // The lettering along the belly, for those under it.
  letter(
    ctx,
    squad.livery.lettering,
    X(0.5),
    Y(2.75),
    -Math.PI / 2,
    110,
    ratio,
    '#ffffff',
    Y(1.1) - Y(4.4),
  );
  const texture = new THREE.CanvasTexture(ctx.canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * The tail boom's paint (512 round × 1024 along, the boom's root at the bottom): the body colour,
 * the stripe on both sides, and the squad's name upright on each side.
 */
function paintBoom(squad: ResponderSquad, length: number): THREE.CanvasTexture | null {
  const W = 512;
  const H = 1024;
  const ctx = canvas(W, H);
  if (!ctx) return null;
  ctx.fillStyle = squad.livery.body;
  ctx.fillRect(0, 0, W, H);
  // The cylinder's u: 0 under it, 0.25 its right side, 0.5 on top, 0.75 its left side.
  ctx.fillStyle = squad.livery.stripe;
  ctx.fillRect(0.12 * W, 0, 0.06 * W, H);
  ctx.fillRect(0.82 * W, 0, 0.06 * W, H);
  const ratio = H / length / (W / (TAU * 0.27));
  letter(ctx, squad.back, 0.27 * W, 0.62 * H, Math.PI / 2, 92, ratio, '#ffffff', 0.5 * H);
  letter(ctx, squad.back, 0.73 * W, 0.62 * H, -Math.PI / 2, 92, ratio, '#ffffff', 0.5 * H);
  const texture = new THREE.CanvasTexture(ctx.canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** A soft round glow (additive sprites: the lights' halos), made once and shared. */
let glowTexture: THREE.CanvasTexture | null = null;
export function glow(): THREE.CanvasTexture | null {
  if (glowTexture) return glowTexture;
  const ctx = canvas(128, 128);
  if (!ctx) return null;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  glowTexture = new THREE.CanvasTexture(ctx.canvas);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

/** The rotor's blur: the blades' path as a faint disc, darker towards the yellow-tipped rim. */
function paintDisc(): THREE.CanvasTexture | null {
  const ctx = canvas(256, 256);
  if (!ctx) return null;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(30,32,36,0)');
  g.addColorStop(0.1, 'rgba(30,32,36,0.25)');
  g.addColorStop(0.85, 'rgba(30,32,36,0.42)');
  g.addColorStop(0.9, 'rgba(240,196,40,0.5)');
  g.addColorStop(0.97, 'rgba(240,196,40,0.35)');
  g.addColorStop(1, 'rgba(240,196,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(ctx.canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** The searchlight's beam: bright at the lamp, fading along the cone and towards its edge. */
function paintBeam(): THREE.CanvasTexture | null {
  const ctx = canvas(64, 256);
  if (!ctx) return null;
  const along = ctx.createLinearGradient(0, 0, 0, 256);
  // The canvas's top is the cone's apex (the lamp).
  along.addColorStop(0, 'rgba(255,255,255,1)');
  along.addColorStop(0.25, 'rgba(255,255,255,0.35)');
  along.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = along;
  ctx.fillRect(0, 0, 64, 256);
  const texture = new THREE.CanvasTexture(ctx.canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

interface Lamp {
  readonly sprite: THREE.Sprite;
  readonly bulb: THREE.MeshBasicMaterial;
  readonly tint: THREE.Color;
  /** How it lights: steady, a beacon's slow flash, a strobe's double flash. */
  readonly kind: 'steady' | 'beacon' | 'strobe';
  readonly size: number;
  readonly phase: number;
}

/**
 * The helicopter: built for a squad (its livery), posed from the gameplay's `HelicopterView` each
 * frame — where it is, its yaw, pitch and bank, its rotors turning with `rotor`, its lights
 * flashing. Nothing allocated per frame; `dispose` frees what it made.
 */
export class Helicopter {
  readonly group = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly rotor = new THREE.Group();
  private readonly tailRotor = new THREE.Group();
  private readonly disc: THREE.Mesh;
  private readonly discMaterial: THREE.MeshBasicMaterial;
  private readonly tailDisc: THREE.Mesh;
  private readonly beam: THREE.Mesh;
  private readonly beamMaterial: THREE.MeshBasicMaterial;
  private readonly lamps: Lamp[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly textures: THREE.Texture[] = [];
  private spin = 0;
  private tailSpin = 0;

  constructor(squad: ResponderSquad) {
    this.group.name = `helicopter-${squad.id}`;
    this.group.rotation.order = 'YXZ';
    this.group.add(this.body);
    const { body, stripe, beacon } = squad.livery;
    const skin = paintFuselage(squad);
    const paint = this.material(
      new THREE.MeshStandardMaterial({
        color: skin ? '#ffffff' : body,
        map: skin,
        metalness: 0.35,
        roughness: 0.36,
      }),
    );
    if (skin) this.textures.push(skin);
    const plain = this.material(
      new THREE.MeshStandardMaterial({ color: body, metalness: 0.35, roughness: 0.36 }),
    );
    const dark = this.material(
      new THREE.MeshStandardMaterial({ color: '#22262c', metalness: 0.6, roughness: 0.45 }),
    );
    const steel = this.material(
      new THREE.MeshStandardMaterial({ color: '#8f969e', metalness: 0.85, roughness: 0.3 }),
    );
    const glass = this.material(
      new THREE.MeshStandardMaterial({
        color: '#a9c4d6',
        metalness: 0.9,
        roughness: 0.06,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      }),
    );
    const blade = this.material(
      new THREE.MeshStandardMaterial({ color: '#2b2f35', metalness: 0.4, roughness: 0.55 }),
    );
    const tip = this.material(
      new THREE.MeshStandardMaterial({ color: '#f0c428', metalness: 0.2, roughness: 0.5 }),
    );
    const stripePaint = this.material(
      new THREE.MeshStandardMaterial({ color: stripe, metalness: 0.3, roughness: 0.4 }),
    );

    // Fuselage and canopy.
    this.mesh(lathe(0, LENGTH, 1), paint);
    this.mesh(lathe(0.12, 1.5, 1.012, Math.PI / 2 - 0.25, Math.PI + 0.5), glass, 2);

    // The tail boom, from inside the cabin's rear out to the fin, its paint on its own canvas.
    const boomLength = 6.4;
    const boomGeometry = new THREE.CylinderGeometry(0.17, 0.32, boomLength, 24, 1, true)
      .rotateX(Math.PI / 2)
      .translate(0, AXIS_Y + 0.25, NOSE_Z + 5.0 + boomLength / 2 - 0.4);
    const boomSkin = paintBoom(squad, boomLength);
    if (boomSkin) this.textures.push(boomSkin);
    this.mesh(
      boomGeometry,
      this.material(
        new THREE.MeshStandardMaterial({
          color: boomSkin ? '#ffffff' : body,
          map: boomSkin,
          metalness: 0.35,
          roughness: 0.36,
        }),
      ),
    );
    const tailZ = NOSE_Z + 5.0 + boomLength - 0.4;
    // The fin: swept back, taller above the boom than below it, the stripe's colour at its tip.
    const fin = new THREE.Shape();
    fin.moveTo(-0.9, -0.2);
    fin.lineTo(0.1, 1.55);
    fin.lineTo(0.55, 1.55);
    fin.lineTo(0.25, 0.05);
    fin.lineTo(0.1, -0.55);
    fin.lineTo(-0.3, -0.5);
    fin.closePath();
    const finGeometry = new THREE.ExtrudeGeometry(fin, {
      depth: 0.09,
      bevelEnabled: true,
      bevelSize: 0.02,
      bevelThickness: 0.02,
      bevelSegments: 2,
    })
      .rotateY(-Math.PI / 2)
      .translate(0.045, AXIS_Y + 0.3, tailZ - 0.2);
    this.mesh(finGeometry, plain);
    this.mesh(
      new THREE.BoxGeometry(0.13, 0.18, 0.5).translate(0, AXIS_Y + 1.8, tailZ + 0.05),
      stripePaint,
    );
    // The horizontal stabiliser with its end plates.
    this.mesh(
      mergeGeometries([
        new THREE.BoxGeometry(2.6, 0.06, 0.5).translate(0, AXIS_Y + 0.32, tailZ - 1.1),
        new THREE.BoxGeometry(0.05, 0.5, 0.42).translate(1.3, AXIS_Y + 0.42, tailZ - 1.08),
        new THREE.BoxGeometry(0.05, 0.5, 0.42).translate(-1.3, AXIS_Y + 0.42, tailZ - 1.08),
      ]),
      plain,
    );

    // The engine cowling on the roof, its air intakes and exhausts.
    this.mesh(
      new THREE.CapsuleGeometry(0.45, 2.1, 6, 18)
        .rotateX(Math.PI / 2)
        .scale(1.18, 0.85, 1)
        .translate(0, AXIS_Y + 1.18, 0.85),
      plain,
    );
    this.mesh(
      mergeGeometries([
        new THREE.BoxGeometry(0.06, 0.3, 0.42).translate(0.52, AXIS_Y + 1.2, -0.15),
        new THREE.BoxGeometry(0.06, 0.3, 0.42).translate(-0.52, AXIS_Y + 1.2, -0.15),
        new THREE.CylinderGeometry(0.13, 0.15, 0.4, 14, 1, true)
          .rotateZ(Math.PI / 2 - 0.5)
          .translate(0.52, AXIS_Y + 1.28, 2.0),
        new THREE.CylinderGeometry(0.13, 0.15, 0.4, 14, 1, true)
          .rotateZ(-Math.PI / 2 + 0.5)
          .translate(-0.52, AXIS_Y + 1.28, 2.0),
      ]),
      dark,
    );

    // Skids, and the two arched cross tubes that hold them under the belly.
    const skids: THREE.BufferGeometry[] = [];
    for (const x of [-SKID_X, SKID_X]) {
      skids.push(
        tube(
          [
            [x, SKID_Y, 2.1],
            [x, SKID_Y, -1.1],
            [x, SKID_Y + 0.1, -1.6],
            [x, SKID_Y + 0.32, -1.85],
          ],
          0.045,
        ),
      );
    }
    for (const z of [-0.85, 1.35]) {
      skids.push(
        tube(
          [
            [-SKID_X, SKID_Y, z],
            [-1.12, SKID_Y + 0.5, z],
            [-0.7, AXIS_Y - 0.55, z],
            [0.7, AXIS_Y - 0.55, z],
            [1.12, SKID_Y + 0.5, z],
            [SKID_X, SKID_Y, z],
          ],
          0.05,
        ),
      );
    }
    this.mesh(mergeGeometries(skids), steel);

    // The rappelling arms: a beam out from the roof over each door, a pulley at each rope.
    const arms: THREE.BufferGeometry[] = [];
    const armY = ROPE_TOP;
    for (const [right, forward] of ROPES) {
      const x = right;
      const z = -forward;
      const side = Math.sign(right);
      arms.push(
        tube(
          [
            [side * 0.55, AXIS_Y + 1.0, z],
            [side * 0.95, armY + 0.12, z],
            [x, armY + 0.05, z],
          ],
          0.04,
        ),
        new THREE.CylinderGeometry(0.07, 0.07, 0.05, 14).rotateX(Math.PI / 2).translate(x, armY, z),
      );
    }
    this.mesh(mergeGeometries(arms), steel);

    // The main rotor: mast, hub, four blades with yellow tips, and the blur of their path.
    this.rotor.position.y = ROTOR_Y;
    this.body.add(this.rotor);
    const hub = mergeGeometries([
      new THREE.CylinderGeometry(0.09, 0.11, 0.6, 12).translate(0, -0.3, 0),
      new THREE.CylinderGeometry(0.3, 0.3, 0.16, 18),
      new THREE.SphereGeometry(0.16, 14, 8, 0, TAU, 0, Math.PI / 2).translate(0, 0.08, 0),
    ]);
    this.rotor.add(this.own(new THREE.Mesh(hub, dark)));
    const blades: THREE.BufferGeometry[] = [];
    const tips: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 4; k++) {
      const turn = (k * TAU) / 4;
      const r0 = 0.32;
      const rt = ROTOR_R - 0.38;
      blades.push(
        new THREE.BoxGeometry(rt - r0, 0.045, 0.32)
          .rotateX(0.06) // a little pitch
          .translate((r0 + rt) / 2, 0, 0)
          .rotateY(turn),
      );
      tips.push(
        new THREE.BoxGeometry(0.38, 0.045, 0.32)
          .rotateX(0.06)
          .translate(rt + 0.19, 0, 0)
          .rotateY(turn),
      );
    }
    this.rotor.add(this.own(new THREE.Mesh(mergeGeometries(blades), blade)));
    this.rotor.add(this.own(new THREE.Mesh(mergeGeometries(tips), tip)));
    const discTexture = paintDisc();
    if (discTexture) this.textures.push(discTexture);
    this.discMaterial = this.material(
      new THREE.MeshBasicMaterial({
        map: discTexture,
        color: discTexture ? '#ffffff' : '#30343a',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.disc = this.mesh(
      new THREE.CircleGeometry(ROTOR_R, 64).rotateX(-Math.PI / 2).translate(0, ROTOR_Y + 0.02, 0),
      this.discMaterial,
      3,
    );

    // The tail rotor on the fin's left side, two blades, and its own blur.
    this.tailRotor.position.set(-0.25, AXIS_Y + 1.15, tailZ + 0.12);
    this.body.add(this.tailRotor);
    this.tailRotor.add(
      this.own(
        new THREE.Mesh(
          mergeGeometries([
            new THREE.BoxGeometry(0.04, 1.75, 0.15),
            new THREE.CylinderGeometry(0.08, 0.08, 0.12, 12).rotateZ(Math.PI / 2),
          ]),
          blade,
        ),
      ),
    );
    this.tailDisc = this.mesh(
      new THREE.CircleGeometry(0.88, 32)
        .rotateY(Math.PI / 2)
        .translate(-0.27, AXIS_Y + 1.15, tailZ + 0.12),
      this.discMaterial,
      3,
    );

    // The searchlight under the nose, and its beam (seen once the ceiling is open).
    this.mesh(
      mergeGeometries([
        new THREE.CylinderGeometry(0.12, 0.14, 0.2, 16).translate(0, AXIS_Y - 0.85, -1.5),
        new THREE.SphereGeometry(0.06, 8, 6).translate(0, AXIS_Y - 0.72, -1.5),
      ]),
      dark,
    );
    const beamTexture = paintBeam();
    if (beamTexture) this.textures.push(beamTexture);
    this.beamMaterial = this.material(
      new THREE.MeshBasicMaterial({
        map: beamTexture,
        color: '#fff4dc',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );
    // A cone 16 m long, its apex at the lamp, opening downwards.
    this.beam = this.mesh(
      new THREE.ConeGeometry(2.4, 16, 32, 1, true).translate(0, -8, 0),
      this.beamMaterial,
      4,
    );
    this.beam.position.set(0, AXIS_Y - 0.95, -1.5);
    this.beam.rotation.x = 0.12; // aimed a little ahead of the doors, under the nose

    // Lights: red to the left, green to the right, white at the tail; the squad's beacons on the
    // roof and under the belly; white strobes on the stabiliser's plates; the searchlight's lens.
    this.lamp(-1.0, AXIS_Y + 0.2, -0.9, '#ff3030', 'steady', 0.5, 0);
    this.lamp(1.0, AXIS_Y + 0.2, -0.9, '#30ff6a', 'steady', 0.5, 0);
    this.lamp(0, AXIS_Y + 1.9, tailZ + 0.3, '#ffffff', 'steady', 0.45, 0);
    this.lamp(0, AXIS_Y + 1.62, 2.0, beacon, 'beacon', 1.4, 0);
    this.lamp(0, AXIS_Y - 0.92, 1.2, beacon, 'beacon', 1.4, 0.5);
    this.lamp(1.33, AXIS_Y + 0.62, tailZ - 1.0, '#ffffff', 'strobe', 1.1, 0);
    this.lamp(-1.33, AXIS_Y + 0.62, tailZ - 1.0, '#ffffff', 'strobe', 1.1, 0.07);
    this.lamp(0, AXIS_Y - 0.97, -1.5, '#fff6e0', 'steady', 0.9, 0);

    // Nothing here casts a shadow: it moves every frame (the shadow cache would redraw).
    this.group.traverse((o) => {
      o.castShadow = false;
      o.receiveShadow = false;
    });
    this.group.visible = false;
  }

  /** Posed from the gameplay's view at the scene offset (`ox, oy, oz`), `searching`: the beam on. */
  update(
    view: Readonly<HelicopterView>,
    ox: number,
    oy: number,
    oz: number,
    dt: number,
    time: number,
    searching: number,
  ): void {
    const g = this.group;
    g.visible = view.visible;
    if (!view.visible) return;
    g.position.set(view.x + ox, view.y + oy, view.z + oz);
    // Nose down is a negative turn about x (the nose is −z); the bank rolls it about z.
    g.rotation.set(-view.pitch, view.yaw, view.bank);
    this.spin = (this.spin + view.rotor * MAIN_REV * TAU * dt) % TAU;
    this.tailSpin = (this.tailSpin + view.rotor * TAIL_REV * TAU * dt) % TAU;
    this.rotor.rotation.y = -this.spin;
    this.tailRotor.rotation.x = this.tailSpin;
    // The blades blur into a disc as they come up to speed.
    this.discMaterial.opacity = 0.55 * view.rotor;
    this.disc.visible = view.rotor > 0.05;
    this.tailDisc.visible = this.disc.visible;
    this.beamMaterial.opacity = 0.16 * searching;
    this.beam.visible = searching > 0.01;
    for (let i = 0; i < this.lamps.length; i++) {
      const lamp = this.lamps[i];
      if (!lamp) continue;
      let on = 1;
      if (lamp.kind === 'beacon') {
        const f = (time * 1.1 + lamp.phase) % 1;
        on = f < 0.14 ? Math.sin((f / 0.14) * Math.PI) : 0;
      } else if (lamp.kind === 'strobe') {
        const f = (time * 0.9 + lamp.phase) % 1;
        on = f < 0.04 || (f > 0.12 && f < 0.16) ? 1 : 0;
      }
      lamp.sprite.visible = on > 0.02;
      lamp.sprite.scale.setScalar(lamp.size * (0.6 + 0.4 * on));
      lamp.sprite.material.opacity = on;
      lamp.bulb.color.copy(lamp.tint).multiplyScalar(0.25 + 0.75 * on);
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    for (const t of this.textures) t.dispose();
  }

  private lamp(
    x: number,
    y: number,
    z: number,
    color: string,
    kind: Lamp['kind'],
    size: number,
    phase: number,
  ): void {
    const tint = new THREE.Color(color);
    // The bulb's colour is the lamp's, scaled by how lit it is (written each frame).
    const bulb = this.material(new THREE.MeshBasicMaterial({ color: tint, toneMapped: false }));
    this.mesh(new THREE.SphereGeometry(0.06, 10, 8).translate(x, y, z), bulb);
    const spriteMaterial = this.material(
      new THREE.SpriteMaterial({
        map: glow(),
        color: tint,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.set(x, y, z);
    sprite.scale.setScalar(size);
    sprite.renderOrder = 5;
    this.body.add(sprite);
    this.lamps.push({ sprite, bulb, tint, kind, size, phase });
  }

  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, order = 0): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = order;
    this.body.add(mesh);
    this.geometries.push(geometry);
    return mesh;
  }

  private own(mesh: THREE.Mesh): THREE.Mesh {
    this.geometries.push(mesh.geometry);
    return mesh;
  }

  private material<T extends THREE.Material>(material: T): T {
    this.materials.push(material);
    return material;
  }
}
