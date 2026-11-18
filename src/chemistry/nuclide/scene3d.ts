/**
 * The 3D scene of "Thành phần của nguyên tử" (three.js, on the biology scene kit): the atom of
 * `atom3d` — protons --chart-4, neutrons --chart-3, electrons --chart-1 (the 2D picture's
 * colours). Static, drawn on change; not to scale.
 */
import * as THREE from 'three';
import type { Bio3DScene, SceneKit } from '@/biology/view3d/kit';
import type { Atom3D, Vec3 } from './atom3d';

export interface AtomScene extends Bio3DScene {
  state(): { protons: number; neutrons: number; electrons: number };
}

export function buildAtomScene(kit: SceneKit, o: { atom: Atom3D }): AtomScene {
  const { atom } = o;
  const m4 = new THREE.Matrix4();
  const one = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const counts = { protons: 0, neutrons: 0, electrons: atom.electrons.length };
  const place = (pts: Vec3[], color: string, size: number, name: string) => {
    if (!pts.length) return 0;
    const mesh = kit.instanced(
      kit.sphere(),
      kit.solid(kit.color(color), { roughness: 0.35 }),
      pts.length,
    );
    mesh.name = name;
    const s = new THREE.Vector3().setScalar(size);
    pts.forEach((p, i) => mesh.setMatrixAt(i, m4.compose(v.set(...p), one, s)));
    mesh.instanceMatrix.needsUpdate = true;
    return pts.length;
  };
  counts.protons = place(
    atom.nucleons.filter((_, i) => atom.proton[i]),
    '--chart-4',
    0.5,
    'atom-protons',
  );
  counts.neutrons = place(
    atom.nucleons.filter((_, i) => !atom.proton[i]),
    '--chart-3',
    0.5,
    'atom-neutrons',
  );
  place(atom.electrons, '--chart-1', 0.3, 'atom-electrons');
  return {
    kit,
    bounds: { center: [0, 0, 0], radius: atom.reach + 0.5 },
    state: () => ({ ...counts }),
  };
}
