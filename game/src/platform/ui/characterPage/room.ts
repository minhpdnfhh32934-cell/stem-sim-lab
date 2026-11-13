import * as THREE from 'three';
import { SEAT } from '../../render/body/actor';
import { type Seat, SEATS } from './seating';

/*
 * The institute's common room behind the character page (contract D2; C-9 a group in view): the
 * project's whiteboard on the back wall, a café counter along the left wall, windows on the right,
 * plants, pendant lamps; bright and even. The furniture stands where the people are
 * (`seating.ts`): an armchair, a sofa for two, a café table and its chairs, a desk with a laptop.
 * The whiteboard shows only sketches, graphs and formulas (no words to translate).
 */

const ROOM = { x: 6.4, back: -8, front: 4, height: 3.2 };

export interface CommonRoom {
  readonly group: THREE.Group;
  dispose(): void;
}

export function commonRoom(shadows: boolean): CommonRoom {
  const group = new THREE.Group();
  group.name = 'common-room';
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const look = (color: string, roughness = 0.7, metalness = 0) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    materials.push(m);
    return m;
  };
  const box = (
    w: number,
    h: number,
    d: number,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    parent: THREE.Object3D = group,
  ) => {
    const g = new THREE.BoxGeometry(w, h, d);
    geometries.push(g);
    const m = new THREE.Mesh(g, material);
    m.position.set(x, y, z);
    m.castShadow = shadows && Math.min(w, h, d) > 0.03;
    m.receiveShadow = shadows;
    parent.add(m);
    return m;
  };
  const cylinder = (
    r0: number,
    r1: number,
    h: number,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
  ) => {
    const g = new THREE.CylinderGeometry(r1, r0, h, 20);
    geometries.push(g);
    const m = new THREE.Mesh(g, material);
    m.position.set(x, y + h / 2, z);
    m.castShadow = shadows;
    m.receiveShadow = shadows;
    group.add(m);
    return m;
  };

  const floor = look('#b58a5e', 0.75);
  const wall = look('#eef0ee', 0.9);
  const accentWall = look('#9fc7c2', 0.9);
  const wood = look('#8a6240', 0.6);
  const white = look('#f6f7f8', 0.5);
  const dark = look('#2b2f36', 0.5);
  const steel = look('#c9ced3', 0.35, 0.6);
  const fabric = look('#4f6f8f', 0.95);
  const cushion = look('#e5b85c', 0.95);
  const leaf = look('#4f8f4a', 0.8);
  const pot = look('#d9d2c6', 0.8);
  const rug = look('#c9a98a', 1);

  // The shell: floor, ceiling, walls (the back one in the institute's teal), skirting.
  const width = ROOM.x * 2;
  const depth = ROOM.front - ROOM.back;
  const mid = (ROOM.front + ROOM.back) / 2;
  box(width, 0.04, depth, floor, 0, -0.02, mid);
  box(width, 0.04, depth, white, 0, ROOM.height + 0.02, mid);
  box(width, ROOM.height, 0.1, accentWall, 0, ROOM.height / 2, ROOM.back - 0.05);
  box(0.1, ROOM.height, depth, wall, -ROOM.x - 0.05, ROOM.height / 2, mid);
  box(0.1, ROOM.height, depth, wall, ROOM.x + 0.05, ROOM.height / 2, mid);
  box(width, 0.1, 0.02, dark, 0, 0.05, ROOM.back + 0.01);

  // The whiteboard on the back wall behind the group, its sketches on a canvas.
  const bx = -0.6;
  box(2.6, 1.3, 0.05, steel, bx, 1.65, ROOM.back + 0.04);
  const sketch = whiteboardSketch();
  textures.push(sketch);
  const face = new THREE.MeshStandardMaterial({ map: sketch, roughness: 0.35 });
  materials.push(face);
  const boardFace = box(2.5, 1.2, 0.01, face, bx, 1.65, ROOM.back + 0.07);
  boardFace.castShadow = false;
  box(2.4, 0.04, 0.08, steel, bx, 0.98, ROOM.back + 0.1);

  // The café counter along the left wall, the coffee machine, cups and a shelf above.
  const cz = -4.5;
  const counterX = -ROOM.x + 0.35;
  box(0.65, 0.95, 3.4, wood, counterX, 0.475, cz);
  box(0.72, 0.04, 3.5, white, counterX, 0.97, cz);
  box(0.4, 0.45, 0.35, dark, counterX - 0.05, 1.2, cz - 0.9);
  box(0.25, 0.08, 0.2, steel, counterX + 0.02, 1.02, cz - 0.9);
  for (const dz of [0.3, 0.5, 0.7, 1.2])
    cylinder(0.035, 0.04, 0.09, white, counterX + 0.1, 0.99, cz + dz);
  box(0.3, 0.03, 3.0, wood, -ROOM.x + 0.15, 1.85, cz);
  for (const dz of [-1.1, -0.6, 0.1, 0.8, 1.3])
    cylinder(0.05, 0.05, 0.18, pot, -ROOM.x + 0.15, 1.87, cz + dz);

  const glow = new THREE.MeshBasicMaterial({ color: '#9fd0ff' });
  materials.push(glow);

  // The furniture each place needs (`seating.ts`), turned with the one sitting there: an armchair,
  // the sofa (one for two places side by side), a café table between its two chairs, a desk with
  // a laptop. Each part is set out in the seat's own frame: x across, z back (behind the sitter).
  const seatFrame = (seat: Seat) => {
    const frame = new THREE.Group();
    frame.position.set(seat.x, 0, seat.z);
    frame.rotation.y = seat.heading; // its +z behind the sitter, who faces its −z
    group.add(frame);
    return frame;
  };
  /** A chair's seat and back, `width` wide, its seat `SEAT` m up, set back as the sitter sits. */
  const chair = (frame: THREE.Object3D, material: THREE.Material, width: number, arms: boolean) => {
    box(width, 0.12, 0.5, material, 0, SEAT - 0.06, 0.1, frame);
    box(width, 0.5, 0.12, material, 0, SEAT + 0.22, 0.38, frame);
    if (arms)
      for (const s of [-1, 1])
        box(0.12, 0.22, 0.55, material, s * (width / 2 + 0.06), SEAT + 0.05, 0.12, frame);
    box(width, SEAT - 0.12, 0.45, dark, 0, (SEAT - 0.12) / 2, 0.1, frame);
  };
  const sofaSeats = new Set<number>();
  SEATS.forEach((seat, i) => {
    if (seat.kind === 'armchair') {
      chair(seatFrame(seat), fabric, 0.62, true);
    } else if (seat.kind === 'sofa' && !sofaSeats.has(i)) {
      // A sofa for this seat and its partner beside it, a cushion behind each, a low table and rug.
      const other = seat.partner === undefined ? undefined : SEATS[seat.partner];
      if (seat.partner !== undefined) sofaSeats.add(seat.partner);
      sofaSeats.add(i);
      const mid = other
        ? { ...seat, x: (seat.x + other.x) / 2, z: (seat.z + other.z) / 2, heading: Math.PI }
        : seat;
      const frame = seatFrame(mid);
      const span = other ? Math.abs(other.x - seat.x) + 0.75 : 0.8;
      box(span, 0.12, 0.6, fabric, 0, SEAT - 0.06, 0.12, frame);
      box(span, 0.55, 0.2, fabric, 0, SEAT + 0.2, 0.42, frame);
      box(span, SEAT - 0.12, 0.6, dark, 0, (SEAT - 0.12) / 2, 0.12, frame);
      for (const s of [-1, 1])
        box(0.16, 0.62, 0.75, fabric, s * (span / 2 + 0.08), 0.31, 0.15, frame);
      for (const dx of [-span / 4, span / 4])
        box(0.4, 0.34, 0.1, cushion, dx, SEAT + 0.24, 0.3, frame);
      box(span + 0.8, 0.01, 1.8, rug, 0, 0.005, -0.4, frame);
      box(0.9, 0.04, 0.5, wood, 0, 0.42, -0.85, frame);
      for (const dx of [-0.38, 0.38]) box(0.04, 0.4, 0.4, wood, dx, 0.2, -0.85, frame);
    } else if (seat.kind === 'chair') {
      chair(seatFrame(seat), dark, 0.44, false);
      // The café table between a pair: once, by the first of them.
      const other = seat.partner === undefined ? undefined : SEATS[seat.partner];
      if (other && (seat.partner ?? 0) > i) {
        const tx = (seat.x + other.x) / 2;
        const tz = (seat.z + other.z) / 2 + 0.05;
        cylinder(0.32, 0.32, 0.03, white, tx, 0.72, tz);
        cylinder(0.03, 0.03, 0.72, steel, tx, 0, tz);
        cylinder(0.22, 0.22, 0.02, steel, tx, 0, tz);
        for (const dx of [-0.12, 0.14])
          cylinder(0.035, 0.04, 0.09, white, tx + dx, 0.75, tz + 0.05);
      }
    } else if (seat.kind === 'desk') {
      const frame = seatFrame(seat);
      chair(frame, dark, 0.44, false);
      // The desk in front of the sitter, the laptop on it, its screen towards them.
      box(1.0, 0.04, 0.55, white, 0, 0.74, -0.5, frame);
      for (const dx of [-0.46, 0.46]) box(0.04, 0.72, 0.5, steel, dx, 0.36, -0.5, frame);
      box(0.34, 0.015, 0.23, steel, 0, 0.77, -0.42, frame);
      const screen = box(0.34, 0.22, 0.012, dark, 0, 0.88, -0.56, frame);
      screen.rotation.x = -0.25;
      const lit = box(0.31, 0.19, 0.002, glow, 0, 0.88, -0.553, frame);
      lit.rotation.x = -0.25;
      lit.castShadow = false;
    }
  });

  // Windows along the right wall: a bright sky behind mullions.
  const sky = skyTexture();
  textures.push(sky);
  const skyLook = new THREE.MeshBasicMaterial({ map: sky });
  materials.push(skyLook);
  for (const z of [-6.2, -3.6, -1.0]) {
    const pane = box(0.02, 1.7, 2.2, skyLook, ROOM.x - 0.01, 1.75, z);
    pane.castShadow = false;
    box(0.06, 1.8, 0.06, white, ROOM.x - 0.03, 1.75, z - 1.1);
    box(0.06, 1.8, 0.06, white, ROOM.x - 0.03, 1.75, z + 1.1);
    box(0.06, 0.06, 2.26, white, ROOM.x - 0.03, 0.88, z);
  }

  // Plants in the corners and by the windows.
  for (const [x, z, h] of [
    [-5.9, -7.5, 1.1],
    [5.8, -7.4, 1.3],
    [-5.9, -1.2, 0.9],
    [5.9, 0.6, 1.0],
  ] as const) {
    cylinder(0.2, 0.24, 0.4, pot, x, 0, z);
    const g = new THREE.SphereGeometry(1, 16, 12);
    geometries.push(g);
    for (const [dx, dy, r] of [
      [0, h, 0.38],
      [0.15, h - 0.25, 0.28],
      [-0.14, h - 0.2, 0.3],
    ] as const) {
      const m = new THREE.Mesh(g, leaf);
      m.position.set(x + dx, dy, z);
      m.scale.setScalar(r);
      m.castShadow = shadows;
      group.add(m);
    }
  }

  // Pendant lamps, glowing.
  const lampLook = new THREE.MeshBasicMaterial({ color: '#fff4dc' });
  materials.push(lampLook);
  for (const [x, z] of [
    [-3.4, -4],
    [0.6, -4.5],
    [3.5, -5.8],
    [-4.4, -6.8],
  ] as const) {
    box(0.01, 0.7, 0.01, dark, x, ROOM.height - 0.35, z);
    cylinder(0.26, 0.08, 0.2, dark, x, ROOM.height - 0.9, z);
    const bulb = box(0.3, 0.02, 0.3, lampLook, x, ROOM.height - 0.9, z);
    bulb.castShadow = false;
  }

  // Light: an even sky fill, the windows' daylight (shadows when the preset has them), a soft
  // key from the camera's side for faces.
  const hemi = new THREE.HemisphereLight('#f4f7fb', '#9a8670', 1.6);
  const sun = new THREE.DirectionalLight('#fff3e2', 2.2);
  sun.position.set(9, 7, -2);
  sun.target.position.set(-1, 0, -3);
  sun.castShadow = shadows;
  if (shadows) {
    sun.shadow.mapSize.set(2048, 2048);
    const c = sun.shadow.camera;
    c.left = -9;
    c.right = 9;
    c.top = 7;
    c.bottom = -7;
    c.near = 1;
    c.far = 30;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
  }
  const key = new THREE.DirectionalLight('#ffffff', 1.1);
  key.position.set(-1.5, 3, 5);
  group.add(hemi, sun, sun.target, key);

  return {
    group,
    dispose: () => {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
      sun.shadow.map?.dispose();
    },
  };
}

