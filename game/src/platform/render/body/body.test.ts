import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import type { PlayerState } from '../../../game/GameState';
import { bootTestGame, untilIdle } from '../../../game/testing';
import { bundledContent } from '../../../content';
import { CharacterDefinitionSchema } from '../../../gameplay/character';
import { holdPoint } from '../../../gameplay/interaction/hold';
import type { ItemDefinition } from '../../../gameplay/item';
import { leanTarget } from '../../../gameplay/player/lean';
import {
  type BodyShape,
  BONES,
  bodyShapeOf,
  buildBody,
  EYE_FORWARD,
  PALM_DROP,
  PALM_HALF,
  PLAIN_WEAR,
  SELF_LAYER,
  SHADOW_LAYER,
  type Surface,
  SURFACES,
} from './BodyModel';
import { BodyView, type HeldView } from './BodyView';

const materials = Object.fromEntries(
  SURFACES.map((s) => [s, new THREE.MeshStandardMaterial()]),
) as Record<Surface, THREE.MeshStandardMaterial>;
const MALE: BodyShape = {
  heightM: 1.75,
  shoulderM: 0.44,
  hipM: 0.34,
  waistM: 0.33,
  bustM: 0,
  hair: 'spiky',
  lashes: false,
  blush: false,
  neck: 'tie',
  skirt: false,
  glasses: 'none',
  beard: false,
  build: 1,
  muscle: 0,
  watch: false,
  earrings: false,
};
const FEMALE: BodyShape = {
  heightM: 1.65,
  shoulderM: 0.36,
  hipM: 0.37,
  waistM: 0.27,
  bustM: 0.025,
  hair: 'bob',
  lashes: true,
  blush: true,
  neck: 'collar',
  skirt: true,
  glasses: 'none',
  beard: false,
  build: 1,
  muscle: 0,
  watch: false,
  earrings: false,
};
const SHADOW = new THREE.MeshBasicMaterial();

const worldOf = (bone: THREE.Bone) => bone.getWorldPosition(new THREE.Vector3());
/** The model's height: the top of its bind-pose geometry (the hair's crown). */
const top = (meshes: readonly THREE.Mesh[]) =>
  Math.max(...meshes.map((m) => (m.geometry.computeBoundingBox(), m.geometry.boundingBox!.max.y)));
const vertices = (meshes: readonly THREE.Mesh[], surface: Surface) =>
  meshes
    .filter((m) => m.userData.surface === surface)
    .reduce((n, m) => n + m.geometry.getAttribute('position').count, 0);

