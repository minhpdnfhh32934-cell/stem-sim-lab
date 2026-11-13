import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import type { SessionState } from '../../../simulation/ExperimentSession';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { inclineModel } from '../../../simulation/models/incline';
import { inclineRamp } from './incline-ramp';

// The inclined plane against its item (as drafted for content): the frame and the rig at every
// angle the dial gives stay in the item's box, the base's top is the hinge line, the cross rod
// holds the ramp's underside, the block slides by the model's `distance` from the stop at L to the
// gate, the surface dial swaps the strip and the block's pad together, the masses follow m, and
// posing only assigns.

const item = ItemDefinitionSchema.parse({
  id: 'incline-ramp',
  displayName: 'Inclined plane',
  category: 'equipment',
  physical: { massKg: 9 },
  interactions: ['bench', 'inspect'],
  bench: { model: 'incline-ramp', top: [0.9, 0.026, 0] },
  visual: { shape: 'box', size: [1.95, 1.65, 0.36], color: '#59636e', material: 'painted' },
});
const [w, h, d] = item.visual.size;
const GATE_U = 0.2;
const REACH = 0.85;
const ROD = 0.006;

/** The stand's clamp boss: its top above the cross rod's centre. */
const BOSS_TOP = 0.032;

const pose = (
  status: SessionState,
  parameters: Record<string, number>,
  distance = NaN,
): BenchPose => ({ status, parameters, sample: { distance } });

const meshCount = (o: THREE.Object3D) => {
  let n = 0;
  o.traverse((c) => (n += c instanceof THREE.Mesh ? 1 : 0));
  return n;
};

function build() {
  const painted = new THREE.MeshStandardMaterial();
  const frame = inclineRamp.frame(item, painted);
  const rig = inclineRamp.rig!(item);
  const root = new THREE.Group();
  root.add(new THREE.Mesh(frame.body, painted), frame.parts, rig.group);
  const named = (name: string) => root.getObjectByName(name)!;
  return { frame, rig, root, painted, named };
}

/** The model's own distance `t` s into a run (its step, as the runtime calls it). */
function distanceAfter(inputs: Record<string, number>, t: number): number {
  const state = new Float64Array(inclineModel.variables.length);
  const all = { gravity: 9.81, ...inputs };
  inclineModel.init(all, state);
  for (let i = 0; i < Math.round(t / 0.001); i++) inclineModel.step(state, 0.001, all);
  return state[inclineModel.variables.indexOf('distance')]!;
}

