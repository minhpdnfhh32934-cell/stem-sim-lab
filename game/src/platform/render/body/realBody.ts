import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  BONES,
  type BodyModel,
  type BoneName,
  DIGITS,
  outlineMaterial,
  SELF_LAYER,
  SHADOW_LAYER,
  setOutlineWidth,
} from './BodyModel';
import type { WornOn } from '../../../gameplay/item';
import { fabricTexture } from './motion';
import { dressReal, type RealWear, realSkirtBone, SKIRT_COUNT } from './realWear';

/**
 * Max's real people (Phase Max, Phú 2026-11-18: "phải nhìn như thật"): a scanned-looking person
 * from the Microsoft Rocketbox library (MIT; public/max/people/<id>/, made by the scratch tools in
 * docs/phase-max-report.md) drawn in the drawn body's stead. The drawn body still moves as before
 * — its skeleton is what walks, sits, holds and points — and this body follows it every frame:
 *
 * - its limbs first brought to the drawn body's rest (arms hanging, legs straight), then each of
 *   its bones turned as its drawn bone has turned since rest (world turns, so the two skeletons'
 *   own axes never matter);
 * - its hands and feet put where the drawn ones are (two-bone IK at the shoulder and the hip; the
 *   people's proportions differ from the drawn ones), its pelvis lowered while standing so its
 *   shorter legs reach the floor;
 * - its eyes blinking on their own (the library's face shapes).
 *
 * Nothing here moves the drawn body or what it holds.
 */

/** One part's maps (a material of the library's: head, body, opacity, helmet, equipment…). */
export interface RealPart {
  readonly color: THREE.Texture;
  readonly normal: THREE.Texture | null;
  readonly rough: THREE.Texture | null;
  /** Cut out by its colour's alpha (hair locks, lashes, a visor's strap). */
  readonly alpha: boolean;
}

/** A real person's maps (public/max/people/<id>/, its manifest.json): shared by everyone drawn as them. */
export interface RealMaps {
  readonly parts: ReadonlyMap<string, RealPart>;
}

/** A person's maps as a list (none: none). */
export function realTextures(maps: RealMaps | null): THREE.Texture[] {
  const out: THREE.Texture[] = [];
  for (const part of maps?.parts.values() ?? []) {
    out.push(part.color);
    if (part.normal) out.push(part.normal);
    if (part.rough) out.push(part.rough);
  }
  return out;
}

/** A real person's files: the mesh with its skeleton, and its maps (none in tests). */
export interface RealAsset {
  readonly scene: THREE.Object3D;
  readonly maps: RealMaps | null;
}

/**
 * Makes a real person ready to draw before it is shown (the renderer's: its maps uploaded, its
 * programs compiled): shown at once, the first frame stalled on them.
 */
export type PrepareReal = (object: THREE.Object3D, maps: RealMaps | null) => Promise<void>;

/** What manifest.json says of each part (scratch tools: convert2.mjs). */
interface ManifestPart {
  readonly normal: boolean;
  readonly rough: boolean;
  readonly alpha: boolean;
}

const assets = new Map<string, Promise<RealAsset | null>>();

/** The real person `id`, loaded once and shared (null when its files are missing: logged). */
export function realPerson(id: string, warn: (message: string) => void): Promise<RealAsset | null> {
  let asset = assets.get(id);
  if (!asset) {
    asset = load(id).catch((error: unknown) => {
      warn(`Ultra: the real person ${id} did not load (${String(error)}); the drawn body stays`);
      return null;
    });
    assets.set(id, asset);
  }
  return asset;
}

async function load(id: string): Promise<RealAsset> {
  const base = `${import.meta.env.BASE_URL}max/people/${id}/`;
  const response = await fetch(`${base}manifest.json`);
  if (!response.ok) throw new Error(`manifest ${response.status}`);
  const manifest = (await response.json()) as { parts?: Record<string, ManifestPart> };
  // Decoded off the main thread (createImageBitmap), turned as a texture's flipY would.
  const bitmaps = new THREE.ImageBitmapLoader();
  bitmaps.setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none' });
  const map = async (file: string, colour: boolean) => {
    const t = new THREE.Texture(await bitmaps.loadAsync(base + file));
    t.flipY = false;
    t.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  };
  const entries = Object.entries(manifest.parts ?? {});
  const [gltf, ...parts] = await Promise.all([
    new GLTFLoader().loadAsync(`${base}body.glb`),
    ...entries.map(async ([name, part]): Promise<[string, RealPart]> => {
      const [color, normal, rough] = await Promise.all([
        map(`${name}-color.webp`, true),
        part.normal ? map(`${name}-normal.webp`, false) : null,
        part.rough ? map(`${name}-rough.webp`, false) : null,
      ]);
      return [name, { color, normal, rough, alpha: part.alpha }];
    }),
  ]);
  let meshes = 0;
  gltf.scene.traverse((o) => {
    if ((o as Partial<THREE.SkinnedMesh>).isSkinnedMesh === true) meshes++;
  });
  if (meshes === 0) throw new Error('no skinned mesh');
  return { scene: gltf.scene, maps: { parts: new Map(parts) } };
}

