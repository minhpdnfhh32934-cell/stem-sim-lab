import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { ItemDefinition } from '../../gameplay/item';
import type { Prop } from '../../gameplay/props';
import { PlacementSchema } from '../../world/definitions';
import { entityFromPlacement, type WorldEntity } from '../../world/World';
import { DecorBatches } from './decorBatches';
import { Palette } from './palette';
import { PropCache, type PropPart } from './props';
import { testItem } from './props/testing';

// Decor drawn in batches: per scene and item, one InstancedMesh per part, a matrix per copy;
// copies come and go at once; each scene is built and freed on its own; and everything made for
// them — instance buffers, prop geometries, primitives, materials — is freed in the end, as the
// renderer will (DecorBatches, then its prop cache, primitives and palette).

const DECOR = { tags: ['decor'] };
const column = testItem(
  'hub-column',
  { shape: 'cylinder', size: [0.7, 9, 0.7], color: '#e6e9eb', material: 'satin' },
  { ...DECOR, physical: { massKg: 900, body: 'static' } },
);
// No prop: drawn as its primitive.
const beam = testItem('hub-beam', { size: [26, 0.6, 0.45], material: 'painted' }, DECOR);
const panel = testItem('hub-light', { size: [2.4, 0.08, 0.8], material: 'light' }, DECOR);
const PROP_OF = new Map<string, Prop>([[column.id, 'column']]);

/** What the renderer will wire: the prop cache, its primitives, the palette, the batches. */
function renderer() {
  const scene = new THREE.Group();
  const palette = new Palette();
  const props = new PropCache();
  const primitives = new Map<string, THREE.BufferGeometry>();
  const partsOf = (item: ItemDefinition): readonly PropPart[] => {
    const prop = PROP_OF.get(item.id);
    const parts = prop ? props.get(prop, item.visual.size) : null;
    if (parts) return parts;
    let geometry = primitives.get(item.id);
    if (!geometry) {
      const [w, h, d] = item.visual.size;
      geometry = new THREE.BoxGeometry(w, h, d);
      primitives.set(item.id, geometry);
    }
    return [{ finish: 'body', geometry, casts: true }];
  };
  return { scene, palette, props, primitives, decor: new DecorBatches(scene, palette, partsOf) };
}

let placed = 0;
const copy = (item: ItemDefinition, x: number, rotationY = 0) =>
  entityFromPlacement(
    'simlab-hub',
    PlacementSchema.parse({ id: `p${++placed}`, item: item.id, position: [x, 0, -3], rotationY }),
    item,
  );

const drawn = (scene: THREE.Object3D) => scene.children as THREE.InstancedMesh[];
const of = (scene: THREE.Object3D, item: ItemDefinition, palette: Palette) =>
  drawn(scene).filter(
    (m) =>
      m.material === palette.surface(item.visual.color, item.visual.material) ||
      (item === column && m.material === palette.finish('stone')),
  );
const pose = ({ pose: p }: WorldEntity) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(...p.position),
    new THREE.Quaternion(...p.rotation),
    new THREE.Vector3(1, 1, 1),
  );
const matrixAt = (mesh: THREE.InstancedMesh, i: number) => mesh.getMatrixAt(i, new THREE.Matrix4());
const expectMatrix = (actual: THREE.Matrix4, expected: THREE.Matrix4) =>
  actual.elements.forEach((v, i) => expect(v).toBeCloseTo(expected.elements[i] ?? NaN, 6));
const disposed = (target: THREE.EventDispatcher<{ dispose: object }>) => {
  const seen = { done: false };
  target.addEventListener('dispose', () => (seen.done = true));
  return seen;
};

