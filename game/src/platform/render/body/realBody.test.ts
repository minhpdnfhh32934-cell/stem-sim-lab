import { existsSync, readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../../content';
import { CharacterDefinitionSchema } from '../../../gameplay/character';
import { Actor } from './actor';
import { SELF_LAYER, SHADOW_LAYER } from './BodyModel';
import type { PersonView } from './person';
import { type RealAsset, RealBody } from './realBody';

// Max's real people (Phase Max): a library person (a Biped skeleton in its A-pose, in cm, facing
// +z, as Rocketbox's) follows the drawn body's skeleton — its arms brought to hang as the drawn
// ones, its hands put where the drawn hands are, its feet on the floor; the player's own head
// moved to the self layer.

const character = CharacterDefinitionSchema.parse((bundledContent.characters as unknown[])[0]);

/** The Biped's joints (cm; left is +x, facing +z), parents first. */
const JOINTS: [string, string | null, [number, number, number]][] = [
  ['Bip01', null, [0, 92, 0]],
  ['Bip01_Pelvis', 'Bip01', [0, 92, 0]],
  ['Bip01_Spine', 'Bip01_Pelvis', [0, 100, 0]],
  ['Bip01_Spine1', 'Bip01_Spine', [0, 115, 0]],
  ['Bip01_Spine2', 'Bip01_Spine1', [0, 130, 0]],
  ['Bip01_Neck', 'Bip01_Spine2', [0, 148, 0]],
  ['Bip01_Head', 'Bip01_Neck', [0, 155, 0]],
  ['Bip01_LEye', 'Bip01_Head', [3.2, 168, 9]],
  ['Bip01_REye', 'Bip01_Head', [-3.2, 168, 9]],
  ...(['L', 'R'] as const).flatMap((side): [string, string | null, [number, number, number]][] => {
    const s = side === 'L' ? 1 : -1;
    const b = `Bip01_${side}_`;
    return [
      [`${b}Clavicle`, 'Bip01_Neck', [6 * s, 145, 0]],
      [`${b}UpperArm`, `${b}Clavicle`, [18 * s, 142, 0]],
      [`${b}Forearm`, `${b}UpperArm`, [36 * s, 125, 0]],
      [`${b}Hand`, `${b}Forearm`, [52 * s, 109, 0]],
      [`${b}Finger2`, `${b}Hand`, [58 * s, 103, 0]],
      [`${b}Finger21`, `${b}Finger2`, [61 * s, 100, 0]],
      [`${b}Finger22`, `${b}Finger21`, [63 * s, 98, 0]],
      [`${b}Thigh`, 'Bip01_Spine', [9 * s, 92, 0]],
      [`${b}Calf`, `${b}Thigh`, [10 * s, 50, 0]],
      [`${b}Foot`, `${b}Calf`, [11 * s, 9, 0]],
      [`${b}Toe0`, `${b}Foot`, [12 * s, 1, 10]],
    ];
  }),
];

/** A library person: the skeleton and three triangles (the head's, the chest's, a foot's). */
function biped(): RealAsset {
  const scene = new THREE.Group();
  const bones = new Map<string, THREE.Bone>();
  for (const [name, parent, at] of JOINTS) {
    const bone = new THREE.Bone();
    bone.name = name;
    const p = parent ? JOINTS.find((j) => j[0] === parent)?.[2] : undefined;
    bone.position.set(at[0] - (p?.[0] ?? 0), at[1] - (p?.[1] ?? 0), at[2] - (p?.[2] ?? 0));
    (parent ? bones.get(parent) : scene)?.add(bone);
    bones.set(name, bone);
  }
  scene.updateMatrixWorld(true);
  const list = [...bones.values()];
  const index = (name: string) => list.findIndex((b) => b.name === name);
  const geometry = new THREE.BufferGeometry();
  // prettier-ignore
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -8, 160, 0, 8, 160, 0, 0, 175, 0, // the head
    -15, 120, 0, 15, 120, 0, 0, 135, 0, // the chest
    8, 0, -5, 14, 0, -5, 11, 5, 8, // the left foot
  ], 3));
  const owner = [index('Bip01_Head'), index('Bip01_Spine2'), index('Bip01_L_Foot')];
  geometry.setAttribute(
    'skinIndex',
    new THREE.Uint16BufferAttribute(
      owner.flatMap((b) => [b, 0, 0, 0, b, 0, 0, 0, b, 0, 0, 0]),
      4,
    ),
  );
  geometry.setAttribute(
    'skinWeight',
    new THREE.Float32BufferAttribute(
      owner.flatMap(() => [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]),
      4,
    ),
  );
  // The clothes' material (realWear.ts dresses meshes in it).
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial({ name: 'body' }));
  scene.add(mesh);
  mesh.bind(new THREE.Skeleton(list));
  return { scene, maps: null };
}

