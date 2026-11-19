import * as THREE from 'three';
import { LAB_AT } from './site';

/*
 * SimLab from outside, floating over the city (Phase W-3): the round hub hall in the middle — its
 * glass wall between white bands, a low glass dome with the oculus the squad blows open — and the
 * three wings (Physics, Chemistry, Biology) out from it, two storeys of white panels and window
 * bands, each with its subject's stripe and its name. Every building stands on its own slab, flat
 * underneath (Phú: the player looks down through the hub's glass floor), with the glass floor in it
 * and lift emitters flush in the slabs, glowing. By night (`night` 0–1) the windows and the hall
 * light up, edge strips trace the roofs, the emitters burn and throw light down, beacons blink.
 * It bobs very slowly. Panels and windows are painted once on canvases (seams, mullions, rooms).
 */

export interface FloatingLab {
  readonly group: THREE.Group;
  /** The oculus's middle (world, updated each frame): where the helicopter hovers and blasts. */
  readonly roofTop: THREE.Vector3;
  /** The dome's glass over the oculus: hidden while blown open (W-5). */
  readonly oculus: THREE.Object3D;
  update(time: number, night: number): void;
  dispose(): void;
}

/** The hall's radius and height, the wings' size (m). */
const HALL_R = 20;
const HALL_H = 14;
const WING = { length: 50, width: 24, height: 10 } as const;
const SLAB = 3.6;
const SUBJECTS = [
  { name: 'PHYSICS', colour: '#2f7fd8', angle: Math.PI / 6 },
  { name: 'CHEMISTRY', colour: '#e07a22', angle: (5 * Math.PI) / 6 },
  { name: 'BIOLOGY', colour: '#3aa65a', angle: (3 * Math.PI) / 2 },
] as const;

