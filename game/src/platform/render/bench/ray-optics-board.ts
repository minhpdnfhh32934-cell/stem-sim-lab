import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, arc, loft, slab, swaps } from '../assembly';
import { LOOKS } from '../looks';
import { drum, part, rod } from '../props/parts';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

/*
 * The ray-optics board of the refraction experiment, in the item's frame (origin at the centre of
 * its box). The normal to the block's flat face is the x axis through the disc's centre; the flat
 * face lies along z at x = 0, the curved face towards +x. Entering (direction < 0.5) the ray box
 * stands on the −x side and the light meets the flat face from the air; leaving, it stands on the
 * +x side and the light crosses the curved face along a radius, undeviated (as the model has it).
 * The ray box turns to the run's `incidence`; the rays are drawn at the model's angles; the
 * refracted ray only while `tir` is 0 (never the held last value).
 */

const FOOT = 0.004; // rubber feet under the board
const BOARD = 0.014; // the board's thickness
const DISC = 0.003; // the protractor disc's thickness
const DISC_R = 0.13; // radius of the protractor disc
const BLOCK_R = 0.05; // the semicircular block: radius and thickness
const BLOCK_T = 0.02;
const SLIT = 0.085; // the ray box's slit from the disc's centre
const RAY = { width: 0.0025, lift: 0.0006, out: 0.12 }; // out: reflected and refracted ray length
const DEG = Math.PI / 180;

/** A semicircle's outline (x ≥ 0) about the origin, shrunk by the inset for a chamfer. */
const halfDisc = (radius: number) => (inset: number) =>
  arc(inset, 0, radius - 2 * inset, -Math.PI / 2, Math.PI / 2, 32);

/**
 * The protractor printed on the disc, drawn once: a tick every 1°, longer every 5° and 10°,
 * figures every 10° counted from the normal (0–90 in each quadrant, as on a ray-optics disc), the
 * normal (solid) and the flat face's line (dashed), and the block's outline. Canvas x is the
 * item's x, canvas y its z. Null without a page (tests): the disc is plain white.
 */
function discTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const c = canvas.getContext('2d');
  if (c) {
    const mid = size / 2;
    const s = mid / DISC_R; // px per metre
    const r = mid - 6;
    c.fillStyle = '#f7f8f6';
    c.fillRect(0, 0, size, size);
    c.strokeStyle = '#1d2731';
    c.fillStyle = '#1d2731';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(mid, mid, r, 0, 2 * Math.PI);
    c.stroke();
    // ~11 mm figures on the 0.26 m disc: legible from the desk, about 0.9 m away.
    c.font = '700 44px system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (let d = 0; d < 360; d++) {
      const a = d * DEG;
      const ten = d % 10 === 0;
      const five = d % 5 === 0;
      const inner = r - (ten ? 40 : five ? 26 : 15);
      c.lineWidth = ten ? 3 : five ? 2 : 1.25;
      c.beginPath();
      c.moveTo(mid + Math.cos(a) * inner, mid + Math.sin(a) * inner);
      c.lineTo(mid + Math.cos(a) * r, mid + Math.sin(a) * r);
      c.stroke();
      if (!ten) continue;
      const fromNormal = Math.min(d % 180, 180 - (d % 180)); // 0 on the normal, 90 along the face
      c.save();
      c.translate(mid + Math.cos(a) * (r - 64), mid + Math.sin(a) * (r - 64));
      c.rotate(a + Math.PI / 2);
      c.fillText(String(fromNormal), 0, 0);
      c.restore();
    }
    c.lineWidth = 3; // the normal
    c.beginPath();
    c.moveTo(mid - r + 90, mid);
    c.lineTo(mid + r - 90, mid);
    c.stroke();
    c.strokeStyle = '#7d8790'; // the flat face's line and the block's outline
    c.lineWidth = 2;
    c.setLineDash([14, 10]);
    c.beginPath();
    c.moveTo(mid, mid - r + 90);
    c.lineTo(mid, mid + r - 90);
    c.stroke();
    c.setLineDash([]);
    c.beginPath();
    c.arc(mid, mid, BLOCK_R * s, -Math.PI / 2, Math.PI / 2);
    c.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8; // seen at a grazing angle across the bench
  return texture;
}

/** Height of the disc's face above the item's base: where the rig stands (`bench.top`). */
export const DISC_TOP = FOOT + BOARD + DISC;

/**
 * The board (the entity's mesh) on four rubber feet, its corner screws, and the white protractor
 * disc on it: a chamfered rim and the printed face.
 */