/** Parts never drawn: a police officer's sidearm (a school's labs). */
const UNDRAWN = new Set(['pistol']);

/**
 * One person's own materials, by part (a glove's colour, a glow are theirs), on the shared maps:
 * the programs are the same for everyone. Skin: its pores and stubble in the colour and the bumps,
 * a soft sheen where the light grazes it; hair locks, lashes, brows cut out by their alpha.
 */
function materialsOf(maps: RealMaps): Map<string, THREE.MeshStandardMaterial> {
  const out = new Map<string, THREE.MeshStandardMaterial>();
  for (const [name, part] of maps.parts) {
    const common = {
      name: `real-${name}`,
      map: part.color,
      normalMap: part.normal,
      roughnessMap: part.rough,
      roughness: part.rough ? 1 : 0.7,
    };
    const material =
      name === 'head'
        ? new THREE.MeshPhysicalMaterial({
            ...common,
            sheen: 0.35,
            sheenRoughness: 0.55,
            sheenColor: new THREE.Color('#ffb8a0'),
          })
        : new THREE.MeshStandardMaterial({
            ...common,
            ...(part.alpha ? { alphaTest: 0.4, side: THREE.DoubleSide } : {}),
          });
    material.visible = !UNDRAWN.has(name);
    out.set(name, material);
  }
  return out;
}

/** Real bone → drawn bone (L/R: the person's own left and right, as both skeletons name them). */
function mapping(): Map<string, BoneName> {
  const m = new Map<string, BoneName>([
    ['Bip01', 'hips'],
    ['Bip01_Pelvis', 'hips'],
    ['Bip01_Spine', 'spine'],
    ['Bip01_Spine1', 'spine'],
    ['Bip01_Spine2', 'chest'],
    ['Bip01_Neck', 'neck'],
    ['Bip01_Head', 'head'],
  ]);
  // The coat's skirt (realWear.ts): swung as the drawn coat's cloth swings the drawn skirt.
  for (let k = 0; k < SKIRT_COUNT; k++) m.set(realSkirtBone(k), `skirt${k}` as BoneName);
  for (const side of ['L', 'R'] as const) {
    m.set(`Bip01_${side}_Clavicle`, 'chest');
    m.set(`Bip01_${side}_UpperArm`, `upperArm${side}`);
    m.set(`Bip01_${side}_Forearm`, `foreArm${side}`);
    m.set(`Bip01_${side}_Hand`, `hand${side}`);
    m.set(`Bip01_${side}_Thigh`, `thigh${side}`);
    m.set(`Bip01_${side}_Calf`, `shin${side}`);
    m.set(`Bip01_${side}_Foot`, `foot${side}`);
    DIGITS.forEach((d, n) => {
      m.set(`Bip01_${side}_Finger${n}`, `${d}${side}1` as BoneName);
      m.set(`Bip01_${side}_Finger${n}1`, `${d}${side}2` as BoneName);
    });
  }
  return m;
}
const MAPPED = mapping();

/** Bones whose rest is turned to the drawn rest: real bone, its child, the drawn bones it lies along. */
function alignments(): [string, string, BoneName, BoneName][] {
  const out: [string, string, BoneName, BoneName][] = [];
  for (const side of ['L', 'R'] as const) {
    const b = `Bip01_${side}_`;
    out.push([`${b}UpperArm`, `${b}Forearm`, `upperArm${side}`, `foreArm${side}`]);
    out.push([`${b}Forearm`, `${b}Hand`, `foreArm${side}`, `hand${side}`]);
    out.push([`${b}Hand`, `${b}Finger2`, `hand${side}`, `middle${side}1`]);
    out.push([`${b}Thigh`, `${b}Calf`, `thigh${side}`, `shin${side}`]);
    out.push([`${b}Calf`, `${b}Foot`, `shin${side}`, `foot${side}`]);
    DIGITS.forEach((d, n) => {
      const one = `${d}${side}1` as BoneName;
      const two = `${d}${side}2` as BoneName;
      out.push([`${b}Finger${n}`, `${b}Finger${n}1`, one, two]);
      out.push([`${b}Finger${n}1`, `${b}Finger${n}2`, one, two]);
    });
  }
  return out;
}

