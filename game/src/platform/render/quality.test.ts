import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Disposables } from '../../core/EventBus';
import type { Game } from '../../game/Game';
import { bootTestGame } from '../../game/testing';
import { GRAPHICS_QUALITIES, type GraphicsQuality } from '../../persistence/settings';
import { LIGHT_SLOTS } from '../../world/lighting';
import type { WorldEntity } from '../../world/World';
import type { BodyView } from './body/BodyView';
import { ContactShadows } from './contactShadows';
import type { ExperimentView } from './ExperimentView';
import { DETAIL_DISTANCE, Finishes, glassEdge } from './finishes';
import {
  GLASSWARE,
  GLASSWARE_LOOK,
  LIQUID_EDGE,
  LIQUID_FILL,
  LIQUID_RIM,
  liquidLook,
  METAL,
  SHEEN,
  transmit,
} from './looks';
import { type Finish, FINISHES, Palette } from './palette';
import { QUALITY } from './quality';
import type { RoomLightPool } from './roomLights';
import { WorldRenderer } from './WorldRenderer';

/**
 * Bench meshes drawn as glassware (bench model / mesh name) in the shipped world scenes: vessels,
 * tubes and slides. Benches tagged but not placed today (dilution station) do not show
 * here; their glass is tagged the same way (GLASSWARE_LOOK).
 */
const BENCH_GLASSWARE = [
  'agar-cubes/tray',
  'bean-jar/glass',
  'boyle-syringe/barrel',
  'boyle-syringe/nozzle',
  'buoyancy-rig/glass',
  'colorimeter/glass',
  'culture-flask/flask',
  'digital-microscope/glass',
  'dilution-colorimeter/glass',
  'dna-tube/tube',
  'electrolysis-cell/beaker',
  'food-test-rack/glass',
  'galvanic-cell/glass',
  'galvanic-cell/left-beaker',
  'galvanic-cell/right-beaker',
  'gas-box/box',
  'gas-column/bath',
  'gas-column/capillary',
  'gas-column/stem',
  'gas-syringe-rig/glass',
  'gas-syringe-rig/inner-glass',
  'halogen-rack/glass',
  'halogen-rack/halides',
  'hot-plate/glass',
  'ice-funnels/beaker-control',
  'ice-funnels/beaker-heated',
  'ice-funnels/funnel-control',
  'ice-funnels/funnel-heated',
  'ice-funnels/spout',
  'joulemeter-calorimeter/stem',
  'neutralisation-cup/acid-cylinder',
  'neutralisation-cup/base-cylinder',
  'neutralisation-cup/glass',
  'no2-syringe/bath',
  'no2-syringe/syringe',
  'osmosis-rack/glass',
  'ph-meter-station/electrode',
  'ph-meter-station/glass',
  'pondweed-lamp/glass',
  'potometer/capillary',
  'potometer/glass',
  'precipitation-rack/dropper-glass',
  'precipitation-rack/glass',
  'precipitation-rack/samples',
  'pressure-tank/glass',
  'pressure-tank/tube',
  'reaction-box/box',
  'resonance-tube-rig/glass',
  'resonance-tube-rig/vessel',
  'respirometer/glass',
  'rusting-tubes/glass',
  'rusting-tubes/test-tube',
  'seed-tray/glass',
  'separation-bench/beaker',
  'separation-bench/flask',
  'separation-bench/funnel',
  'separation-bench/glass',
  'soap-pot/beaker',
  'soap-pot/glass',
  'solubility-station/glass',
  'whirling-apparatus/glass',
  'yeast-flask/flask',
  'yeast-flask/glass',
];

// The graphics presets' cost, without WebGL (init() is never called: its scene is assembled and
// what it follows is followed here, through the renderer's own code, as propsWiring.test.ts): Low
// is the cheap path an integrated GPU can run — three lights, no shadow map, no image-based light,
// no env map, no sheen pass or contact shadow, one pixel per CSS pixel — what each preset sets on
// materials and textures is set and given back on a switch (render-quality audit §5.2), and no
// preset reaches the simulation. Reads private members on purpose, as WorldRenderer.test.ts.

/** The private parts of WorldRenderer read here. */
interface View {
  readonly subscriptions: Disposables;
  assemble(): void;
  followScenes(s: Disposables): void;
  followEntities(s: Disposables): void;
  readonly experiment: { readonly group: THREE.Group; attach(s: Disposables): void };
  environmentMap: () => THREE.Texture | null;
  renderer: unknown;
  readonly scene: THREE.Scene;
  readonly body: BodyView;
  readonly hemisphere: THREE.Light;
  readonly sun: THREE.Light;
  readonly fill: THREE.Light;
  readonly views: Map<string, { readonly group: THREE.Group; readonly entity: WorldEntity }>;
  readonly sceneRooms: Map<string, { readonly group: THREE.Group }>;
  update(dt: number): void;
  readonly roomLights: RoomLightPool;
  readonly contact: ContactShadows;
  readonly finishes: Finishes;
  deviceBox: { width: number; height: number } | null;
  ground(view: { group: THREE.Group; entity: { id: string; item: object } }): void;
  observeDevicePixels(): void;
  resize(): void;
}

const cleanup: (() => void)[] = [];
beforeEach(() => {
  // Labels and screens draw on a canvas: none in Node (no 2D context, so nothing is painted).
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) });
});
afterEach(() => {
  for (const done of cleanup.splice(0)) done();
  vi.unstubAllGlobals();
});