const view: PersonView = {
  id: 'p',
  x: 0,
  z: 0,
  heading: 0,
  speed: 0,
  sit: false,
  gesture: 'idle',
  look: null,
  called: false,
};

function made(own = false) {
  const actor = new Actor(character, new THREE.MeshBasicMaterial(), 0);
  for (let f = 0; f < 60; f++) actor.update(view, 1 / 60, f / 60, null);
  const real = new RealBody(
    biped(),
    actor.model,
    character.appearance.heightM,
    own ? { shadow: new THREE.MeshBasicMaterial() } : null,
  );
  return { actor, real };
}

/** A real bone's joint, in the actor's frame (the real body is not under the actor here). */
function realAt(real: RealBody, name: string): THREE.Vector3 {
  real.group.updateMatrixWorld(true);
  const bone = real.group.getObjectByName(name);
  if (!bone) throw new Error(name);
  return bone.getWorldPosition(new THREE.Vector3());
}

function drawnAt(actor: Actor, name: 'handL' | 'foreArmL' | 'upperArmL'): THREE.Vector3 {
  actor.group.updateMatrixWorld(true);
  return actor.model.bones[name].getWorldPosition(new THREE.Vector3());
}

describe('a real person (Max) following the drawn body', () => {
  it('hangs its arms as the drawn ones hang, its feet on the floor', () => {
    const { real } = made();
    real.drive(1 / 60);
    const elbow = realAt(real, 'Bip01_L_Forearm');
    const wrist = realAt(real, 'Bip01_L_Hand');
    const forearm = wrist.clone().sub(elbow).normalize();
    expect(forearm.y).toBeLessThan(-0.95); // A-pose out at 45°, now hanging
    // Facing −z as the drawn body: its own left on −x.
    expect(wrist.x).toBeLessThan(0);
    // The foot on the floor (9 cm up at rest, the person 175 cm tall: 1.75 m).
    expect(realAt(real, 'Bip01_L_Foot').y).toBeCloseTo(0.09, 2);
  });

  it('puts its hand where the drawn hand is, its forearm along the drawn one', () => {
    const { actor, real } = made();
    actor.model.bones.foreArmL.rotation.x = 1.6; // the drawn elbow bent: the hand forward
    real.drive(1 / 60);
    const hand = realAt(real, 'Bip01_L_Hand');
    expect(hand.distanceTo(drawnAt(actor, 'handL'))).toBeLessThan(0.01);
    const real1 = hand.sub(realAt(real, 'Bip01_L_Forearm')).normalize();
    const drawn1 = drawnAt(actor, 'handL').sub(drawnAt(actor, 'foreArmL')).normalize();
    expect(real1.dot(drawn1)).toBeGreaterThan(0.8);
  });

  it("moves the player's own head to the self layer and casts the whole body from the shadow layer", () => {
    const { real } = made(true);
    const meshes: THREE.SkinnedMesh[] = [];
    real.group.traverse((o) => {
      if ((o as Partial<THREE.SkinnedMesh>).isSkinnedMesh === true)
        meshes.push(o as THREE.SkinnedMesh);
    });
    const self = meshes.filter((m) => m.layers.isEnabled(SELF_LAYER));
    const seen = meshes.filter((m) => m.layers.isEnabled(0));
    expect(self).toHaveLength(1);
    expect(self[0]?.geometry.index?.count).toBe(3); // the head's triangle
    expect(seen[0]?.geometry.index?.count).toBe(6); // the chest's and the foot's
    expect(seen[0]?.castShadow).toBe(false);
    expect(real.shadows).toHaveLength(1);
    expect(real.shadows[0]?.layers.isEnabled(SHADOW_LAYER)).toBe(true);
    expect(real.shadows[0]?.castShadow).toBe(true);
  });
});

