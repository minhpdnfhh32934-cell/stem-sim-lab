import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Game } from '../../game/Game';
import { bootTestGame } from '../../game/testing';
import type { SceneDefinition } from '../../world/definitions';
import { LIGHT_SLOTS } from '../../world/lighting';
import { warmBatch, warmEnd, WorldRenderer } from './WorldRenderer';

// Characterization: the lights setLighting gives each world scene — since phase UX2 each room's own
// lights under its fixtures (world/lighting.ts) in a fixed pool, no sun — and the graphics
// presets. It reads private members on purpose and needs no WebGL (init() is never called). A
// change to any value here must be made deliberately.

type WorldScene = Extract<SceneDefinition, { kind: 'world' }>;

/** The private parts of WorldRenderer read here. */
interface Lights {
  setLighting(mode: WorldScene['lighting']): void;
  readonly sun: THREE.DirectionalLight;
  readonly fill: THREE.DirectionalLight;
  readonly hemisphere: THREE.HemisphereLight;
  readonly roomLights: { readonly slots: readonly THREE.SpotLight[] };
}

let game: Game;
const renderers: WorldRenderer[] = [];

beforeEach(async () => {
  ({ game } = await bootTestGame());
});

afterEach(() => {
  for (const renderer of renderers.splice(0)) renderer.dispose();
  game.dispose();
});

/** A fresh renderer's lights. */
function lights(): Lights {
  const renderer = new WorldRenderer({} as HTMLElement, game, {} as HTMLCanvasElement);
  renderers.push(renderer);
  return renderer as unknown as Lights;
}

const worldScenes = () =>
  game.content.scenes.all().filter((s): s is WorldScene => s.kind === 'world');

function scene(id: string): WorldScene {
  const found = worldScenes().find((s) => s.id === id);
  if (!found) throw new Error(`no world scene ${id}`);
  return found;
}

/** A world scene's load, as far as lights go: SceneManager sets its rooms, SceneLoaded lights it. */
function load(lit: Lights, world: WorldScene): void {
  game.world.setRooms(world.rooms.map((id) => game.content.rooms.get(id)));
  lit.setLighting(world.lighting);
}

/** The lit slots: where each stands, what it aims at, whether it casts. */
const lit = ({ roomLights }: Lights) =>
  roomLights.slots
    .filter((s) => s.intensity > 0)
    .map((s) => ({
      at: s.position.toArray().map((v) => +v.toFixed(3)),
      to: s.target.position.toArray().map((v) => +v.toFixed(3)),
      casts: s.castShadow,
    }));