function frame(item: ItemDefinition, _painted: THREE.MeshStandardMaterial): BenchFrame {
  const [w, h, d] = item.visual.size;
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  const floor = -h / 2;
  const boardTop = floor + FOOT + BOARD;
  const texture = discTexture();
  const white = own(new THREE.MeshStandardMaterial({ color: '#f4f6f7', ...LOOKS.plastic }));
  const printed = own(
    new THREE.MeshStandardMaterial({ color: '#ffffff', ...LOOKS.matte, map: texture }),
  );
  const steel = own(new THREE.MeshStandardMaterial({ color: '#b4bcc4', ...LOOKS.metal }));
  const rubber = own(new THREE.MeshStandardMaterial({ color: '#202428', ...LOOKS.rubber }));

  const body = keep(slab(w, d, BOARD, 0.02, 0.003));
  body.translate(0, floor + FOOT, 0);

  // The disc: its rim turned with a chamfer on top, the printed face laid in it.
  const rim = mesh(
    keep(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(DISC_R - 0.001, 0),
          new THREE.Vector2(DISC_R, 0.0008),
          new THREE.Vector2(DISC_R, DISC - 0.0008),
          new THREE.Vector2(DISC_R - 0.0008, DISC),
        ],
        96,
      ),
    ),
    white,
  );
  rim.name = 'disc-rim';
  rim.position.y = boardTop;
  const face = mesh(keep(new THREE.CircleGeometry(DISC_R - 0.0008, 96)), printed);
  face.name = 'disc';
  face.rotation.x = -Math.PI / 2; // u along x, v along −z: the canvas's rows run along +z
  face.position.y = boardTop + DISC;
  face.castShadow = false;

  // Parts smaller than a shadow-map texel (~2 cm over the lab) cast no shadow: they would not show.
  const corners = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sz) => [sx * (w / 2 - 0.022), sz * (d / 2 - 0.022)] as const),
  );
  mesh(
    keep(
      part(
        'body',
        false,
        corners.map(([x, z]) => drum(0.0045, 0.004, 0, 0.0015, 12).translate(x, boardTop, z)),
      ).geometry,
    ),
    steel,
  ).castShadow = false;
  mesh(
    keep(
      part(
        'body',
        false,
        corners.map(([x, z]) => drum(0.012, 0.011, 0, FOOT, 16).translate(x, floor, z)),
      ).geometry,
    ),
    rubber,
  ).castShadow = false;

  return {
    body,
    parts: kit.group,
    dispose: () => {
      kit.dispose();
      texture?.dispose();
    },
  };
}

