import * as THREE from 'three';
import type { WornOn } from '../../../gameplay/item';
import { SELF_LAYER } from './BodyModel';

/**
 * What a real person (Ultra, realBody.ts) wears from the cleanroom's kit, made for that person's
 * own body: the lab coat, the goggles, the face shield, the gloves. The drawn body's own kit is
 * hidden with it.
 *
 * - The coat: its body and sleeves a shell of the person's own clothes, 1.5 cm out along their
 *   surface (the same skin weights: it moves as they do), open down the front as a lab coat is
 *   worn; its skirt eight panels from the hips to the knees, hung from eight bones round the hips
 *   that follow the drawn body's skirt bones — the drawn coat's cloth swings them (cloth.ts).
 * - The goggles and the shield: on the head bone, placed by the person's own eyes.
 * - The gloves: the hands' skin turned the gloves' colour, a little glossier (the hand and finger
 *   bones' share of each vertex, `aHand`).
 * Presentation only: what is worn is the equipment system's (wear()).
 */

/** The skirt's bones, as the drawn ones (BodyModel SKIRT_BONES): 0 behind, round by the right. */
export const SKIRT_COUNT = 8;
export const realSkirtBone = (k: number) => `RealSkirt${k}`;

/** The coat's shell out from the clothes (m). */
const COAT_OUT = 0.015;
/** Bones the coat's body and sleeves cover (not the hands, the neck, the legs). */
const COAT_BONES = /Pelvis|Spine|Clavicle|UpperArm|Forearm/;
/** Bones of the hips (their width sets the skirt's). */
const HIP_BONES = /Pelvis|Spine$|Thigh/;
/** Bones whose share of a vertex makes it a hand's (the glove). */
const HAND_BONES = /Hand|Finger/;
/** The skirt: rows down from the hips, columns round them; its front left open (rad either side). */
const SKIRT_ROWS = 6;
const SKIRT_COLUMNS = 40;
const SKIRT_OPEN = 0.22;

export interface RealWear {
  /** The skirt's bones, children of the pelvis: the body's walk drives them (realSkirtBone). */
  readonly skirtBones: readonly THREE.Bone[];
  /** Shown by what is worn, in its colours (absent: not worn). */
  wear(worn: Partial<Record<WornOn, string>>): void;
  dispose(): void;
}

interface DressInput {
  /** The person's frame (the actor's, at rest: nothing above it moved). */
  readonly group: THREE.Object3D;
  /** The meshes in the person's clothes' material (`body`). */
  readonly clothes: readonly THREE.SkinnedMesh[];
  /** Every body material of the person (the gloves' colour is put in them). */
  readonly bodyMaterials: readonly THREE.MeshStandardMaterial[];
  readonly skeleton: THREE.Skeleton;
  readonly bone: (name: string) => THREE.Bone | undefined;
  /** The coat's weave (motion.ts fabric), or none. */
  readonly fabric: THREE.Texture | null;
  /** The player's own body: what is on the head kept from their own eye (SELF_LAYER: mirrors). */
  readonly self: boolean;
}

/**
 * Dresses a real person (at rest, before anything moved it): the coat, the goggles, the shield and
 * the gloves made, all hidden until worn.
 */