/** The project's sketches: a graph, a wave, boxes and arrows, formulas. */
function whiteboardSketch(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 492;
  const c = canvas.getContext('2d');
  if (!c) return new THREE.Texture();
  c.fillStyle = '#fbfcfd';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.lineWidth = 5;
  c.lineCap = 'round';
  // A graph: axes and a rising curve with points.
  c.strokeStyle = '#1f3d7a';
  c.beginPath();
  c.moveTo(70, 60);
  c.lineTo(70, 400);
  c.lineTo(420, 400);
  c.stroke();
  c.strokeStyle = '#cf343b';
  c.beginPath();
  for (let i = 0; i <= 40; i++) {
    const x = 80 + i * 8.5;
    const y = 390 - 300 * (1 - Math.exp(-i / 12));
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.stroke();
  c.fillStyle = '#1f3d7a';
  for (const i of [4, 10, 17, 25, 33]) {
    c.beginPath();
    c.arc(80 + i * 8.5, 390 - 300 * (1 - Math.exp(-i / 12)) + (i % 2 ? 9 : -7), 7, 0, Math.PI * 2);
    c.fill();
  }
  // A wave and two boxes joined by an arrow.
  c.strokeStyle = '#2f6f6a';
  c.beginPath();
  for (let x = 480; x <= 960; x += 6) {
    const y = 110 + 40 * Math.sin((x - 480) / 30) * Math.exp(-(x - 480) / 400);
    if (x === 480) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.stroke();
  c.strokeStyle = '#1f3d7a';
  c.strokeRect(500, 240, 150, 90);
  c.strokeRect(790, 240, 150, 90);
  c.beginPath();
  c.moveTo(660, 285);
  c.lineTo(780, 285);
  c.moveTo(760, 270);
  c.lineTo(780, 285);
  c.lineTo(760, 300);
  c.stroke();
  // Formulas (symbols are not translated).
  c.fillStyle = '#1d1f23';
  c.font = 'italic 44px Georgia, serif';
  c.fillText('E = k·Q/r²', 510, 420);
  c.fillText('λ = v/f', 820, 420);
  c.font = 'italic 34px Georgia, serif';
  c.fillText('pH = −log[H⁺]', 520, 200);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** A clear day: blue at the top, pale at the horizon, a few distant roofs. */
function skyTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const c = canvas.getContext('2d');
  if (!c) return new THREE.Texture();
  const g = c.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#7fb6ea');
  g.addColorStop(0.7, '#d7ecf8');
  g.addColorStop(1, '#eef6f6');
  c.fillStyle = g;
  c.fillRect(0, 0, 256, 256);
  c.fillStyle = '#b9c9d3';
  for (const [x, w, h] of [
    [0, 40, 50],
    [45, 30, 80],
    [80, 50, 40],
    [135, 35, 95],
    [175, 45, 60],
    [225, 31, 75],
  ] as const) {
    c.fillRect(x, 256 - h, w, h);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