/** A new game under `quality`, a renderer following its scenes and entities. */
async function follow(quality: GraphicsQuality) {
  const { game } = await bootTestGame();
  game.setGraphicsQuality(quality);
  await game.newGame('researcher-male');
  const renderer = new WorldRenderer({} as HTMLElement, game, {} as HTMLCanvasElement);
  const view = renderer as unknown as View;
  // The prefiltered room light needs WebGL (PMREM): a known texture stands in for it.
  const room = new THREE.Texture();
  view.environmentMap = () => room;
  view.assemble(); // init's scene: lights, rooms, the camera with the hands, the lanes
  view.followScenes(view.subscriptions);
  view.followEntities(view.subscriptions);
  view.experiment.attach(view.subscriptions); // the launcher lanes
  view.body.attach(view.subscriptions); // the player's body (its shadow)
  cleanup.push(() => {
    renderer.dispose();
    game.dispose();
  });
  return { game, view, room };
}

/** Whether the player's body (built: its shadow-only meshes) casts shadows. */
function bodyCasting(view: View): 'all' | 'none' | 'some' | 'no body' {
  const casts: boolean[] = [];
  view.body.group.traverse((o) => {
    if ((o as Partial<THREE.Mesh>).isMesh && o.name.startsWith('body-shadow'))
      casts.push(o.castShadow);
  });
  if (casts.length === 0) return 'no body';
  return casts.every(Boolean) ? 'all' : casts.some(Boolean) ? 'some' : 'none';
}

type RoomLit = THREE.MeshStandardMaterial | THREE.MeshLambertMaterial | THREE.MeshPhongMaterial;

/** The room-lit materials drawn in room `roomId`: its shells' and its entities' (decor aside). */
function surfaces(view: View, roomId: string): RoomLit[] {
  const out: RoomLit[] = [];
  const add = (root: THREE.Object3D, inRoom: boolean) =>
    root.traverse((o) => {
      const m = (o as Partial<THREE.Mesh>).material;
      const own = (o.userData.roomId as string | undefined) === roomId;
      if (
        (inRoom || own) &&
        (m instanceof THREE.MeshStandardMaterial ||
          m instanceof THREE.MeshLambertMaterial ||
          m instanceof THREE.MeshPhongMaterial)
      )
        out.push(m);
    });
  for (const { group } of view.sceneRooms.values()) add(group, false);
  for (const { group, entity } of view.views.values()) add(group, entity.roomId === roomId);
  return out;
}

/** The share of the indirect light a material takes (its ambient-occlusion map, black or none). */
const indirect = (m: RoomLit) => (m.aoMap ? 1 - m.aoMapIntensity : 1);

/** What three runs just before it draws `object` (the sheen passes read none of its arguments). */
const drawn = (object: THREE.Object3D) => (object.onBeforeRender as () => void).call(object);

const worldScenes = (game: Game) =>
  game.content.scenes
    .all()
    .filter((s) => s.kind === 'world')
    .map((s) => s.id);

/**
 * What a frame of the scene costs in lights: three draws a light only when it and its parents are
 * visible, and runs a shadow pass only for those of them that cast (WebGLRenderer.projectObject).
 */
function lighting(scene: THREE.Scene) {
  const lights: THREE.Light[] = [];
  scene.traverseVisible((o) => {
    if (o instanceof THREE.Light) lights.push(o);
  });
  return {
    kinds: lights.map((l) => l.type).sort(),
    casting: lights.filter((l) => l.castShadow).length,
  };
}

/** Every material of every mesh, line and point set, hidden ones too (they may be shown later). */
function materials(scene: THREE.Scene): THREE.Material[] {
  const all = new Set<THREE.Material>();
  scene.traverse((o) => {
    const { material } = o as Partial<THREE.Mesh>;
    if (material) for (const m of [material].flat()) all.add(m);
  });
  return [...all];
}

describe('Low: the cheap path, in every world scene', () => {
  it('three lights (hemisphere, sun, fill), none casting, no room light, no image-based light', async () => {
    const { game, view } = await follow('low');
    for (const id of worldScenes(game)) {
      await game.scenes.load(id);
      expect(lighting(view.scene), id).toEqual({
        kinds: ['DirectionalLight', 'DirectionalLight', 'HemisphereLight'],
        casting: 0, // no shadow map is drawn or sampled
      });
      expect(view.scene.environment, id).toBeNull(); // the stand-in, had it been asked for
      expect(view.scene.environmentIntensity, id).toBe(0);
      expect(bodyCasting(view), id).toBe('none'); // no shadow map: the body casts none
    }
  }, 20_000); // every world scene loaded: about 1.3 s alone, past 5 s in a full parallel run

  it('the fallback keeps the labs lit: sun, fill and a brighter sky than under room lights', async () => {
    const { game, view } = await follow('low');
    await game.scenes.load('chemistry-lab');
    const by = (type: string) => {
      const found: THREE.Light[] = [];
      view.scene.traverseVisible((o) => {
        if (o instanceof THREE.Light && o.type === type) found.push(o);
      });
      return found.map((l) => l.intensity).sort();
    };
    expect(by('DirectionalLight')).toEqual([0.7, 2.2]); // fill, sun
    expect(by('HemisphereLight')).toEqual([1.25]); // against 0.8 under room lights
  });
});