export function dressReal(input: DressInput): RealWear {
  const { group, clothes, skeleton, bone } = input;
  group.updateMatrixWorld(true);
  // The person faces −z in its frame (realBody.ts turns the library's +z round): the kit too.
  const front = -1;
  const made: { geometries: THREE.BufferGeometry[]; materials: THREE.Material[] } = {
    geometries: [],
    materials: [],
  };
  const pelvis = bone('Bip01_Pelvis');
  const head = bone('Bip01_Head');
  const eyeL = bone('Bip01_LEye');
  const eyeR = bone('Bip01_REye');
  const calf = bone('Bip01_L_Calf');
  const coatMaterial = new THREE.MeshStandardMaterial({
    name: 'real-coat',
    color: '#f4f5f6',
    roughness: 0.88,
    side: THREE.DoubleSide,
    ...(input.fabric ? { bumpMap: weave(input.fabric), bumpScale: 0.6 } : {}),
  });
  made.materials.push(coatMaterial);

  // The gloves: each body material's skin coloured by `aHand` (shared programs, own colours).
  for (const mesh of clothes) handShare(mesh.geometry, skeleton);
  const gloves = input.bodyMaterials.map(gloveOn);

  // The coat's skirt bones round the hips, at rest turned as the actor's frame (identity).
  const skirtBones: THREE.Bone[] = [];
  const coat: THREE.SkinnedMesh[] = [];
  const first = clothes[0];
  if (pelvis && calf && first) {
    const hips = hipsOf(clothes, pelvis);
    const pelvisTurn = pelvis.getWorldQuaternion(new THREE.Quaternion()).invert();
    for (let k = 0; k < SKIRT_COUNT; k++) {
      const a = (2 * Math.PI * k) / SKIRT_COUNT;
      const b = new THREE.Bone();
      b.name = realSkirtBone(k);
      const at = new THREE.Vector3(
        hips.center.x + hips.rx * Math.sin(a),
        hips.top,
        hips.center.z + hips.rz * Math.cos(a),
      );
      pelvis.add(b);
      b.position.copy(pelvis.worldToLocal(at.clone()));
      b.quaternion.copy(pelvisTurn); // its world turn the frame's
      b.updateMatrixWorld(true);
      skirtBones.push(b);
    }
    // The coat's own skeleton: the body's bones, then the skirt's (their inverses as the body's).
    const pelvisIndex = skeleton.bones.indexOf(pelvis);
    const bindOf = new THREE.Matrix4()
      .copy(pelvis.matrixWorld)
      .multiply(skeleton.boneInverses[pelvisIndex] ?? new THREE.Matrix4());
    const inverses = [
      ...skeleton.boneInverses.map((m) => m.clone()),
      ...skirtBones.map((b) => b.matrixWorld.clone().invert().multiply(bindOf)),
    ];
    const coatSkeleton = new THREE.Skeleton([...skeleton.bones, ...skirtBones], inverses);
    const knee = calf.getWorldPosition(new THREE.Vector3()).y;
    const shell = coatShell(clothes, skeleton, pelvis);
    const skirt = coatSkirt(
      first,
      pelvis,
      hips,
      knee - 0.04,
      front,
      skeleton.bones.length,
      pelvisIndex,
    );
    for (const geometry of [shell, skirt]) {
      if (!geometry) continue;
      made.geometries.push(geometry);
      const mesh = new THREE.SkinnedMesh(geometry, coatMaterial);
      mesh.name = 'real-coat';
      mesh.position.copy(first.position);
      mesh.quaternion.copy(first.quaternion);
      mesh.scale.copy(first.scale);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.visible = false;
      first.parent?.add(mesh);
      mesh.bind(coatSkeleton, first.bindMatrix);
      coat.push(mesh);
    }
  }

  // The goggles and the shield, by the eyes (the frame faces −z).
  const kit: Record<'eyes' | 'face', THREE.Object3D | null> = { eyes: null, face: null };
  const lenses: THREE.MeshStandardMaterial[] = [];
  if (head && eyeL && eyeR) {
    const l = eyeL.getWorldPosition(new THREE.Vector3());
    const r = eyeR.getWorldPosition(new THREE.Vector3());
    const eyes = l.clone().add(r).multiplyScalar(0.5);
    const across = l.distanceTo(r);
    // The head's middle behind the eyes, its round about them (a head ≈ 2.4 eyes apart wide).
    const radius = Math.max(0.07, across * 1.45);
    const centre = eyes.clone().add(new THREE.Vector3(0, 0, -front * radius * 0.92));
    const make = (part: 'eyes' | 'face') => {
      const built = part === 'eyes' ? goggles(radius, made) : shield(radius, made);
      lenses.push(built.lens);
      built.object.position.copy(centre);
      group.add(built.object);
      head.attach(built.object);
      if (input.self) built.object.traverse((o) => o.layers.set(SELF_LAYER));
      built.object.visible = false;
      return built.object;
    };
    kit.eyes = make('eyes');
    kit.face = make('face');
  }

  return {
    skirtBones,
    wear(worn) {
      const body = worn.body;
      for (const mesh of coat) mesh.visible = body !== undefined;
      if (body) coatMaterial.color.set(body);
      if (kit.eyes) kit.eyes.visible = worn.eyes !== undefined;
      if (kit.face) kit.face.visible = worn.face !== undefined;
      const tint = [worn.eyes, worn.face];
      lenses.forEach((m, i) => {
        const c = tint[i];
        if (c) m.color.set(c).lerp(LENS_CLEAR, 0.7);
      });
      for (const glove of gloves) glove.set(worn.hands ?? null);
    },
    dispose() {
      for (const g of made.geometries) g.dispose();
      for (const m of made.materials) m.dispose();
    },
  };
}