describe('WorldRenderer lighting (characterization)', () => {
  it('physics-lab (enhanced): no sun; a key with shadows and a fill under each room’s fixtures', () => {
    expect(game.graphicsQuality).toBe('medium');
    const view = lights();
    load(view, scene('physics-lab'));
    expect(view.sun.visible).toBe(false);
    expect(view.fill.visible).toBe(false);
    // Keys first (the lab, the range, the bay), then the fills; each 2 cm under its fixture,
    // shining straight down to the floor. Phase T-1a: the lab 18 m long and 4 m high (24 × 5 since U-2), its key at
    // its middle; the bay's fill gone (the budget), the dark optics room lit by its one fill; the
    // teacher's corner lit (a fill over its bench, one over its cabinets).
    expect(lit(view)).toEqual([
      { at: [7, 4.92, 0], to: [7, 0, 0], casts: true }, // Phase U-2: the lab 24 × 15 × 5 m
      { at: [6, 5.92, 11.75], to: [6, 0, 11.75], casts: true },
      { at: [0, 4.42, -11.75], to: [0, 0, -11.75], casts: true }, // the bay's key over its middle
      { at: [0.333, 4.92, 0], to: [0.333, 0, 0], casts: false },
      { at: [13.667, 4.92, 0], to: [13.667, 0, 0], casts: false },
      { at: [-2.333, 4.92, -4.474], to: [-2.333, 0, -4.474], casts: false }, // the teacher's bench
      { at: [-2.333, 4.92, 4.211], to: [-2.333, 0, 4.211], casts: false }, // its cabinets
      { at: [18, 5.92, 11.75], to: [18, 0, 11.75], casts: false },
      { at: [24.25, 3.42, -2.2], to: [24.25, 0, -2.2], casts: false },
    ]);
    expect(view.roomLights.slots).toHaveLength(LIGHT_SLOTS.key + LIGHT_SLOTS.other);
    // Lighting polish: the labs' keys fade over 0.25 of their cone (the content's), the fills 0.6.
    const on = view.roomLights.slots.filter((s) => s.intensity > 0);
    expect(on.map((s) => s.penumbra)).toEqual([0.25, 0.25, 0.25, ...Array<number>(6).fill(0.6)]);
    // Shadow casters: the three keys only, as before.
    expect(on.filter((s) => s.castShadow)).toHaveLength(3);
  });

  it('every world scene shares the lighting of the scenes its doors join: all enhanced', () => {
    expect(worldScenes().map((s) => s.lighting)).toEqual(worldScenes().map(() => 'enhanced'));
  });

  it('every room of every world scene has its key light (a dark room none); nothing is lit from outside', () => {
    for (const world of worldScenes()) {
      const view = lights();
      load(view, world);
      const keys = lit(view).filter((l) => l.casts);
      const dark = world.rooms.filter((id) => game.content.rooms.get(id).dark).length;
      expect(keys, world.id).toHaveLength(world.rooms.length - dark);
      expect(view.sun.visible, world.id).toBe(false);
    }
  });

  it('the basic preset: the sun as before, no shadows, the room lights hidden', () => {
    const view = lights();
    load(view, { ...scene('preparation-room'), lighting: 'basic' });
    expect(view.sun.visible).toBe(true);
    expect(view.sun.castShadow).toBe(false);
    expect(view.sun.position.toArray()).toEqual([3, 6, 2]);
    expect(view.roomLights.slots.every((s) => !s.visible && s.intensity === 0)).toBe(true);
  });

  it.each([
    ['medium', 0.408], // 0.8 − 4.9 × 0.08: the hemisphere gives way to the room light
  ] as const)(
    'physics-lab at %s quality: room lights, three key shadows, hemisphere %s',
    (quality, sky) => {
      game.setGraphicsQuality(quality);
      const view = lights();
      load(view, scene('physics-lab'));
      expect(lit(view).filter((l) => l.casts)).toHaveLength(3);
      expect(view.sun.visible).toBe(false);
      expect(view.hemisphere.intensity).toBeCloseTo(sky, 6);
    },
  );

  it('physics-lab at low quality: one light, the sun and fill fitted to its rooms, no shadows', () => {
    game.setGraphicsQuality('low');
    const view = lights();
    load(view, scene('physics-lab'));
    expect(lit(view)).toEqual([]);
    expect(view.sun.visible).toBe(true);
    expect(view.sun.castShadow).toBe(false);
    // Fitted to the wing of Phase U-2 (x −5 … 29.25).
    expect(view.sun.position.toArray()).toEqual([21.125, 22, 6]);
    expect(view.sun.target.position.toArray()).toEqual([12.125, 0, 0]);
    expect(view.fill.visible).toBe(true);
    expect(view.fill.position.toArray()).toEqual([2.125, 6, -8]);
    expect(view.hemisphere.intensity).toBe(1.25);
  });

  it('each key light’s cone reaches every corner of its room’s floor', () => {
    for (const world of worldScenes()) {
      const view = lights();
      load(view, world);
      const keys = view.roomLights.slots.filter((s) => s.intensity > 0 && s.castShadow);
      for (const id of world.rooms) {
        if (game.content.rooms.get(id).dark) continue; // lit by its fill only
        const { min, max } = game.content.rooms.get(id).bounds;
        const key = keys.find((s) => {
          const { x, z } = s.position;
          return x >= min[0] && x <= max[0] && z >= min[2] && z <= max[2];
        });
        expect(key, id).toBeDefined();
        const apex = key!.position;
        const axis = key!.target.position.clone().sub(apex).normalize();
        for (const x of [min[0], max[0]]) {
          for (const z of [min[2], max[2]]) {
            const corner = new THREE.Vector3(x, min[1], z).sub(apex).normalize();
            expect(Math.acos(corner.dot(axis)), `${id} (${x}, ${z})`).toBeLessThanOrEqual(
              key!.angle + 1e-6,
            );
          }
        }
      }
    }
  });
});

