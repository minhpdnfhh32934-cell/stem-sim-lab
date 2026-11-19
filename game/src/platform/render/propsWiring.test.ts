import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bundledContent } from '../../content';
import type { Disposables } from '../../core/EventBus';
import { Registry } from '../../core/Registry';
import { formatIssues } from '../../core/schema';
import { buildContent, ContentError, type RawContent } from '../../game/content';
import type { Game } from '../../game/Game';
import { bootTestGame } from '../../game/testing';
import { BUILT_IN_BEHAVIORS } from '../../gameplay/interaction/behaviors';
import { type ItemDefinition, ItemDefinitionSchema } from '../../gameplay/item';
import { BUILT_IN_MODELS } from '../../simulation/models';
import type { WorldEntity } from '../../world/World';
import type { ControlShapes } from './consoleModel';
import { DecorBatches } from './decorBatches';
import type { Palette } from './palette';
import { castsShadow, partMaterial, type PropCache, type PropPart } from './props';
import { WorldRenderer } from './WorldRenderer';

// Props and decor in the renderer, without WebGL (init() is never called; what it follows is
// followed here, through the renderer's own subscriptions): decor drawn in instanced batches per
// scene, built and freed with its scene; items with a prop drawn as their body with the prop's
// parts; everything else as before. Reads private members on purpose, as WorldRenderer.test.ts.
// The fixture is the bundled content plus a few items of the hub's props.

const DECOR = ['decor'];
const ITEMS = [
  {
    id: 'test-column',
    displayName: 'Column',
    category: 'structure',
    tags: DECOR,
    physical: { massKg: 900, body: 'none' },
    visual: {
      shape: 'cylinder',
      size: [0.7, 9, 0.7],
      color: '#e6e9eb',
      material: 'satin',
      prop: 'column',
    },
  },
  {
    id: 'test-planter',
    displayName: 'Planter',
    category: 'furniture',
    tags: DECOR,
    physical: { massKg: 60, body: 'none' },
    visual: { shape: 'cylinder', size: [1, 1.4, 1], color: '#5c6b5e', prop: 'planter' },
  },
  {
    // Decor without a prop: its primitive is the one part (lit, so it never casts).
    id: 'test-light-panel',
    displayName: 'Ceiling light',
    category: 'structure',
    tags: DECOR,
    physical: { massKg: 5, body: 'none' },
    visual: { shape: 'box', size: [2.4, 0.08, 0.8], color: '#f6f2e6', material: 'light' },
  },
  {
    // A prop on an item one interacts with: its own view, the prop's parts on it.
    id: 'test-reception',
    displayName: 'Reception desk',
    category: 'furniture',
    physical: { massKg: 200, body: 'static' },
    interactions: ['inspect'],
    visual: {
      shape: 'box',
      size: [2.2, 1.1, 0.8],
      color: '#1f3b57',
      material: 'satin',
      prop: 'reception-desk',
    },
  },
  {
    // Decor with a label: not batched (DecorBatches.accepts), drawn with its own view.
    id: 'test-wordmark',
    displayName: 'Sign',
    category: 'structure',
    tags: DECOR,
    physical: { massKg: 5, body: 'none' },
    visual: { shape: 'box', size: [6, 1.4, 0.04], color: '#16202a', label: { text: 'SIMLAB' } },
  },
];
const at = (id: string, item: string, position: number[], rotationY = 0) => ({
  id,
  item,
  position,
  rotationY,
});
const PLACED: Record<string, object[]> = {
  'preparation-room': [at('test-panel', 'test-light-panel', [0, 2.9, -1])],
  'simlab-hub': [
    at('test-column-1', 'test-column', [-8, 0, -6]),
    at('test-column-2', 'test-column', [8, 0, -6]),
    at('test-column-3', 'test-column', [-8, 0, 2], Math.PI / 2),
    at('test-planter-1', 'test-planter', [-4, 0, 3]),
    at('test-planter-2', 'test-planter', [4, 0, 3], 0.4),
    at('test-panel-1', 'test-light-panel', [-3, 8.9, -3]),
    at('test-panel-2', 'test-light-panel', [3, 8.9, -3]),
    at('test-reception', 'test-reception', [0, 0, -4]),
    at('test-wordmark', 'test-wordmark', [0, 6, -11.95]),
  ],
  'biology-lab': [
    at('test-planter-1', 'test-planter', [2, 0, 3]),
    at('test-planter-2', 'test-planter', [-3, 0, 3]),
    at('test-panel', 'test-light-panel', [0, 3.4, 0]),
  ],
};

