import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { StationView } from '../../gameplay/experiment/StationSystem';
import type { ContainerDefinition } from '../../gameplay/item';
import { type ContainerState, containerOf, heldBelow, levelIn } from '../../simulation/liquid';
import type { WorldEntity } from '../../world/World';
import {
  heldBelow as chemistryHeldBelow,
  levelIn as chemistryLevelIn,
} from '../labVisuals/chemistry';
import {
  type ContainerSource,
  ContainerViews,
  glassPoints,
  levelOf,
  LIQUID_BODY,
  liquidPoints,
  type PourSource,
  shapeOf,
  WALL,
} from './ContainerView';

// A 5 cm wide, 10 cm tall straight beaker (inner profile, item frame from its centre) and a
// volumetric flask with a bulb, a neck and a ring mark.
const BEAKER: [number, number][] = [
  [0.025, -0.05],
  [0.025, 0.05],
];
const FLASK: [number, number][] = [
  [0.0, -0.07],
  [0.025, -0.07],
  [0.025, 0.0],
  [0.006, 0.03],
  [0.006, 0.07],
];
const beaker: ContainerDefinition = {
  capacityMl: Math.PI * 0.025 ** 2 * 0.1 * 1e6,
  profile: BEAKER,
  mouth: { center: [0, 0.05, 0], radius: 0.025 },
  closable: false,
};

function entity(
  id: string,
  container: ContainerDefinition,
  params: Record<string, unknown> = {},
  prop?: string,
): WorldEntity {
  return {
    id,
    roomId: 'lab',
    params,
    pose: { position: [0, 1, 0], rotation: [0, 0, 0, 1] },
    item: { id: 'x', container, visual: { prop, size: [0.06, 0.12, 0.06], material: 'glass' } },
  } as unknown as WorldEntity;
}

/** A source over mutable states; `bump` is a write by the station. */
function fakeSource(
  states: Record<string, ContainerState>,
  views: Record<string, StationView> = {},
) {
  const versions: Record<string, number> = {};
  const source: ContainerSource = {
    container: (id) => states[id] ?? null,
    containerVersion: (id) => versions[id] ?? 0,
    view: (id) => views[id] ?? null,
  };
  return {
    source,
    bump: (id: string) => {
      versions[id] = (versions[id] ?? 0) + 1;
    },
  };
}

const idle: PourSource = { pouringFrom: null, pouringInto: null };
const make = (source: ContainerSource, pour: PourSource = idle) => {
  return { views: new ContainerViews({ source, pour }) };
};

function mount(views: ContainerViews, e: WorldEntity) {
  const group = new THREE.Group();
  group.position.fromArray(e.pose.position);
  const box = new THREE.Mesh();
  group.add(box);
  return { group, box, drawn: views.mount(e, group, box) };
}
const child = (group: THREE.Group, name: string) => group.getObjectByName(name) as THREE.Mesh;
/** A clear liquid's filter: the body's own dimming alone. */
const CLEAR = [...LIQUID_BODY];

describe('the level mapping', () => {
  it('puts a straight vessel level where its volume says', () => {
    const shape = shapeOf(BEAKER);
    const out = { y: 0, r: 0 };
    for (const ml of [10, 50, 100]) {
      levelOf(shape, ml * 1000, out);
      expect(out.y - -0.05).toBeCloseTo((ml * 1e-6) / (Math.PI * 0.025 ** 2), 9);
      expect(out.r).toBeCloseTo(0.025, 12);
    }
  });

  it('is exactly the mapping the 2D chemistry visuals use, for a bulb and a neck', () => {
    const shape = shapeOf(FLASK);
    expect(Array.from(shape.held)).toEqual(Array.from(chemistryHeldBelow(FLASK)));
    expect(Array.from(shape.held)).toEqual(Array.from(heldBelow(FLASK)));
    for (const ml of [0.5, 20, 40, 50, 57.9]) {
      const a = { y: 0, r: 0 };
      const b = { y: 0, r: 0 };
      levelOf(shape, ml * 1000, a);
      chemistryLevelIn(FLASK, chemistryHeldBelow(FLASK), ml, b);
      expect(a).toEqual(b);
    }
  });

  it('draws the glass and the liquid from the same inside', () => {
    // The liquid stands INSET (0.3 mm) off the glass's inner floor, as off its walls.
    expect(liquidPoints(FLASK)[0]).toEqual([0, -0.07 + 0.0003]);
    const glass = glassPoints(BEAKER);
    expect(glass[0]).toEqual([0, -0.05 - WALL]);
    // the inside comes back down to the floor
    expect(glass[glass.length - 1]).toEqual([0, -0.05]);
    expect(shapeOf(FLASK).width).toBeCloseTo(0.05, 12);
  });
});