describe('materials under every preset (render-quality audit §5, §7.7)', () => {
  // Per preset: no physical material anywhere (Ultra is not offered); Low and Medium no env map
  // at all; High one only on the reflective materials (metal, sheen), the room light at its
  // intensity, metal then fully metallic; glassware a filter and sheen shown from Medium up.
  it.each(GRAPHICS_QUALITIES)(
    '%s: standard, basic, toon and unlit shader materials only; env maps and glassware as the preset says',
    async (quality) => {
      const q = QUALITY[quality];
      const { game, view, room } = await follow(quality);
      let lanes = 0;
      const seen = { glassware: 0, metal: 0, reflected: 0 };
      for (const id of worldScenes(game)) {
        // Its rooms, decor, props, signs, apparatus, bench rigs and a launcher's lane; the hands.
        await game.scenes.load(id);
        lanes += view.experiment.group.children.length;
        const used = materials(view.scene);
        expect(used.length, id).toBeGreaterThan(0);
        const types = new Set(used.map((m) => m.type));
        for (const type of types) {
          expect(
            // Points: the orbital table’s probability cloud. Toon: the player's own body, drawn in the anime style (C-7; cheaper than standard).
            [
              'MeshStandardMaterial',
              'MeshBasicMaterial',
              'LineBasicMaterial',
              'ShaderMaterial',
              'MeshToonMaterial',
              'PointsMaterial', // Phase X: the orbital cloud's dots
            ],
            `${id}: ${type}`,
          ).toContain(type);
        }
        for (const m of used) {
          const s = m as THREE.MeshPhysicalMaterial;
          const at = `${id}: ${m.name || m.type}`;
          expect(s.isMeshPhysicalMaterial, at).toBeFalsy();
          if (q.reflections === 0) expect(s.envMap ?? null, at).toBeNull();
          else if (s.envMap) {
            seen.reflected++;
            expect([METAL, SHEEN], at).toContain(m.name);
            expect(s.envMap, at).toBe(room);
            expect(s.envMapIntensity, at).toBe(q.reflections);
          }
          if (m.name === METAL) {
            seen.metal++;
            expect(s.envMap ?? null, at).toBe(q.reflections > 0 ? room : null);
            if (q.reflections > 0) expect(s.metalness, at).toBe(1);
            else expect(s.metalness, at).toBeLessThan(1); // no full metal without a reflection
          }
          if (m.name === GLASSWARE) {
            seen.glassware++;
            expect(m.blending === THREE.MultiplyBlending, at).toBe(q.sheen);
          }
          if (m.name === SHEEN) expect(m.visible, at).toBe(q.sheen);
        }
      }
      expect(lanes, 'a launcher lane was checked').toBeGreaterThan(0);
      expect(seen.glassware, 'glassware was checked').toBeGreaterThan(0);
      expect(seen.metal, 'metal was checked').toBeGreaterThan(0);
      if (q.reflections > 0) expect(seen.reflected).toBeGreaterThan(seen.metal);
    },
  );
});

describe('glassware finishes (audit F4)', () => {
  it('the palette’s clear glass alone: mirror, emblem glow, floor glass, amber reagent and specimen fluid keep their paint', () => {
    const palette = new Palette();
    const finishes = Object.keys(FINISHES) as Finish[];
    const seeThrough = finishes.filter((f) => FINISHES[f].look === 'glass').sort();
    expect(seeThrough).toEqual([
      'emblem-glow',
      'floor-glass',
      'glass',
      'mirror',
      'reagent-amber',
      'specimen-fluid',
    ]);
    expect(finishes.filter((f) => palette.finish(f).name === GLASSWARE)).toEqual(['glass']);
    palette.dispose();
  });

  it('bench models: their clear glass vessels, tubes and slides, each with one sheen pass', async () => {
    const { game, view } = await follow('high');
    const found = new Set<string>();
    let batches = 0;
    for (const id of worldScenes(game)) {
      await game.scenes.load(id);
      view.scene.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        const mesh = o as THREE.Mesh;
        if ((mesh.material as THREE.Material).name !== GLASSWARE) return;
        const sheen = view.finishes.sheenOf(mesh);
        expect(sheen?.parent, mesh.name).toBe(mesh);
        expect(
          mesh.children.filter((c) => c.name === 'glass-sheen'),
          mesh.name,
        ).toHaveLength(1);
        expect(Object.keys(mesh.userData), mesh.name).toEqual([]); // three copies userData
        if (mesh instanceof THREE.InstancedMesh) {
          // Decor glass (the glassware shelf): its sheen shares the batch's copies.
          batches++;
          expect(sheen, mesh.name).toBeInstanceOf(THREE.InstancedMesh);
          const copies = sheen as THREE.InstancedMesh;
          expect(copies.instanceMatrix).toBe(mesh.instanceMatrix);
          mesh.count = Math.max(0, mesh.count - 1); // a copy taken out
          drawn(copies);
          expect(copies.count).toBe(mesh.count);
        }
        let bench: string | undefined;
        for (let p: THREE.Object3D | null = mesh; p && !bench; p = p.parent) {
          bench = [...view.views.values()].find((v) => v.group === p)?.entity.item.bench?.model;
        }
        if (bench) found.add(`${bench}/${mesh.name}`);
      });
    }
    // The other see-through parts of the benches (liquids, meter windows, the lens, the
    // refracting block) keep their paint: a refracting block's opacity follows n.
    expect([...found].sort()).toEqual(BENCH_GLASSWARE);
    expect(batches, 'decor glassware was checked').toBeGreaterThan(0);
  });

  it.each(['low', 'medium'] as const)(
    '%s: no sheen pass is made, so its program is never compiled there',
    async (quality) => {
      const { game, view } = await follow(quality);
      await game.scenes.load('chemistry-lab');
      let glassware = 0;
      view.scene.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        if ((o.material as THREE.Material).name === GLASSWARE) glassware++;
        expect(o.name).not.toBe('glass-sheen');
      });
      expect(glassware).toBeGreaterThan(0);
    },
  );

  it('a sheen pass follows a geometry its builder swaps, and survives a clone', () => {
    const finishes = new Finishes(QUALITY.high);
    const glass = new THREE.Mesh<THREE.BufferGeometry, THREE.Material>(
      new THREE.BoxGeometry(0.1, 0.1, 0.1),
      new THREE.MeshStandardMaterial({ ...GLASSWARE_LOOK }),
    );
    finishes.adopt(glass);
    const sheen = finishes.sheenOf(glass)!;
    glass.geometry = new THREE.SphereGeometry(0.05);
    drawn(sheen);
    expect(sheen.geometry).toBe(glass.geometry);
    expect(() => glass.clone()).not.toThrow(); // no cycle through userData
    expect(() => glass.toJSON()).not.toThrow();
    finishes.dispose();
  });
});