function fixture(): RawContent {
  const content = structuredClone(bundledContent);
  const raw = content as unknown as {
    items: object[];
    rooms: { id: string; placements: object[] }[];
  };
  // Only the test- items batch: the shipped decor is drawn as plain views here.
  for (const item of raw.items as { tags?: string[] }[])
    if (item.tags) item.tags = item.tags.filter((tag) => tag !== 'decor');
  raw.items.push(...ITEMS);
  for (const room of raw.rooms) room.placements.push(...(PLACED[room.id] ?? []));
  return content;
}

type StandardMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;

/** The private parts of WorldRenderer used here. */
interface Wiring {
  readonly subscriptions: Disposables;
  followScenes(s: Disposables): void;
  followEntities(s: Disposables): void;
  partsOf(item: ItemDefinition): readonly PropPart[];
  readonly scene: THREE.Scene;
  readonly views: ReadonlyMap<
    string,
    {
      readonly group: THREE.Group;
      readonly mesh: StandardMesh;
      readonly bodyKey: string | null;
      readonly shared: THREE.Material | null;
    }
  >;
  readonly geometries: ReadonlyMap<string, THREE.BufferGeometry>;
  readonly palette: Palette;
  readonly props: PropCache;
  readonly controls: ReadonlyMap<string, ControlShapes>;
  readonly trim: THREE.Material;
}

type Disposable = THREE.EventDispatcher<{ dispose: object }>;

/**
 * Everything drawn, from the moment it joins the scene, and how often it was freed: instanced
 * meshes (their instance buffers are freed on that event, by three's renderer), geometries,
 * materials and textures.
 */
function track(scene: THREE.Scene) {
  const freed = new Map<Disposable, number>();
  const instanced = new Set<THREE.InstancedMesh>();
  const watch = (thing: Disposable) => {
    if (freed.has(thing)) return;
    freed.set(thing, 0);
    thing.addEventListener('dispose', () => freed.set(thing, (freed.get(thing) ?? 0) + 1));
  };
  scene.addEventListener('childadded', ({ child }) => {
    child.traverse((node) => {
      if (node instanceof THREE.InstancedMesh) {
        instanced.add(node as THREE.InstancedMesh);
        watch(node as THREE.InstancedMesh);
      }
      if (!(node instanceof THREE.Mesh)) return;
      watch(node.geometry as Disposable);
      for (const material of [node.material as THREE.Material].flat()) {
        watch(material);
        const { map } = material as THREE.MeshStandardMaterial;
        if (map) watch(map);
      }
    });
  });
  return { freed, instanced };
}

const cleanup: (() => void)[] = [];
beforeEach(() => {
  // Labels draw on a canvas: none in Node (no 2D context, so nothing is painted).
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) });
});
afterEach(() => {
  for (const done of cleanup.splice(0)) done();
  vi.unstubAllGlobals();
});