describe('ContainerViews', () => {
  it('shows the liquid only while there is some, at the height its volume gives', () => {
    const states = { b: containerOf(null, 0) };
    const { source, bump } = fakeSource(states);
    const { views } = make(source);
    const { group, box, drawn } = mount(views, entity('b', beaker));
    expect(drawn).toBe(true);
    expect(box.visible).toBe(false); // its glass is drawn instead of the box
    expect(child(group, 'liquid').visible).toBe(false);
    views.update(1 / 60);

    states.b = containerOf('water', 100_000); // 100 mL
    bump('b');
    views.update(1 / 60);
    const surface = child(group, 'liquid-surface');
    expect(child(group, 'liquid').visible).toBe(true);
    expect(surface.visible).toBe(true);
    const h = 100e-6 / (Math.PI * 0.025 ** 2);
    expect(surface.position.y).toBeCloseTo(-0.05 + h, 9);
    expect(surface.scale.x).toBeCloseTo(0.025 - 0.0003, 9);
    // The meniscus line is the surface's own child: at the volume's level, never elsewhere.
    expect(surface.getObjectByName('meniscus')?.parent).toBe(surface);
    views.dispose();
  });

  it('keeps the surface flat in the world as the glass tilts, and the cut plane at its height', () => {
    const states = { b: containerOf('water', 100_000) };
    const { source } = fakeSource(states);
    const { views } = make(source);
    const { group } = mount(views, entity('b', beaker));
    const body = child(group, 'liquid');
    const plane = (body.material as THREE.MeshBasicMaterial).clippingPlanes?.[0];
    views.update(1 / 60);
    const level = child(group, 'liquid-surface').position.y;
    expect(plane?.normal.toArray()).toEqual([0, -1, 0]);
    expect(plane?.constant).toBeCloseTo(1 + level, 9);

    group.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.7);
    views.update(1 / 60);
    // the axis point at the drawn height, turned with the glass
    expect(plane?.constant).toBeCloseTo(1 + level * Math.cos(0.7), 9);
    // the disc is turned against the glass: horizontal in the world
    const surface = child(group, 'liquid-surface');
    const up = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(surface.quaternion)
      .applyQuaternion(group.quaternion);
    expect(up.y).toBeCloseTo(1, 9);
    views.dispose();
  });

  it('builds no geometry after the first frame, and one pair per profile', () => {
    const states = { a: containerOf('water', 10_000), b: containerOf('water', 20_000) };
    const { source, bump } = fakeSource(states);
    const { views } = make(source);
    const one = mount(views, entity('a', beaker));
    const two = mount(views, entity('b', beaker));
    views.update(1 / 60);
    expect(views.geometriesBuilt).toBe(2);
    const geometries = [child(one.group, 'liquid').geometry, child(two.group, 'glass').geometry];
    for (let ul = 0; ul <= 100_000; ul += 5000) {
      states.a = containerOf('water', ul);
      bump('a');
      views.update(1 / 60);
    }
    expect(views.geometriesBuilt).toBe(2);
    expect(child(one.group, 'liquid').geometry).toBe(geometries[0]);
    expect(child(two.group, 'glass').geometry).toBe(geometries[1]);
    expect(child(one.group, 'liquid').geometry).toBe(child(two.group, 'liquid').geometry);
    views.dispose();
  });

  it('puts the ring mark at the volume of volumetric glassware, and a stopper only when closed', () => {
    const flask: ContainerDefinition = {
      capacityMl: 60,
      fillLimitMl: 50,
      profile: FLASK,
      mouth: { center: [0, 0.07, 0], radius: 0.006 },
      closable: true,
    };
    const states = { f: containerOf('water', 10_000) };
    const { source, bump } = fakeSource(states);
    const { views } = make(source);
    const { group } = mount(views, entity('f', flask));
    const at = { y: 0, r: 0 };
    levelIn(FLASK, heldBelow(FLASK), 50, at);
    expect(child(group, 'mark').position.y).toBe(at.y);
    expect(child(group, 'stopper').visible).toBe(false);
    states.f = { ...containerOf('water', 10_000), closed: true };
    bump('f');
    views.update(1 / 60);
    expect(child(group, 'stopper').visible).toBe(true);
    views.dispose();
  });

  it('draws no glass of its own where a prop is the glass, and no mark at the brim', () => {
    const { source } = fakeSource({ b: containerOf('water', 1000) });
    const { views } = make(source);
    const full = { ...beaker, fillLimitMl: beaker.capacityMl };
    const { group, box, drawn } = mount(views, entity('b', full, {}, 'flask'));
    expect(drawn).toBe(false);
    expect(box.visible).toBe(true);
    expect(group.getObjectByName('glass')).toBeUndefined();
    expect(group.getObjectByName('mark')).toBeUndefined();
    expect(child(group, 'liquid')).toBeDefined(); // the liquid is still drawn
    views.dispose();
  });

  it('keeps a bench’s body (a colorimeter’s case) when it draws the bench’s cuvette', () => {
    const { source } = fakeSource({ c: containerOf(null, 0) });
    const { views } = make(source);
    const bench = entity('c', beaker);
    Object.assign(bench.item, { bench: { model: 'dilution-colorimeter', top: [0, 0, 0] } });
    const { group, box, drawn } = mount(views, bench);
    expect(drawn).toBe(true);
    expect(child(group, 'glass')).toBeDefined(); // the cuvette
    expect(box.visible).toBe(true); // the case, never hidden for it
    views.dispose();
  });

  it('shows a bench readout only while a receiver-only container holds a sample', () => {
    const states = { c: containerOf(null, 0) };
    const { source, bump } = fakeSource(states);
    const { views } = make(source);
    const group = new THREE.Group();
    const rig = new THREE.Group();
    const reading = new THREE.Group();
    reading.name = 'reading';
    rig.add(reading);
    group.add(rig);
    views.mount(entity('c', beaker), group, new THREE.Mesh());
    expect(reading.visible).toBe(false);
    states.c = containerOf('water', 1000);
    bump('c');
    views.update(1 / 60);
    expect(reading.visible).toBe(true);
    views.dispose();
  });

  it('colours the liquid from the station model, never from the contents', () => {
    const sample = { concentration: NaN };
    const parameters: Record<string, number> = {};
    const view = {
      kind: 'bench',
      id: 'lab/station',
      definition: {
        model: 'chemistry.dilution',
        workspace: {
          materials: [{ id: 'stock-20', sets: { parameter: 'stockConcentration', value: 2e-5 } }],
        },
      },
      pose: { status: 'idle', parameters, sample },
    } as unknown as StationView;
    const states = {
      stock: containerOf('stock-20', 5000),
      mix: containerOf('stock-20', 5000),
      water: containerOf('water', 5000),
    };
    states.mix.contents.water = 21_000;
    const { source } = fakeSource(states, { 'lab/station': view });
    const { views } = make(source);
    const flask = (id: string) => mount(views, entity(id, beaker, { station: 'station' }));
    const stock = flask('stock');
    const mix = flask('mix');
    const water = flask('water');
    const colour = (g: THREE.Group) =>
      (child(g, 'liquid').material as THREE.MeshBasicMaterial).color.toArray();
    views.update(1 / 60);
    // the stock is violet; the mixture has no run yet (no reading): clear; water: clear. Clear is
    // the liquid body's own constant dimming (graphics-fidelity audit §4), never a state's colour.
    expect(colour(stock.group)[1]).toBeLessThan(0.5);
    expect(colour(mix.group)).toEqual(CLEAR);
    expect(colour(water.group)).toEqual(CLEAR);
    // the run says 2 µmol/L: the mixture is drawn from that, less dense than the stock
    sample.concentration = 2e-6;
    views.update(1 / 60);
    expect(colour(mix.group)[1]).toBeGreaterThan(colour(stock.group)[1] ?? 0);
    expect(colour(mix.group)[1]).toBeLessThan(CLEAR[1] ?? 1);
    // the run is discarded (RESET): the mixture has nothing to read again, and goes clear
    sample.concentration = NaN;
    views.update(1 / 60);
    expect(colour(mix.group)).toEqual(CLEAR);
    views.dispose();
  });

  it('draws the stream only while the source keeps being written, from the spout to the surface', () => {
    const pouring: ContainerDefinition = {
      ...beaker,
      pour: {
        spout: [0, 0.05, 0.03],
        trigger: 'tilt',
        minTiltDeg: 70,
        fullTiltDeg: 115,
        rateMlPerS: 8,
      },
    };
    const states = { a: containerOf('water', 50_000), b: containerOf('water', 20_000) };
    const { source, bump } = fakeSource(states);
    const pour = { pouringFrom: 'a' as string | null, pouringInto: 'b' as string | null };
    const { views } = make(source, pour);
    mount(views, entity('a', pouring));
    const target = mount(views, entity('b', beaker));
    target.group.position.set(0.03, 0.2, 0.03);
    const stream = views.group.children[0] as THREE.Mesh;
    views.update(1 / 60);
    expect(stream.visible).toBe(true);
    // nothing written for longer than the hold: it stops
    for (let i = 0; i < 20; i++) views.update(1 / 60);
    expect(stream.visible).toBe(false);
    bump('a');
    views.update(1 / 60);
    expect(stream.visible).toBe(true);
    // from the spout (world y 1.05) to the receiver's surface
    const surface = child(target.group, 'liquid-surface').position.y;
    expect(stream.position.y).toBeCloseTo(1.05, 9);
    expect(stream.scale.y).toBeCloseTo(1.05 - (0.2 + surface), 6);
    pour.pouringFrom = null;
    views.update(1 / 60);
    expect(stream.visible).toBe(false);
    views.dispose();
  });
});