/**
 * The player's own body: what their eye never sees, mirrors do — the head, its face and its neck,
 * as the drawn body's (its arms are seen: looked down at, the hands come up).
 */
const SELF_BONES = /Head|Neck|Eye|Jaw|Lip|Mouth|Tongue|Masseter|Caninus|Cheek|brow|Nose/i;

/**
 * The player's own body: the triangles mostly on SELF_BONES moved to a mesh of their own on
 * SELF_LAYER (the same skin and skeleton); the whole body again on SHADOW_LAYER, shadow only
 * (`shadow` for skin and clothes; the hair cut out by its own texture). Returns the new meshes.
 */
function splitSelf(
  mesh: THREE.SkinnedMesh,
  shadow: THREE.Material,
): { self: THREE.SkinnedMesh; shadow: THREE.SkinnedMesh } {
  const source = mesh.geometry;
  const bones = mesh.skeleton.bones.map((b) => SELF_BONES.test(b.name));
  const skinIndex = source.getAttribute('skinIndex');
  const skinWeight = source.getAttribute('skinWeight');
  const index = source.getIndex();
  const vertex = (k: number) => (index ? index.getX(k) : k);
  const selfOf = (v: number) => {
    let best = 0;
    let at = 0;
    for (let c = 0; c < 4; c++) {
      const w = skinWeight.getComponent(v, c);
      if (w > best) {
        best = w;
        at = skinIndex.getComponent(v, c);
      }
    }
    return bones[at] === true;
  };
  const seen: number[] = [];
  const own: number[] = [];
  const seenGroups: { start: number; count: number; materialIndex: number }[] = [];
  const ownGroups: { start: number; count: number; materialIndex: number }[] = [];
  const groups =
    source.groups.length > 0
      ? source.groups
      : [
          {
            start: 0,
            count: index ? index.count : source.getAttribute('position').count,
            materialIndex: 0,
          },
        ];
  for (const g of groups) {
    const s0 = seen.length;
    const o0 = own.length;
    for (let k = g.start; k < g.start + g.count; k += 3) {
      const a = vertex(k);
      const b = vertex(k + 1);
      const c = vertex(k + 2);
      const votes = Number(selfOf(a)) + Number(selfOf(b)) + Number(selfOf(c));
      (votes >= 2 ? own : seen).push(a, b, c);
    }
    if (seen.length > s0)
      seenGroups.push({ start: s0, count: seen.length - s0, materialIndex: g.materialIndex ?? 0 });
    if (own.length > o0)
      ownGroups.push({ start: o0, count: own.length - o0, materialIndex: g.materialIndex ?? 0 });
  }
  const part = (list: number[], parts: typeof seenGroups) => {
    const g = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(source.attributes))
      g.setAttribute(name, attribute);
    g.morphAttributes = source.morphAttributes;
    g.morphTargetsRelative = source.morphTargetsRelative;
    g.setIndex(list);
    for (const p of parts) g.addGroup(p.start, p.count, p.materialIndex);
    return g;
  };
  const twin = (geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[]) => {
    const m = new THREE.SkinnedMesh(geometry, material);
    m.position.copy(mesh.position);
    m.quaternion.copy(mesh.quaternion);
    m.scale.copy(mesh.scale);
    m.frustumCulled = false;
    mesh.parent?.add(m);
    m.bind(mesh.skeleton, mesh.bindMatrix);
    return m;
  };
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const self = twin(part(own, ownGroups), mesh.material);
  self.visible = ownGroups.length > 0;
  self.layers.set(SELF_LAYER);
  self.castShadow = false;
  // Shadow only: the hair's own cut-out (alpha-tested) so its locks cast locks, not cards.
  const shadows = materials.map((m) => {
    const cut = m as THREE.MeshStandardMaterial;
    if (cut.alphaTest > 0 && cut.map) {
      return new THREE.MeshBasicMaterial({
        map: cut.map,
        alphaTest: cut.alphaTest,
        side: cut.side,
        colorWrite: false,
        depthWrite: false,
      });
    }
    return shadow;
  });
  const shade = twin(source, Array.isArray(mesh.material) ? shadows : (shadows[0] ?? shadow));
  shade.layers.set(SHADOW_LAYER);
  shade.castShadow = true;
  mesh.geometry = part(seen, seenGroups);
  mesh.castShadow = false;
  return { self, shadow: shade };
}