/**
 * Standing on the disc's face at `bench.top`: the semicircular block (clear, its opacity by its index), the
 * ray box turned to the incidence, and the incident, reflected and refracted rays. Each ray is a
 * unit strip along its local +x from the centre, turned and scaled; nothing is made in `pose`.
 */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  const [x, y, z] = item.bench?.top ?? [0, DISC_TOP, 0];
  kit.group.position.set(x, y - item.visual.size[1] / 2, z);

  // The block: colourless, as real water, acrylic and glass are; only its opacity follows n.
  const glass = own(
    new THREE.MeshStandardMaterial({ color: '#e8f1f2', ...LOOKS.glass, depthWrite: false }),
  );
  const block = mesh(
    keep(
      loft(halfDisc(BLOCK_R), [
        [0.0015, 0],
        [0, 0.0015],
        [0, BLOCK_T - 0.0015],
        [0.0015, BLOCK_T],
      ]).rotateX(-Math.PI / 2),
    ),
    glass,
  );
  block.name = 'block';
  block.castShadow = false;

  // The ray box, built pointing out along +x, its slit SLIT from the centre.
  const box = new THREE.Group();
  box.name = 'ray-box';
  kit.group.add(box);
  const plastic = own(new THREE.MeshStandardMaterial({ color: '#2b2f36', ...LOOKS.plastic }));
  const steel = own(new THREE.MeshStandardMaterial({ color: '#b4bcc4', ...LOOKS.metal }));
  const housing = slab(0.078, 0.036, 0.042, 0.006, 0.002).translate(SLIT + 0.003 + 0.039, 0, 0);
  // Beyond the disc's edge the housing stands on a skid DISC thick, down to the board.
  const skidFrom = DISC_R + 0.001;
  const skidTo = SLIT + 0.003 + 0.078;
  const skid = slab(skidTo - skidFrom, 0.036, DISC, 0.004, 0.0005).translate(
    (skidFrom + skidTo) / 2,
    -DISC,
    0,
  );
  const lampAt = SLIT + 0.06;
  mesh(
    keep(
      part('body', true, [
        housing,
        skid,
        drum(0.013, 0.012, 0.042, 0.05, 20).translate(lampAt, 0, 0), // the bulb's turret
        rod(0.005, new THREE.Vector3(0.164, 0.014, 0), new THREE.Vector3(0.174, 0.014, 0)),
        // The cable down to the board, past the disc's edge.
        rod(0.0028, new THREE.Vector3(0.174, 0.014, 0), new THREE.Vector3(0.186, 0.0028 - DISC, 0)),
      ]).geometry,
    ),
    plastic,
    box,
  ).name = 'housing';
  // The slit plate across the front, the turret's vented cap.
  const plate = new THREE.BoxGeometry(0.003, 0.04, 0.05).translate(SLIT + 0.0015, 0.02, 0);
  const cap = drum(0.0135, 0.0135, 0.05, 0.053, 20).translate(lampAt, 0, 0);
  mesh(keep(part('body', false, [plate, cap]).geometry), steel, box).castShadow = false;
  const lit = own(new THREE.MeshBasicMaterial({ color: '#ff6a4d' })); // reads at any light
  const dark = own(new THREE.MeshStandardMaterial({ color: '#1a1d21', ...LOOKS.plastic }));
  const slit = mesh(keep(new THREE.PlaneGeometry(0.0012, 0.03).rotateY(-Math.PI / 2)), dark, box);
  slit.name = 'slit';
  swaps(slit, lit);
  slit.position.set(SLIT - 0.0002, 0.018, 0);
  slit.castShadow = false;

  // The rays: thin unlit strips on the disc, seen through the block (drawn after it).
  const strip = keep(
    new THREE.PlaneGeometry(1, RAY.width).rotateX(-Math.PI / 2).translate(0.5, RAY.lift, 0),
  );
  const ray = (name: string) => {
    const material = own(
      new THREE.MeshBasicMaterial({
        color: '#ff3b24', // a red-filtered ray: it shows on the white disc
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );
    const m = mesh(strip, material);
    m.name = name;
    m.castShadow = false;
    m.receiveShadow = false;
    m.renderOrder = 1;
    m.visible = false;
    return { mesh: m, material };
  };
  const incident = ray('incident');
  const reflected = ray('reflected');
  const refracted = ray('refracted');
  incident.mesh.scale.x = SLIT;
  incident.material.opacity = 0.9;
  reflected.mesh.scale.x = RAY.out;
  refracted.mesh.scale.x = RAY.out;

  let index = NaN;
  let side = 0;
  let angle = NaN;
  let on: boolean | null = null;
  let refraction = NaN;
  let tir = NaN;
  let reflectance = NaN;
  const pose = ({ parameters, sample }: BenchPose) => {
    const n = parameters.index ?? NaN;
    if (!Object.is(n, index)) {
      index = n;
      if (Number.isFinite(n)) {
        // A higher index reflects more at its faces, so the block reads a little more.
        const t = THREE.MathUtils.clamp((n - 1.33) / (1.62 - 1.33), 0, 1);
        glass.opacity = 0.22 + 0.16 * t;
      }
    }
    const s = (parameters.direction ?? 0) >= 0.5 ? 1 : -1; // the ray box's side of the face
    const run = sample.incidence ?? NaN;
    const lamp = Number.isFinite(run);
    // No run: the ray box rests on the normal, where a run's sweep starts, its lamp off.
    const i = lamp ? run : 0;
    const r = sample.refraction ?? NaN;
    const total = sample.tir ?? NaN;
    const R = sample.reflectance ?? NaN;
    if (
      s === side &&
      i === angle &&
      lamp === on &&
      Object.is(r, refraction) &&
      Object.is(total, tir) &&
      Object.is(R, reflectance)
    )
      return;
    side = s;
    angle = i;
    on = lamp;
    refraction = r;
    tir = total;
    reflectance = R;
    const cos = Math.cos(i);
    const sin = Math.sin(i);
    // rotation.y = φ turns local +x to (cos φ, 0, −sin φ).
    box.rotation.y = Math.atan2(-sin, s * cos);
    slit.material = lamp ? lit : dark;
    incident.mesh.rotation.y = box.rotation.y;
    incident.mesh.visible = lamp;
    // Brightness on a perceptual scale: opacity ∝ √(fraction of the light), so a 4 % reflection
    // still shows, faintly, and a ray carrying none vanishes.
    reflected.mesh.visible = lamp && R >= 0;
    if (reflected.mesh.visible) {
      reflected.mesh.rotation.y = Math.atan2(sin, s * cos);
      reflected.material.opacity = 0.9 * Math.sqrt(Math.min(R, 1));
    }
    refracted.mesh.visible = lamp && total === 0 && Number.isFinite(r) && R >= 0 && R <= 1;
    if (refracted.mesh.visible) {
      refracted.mesh.rotation.y = Math.atan2(Math.sin(r), -s * Math.cos(r));
      refracted.material.opacity = 0.9 * Math.sqrt(1 - R);
    }
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const rayOpticsBoard: BenchModel = {
  frame,
  rig,
  reads: ['incidence', 'refraction', 'tir', 'reflectance'],
};