/** The fixture game in the preparation room (a new game), then a renderer following it. */
async function withRenderer() {
  const { game } = await bootTestGame({ content: fixture() });
  await game.newGame('researcher-male');
  const renderer = new WorldRenderer({} as HTMLElement, game, {} as HTMLCanvasElement);
  const view = renderer as unknown as Wiring;
  const drawn = track(view.scene);
  view.followScenes(view.subscriptions);
  view.followEntities(view.subscriptions);
  let disposed = false;
  const dispose = () => {
    if (!disposed) renderer.dispose();
    disposed = true;
  };
  cleanup.push(() => {
    dispose();
    game.dispose();
  });
  return { game, view, drawn, dispose };
}

const instancedIn = (scene: THREE.Scene) =>
  scene.children.filter((c): c is THREE.InstancedMesh => c instanceof THREE.InstancedMesh);

/** The decor items' batches alone (not the viewed entities' parts: trims, bodies). */
const decorIn = (scene: THREE.Scene) =>
  instancedIn(scene).filter((m) => m.name.startsWith('decor:'));

const poseMatrix = ({ pose }: WorldEntity) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(...pose.position),
    new THREE.Quaternion(...pose.rotation),
    new THREE.Vector3(1, 1, 1),
  );
/** As an instance buffer holds it (32-bit floats). */
const stored = (m: THREE.Matrix4) => Array.from(new Float32Array(m.elements)).join(',');
const batchKey = (
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  casts: boolean,
  matrices: readonly string[],
) => `${geometry.uuid} ${material.uuid} casts:${casts} ${matrices.length}× ${matrices.join(';')}`;

/** What is drawn in batches: per instanced mesh, its geometry, material, shadow and matrices. */
function drawnBatches(view: Wiring): string[] {
  return instancedIn(view.scene)
    .map((mesh) => {
      expect(mesh.receiveShadow).toBe(true);
      const matrices = Array.from({ length: mesh.count }, (_, i) =>
        stored(mesh.getMatrixAt(i, new THREE.Matrix4())),
      );
      return batchKey(mesh.geometry, mesh.material as THREE.Material, mesh.castShadow, matrices);
    })
    .sort();
}

/**
 * What should be: per resident scene, per decor item there, per part of that item, one batch
 * holding that scene's copies at their poses, in spawn order.
 */
function expectedBatches(game: Game, view: Wiring): string[] {
  const keys: string[] = [];
  for (const sceneId of game.scenes.residentIds) {
    const rooms = new Set(game.world.roomsOf(sceneId).map((room) => room.id));
    const copies = new Map<ItemDefinition, WorldEntity[]>();
    for (const entity of game.world.allEntities()) {
      if (!rooms.has(entity.roomId) || !DecorBatches.accepts(entity.item)) continue;
      copies.set(entity.item, [...(copies.get(entity.item) ?? []), entity]);
    }
    for (const [item, list] of copies) {
      for (const part of view.partsOf(item)) {
        const material = partMaterial(part, item, view.palette);
        const matrices = list.map((copy) => stored(poseMatrix(copy)));
        keys.push(batchKey(part.geometry, material, castsShadow(part, item), matrices));
      }
    }
    // The controls' trims: per room and shape, every still control's, at its pose (addPart).
    const trims = new Map<string, { trim: THREE.BufferGeometry; list: WorldEntity[] }>();
    for (const entity of game.world.allEntities()) {
      const { model, size } = entity.item.visual;
      if (!rooms.has(entity.roomId) || !model || entity.item.physical.body === 'dynamic') continue;
      const trim = view.controls.get(`${model}:${size.join(',')}`)?.trim;
      if (!trim) continue;
      const key = `${entity.roomId}|${trim.uuid}`;
      const batch = trims.get(key) ?? { trim, list: [] };
      batch.list.push(entity);
      trims.set(key, batch);
    }
    for (const { trim, list } of trims.values()) {
      const matrices = list.map((copy) => stored(poseMatrix(copy)));
      keys.push(batchKey(trim, view.trim, false, matrices));
    }
    // The bodies drawn by their shared look (addPart): per room and key, every copy at its pose.
    const bodies = new Map<string, WorldEntity[]>();
    for (const entity of game.world.allEntities()) {
      const own = view.views.get(entity.id);
      if (!rooms.has(entity.roomId) || !own?.bodyKey) continue;
      const key = `${entity.roomId}|${own.bodyKey}`;
      bodies.set(key, [...(bodies.get(key) ?? []), entity]);
    }
    for (const list of bodies.values()) {
      const own = view.views.get(list[0]!.id)!;
      const matrices = list.map((copy) => stored(poseMatrix(copy)));
      keys.push(batchKey(own.mesh.geometry, own.shared!, own.mesh.castShadow, matrices));
    }
  }
  return keys.sort();
}