/** The drawn thighs (their turn says how far the person sits). */
const THIGHS = [BONES.indexOf('thighL'), BONES.indexOf('thighR')];

/** A blink every few seconds: closed for this long (s). */
const BLINK_S = 0.14;

export class RealBody {
  readonly group = new THREE.Group();
  private readonly bones: THREE.Bone[] = [];
  private readonly parent: number[] = [];
  /** Per real bone: its drawn bone (index in BONES) or −1, and for a last finger joint its first. */
  private readonly drawn: number[] = [];
  private readonly third: number[] = [];
  /** The coat's skirt bones (indices): shortened as the person sits (drive). */
  private readonly skirt: number[] = [];
  private readonly still = new THREE.Quaternion();
  private readonly down = new THREE.Vector3();
  /** Rest (turned to the drawn rest), in the actor's frame: world turns, local turns and offsets. */
  private readonly restWorld: THREE.Quaternion[] = [];
  private readonly restLocal: THREE.Quaternion[] = [];
  /** Each bone's offset from its parent's joint, in the actor's metres, along the parent's frame. */
  private readonly offset: THREE.Vector3[] = [];
  /** The top bone's parent frame (fixed): its turn in the actor's frame, and the inverse matrix. */
  private readonly topTurn = new THREE.Quaternion();
  private readonly topInverse = new THREE.Matrix4();
  private readonly pelvisRest = new THREE.Vector3();
  private readonly hipsRest = new THREE.Vector3();
  private readonly drawnLeg: number;
  private readonly footRest: [THREE.Vector3, THREE.Vector3];
  private readonly drawnFootRest: [THREE.Vector3, THREE.Vector3];
  private readonly limbs: { upper: number; lower: number; end: number; target: number }[] = [];
  private readonly drawnRestInverse: THREE.Quaternion[] = [];
  // This frame (reused: nothing allocated per frame).
  private readonly gTurn: THREE.Quaternion[] = BONES.map(() => new THREE.Quaternion());
  private readonly gAt: THREE.Vector3[] = BONES.map(() => new THREE.Vector3());
  private readonly turn: THREE.Quaternion[] = [];
  private readonly at: THREE.Vector3[] = [];
  private readonly q = new THREE.Quaternion();
  private readonly q2 = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly v2 = new THREE.Vector3();
  private readonly v3 = new THREE.Vector3();
  private readonly r1 = new THREE.Vector3();
  private readonly r2 = new THREE.Vector3();
  private readonly r3 = new THREE.Vector3();
  private readonly q3 = new THREE.Quaternion();
  private readonly pelvis = new THREE.Vector3();
  /** The meshes whose face shapes blink (one, or the seen and the self parts). */
  private readonly faces: THREE.Mesh[] = [];
  /** The kit this person can wear (the coat, the goggles, the shield, the gloves). */
  private readonly kit: RealWear;
  /** The glow round a person called up (the drawn body's outline, its width in metres). */
  private readonly outline = outlineMaterial('#000000', 0);
  private readonly outlines: THREE.SkinnedMesh[] = [];
  /** The meshes' units per metre (the library's cm), for the outline's width. */
  private readonly unit: number;
  /** The player's own body: its shadow-only meshes (cast while `casts`), else none. */
  readonly shadows: THREE.SkinnedMesh[] = [];
  private readonly made: THREE.BufferGeometry[] = [];
  private readonly madeMaterials: THREE.Material[] = [];
  private readonly blinks: [number, number];
  private blinkIn = 2;
  private blinkLeft = 0;

