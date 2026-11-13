import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// What the city kit has none of (Phase V-3): street lights and cars, modelled here — plain shapes,
// seen from 120 m up. Each in the frame its copies are placed by: a lamp's pole at the origin, its
// arm reaching +x; a car centred on the origin, its front +x, on the road (y 0).

/** A lamp's head height (m), and its arm's reach over the road. */
export const LAMP_H = 7.5;
const LAMP_REACH = 1.8;

/** A street light's pole and arm (dark metal), merged. */
export function lampPost(): THREE.BufferGeometry {
  return merged([
    new THREE.CylinderGeometry(0.07, 0.11, LAMP_H, 8).translate(0, LAMP_H / 2, 0),
    new THREE.BoxGeometry(LAMP_REACH, 0.08, 0.08).translate(LAMP_REACH / 2, LAMP_H - 0.05, 0),
  ]);
}

/** Its head: the lit underside of a slim box at the arm's end. */
export function lampHead(): THREE.BufferGeometry {
  return new THREE.BoxGeometry(0.7, 0.14, 0.3).translate(LAMP_REACH - 0.25, LAMP_H - 0.12, 0);
}

/** The pool of light a lamp throws on the road: a flat disc under its head, its glow a texture. */
export function lampPool(): THREE.BufferGeometry {
  return new THREE.CircleGeometry(5, 24).rotateX(-Math.PI / 2).translate(LAMP_REACH, 0.05, 0);
}

/** A soft round glow (white at the centre, clear at the edge), drawn once. */
export function glowTexture(): THREE.Texture | null {
  if (typeof document === 'undefined') return null; // tests without a page
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d');
  if (!c) return null;
  const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A car's body and cabin (painted per copy), 4.4 m long. */
export function carBody(): THREE.BufferGeometry {
  return merged([
    new THREE.BoxGeometry(4.4, 0.75, 1.8).translate(0, 0.55, 0),
    new THREE.BoxGeometry(2.3, 0.6, 1.6).translate(-0.25, 1.2, 0),
  ]);
}

/** Its lamps: white headlights at the front, red tail lights at the back, coloured per vertex. */
export function carLights(): THREE.BufferGeometry {
  const lamp = (x: number, z: number, color: THREE.Color) => {
    const g = new THREE.BoxGeometry(0.08, 0.16, 0.36).translate(x, 0.7, z);
    const colors = new Float32Array(g.getAttribute('position').count * 3);
    for (let i = 0; i < colors.length; i += 3) colors.set([color.r, color.g, color.b], i);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  };
  const white = new THREE.Color('#fff6e0');
  const red = new THREE.Color('#ff2a1a');
  return merged([
    lamp(2.21, 0.6, white),
    lamp(2.21, -0.6, white),
    lamp(-2.21, 0.6, red),
    lamp(-2.21, -0.6, red),
  ]);
}

function merged(pieces: THREE.BufferGeometry[]): THREE.BufferGeometry {
  for (const piece of pieces) piece.deleteAttribute('uv');
  const out = mergeGeometries(pieces);
  for (const piece of pieces) piece.dispose();
  return out;
}
