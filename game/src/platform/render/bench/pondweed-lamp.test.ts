import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import items from '../../../content/items.json';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import type { SessionState } from '../../../simulation/ExperimentSession';
import {
  PHOTOSYNTHESIS,
  photosynthesisModel as model,
} from '../../../simulation/models/photosynthesis';
import { PONDWEED_LAYOUT as L, pondweedLamp } from './pondweed-lamp';

// The pondweed-and-lamp bench against its item (0.84 × 0.46 × 0.28 m, the plant at bench.top) and
// samples of the photosynthesis model's own runs: it stays in its box at both ends of the lamp's
// travel, the lamp stands `distance` from the plant and is lit only while collecting, the
// thermometer reads the dial, the gas column is V of the capillary's bore, the bubbles leave the
// cut end as the count rises, the capillary's scale follows δV, nothing see-through casts a shadow,
// posing allocates nothing, and it frees all it made.

const item = ItemDefinitionSchema.parse(items.find((i) => i.id === 'pondweed-lamp'));
const [w, h, d] = item.visual.size;
const [tx, , tz] = item.bench!.top;
const top = new THREE.Vector3(tx, -h / 2, tz);
const DIALS = { distance: 0.1, carbonate: 0.05, temperature: 25, resolution: 0.01 };
const NO_RUN = Object.fromEntries(model.variables.map((v) => [v, NaN]));

/** The model's state after `seconds` of a 60 s collection, by variable name. */
function sample(seconds: number, dials: Record<string, number> = DIALS) {
  const inputs = { ...dials, duration: 60 };
  const state = new Float64Array(model.variables.length);
  model.init(inputs, state);
  for (let t = 0; t < seconds - 1e-9; t += 0.05) model.step(state, 0.05, inputs);
  return Object.fromEntries(model.variables.map((v, i) => [v, state[i] ?? NaN]));
}
const pose = (
  status: SessionState,
  s: Record<string, number> = NO_RUN,
  parameters: Record<string, number> = DIALS,
): BenchPose => ({ status, parameters, sample: s });

function build() {
  const painted = new THREE.MeshStandardMaterial();
  const frame = pondweedLamp.frame(item, painted);
  const rig = pondweedLamp.rig!(item);
  const root = new THREE.Group();
  root.add(new THREE.Mesh(frame.body, painted), frame.parts, rig.group);
  const named = (name: string) => {
    const found = root.getObjectByName(name);
    if (!found) throw new Error(`no ${name}`);
    return found as THREE.Mesh;
  };
  return { frame, rig, root, painted, named };
}

/** Each bubble's height above the bench (m), newest first. */
function bubbleHeights(bubbles: THREE.InstancedMesh) {
  const m = new THREE.Matrix4();
  return Array.from({ length: bubbles.count }, (_, i) => {
    bubbles.getMatrixAt(i, m);
    return new THREE.Vector3().setFromMatrixPosition(m).y;
  });
}