const cacheSizes = (view: Wiring) => {
  const props = view.props as unknown as { built: ReadonlyMap<string, unknown> };
  const palette = view.palette as unknown as {
    finishes: ReadonlyMap<string, unknown>;
    surfaces: ReadonlyMap<string, unknown>;
  };
  return [view.geometries.size, props.built.size, palette.finishes.size, palette.surfaces.size];
};

describe('decor in the renderer', () => {
  it('draws the scene already loaded at once, then each loaded scene: one instanced mesh per part of each item, a matrix per copy', async () => {
    const { game, view, drawn } = await withRenderer();
    // The preparation room was there before the renderer: its one light panel, one batch.
    expect(drawnBatches(view)).toEqual(expectedBatches(game, view));
    expect(decorIn(view.scene)).toHaveLength(1);
    const [early] = decorIn(view.scene);

    await game.scenes.load('simlab-hub');
    expect(drawn.freed.get(early!)).toBe(1); // went with its scene
    expect(drawnBatches(view)).toEqual(expectedBatches(game, view));
    // Columns (body, stone), planters (body, foliage), light panels (the body alone).
    expect(decorIn(view.scene).map((m) => m.count)).toEqual([3, 3, 2, 2, 2]);
    // No view for a batched copy; the reception desk and the labelled sign keep theirs.
    for (const entity of game.world.allEntities()) {
      expect(view.views.has(entity.id), entity.id).toBe(!DecorBatches.accepts(entity.item));
    }
    expect(view.views.has('simlab-hub/test-wordmark')).toBe(true);
  });

  it('takes a despawned copy out of its batch at once, and a despawned view as before', async () => {
    const { game, view } = await withRenderer();
    await game.scenes.load('simlab-hub');
    const before = decorIn(view.scene);
    const [second, third] = ['test-column-2', 'test-column-3'].map((id) =>
      game.world.entity(`simlab-hub/${id}`)!,
    );
    game.world.despawn('simlab-hub/test-column-1');
    expect(decorIn(view.scene)).toEqual(before); // the same meshes, nothing rebuilt
    for (const mesh of before.slice(0, 2)) {
      // The columns' body and stone: the last copy moved into the first one's place.
      expect(mesh.count).toBe(2);
      expect(stored(mesh.getMatrixAt(0, new THREE.Matrix4()))).toBe(stored(poseMatrix(third!)));
      expect(stored(mesh.getMatrixAt(1, new THREE.Matrix4()))).toBe(stored(poseMatrix(second!)));
    }
    expect(before.slice(2).map((m) => m.count)).toEqual([2, 2, 2]); // the others untouched
    game.world.despawn('simlab-hub/test-reception');
    expect(view.views.has('simlab-hub/test-reception')).toBe(false);
  });

  it('builds an attached neighbour’s batches where it lies and frees them when it goes, the hub’s untouched', async () => {
    const { game, view, drawn } = await withRenderer();
    await game.scenes.load('simlab-hub');
    const hub = instancedIn(view.scene);
    const hubDecor = decorIn(view.scene);
    expect(await game.scenes.attach('biology-lab')).toBeNull();
    const added = instancedIn(view.scene).filter((m) => !hub.includes(m));
    expect(drawnBatches(view)).toEqual(expectedBatches(game, view));
    // Its controls' trims and bodies too (expectedBatches checks them): the decor here.
    const lab = added.filter((m) => m.name.startsWith('decor:'));
    expect(added.filter((m) => m.material === view.trim)).toHaveLength(6);
    expect(lab.map((m) => m.count)).toEqual([2, 2, 1]); // planters (2 parts), light panel
    // The same planter as the hub's, drawn in the lab's own batch, at the lab's place (x < −13).
    expect(lab[0]?.geometry).toBe(hubDecor[2]?.geometry);
    expect(lab[0]?.getMatrixAt(0, new THREE.Matrix4()).elements[12]).toBeLessThan(-13);

    expect(game.scenes.release('biology-lab')).toBe(true);
    expect(instancedIn(view.scene)).toEqual(hub);
    for (const mesh of added) expect(drawn.freed.get(mesh)).toBe(1);
    for (const mesh of hub) expect(drawn.freed.get(mesh)).toBe(0);
    // The prop parts and materials they were drawn with are shared: they stay with the renderer.
    expect(drawn.freed.get(lab[0]!.geometry as Disposable)).toBe(0);
    expect(drawn.freed.get(lab[0]!.material as THREE.Material)).toBe(0);
  });

  it('leaks nothing across loads, attaches and releases, and its dispose frees everything drawn', async () => {
    const { game, view, drawn, dispose } = await withRenderer();
    await game.scenes.load('simlab-hub');
    const sizes: number[][] = [];
    for (let round = 0; round < 3; round++) {
      expect(await game.scenes.attach('biology-lab')).toBeNull();
      expect(drawnBatches(view)).toEqual(expectedBatches(game, view));
      expect(game.scenes.release('biology-lab')).toBe(true);
      expect(drawnBatches(view)).toEqual(expectedBatches(game, view));
      await game.scenes.load('preparation-room');
      await game.scenes.load('simlab-hub');
      sizes.push(cacheSizes(view));
    }
    // Shared parts and materials are made once per kind, never per visit or copy.
    expect(sizes[1]).toEqual(sizes[0]);
    expect(sizes[2]).toEqual(sizes[0]);
    // Every batch ever made is drawn now (not freed) or was freed exactly once.
    const live = new Set(instancedIn(view.scene));
    expect(live.size).toBe(5 + 6); // the hub's decor and its bodies batched by look
    // prep 1 decor and 3 bodies, hub 5 and 6; then per round: lab 3 decor batches, its parts' 23
    // (its controls' 6 trims and 17 bodies, per room and shape: decorBatches.ts addPart) and the
    // 20 instanced parts of its nine bench apparatus (their `copies`; the potometer's leaves and
    // scale ticks since T-6, the respirometer's ticks and seeds, the seed tray's four heaps and
    // its pods, the bean jar's marked and unmarked beans since T-6b) and the practice room's
    // twelve (Phase X: chromatids, the gene board's four rows, beetles, yeast cells, rabbits and
    // foxes, bubbles, DNA strands, chromosomes), prep 1 + 3, hub 5 + 6.
    expect(drawn.instanced.size).toBe(1 + 3 + 5 + 6 + 3 * (3 + 23 + 20 + 12 + 1 + 3 + 5 + 6));
    for (const mesh of drawn.instanced) expect(drawn.freed.get(mesh)).toBe(live.has(mesh) ? 0 : 1);

    dispose();
    expect(view.scene.children).toEqual([]);
    const kept = [...drawn.freed].filter(([, times]) => times === 0);
    expect(kept.map(([thing]) => (thing as { type?: string }).type ?? 'texture')).toEqual([]);
    for (const mesh of drawn.instanced) expect(drawn.freed.get(mesh)).toBe(1);
  });
});