  constructor(
    asset: RealAsset,
    private readonly model: BodyModel,
    heightM: number,
    /** The player's own body (BodyView): its head and arms on SELF_LAYER; `shadow` casts it. */
    own: { readonly shadow: THREE.Material } | null = null,
  ) {
    const person = cloneSkinned(asset.scene);
    // Its units to metres at the character's height; turned to face −z, as the drawn body does.
    const holder = new THREE.Group();
    holder.add(person);
    holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(person);
    holder.scale.setScalar(heightM / Math.max(box.max.y - box.min.y, 1e-6));
    holder.position.y = -box.min.y * holder.scale.y; // the soles on the floor
    holder.rotation.y = Math.PI;
    this.group.add(holder);
    this.group.name = 'real-body';
    this.group.updateMatrixWorld(true);

    // This person's materials, by the library's parts (head, body, opacity, helmet…).
    const mine = asset.maps ? materialsOf(asset.maps) : null;
    if (mine) this.madeMaterials.push(...mine.values());
    const found: THREE.SkinnedMesh[] = [];
    person.traverse((o) => {
      if ((o as Partial<THREE.SkinnedMesh>).isSkinnedMesh === true)
        found.push(o as THREE.SkinnedMesh);
    });
    // One mesh per material (glTF primitives), on one skeleton: the clone gave each its own copy
    // (four bone textures written and uploaded a frame); one skin, so the joints are the same.
    const mesh = found[0];
    if (!mesh) throw new Error('real body without a skinned mesh');
    for (const part of found) {
      part.castShadow = true;
      part.receiveShadow = true;
      part.frustumCulled = false; // moved by its bones, its box is the rest pose's
      if (mine) {
        const named = (m: THREE.Material) => mine.get(m.name) ?? m;
        part.material = Array.isArray(part.material)
          ? part.material.map(named)
          : named(part.material);
      }
    }
    for (const part of found) {
      if (part.skeleton === mesh.skeleton) continue;
      part.skeleton.dispose();
      part.bind(mesh.skeleton, part.bindMatrix);
    }
    // The kit, made on the body as it stands now (its bind pose: nothing has turned it yet).
    const isClothes = (m: THREE.Material | THREE.Material[]) =>
      !Array.isArray(m) && (m.name === 'real-body' || m.name === 'body');
    const bodyMaterial = mine?.get('body');
    const bonesByName = new Map(mesh.skeleton.bones.map((b) => [b.name, b]));
    this.kit = dressReal({
      group: this.group,
      clothes: found.filter((m) => isClothes(m.material)),
      bodyMaterials: bodyMaterial ? [bodyMaterial] : [],
      skeleton: mesh.skeleton,
      bone: (name) => bonesByName.get(name),
      fabric: fabricTexture(),
      self: own !== null,
    });
    for (const part of found) {
      if (part.morphTargetDictionary) this.faces.push(part);
      if (!own) continue;
      const parts = splitSelf(part, own.shadow);
      if (parts.self.morphTargetDictionary) this.faces.push(parts.self);
      this.shadows.push(parts.shadow);
      this.made.push(part.geometry, parts.self.geometry);
      const shadows = parts.shadow.material;
      for (const m of Array.isArray(shadows) ? shadows : [shadows])
        if (m !== own.shadow) this.madeMaterials.push(m);
    }
    const dict = found.find((m) => m.morphTargetDictionary)?.morphTargetDictionary ?? {};
    this.blinks = [dict.AK_09_EyeBlinkLeft ?? -1, dict.AK_10_EyeBlinkRight ?? -1];

    // The bones from the top down (each after its parent).
    // The glow: the body's shell pushed out (not the hair's cut-out cards), shown only when called.
    this.unit = 1 / new THREE.Vector3().setFromMatrixScale(mesh.matrixWorld).x;
    this.madeMaterials.push(this.outline);
    for (const part of found) {
      const material = part.material;
      if (Array.isArray(material) || (material as THREE.MeshStandardMaterial).alphaTest > 0)
        continue;
      const line = new THREE.SkinnedMesh(part.geometry, this.outline);
      line.name = 'real-glow';
      line.position.copy(part.position);
      line.quaternion.copy(part.quaternion);
      line.scale.copy(part.scale);
      line.frustumCulled = false;
      line.visible = false;
      part.parent?.add(line);
      line.bind(mesh.skeleton, part.bindMatrix);
      this.outlines.push(line);
    }
    const all = new Set([...mesh.skeleton.bones, ...this.kit.skirtBones]);
    const first = mesh.skeleton.bones.find((b) => !all.has(b.parent as THREE.Bone));
    if (!first) throw new Error('real body without a top bone');
    const order: THREE.Bone[] = [];
    const walk = (b: THREE.Bone) => {
      order.push(b);
      for (const c of b.children) if (all.has(c as THREE.Bone)) walk(c as THREE.Bone);
    };
    walk(first);
    const index = new Map(order.map((b, i) => [b, i]));
    const drawnIndex = new Map(BONES.map((n, i) => [n, i]));

    // The drawn rest, in the actor's frame (the bind: its bones' inverses).
    const drawnRest = BONES.map((_, i) =>
      new THREE.Matrix4().copy(model.skeleton.boneInverses[i] ?? new THREE.Matrix4()).invert(),
    );
    const drawnAt = (name: BoneName) =>
      new THREE.Vector3().setFromMatrixPosition(
        drawnRest[drawnIndex.get(name) ?? 0] ?? new THREE.Matrix4(),
      );
    for (const m of drawnRest) {
      this.drawnRestInverse.push(new THREE.Quaternion().setFromRotationMatrix(m).invert());
    }

    // Turn the real limbs to the drawn rest, top down.
    const byName = new Map(order.map((b) => [b.name, b]));
    const worldTurn = (b: THREE.Object3D, out: THREE.Quaternion) => b.getWorldQuaternion(out);
    const worldAt = (b: THREE.Object3D, out: THREE.Vector3) => b.getWorldPosition(out);
    for (const [name, child, from, to] of alignments()) {
      const bone = byName.get(name);
      const next = byName.get(child);
      if (!bone || !next) continue;
      const want = drawnAt(to).sub(drawnAt(from)).normalize();
      const has = worldAt(next, new THREE.Vector3())
        .sub(worldAt(bone, new THREE.Vector3()))
        .normalize();
      if (want.lengthSq() < 0.5 || has.lengthSq() < 0.5) continue;
      const swing = new THREE.Quaternion().setFromUnitVectors(has, want);
      const parentTurn = worldTurn(bone.parent ?? bone, new THREE.Quaternion());
      const own = worldTurn(bone, new THREE.Quaternion());
      bone.quaternion.copy(parentTurn.invert().multiply(swing.multiply(own)));
      this.group.updateMatrixWorld(true);
    }

    // Record the rest.
    const scale = new THREE.Vector3();
    for (const b of order) {
      const i = this.bones.length;
      this.bones.push(b);
      const p =
        b.parent && all.has(b.parent as THREE.Bone)
          ? (index.get(b.parent as THREE.Bone) ?? -1)
          : -1;
      this.parent.push(p);
      const name = MAPPED.get(b.name);
      this.drawn.push(name === undefined ? -1 : (drawnIndex.get(name) ?? -1));
      // A last finger joint (FingerN2) bends on as its middle one does.
      const tip = /^Bip01_([LR])_Finger(\d)2$/.exec(b.name);
      const d = tip ? DIGITS[Number(tip[2])] : undefined;
      if (b.name.startsWith('RealSkirt')) this.skirt.push(i);
      this.third.push(
        tip && d ? (drawnIndex.get(`${d}${tip[1] as 'L' | 'R'}1` as BoneName) ?? -1) : -1,
      );
      if (tip && d) this.drawn[i] = drawnIndex.get(`${d}${tip[1] as 'L' | 'R'}2` as BoneName) ?? -1;
      this.restWorld.push(worldTurn(b, new THREE.Quaternion()));
      this.restLocal.push(b.quaternion.clone());
      // The offset in the actor's metres: the parent's world scale times the local position.
      const parentScale = (b.parent ?? b).getWorldScale(scale).x;
      this.offset.push(b.position.clone().multiplyScalar(parentScale));
      this.turn.push(new THREE.Quaternion());
      this.at.push(new THREE.Vector3());
    }
    const topBone = this.bones[0] as THREE.Bone;
    if (topBone.parent) {
      topBone.parent.getWorldQuaternion(this.topTurn);
      this.topInverse.copy(topBone.parent.matrixWorld).invert();
    }
    worldAt(topBone, this.pelvisRest);
    this.hipsRest.copy(drawnAt('hips'));
    this.drawnLeg = drawnAt('hips').y - (drawnAt('footL').y + drawnAt('footR').y) / 2;
    const real = (n: string) => worldAt(byName.get(n) ?? topBone, new THREE.Vector3());
    this.footRest = [real('Bip01_L_Foot'), real('Bip01_R_Foot')];
    this.drawnFootRest = [drawnAt('footL'), drawnAt('footR')];
    for (const side of ['L', 'R'] as const) {
      const at = (n: string) => index.get(byName.get(`Bip01_${side}_${n}`) as THREE.Bone) ?? -1;
      this.limbs.push({
        upper: at('UpperArm'),
        lower: at('Forearm'),
        end: at('Hand'),
        target: drawnIndex.get(`hand${side}`) ?? -1,
      });
      this.limbs.push({
        upper: at('Thigh'),
        lower: at('Calf'),
        end: at('Foot'),
        target: drawnIndex.get(`foot${side}`) ?? -1,
      });
    }
  }