const LENS_CLEAR = new THREE.Color('#eef6fa');

/** The coat's weave, its own copy repeated over the clothes' map (the cloth's grain, not a print). */
function weave(fabric: THREE.Texture): THREE.Texture {
  const t = fabric.clone();
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(24, 24);
  t.needsUpdate = true;
  return t;
}

/**
 * Where a skinned mesh's vertices are at rest, in the person's frame: as the skin places them
 * (a bone's world × its inverse × the bind matrix), not the mesh's own matrixWorld (a glTF skin
 * keeps the bind of its file: the library's meshes lie turned in theirs).
 */
function restOf(mesh: THREE.SkinnedMesh, pelvis: THREE.Bone): THREE.Matrix4 {
  const at = mesh.skeleton.bones.indexOf(pelvis);
  return new THREE.Matrix4()
    .copy(pelvis.matrixWorld)
    .multiply(mesh.skeleton.boneInverses[at] ?? new THREE.Matrix4())
    .multiply(mesh.bindMatrix);
}

/** The hips at the pelvis: their middle, half-widths across (x) and front to back (z), top (m). */
interface Hips {
  readonly center: THREE.Vector3;
  readonly rx: number;
  readonly rz: number;
  readonly top: number;
}

function hipsOf(clothes: readonly THREE.SkinnedMesh[], pelvis: THREE.Bone): Hips {
  const y = pelvis.getWorldPosition(new THREE.Vector3()).y;
  const box = new THREE.Box3();
  const p = new THREE.Vector3();
  for (const mesh of clothes) {
    const position = mesh.geometry.getAttribute('position');
    const index = mesh.geometry.getAttribute('skinIndex');
    const weight = mesh.geometry.getAttribute('skinWeight');
    // The hips' own vertices only: at rest the hands hang at their height (the library's A-pose).
    const hip = mesh.skeleton.bones.map((b) => HIP_BONES.test(b.name));
    const rest = restOf(mesh, pelvis);
    for (let i = 0; i < position.count; i++) {
      let best = 0;
      let at = 0;
      for (let c = 0; c < 4; c++) {
        if (weight.getComponent(i, c) > best) {
          best = weight.getComponent(i, c);
          at = index.getComponent(i, c);
        }
      }
      if (hip[at] !== true) continue;
      p.fromBufferAttribute(position, i).applyMatrix4(rest);
      if (Math.abs(p.y - y) < 0.04) box.expandByPoint(p);
    }
  }
  if (box.isEmpty())
    box.setFromCenterAndSize(new THREE.Vector3(0, y, 0), new THREE.Vector3(0.34, 0.08, 0.24));
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  return { center, rx: size.x / 2 + 0.025, rz: size.z / 2 + 0.03, top: y + 0.03 };
}

/** Each vertex's hand share: the weight its hand and finger bones have (the gloves' mask). */
function handShare(geometry: THREE.BufferGeometry, skeleton: THREE.Skeleton): void {
  if (geometry.hasAttribute('aHand')) return; // shared by everyone drawn as this person
  const index = geometry.getAttribute('skinIndex');
  const weight = geometry.getAttribute('skinWeight');
  const hand = skeleton.bones.map((b) => HAND_BONES.test(b.name));
  const out = new Float32Array(index.count);
  for (let v = 0; v < index.count; v++) {
    let s = 0;
    for (let c = 0; c < 4; c++) if (hand[index.getComponent(v, c)]) s += weight.getComponent(v, c);
    out[v] = s;
  }
  geometry.setAttribute('aHand', new THREE.BufferAttribute(out, 1));
}

/** Gloves on a body material: its hands' colour and gloss set from a uniform (0 alpha: bare). */
function gloveOn(material: THREE.MeshStandardMaterial): { set(colour: string | null): void } {
  const glove = { value: new THREE.Vector4(0, 0, 0, 0) };
  const colour = new THREE.Color();
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGlove = glove;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'attribute float aHand;\nvarying float vHand;\nvoid main() {')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vHand = aHand;');
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform vec4 uGlove;\nvarying float vHand;\nvoid main() {')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
  float gloved = uGlove.a * smoothstep( 0.35, 0.65, vHand );
  diffuseColor.rgb = mix( diffuseColor.rgb, uGlove.rgb, gloved );`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
  roughnessFactor = mix( roughnessFactor, 0.42, gloved );`,
      );
  };
  material.customProgramCacheKey = () => 'real-glove';
  material.needsUpdate = true;
  return {
    set(c) {
      if (c === null) {
        glove.value.w = 0;
        return;
      }
      colour.set(c).convertSRGBToLinear();
      glove.value.set(colour.r, colour.g, colour.b, 1);
    },
  };
}