describe('what a real person wears (realWear.ts)', () => {
  const named = (real: RealBody, name: string) => {
    const out: THREE.Object3D[] = [];
    real.group.traverse((o) => {
      if (o.name === name) out.push(o);
    });
    return out;
  };

  it('puts on and takes off the coat, goggles and shield as worn; gloves by the hands share', () => {
    const { real } = made();
    const coat = named(real, 'real-coat');
    expect(coat).toHaveLength(2); // its body and sleeves, its skirt
    const goggles = named(real, 'real-goggles');
    const shield = named(real, 'real-shield');
    expect([goggles.length, shield.length]).toEqual([1, 1]);
    const shown = () => [
      coat[0]?.visible,
      coat[1]?.visible,
      goggles[0]?.visible,
      shield[0]?.visible,
    ];
    expect(shown()).toEqual([false, false, false, false]);
    real.wear({ body: '#ffffff', eyes: '#d9e6ee', face: '#e4f1f7', hands: '#5b7cd6' });
    expect(shown()).toEqual([true, true, true, true]);
    real.wear({ eyes: '#d9e6ee' });
    expect(shown()).toEqual([false, false, true, false]);
    // The gloves' mask: the hands' bones' share of each vertex (none here: no hand triangle).
    const skinned = real.group.getObjectByProperty('isSkinnedMesh', true) as THREE.SkinnedMesh;
    expect(skinned.geometry.getAttribute('aHand').count).toBe(9);
    // The goggles ride on the head bone, by the eyes, in front of the face (−z).
    expect(goggles[0]?.parent?.name).toBe('Bip01_Head');
  });

  it('hangs the coat skirt from eight bones the drawn skirt swings, short when seated', () => {
    const { actor, real } = made();
    const skirt = Array.from({ length: 8 }, (_, k) => real.group.getObjectByName(`RealSkirt${k}`));
    expect(skirt.every((b) => b?.parent?.name === 'Bip01_Pelvis')).toBe(true);
    actor.model.bones.skirt4.rotation.x = -0.6; // the front panel swung forward by the cloth
    real.drive(1 / 60);
    const front = new THREE.Vector3(0, -1, 0).applyQuaternion(
      (skirt[4] as THREE.Object3D).getWorldQuaternion(new THREE.Quaternion()),
    );
    expect(front.y).toBeCloseTo(-Math.cos(0.6), 2);
    expect((skirt[4] as THREE.Bone).scale.y).toBe(1); // standing: full length
    actor.model.bones.thighL.rotation.x = 1.5; // seated: the thighs forward
    actor.model.bones.thighR.rotation.x = 1.5;
    real.drive(1 / 60);
    expect((skirt[4] as THREE.Bone).scale.y).toBeLessThan(0.1);
  });

  it("keeps the player's own goggles and shield from their own eye (mirrors see them)", () => {
    const { real } = made(true);
    for (const name of ['real-goggles', 'real-shield']) {
      named(real, name)[0]?.traverse((o) =>
        expect(o.layers.isEnabled(SELF_LAYER), name).toBe(true),
      );
    }
  });
});

describe('the real people the content names', () => {
  it('each has its files in public/max/people/<id>/: the mesh, its manifest and every map it names', () => {
    const responders = bundledContent.responders as { members: unknown[] }[];
    const npcs = bundledContent.npcs as { character: unknown }[];
    const named = [
      ...(bundledContent.characters as unknown[]),
      ...responders.flatMap((squad) => squad.members),
      ...npcs.map((npc) => npc.character),
    ]
      .map((c) => CharacterDefinitionSchema.parse(c).realBody)
      .filter((id): id is string => id !== undefined);
    expect(named.length).toBeGreaterThan(0);
    for (const id of new Set(named)) {
      const dir = `public/max/people/${id}/`;
      expect(existsSync(dir + 'body.glb'), id).toBe(true);
      const manifest = JSON.parse(readFileSync(dir + 'manifest.json', 'utf8')) as {
        parts: Record<string, { normal: boolean; rough: boolean }>;
      };
      expect(Object.keys(manifest.parts), id).toContain('head');
      for (const [part, entry] of Object.entries(manifest.parts)) {
        const files = [`${part}-color.webp`];
        if (entry.normal) files.push(`${part}-normal.webp`);
        if (entry.rough) files.push(`${part}-rough.webp`);
        for (const file of files) expect(existsSync(dir + file), `${id}/${file}`).toBe(true);
      }
    }
  });
});