  /** Follows the drawn body's pose (call after it is posed), blinking `dt` s on. */
  drive(dt: number): void {
    this.drawnPose();
    const n = this.bones.length;
    // The pelvis: where the drawn hips are, lowered by the legs' difference while they stand.
    // How far they sit (0 standing, 1 seated: the thighs forward, not down), from the drawn thighs.
    let down = 0;
    for (const thigh of THIGHS) {
      down += this.down.set(0, -1, 0).applyQuaternion(this.gTurn[thigh] as THREE.Quaternion).y;
    }
    const sit = THREE.MathUtils.smoothstep(1 + down / 2, 0.25, 0.75);
    const gHips = this.gAt[BONES.indexOf('hips')] as THREE.Vector3;
    const feetY =
      ((this.gAt[BONES.indexOf('footL')] as THREE.Vector3).y +
        (this.gAt[BONES.indexOf('footR')] as THREE.Vector3).y) /
      2;
    const straight = THREE.MathUtils.smoothstep((gHips.y - feetY) / this.drawnLeg, 0.6, 0.95);
    const pelvis = this.pelvis
      .copy(this.pelvisRest)
      .sub(this.hipsRest)
      .multiplyScalar(straight)
      .add(gHips);
    pelvis.x = gHips.x + (this.pelvisRest.x - this.hipsRest.x);
    pelvis.z = gHips.z + (this.pelvisRest.z - this.hipsRest.z);

    for (let i = 0; i < n; i++) {
      const turn = this.turn[i] as THREE.Quaternion;
      const d = this.drawn[i] as number;
      const p = this.parent[i] as number;
      const parentTurn = p >= 0 ? (this.turn[p] as THREE.Quaternion) : this.topTurn;
      if (d >= 0) {
        // Turned as the drawn bone has turned since rest (its rest turn is the identity's inverse).
        this.q
          .copy(this.gTurn[d] as THREE.Quaternion)
          .multiply(this.drawnRestInverse[d] as THREE.Quaternion);
        const t = this.third[i] as number;
        if (t >= 0) {
          // The last joint bends on as the middle one bent from the first.
          this.q2
            .copy(this.gTurn[t] as THREE.Quaternion)
            .multiply(this.drawnRestInverse[t] as THREE.Quaternion)
            .invert()
            .multiply(this.q);
          this.q.multiply(this.q2);
        }
        turn.copy(this.q).multiply(this.restWorld[i] as THREE.Quaternion);
        // The coat's skirt, seated: under them, not spread over the seat (the drawn cloth lays its
        // panels flat there; a real coat's hang down beside the legs and under them).
        if (sit > 0 && this.skirt.includes(i))
          turn.slerpQuaternions(this.still, turn, 1 - 0.6 * sit);
      } else turn.copy(parentTurn).multiply(this.restLocal[i] as THREE.Quaternion);
      const at = this.at[i] as THREE.Vector3;
      if (p < 0) at.copy(pelvis);
      else
        at.copy(this.offset[i] as THREE.Vector3)
          .applyQuaternion(this.turn[p] as THREE.Quaternion)
          .add(this.at[p] as THREE.Vector3);
    }
    for (let k = 0; k < this.limbs.length; k++) {
      const limb = this.limbs[k];
      if (!limb || limb.upper < 0 || limb.lower < 0 || limb.end < 0 || limb.target < 0) continue;
      const target = this.v.copy(this.gAt[limb.target] as THREE.Vector3);
      if (k % 2 === 1) {
        // Feet: the drawn ankle, moved as the real ankle stands from it at rest.
        const side = k === 1 ? 0 : 1;
        target.add(this.v2.copy(this.footRest[side]).sub(this.drawnFootRest[side]));
      }
      this.reach(limb.upper, limb.lower, limb.end, target);
    }
    // Back to local turns; the top bone placed in its parent's frame.
    for (let i = 0; i < n; i++) {
      const bone = this.bones[i] as THREE.Bone;
      const p = this.parent[i] as number;
      const parentTurn = p >= 0 ? (this.turn[p] as THREE.Quaternion) : this.topTurn;
      bone.quaternion
        .copy(parentTurn)
        .invert()
        .multiply(this.turn[i] as THREE.Quaternion);
    }
    (this.bones[0] as THREE.Bone).position.copy(pelvis).applyMatrix4(this.topInverse);
    for (const k of this.skirt)
      (this.bones[k] as THREE.Bone).scale.y = Math.max(0.05, 1 - 0.95 * sit);
    this.blink(dt);
  }

