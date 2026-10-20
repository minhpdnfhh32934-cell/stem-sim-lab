/**
 * Geometries of the palette's shape cues (`palette.ts`): a class's colour is never the only way
 * to tell it apart, its shape differs too. Each geometry is centred, about as big as the unit
 * sphere (so one scale fits every class) and upright (y up; the ring and the star face +z). Made
 * through the scene's kit, so they are freed with it; one geometry per shape per kit.
 */
import * as THREE from 'three';
import { roundedBox } from '@/ui/three/materials';
import type { SceneKit } from '../kit';
import type { Shape } from '../palette';

const made = new WeakMap<SceneKit, Map<Shape, THREE.BufferGeometry>>();

function starGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  for (let k = 0; k < 10; k++) {
    const r = k % 2 === 0 ? 1 : 0.46;
    const a = Math.PI / 2 + (k * Math.PI) / 5;
    if (k === 0) s.moveTo(r * Math.cos(a), r * Math.sin(a));
    else s.lineTo(r * Math.cos(a), r * Math.sin(a));
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.5,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.06,
    bevelSegments: 1,
  });
  g.center();
  return g;
}

function build(kit: SceneKit, shape: Shape): THREE.BufferGeometry {
  const seg = kit.seg;
  switch (shape) {
    case 'sphere':
      return kit.sphere();
    case 'cube':
      return kit.geometry(roundedBox(seg, 6).scale(0.74, 0.74, 0.74));
    case 'cone':
      return kit.geometry(new THREE.ConeGeometry(0.88, 1.76, Math.max(8, seg)));
    case 'diamond':
      return kit.geometry(new THREE.OctahedronGeometry(1, 0).scale(0.85, 1.05, 0.85));
    case 'ring':
      return kit.geometry(
        new THREE.TorusGeometry(0.66, 0.3, Math.max(6, Math.round(seg / 2)), Math.max(12, seg)),
      );
    case 'capsule':
      return kit.capsule(0.52, 2);
    case 'bar':
      return kit.geometry(roundedBox(seg, 8).scale(0.4, 1, 0.4));
    case 'slab':
      return kit.geometry(roundedBox(seg, 8).scale(0.95, 0.4, 0.95));
    case 'star':
      return kit.geometry(starGeometry());
  }
}

/** The geometry of a shape cue for this kit (made once, freed with the kit). */
export function shapeGeometry(kit: SceneKit, shape: Shape): THREE.BufferGeometry {
  let byShape = made.get(kit);
  if (!byShape) {
    byShape = new Map();
    made.set(kit, byShape);
  }
  const hit = byShape.get(shape);
  if (hit) return hit;
  const g = build(kit, shape);
  byShape.set(shape, g);
  return g;
}

/** Half the height of a shape's geometry (how far above the floor its centre stands). */
export function shapeHalfHeight(shape: Shape): number {
  switch (shape) {
    case 'cube':
      return 0.74;
    case 'cone':
      return 0.88;
    case 'diamond':
      return 1.05;
    case 'ring':
      return 0.96;
    case 'bar':
      return 1;
    case 'slab':
      return 0.4;
    case 'star':
      return 1;
    default:
      return 1;
  }
}