describe('Medium and High keep their lighting', () => {
  it.each(['medium', 'high'] as const)(
    '%s: the room lights in every world scene, their keys casting, the player’s shadow drawn',
    async (quality) => {
      const { game, view, room } = await follow(quality);
      for (const id of worldScenes(game)) {
        await game.scenes.load(id);
        const { kinds, casting } = lighting(view.scene);
        expect(
          kinds.filter((k) => k === 'SpotLight'),
          id,
        ).toHaveLength(LIGHT_SLOTS.key + LIGHT_SLOTS.other);
        expect(
          kinds.filter((k) => k === 'DirectionalLight'),
          id,
        ).toEqual([]);
        expect(casting, id).toBe(LIGHT_SLOTS.key);
        // High alone reflects the room, at 0.08.
        expect(view.scene.environment, id).toBe(quality === 'high' ? room : null);
        expect(view.scene.environmentIntensity, id).toBe(quality === 'high' ? 0.08 : 0);
        expect(bodyCasting(view), id).toBe('all'); // the player's shadow, from the body
      }
    },
  );
});

describe('pixel ratio by preset', () => {
  /** A drawing context's stand-in: what resize asks of three's renderer. */
  function fakeRenderer() {
    let ratio = 1;
    return {
      setPixelRatio: vi.fn((r: number) => (ratio = r)),
      getPixelRatio: () => ratio,
      setSize: vi.fn(),
      dispose: () => undefined,
    };
  }

  it.each([
    [2.5, { low: 1, medium: 1.5, high: 2, ultra: 2 }], // the config's cap (2) above Medium's and Low's
    [1.25, { low: 1, medium: 1.25, high: 1.25, ultra: 1.25 }],
    [1, { low: 1, medium: 1, high: 1, ultra: 1 }],
  ] as const)('on a %s× screen: %o, set again when the preset changes', async (dpr, expected) => {
    vi.stubGlobal('window', { devicePixelRatio: dpr, innerWidth: 1280, innerHeight: 720 });
    const { game, view } = await follow('medium');
    expect(game.config.graphics.maxPixelRatio).toBe(2);
    const fake = fakeRenderer();
    view.renderer = fake;
    for (const quality of [...GRAPHICS_QUALITIES, 'low'] as const) {
      game.setGraphicsQuality(quality); // the menu's change: GraphicsQualityChanged
      expect(fake.getPixelRatio(), quality).toBe(expected[quality]);
      expect(fake.setSize).toHaveBeenLastCalledWith(1280, 720);
    }
  });

  it('sizes the buffer to the canvas’s device pixels when the browser reports them (audit F8)', async () => {
    // A maximized window at 150 %: the host is 1698.67 CSS px wide, clientWidth says 1699, and
    // three alone would make a 2548 px buffer for a 2548.5 px box.
    vi.stubGlobal('window', { devicePixelRatio: 1.5, innerWidth: 1699, innerHeight: 935 });
    const { game, view } = await follow('medium');
    const fake = fakeRenderer();
    view.renderer = fake;
    view.deviceBox = { width: 2548, height: 1402 };
    for (const [quality, size] of [
      ['high', [2548, 1402]],
      ['low', [1699, 935]], // Low's one pixel per CSS pixel, the browser enlarging it
      ['medium', [2548, 1402]],
    ] as const) {
      game.setGraphicsQuality(quality);
      expect(fake.getPixelRatio(), quality).toBe(1);
      expect(fake.setSize, quality).toHaveBeenLastCalledWith(...size, false);
    }
  });

  it('takes that box from the observer; without it (Safari, an older browser) three sizes the buffer', async () => {
    vi.stubGlobal('window', { devicePixelRatio: 1.5, innerWidth: 1699, innerHeight: 935 });
    let report: (entries: unknown[]) => void = () => undefined;
    let supported = true;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: (entries: unknown[]) => void) {
          report = callback;
        }
        observe() {
          if (!supported) throw new TypeError('device-pixel-content-box');
        }
        disconnect() {}
      },
    );
    /** A renderer observing a stand-in canvas, its buffer a stand-in too. */
    const observed = async () => {
      const { view } = await follow('medium');
      const canvas = { style: {} };
      Object.assign(view, { canvas });
      const fake = fakeRenderer();
      view.renderer = fake;
      view.observeDevicePixels();
      return { view, canvas, fake };
    };

    const a = await observed();
    expect(a.canvas.style).toEqual({ width: '100%', height: '100%' }); // the host's size, by CSS
    report([{ contentRect: {} }]); // an entry without the box: nothing to follow
    expect(a.fake.setSize).not.toHaveBeenCalled();
    report([{ devicePixelContentBoxSize: [{ inlineSize: 2548, blockSize: 1402 }] }]);
    expect(a.fake.setSize).toHaveBeenLastCalledWith(2548, 1402, false);

    supported = false; // the box is refused: three's own sizing, the canvas's CSS untouched
    const b = await observed();
    expect(b.canvas.style).toEqual({});
    b.view.resize();
    expect(b.fake.getPixelRatio()).toBe(1.5);
    expect(b.fake.setSize).toHaveBeenLastCalledWith(1699, 935);
  });
});