describe('bodies batched by their look', () => {
  /** The size its copy is drawn at in `batch` (the copy at the entity's place), or null. */
  const sizeIn = (batch: THREE.InstancedMesh, entity: WorldEntity): number | null => {
    const at = new THREE.Vector3(...entity.pose.position);
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    for (let i = 0; i < batch.count; i++) {
      batch.getMatrixAt(i, m);
      // Its first column's length (decompose calls a matrix of no size one of size 1).
      if (p.setFromMatrixPosition(m).distanceTo(at) < 1e-6)
        return Math.round(p.setFromMatrixColumn(m, 0).length() * 1e6) / 1e6;
    }
    return null;
  };

  it('draws a still body in its room’s batch, and by its own mesh while it is focused', async () => {
    const { game, view } = await withRenderer();
    await game.scenes.load('simlab-hub');
    // Its room's batch of its look (one per room: named `part:<key>@<room>`).
    const batchOf = (key: string, v: { bodyKey: string | null }) => {
      const { roomId } = game.world.entity(key)!;
      return instancedIn(view.scene).find((m) => m.name === `part:${v.bodyKey}@${roomId}`)!;
    };
    const [id, own] = [...view.views].find(([, v]) => v.bodyKey !== null)!;
    const entity = game.world.entity(id)!;
    const batch = batchOf(id, own);
    expect(batch.material).toBe(own.shared);
    expect(own.mesh.visible).toBe(false);
    expect(sizeIn(batch, entity)).toBe(1);

    game.events.publish('InteractionFocusChanged', { entityId: id });
    expect(own.mesh.visible).toBe(true); // its own glow, on its own copy of the look
    expect(own.mesh.material).not.toBe(own.shared);
    expect(sizeIn(batch, entity)).toBe(0);

    game.events.publish('InteractionFocusChanged', { entityId: null });
    expect(own.mesh.visible).toBe(false);
    expect(own.mesh.material).toBe(own.shared);
    expect(sizeIn(batch, entity)).toBe(1);

    // Hidden with its view (taken, an emergency): no size in the batch either.
    game.world.despawn(id);
    expect(batch.count === 0 || sizeIn(batch, entity) === null).toBe(true);
  });
});