describe('what is worn (C-10)', () => {
  /** The highest and lowest y of a surface's bind-pose geometry (null if none). */
  const span = (shape: BodyShape, surface: Surface) => {
    const box = new THREE.Box3();
    for (const m of buildBody(shape, materials, SHADOW).meshes) {
      if (m.userData.surface !== surface) continue;
      m.geometry.computeBoundingBox();
      box.union(m.geometry.boundingBox!);
    }
    return box.isEmpty() ? null : { min: box.min.y, max: box.max.y };
  };
  const wear = (w: Partial<typeof PLAIN_WEAR>) => ({ ...MALE, wear: { ...PLAIN_WEAR, ...w } });

  it('draws as before with nothing more worn', () => {
    const before = buildBody(MALE, materials, SHADOW);
    const plain = buildBody(wear({}), materials, SHADOW);
    for (const surface of ['top', 'bottom', 'shoes', 'skin'] as const) {
      expect(vertices(plain.meshes, surface)).toBe(vertices(before.meshes, surface));
    }
    expect(span(MALE, 'outer')).toBeNull();
  });

  it('shows skin where the clothes leave it: bare arms, a bare midriff, legs below shorts', () => {
    const h = MALE.heightM;
    // Long sleeves: the skin is the neck and the head's (hands are their own surface).
    expect(span(MALE, 'skin')!.min).toBeGreaterThan(0.75 * h);
    // No sleeves: the arms' skin down to the wrist.
    expect(span(wear({ sleeves: 'none' }), 'skin')!.min).toBeLessThan(0.52 * h);
    // A crop top: skin at the waist.
    const crop = buildBody(wear({ crop: true }), materials, SHADOW);
    expect(vertices(crop.meshes, 'skin')).toBeGreaterThan(
      vertices(buildBody(MALE, materials, SHADOW).meshes, 'skin'),
    );
    // Shorts: the bottom's cloth ends at the thigh; the legs bare to the shoe.
    const shorts = wear({ legs: 'shorts' });
    expect(span(shorts, 'bottom')!.min).toBeGreaterThan(0.4 * h);
    expect(span(shorts, 'skin')!.min).toBeLessThan(0.1 * h);
    // Thigh boots over them: the shoes' surface up past the knee.
    expect(
      span({ ...shorts, wear: { ...shorts.wear, footwear: 'thighBoots' } }, 'shoes')!.max,
    ).toBeGreaterThan(0.35 * h);
    // Tights instead of bare legs.
    expect(
      span({ ...shorts, wear: { ...shorts.wear, legwear: 'tights' } }, 'legwear')!.min,
    ).toBeLessThan(0.1 * h);
  });

  it('curves a curvy figure like an hourglass: the waist narrowest at the navel', () => {
    // Bare arms: the top's cloth is the torso's alone.
    const curvy: BodyShape = {
      ...FEMALE,
      skirt: false,
      hipM: 0.41,
      waistM: 0.25,
      bustM: 0.04,
      wear: { ...PLAIN_WEAR, sleeves: 'none' },
    };
    const h = curvy.heightM;
    const meshes = buildBody(curvy, materials, SHADOW).meshes;
    /** The widest |x| of a surface between two heights. */
    const width = (surface: Surface, y0: number, y1: number) => {
      let widest = 0;
      const p = new THREE.Vector3();
      for (const m of meshes) {
        if (m.userData.surface !== surface) continue;
        const position = m.geometry.getAttribute('position');
        for (let i = 0; i < position.count; i++) {
          p.fromBufferAttribute(position, i);
          if (p.y >= y0 * h && p.y <= y1 * h && Math.abs(p.x) < 0.2)
            widest = Math.max(widest, Math.abs(p.x));
        }
      }
      return widest;
    };
    const waist = width('top', 0.6, 0.625);
    expect(width('top', 0.68, 0.72)).toBeGreaterThan(waist + 0.01); // the ribs and the bust above
    expect(width('bottom', 0.5, 0.53)).toBeGreaterThan(waist + 0.05); // the hips below
    expect(width('bottom', 0.55, 0.56)).toBeLessThan(width('bottom', 0.5, 0.53)); // flaring out gradually
  });

  it('lets every character’s arms hang relaxed, close to the body (Phú: not held out)', () => {
    for (const raw of bundledContent.characters as unknown[]) {
      const c = CharacterDefinitionSchema.parse(raw);
      const { spread } = buildBody(bodyShapeOf(c.appearance), materials, SHADOW).fit;
      expect(spread.bare, c.id).toBeLessThan(0.3);
      expect(spread.coat, c.id).toBeLessThan(0.3);
    }
  });

  it('puts a jacket over the top, under the lab coat, its folds out of the outline', () => {
    const jacket = buildBody(wear({ jacket: 'zip' }), materials, SHADOW);
    const outer = span(wear({ jacket: 'zip' }), 'outer')!;
    // From the shoulders, its sleeves down to the wrists.
    expect(outer.max).toBeGreaterThan(0.82 * MALE.heightM);
    expect(outer.min).toBeGreaterThan(0.44 * MALE.heightM);
    expect(vertices(jacket.meshes, 'outerTrim')).toBeGreaterThan(0); // zip and stripes
    // The coat is wider than the jacket at the chest.
    const halfWidth = (surface: Surface) => {
      const box = new THREE.Box3();
      for (const m of jacket.meshes) {
        if (m.userData.surface !== surface) continue;
        m.geometry.computeBoundingBox();
        box.union(m.geometry.boundingBox!);
      }
      return box.max.x;
    };
    expect(halfWidth('coat')).toBeGreaterThan(halfWidth('outer'));
    // Folds are darker vertices of their cloth, never in the shadow or the outline.
    const least = (values: ArrayLike<number>) => {
      let min = Infinity;
      for (let i = 0; i < values.length; i++) min = Math.min(min, values[i]!);
      return min;
    };
    const outerMesh = jacket.meshes.find((m) => m.userData.surface === 'outer')!;
    expect(least(outerMesh.geometry.getAttribute('color').array)).toBeLessThan(1);
    expect(least(jacket.shadows.body.geometry.getAttribute('color').array)).toBe(1);
  });
});