describe('inclined plane bench model', () => {
  it('reads only what the incline model outputs', () => {
    expect(inclineRamp.reads).toEqual(['distance']);
    for (const v of inclineRamp.reads!) expect(inclineModel.variables).toContain(v);
  });

  it('stands on the item’s floor, the base’s top on the hinge line, inside its box at every angle', () => {
    const { rig, root, named } = build();
    root.updateMatrixWorld(true);
    const base = new THREE.Box3().setFromObject(root.children[0]!, true);
    expect(base.min.y).toBeCloseTo(-h / 2, 6); // the stand's plate on the bench
    expect(rig.group.position.toArray()).toEqual([0.9, 0.026 - h / 2, 0]); // bench.top
    // The base board's top is the hinge line: at 0° the ramp lies on it.
    const board = new THREE.Box3().setFromBufferAttribute(
      (root.children[0] as THREE.Mesh).geometry.getAttribute('position') as THREE.BufferAttribute,
    );
    expect(board.max.y).toBeCloseTo(rig.group.position.y, 6);
    const inside = new THREE.Box3(
      new THREE.Vector3(-w / 2, -h / 2, -d / 2),
      new THREE.Vector3(w / 2, h / 2, d / 2),
    ).expandByScalar(1e-6);
    for (let angle = 0; angle <= 60; angle++) {
      for (const [length, distance] of [
        [1.5, NaN],
        [1.5, 1.5],
        [0.3, 0.3],
      ] as const) {
        rig.pose(pose('running', { angle, surface: 4, mass: 2, length }, distance), 1 / 60);
        root.updateMatrixWorld(true);
        const drawn = new THREE.Box3().setFromObject(root, true);
        expect(inside.containsBox(drawn), `${angle}° L=${length} s=${distance}`).toBe(true);
      }
    }
    expect((named('masses') as THREE.InstancedMesh).count).toBe(19); // the 2 kg stack
  });

  it('tilts the ramp to the angle on the cross rod, which holds its underside', () => {
    const { rig, root, named } = build();
    const ramp = named('ramp');
    const support = named('support');
    for (const angle of [0, 1, 10, 30, 45, 60]) {
      rig.pose(pose('configured', { angle, surface: 3, mass: 0.5, length: 1 }), 1 / 60);
      root.updateMatrixWorld(true);
      expect(ramp.rotation.z).toBeCloseTo((-angle * Math.PI) / 180, 12);
      expect(support.position.x).toBeCloseTo(-REACH, 12);
      // The rod's centre, in the ramp's frame: one rod radius under its underside (y = 0).
      const rod = ramp.worldToLocal(support.getWorldPosition(new THREE.Vector3()));
      expect(rod.y).toBeCloseTo(-ROD, 9);
      expect(-rod.x).toBeLessThan(1.8 - 0.05); // still under the ramp at 60°
    }
  });

  it('slides the block by the model’s distance from the stop at L to the gate, back on RESET', () => {
    const { rig, named } = build();
    const block = named('block');
    const stop = named('release-stop');
    const settings = { angle: 30, surface: 3, mass: 0.5, length: 1 };
    rig.pose(pose('configured', settings), 1 / 60); // no run: NaN
    expect(block.position.x).toBeCloseTo(-(GATE_U + 1), 12); // waiting at the stop
    expect(stop.position.x).toBeCloseTo(-(GATE_U + 1 + 0.04 + 0.0075), 12); // just behind it
    // The stop's index (its tongue over the ruler) ends at the block's centre: it reads L.
    const stopGeometry = (stop as THREE.Mesh).geometry;
    stopGeometry.computeBoundingBox();
    // (to float32 precision: the vertices are stored as float32)
    expect(stopGeometry.boundingBox!.max.x + stop.position.x).toBeCloseTo(block.position.x, 6);
    const s = distanceAfter(settings, 0.4); // wood, 30°: a = 3.206 m/s², s ≈ 0.256 m
    expect(s).toBeCloseTo(0.5 * 3.206 * 0.16, 2);
    rig.pose(pose('running', settings, s), 1 / 60);
    expect(block.position.x).toBeCloseTo(-(GATE_U + 1 - s), 12);
    rig.pose(pose('completed', settings, 1), 1 / 60);
    expect(block.position.x).toBeCloseTo(-GATE_U, 12); // its centre on the gate's beam
    // Held (wood at 10°): the run ends at once, the block never moves.
    const held = { ...settings, angle: 10 };
    rig.pose(pose('completed', held, distanceAfter(held, 1)), 1 / 60);
    expect(block.position.x).toBeCloseTo(-(GATE_U + 1), 12);
    rig.pose(pose('configured', { ...settings, length: 1.5 }), 1 / 60); // RESET, a new L
    expect(block.position.x).toBeCloseTo(-(GATE_U + 1.5), 12);
    expect(stop.position.x).toBeCloseTo(-(GATE_U + 1.5 + 0.0475), 12);
  });

  it('passes the tallest stack under the light gate’s crossbar without touching it', () => {
    const { rig, named } = build();
    // A completed 2 kg run: the block's centre rests on the gate's beam until RESET.
    rig.pose(pose('completed', { angle: 30, surface: 4, mass: 2, length: 1 }, 1), 1 / 60);
    const masses = named('masses') as THREE.InstancedMesh;
    expect(masses.count).toBe(19);
    const stack = masses.boundingBox!.clone().translate(named('block').position); // ramp's frame
    expect(stack.min.x).toBeLessThan(-GATE_U); // right under the crossbar
    expect(stack.max.x).toBeGreaterThan(-GATE_U);
    const gate = (named('light-gate') as THREE.Mesh).geometry;
    const position = gate.getAttribute('position') as THREE.BufferAttribute;
    const index = gate.index!;
    const triangle = new THREE.Triangle();
    for (let i = 0; i < index.count; i += 3) {
      triangle.a.fromBufferAttribute(position, index.getX(i));
      triangle.b.fromBufferAttribute(position, index.getX(i + 1));
      triangle.c.fromBufferAttribute(position, index.getX(i + 2));
      expect(stack.intersectsTriangle(triangle), `gate triangle ${i / 3}`).toBe(false);
    }
  });

  it('shows the surface pair on the strip and the block’s pad, and the mass in brass plates', () => {
    const { rig, named } = build();
    const strip = named('strip') as THREE.Mesh;
    const pad = named('block-pad') as THREE.Mesh;
    const masses = named('masses') as THREE.InstancedMesh;
    const seen = new Set<THREE.Material>();
    for (const surface of [1, 2, 3, 4]) {
      rig.pose(pose('configured', { angle: 20, surface, mass: 0.1, length: 1 }), 1 / 60);
      expect(pad.material).toBe(strip.material);
      seen.add(strip.material as THREE.Material);
    }
    expect(seen.size).toBe(4);
    rig.pose(pose('configured', { angle: 20, surface: 3, mass: 0.1, length: 1 }), 1 / 60);
    const wood = strip.material;
    rig.pose(pose('configured', { angle: 20, surface: 9, mass: 0.1, length: 1 }), 1 / 60);
    expect(strip.material).toBe(wood); // no such pair: the idle one
    expect(masses.count).toBe(0); // the 0.1 kg carrier alone
    for (const [mass, discs] of [
      [0.5, 4],
      [1, 9],
      [2, 19],
    ] as const) {
      rig.pose(pose('configured', { angle: 20, surface: 3, mass, length: 1 }), 1 / 60);
      expect(masses.count).toBe(discs);
    }
  });

  it('poses by assignment: the same objects, geometries and materials, however often', () => {
    const { rig, root } = build();
    const count = () => {
      let n = 0;
      const geometries = new Set<unknown>();
      const materials = new Set<unknown>();
      root.traverse((o) => {
        n++;
        if (o instanceof THREE.Mesh) {
          geometries.add(o.geometry);
          materials.add(o.material);
        }
      });
      return { n, geometries: geometries.size, materials: materials.size };
    };
    const before = count();
    const states: SessionState[] = ['running', 'stopped', 'completed', 'configured'];
    for (let i = 0; i <= 100; i++) {
      const params = { angle: i % 61, surface: 3, mass: 0.5, length: 1 };
      rig.pose(pose(states[i % 4]!, params, i / 100), 1 / 60);
    }
    rig.pose(pose('configured', { angle: 30, surface: 3, mass: 0.5, length: 1 }), 1 / 60);
    expect(count()).toEqual(before);
  });

  it('frees every geometry, material and instance buffer it made, never the entity material', () => {
    const { frame, rig, root, painted } = build();
    const made = new Set<THREE.EventDispatcher<{ dispose: object }>>();
    const collect = () =>
      root.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          made.add(o.geometry as THREE.BufferGeometry);
          made.add(o.material as THREE.Material);
        }
        if (o instanceof THREE.InstancedMesh) made.add(o);
      });
    for (const surface of [1, 2, 3, 4]) {
      rig.pose(pose('running', { angle: 30, surface, mass: 1, length: 1 }, 0.2), 1 / 60);
      collect();
    }
    made.delete(painted);
    const freed = new Set<unknown>();
    for (const r of made) r.addEventListener('dispose', () => freed.add(r));
    let paintedFreed = false;
    painted.addEventListener('dispose', () => (paintedFreed = true));
    frame.dispose();
    rig.dispose();
    expect(freed.size).toBe(made.size);
    expect(paintedFreed).toBe(false);
  });

  it('draws the frame in 6 meshes and the rig in 9 (10 with the mass label in a browser)', () => {
    const { frame, rig } = build();
    expect(1 + meshCount(frame.parts)).toBe(6);
    expect(meshCount(rig.group)).toBe(9); // no canvas in Node: no label
  });

  it('keeps every part of the ramp above its underside: nothing cuts into the base board at 0°', () => {
    const { rig, root, named } = build();
    for (const angle of [0, 1, 2]) {
      rig.pose(pose('configured', { angle, surface: 3, mass: 2, length: 1 }), 1 / 60);
      root.updateMatrixWorld(true);
      const ramp = new THREE.Box3().setFromObject(named('ramp'), true);
      expect(ramp.min.y, `${angle}°`).toBeGreaterThanOrEqual(rig.group.position.y - 1e-6);
    }
  });

  it('holds the clamp on the stand’s rod at 60°, its base reaching back under the ramp’s push', () => {
    const { rig, root, named } = build();
    rig.pose(pose('configured', { angle: 60, surface: 3, mass: 0.5, length: 1 }), 1 / 60);
    root.updateMatrixWorld(true);
    const stand = (named('stand') as THREE.Mesh).geometry;
    stand.computeBoundingBox();
    const rodTop = stand.boundingBox!.max.y;
    const bossTop = rig.group.position.y + named('support').position.y + BOSS_TOP;
    expect(rodTop).toBeGreaterThan(bossTop); // the boss stays on the rod
    expect(rodTop - bossTop).toBeLessThan(0.05); // and the rod is no taller than 60° needs
    // The ramp pushes the rod away from the hinge (−x): the base reaches back under that push.
    const body = new THREE.Box3().setFromBufferAttribute(
      (root.children[0] as THREE.Mesh).geometry.getAttribute('position') as THREE.BufferAttribute,
    );
    expect(rig.group.position.x - REACH - body.min.x).toBeGreaterThan(0.25);
  });

  it('shows each surface pair in its own colour, the idle setup for missing or NaN dials', () => {
    const { rig, named } = build();
    const strip = named('strip') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    // Teflon, oiled metal, wood, dry steel
    const colours = { 1: 'f3f2ec', 2: '6f6656', 3: 'c9a273', 4: 'b4bcc4' } as const;
    for (const [surface, colour] of Object.entries(colours)) {
      rig.pose(pose('configured', { angle: 20, surface: +surface, mass: 1, length: 1 }), 1 / 60);
      expect(strip.material.color.getHexString(), `surface ${surface}`).toBe(colour);
    }
    for (const parameters of [{}, { angle: NaN, surface: NaN, mass: NaN, length: NaN }]) {
      rig.pose(pose('configured', { angle: 50, surface: 1, mass: 2, length: 1.5 }), 1 / 60);
      rig.pose(pose('configured', parameters), 1 / 60);
      expect(named('ramp').rotation.z).toBeCloseTo((-30 * Math.PI) / 180, 12);
      expect(strip.material.color.getHexString()).toBe('c9a273'); // wood
      expect((named('masses') as THREE.InstancedMesh).count).toBe(4); // 0.5 kg
      expect(named('block').position.x).toBeCloseTo(-(GATE_U + 1), 12); // L = 1 m, at the stop
    }
  });

  it('keeps the peg on the carrier with no plates on it (0.1 kg)', () => {
    const { rig, named } = build();
    rig.pose(pose('configured', { angle: 20, surface: 3, mass: 0.1, length: 1 }), 1 / 60);
    expect((named('masses') as THREE.InstancedMesh).count).toBe(0);
    const carrier = named('block-carrier') as THREE.Mesh;
    carrier.geometry.computeBoundingBox();
    // The carrier's top is 0.04 m over the block's underside; the peg stands 8 mm over it.
    expect(carrier.geometry.boundingBox!.max.y + carrier.position.y).toBeCloseTo(0.048, 6);
    expect(named('strip').castShadow).toBe(false); // inside the ramp board's shadow
  });

  describe('with a canvas (as in a browser)', () => {
    const texts: string[] = [];
    function stubCanvas() {
      texts.length = 0;
      const ctx = new Proxy<Record<string | symbol, unknown>>(
        {},
        {
          get: (target, key) =>
            key in target
              ? target[key]
              : key === 'fillText'
                ? (text: string) => texts.push(text)
                : () => undefined,
          set: (target, key, value) => ((target[key] = value), true),
        },
      );
      vi.stubGlobal('document', {
        createElement: () => ({ width: 0, height: 0, getContext: () => ctx }),
      });
    }
    afterEach(() => vi.unstubAllGlobals());

    it('paints canvases in their plane’s proportions and adds the mass label (rig 10 meshes)', () => {
      stubCanvas();
      const { frame, rig, named } = build();
      expect(1 + meshCount(frame.parts)).toBe(6);
      expect(meshCount(rig.group)).toBe(10);
      for (const name of ['ruler', 'mass-label', 'protractor']) {
        const mesh = named(name) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
        const image = mesh.material.map!.image as { width: number; height: number };
        mesh.geometry.computeBoundingBox();
        const size = mesh.geometry.boundingBox!.getSize(new THREE.Vector3());
        // The protractor is a quadrant of a disc mapped on the whole square texture.
        const plane = name === 'protractor' ? 1 : size.x / size.y;
        expect(image.width / image.height / plane, name).toBeCloseTo(1, 1);
      }
    });

    it('repaints the mass label only when the mass changes', () => {
      stubCanvas();
      const { rig } = build();
      const labels = () => texts.filter((t) => t.endsWith(' kg'));
      expect(labels()).toEqual(['0.5 kg']); // the idle setup
      for (let i = 0; i <= 60; i++) {
        rig.pose(pose('running', { angle: i, surface: 3, mass: 0.5, length: 1 }, i / 60), 1 / 60);
      }
      expect(labels()).toEqual(['0.5 kg']);
      rig.pose(pose('configured', { angle: 30, surface: 3, mass: 1.25, length: 1 }), 1 / 60);
      expect(labels()).toEqual(['0.5 kg', '1.25 kg']);
    });

    it('frees its canvas textures', () => {
      stubCanvas();
      const { frame, rig, root } = build();
      const maps = new Set<THREE.Texture>();
      root.traverse((o) => {
        if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
          if (o.material.map) maps.add(o.material.map);
        }
      });
      expect(maps.size).toBe(3); // protractor, ruler, mass label
      const freed = new Set<THREE.Texture>();
      for (const t of maps) t.addEventListener('dispose', () => freed.add(t));
      frame.dispose();
      rig.dispose();
      expect(freed.size).toBe(3);
    });
  });
});
