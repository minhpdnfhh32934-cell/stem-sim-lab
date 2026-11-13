import * as THREE from 'three';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { ItemDefinition } from '../../../gameplay/item';
import { Assembly, slab, swaps } from '../assembly';
import { LOOKS, METAL } from '../looks';
import { box, drum, part, rod } from '../props/parts';
import type { BenchFrame, BenchModel, BenchRig } from './registry';

/*
 * The plane-mirror board of the reflection experiment, in the item's frame (origin at the centre
 * of its box, y up). The disc's 0° line runs from its centre towards +z (the player); the ray box
 * stands on the −x side at the run's `rayBox` angle θ_box, so its direction from the centre is
 * (−sin θ_box, 0, cos θ_box), and the reflected ray leaves on the +x side at `reflected` φ,
 * along (sin φ, 0, cos φ). The mirror stands on a turntable at the centre, its face through it,
 * turned by the dialled `mirrorTurn` α so its normal points along (sin α, 0, cos α); a white
 * pointer on the normal reads α on the fixed inner scale. Two arcs from the normal to each ray
 * show `incidence` and `reflection`. Every turning part is built pointing along its local +z, so
 * rotation.y is its angle on the disc (negative on the ray box's side). No real-time reflection:
 * the mirror is a bright, smooth standard material, never a Reflector or an extra pass.
 */

const FOOT = 0.004; // rubber feet under the board
const BOARD = 0.014; // the board's thickness
const DISC = 0.003; // the protractor disc's thickness
const DISC_R = 0.13; // radius of the protractor disc
const TABLE_R = 0.03; // the mirror's turntable
const MIRROR = { width: 0.1, height: 0.045, thick: 0.005 };
const SLIT = 0.085; // the ray box's slit from the disc's centre
const RAY = { width: 0.0025, lift: 0.0006, out: 0.12 }; // out: the reflected ray's length
const ARC = { radius: 0.04, half: 0.0015, lift: 0.0004, step: Math.PI / 2 / 360 }; // ¼° steps
const DEG = Math.PI / 180;

/** Height of the disc's face above the item's base: where the rig stands (`bench.top`). */
export const DISC_TOP = FOOT + BOARD + DISC;

/**
 * The protractor printed on the disc, drawn once: a tick every 1°, longer every 5° and 10°,
 * figures every 10° counted from the 0° line (0–90 in each quadrant), the 0° line solid, the
 * 90°–90° line (the square mirror's face) dashed, and the turntable's scale around the centre,
 * which the mirror's pointer reads. Canvas x is the item's x, canvas y its z. Null without a page
 * (tests): the disc is plain white.
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
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    // A graduated ring: ticks from `inner` out to `outer` px, figures at `label` px, `font` px.
    const scale = (inner: number, outer: number, label: number, font: number) => {
      for (let d = 0; d < 360; d++) {
        const a = d * DEG;
        const ten = d % 10 === 0;
        const five = d % 5 === 0;
        const from = outer - (ten ? 1 : five ? 0.65 : 0.4) * (outer - inner);
        c.lineWidth = ten ? 3 : five ? 2 : 1.25;
        c.beginPath();
        c.moveTo(mid + Math.cos(a) * from, mid + Math.sin(a) * from);
        c.lineTo(mid + Math.cos(a) * outer, mid + Math.sin(a) * outer);
        c.stroke();
        if (!ten) continue;
        // 0 on the 0° line (canvas +y), 90 along the 90°–90° line, folded in each quadrant.
        const front = Math.abs(((d - 90 + 540) % 360) - 180);
        c.font = `700 ${font}px system-ui, sans-serif`;
        c.save();
        c.translate(mid + Math.cos(a) * label, mid + Math.sin(a) * label);
        c.rotate(a + Math.PI / 2);
        c.fillText(String(Math.min(front, 180 - front)), 0, 0);
        c.restore();
      }
    };
    // ~11 mm figures on the 0.26 m disc: legible from the desk, about 0.9 m away.
    scale(r - 40, r, r - 64, 44);
    scale(0.033 * s, 0.038 * s, 0.045 * s, 22);
    c.lineWidth = 3; // the 0° line
    c.beginPath();
    c.moveTo(mid, mid - r + 90);
    c.lineTo(mid, mid + r - 90);
    c.stroke();
    c.strokeStyle = '#7d8790'; // the square mirror's face line
    c.lineWidth = 2;
    c.setLineDash([14, 10]);
    c.beginPath();
    c.moveTo(mid - r + 90, mid);
    c.lineTo(mid + r - 90, mid);
    c.stroke();
    c.setLineDash([]);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8; // seen at a grazing angle across the bench
  return texture;
}

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
 * A quarter-ring sector, flat on the disc, from local +z sweeping towards +x; `sweep` shows the
 * first `angle` of it by its draw range (the ring's triangles come in order around it).
 */