describe('the PPE cabinet’s hinged doors', () => {
  /** The private parts of WorldRenderer read here. */
  interface Doors {
    addEntity(entity: unknown): void;
    turnLeaves(view: unknown): void;
    readonly views: Map<
      string,
      { mesh: THREE.Mesh; leaves: { pivot: THREE.Object3D; opens: number }[] }
    >;
  }
  const CABINET = 'preparation-room/wardrobe';
  const degrees = (view: Doors['views'] extends Map<string, infer V> ? V : never) =>
    view.leaves.map((l) => +(l.pivot.rotation.y / (Math.PI / 180)).toFixed(3) + 0); // no −0

  it('draws its leaves turned as far as the hinge system has swung them, the cabinet still', async () => {
    // UX3.1: the swing is gameplay's (HingeSystem, eased), physics turns the leaf bodies alike;
    // the renderer only draws it.
    await game.newGame('researcher-male');
    const renderer = new WorldRenderer({} as HTMLElement, game, {} as HTMLCanvasElement);
    renderers.push(renderer);
    const doors = renderer as unknown as Doors;
    doors.addEntity(game.world.entity(CABINET));
    const view = doors.views.get(CABINET)!;
    expect(view.leaves.map((l) => l.pivot.position.x)).toEqual([-0.6, 0.6]); // at its sides
    expect(degrees(view)).toEqual([0, 0]);

    game.entityStates.set(CABINET, 'open', true);
    for (let i = 0; i < 15; i++) game.update(1 / 60); // half its 0.5 s swing
    expect(game.hinges.fraction(CABINET)).toBeCloseTo(0.5, 9);
    doors.turnLeaves(view);
    expect(degrees(view)).toEqual([-55, 55]); // smoothstep(0.5): half of 110°, both outwards
    for (let i = 0; i < 15; i++) game.update(1 / 60);
    doors.turnLeaves(view);
    expect(degrees(view)).toEqual([-110, 110]);
    expect(view.mesh.position.toArray()).toEqual([0, 0, 0]);
  });

  it('are drawn open at once when the cabinet was left open (a save)', async () => {
    await game.newGame('researcher-male');
    game.entityStates.set(CABINET, 'open', true);
    await game.scenes.load('simlab-hub');
    await game.scenes.load('preparation-room'); // spawned open: the hinge system starts at 1
    const renderer = new WorldRenderer({} as HTMLElement, game, {} as HTMLCanvasElement);
    renderers.push(renderer);
    const doors = renderer as unknown as Doors;
    doors.addEntity(game.world.entity(CABINET));
    expect(degrees(doors.views.get(CABINET)!)).toEqual([-110, 110]);
  });
});