describe('the body model (Phase H-1)', () => {
  it('stands its height, its joints at the build the character gives', () => {
    for (const shape of [MALE, FEMALE]) {
      const body = buildBody(shape, materials, SHADOW);
      const h = shape.heightM;
      expect(body.skeleton.bones.map((b) => b.name)).toEqual([...BONES]);
      // The stylised head is large: the hair's crown a little over the height.
      expect(top(body.meshes)).toBeGreaterThan(0.99 * h);
      expect(top(body.meshes)).toBeLessThan(1.08 * h);
      // Shoulders and hips apart by the build; the eye height of `eyeHeightOf` inside the head.
      const shoulders = worldOf(body.bones.upperArmR).x - worldOf(body.bones.upperArmL).x;
      expect(shoulders).toBeCloseTo(shape.shoulderM - 0.09, 6);
      const hips = worldOf(body.bones.thighR).x - worldOf(body.bones.thighL).x;
      expect(hips).toBeCloseTo(shape.hipM * 0.54, 6);
      expect(worldOf(body.bones.head).y).toBeLessThan(0.93 * h);
      expect(worldOf(body.bones.footL).y).toBeCloseTo(0.04 * h, 6);
    }
  });

  it('tells the characters apart by their data: build, height, hair, clothes', () => {
    const male = buildBody(MALE, materials, SHADOW);
    const female = buildBody(FEMALE, materials, SHADOW);
    const width = (b: typeof male, from: 'upperArm' | 'thigh') =>
      worldOf(b.bones[`${from}R`]).x - worldOf(b.bones[`${from}L`]).x;
    expect(width(male, 'upperArm')).toBeGreaterThan(width(female, 'upperArm'));
    expect(width(female, 'thigh')).toBeGreaterThan(width(male, 'thigh'));
    expect(vertices(male.meshes, 'hair')).not.toBe(vertices(female.meshes, 'hair')); // spiky, bob
    // The tie's belt, or the trimmed collar and the dress to the knee.
    expect(vertices(male.meshes, 'trim')).toBeGreaterThan(vertices(female.meshes, 'trim'));
    expect(vertices(female.meshes, 'top')).toBeGreaterThan(vertices(male.meshes, 'top'));
  });

  it('draws a build: slim or heavy-set, muscled, a curvy figure; a watch, earrings', () => {
    /** Half the widest x of a surface's bind-pose geometry (the arms hang at the sides). */
    const half = (shape: BodyShape, surface: Surface) => {
      const box = new THREE.Box3();
      for (const m of buildBody(shape, materials, SHADOW).meshes) {
        if (m.userData.surface !== surface) continue;
        m.geometry.computeBoundingBox();
        box.union(m.geometry.boundingBox!);
      }
      return box.max.x;
    };
    const slim = { ...MALE, build: 0.8 };
    const heavy = { ...MALE, build: 1.25 };
    const strong = { ...MALE, build: 1.25, muscle: 1 };
    // Arms and legs fill out with the build, and more with muscle.
    expect(half(heavy, 'top')).toBeGreaterThan(half(slim, 'top') + 0.01);
    expect(half(strong, 'top')).toBeGreaterThan(half(heavy, 'top'));
    expect(half(heavy, 'bottom')).toBeGreaterThan(half(slim, 'bottom'));
    // A curvy figure: fuller at the hips and the thighs than the same figure without the curve.
    const curvy = {
      ...FEMALE,
      skirt: false,
      neck: 'crew' as const,
      hipM: 0.41,
      waistM: 0.25,
      bustM: 0.045,
    };
    const plain = { ...curvy, hipM: 0.35, waistM: 0.29, bustM: 0.02 };
    expect(vertices(buildBody(curvy, materials, SHADOW).meshes, 'bottom')).toBe(
      vertices(buildBody(plain, materials, SHADOW).meshes, 'bottom'),
    );
    expect(half(curvy, 'bottom')).toBeGreaterThan(half(plain, 'bottom') + 0.02);
    // Small things, only when the character has them.
    const plainBody = buildBody(MALE, materials, SHADOW);
    const dressed = buildBody({ ...MALE, watch: true, earrings: true }, materials, SHADOW);
    expect(vertices(dressed.meshes, 'trim')).toBeGreaterThan(vertices(plainBody.meshes, 'trim'));
    expect(vertices(dressed.meshes, 'eyeWhite')).toBeGreaterThan(
      vertices(plainBody.meshes, 'eyeWhite'),
    );
  });

  it('hides its head and arms from the player’s own eyes; shadow-only meshes cast', () => {
    const body = buildBody(MALE, materials, SHADOW);
    const self = new Set<string>();
    const seen = new Set<string>();
    expect(body.shadows.body.castShadow && body.shadows.coat.castShadow).toBe(true);
    expect(body.shadows.body.layers.isEnabled(SHADOW_LAYER)).toBe(true);
    expect(body.shadows.body.layers.isEnabled(0)).toBe(false); // never drawn in colour
    for (const mesh of body.meshes) {
      expect(mesh.castShadow).toBe(false);
      const surface = mesh.userData.surface as Surface;
      if (mesh.layers.isEnabled(SELF_LAYER) && !mesh.layers.isEnabled(0)) self.add(surface);
      else if (mesh.layers.isEnabled(0)) seen.add(surface);
    }
    // The head and its wear: never before the player's own eyes.
    expect([...self].sort()).toEqual([
      'eyeWhite',
      'goggles',
      'hair',
      'iris',
      'mouth',
      'shield',
      'skin',
      'trim',
    ]);
    // Seen: torso, tie, belt and buckle, legs, shoes, the coat and its buttons, pen and badge, and
    // the arms and hands (they are the first-person hands).
    expect([...seen].sort()).toEqual([
      'accent',
      'bottom',
      'coat',
      'coatTrim',
      'eyeWhite',
      'hands',
      'shoes',
      'top',
      'trim',
    ]);
  });
});