describe('the preset switch (audit §5.2): every finish set, and given back', () => {
  /** What the preset sets on the scene now: textures, glassware, metal, sheen, shadows, contact. */
  function finishes(view: View) {
    const textures = new Map<THREE.Texture, number>();
    const glass: string[] = [];
    const metal: string[] = [];
    const sheen: boolean[] = [];
    for (const m of materials(view.scene)) {
      const s = m as THREE.MeshStandardMaterial;
      if (s.map) textures.set(s.map, s.map.anisotropy);
      if (m.name === GLASSWARE) {
        glass.push(`${s.color.getHexString()} ${s.opacity} ${m.blending} ${m.toneMapped}`);
      }
      if (m.name === METAL) metal.push(`${s.metalness} ${s.envMap?.uuid ?? '-'}`);
      if (m.name === SHEEN) sheen.push(m.visible);
    }
    return {
      anisotropy: [...textures.values()],
      glass,
      metal,
      sheen,
      shadowMaps: view.roomLights.slots.slice(0, LIGHT_SLOTS.key).map((l) => l.shadow.mapSize.x),
    };
  }

  it('Low → High → Low in the chemistry lab', async () => {
    const { game, view } = await follow('low');
    await game.scenes.load('chemistry-lab');
    const low = finishes(view);
    expect(low.anisotropy.length).toBeGreaterThan(0);
    expect(Math.min(...low.anisotropy)).toBeGreaterThanOrEqual(QUALITY.low.anisotropy);
    expect(low.shadowMaps).toEqual(Array(LIGHT_SLOTS.key).fill(1024));
    expect(low.sheen.every((shown) => !shown)).toBe(true); // Low: no sheen pass drawn
    game.setGraphicsQuality('high'); // the menu's change, mid-game
    const high = finishes(view);
    expect(new Set(high.anisotropy)).toEqual(new Set([16]));
    expect(high.shadowMaps).toEqual(Array(LIGHT_SLOTS.key).fill(2048));
    expect(high.sheen.length).toBeGreaterThan(0);
    expect(high.sheen.every((shown) => shown)).toBe(true);
    expect(high.glass).not.toEqual(low.glass);
    expect(high.metal).not.toEqual(low.metal);
    game.setGraphicsQuality('low');
    // Exactly what the builders made, and Low's filtering. The sheen passes High made stay, never
    // drawn (Low makes none of its own: they are made only where the preset has sheen).
    const back = finishes(view);
    expect({ ...back, sheen: [] }).toEqual({ ...low, sheen: [] });
    expect(back.sheen.every((shown) => !shown)).toBe(true);
  });

  it('never lowers a texture’s own anisotropy (floors keep their 8 on Low)', () => {
    const finishes = new Finishes(QUALITY.low);
    const floor = new THREE.Texture();
    floor.anisotropy = 8;
    const print = new THREE.Texture();
    finishes.texture(floor);
    finishes.texture(print);
    expect([floor.anisotropy, print.anisotropy]).toEqual([8, 4]);
    finishes.set(QUALITY.high, null, 0);
    finishes.texture(floor);
    finishes.texture(print);
    expect([floor.anisotropy, print.anisotropy]).toEqual([16, 16]);
    finishes.set(QUALITY.medium, null, 0);
    finishes.texture(floor);
    finishes.texture(print);
    expect([floor.anisotropy, print.anisotropy]).toEqual([8, 8]);
    finishes.dispose();
  });

  it('hides a far glassware’s sheen and bench print, a few times a second, and shows them near', () => {
    const finishes = new Finishes(QUALITY.high);
    const root = new THREE.Group();
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.1),
      new THREE.MeshStandardMaterial({ ...GLASSWARE_LOOK }),
    );
    const print = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), new THREE.MeshBasicMaterial());
    print.name = 'print';
    root.add(glass, print);
    root.position.set(DETAIL_DISTANCE + 1, 0, 0);
    finishes.adopt(root);
    finishes.adopt(root); // idempotent: one sheen pass
    const sheen = glass.children.filter((c) => c === finishes.sheenOf(glass));
    expect(sheen).toHaveLength(1);
    expect(glass.children).toHaveLength(1);
    root.updateMatrixWorld(true);
    const eye = new THREE.Vector3();
    finishes.update(0.01, eye); // the first check is at once
    expect([sheen[0]!.visible, print.visible]).toEqual([false, false]);
    eye.set(DETAIL_DISTANCE, 0, 0);
    finishes.update(0.1, eye); // not yet: a few times a second
    expect(print.visible).toBe(false);
    finishes.update(0.2, eye);
    expect([sheen[0]!.visible, print.visible]).toEqual([true, true]);
    finishes.dispose();
  });
});