describe('entity paints', () => {
  /** The private parts of WorldRenderer read here. */
  interface Paints {
    addEntity(entity: unknown): void;
    removeEntity(entityId: string): void;
    refresh(entityId: string): void;
    focusedId: string | null;
    readonly views: Map<
      string,
      { mesh: THREE.Mesh; group: THREE.Group; shared: THREE.Material | null }
    >;
  }
  /** The materials of `group`'s meshes. */
  const materialsOf = (group: THREE.Object3D) => {
    const out = new Set<THREE.Material>();
    group.traverse((o) => {
      const m = (o as Partial<THREE.Mesh>).material;
      if (m && !Array.isArray(m)) out.add(m);
    });
    return out;
  };

  /** How many of `group`'s meshes wear `material`. */
  const paintedBy = (group: THREE.Object3D, material: THREE.Material | null) => {
    let n = 0;
    group.traverse((o) => {
      if ((o as Partial<THREE.Mesh>).material === material) n++;
    });
    return n;
  };

  it('one material per look and colour, a copy of its own while focused or charred, then shared again', async () => {
    await game.newGame('researcher-male');
    await game.scenes.load('physics-lab');
    const renderer = new WorldRenderer({} as HTMLElement, game, {} as HTMLCanvasElement);
    renderers.push(renderer);
    const paints = renderer as unknown as Paints;
    // Without a DOM: no entity that draws a canvas (screens, labels, rulers on the rigs).
    for (const entity of game.world.allEntities()) {
      const { item } = entity;
      if (item.visual.screen || item.visual.label || item.pendulum || item.dropTower) continue;
      if (item.springStand || item.bench) continue;
      paints.addEntity(entity);
    }
    const views = [...paints.views.entries()];
    const shared = views.filter(([, v]) => v.shared);
    const distinct = new Set(shared.map(([, v]) => v.mesh.material));
    expect(shared.length).toBeGreaterThan(distinct.size * 2); // most entities share their paint
    // A rig (its frame's parts painted with the body's material) that shares it with another.
    const [id, view] =
      shared.find(
        ([, v]) =>
          paintedBy(v.group, v.shared) > 1 &&
          shared.some(([, w]) => w !== v && w.shared === v.shared),
      ) ?? [];
    if (!id || !view?.shared) throw new Error('no shared entity with parts');
    const parts = paintedBy(view.group, view.shared);
    const other = shared.find(([k, v]) => k !== id && v.shared === view.shared)?.[1];

    paints.focusedId = id;
    paints.refresh(id);
    const copy = view.mesh.material as THREE.MeshStandardMaterial;
    expect(copy).not.toBe(view.shared);
    expect(paintedBy(view.group, copy)).toBe(parts); // every painted part: the copy
    expect(copy.emissive.getHexString()).toBe('2a3440'); // the focus glow on the copy only
    expect((view.shared as THREE.MeshStandardMaterial).emissive.getHexString()).toBe('000000');
    expect(other?.mesh.material).toBe(view.shared);

    let disposed = false;
    copy.addEventListener('dispose', () => (disposed = true));
    paints.focusedId = null;
    paints.refresh(id);
    expect(view.mesh.material).toBe(view.shared);
    expect(materialsOf(view.group).has(copy)).toBe(false);
    expect(disposed).toBe(true);

    game.entityStates.set(id, 'charred', true);
    paints.refresh(id);
    const sooty = view.mesh.material as THREE.MeshStandardMaterial;
    expect(sooty).not.toBe(view.shared);
    expect(sooty.color.r).toBeCloseTo((view.shared as THREE.MeshStandardMaterial).color.r * 0.2, 6);
    game.entityStates.set(id, 'charred', false);
    paints.refresh(id);
    expect(view.mesh.material).toBe(view.shared);

    // Freed with its last owner.
    let freed = false;
    view.shared.addEventListener('dispose', () => (freed = true));
    for (const [k, v] of views) if (v.shared === view.shared && k !== id) paints.removeEntity(k);
    expect(freed).toBe(false);
    paints.removeEntity(id);
    expect(freed).toBe(true);
  });
});

describe('the warm-up before a door opens', () => {
  it('draws fewer a frame after slow frames, but only for a second: then more, whatever the frames', () => {
    const usual = 0.06; // ~17 FPS before the scene behind came
    expect(warmBatch(8, 0.1, usual, 0.1)).toBe(4); // a slow frame: fewer
    expect(warmBatch(1, 0.1, usual, 0.9)).toBe(1);
    expect(warmBatch(8, 0.08, usual, 0.2)).toBe(8); // a little over the usual: as many
    expect(warmBatch(4, 0.05, usual, 0.2)).toBe(8); // quick: more
    // Frames slow anyway (SwiftShader ~9 FPS): past a second it grows to the most a frame.
    let batch = 1;
    let drawn = 0;
    let elapsed = 1;
    for (let frame = 0; drawn < 121; frame++) {
      elapsed += 0.1;
      batch = warmBatch(batch, 0.1, usual, elapsed);
      drawn += batch;
      expect(frame).toBeLessThan(8); // 121 objects in a few frames, not 121
    }
    expect(batch).toBe(40);
  });

  it('uploads at most 8 MB of new textures a frame, but always draws one', () => {
    const objects = [3, 4, 2, 9, 0, 0, 1].map((mb) => Object.assign(new THREE.Object3D(), { mb }));
    const bytes = (o: THREE.Object3D) => (o as THREE.Object3D & { mb: number }).mb * 1e6;
    expect(warmEnd(objects, 0, 40, bytes)).toBe(2); // 3 + 4; with 2 more it is 9
    expect(warmEnd(objects, 2, 40, bytes)).toBe(3); // 2, then 9 is over
    expect(warmEnd(objects, 3, 40, bytes)).toBe(4); // 9 alone: still drawn
    expect(warmEnd(objects, 4, 2, bytes)).toBe(6); // the batch's count still holds
    expect(warmEnd(objects, 6, 40, bytes)).toBe(7);
  });
});