describe('the body in the game', () => {
  const cleanup: (() => void)[] = [];
  afterEach(() => {
    for (const done of cleanup.splice(0)) done();
  });

  async function body(character: string) {
    const { game } = await bootTestGame();
    await game.newGame(character);
    const view = new BodyView(game);
    const subscriptions = { add: (u: () => void) => cleanup.push(u) };
    view.attach(subscriptions as never);
    cleanup.push(() => {
      view.dispose();
      game.dispose();
    });
    const meshes = () => {
      const out: THREE.SkinnedMesh[] = [];
      view.group.traverse((o) => {
        if ((o as Partial<THREE.SkinnedMesh>).isSkinnedMesh) out.push(o as THREE.SkinnedMesh);
      });
      return out;
    };
    return { game, view, meshes };
  }

  it('wears what the player wears: the coat only while it is worn', async () => {
    const { game, view, meshes } = await body('researcher-female');
    const coat = () => meshes().filter((m) => m.userData.surface === 'coat');
    // A change shows on the next frame (or at the `swap` of an action acted out).
    const frame = () => {
      const { camera, hands } = eye(game, [0, 0, 0]);
      view.update(1 / 60, [0, 0, 0], camera, hands, false);
    };
    expect(coat().length).toBeGreaterThan(0);
    if (game.equipment.isWearing('lab-coat')) game.equipment.remove('lab-coat');
    frame();
    expect(coat().every((m) => !m.visible)).toBe(true);
    game.equipment.wear('lab-coat');
    frame();
    expect(coat().every((m) => m.visible)).toBe(true);
  });

  /** A camera at the eye and the drawn hands' rest poses under it (HandsView's). */
  function eye(game: { state: { player: { yaw: number; pitch: number } } }, feet: number[]) {
    const camera = new THREE.PerspectiveCamera();
    camera.rotation.order = 'YXZ';
    camera.position.set(feet[0] ?? 0, 1.75 * 0.93, feet[2] ?? 0);
    camera.rotation.set(game.state.player.pitch, game.state.player.yaw, 0);
    const hands = [new THREE.Object3D(), new THREE.Object3D()] as const;
    hands[0].position.set(-0.2, -0.25, -0.42);
    hands[1].position.set(0.2, -0.25, -0.42);
    camera.add(...hands);
    return { camera, hands };
  }

  it('stands behind the eye at the feet, turned to the view, and steps when it moves', async () => {
    const { game, view, meshes } = await body('researcher-male');
    const at = (feet: [number, number, number]) => {
      const { camera, hands } = eye(game, feet);
      game.state.player.position.splice(0, 3, ...feet); // the walk is the player's (GaitSystem)
      game.gait.update(1 / 60);
      view.update(1 / 60, feet, camera, hands, false);
    };
    expect(meshes().length).toBeGreaterThan(0);
    game.state.player.yaw = Math.PI / 2; // facing −x
    at([1, 0, 2]);
    expect(view.group.visible).toBe(true);
    expect(view.group.position.x).toBeCloseTo(1 + EYE_FORWARD, 6); // behind: +x
    expect(view.group.position.z).toBeCloseTo(2, 6);
    const thigh = () => {
      let rx = 0;
      view.group.traverse((o) => {
        if (o.name === 'thighL') rx = o.rotation.x;
      });
      return rx;
    };
    for (let i = 1; i <= 30; i++) at([1 - (2.2 * i) / 60, 0, 2]);
    expect(Math.abs(thigh())).toBeGreaterThan(0.05); // walking: the legs swing
    for (let i = 0; i < 120; i++) at([0, 0, 2]);
    expect(Math.abs(thigh())).toBeLessThan(0.01); // standing still
  });

  it('acting out a motion, reaches the drawn hands: each wrist where its hand is, any view', async () => {
    const { game, view } = await body('researcher-female');
    for (const [yaw, pitch] of [
      [0, 0],
      [Math.PI / 2, -0.5],
      [-2, 0.3],
    ] as const) {
      Object.assign(game.state.player, { yaw, pitch });
      const { camera, hands } = eye(game, [0.5, 0, -1]);
      for (let f = 0; f < 60; f++) view.update(1 / 60, [0.5, 0, -1], camera, hands, true);
      for (const [i, name] of [
        [0, 'handL'],
        [1, 'handR'],
      ] as const) {
        const want = new THREE.Vector3(0, 0, 0.07).applyMatrix4(hands[i].matrixWorld);
        const wrist = view.group.getObjectByName(name)!.getWorldPosition(new THREE.Vector3());
        expect(wrist.distanceTo(want), `${name} at yaw ${yaw}`).toBeLessThan(0.002);
      }
    }
  });

  it('lets idle hands hang; they come up as the player looks down at them', async () => {
    const { game, view } = await body('researcher-male');
    const wristY = () =>
      view.group.getObjectByName('handR')!.getWorldPosition(new THREE.Vector3()).y;
    const settle = (pitch: number) => {
      game.state.player.pitch = pitch;
      const { camera, hands } = eye(game, [0, 0, 0]);
      for (let f = 0; f < 90; f++) view.update(1 / 60, [0, 0, 0], camera, hands, false);
      return wristY();
    };
    // Looking ahead: the wrists by the hips (0.48 of the height), not up in view.
    expect(settle(0)).toBeLessThan(0.55 * 1.75);
    // Looking down at them: up before the waist (0.13 out, 0.57 of the height, 0.3 ahead).
    settle(-0.9);
    const want = new THREE.Vector3(0.13, 0.57 * 1.75, -0.3).applyMatrix4(view.group.matrixWorld);
    const wrist = view.group.getObjectByName('handR')!.getWorldPosition(new THREE.Vector3());
    expect(wrist.distanceTo(want)).toBeLessThan(0.01);
  });

  /** An upright item of `size` (m) with `grip`, held where the hold puts it (H-2). */
  function held(
    game: { state: { player: PlayerState }; config: { player: { holdDistance: number } } },
    size: [number, number, number],
    grip?: ItemDefinition['grip'],
  ): HeldView {
    const group = new THREE.Object3D();
    game.state.player.position = [0, 0, 0]; // where the body stands in these tests
    group.position.fromArray(
      holdPoint(game.state.player, game.config.player.holdDistance, [0, 0, 0]),
    );
    group.rotation.y = game.state.player.yaw + 0.3; // its own heading, as it was grabbed
    const item = { grip, physical: { handling: 'upright' }, visual: { size } } as ItemDefinition;
    return { group, entity: { item } };
  }
  const bone = (view: BodyView, name: string) => view.group.getObjectByName(name)!;
  /** The palm's centre (world): PALM_DROP down the hand from its wrist. */
  const palm = (view: BodyView, side: 'L' | 'R') => {
    const hand = bone(view, `hand${side}`);
    hand.updateWorldMatrix(true, false); // as drawing does
    return new THREE.Vector3(0, -PALM_DROP, 0).applyMatrix4(hand.matrixWorld);
  };
  /**
   * Where `p` is from the upright axis through `object`, across the view at `yaw` (+ right) and
   * along it (+ ahead).
   */
  const fromAxis = (p: THREE.Vector3, object: THREE.Object3D, yaw: number) => {
    const dx = p.x - object.position.x;
    const dz = p.z - object.position.z;
    return {
      across: dx * Math.cos(yaw) - dz * Math.sin(yaw),
      ahead: -dx * Math.sin(yaw) - dz * Math.cos(yaw),
    };
  };
  /** The axis lies in the fingers' roots: the palm's centre this far behind it (BodyView). */
  const GRIP_AHEAD = 0.03;

  it('holds what is held in the right hand, the palm against it and the fingers round it', async () => {
    const { game, view } = await body('researcher-male');
    for (const [yaw, pitch] of [
      [0.4, -0.3],
      [-2, 0],
      [1, -0.8],
    ] as const) {
      // Holding it, the player stoops as they look down (PlayerSystem eases to this).
      const lean = leanTarget(pitch, game.config.player.holdDistance, {
        working: false,
        holding: true,
      });
      Object.assign(game.state.player, { yaw, pitch, lean });
      const { camera, hands } = eye(game, [0, 0, 0]);
      const bottle = held(game, [0.07, 0.14, 0.07]);
      for (let f = 0; f < 60; f++) view.update(1 / 60, [0, 0, 0], camera, hands, false, bottle);
      const p = palm(view, 'R');
      // Across from its axis by its radius and the palm's half thickness, on the view's right;
      // a little behind it (the axis in the fingers' roots).
      const { across, ahead } = fromAxis(p, bottle.group, yaw);
      expect(across, `yaw ${yaw}`).toBeCloseTo(0.035 + PALM_HALF, 2);
      expect(ahead, `yaw ${yaw}`).toBeCloseTo(-GRIP_AHEAD, 2);
      // The fingers round it: the first piece of each (0.037 m) a chord of the circle 8.5 mm out
      // from its surface; the free left hand hangs by the hip.
      const chord = Math.asin(0.037 / (2 * (0.035 + 0.0085)));
      expect(Math.abs(bone(view, 'indexR1').rotation.z)).toBeCloseTo(chord, 3);
      expect(Math.abs(bone(view, 'indexR2').rotation.z)).toBeCloseTo(2 * chord, 3);
      expect(palm(view, 'L').y).toBeLessThan(0.5 * 1.75);
    }
  });

  it('holds a long item in both hands where its grip says, a thin one pinched', async () => {
    const { game, view } = await body('researcher-female');
    Object.assign(game.state.player, { yaw: 0, pitch: -0.4 });
    const { camera, hands } = eye(game, [0, 0, 0]);
    const burette = held(game, [0.05, 0.6, 0.05], {
      at: [0, 0.12, 0],
      other: [0, -0.1, 0],
      radius: 0.009,
      pose: 'wrap',
    });
    for (let f = 0; f < 60; f++) view.update(1 / 60, [0, 0, 0], camera, hands, false, burette);
    const [l, r] = [palm(view, 'L'), palm(view, 'R')];
    // The right hand on its right, the left on its left, the right one higher up it.
    expect(fromAxis(r, burette.group, 0).across).toBeCloseTo(0.009 + PALM_HALF, 2);
    expect(fromAxis(l, burette.group, 0).across).toBeCloseTo(-0.009 - PALM_HALF, 2);
    expect(r.y - l.y).toBeCloseTo(0.22, 2);

    const pipette = held(game, [0.02, 0.35, 0.02], {
      at: [0, 0.11, 0],
      radius: 0.004,
      pose: 'pinch',
    });
    for (let f = 0; f < 60; f++) view.update(1 / 60, [0, 0, 0], camera, hands, false, pipette);
    expect(fromAxis(palm(view, 'R'), pipette.group, 0).across).toBeCloseTo(0.004 + PALM_HALF, 2);
    expect(Math.abs(bone(view, 'littleR1').rotation.z)).toBeGreaterThan(1.1); // tucked in
    expect(Math.abs(bone(view, 'indexR1').rotation.z)).toBeLessThan(0.7);
  });

  it('bows and crouches to the lean, the feet staying on the floor', async () => {
    const { game, view } = await body('researcher-male');
    Object.assign(game.state.player, { yaw: 0.5, pitch: -0.87, lean: 0.3 });
    const { camera, hands } = eye(game, [0, 0, 0]);
    for (let f = 0; f < 10; f++) view.update(1 / 60, [0, 0, 0], camera, hands, false);
    expect(bone(view, 'spine').rotation.x).toBeLessThan(-0.1); // bent forward
    expect(view.group.position.y).toBeLessThan(-0.01); // the knees give
    for (const side of ['L', 'R']) {
      const ankle = bone(view, `foot${side}`).getWorldPosition(new THREE.Vector3());
      expect(ankle.y, side).toBeCloseTo(0.04 * 1.75, 3);
    }
    // The head comes forward with the lean's reach (0.3·cos 0.87 ≈ 0.19 m at the eye; the head's
    // joint is lower, nearer the bend): from EYE_FORWARD behind the feet to in front of them.
    const head = bone(view, 'head').getWorldPosition(new THREE.Vector3());
    const ahead = -(head.x * Math.sin(0.5) + head.z * Math.cos(0.5));
    expect(ahead + EYE_FORWARD).toBeGreaterThan(0.14);
    // Upright again (Phú's mirror: legs left turned into the coat after a crouch): straight legs.
    game.state.player.lean = 0;
    for (let f = 0; f < 10; f++) view.update(1 / 60, [0, 0, 0], camera, hands, false);
    for (const side of ['L', 'R']) {
      const thigh = bone(view, `thigh${side}`);
      const shin = bone(view, `shin${side}`);
      expect(thigh.quaternion.angleTo(new THREE.Quaternion()), side).toBeLessThan(1e-6);
      expect(shin.quaternion.angleTo(new THREE.Quaternion()), side).toBeLessThan(1e-6);
      const ankle = bone(view, `foot${side}`).getWorldPosition(new THREE.Vector3());
      expect(ankle.y, side).toBeCloseTo(0.04 * 1.75, 3);
    }
  });
});