describe('props on entities', () => {
  it('draws an item with a prop as its body, with the other parts as children of its mesh', async () => {
    const { game, view } = await withRenderer();
    await game.scenes.load('simlab-hub');
    const desk = game.world.entity('simlab-hub/test-reception')!;
    const { mesh } = view.views.get(desk.id)!;
    const parts = view.props.get('reception-desk', desk.item.visual.size)!;
    const body = parts.find((p) => p.finish === 'body')!;
    const others = parts.filter((p) => p !== body);
    expect(others.length).toBeGreaterThan(0);
    expect(mesh.geometry).toBe(body.geometry);
    expect(mesh.castShadow).toBe(castsShadow(body, desk.item));
    // Its own material, in its colour: focus shows on it, not on the shared finishes.
    expect(mesh.material).not.toBe(view.palette.surface('#1f3b57', 'satin'));
    expect(mesh.material.color.getHexString()).toBe('1f3b57');
    expect(mesh.children).toHaveLength(others.length);
    mesh.children.forEach((child, i) => {
      const part = others[i]!;
      expect((child as StandardMesh).geometry).toBe(part.geometry);
      expect((child as StandardMesh).material).toBe(partMaterial(part, desk.item, view.palette));
      expect(child.castShadow).toBe(castsShadow(part, desk.item));
      expect(child.receiveShadow).toBe(true);
    });
    game.events.publish('InteractionFocusChanged', { entityId: desk.id });
    expect(mesh.material.emissive.getHexString()).toBe('2a3440');
    for (const child of mesh.children) {
      expect((child as StandardMesh).material.emissive.getHexString()).toBe('000000');
    }
  });

  it('draws every item without a prop as before: its primitive (or model), its own material, no parts', async () => {
    const { game, view } = await withRenderer();
    await game.scenes.load('simlab-hub');
    expect(await game.scenes.attach('physics-lab')).toBeNull();
    expect(await game.scenes.attach('biology-lab')).toBeNull();
    let checked = 0;
    for (const [id, { mesh }] of view.views) {
      const { item } = game.world.entity(id)!;
      const { visual } = item;
      if (visual.prop) continue;
      checked++;
      expect(mesh.children, id).toHaveLength(0);
      if (visual.reveal) {
        // A see-through display (reveal.ts): its glass tinted, casting no shadow.
        expect([mesh.material.transparent, mesh.castShadow], id).toEqual([true, false]);
        continue;
      }
      expect(mesh.material.color.getHexString(), id).toBe(
        new THREE.Color(visual.color).getHexString(),
      );
      expect(mesh.castShadow, id).toBe(visual.material !== 'light' && visual.material !== 'glass');
      expect(mesh.receiveShadow, id).toBe(true);
      const apparatus =
        item.launcher ?? item.pendulum ?? item.springStand ?? item.dropTower ?? item.bench;
      if (!visual.model && !apparatus) {
        expect(mesh.geometry, id).toBe(
          view.geometries.get(`${visual.shape}:${visual.size.join(',')}`),
        );
      }
    }
    expect(checked).toBeGreaterThan(70); // the hub's, the Physics Lab's and the Biology Lab's
  });
});