describe('contact shadows under vessels (audit F14)', () => {
  it('one instanced draw for all, placed and removed by id, never drawn when off or empty', () => {
    const contact = new ContactShadows(4);
    contact.visible = true;
    expect(contact.mesh.visible).toBe(false); // empty
    contact.place('a', 1, 0.9, 2, 0.05);
    contact.place('b', 3, 0.9, 4, 0.1);
    expect([contact.mesh.count, contact.mesh.visible]).toEqual([2, true]);
    const at = new THREE.Matrix4();
    contact.mesh.getMatrixAt(1, at);
    const placed = new THREE.Vector3().setFromMatrixPosition(at);
    expect([placed.x, placed.y, placed.z]).toEqual([3, expect.closeTo(0.901, 6), 4]);
    contact.remove('a'); // the last takes its slot
    expect(contact.placed).toEqual(['b']);
    contact.mesh.getMatrixAt(0, at);
    expect(new THREE.Vector3().setFromMatrixPosition(at).x).toBe(3);
    contact.visible = false;
    expect(contact.mesh.visible).toBe(false);
    contact.dispose();
  });

  it('hides while its height moves (falling, lifted), and uploads only a change', () => {
    const contact = new ContactShadows(2);
    const radius = () => contact.mesh.instanceMatrix.array[0];
    contact.place('a', 1, 0.9, 2, 0.05);
    expect(radius()).toBeCloseTo(0.05, 6);
    const uploads = contact.mesh.instanceMatrix.version;
    contact.place('a', 1, 0.9, 2, 0.05); // at rest
    expect(contact.mesh.instanceMatrix.version).toBe(uploads);
    contact.place('a', 1, 0.85, 2, 0.05); // falling
    expect(radius()).toBe(0);
    contact.place('a', 1.01, 0.85, 2, 0.05); // landed: still in height, sliding is fine
    expect(radius()).toBeCloseTo(0.05, 6);
    contact.dispose();
  });

  it('lies under the drawn box’s lowest point, upright or on its side; none while hidden', async () => {
    const { game, view } = await follow('medium');
    const group = new THREE.Group();
    group.position.set(1, 1, 2);
    const vessel = {
      group,
      entity: { id: 'vessel', item: { visual: { size: [0.1, 0.2, 0.06] } } },
    };
    const shadow = () => {
      const at = new THREE.Matrix4();
      view.contact.mesh.getMatrixAt(view.contact.placed.indexOf('vessel'), at);
      const p = new THREE.Vector3().setFromMatrixPosition(at);
      return [p.y, at.elements[0]];
    };
    view.ground(vessel);
    expect(shadow()).toEqual([expect.closeTo(0.901, 6), expect.closeTo(0.06, 6)]);
    group.rotation.z = Math.PI / 2; // on its side: its width is its height now
    group.updateMatrix();
    view.ground(vessel);
    expect(shadow()).toEqual([expect.closeTo(0.951, 6), 0]); // tipping: its foot moved
    view.ground(vessel); // come to rest
    expect(shadow()).toEqual([expect.closeTo(0.951, 6), expect.closeTo(0.06, 6)]);
    vi.spyOn(game.interaction, 'heldId', 'get').mockReturnValue('vessel');
    view.ground(vessel);
    expect(shadow()[1]).toBe(0); // held: it would float
    vi.restoreAllMocks();
    group.visible = false; // taken, or worn
    view.ground(vessel);
    expect(shadow()[1]).toBe(0);
  });

  it.each(GRAPHICS_QUALITIES)('%s: shown from Medium up only', async (quality) => {
    const { game, view } = await follow(quality);
    await game.scenes.load('chemistry-lab');
    view.contact.place('vessel', 0, 0.9, 0, 0.05);
    expect(view.contact.mesh.visible).toBe(QUALITY[quality].contactShadows);
  });
});

