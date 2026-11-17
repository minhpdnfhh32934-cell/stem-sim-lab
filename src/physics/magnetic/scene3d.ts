/**
 * The 3D scene of "Lực từ" (three.js, on the biology scene kit): field lines of a uniform B⃗ along
 * +x, the wire through the middle at α to them with the current's arrow, the force arrow along
 * F⃗ = I·L⃗ × B⃗ (`magnetic3d`), and the angle α as an arc in the page. Colours are the 2D picture's.
 */
import * as THREE from 'three';
import type { Bio3DScene, SceneKit } from '@/biology/view3d/kit';
import { addArrow, addLine, addUniformField, type Vec3 } from '../view3d/arrow';
import type { Magnetic3D } from './magnetic3d';

/** Half the side of the field's box (world units). */
export const HALF = 2.2;
/**
 * Seen from the right, above and in front: F⃗ (perpendicular to the page) is not hidden behind the
 * wire, as it would be seen straight on.
 */
export const MAGNETIC_VIEW: Vec3 = [1.1, 0.8, 1];
/** The force arrow's length: FORCE_MIN + FORCE_SPAN · F/(BIL). */
export const FORCE_MIN = 0.35;
export const FORCE_SPAN = 2.1;

export interface MagneticTexts {
  B: string;
  I: string;
  F: string;
  alpha: string;
}

const at = (v: Vec3, s: number, add: Vec3 = [0, 0, 0]): Vec3 => [
  v[0] * s + add[0],
  v[1] * s + add[1],
  v[2] * s + add[2],
];

export interface MagneticScene extends Bio3DScene {
  state(): { forceLength: number } & Magnetic3D;
}

export function buildMagneticScene(
  kit: SceneKit,
  o: { model: Magnetic3D; alpha: number; texts: MagneticTexts },
): MagneticScene {
  const { model } = o;
  const fieldColor = kit.color('--chart-2');
  const wireColor = kit.color('--chart-4');
  const forceColor = kit.color('--accent');
  addUniformField(kit, {
    half: HALF,
    rows: 3,
    color: fieldColor,
    radius: 0.022,
    name: 'mag-field',
  });
  // At the tip of the top back field line (a front corner would sit in the middle of the picture).
  kit.label(o.texts.B, [HALF + 0.3, HALF * 0.8, -HALF * 0.8], 'strong');

  // The page (x–y plane), faint: the wire and α lie in it, F⃗ crosses it.
  const page = kit.mesh(
    kit.shared('page', () => new THREE.PlaneGeometry(2 * HALF, 2 * HALF)),
    kit.glass(kit.color('--text-muted'), { opacity: 0.1, side: THREE.DoubleSide }),
  );
  page.name = 'mag-page';

  // The wire (a rod through the middle) and the current's arrow on it.
  const wireDir: Vec3 =
    model.current[0] === 0 && model.current[1] === 0 ? [1, 0, 0] : model.current;
  addArrow(kit, {
    from: at(wireDir, -HALF * 0.95),
    dir: wireDir,
    length: HALF * 1.9,
    radius: 0.07,
    color: wireColor,
    name: 'mag-wire',
  });
  kit.label(o.texts.I, at(wireDir, HALF * 1.05, [0, 0.3, 0]), 'strong');

  // α: from B⃗ (+x) to the wire's own direction, in the page.
  const a = (o.alpha * Math.PI) / 180;
  const arc: Vec3[] = [];
  for (let i = 0; i <= 32; i++) {
    const t = (a * i) / 32;
    arc.push([0.9 * Math.cos(t), 0.9 * Math.sin(t), 0]);
  }
  addLine(kit, arc, kit.color('--text-muted'), 'mag-angle');
  kit.label(o.texts.alpha, [1.25 * Math.cos(a / 2), 1.25 * Math.sin(a / 2), 0], 'muted');

  const forceLength = model.force ? FORCE_MIN + FORCE_SPAN * model.share : 0;
  if (model.force) {
    addArrow(kit, {
      from: [0, 0, 0],
      dir: model.force,
      length: forceLength,
      radius: 0.085,
      color: forceColor,
      name: 'mag-force',
    });
    kit.label(o.texts.F, at(model.force, forceLength + 0.3), 'strong');
  }

  return {
    kit,
    bounds: {
      center: [0, 0, 0],
      radius: 3.4,
      // The field's box: a tighter fit than its sphere.
      points: [-1, 1].flatMap((x) =>
        [-1, 1].flatMap((y) => [-1, 1].map((z): Vec3 => [x * HALF, y * HALF, z * HALF])),
      ),
    },
    state: () => ({ ...model, forceLength }),
  };
}
