import * as THREE from 'three';

/*
 * What Linh and Khoa hold (Phase W-4): Linh's karambit — a claw blade, a black handle ending in a
 * ring the finger goes through (it spins round that ring) — and Khoa's black card, metal, with a
 * gold chip and its own mark (no real bank's), plus the hologram it throws by night. Made at real
 * size (m); each a group whose origin is where the hand holds it.
 */

export interface Prop {
  readonly group: THREE.Group;
  /** The part that spins or flips in the fingers. */
  readonly turn: THREE.Object3D;
  /** 0 day … 1 night: the blade's edge, the card's hologram. */
  setNight(night: number, time: number): void;
  dispose(): void;
}

export function karambit(): Prop {
  const group = new THREE.Group();
  const turn = new THREE.Group();
  group.add(turn);
  const steel = new THREE.MeshStandardMaterial({ color: '#c9ced3', metalness: 1, roughness: 0.16 });
  const edge = new THREE.MeshStandardMaterial({
    color: '#e8edf2',
    metalness: 1,
    roughness: 0.1,
    emissive: '#ff38d8',
    emissiveIntensity: 0,
  });
  const grip = new THREE.MeshStandardMaterial({ color: '#16171b', roughness: 0.62 });
  // The ring round the origin (its axis z), the handle below it, the blade curving out past it.
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0042, 10, 28), steel);
  const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.007, 0.07, 6, 10), grip);
  handle.position.set(0, -0.052, 0);
  const shape = new THREE.Shape();
  shape.moveTo(-0.006, -0.09);
  shape.bezierCurveTo(0.03, -0.1, 0.07, -0.12, 0.064, -0.168);
  shape.bezierCurveTo(0.05, -0.14, 0.025, -0.115, 0.006, -0.112);
  shape.lineTo(-0.006, -0.09);
  const bladeGeometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0018,
    bevelEnabled: true,
    bevelThickness: 0.0008,
    bevelSize: 0.0007,
    bevelSegments: 2,
    curveSegments: 18,
  });
  bladeGeometry.translate(0, 0, -0.0009);
  const blade = new THREE.Mesh(bladeGeometry, [steel, edge]);
  turn.add(ring, handle, blade);
  for (const m of [ring, handle, blade]) m.castShadow = true;
  return {
    group,
    turn,
    setNight: (night) => {
      edge.emissiveIntensity = 3 * night;
    },
    dispose: () => {
      for (const m of [ring, handle, blade]) m.geometry.dispose();
      for (const m of [steel, edge, grip]) m.dispose();
    },
  };
}

export function blackCard(): Prop {
  const group = new THREE.Group();
  const turn = new THREE.Group();
  group.add(turn);
  const face = cardFace();
  const metal = new THREE.MeshStandardMaterial({
    color: '#141519',
    metalness: 0.75,
    roughness: 0.28,
  });
  const front = new THREE.MeshStandardMaterial({ map: face, metalness: 0.7, roughness: 0.3 });
  // 85.6 × 54 mm, 0.8 mm thick; its face towards +x (the palm's side), held by its end.
  const card = new THREE.Mesh(new THREE.BoxGeometry(0.0008, 0.0856, 0.054), [
    front,
    metal,
    metal,
    metal,
    metal,
    metal,
  ]);
  card.position.y = -0.03;
  card.castShadow = true;
  turn.add(card);
  // The hologram by night: a pane of light over the card, flickering.
  const holoMap = hologram();
  const holoMaterial = new THREE.MeshBasicMaterial({
    map: holoMap,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const holo = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.1), holoMaterial);
  holo.position.set(0.06, -0.04, 0);
  holo.rotation.y = Math.PI / 2;
  holo.visible = false;
  group.add(holo);
  return {
    group,
    turn,
    setNight: (night, time) => {
      holo.visible = night > 0.02;
      holoMaterial.opacity = night * (0.75 + 0.15 * Math.sin(time * 31) + 0.1 * Math.sin(time * 7));
    },
    dispose: () => {
      card.geometry.dispose();
      holo.geometry.dispose();
      for (const m of [metal, front, holoMaterial]) m.dispose();
      face.dispose();
      holoMap.dispose();
    },
  };
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) throw new Error('no 2D canvas for the props');
  return [c, g];
}

/** The card's face: brushed black, a gold chip, the contactless mark, "SIMLAB BLACK". */
function cardFace(): THREE.CanvasTexture {
  // The face's u runs along the card's 54 mm (z), v along its 85.6 mm (y): a portrait card.
  const [c, g] = canvas(256, 406);
  g.fillStyle = '#121317';
  g.fillRect(0, 0, 256, 406);
  for (let y = 0; y < 406; y += 2) {
    g.fillStyle = `rgba(255,255,255,${0.012 + 0.012 * Math.sin(y * 0.7)})`;
    g.fillRect(0, y, 256, 1);
  }
  g.fillStyle = '#c9a24e';
  g.fillRect(150, 70, 56, 44);
  g.strokeStyle = '#8a6a2a';
  g.lineWidth = 2;
  g.strokeRect(150, 70, 56, 44);
  g.beginPath();
  g.moveTo(178, 70);
  g.lineTo(178, 114);
  g.moveTo(150, 92);
  g.lineTo(206, 92);
  g.stroke();
  g.strokeStyle = '#7d8086';
  g.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.arc(70, 92, 10 + i * 9, -0.7, 0.7);
    g.stroke();
  }
  g.save();
  g.translate(128, 300);
  g.rotate(-Math.PI / 2);
  g.fillStyle = '#9a9ea6';
  g.font = 'bold 30px "Segoe UI", Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText('SIMLAB', 0, -10);
  g.font = '20px "Segoe UI", Arial, sans-serif';
  g.fillText('B L A C K', 0, 22);
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** The hologram: a frame, the mark, a balance that never ends, bars. */
function hologram(): THREE.CanvasTexture {
  const [c, g] = canvas(512, 320);
  g.fillStyle = '#000';
  g.fillRect(0, 0, 512, 320);
  g.strokeStyle = '#4ff3ff';
  g.lineWidth = 4;
  g.strokeRect(10, 10, 492, 300);
  g.fillStyle = '#4ff3ff';
  g.font = 'bold 44px "Segoe UI", Arial, sans-serif';
  g.fillText('SIMLAB · BLACK', 34, 70);
  g.font = 'bold 72px "Segoe UI", Arial, sans-serif';
  g.fillStyle = '#ff5ce1';
  g.fillText('∞ ₫', 34, 170);
  g.fillStyle = '#4ff3ff';
  for (let i = 0; i < 12; i++)
    g.fillRect(34 + i * 38, 290 - (20 + ((i * 37) % 70)), 24, 20 + ((i * 37) % 70));
  for (let y = 0; y < 320; y += 4) {
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, y, 512, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