describe('decor batches', () => {
  it('draw nothing until the scene is built, then one instanced mesh per part, at the copies’ poses', () => {
    const { scene, palette, props, decor } = renderer();
    const copies = [copy(column, -3.5), copy(column, 3.5, Math.PI / 2), copy(column, 9.5)];
    for (const c of copies) decor.add('simlab-hub', c);
    expect(scene.children).toHaveLength(0);
    decor.build('simlab-hub');
    const parts = props.get('column', column.visual.size) ?? [];
    expect(drawn(scene)).toHaveLength(parts.length); // body and stone
    drawn(scene).forEach((mesh, k) => {
      expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
      expect(mesh.geometry).toBe(parts[k]?.geometry); // shared, not copied
      expect(mesh.count).toBe(3);
      copies.forEach((c, i) => expectMatrix(matrixAt(mesh, i), pose(c)));
      expect(mesh.castShadow).toBe(true);
      expect(mesh.receiveShadow).toBe(true);
    });
    expect(drawn(scene)[0]?.material).toBe(palette.surface('#e6e9eb', 'satin')); // the body
    expect(drawn(scene)[1]?.material).toBe(palette.finish('stone'));
  });

  it('take a copy out at once, the last copy moving into its place', () => {
    const { scene, decor } = renderer();
    const [a, b, c] = [copy(column, -3.5), copy(column, 3.5), copy(column, 9.5)];
    for (const e of [a, b, c]) decor.add('simlab-hub', e);
    decor.build('simlab-hub');
    const before = [...drawn(scene)];
    expect(decor.remove(a.id)).toBe(true);
    expect(drawn(scene)).toEqual(before); // the same meshes, nothing rebuilt
    for (const mesh of drawn(scene)) {
      expect(mesh.count).toBe(2);
      expectMatrix(matrixAt(mesh, 0), pose(c));
      expectMatrix(matrixAt(mesh, 1), pose(b));
    }
    expect(decor.remove(c.id)).toBe(true); // the last one
    for (const mesh of drawn(scene)) expect(mesh.count).toBe(1);
    expect(decor.remove(c.id)).toBe(false);
    expect(decor.remove('simlab-hub/nothing')).toBe(false);
  });

  it('redraw an item when a copy is added after the build, freeing the old meshes', () => {
    const { scene, palette, decor } = renderer();
    decor.add('simlab-hub', copy(beam, 0));
    decor.add('simlab-hub', copy(panel, 0));
    decor.build('simlab-hub');
    const [oldBeam] = of(scene, beam, palette);
    const gone = disposed(oldBeam!);
    const late = copy(beam, 5);
    decor.add('simlab-hub', late);
    const [newBeam] = of(scene, beam, palette);
    expect(gone.done).toBe(true);
    expect(scene.children).not.toContain(oldBeam);
    expect(newBeam?.count).toBe(2);
    expectMatrix(matrixAt(newBeam!, 1), pose(late));
    expect(of(scene, panel, palette)[0]?.count).toBe(1); // the other item untouched
    expect(of(scene, panel, palette)[0]?.castShadow).toBe(false); // lit: never casts
  });

  it('build and free each scene on its own; a built scene without decor draws a later copy', () => {
    const { scene, decor } = renderer();
    const here = copy(column, 0);
    decor.add('simlab-hub', here);
    decor.build('simlab-hub');
    const hub = [...drawn(scene)];
    const there = copy(beam, 18);
    decor.add('physics-lab', there);
    decor.build('physics-lab');
    const lab = drawn(scene).filter((m) => !hub.includes(m));
    expect(lab).toHaveLength(1);
    const freed = disposed(lab[0]!);
    decor.clear('physics-lab');
    expect(freed.done).toBe(true);
    expect(drawn(scene)).toEqual(hub); // the hub's stay as they were
    expect(decor.remove(there.id)).toBe(false); // forgotten with its scene
    expect(decor.remove(here.id)).toBe(true);
    decor.build('teacher-room'); // nothing in it yet
    decor.add('teacher-room', copy(beam, 0));
    expect(drawn(scene).filter((m) => !hub.includes(m))).toHaveLength(1);
  });

  it('free everything made for them in the end: meshes, buffers, geometries, materials', () => {
    const { scene, palette, props, primitives, decor } = renderer();
    const freed = new Map<unknown, boolean>(); // everything drawn with, and whether it was freed
    const track = (thing: unknown) => {
      if (freed.has(thing)) return;
      freed.set(thing, false);
      (thing as THREE.EventDispatcher<{ dispose: object }>).addEventListener('dispose', () =>
        freed.set(thing, true),
      );
    };
    scene.addEventListener('childadded', ({ child }) => {
      const mesh = child as THREE.InstancedMesh;
      for (const thing of [mesh, mesh.geometry, mesh.material]) track(thing);
    });
    for (const [room, x] of [
      ['simlab-hub', 0],
      ['physics-lab', 18],
    ] as const) {
      for (const item of [column, beam, panel]) decor.add(room, copy(item, x));
      decor.build(room);
    }
    decor.add('simlab-hub', copy(column, 3)); // the columns redrawn
    decor.build('simlab-hub'); // and the whole hub
    decor.clear('physics-lab');
    decor.dispose();
    props.dispose();
    for (const geometry of primitives.values()) geometry.dispose();
    palette.dispose();
    expect(scene.children).toHaveLength(0);
    expect([...freed].filter(([, done]) => !done)).toEqual([]);
    // 4 meshes per build (column: body and stone; beam; panel), two builds each for the hub,
    // the columns redrawn once; 4 geometries and 4 materials, shared by both scenes.
    const meshes = [...freed.keys()].filter((t) => t instanceof THREE.InstancedMesh);
    expect(meshes).toHaveLength(4 + 4 + 2 + 4);
    expect(freed.size).toBe(14 + 4 + 4);
  });

  it('accept only decor with nothing to do and nothing of its own to show', () => {
    expect(DecorBatches.accepts(column)).toBe(true);
    expect(DecorBatches.accepts(testItem('plain'))).toBe(false); // not tagged
    const refused: [Record<string, unknown>, Record<string, unknown>][] = [
      [{}, { interactions: ['inspect'] }],
      [{}, { physical: { massKg: 1, body: 'dynamic' } }],
      [{ label: { text: 'SIMLAB' } }, {}],
      [{ screen: 'status' }, {}],
      [{ stream: { length: 0.3, color: '#9fd3ff' } }, {}],
      [{ openBox: { center: [0, 0, -0.2], size: [1, 1, 0.1] } }, {}],
      [{ model: 'desk' }, {}],
      [{}, { dropTower: { landing: [0, 0, 0], ballRadius: 0.02 } }],
    ];
    for (const [visual, fields] of refused) {
      expect(DecorBatches.accepts(testItem('x', visual, { ...DECOR, ...fields }))).toBe(false);
    }
  });
});