export function floatingLab(): FloatingLab {
  const group = new THREE.Group();
  group.name = 'wallpaper-lab';
  const body = new THREE.Group();
  group.add(body);
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const made = <T extends THREE.Material>(m: T) => (materials.push(m), m);
  const add = (
    g: THREE.BufferGeometry,
    m: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
    parent: THREE.Object3D = body,
  ) => {
    geometries.push(g);
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };

  const panelMap = panels();
  const facade = facadeMaps();
  const glassMap = mullions();
  textures.push(panelMap, facade.map, facade.glow, glassMap);
  const panel = made(
    new THREE.MeshStandardMaterial({
      map: panelMap,
      color: '#d4d8dc',
      roughness: 0.38,
      metalness: 0.1,
    }),
  );
  const facadeMaterial = made(
    new THREE.MeshStandardMaterial({
      map: facade.map,
      emissiveMap: facade.glow,
      emissive: '#ffffff',
      emissiveIntensity: 0,
      roughness: 0.3,
      metalness: 0.25,
    }),
  );
  const trim = made(
    new THREE.MeshStandardMaterial({ color: '#4c555e', roughness: 0.35, metalness: 0.8 }),
  );
  const under = made(
    new THREE.MeshStandardMaterial({
      map: panelMap,
      color: '#8d959c',
      roughness: 0.5,
      metalness: 0.55,
    }),
  );
  const hallGlass = made(
    new THREE.MeshStandardMaterial({
      map: glassMap,
      color: '#9fb4c2',
      roughness: 0.05,
      metalness: 0.9,
      emissive: '#ffd6a0',
      emissiveIntensity: 0,
    }),
  );
  const domeGlass = made(
    new THREE.MeshStandardMaterial({
      color: '#36505f',
      roughness: 0.04,
      metalness: 0.92,
      emissive: '#ffe2b8',
      emissiveIntensity: 0,
    }),
  );
  const floorGlass = made(
    new THREE.MeshStandardMaterial({
      color: '#203440',
      roughness: 0.05,
      metalness: 0.8,
      emissive: '#ffe7c4',
      emissiveIntensity: 0,
    }),
  );
  const emitter = made(
    new THREE.MeshStandardMaterial({ color: '#0b1820', emissive: '#56e0ff', emissiveIntensity: 1 }),
  );
  const strip = made(
    new THREE.MeshStandardMaterial({ color: '#1b2a30', emissive: '#7ff3ff', emissiveIntensity: 0 }),
  );
  const red = made(
    new THREE.MeshStandardMaterial({ color: '#400', emissive: '#ff2a1a', emissiveIntensity: 0 }),
  );
  const white = made(
    new THREE.MeshStandardMaterial({ color: '#333', emissive: '#ffffff', emissiveIntensity: 0 }),
  );
  const fade = keepFade();
  textures.push(fade);
  const beam = made(
    new THREE.MeshBasicMaterial({
      color: '#6fe6ff',
      alphaMap: fade,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );

  // The hall: its slab, a white plinth band, the glass wall, the roof band, the dome and oculus.
  add(new THREE.CylinderGeometry(HALL_R + 2, HALL_R + 2, SLAB, 128), panel, 0, -SLAB / 2, 0);
  add(new THREE.CylinderGeometry(HALL_R + 1.8, HALL_R + 1.8, 0.3, 128), under, 0, -SLAB - 0.05, 0);
  add(new THREE.CylinderGeometry(HALL_R + 2.15, HALL_R + 2.15, 0.5, 128), trim, 0, -0.5, 0);
  add(new THREE.CylinderGeometry(HALL_R, HALL_R, 1.4, 128), panel, 0, 0.7, 0);
  const wallH = HALL_H - 3.2;
  add(
    new THREE.CylinderGeometry(HALL_R - 0.2, HALL_R - 0.2, wallH, 128, 1, true),
    hallGlass,
    0,
    1.4 + wallH / 2,
    0,
  );
  add(new THREE.CylinderGeometry(HALL_R + 1.2, HALL_R, 1.8, 128), panel, 0, HALL_H - 0.9, 0);
  add(new THREE.TorusGeometry(HALL_R + 1.25, 0.12, 6, 160), strip, 0, HALL_H + 0.02, 0).rotation.x =
    Math.PI / 2;
  // The dome: a ring of glass round the oculus, and the oculus's own glass (blown open in a raid).
  const domeR = HALL_R + 1;
  const domeY = HALL_H - 17.6;
  add(
    new THREE.SphereGeometry(domeR, 96, 24, 0, Math.PI * 2, 0.16, Math.PI * 0.12),
    domeGlass,
    0,
    domeY,
    0,
  );
  add(
    new THREE.TorusGeometry(domeR * Math.sin(0.16), 0.32, 10, 64),
    trim,
    0,
    domeY + domeR * Math.cos(0.16),
    0,
  ).rotation.x = Math.PI / 2;
  const oculus = add(
    new THREE.SphereGeometry(domeR, 48, 8, 0, Math.PI * 2, 0, 0.16),
    domeGlass,
    0,
    domeY,
    0,
  );
  // The mast on the dome's ring, its beacon.
  add(new THREE.CylinderGeometry(0.12, 0.2, 9, 8), trim, 6.5, HALL_H + 6.5, 0);
  add(new THREE.SphereGeometry(0.4, 12, 8), red, 6.5, HALL_H + 11.1, 0);
  // The hub's glass floor (18 × 10 m, its centre 3 m north of the hall's), seen from below.
  add(new THREE.BoxGeometry(18, 0.4, 10), floorGlass, 0, -SLAB - 0.05, -3);

  // The wings.
  const lit: THREE.MeshStandardMaterial[] = [];
  const navs: THREE.MeshStandardMaterial[] = [];
  const beams: THREE.Mesh[] = [];
  for (const subject of SUBJECTS) {
    const wing = new THREE.Group();
    wing.rotation.y = subject.angle;
    body.add(wing);
    const mid = -(HALL_R - 2 + WING.length / 2);
    const end = -(HALL_R - 2 + WING.length);
    add(
      meteredBox(WING.width, WING.height, WING.length, 4, WING.height),
      facadeMaterial,
      0,
      WING.height / 2,
      mid,
      wing,
    );
    // The roof: a parapet band, its deck, plant boxes, a tilted solar array, edge strips.
    add(
      new THREE.BoxGeometry(WING.width + 0.6, 1.1, WING.length + 0.6),
      panel,
      0,
      WING.height + 0.55,
      mid,
      wing,
    );
    add(
      new THREE.BoxGeometry(WING.width - 1, 0.2, WING.length - 1),
      under,
      0,
      WING.height + 1.0,
      mid,
      wing,
    );
    for (let k = 0; k < 3; k++) {
      add(new THREE.BoxGeometry(3.2, 1.8, 4.4), panel, -6 + k * 6, WING.height + 2, mid + 12, wing);
    }
    add(
      new THREE.BoxGeometry(WING.width - 6, 0.25, 16),
      trim,
      0,
      WING.height + 1.6,
      mid - 10,
      wing,
    ).rotation.x = -0.2;
    add(
      new THREE.BoxGeometry(WING.width + 0.7, 0.14, 0.14),
      strip,
      0,
      WING.height + 1.12,
      end - 0.3,
      wing,
    );
    for (const side of [-1, 1]) {
      add(
        new THREE.BoxGeometry(0.14, 0.14, WING.length + 0.6),
        strip,
        side * (WING.width / 2 + 0.33),
        WING.height + 1.12,
        mid,
        wing,
      );
    }
    // The subject's stripe along both sides, and its name on the end wall.
    const accent = made(
      new THREE.MeshStandardMaterial({
        color: subject.colour,
        emissive: subject.colour,
        emissiveIntensity: 0,
        roughness: 0.4,
      }),
    );
    lit.push(accent);
    for (const side of [-1, 1]) {
      add(
        new THREE.BoxGeometry(0.1, 0.5, WING.length - 4),
        accent,
        side * (WING.width / 2 + 0.06),
        4.6,
        mid,
        wing,
      );
    }
    const sign = signMaterial(subject.name, subject.colour);
    if (sign.map) textures.push(sign.map);
    lit.push(made(sign));
    add(new THREE.PlaneGeometry(16, 2.6), sign, 0, WING.height - 1.6, end - 0.02, wing).rotation.y =
      Math.PI;
    // Its slab, flat underneath, a little proud of the wing.
    add(
      meteredBox(WING.width + 2, SLAB, WING.length + 2, 6, SLAB),
      panel,
      0,
      -SLAB / 2,
      mid - 1,
      wing,
    );
    add(
      new THREE.BoxGeometry(WING.width + 1.6, 0.3, WING.length + 1.6),
      under,
      0,
      -SLAB - 0.05,
      mid - 1,
      wing,
    );
    add(
      new THREE.BoxGeometry(WING.width + 2.3, 0.5, WING.length + 2.3),
      trim,
      0,
      -0.5,
      mid - 1,
      wing,
    );
    // Two lift emitters under it, each throwing a faint cone of light down by night.
    for (const at of [mid + 8, end + 9]) {
      add(new THREE.CylinderGeometry(4.4, 4.4, 0.2, 48), trim, 0, -SLAB - 0.15, at, wing);
      add(
        new THREE.TorusGeometry(4.2, 0.34, 10, 64),
        emitter,
        0,
        -SLAB - 0.25,
        at,
        wing,
      ).rotation.x = Math.PI / 2;
      add(new THREE.CircleGeometry(3.6, 40), emitter, 0, -SLAB - 0.22, at, wing).rotation.x =
        Math.PI / 2;
      beams.push(
        add(new THREE.CylinderGeometry(3.6, 9, 46, 40, 1, true), beam, 0, -SLAB - 23.3, at, wing),
      );
    }
    // Navigation lights at the end's corners (red left, green right), a strobe on the roof's end.
    for (const side of [-1, 1]) {
      const nav = made(
        new THREE.MeshStandardMaterial({
          color: '#111',
          emissive: side < 0 ? '#ff2a1a' : '#26ff6a',
          emissiveIntensity: 0,
        }),
      );
      navs.push(nav);
      add(
        new THREE.SphereGeometry(0.35, 10, 8),
        nav,
        side * (WING.width / 2 + 0.6),
        -1.2,
        end - 1.6,
        wing,
      );
    }
    add(new THREE.SphereGeometry(0.3, 10, 8), white, 0, WING.height + 1.5, end - 0.6, wing);
  }

  group.position.set(LAB_AT.x, LAB_AT.y, LAB_AT.z);
  group.rotation.y = 0.35;
  const roofTop = new THREE.Vector3();

  return {
    group,
    roofTop,
    oculus,
    update(time, night) {
      // Afloat: a slow bob and the faintest roll.
      body.position.y = Math.sin(time * 0.31) * 0.6;
      body.rotation.z = Math.sin(time * 0.23) * 0.003;
      facadeMaterial.emissiveIntensity = 0.04 + 1.4 * night;
      hallGlass.emissiveIntensity = 0.02 + 0.9 * night;
      domeGlass.emissiveIntensity = 0.5 * night;
      floorGlass.emissiveIntensity = 1.5 * night;
      strip.emissiveIntensity = 3.2 * night;
      emitter.emissiveIntensity = 1.4 + 4 * night + Math.sin(time * 2.1) * 0.2;
      beam.opacity = 0.09 * night * (0.9 + 0.1 * Math.sin(time * 1.7));
      for (const cone of beams) cone.visible = night > 0.02;
      for (const m of lit) m.emissiveIntensity = 0.1 + 2.2 * night;
      // The beacon blinks; the strobes flash twice, two seconds apart; the navigation lights burn.
      red.emissiveIntensity = (time % 1.6 < 0.5 ? 4 : 0.2) * (0.3 + 0.7 * night);
      const t2 = time % 2;
      white.emissiveIntensity = t2 < 0.08 || (t2 > 0.22 && t2 < 0.3) ? 9 : 0;
      for (const m of navs) m.emissiveIntensity = 0.6 + 3 * night;
      roofTop.set(0, HALL_H + 3, 0).applyMatrix4(body.matrixWorld);
    },
    dispose: () => {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
    },
  };
}

/** A light cone's fade: strong at the emitter (the top of the cylinder's v), gone at the bottom. */
function keepFade(): THREE.CanvasTexture {
  const [c, g] = canvas(4, 128);
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.35, '#555555');
  grad.addColorStop(1, '#000000');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(c);
}

/** A box whose faces' textures repeat every `tileW` × `tileH` metres (not stretched per face). */
function meteredBox(
  w: number,
  h: number,
  d: number,
  tileW: number,
  tileH: number,
): THREE.BoxGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.getAttribute('uv');
  // Faces in order +x, −x, +y, −y, +z, −z; four vertices each.
  const dims: [number, number][] = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  dims.forEach(([fu, fv], f) => {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, (uv.getX(i) * fu) / tileW, (uv.getY(i) * fv) / tileH);
    }
  });
  return g;
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) throw new Error('no 2D canvas for the lab');
  return [c, g];
}

