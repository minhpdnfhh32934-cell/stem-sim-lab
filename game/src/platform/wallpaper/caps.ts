import * as THREE from 'three';
import type { Actor } from '../render/body/actor';
import type { BoneName } from '../render/body/BodyModel';

/*
 * Joints that stay whole (Phase W, Phú: "lộ khối" — bent far, a knee or an elbow showed the two
 * pieces of the limb apart). The body's limbs are pieces blended a few centimetres either side of
 * each joint; bent past ~100° the outside of the joint opens. A ball is put in each elbow and knee,
 * skinned to the joint's lower bone, as thick as the limb there (measured from the body itself)
 * and dressed in what covers that joint (sleeve, trousers, boot or skin): straight it lies hidden
 * inside the limb, bent it fills the opening. It gets the body's outline too.
 */

/**
 * What may cover a joint: the one reaching farthest out there is it (a thigh boot over the knee,
 * not what is under it — taken by a fixed order, a pale patch showed on the boot).
 */
const LAYERS = ['outer', 'coat', 'top', 'bottom', 'legwear', 'shoes', 'skin', 'hands'];
const JOINTS: readonly BoneName[] = ['foreArmL', 'foreArmR', 'shinL', 'shinR'];

export function jointCaps(actor: Actor): THREE.SkinnedMesh[] {
  const model = actor.model;
  const made: THREE.SkinnedMesh[] = [];
  const outline = model.outlines?.body.material as THREE.Material | undefined;
  const v = new THREE.Vector3();
  for (const joint of JOINTS) {
    // The bind pose: the body unmoved at the origin, the joint's place its bone's.
    const at = model.bones[joint].getWorldPosition(new THREE.Vector3());
    const index = model.skeleton.bones.indexOf(model.bones[joint]);
    const parent = model.bones[joint].parent;
    const above = parent ? model.skeleton.bones.indexOf(parent as THREE.Bone) : -1;
    if (index < 0) continue;
    // Which surface is outermost there, and how thick the limb is (its farthest point in a thin
    // slice through the joint, the limb hanging along −y).
    let chosen: THREE.SkinnedMesh | null = null;
    let radius = 0;
    // The thickest of what lies under it (skin under a boot, a shirt under a sleeve).
    let under = 0;
    for (const layer of LAYERS) {
      for (const mesh of model.meshes) {
        if (mesh.userData.surface !== layer || !mesh.visible) continue;
        const p = mesh.geometry.getAttribute('position');
        const bone = mesh.geometry.getAttribute('skinIndex');
        const weight = mesh.geometry.getAttribute('skinWeight');
        let count = 0;
        let far = 0;
        for (let i = 0; i < p.count; i++) {
          // Only the limb's own: skinned mostly to the joint's bone or the one above it.
          const main = weight.getX(i) >= weight.getY(i) ? bone.getX(i) : bone.getY(i);
          if (main !== index && main !== above) continue;
          v.fromBufferAttribute(p, i);
          if (Math.abs(v.y - at.y) > 0.014) continue;
          const d = Math.hypot(v.x - at.x, v.z - at.z);
          if (d > 0.13) continue;
          count++;
          far = Math.max(far, d);
        }
        if (count < 8) continue;
        if (far > radius) {
          under = radius;
          chosen = mesh;
          radius = far;
        } else {
          under = Math.max(under, far);
        }
      }
    }
    if (!chosen || radius < 0.02 || radius > 0.09) continue;
    // Inside what covers the joint (a full one read as a ball), but over all that lies under it:
    // smaller, the skin under a boot showed through the bent knee's opening.
    const r = Math.min(
      radius - 0.0015,
      Math.max(radius * (joint.startsWith('shin') ? 0.82 : 0.76), under + 0.004),
    );
    const geometry = new THREE.SphereGeometry(r, 28, 18).translate(at.x, at.y, at.z);
    const n = geometry.getAttribute('position').count;
    const skinIndex = new Uint16Array(n * 4);
    const skinWeight = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      skinIndex[i * 4] = index;
      skinWeight[i * 4] = 1;
    }
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
    // Still in the wind (look.ts reads this attribute on every body material).
    geometry.setAttribute('aWind', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    // White: the material's own colour (the body's materials take vertex colours; without them
    // the GPU used whatever it last had, and the cap showed as a pale patch on boot and sleeve).
    const size = chosen.geometry.hasAttribute('color')
      ? chosen.geometry.getAttribute('color').itemSize
      : 3;
    geometry.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(new Float32Array(n * size).fill(1), size),
    );
    for (const material of [chosen.material as THREE.Material, outline]) {
      if (!material) continue;
      const mesh = new THREE.SkinnedMesh(geometry, material);
      mesh.name = `cap-${joint}`;
      mesh.frustumCulled = false;
      mesh.castShadow = material !== outline;
      mesh.receiveShadow = true;
      model.group.add(mesh);
      mesh.bind(model.skeleton, new THREE.Matrix4());
      made.push(mesh);
    }
  }
  return made;
}
