import * as THREE from 'three';
import { mergePieces } from './props/parts';

/**
 * An apparatus frame's fixed parts (BenchFrame.parts, a launcher's, a stand's, a tower's: never
 * moved, shown or hidden on their own) merged by material and shadow settings: one draw each
 * instead of one a part (Phú 2026-11-15, "gộp, mọi mức": ~770 draws a frame in the Physics Lab,
 * the forces board's 36 ticks among them; a draw is the cost at every preset, more under WebGPU).
 *
 * Merged only: plain meshes (not skinned, instanced, a line, a sprite), unnamed (a named part is
 * found by name: a reading, a part the teacher points at), with no children, shown, one material
 * and no clipping, under groups as plain (a named group's parts stay in it). Each piece keeps its
 * kind and turn (props/parts.ts MergedPiece), so Ultra's detail still bevels and rounds it.
 * Returns what it made, for the frame's owner to free with the frame.
 */
export function mergeStill(root: THREE.Object3D): THREE.BufferGeometry[] {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const sets = new Map<string, THREE.Mesh[]>();
  const visit = (parent: THREE.Object3D) => {
    for (const child of parent.children) {
      if (stillMesh(child)) {
        const key = keyOf(child);
        const set = sets.get(key);
        if (set) set.push(child);
        else sets.set(key, [child]);
      } else if (plainGroup(child)) visit(child);
    }
  };
  visit(root);
  const made: THREE.BufferGeometry[] = [];
  for (const meshes of sets.values()) {
    const [first] = meshes;
    if (!first || meshes.length < 2) continue;
    const turns: THREE.Matrix4[] = [];
    const pieces = meshes.map((mesh) => {
      const place = new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld);
      turns.push(place.clone().setPosition(0, 0, 0));
      const piece = mesh.geometry.clone().applyMatrix4(place);
      piece.clearGroups(); // a box's per-face groups: one material draws them all the same
      return piece;
    });
    const geometry = mergePieces(pieces, turns);
    for (const piece of pieces) piece.dispose();
    if (!geometry) continue;
    const merged = new THREE.Mesh(geometry, first.material);
    merged.castShadow = first.castShadow;
    merged.receiveShadow = first.receiveShadow;
    merged.renderOrder = first.renderOrder;
    merged.frustumCulled = first.frustumCulled;
    merged.layers.mask = first.layers.mask;
    for (const mesh of meshes) mesh.removeFromParent();
    root.add(merged);
    made.push(geometry);
  }
  return made;
}

const plainGroup = (object: THREE.Object3D): boolean =>
  (object.type === 'Group' || object.type === 'Object3D') && plain(object);

function stillMesh(object: THREE.Object3D): object is THREE.Mesh {
  if (object.type !== 'Mesh' || object.children.length > 0 || !plain(object)) return false;
  const { geometry, material } = object as THREE.Mesh;
  if (Array.isArray(material) || material.clippingPlanes) return false;
  if ((material as Partial<THREE.ShaderMaterial>).isShaderMaterial) return false;
  // A picture laid by its texture coordinates (a printed face): Ultra would bevel a box of it and
  // move the picture; alone, it is left square (detail.ts boxMaterialAllows).
  if ((material as Partial<THREE.MeshStandardMaterial>).map) return false;
  return (
    'position' in geometry.attributes &&
    Object.keys(geometry.morphAttributes).length === 0 &&
    geometry.drawRange.start === 0 &&
    geometry.drawRange.count === Infinity
  );
}

/** Unnamed, shown, nothing of its own (data, a draw hook): nothing else can tell it apart. */
const plain = (object: THREE.Object3D): boolean =>
  object.name === '' &&
  object.visible &&
  Object.keys(object.userData).length === 0 &&
  !Object.hasOwn(object, 'onBeforeRender') &&
  !Object.hasOwn(object, 'onAfterRender');

/** What must be alike to draw as one: the material, the shadows and order, the attributes. */
function keyOf(mesh: THREE.Mesh): string {
  const attributes = Object.entries(mesh.geometry.attributes)
    .map(([name, a]) => {
      const array = (a as THREE.BufferAttribute).array as { constructor: { name: string } };
      return `${name}:${a.itemSize}:${a.normalized}:${array.constructor.name}`;
    })
    .sort()
    .join(',');
  return [
    mesh.material instanceof THREE.Material ? mesh.material.uuid : '',
    mesh.castShadow,
    mesh.receiveShadow,
    mesh.renderOrder,
    mesh.frustumCulled,
    mesh.layers.mask,
    attributes,
  ].join('|');
}