  /** The drawn bones' turns and joints this frame, in the actor's frame (from their locals). */
  private drawnPose(): void {
    const bones = this.model.bones;
    for (let i = 0; i < BONES.length; i++) {
      const name = BONES[i] as BoneName;
      const bone = bones[name];
      const parent = bone.parent as THREE.Bone | null;
      const pi = parent ? BONES.indexOf(parent.name as BoneName) : -1;
      const turn = this.gTurn[i] as THREE.Quaternion;
      const at = this.gAt[i] as THREE.Vector3;
      if (pi < 0) {
        turn.copy(bone.quaternion);
        at.copy(bone.position);
      } else {
        const pt = this.gTurn[pi] as THREE.Quaternion;
        turn.copy(pt).multiply(bone.quaternion);
        at.copy(bone.position)
          .applyQuaternion(pt)
          .add(this.gAt[pi] as THREE.Vector3);
      }
    }
  }

  /**
   * Two-bone IK: the upper and lower bones turned so the end's joint reaches `target`, bending in
   * the plane they already bend in (so an elbow or a knee keeps its way), each keeping its twist.
   */
  private reach(upper: number, lower: number, end: number, target: THREE.Vector3): void {
    const s = this.at[upper] as THREE.Vector3;
    const e = this.at[lower] as THREE.Vector3;
    const w = this.at[end] as THREE.Vector3;
    const a = e.distanceTo(s);
    const b = w.distanceTo(e);
    const toT = this.v2.copy(target).sub(s);
    const d = THREE.MathUtils.clamp(toT.length(), Math.abs(a - b) + 1e-4, a + b - 1e-4);
    toT.normalize();
    // The bend plane's axis, from where the elbow is now; straight limbs bend forward (−z).
    const bend = this.v3.copy(e).sub(s).cross(toT);
    if (bend.lengthSq() < 1e-10) bend.set(0, 0, -1).cross(toT);
    bend.normalize();
    const angle = Math.acos(THREE.MathUtils.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
    // Where the elbow goes: from the shoulder, towards the target, turned by `angle` about the axis.
    const elbow = this.q.setFromAxisAngle(bend, -angle);
    const newE = this.r1.copy(toT).applyQuaternion(elbow).multiplyScalar(a).add(s);
    const swing1 = this.q2.setFromUnitVectors(
      this.r2.copy(e).sub(s).normalize(),
      this.r3.copy(newE).sub(s).normalize(),
    );
    (this.turn[upper] as THREE.Quaternion).premultiply(swing1);
    const lowerTurn = this.turn[lower] as THREE.Quaternion;
    lowerTurn.premultiply(swing1);
    const was = this.r2.copy(w).sub(e).applyQuaternion(swing1).normalize();
    const reached = this.r3.copy(target).sub(newE).normalize();
    lowerTurn.premultiply(this.q3.setFromUnitVectors(was, reached));
    e.copy(newE);
    w.copy(reached).multiplyScalar(b).add(newE);
  }

  private blink(dt: number): void {
    if (this.faces.length === 0) return;
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blinkLeft = BLINK_S;
      this.blinkIn = 2.5 + Math.random() * 3.5;
    }
    this.blinkLeft = Math.max(0, this.blinkLeft - dt);
    const shut = this.blinkLeft > 0 ? Math.sin((Math.PI * this.blinkLeft) / BLINK_S) : 0;
    for (const face of this.faces) {
      const influences = face.morphTargetInfluences;
      if (influences) for (const k of this.blinks) if (k >= 0) influences[k] = shut;
    }
  }

  /** The glow of a person called up: on, in this colour and width (m); off: not drawn at all. */
  glow(on: boolean, color: THREE.Color, widthM: number): void {
    for (const line of this.outlines) line.visible = on;
    if (!on) return;
    this.outline.color.copy(color);
    setOutlineWidth(this.outline, widthM * this.unit);
  }

  /** Shown by what is worn, in its colours (the equipment's: absent, not worn). */
  wear(worn: Partial<Record<WornOn, string>>): void {
    this.kit.wear(worn);
  }

  dispose(): void {
    this.group.removeFromParent();
    this.kit.dispose();
    for (const g of this.made) g.dispose();
    for (const m of this.madeMaterials) m.dispose();
    this.group.traverse((o) => {
      if ((o as Partial<THREE.SkinnedMesh>).isSkinnedMesh === true)
        (o as THREE.SkinnedMesh).skeleton.dispose();
    });
  }
}