function texture(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** White composite panels: a 4 × 4 m tile of 2 × 1 m panels, fine seams, rain streaks. */
function panels(): THREE.CanvasTexture {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#f2f3f4';
  g.fillRect(0, 0, 512, 512);
  let seed = 9;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 2; x++) {
      const k = 236 + Math.floor(rnd() * 14);
      g.fillStyle = `rgb(${k},${k + 1},${k + 2})`;
      g.fillRect(x * 256 + 2, y * 128 + 2, 252, 124);
    }
  }
  g.fillStyle = 'rgba(70,76,82,0.55)';
  for (let y = 0; y <= 4; y++) g.fillRect(0, y * 128 - 1, 512, 2);
  for (let x = 0; x <= 2; x++) g.fillRect(x * 256 - 1, 0, 2, 512);
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(90,92,96,${0.03 + rnd() * 0.05})`;
    g.fillRect(rnd() * 512, Math.floor(rnd() * 4) * 128 + 2, 1 + rnd() * 3, 20 + rnd() * 60);
  }
  return texture(c);
}

/** The hall's glass: vertical mullions every 2 m round it, two transoms. */
function mullions(): THREE.CanvasTexture {
  const [c, g] = canvas(1024, 256);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 1024, 256);
  g.fillStyle = '#5b646c';
  for (let x = 0; x < 64; x++) g.fillRect(x * 16, 0, 2, 256);
  g.fillRect(0, 84, 1024, 3);
  g.fillRect(0, 170, 1024, 3);
  const t = texture(c);
  t.repeat.set(4, 1);
  return t;
}

/**
 * A wing's facade, 4 m wide × its 10 m height: white panels, two storeys of window bands with
 * mullions and the rooms behind them (furniture as darker blocks); the glow map lights the rooms by
 * night, warm or cool, a few dark.
 */
function facadeMaps(): { map: THREE.CanvasTexture; glow: THREE.CanvasTexture } {
  const W = 512;
  const H = 1280; // 128 px a metre
  const [c, g] = canvas(W, H);
  const [gc, gg] = canvas(W, H);
  g.fillStyle = '#eef0f1';
  g.fillRect(0, 0, W, H);
  gg.fillStyle = '#000';
  gg.fillRect(0, 0, W, H);
  let seed = 21;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const [from, to] of [
    [1.0, 3.6],
    [5.6, 8.4],
  ] as const) {
    const y0 = H - to * 128;
    const y1 = H - from * 128;
    g.fillStyle = '#1d2a33';
    g.fillRect(0, y0, W, y1 - y0);
    for (let i = 0; i < 6; i++) {
      const w = 30 + rnd() * 90;
      const h = 30 + rnd() * 70;
      g.fillStyle = `rgba(${40 + rnd() * 40},${50 + rnd() * 40},${58 + rnd() * 40},0.8)`;
      g.fillRect(rnd() * W, y1 - h, w, h);
    }
    g.fillStyle = 'rgba(160,190,205,0.18)';
    g.fillRect(0, y0, W, 18);
    for (let x = 0; x < W; x += 128) {
      if (rnd() < 0.22) continue;
      const k = 0.6 + rnd() * 0.4;
      gg.fillStyle =
        rnd() < 0.6 ? `rgb(255,${200 * k},${140 * k})` : `rgb(${200 * k},${230 * k},255)`;
      gg.fillRect(x, y0, 128, y1 - y0);
    }
    g.fillStyle = '#5c666e';
    gg.fillStyle = '#000';
    for (let x = 0; x <= W; x += 128) {
      g.fillRect(x - 3, y0, 6, y1 - y0);
      gg.fillRect(x - 3, y0, 6, y1 - y0);
    }
    g.fillRect(0, y0 - 6, W, 8);
    g.fillRect(0, y1 - 2, W, 8);
  }
  g.fillStyle = 'rgba(80,86,92,0.45)';
  for (const y of [0.5, 4.6, 9.4]) g.fillRect(0, H - y * 128, W, 2);
  g.fillRect(W / 2, 0, 2, H);
  return { map: texture(c), glow: texture(gc) };
}

/** A wing's name: white letters over its colour, lit from within by night. */
function signMaterial(name: string, colour: string): THREE.MeshStandardMaterial {
  const [c, g] = canvas(1024, 168);
  g.fillStyle = '#10161b';
  g.fillRect(0, 0, 1024, 168);
  g.fillStyle = colour;
  g.fillRect(0, 140, 1024, 28);
  g.fillStyle = '#ffffff';
  g.font = 'bold 104px "Segoe UI", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(`SIMLAB · ${name}`, 512, 72);
  const map = texture(c);
  return new THREE.MeshStandardMaterial({
    map,
    emissiveMap: map,
    emissive: '#ffffff',
    emissiveIntensity: 0.1,
    roughness: 0.5,
  });
}
