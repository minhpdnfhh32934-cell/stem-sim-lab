/**
 * An animal centrosome in the 3D division views: two centrioles at right angles (an L, in depth)
 * in a halo of pericentriolar material. High tier: each centriole is its ring of nine microtubule
 * triplets (one instanced mesh per centrosome); otherwise two hollow barrels. With a core
 * material (the HDR path), a small emissive core sits between the centrioles and glows. Sizes are
 * illustrative. The scene owns the geometries and materials passed in.
 */
import * as THREE from 'three';
import { centrioleTriplets } from './sceneParts';

export interface CentrosomeKit {
  /** High tier: centrioles as microtubule triplets. */
  detail: boolean;
  sphere: THREE.BufferGeometry;
  /** Open barrel (Medium/Low) and unit open tubule (High). */
  centrioleGeo: THREE.BufferGeometry;
  tubuleGeo: THREE.BufferGeometry;
  centriole: THREE.Material;
  pcm: THREE.Material;
  /** The glowing core (HDR path only: one more draw call per centrosome). */
  core?: THREE.Material;
  /** Called for every instanced mesh made here (the scene frees it). */
  keep: (d: { dispose: () => void }) => void;
}

export interface CentrosomeObjects {
  group: THREE.Group;
  /** Every mesh of the centrosome (the halo last). */
  parts: THREE.Mesh[];
  /** The glowing core, when the kit has one. */
  core: THREE.Mesh | null;
  halo: THREE.Mesh;
}

/** Radius of the core and of the halo of pericentriolar material (illustrative). */
export const CENTROSOME_SIZE = { core: 0.13, halo: 0.38 } as const;

/** The second centriole: at a right angle to the first, near its base. */
const SECOND = new THREE.Matrix4().compose(
  new THREE.Vector3(0, -0.12, 0.2),
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2),
  new THREE.Vector3(1, 1, 1),
);

/** Returns a maker of centrosomes sharing the kit (the triplet layout is computed once). */
export function centrosomeMaker(kit: CentrosomeKit): () => CentrosomeObjects {
  const triplets = (() => {
    const out: THREE.Matrix4[] = [];
    const tubules = centrioleTriplets(0.1);
    for (const at of [new THREE.Matrix4(), SECOND]) {
      for (const t of tubules) {
        out.push(
          at
            .clone()
            .multiply(
              new THREE.Matrix4().compose(
                new THREE.Vector3(t.x, 0, t.z),
                new THREE.Quaternion(),
                new THREE.Vector3(t.radius, 0.42, t.radius),
              ),
            ),
        );
      }
    }
    return out;
  })();
  return () => {
    const group = new THREE.Group();
    const parts: THREE.Mesh[] = [];
    if (kit.detail) {
      const im = new THREE.InstancedMesh(kit.tubuleGeo, kit.centriole, triplets.length);
      triplets.forEach((m, i) => {
        im.setMatrixAt(i, m);
      });
      kit.keep({
        dispose: () => {
          im.dispose();
        },
      });
      parts.push(im);
    } else {
      const a = new THREE.Mesh(kit.centrioleGeo, kit.centriole);
      const b = new THREE.Mesh(kit.centrioleGeo, kit.centriole);
      b.applyMatrix4(SECOND);
      parts.push(a, b);
    }
    let core: THREE.Mesh | null = null;
    if (kit.core) {
      core = new THREE.Mesh(kit.sphere, kit.core);
      core.position.set(0, -0.06, 0.1);
      core.scale.setScalar(CENTROSOME_SIZE.core);
      parts.push(core);
    }
    const halo = new THREE.Mesh(kit.sphere, kit.pcm);
    halo.scale.setScalar(CENTROSOME_SIZE.halo);
    parts.push(halo);
    for (const m of parts) group.add(m);
    return { group, parts, core, halo };
  };
}