describe('pondweed and lamp bench model', () => {
  it('reads only variables the photosynthesis model outputs', () => {
    for (const v of pondweedLamp.reads ?? []) expect(model.variables).toContain(v);
  });

  it('stays inside its box with the lamp at both ends of its travel, the rig at bench.top', () => {
    const { frame, rig, root } = build();
    expect(rig.group.position.toArray()).toEqual(top.toArray());
    const full = sample(60, { ...DIALS, distance: 0.05, temperature: 40 });
    for (const distance of [0.05, 0.5]) {
      rig.pose(pose('running', sample(30), { ...DIALS, distance, temperature: 40 }), 1 / 60);
      rig.pose(pose('running', full, { ...DIALS, distance, temperature: 40 }), 1 / 60);
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root, true);
      const eps = 1e-6;
      expect(box.min.x).toBeGreaterThanOrEqual(-w / 2 - eps);
      expect(box.max.x).toBeLessThanOrEqual(w / 2 + eps);
      expect(box.min.y).toBeGreaterThanOrEqual(-h / 2 - eps);
      expect(box.max.y).toBeLessThanOrEqual(h / 2 + eps);
      expect(box.min.z).toBeGreaterThanOrEqual(-d / 2 - eps);
      expect(box.max.z).toBeLessThanOrEqual(d / 2 + eps);
    }
    frame.body.computeBoundingBox();
    expect(frame.body.boundingBox!.min.y).toBeCloseTo(-h / 2, 6); // the stand's base on the bench
  });

  it('stands the lamp `distance` from the plant, lit only while a run collects', () => {
    const { rig, named } = build();
    const lamp = named('lamp');
    const lens = named('lamp-lens').material as THREE.MeshStandardMaterial;
    const index = named('lamp-index');
    rig.pose(pose('configured'), 1 / 60); // idle: the dial's distance, the lamp off
    expect(lamp.position.x).toBeCloseTo(-0.1, 12);
    expect(lens.emissiveIntensity).toBe(0);
    // The index's front edge (it is 6 mm deep, centred 3 mm behind the lamp's face) reads d.
    expect(lamp.position.x + index.position.x + 0.003).toBeCloseTo(-0.1, 12);
    rig.pose(pose('running', sample(1), { ...DIALS, distance: 0.4 }), 1 / 60);
    expect(lamp.position.x).toBeCloseTo(-0.4, 12);
    expect(lens.emissiveIntensity).toBeGreaterThan(0);
    for (const status of ['stopped', 'completed', 'idle'] as const) {
      rig.pose(pose(status, sample(60)), 1 / 60);
      expect(lens.emissiveIntensity).toBe(0);
    }
    rig.pose(pose('configured', NO_RUN, {}), 1 / 60); // no dial: the far end of the rule
    expect(lamp.position.x).toBeCloseTo(-0.5, 12);
  });

  it('reads the water bath’s temperature on the thermometer', () => {
    const { rig, named } = build();
    const alcohol = named('alcohol');
    expect(alcohol.visible).toBe(false); // built: no column until a temperature is given
    rig.pose(pose('configured', NO_RUN, {}), 1 / 60); // a first pose without one: still none
    expect(alcohol.visible).toBe(false);
    for (const temperature of [5, 25, 40]) {
      rig.pose(pose('configured', NO_RUN, { ...DIALS, temperature }), 1 / 60);
      const reading = L.THERMO.zero + ((temperature + 10) * L.THERMO.span) / 120;
      expect(alcohol.position.y + alcohol.scale.y).toBeCloseTo(reading, 12);
    }
    rig.pose(pose('configured', NO_RUN, {}), 1 / 60);
    expect(alcohol.visible).toBe(false);
  });

  it('fills the capillary’s bore with V of gas from its cap down, water below', () => {
    const { rig, named } = build();
    const gas = named('gas');
    const water = named('capillary-water');
    expect(gas.visible).toBe(false); // built, before any pose: full of water, as without a run
    expect(water.scale.y).toBeCloseTo(L.BORE_LENGTH, 12);
    rig.pose(pose('configured'), 1 / 60); // no run: full of water
    expect(gas.visible).toBe(false);
    expect(water.scale.y).toBeCloseTo(L.BORE_LENGTH, 12);
    const end = sample(60);
    // 0.1 m, 0.05 mol/L, 25 °C: 1/P = 50 + 110√2 s/mL (the model's worked value), V = 60 P.
    expect(end.volume).toBeCloseTo(60 / (50 + 110 * Math.SQRT2), 12);
    rig.pose(pose('completed', end), 1 / 60);
    const length = (end.volume! * 1e-6) / L.BORE_AREA; // ≈ 0.0399 m for 0.282 mL
    expect(gas.visible).toBe(true);
    expect(gas.scale.y).toBeCloseTo(length, 12);
    expect(gas.position.y).toBe(L.CAP.gasTop);
    expect(water.scale.y + gas.scale.y).toBeCloseTo(L.BORE_LENGTH, 12);
    rig.pose(pose('running', { ...end, volume: 10 }), 1 / 60); // more than the bore: full of gas
    expect(gas.scale.y).toBeCloseTo(L.BORE_LENGTH, 12);
    expect(water.visible).toBe(false);
  });

  it('releases a bubble from the cut end as each is counted, rising until it meets the gas', () => {
    const { rig, named } = build();
    const bubbles = named('bubbles') as THREE.InstancedMesh;
    rig.pose(pose('running', sample(0.5)), 1 / 60); // no whole bubble yet (one every 2.06 s here)
    expect(bubbles.count).toBe(0);
    const mid = sample(19); // 0.5 s after the 9th left
    rig.pose(pose('running', mid), 1 / 60);
    const n = mid.bubbles!;
    expect(n).toBe(9); // 19 s × 0.00487 mL/s = 0.0924 mL, one every 2.06 s
    const heights = bubbleHeights(bubbles);
    expect(heights.length).toBeGreaterThan(0);
    // The newest left when V passed n bubbles, at n·V_b/P s; it rose at RISE since then.
    const left = (n * PHOTOSYNTHESIS.bubbleVolume) / mid.rate!;
    expect(heights[0]).toBeCloseTo(L.CUT.y + (mid.elapsed! - left) * L.RISE, 6);
    const gasBottom = L.CAP.gasTop - (mid.volume! * 1e-6) / L.BORE_AREA;
    for (const y of heights) {
      expect(y).toBeGreaterThanOrEqual(L.CUT.y);
      expect(y).toBeLessThan(gasBottom);
    }
    rig.pose(pose('stopped', mid), 1 / 60); // frozen where they were
    expect(bubbleHeights(bubbles)).toEqual(heights);
    // The run ends with a bubble in flight (the 29th left at 59.6 s): it stays, frozen, not gone.
    const end = sample(60);
    rig.pose(pose('running', end), 1 / 60);
    const last = bubbleHeights(bubbles);
    expect(last.length).toBeGreaterThan(0);
    rig.pose(pose('completed', end), 1 / 60);
    expect(bubbleHeights(bubbles)).toEqual(last);
    rig.pose(pose('configured'), 1 / 60);
    expect(bubbles.count).toBe(0);
  });

  it('keeps the bubbles rising between model steps, at most one step ahead, frozen when stopped', () => {
    const { rig, named } = build();
    const bubbles = named('bubbles') as THREE.InstancedMesh;
    const mid = sample(19);
    rig.pose(pose('running', mid), 1 / 300);
    const [first] = bubbleHeights(bubbles);
    // The same model step, five frames on at 300 Hz: risen RISE·dt each frame, not held still.
    for (let f = 1; f <= 5; f++) {
      rig.pose(pose('running', mid), 1 / 300);
      expect(bubbleHeights(bubbles)[0]).toBeCloseTo(first! + (f / 300) * L.RISE, 6);
    }
    // Never further than one model step ahead of the run's own time.
    for (let f = 0; f < 60; f++) rig.pose(pose('running', mid), 1 / 300);
    expect(bubbleHeights(bubbles)[0]).toBeCloseTo(first! + L.MODEL_STEP * L.RISE, 6);
    const ahead = bubbleHeights(bubbles);
    rig.pose(pose('stopped', mid), 1 / 300); // frozen where they were drawn, not stepped back
    rig.pose(pose('stopped', mid), 1 / 300);
    expect(bubbleHeights(bubbles)).toEqual(ahead);
    // The next model step: drawn from its own time again.
    const next = sample(19.05);
    rig.pose(pose('running', next), 1 / 300);
    const left = (next.bubbles! * PHOTOSYNTHESIS.bubbleVolume) / next.rate!;
    expect(bubbleHeights(bubbles)[0]).toBeCloseTo(L.CUT.y + (next.elapsed! - left) * L.RISE, 6);
  });

  it('marks the capillary every δV from the gas’s zero down, longer every 0.1 mL', () => {
    const { rig, named } = build();
    const scale = named('capillary-scale') as THREE.InstancedMesh;
    const m = new THREE.Matrix4();
    const at = (i: number) => {
      scale.getMatrixAt(i, m);
      return { x: m.elements[12], y: m.elements[13], width: m.elements[0] };
    };
    // Every mark lies on the tube's front, inside its outer radius (seen from the desk).
    const inside = (i: number) => {
      const { x, width } = at(i);
      expect(x - width / 2).toBeGreaterThanOrEqual(-L.CAP.outer);
      expect(x + width / 2).toBeLessThanOrEqual(L.CAP.outer);
    };
    for (const dv of [0.005, 0.01, 0.05, 0.2]) {
      rig.pose(pose('configured', NO_RUN, { ...DIALS, resolution: dv }), 1 / 60);
      const step = (dv * 1e-6) / L.BORE_AREA;
      expect(scale.count).toBe(Math.floor(L.BORE_LENGTH / step + 1e-9) + 1);
      expect(scale.count).toBeLessThanOrEqual(L.MARKS);
      expect(at(0).y).toBe(Math.fround(L.CAP.gasTop)); // zero where the gas gathers (float32 buffer)
      inside(0);
      for (let k = 1; k < scale.count; k++) {
        inside(k);
        expect(at(k - 1).y - at(k).y).toBeCloseTo(step, 6); // 0.5 µm: float32 at 0.3 m
        const tenth = Math.abs((k * dv) / 0.1 - Math.round((k * dv) / 0.1)) < 1e-6;
        expect(at(k).width).toBe(Math.fround(tenth ? L.SCALE.long : L.SCALE.short));
      }
      expect(at(scale.count - 1).y).toBeGreaterThanOrEqual(L.CAP.bottom - 1e-12);
    }
    expect(L.MARKS).toBe(Math.floor(L.BORE_LENGTH / ((0.005 * 1e-6) / L.BORE_AREA)) + 1);
    rig.pose(pose('configured', NO_RUN, { ...DIALS, resolution: NaN }), 1 / 60);
    expect(scale.count).toBe(0); // no δV: no scale rather than a wrong one
  });

  it('casts no shadow from glass or liquid (anything see-through)', () => {
    const { root } = build();
    let seeThrough = 0;
    root.traverse((o) => {
      if (o instanceof THREE.Mesh && (o.material as THREE.Material).transparent) {
        seeThrough++;
        expect(o.castShadow).toBe(false);
      }
    });
    expect(seeThrough).toBe(3); // glass, solution, the capillary's water
  });

  it('poses by assignment: the same objects, materials and buffers, however often', () => {
    const { rig, root, named } = build();
    const bubbles = named('bubbles') as THREE.InstancedMesh;
    const buffer = bubbles.instanceMatrix.array;
    const count = () => {
      let n = 0;
      const owned = new Set<unknown>();
      root.traverse((o) => {
        n++;
        if (o instanceof THREE.Mesh) owned.add(o.material).add(o.geometry);
      });
      return { n, owned: owned.size };
    };
    const before = count();
    const states = ['running', 'stopped', 'completed', 'configured'] as const;
    for (let i = 0; i <= 120; i++) {
      const s = i % 30 === 0 ? NO_RUN : sample(i / 2);
      rig.pose(pose(states[i % 4]!, s, { ...DIALS, distance: 0.05 + i / 300 }), 1 / 60);
    }
    expect(count()).toEqual(before);
    expect(bubbles.instanceMatrix.array).toBe(buffer);
  });

  it('frees every geometry, material and instance buffer it made, never the entity material', () => {
    const { frame, rig, root, painted } = build();
    const made = new Set<THREE.EventDispatcher<{ dispose: object }>>();
    for (const status of ['idle', 'configured', 'running', 'stopped', 'completed'] as const) {
      rig.pose(pose(status, sample(10)), 1 / 60);
      root.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          made.add(o.geometry as THREE.BufferGeometry);
          made.add(o.material as THREE.Material);
        }
        if (o instanceof THREE.InstancedMesh) made.add(o);
      });
    }
    made.delete(painted);
    const freed = new Set<unknown>();
    for (const resource of made) resource.addEventListener('dispose', () => freed.add(resource));
    let paintedFreed = false;
    painted.addEventListener('dispose', () => (paintedFreed = true));
    frame.dispose();
    rig.dispose();
    expect(freed.size).toBe(made.size);
    expect(paintedFreed).toBe(false);
  });

  it('draws in few meshes: 6 fixed, 9 posed', () => {
    const { frame, rig } = build();
    const meshes = (o: THREE.Object3D) => {
      let n = 0;
      o.traverse((c) => {
        if (c instanceof THREE.Mesh) n++;
      });
      return n;
    };
    expect(1 + meshes(frame.parts)).toBe(6); // the body is the entity's mesh
    expect(meshes(rig.group)).toBe(9);
  });
});