describe('the content rules props and decor keep', () => {
  const item = (visual: object, fields: object = {}) => ({
    id: 'x',
    displayName: 'X',
    category: 'structure',
    physical: { massKg: 1, body: 'none' },
    ...fields,
    visual: { shape: 'box', size: [1, 1, 1], color: '#808080', ...visual },
  });
  const code = {
    behaviors: new Registry('behaviour', BUILT_IN_BEHAVIORS),
    models: new Registry('simulation model', BUILT_IN_MODELS),
  };
  /** The boot's problems with the bundled content and this one more item. */
  function problemsWith(extra: object): readonly string[] {
    const content = structuredClone(bundledContent);
    (content.items as object[]).push(extra);
    try {
      buildContent(content, code);
    } catch (error) {
      if (error instanceof ContentError) return error.problems;
      throw error;
    }
    return [];
  }

  it('a prop from the closed list, or a control model, not both', () => {
    const parse = (visual: object) => {
      const result = ItemDefinitionSchema.safeParse(item(visual));
      return result.success ? [] : formatIssues(result.error);
    };
    expect(parse({ prop: 'reception-desk' })).toEqual([]);
    expect(parse({ prop: 'reception-desk', model: 'desk' })).toEqual([
      'visual.prop: a prop or a control model, not both',
    ]);
    expect(parse({ prop: 'sofa' })).toHaveLength(1);
  });

  it('decor: nothing to do with it, never dynamic, no screen, stream or open box', () => {
    const decor = { tags: ['decor'] };
    expect(problemsWith(item({}, decor))).toEqual([]);
    expect(problemsWith(item({ label: { text: 'SIMLAB' } }, decor))).toEqual([]); // its own view
    const refused: [object, object][] = [
      [{}, { interactions: ['inspect'] }],
      [{}, { physical: { massKg: 1, body: 'dynamic' } }],
      [{ screen: 'status' }, {}],
      [{ stream: { length: 0.3, color: '#9fd3ff' } }, {}],
      [{ openBox: { center: [0, 0, -0.2], size: [1, 1, 0.1] } }, {}],
    ];
    for (const [visual, fields] of refused) {
      expect(problemsWith(item(visual, { ...decor, ...fields }))).toEqual([
        'items.x.tags: decor has no interactions, is not dynamic and has no screen, stream or ' +
          'open box',
      ]);
      expect(problemsWith(item(visual, fields))).toEqual([]); // the same item, not decor
    }
    // Twelve content builds: about 1.5 s alone, past 5 s under the full suite's load.
  }, 20_000);
});
