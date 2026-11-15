/**
 * The 3D ball-and-stick picture of one biomolecule (data/biomolecules.json) with the biology kit:
 * one instanced draw per element (Jmol colours and scaled covalent radii, as the chemistry
 * library draws them) and one for the bonds (a double bond: two thin sticks). A tap on an atom
 * picks its part of the monomer (amino, carboxyl, phosphate…); the part's atoms glow. Atom
 * positions are the data's, in ångström; nothing is allocated per frame, the kit frees it all.
 */
import * as THREE from 'three';
import { NEUTRAL, type Bio3DScene, type SceneKit } from '../view3d/kit';
import { structureColor } from '../view3d/palette';
import { partOfAtom, type Biomolecule, type PartId } from './data';
import { atomColor, atomRadius, partCentre } from './look';

export interface MoleculeSceneOptions {
  molecule: Biomolecule;
  /** Part names to write ("Hiện tên"), or null: none. */
  names: Readonly<Partial<Record<PartId, string>>> | null;
}

const BOND_R = 0.075;

/** Sticks of a bond: one per bond order, side by side (an aromatic bond draws as its order). */
export function sticks(
  m: Biomolecule,
): { from: THREE.Vector3; to: THREE.Vector3; radius: number }[] {
  const out: { from: THREE.Vector3; to: THREE.Vector3; radius: number }[] = [];
  const up = new THREE.Vector3(0, 0, 1);
  for (const b of m.bonds) {
    const pa = m.atoms[b.a];
    const pb = m.atoms[b.b];
    if (!pa || !pb) continue;
    const a = new THREE.Vector3(...pa.xyz);
    const c = new THREE.Vector3(...pb.xyz);
    if (b.order === 1) {
      out.push({ from: a, to: c, radius: BOND_R });
      continue;
    }
    const dir = c.clone().sub(a).normalize();
    const side = new THREE.Vector3().crossVectors(dir, up);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize().multiplyScalar(0.09);
    for (let k = 0; k < b.order; k++) {
      const off = side.clone().multiplyScalar(k - (b.order - 1) / 2);
      out.push({ from: a.clone().add(off), to: c.clone().add(off), radius: BOND_R * 0.6 });
    }
  }
  return out;
}

export function buildMoleculeScene(kit: SceneKit, o: MoleculeSceneOptions): Bio3DScene {
  const m = o.molecule;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);

  // Atoms: one instanced draw per element; instance colours carry the highlight.
  const meshOf = new Map<THREE.Object3D, number[]>();
  const elements = [...new Set(m.atoms.map((a) => a.el))];
  const atomMeshes: { mesh: THREE.InstancedMesh; atoms: number[]; color: THREE.Color }[] = [];
  for (const el of elements) {
    const atoms = m.atoms.flatMap((a, i) => (a.el === el ? [i] : []));
    const mat = kit.solid(NEUTRAL, { sheen: 0.2 });
    const mesh = kit.instanced(kit.sphere(1), mat, atoms.length);
    const color = new THREE.Color(atomColor(el) ?? kit.color('--text-muted'));
    atoms.forEach((i, k) => {
      const at = m.atoms[i];
      if (!at) return;
      const r = atomRadius(el);
      mesh.setMatrixAt(k, m4.compose(p.set(...at.xyz), q.identity(), s.set(r, r, r)));
      mesh.setColorAt(k, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    meshOf.set(mesh, atoms);
    atomMeshes.push({ mesh, atoms, color });
  }

  // Bonds: unit cylinders (radius 1, height 1 along +y) stretched from atom to atom.
  const all = sticks(m);
  const bondMesh = kit.instanced(
    kit.cylinder(),
    kit.solid(structureColor((n) => kit.color(n), 'annotation')),
    all.length,
  );
  all.forEach((st, k) => {
    const d = st.to.clone().sub(st.from);
    q.setFromUnitVectors(yAxis, d.clone().normalize());
    p.copy(st.from).addScaledVector(d, 0.5);
    bondMesh.setMatrixAt(k, m4.compose(p, q, s.set(st.radius, d.length(), st.radius)));
  });
  bondMesh.instanceMatrix.needsUpdate = true;

  const named: PartId[] = [];
  if (o.names)
    for (const part of m.parts) {
      const text = o.names[part.id];
      if (!text) continue;
      kit.label(text, partCentre(m, part.id));
      named.push(part.id);
    }

  const highlight = new THREE.Color(kit.color('--m3d-highlight'));
  let selected: PartId | null = null;
  const select = (id: string | null) => {
    selected = m.parts.some((x) => x.id === id) ? (id as PartId) : null;
    const lit = new Set(m.parts.find((x) => x.id === selected)?.atoms ?? []);
    for (const { mesh, atoms, color } of atomMeshes) {
      atoms.forEach((i, k) => {
        mesh.setColorAt(k, lit.has(i) ? highlight : color);
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  };

  const radius = Math.max(...m.atoms.map((a) => Math.hypot(...a.xyz))) + 1;
  return {
    kit,
    bounds: { center: [0, 0, 0], radius },
    pick: (ray) => {
      const hit = ray.intersectObjects(
        atomMeshes.map((x) => x.mesh),
        false,
      )[0];
      if (hit?.instanceId === undefined) return null;
      const atom = meshOf.get(hit.object)?.[hit.instanceId];
      return atom === undefined ? null : partOfAtom(m, atom);
    },
    select,
    state: () => ({ molecule: m.id, atoms: m.atoms.length, sticks: all.length, named, selected }),
  };
}