/** Is a triangle the coat's: most of its corners mostly on the coat's bones. */
function coatShell(
  clothes: readonly THREE.SkinnedMesh[],
  skeleton: THREE.Skeleton,
  pelvis: THREE.Bone,
): THREE.BufferGeometry | null {
  const coatBone = skeleton.bones.map((b) => COAT_BONES.test(b.name));
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const weights: number[] = [];
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (const mesh of clothes) {
    const g = mesh.geometry;
    if (!g.hasAttribute('normal')) g.computeVertexNormals(); // a mesh made without them
    const position = g.getAttribute('position');
    const normal = g.getAttribute('normal');
    const uv = g.getAttribute('uv') as THREE.BufferAttribute | undefined;
    const index = g.getAttribute('skinIndex');
    const weight = g.getAttribute('skinWeight');
    const ids = g.getIndex();
    const count = ids ? ids.count : position.count;
    // Units of the mesh (the library's cm) per metre of the person's frame.
    const unit = 1 / new THREE.Vector3().setFromMatrixScale(restOf(mesh, pelvis)).x;
    const onCoat = (v: number) => {
      let best = 0;
      let at = 0;
      for (let c = 0; c < 4; c++) {
        const w = weight.getComponent(v, c);
        if (w > best) {
          best = w;
          at = index.getComponent(v, c);
        }
      }
      return coatBone[at] === true;
    };
    for (let k = 0; k + 2 < count; k += 3) {
      const corners = [0, 1, 2].map((j) => (ids ? ids.getX(k + j) : k + j));
      if (corners.filter(onCoat).length < 2) continue;
      for (const v of corners) {
        p.fromBufferAttribute(position, v);
        n.fromBufferAttribute(normal, v).normalize();
        p.addScaledVector(n, COAT_OUT * unit);
        positions.push(p.x, p.y, p.z);
        normals.push(n.x, n.y, n.z);
        uvs.push(uv ? uv.getX(v) : 0, uv ? uv.getY(v) : 0);
        for (let c = 0; c < 4; c++) {
          indices.push(index.getComponent(v, c));
          weights.push(weight.getComponent(v, c));
        }
      }
    }
  }
  if (positions.length === 0) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  return g;
}

/**
 * The skirt from the hips to the knees: a tube flaring a little, open at the front, each column
 * on the two skirt bones either side of it (the top row on the pelvis), in the mesh's own space.
 */
