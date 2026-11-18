/**
 * The 3D scene of "Cảm ứng điện từ" (three.js, on the biology scene kit): two magnet poles, the
 * uniform field between them, a square coil on a vertical axle with its normal n⃗
 * (`induction3d`), and in the flux tab the coil before the change as a see-through ghost.
 * Colours are the 2D picture's (field --chart-2, coil --chart-4, n⃗ --accent).
 */
import * as THREE from 'three';
import type { Bio3DScene, SceneKit } from '@/biology/view3d/kit';
import { addArrow, addUniformField, type Vec3 } from '../view3d/arrow';
import type { Coil3D, Induction3D } from './induction3d';

export const HALF = 2.2;
/** Half the coil's side and the normal's length (world units, illustration). */
export const COIL = 1.05;
export const NORMAL = 1.5;

export interface InductionTexts {
  B: string;
  north: string;
  south: string;
  /** Normal and flux texts of the coil now and, in the flux tab, before. */
  now: { n: string; phi: string };
  before?: { n: string; phi: string };
}

/** The four sides of a square loop in the y–z plane (local normal +x). */
function addCoil(kit: SceneKit, coil: Coil3D, material: THREE.Material, name: string) {
  const g = new THREE.Group();
  g.name = name;
  const r = 0.06;
  const side = (pos: Vec3, alongZ: boolean) => {
    const m = kit.mesh(kit.cylinder(), material, g);
    m.scale.set(r, 2 * COIL + 2 * r, r);
    m.position.set(...pos);
    if (alongZ) m.rotation.x = Math.PI / 2;
  };
  side([0, COIL, 0], true);
  side([0, -COIL, 0], true);
  side([0, 0, COIL], false);
  side([0, 0, -COIL], false);
  g.rotation.y = (coil.angle * Math.PI) / 180;
  kit.scene.add(g);
  return g;
}

export interface InductionScene extends Bio3DScene {
  state(): Induction3D & { coilNormal: Vec3 };
}

export function buildInductionScene(
  kit: SceneKit,
  o: { model: Induction3D; texts: InductionTexts },
): InductionScene {
  const { model, texts } = o;
  const field = kit.color('--chart-2');
  const field3d = addUniformField(kit, {
    half: HALF,
    rows: 3,
    color: field,
    radius: 0.02,
    name: 'ind-field',
  });
  if (model.fieldSign < 0) field3d.rotation.y = Math.PI;
  kit.label(texts.B, [model.fieldSign * (HALF + 0.25), HALF * 0.8, HALF * 0.8], 'strong');

  // The poles: B⃗ leaves the north pole and enters the south pole.
  const pole = kit.solid(kit.color('--bio3d-rock'), { roughness: 0.6 });
  for (const sign of [-1, 1] as const) {
    const m = kit.mesh(kit.roundedBox(), pole);
    m.scale.set(0.28, HALF, HALF);
    m.position.set(sign * (HALF + 0.35), 0, 0);
    const isNorth = sign === -model.fieldSign;
    kit.label(
      isNorth ? texts.north : texts.south,
      [sign * (HALF + 0.35), HALF + 0.35, 0],
      'strong',
    );
  }

  // The axle the coil turns about.
  const axle = kit.mesh(kit.cylinder(), kit.solid(kit.color('--text-muted')));
  axle.scale.set(0.03, 2 * COIL + 1.2, 0.03);

  const accent = kit.color('--accent');
  const coilColor = kit.color('--chart-4');
  const drawCoil = (coil: Coil3D, ghost: boolean, t: { n: string; phi: string }) => {
    const mat = ghost
      ? kit.glass(coilColor, { opacity: 0.35 })
      : kit.solid(coilColor, { metalness: 0.3, roughness: 0.35 });
    const g = addCoil(kit, coil, mat, ghost ? 'ind-coil-before' : 'ind-coil');
    addArrow(
      kit,
      {
        from: [0, 0, 0],
        dir: [1, 0, 0],
        length: NORMAL,
        radius: ghost ? 0.03 : 0.045,
        color: ghost ? kit.color('--text-muted') : accent,
        name: ghost ? 'ind-normal-before' : 'ind-normal',
      },
      g,
    );
    const tip: Vec3 = [coil.normal[0] * (NORMAL + 0.3), 0.15, coil.normal[2] * (NORMAL + 0.3)];
    kit.label(t.n, tip, ghost ? 'muted' : 'strong');
    // The flux at a corner of the coil: above it now, below it for the ghost (never overlapping).
    const corner: Vec3 = [
      -coil.normal[2] * COIL,
      ghost ? -COIL - 0.4 : COIL + 0.35,
      coil.normal[0] * COIL,
    ];
    kit.label(t.phi, corner, ghost ? 'muted' : 'plain');
  };
  if (model.before && texts.before) drawCoil(model.before, true, texts.before);
  drawCoil(model.now, false, texts.now);

  return {
    kit,
    bounds: { center: [0, 0, 0], radius: 3.5 },
    state: () => {
      // The drawn normal, read back from the coil's rotation (not from the model).
      const coil = kit.scene.getObjectByName('ind-coil');
      const v = new THREE.Vector3(1, 0, 0);
      if (coil) v.applyQuaternion(coil.quaternion);
      return { ...model, coilNormal: [v.x, v.y, v.z] };
    },
  };
}