describe('live screens by preset (audit F2, review HIGH-2)', () => {
  it('Low keeps the 640 px/m of before, Medium and High 1600: resized and painted anew on a change', async () => {
    const { game, view } = await follow('low');
    const ctx = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      strokeRect: vi.fn(),
    };
    const canvas = { width: 300, height: 150, getContext: () => ctx };
    vi.stubGlobal('document', { createElement: () => canvas });
    const experiment = view.experiment as unknown as ExperimentView;
    const entity = {
      id: 'room/screen',
      roomId: 'room',
      params: { station: 'none' },
      item: { visual: { screen: 'graph', size: [1.2, 0.7, 0.05] } },
    } as unknown as WorldEntity;
    const group = new THREE.Group();
    experiment.addScreen(entity, group);
    expect([canvas.width, canvas.height]).toEqual([768, 448]);
    // Uploaded as linear RGBA8, decoded from sRGB in the shader (audit §12: the sRGB upload stalls).
    const { material } = group.children[0] as THREE.Mesh<
      THREE.PlaneGeometry,
      THREE.MeshBasicMaterial
    >;
    expect(material.map?.colorSpace).toBe(THREE.NoColorSpace);
    expect(material.defines).toHaveProperty('DECODE_VIDEO_TEXTURE');
    game.setGraphicsQuality('medium');
    expect([canvas.width, canvas.height]).toEqual([1920, 1120]);
    expect(ctx.fillRect).toHaveBeenCalledTimes(2); // painted again at its new size
    game.setGraphicsQuality('high'); // the same density: left as it is
    expect(ctx.fillRect).toHaveBeenCalledTimes(2);
    game.setGraphicsQuality('low');
    expect([canvas.width, canvas.height]).toEqual([768, 448]);
    experiment.removeScreen(entity.id);
  });
});

describe('the liquid look (audit F13)', () => {
  it('a multiplying filter coloured only by the transmittance given, its sheen shown from Medium up', () => {
    const { filter, sheen } = liquidLook();
    expect(filter.blending).toBe(THREE.MultiplyBlending);
    const first = transmit(filter, 0.2, 0.5, 0.9).color.toArray();
    transmit(filter, 0.7, 0.1, 0.3);
    expect(transmit(filter, 0.2, 0.5, 0.9).color.toArray()).toEqual(first); // the state alone
    first.forEach((v, i) => expect(v).toBeCloseTo([0.2, 0.5, 0.9][i]!, 12)); // linear, as given
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), sheen);
    for (const quality of GRAPHICS_QUALITIES) {
      const finishes = new Finishes(QUALITY[quality]);
      finishes.adopt(mesh);
      expect(sheen.visible, quality).toBe(QUALITY[quality].sheen);
      finishes.dispose();
    }
    filter.dispose();
    sheen.dispose();
  });

  it('a lit rim added at the edge and a darker edge to the filter, never coloured', () => {
    const { filter, rim, sheen } = liquidLook();
    expect(rim.blending).toBe(THREE.AdditiveBlending);
    expect(rim.color.getHex()).toBe(0xffffff); // the room's light, not the model's colour
    const compiled = (m: THREE.Material) => {
      const s = {
        uniforms: {},
        vertexShader: 'void main() {\n#include <project_vertex>\n}',
        fragmentShader: 'void main() {\n#include <opaque_fragment>\n}',
      } as unknown as THREE.WebGLProgramParametersWithUniforms;
      m.onBeforeCompile(s, {} as THREE.WebGLRenderer);
      if (m === rim)
        tint = (s.uniforms as Record<string, { value: THREE.Color }>).liquidTint?.value;
      return s.fragmentShader;
    };
    let tint: THREE.Color | undefined;
    expect(compiled(filter)).toContain(`mix( 1.0, ${LIQUID_EDGE.toFixed(3)}`);
    expect(compiled(rim)).toContain(`${LIQUID_RIM.toFixed(3)} * liquidGraze`);
    expect(compiled(rim)).toContain(`${LIQUID_FILL.toFixed(3)} * liquidTint * liquidTint`);
    expect(LIQUID_FILL).toBeLessThan(0.2); // the room seen through it, not a milky body
    expect(LIQUID_EDGE).toBeGreaterThan(0.5); // a hint at the edge, not a dye
    // The colour stays the model's transmittance alone.
    transmit(filter, 0.2, 0.5, 0.9);
    expect(tint).toBe(filter.color); // the light through it takes the model's colour, as it changes
    filter.color.toArray().forEach((v, i) => expect(v).toBeCloseTo([0.2, 0.5, 0.9][i]!, 12));
    for (const m of [filter, rim, sheen]) m.dispose();
  });
});

describe('no preset reaches the simulation', () => {
  const LAB = 'physics-lab';
  const STAND = `${LAB}/spring`;

  /** A Hooke's law run to its end at 60 fps, `switching` the preset every half second. */
  async function hookesLaw(quality: GraphicsQuality, switching = false) {
    const { game } = await follow(quality);
    await game.scenes.load(LAB);
    expect(game.interaction.perform(`${LAB}/spring-run`, 'run')).toBe(true);
    const session = game.experiments.find(STAND);
    for (let frame = 1; frame <= 60 * 60 && session?.run?.status !== 'completed'; frame++) {
      if (switching && frame % 30 === 0) {
        game.setGraphicsQuality(GRAPHICS_QUALITIES[(frame / 30) % GRAPHICS_QUALITIES.length]!);
      }
      game.update(1 / 60);
    }
    const run = session?.run;
    expect(run?.status).toBe('completed');
    return {
      endReason: run?.endReason,
      time: run?.time,
      results: run?.results,
      samples: run?.sampleValues.map((v) => Array.from(v.subarray(0, run.sampleCount))),
      history: session?.history.map((r) => r.results),
    };
  }

  it("a Hooke's law run gives the same samples and results under every preset, and switching", async () => {
    const reference = await hookesLaw('medium');
    expect(reference.endReason).toBe('model');
    expect(reference.samples?.[0]?.length).toBeGreaterThan(100);
    for (const quality of GRAPHICS_QUALITIES) {
      expect(await hookesLaw(quality), quality).toEqual(reference);
    }
    expect(await hookesLaw('low', true), 'switched mid-run').toEqual(reference);
    // Six real runs (one a preset and the switch): 1.8 s alone, past 5 s beside the whole suite.
  }, 20_000);
});