describe('the body acting out an action (Phase H-3)', () => {
  it('takes the coat off: worn until the swap, carried in the right hand, then gone from it', async () => {
    const { game } = await bootTestGame();
    await game.newGame('researcher-male');
    const PREP = 'preparation-room';
    expect(game.interaction.perform(`${PREP}/notice-board`, 'inspect')).toBe(true);
    expect(game.interaction.perform(`${PREP}/wardrobe`, 'open')).toBe(true);
    untilIdle(game);
    expect(game.interaction.perform(`${PREP}/lab-coat`, 'wear')).toBe(true);
    untilIdle(game);
    const view = new BodyView(game);
    view.attach({ add: () => undefined } as never);
    const camera = new THREE.PerspectiveCamera();
    const hands = [new THREE.Object3D(), new THREE.Object3D()] as const;
    camera.add(...hands);
    const coatShown = () => {
      let shown = false;
      view.group.traverse((o) => {
        if (o.userData.surface === 'coat' && o.visible) shown = true;
      });
      return shown;
    };
    const carried = () => {
      let box: THREE.Object3D | undefined;
      view.group.getObjectByName('handR')!.traverse((o) => {
        // The carried box (the foam on the palm is spheres).
        if ((o as THREE.Mesh).geometry instanceof THREE.BoxGeometry) box = o;
      });
      return box?.visible === true;
    };
    const frames = (seconds: number) => {
      for (let t = 0; t < seconds - 1e-9; t += 1 / 60) {
        game.update(1 / 60);
        view.update(1 / 60, game.state.player.position, camera, hands, false);
      }
    };
    frames(0.1);
    expect(coatShown()).toBe(true);
    expect(game.interaction.perform(`${PREP}/lab-coat`, 'take-off')).toBe(true);
    frames(0.5); // before the swap (1.08 s): still worn, as the hands go to its lapels
    expect(game.equipment.isWearing('lab-coat')).toBe(false); // the rules saw it at once
    expect(coatShown()).toBe(true);
    expect(carried()).toBe(false);
    frames(0.8); // 1.3 s: off the body, in the hand
    expect(coatShown()).toBe(false);
    expect(carried()).toBe(true);
    frames(0.9); // 2.2 s: hung up
    expect(carried()).toBe(false);
    view.dispose();
    game.dispose();
  });
});

describe('soap foam on the hands (Phú: no white blocks at the bottom of the view)', () => {
  it('shows the foam on the body’s own palms only while the hands are soapy', async () => {
    const { game } = await bootTestGame();
    await game.newGame('researcher-female');
    const view = new BodyView(game);
    view.attach({ add: () => undefined } as never);
    const camera = new THREE.PerspectiveCamera();
    const hands = [new THREE.Object3D(), new THREE.Object3D()] as const;
    camera.add(...hands);
    const foamOn = (side: 'L' | 'R') => {
      let shown = false;
      view.group.getObjectByName(`hand${side}`)!.traverse((o) => {
        if ((o as THREE.Mesh).geometry instanceof THREE.SphereGeometry && o.parent?.visible)
          shown = true;
      });
      return shown;
    };
    view.update(1 / 60, game.state.player.position, camera, hands, false);
    expect([foamOn('L'), foamOn('R')]).toEqual([false, false]);
    view.foamy = true;
    view.update(1 / 60, game.state.player.position, camera, hands, false);
    expect([foamOn('L'), foamOn('R')]).toEqual([true, true]);
    view.dispose();
    game.dispose();
  });
});