function coatSkirt(
  mesh: THREE.SkinnedMesh,
  pelvis: THREE.Bone,
  hips: Hips,
  hem: number,
  front: number,
  firstSkirt: number,
  pelvisIndex: number,
): THREE.BufferGeometry | null {
  if (pelvisIndex < 0 || hem >= hips.top) return null;
  const toMesh = restOf(mesh, pelvis).invert();
  const turn = new THREE.Matrix3().getNormalMatrix(toMesh);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const weights: number[] = [];
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  // The front (where the coat opens) is at angle π when the frame faces −z (the bones' 0: behind).
  const opening = front < 0 ? Math.PI : 0;
  const span = 2 * Math.PI - 2 * SKIRT_OPEN;
  for (let row = 0; row <= SKIRT_ROWS; row++) {
    const t = row / SKIRT_ROWS;
    const y = hips.top + (hem - hips.top) * t;
    const flare = 1 + 0.18 * t;
    for (let col = 0; col <= SKIRT_COLUMNS; col++) {
      const a = opening + SKIRT_OPEN + span * (col / SKIRT_COLUMNS);
      const sin = Math.sin(a);
      const cos = Math.cos(a);
      p.set(hips.center.x + hips.rx * flare * sin, y, hips.center.z + hips.rz * flare * cos);
      n.set(sin / hips.rx, 0, cos / hips.rz).normalize();
      p.applyMatrix4(toMesh);
      n.applyMatrix3(turn).normalize();
      positions.push(p.x, p.y, p.z);
      normals.push(n.x, n.y, n.z);
      uvs.push(col / SKIRT_COLUMNS, t);
      // Between the two skirt bones either side (angle 0 behind, round by the right).
      const turnAt =
        (((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / ((2 * Math.PI) / SKIRT_COUNT);
      const k0 = Math.floor(turnAt) % SKIRT_COUNT;
      const k1 = (k0 + 1) % SKIRT_COUNT;
      const f = turnAt - Math.floor(turnAt);
      // The top row stays on the pelvis; lower, the skirt bones swing it.
      const hang = Math.min(1, t * 2.5);
      indices.push(firstSkirt + k0, firstSkirt + k1, pelvisIndex, 0);
      weights.push((1 - f) * hang, f * hang, 1 - hang, 0);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const ids: number[] = [];
  const across = SKIRT_COLUMNS + 1;
  for (let row = 0; row < SKIRT_ROWS; row++) {
    for (let col = 0; col < SKIRT_COLUMNS; col++) {
      const a = row * across + col;
      const b = a + 1;
      const c = a + across;
      const d = c + 1;
      ids.push(a, c, b, b, c, d);
    }
  }
  g.setIndex(ids);
  return g;
}

/** Safety goggles: a clear wrapped lens before the eyes, a black strap round the head. */
function goggles(
  radius: number,
  made: { geometries: THREE.BufferGeometry[]; materials: THREE.Material[] },
): { object: THREE.Object3D; lens: THREE.MeshStandardMaterial } {
  const object = new THREE.Group();
  object.name = 'real-goggles';
  const lens = new THREE.MeshStandardMaterial({
    color: '#dfeef3',
    transparent: true,
    opacity: 0.38,
    roughness: 0.06,
    metalness: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const strap = new THREE.MeshStandardMaterial({ color: '#202326', roughness: 0.7 });
  const frame = new THREE.MeshStandardMaterial({ color: '#cfd8dc', roughness: 0.45 });
  // Open cylinders about the head's vertical axis; theta 0 is +z, the lens round −z.
  const lensGeometry = new THREE.CylinderGeometry(
    radius + 0.016,
    radius + 0.016,
    0.046,
    32,
    1,
    true,
    Math.PI * 0.62,
    Math.PI * 0.76,
  );
  const rimTop = new THREE.CylinderGeometry(
    radius + 0.018,
    radius + 0.018,
    0.006,
    32,
    1,
    true,
    Math.PI * 0.62,
    Math.PI * 0.76,
  ).translate(0, 0.025, 0);
  const rimBottom = rimTop.clone().translate(0, -0.05, 0);
  const strapGeometry = new THREE.CylinderGeometry(
    radius + 0.006,
    radius + 0.006,
    0.018,
    32,
    1,
    true,
    -Math.PI * 0.38,
    Math.PI * 0.76,
  );
  made.geometries.push(lensGeometry, rimTop, rimBottom, strapGeometry);
  made.materials.push(lens, strap, frame);
  const lensMesh = new THREE.Mesh(lensGeometry, lens);
  lensMesh.renderOrder = 3;
  object.add(
    lensMesh,
    new THREE.Mesh(rimTop, frame),
    new THREE.Mesh(rimBottom, frame),
    new THREE.Mesh(strapGeometry, strap),
  );
  return { object, lens };
}

/** A face shield: a clear sheet from the brow to the chin, on a grey band round the forehead. */
function shield(
  radius: number,
  made: { geometries: THREE.BufferGeometry[]; materials: THREE.Material[] },
): { object: THREE.Object3D; lens: THREE.MeshStandardMaterial } {
  const object = new THREE.Group();
  object.name = 'real-shield';
  const sheet = new THREE.MeshStandardMaterial({
    color: '#e8f3f7',
    transparent: true,
    opacity: 0.22,
    roughness: 0.04,
    metalness: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const band = new THREE.MeshStandardMaterial({ color: '#8d969c', roughness: 0.6 });
  const sheetGeometry = new THREE.CylinderGeometry(
    radius + 0.045,
    radius + 0.04,
    0.2,
    32,
    1,
    true,
    Math.PI * 0.58,
    Math.PI * 0.84,
  ).translate(0, -0.05, 0);
  const bandGeometry = new THREE.CylinderGeometry(
    radius + 0.012,
    radius + 0.012,
    0.03,
    40,
    1,
    true,
  ).translate(0, 0.055, 0);
  made.geometries.push(sheetGeometry, bandGeometry);
  made.materials.push(sheet, band);
  const sheetMesh = new THREE.Mesh(sheetGeometry, sheet);
  sheetMesh.renderOrder = 3;
  object.add(sheetMesh, new THREE.Mesh(bandGeometry, band));
  return { object, lens: sheet };
}