describe('the glass edge (graphics-fidelity audit §4)', () => {
  it.each(GRAPHICS_QUALITIES)(
    'every glassware material gets the Fresnel edge on %s, no extra draw',
    (quality) => {
      const finishes = new Finishes(QUALITY[quality]);
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(),
        new THREE.MeshStandardMaterial(GLASSWARE_LOOK),
      );
      const paint = new THREE.Mesh(
        new THREE.BoxGeometry(),
        new THREE.MeshStandardMaterial({ color: 'red' }),
      );
      finishes.adopt(glass);
      finishes.adopt(paint);
      // The hook as a value, compared, never called through the material.
      const hook = (m: THREE.Mesh) => (m.material as { onBeforeCompile: unknown }).onBeforeCompile;
      expect(hook(glass)).toBe(glassEdge);
      expect(hook(paint)).not.toBe(glassEdge);
      const shader = { fragmentShader: 'a\n#include <opaque_fragment>\nb' };
      glassEdge(shader);
      expect(shader.fragmentShader).toContain('glassEdge');
      expect(shader.fragmentShader.indexOf('opaque_fragment')).toBeLessThan(
        shader.fragmentShader.indexOf('glassEdge'),
      );
    },
  );
});

describe('the light switch: lighting the switch’s room follows its state', () => {
  it.each(['low', 'medium', 'high'] as const)(
    '%s: off darkens the Chemistry Lab, on gives it back',
    async (quality) => {
      const { game, view } = await follow(quality);
      await game.scenes.load('chemistry-lab');
      const SWITCH = 'chemistry-lab/light-switch';
      const lit = () => view.roomLights.slots.filter((s) => s.intensity > 0).length;
      const direct = () => [view.sun.intensity, view.fill.intensity];
      const before = {
        lit: lit(),
        direct: direct(),
        hemisphere: view.hemisphere.intensity,
        environment: view.scene.environmentIntensity,
      };
      if (quality !== 'low') expect(before.lit).toBeGreaterThan(0);
      expect(game.interaction.perform(SWITCH, 'lights-off')).toBe(true);
      expect(game.entityStates.get(SWITCH, 'lightsOff')).toBe(true); // saved with the world
      view.update(0);
      // The practice room's own lights stay (Phase X: no switch of its own).
      expect(lit()).toBe(quality === 'low' ? 0 : 3);
      // Low's sun and fill (no room of their own) where the player stands; the room's reflection
      // and scattered light per room (Phú: nothing but the instruments' own lamps and screens
      // should stay bright).
      direct().forEach((v, i) => expect(v).toBeCloseTo((before.direct[i] ?? 0) * 0.12, 6));
      expect(view.hemisphere.intensity).toBe(before.hemisphere);
      expect(view.scene.environmentIntensity).toBe(before.environment);
      const chemistry = surfaces(view, 'chemistry-lab');
      expect(chemistry.length).toBeGreaterThan(50);
      for (const m of chemistry) expect(indirect(m)).toBeCloseTo(0.12, 9);
      expect(game.interaction.perform(SWITCH, 'lights-on')).toBe(true);
      view.update(0);
      expect(lit()).toBe(before.lit);
      expect(direct()).toEqual(before.direct);
      for (const m of surfaces(view, 'chemistry-lab')) expect(indirect(m)).toBe(1);
    },
  );

  it('a dark lab seen from the lit hub stays dark; the hub stays lit (Phú, 2026-11-03)', async () => {
    const { game, view } = await follow('high');
    await game.scenes.load('simlab-hub');
    game.entityStates.set('chemistry-lab/light-switch', 'lightsOff', true); // left off earlier
    expect(await game.scenes.attach('chemistry-lab')).toBeNull(); // its door opened
    view.update(0);
    const lab = surfaces(view, 'chemistry-lab');
    const hub = surfaces(view, 'simlab-hub');
    expect(lab.length).toBeGreaterThan(50);
    expect(hub.length).toBeGreaterThan(50);
    for (const m of lab) expect(indirect(m)).toBeCloseTo(0.12, 9);
    for (const m of hub) expect(indirect(m)).toBe(1);
    expect(view.hemisphere.intensity).toBeGreaterThan(0); // the hub's ambient, unchanged
    // Lit again from the hub: the lab gets its light back.
    game.entityStates.set('chemistry-lab/light-switch', 'lightsOff', false);
    view.update(0);
    for (const m of surfaces(view, 'chemistry-lab')) expect(indirect(m)).toBe(1);
  });

  it('paints its print, marks and a thermometer’s spirit: lit by the room, never self-lit', async () => {
    const { game, view } = await follow('high');
    await game.scenes.load('chemistry-lab');
    const unlit: string[] = [];
    view.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (
        m?.type === 'MeshBasicMaterial' &&
        ['print', 'mark', 'scale', 'bulb', 'column'].includes(o.name)
      ) {
        unlit.push(o.name);
      }
    });
    expect(unlit).toEqual([]);
  });
});