function arcGeometry() {
  const ring = new THREE.RingGeometry(
    ARC.radius - ARC.half,
    ARC.radius + ARC.half,
    360,
    1,
    0,
    Math.PI / 2,
  );
  // The ring's +x to the item's +z, its +y to +x, its normal up (a proper rotation).
  ring.applyMatrix4(new THREE.Matrix4().set(0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1));
  return ring.translate(0, ARC.lift, 0);
}
const sweep = (arc: THREE.Mesh, angle: number) =>
  arc.geometry.setDrawRange(0, 6 * Math.min(360, Math.max(0, Math.round(angle / ARC.step))));

/**
 * Standing on the disc's face at `bench.top`: the mirror in its clip on the turntable, turned by
 * α with its pointer and the two angle arcs; the ray box turned to θ_box; the incident and
 * reflected rays, unit strips along local +z from the centre, turned and scaled. Nothing is made
 * in `pose`.
 */
function rig(item: ItemDefinition): BenchRig {
  const kit = new Assembly();
  const { keep, own, mesh } = kit;
  const [x, y, z] = item.bench?.top ?? [0, DISC_TOP, 0];
  kit.group.position.set(x, y - item.visual.size[1] / 2, z);

  const plastic = own(new THREE.MeshStandardMaterial({ color: '#2b2f36', ...LOOKS.plastic }));
  const steel = own(new THREE.MeshStandardMaterial({ color: '#b4bcc4', ...LOOKS.metal }));
  const white = own(new THREE.MeshStandardMaterial({ color: '#f4f6f7', ...LOOKS.plastic }));
  // Bright and smooth: reads as a mirror under the lab's lights and its environment map.
  const silver = own(
    new THREE.MeshStandardMaterial({
      color: '#e6ecf0',
      roughness: 0.08,
      metalness: 0.55,
      name: METAL,
    }),
  );

  // The mirror's turntable, its face through the centre facing local +z, the clip behind it.
  const mirror = new THREE.Group();
  mirror.name = 'mirror';
  kit.group.add(mirror);
  const postY = 0.008 + MIRROR.height / 2;
  mesh(
    keep(
      part('body', true, [
        drum(TABLE_R, TABLE_R, 0, 0.004, 48),
        box(MIRROR.width + 0.004, 0.004, 0.012, 0, 0.006, -0.006), // the clip's base
        box(0.004, MIRROR.height, 0.008, -(MIRROR.width / 2 + 0.002), postY, -0.004),
        box(0.004, MIRROR.height, 0.008, MIRROR.width / 2 + 0.002, postY, -0.004),
      ]).geometry,
    ),
    plastic,
    mirror,
  ).name = 'clip';
  mesh(
    keep(box(MIRROR.width, MIRROR.height, MIRROR.thick, 0, postY, -MIRROR.thick / 2)),
    silver,
    mirror,
  ).name = 'glass';
  // The normal: a line across the turntable's top and a pointer arm over the fixed inner scale.
  const pointer = mesh(
    keep(
      part('body', false, [
        box(0.003, 0.0006, TABLE_R, 0, 0.0043, TABLE_R / 2),
        box(0.004, 0.0008, 0.035, 0, 0.0008, TABLE_R + 0.0175),
      ]).geometry,
    ),
    white,
    mirror,
  );
  pointer.name = 'pointer';
  pointer.castShadow = false;
  const ink = own(
    new THREE.MeshBasicMaterial({
      color: '#1f6fd0',
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  const arc = (name: string, side: 1 | -1) => {
    const m = mesh(keep(arcGeometry()), ink, mirror);
    m.name = name;
    m.scale.x = side; // mirrored towards the ray box's side for the incidence arc
    m.castShadow = false;
    m.receiveShadow = false;
    m.renderOrder = 1;
    m.visible = false;
    return m;
  };
  const arcIn = arc('incidence-arc', -1);
  const arcOut = arc('reflection-arc', 1);

  // The ray box, built pointing out along +z, its slit SLIT from the centre.
  const rayBox = new THREE.Group();
  rayBox.name = 'ray-box';
  kit.group.add(rayBox);
  const housing = slab(0.036, 0.078, 0.042, 0.006, 0.002).translate(0, 0, SLIT + 0.003 + 0.039);
  // Beyond the disc's edge the housing stands on a skid DISC thick, down to the board.
  const skidFrom = DISC_R + 0.001;
  const skidTo = SLIT + 0.003 + 0.078;
  const skid = slab(0.036, skidTo - skidFrom, DISC, 0.004, 0.0005).translate(
    0,
    -DISC,
    (skidFrom + skidTo) / 2,
  );
  const lampAt = SLIT + 0.06;
  mesh(
    keep(
      part('body', true, [
        housing,
        skid,
        drum(0.013, 0.012, 0.042, 0.05, 20).translate(0, 0, lampAt), // the bulb's turret
        rod(0.005, new THREE.Vector3(0, 0.014, 0.164), new THREE.Vector3(0, 0.014, 0.174)),
        // The cable down to the board, past the disc's edge.
        rod(0.0028, new THREE.Vector3(0, 0.014, 0.174), new THREE.Vector3(0, 0.0028 - DISC, 0.186)),
      ]).geometry,
    ),
    plastic,
    rayBox,
  ).name = 'housing';
  // The slit plate across the front (narrow: at θ 60° with α 15° it passes the mirror's face 15°
  // off), the turret's vented cap.
  const plate = new THREE.BoxGeometry(0.04, 0.04, 0.003).translate(0, 0.02, SLIT + 0.0015);
  const cap = drum(0.0135, 0.0135, 0.05, 0.053, 20).translate(0, 0, lampAt);
  mesh(keep(part('body', false, [plate, cap]).geometry), steel, rayBox).castShadow = false;
  const lit = own(new THREE.MeshBasicMaterial({ color: '#ff6a4d' })); // reads at any light
  const dark = own(new THREE.MeshStandardMaterial({ color: '#1a1d21', ...LOOKS.plastic }));
  const slit = mesh(keep(new THREE.PlaneGeometry(0.0012, 0.03).rotateY(Math.PI)), dark, rayBox);
  slit.name = 'slit';
  swaps(slit, lit);
  slit.position.set(0, 0.018, SLIT - 0.0002);
  slit.castShadow = false;

  // The rays: thin unlit strips on the disc, the same brightness each (reflectance is not modelled).
  const strip = keep(
    new THREE.PlaneGeometry(RAY.width, 1).rotateX(-Math.PI / 2).translate(0, RAY.lift, 0.5),
  );
  const red = own(
    new THREE.MeshBasicMaterial({
      color: '#ff3b24', // a red-filtered ray: it shows on the white disc
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  const ray = (name: string, length: number) => {
    const m = mesh(strip, red);
    m.name = name;
    m.scale.z = length;
    m.castShadow = false;
    m.receiveShadow = false;
    m.renderOrder = 1;
    m.visible = false;
    return m;
  };
  const incident = ray('incident', SLIT);
  const reflected = ray('reflected', RAY.out);

  let alpha = NaN;
  let theta = NaN;
  let on: boolean | null = null;
  let phi = NaN;
  let incidence = NaN;
  let reflection = NaN;
  const pose = ({ parameters, sample }: BenchPose) => {
    // The run's α during a run, the dial's otherwise: the mirror follows the dial while idle.
    const a = (parameters.mirrorTurn ?? 0) * DEG;
    const turn = Number.isFinite(a) ? a : 0;
    if (turn !== alpha) {
      alpha = turn;
      mirror.rotation.y = turn;
    }
    const run = sample.rayBox ?? NaN;
    const lamp = Number.isFinite(run);
    // No run: the ray box rests on the 0° mark, where a run's sweep starts, its lamp off.
    const t = lamp ? run : 0;
    const r = sample.reflected ?? NaN;
    const i = sample.incidence ?? NaN;
    const i2 = sample.reflection ?? NaN;
    if (
      t === theta &&
      lamp === on &&
      Object.is(r, phi) &&
      Object.is(i, incidence) &&
      Object.is(i2, reflection)
    )
      return;
    theta = t;
    on = lamp;
    phi = r;
    incidence = i;
    reflection = i2;
    rayBox.rotation.y = -t;
    slit.material = lamp ? lit : dark;
    incident.rotation.y = -t;
    incident.visible = lamp;
    reflected.visible = lamp && Number.isFinite(r);
    if (reflected.visible) reflected.rotation.y = r;
    arcIn.visible = lamp && Number.isFinite(i);
    if (arcIn.visible) sweep(arcIn, i);
    arcOut.visible = lamp && Number.isFinite(i2);
    if (arcOut.visible) sweep(arcOut, i2);
  };
  return { group: kit.group, pose, dispose: () => kit.dispose() };
}

export const mirrorBoard: BenchModel = {
  frame,
  rig,
  reads: ['rayBox', 'reflected', 'incidence', 'reflection'],
};
