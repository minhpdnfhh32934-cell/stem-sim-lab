import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import items from '../../../content/items.json';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { quantize } from '../../../simulation/measurement';
import { solubilityModel } from '../../../simulation/models/solubility';
import { BEAKER } from './hot-plate';
import { SEGMENTS } from './osmosis-rack';
import {
  APPARENT,
  DENSITY,
  grainsOf,
  heapRadius,
  PACKING,
  PAN_Y,
  solubilityStation,
  WATER_MASS,
} from './solubility-station';

// The solubility bench against its item (0.80 × 0.46 × 0.35 m, the rig at the plate's top centre
// [-0.2, 0.08, 0] from the base), posed from samples of the real model: the weighed solid in the
// dish on the pan before a run, the crystal bed shrinking and the level rising from the run's
// `undissolved` and `dissolved`, the residue on the paper after it; the three readouts; all inside
// the item's box; posing only assigns; freeing everything.

/** The shipped item once integration adds it, else the draft's box and `bench.top`. */
const DRAFT_ITEM = {
  id: 'solubility-station',
  displayName: 'Hot-plate stirrer, beaker and balance (solubility)',
  description: 'draft',
  category: 'equipment',
  physical: { massKg: 6 },
  interactions: ['bench', 'inspect'],
  bench: { model: 'solubility-station', top: [-0.2, 0.08, 0] },
  visual: { shape: 'box', size: [0.8, 0.46, 0.35], color: '#e3e7ea', material: 'painted' },
};
const item = ItemDefinitionSchema.parse(
  items.find((i) => i.id === 'solubility-station') ?? DRAFT_ITEM,
);
const [W, H, D] = item.visual.size;

/** The model's inputs at the draft definition's defaults, with `over` dialled. */
const inputs = (over: Record<string, number> = {}): Record<string, number> => ({
  waterMass: 50,
  stirTime: 900,
  timeConstant: 60,
  timeLapse: 30,
  solute: 0,
  temperature: 20,
  soluteMass: 40,
  balanceResolution: 0.01,
  ...over,
});

/** The model's sample `seconds` of run time in (to the end of the run at most). */
function sampleAt(parameters: Record<string, number>, seconds: number) {
  const state = new Float64Array(solubilityModel.variables.length);
  solubilityModel.init(parameters, state);
  for (let i = Math.round(seconds / 0.02); i > 0; i--)
    solubilityModel.step(state, 0.02, parameters);
  return Object.fromEntries(solubilityModel.variables.map((v, i) => [v, state[i] ?? NaN]));
}
const none = Object.fromEntries(solubilityModel.variables.map((v) => [v, NaN]));
const pose = (
  status: BenchPose['status'],
  parameters: Record<string, number>,
  sample: Record<string, number> = none,
): BenchPose => ({ status, parameters, sample });

function build() {
  const painted = new THREE.MeshStandardMaterial();
  const frame = solubilityStation.frame(item, painted);
  const rig = solubilityStation.rig!(item);
  const root = new THREE.Group();
  root.add(new THREE.Mesh(frame.body, painted), frame.parts, rig.group);
  const named = (name: string) => root.getObjectByName(name) as THREE.Mesh;
  const instanced = (name: string) => root.getObjectByName(name) as THREE.InstancedMesh;
  /** What a readout shows, e.g. "40.00" (blank places as spaces, the colon ignored). */
  const reads = (name: string) => {
    const mesh = instanced(name);
    const m = new THREE.Matrix4();
    const lit = (slot: number) => (mesh.getMatrixAt(slot, m), m.determinant() !== 0);
    let text = '';
    for (let place = 0; place < Math.floor(mesh.count / 8); place++) {
      let bits = 0;
      for (let k = 0; k < 7; k++) if (lit(place * 8 + k)) bits |= 1 << k;
      const digit = SEGMENTS.indexOf(bits as (typeof SEGMENTS)[number]);
      text += digit >= 0 ? String(digit) : bits === 0x40 ? '-' : bits === 0 ? ' ' : '?';
      if (lit(place * 8 + 7)) text += '.';
    }
    return text;
  };
  const bounds = () => {
    root.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(root, true);
  };
  return { frame, rig, root, painted, named, instanced, reads, bounds };
}

const INNER_AREA = Math.PI * (BEAKER.radius - BEAKER.wall) ** 2;
/** The water's top above the plate (m). */
const level = (named: (n: string) => THREE.Mesh) => {
  const w = named('water');
  return w.position.y + w.scale.y;
};

describe('solubility station bench model', () => {
  it('reads only variables the solubility model outputs', () => {
    for (const v of solubilityStation.reads ?? []) expect(solubilityModel.variables).toContain(v);
  });

  const definition = fileURLToPath(
    new URL('../../../content/experiments/solubility.json', import.meta.url),
  );
  it.skipIf(!existsSync(definition))(
    'draws the shipped definition’s water when no run says',
    () => {
      const shipped = JSON.parse(readFileSync(definition, 'utf8')) as {
        initialConditions: Record<string, number>;
      };
      expect(shipped.initialConditions.waterMass).toBe(WATER_MASS);
    },
  );

  it('draws housing and balance as the entity’s mesh, the rest in few meshes, inside its box', () => {
    const { frame, rig, root, painted, named, bounds } = build();
    expect((root.children[0] as THREE.Mesh).geometry).toBe(frame.body);
    frame.body.computeBoundingBox();
    const body = frame.body.boundingBox!;
    expect(body.min.x).toBeCloseTo(-0.3, 6); // the housing, 0.20 wide about x −0.2
    expect(body.max.x).toBeCloseTo(0.37, 6); // the balance case, to x 0.37
    const meshes: THREE.Mesh[] = [];
    frame.parts.traverse((o) => {
      if (o instanceof THREE.Mesh) meshes.push(o as THREE.Mesh);
    });
    expect(meshes.map((m) => m.name).sort()).toEqual([
      'backlit',
      'glass',
      'metal',
      'shell',
      'soft',
    ]);
    expect(meshes.some((m) => m.material === painted)).toBe(false);
    const glass = named('glass').material as THREE.MeshStandardMaterial;
    expect(glass.transparent && !glass.depthWrite).toBe(true);
    expect((named('water').material as THREE.Material).transparent).toBe(true);
    expect(named('water').renderOrder).toBeLessThan(named('glass').renderOrder);
    let rigMeshes = 0;
    rig.group.traverse((o) => (rigMeshes += o instanceof THREE.Mesh ? 1 : 0));
    expect(rigMeshes).toBe(12); // plate, lamp, bar, water, bed, dish, paper, heap, caps, 3 readouts
    expect(rig.group.position.toArray().map((v) => +v.toFixed(9))).toEqual([
      -0.2,
      +(0.08 - H / 2).toFixed(9),
      0,
    ]);
    for (const [solute, mass, status, seconds] of [
      [2, 120, 'configured', 0], // the largest heap in the dish
      [2, 120, 'running', 0.1], // the fullest bed
      [0, 120, 'running', 30],
      [0, 120, 'completed', 30],
      [0, 10, 'completed', 30],
    ] as const) {
      const p = inputs({ solute, soluteMass: mass, temperature: 80 });
      rig.pose(pose(status, p, seconds ? sampleAt(p, seconds) : none), 1 / 60);
      const box = bounds();
      expect(box.min.y).toBeCloseTo(-H / 2, 6);
      for (const [lo, hi, size] of [
        [box.min.x, box.max.x, W],
        [box.min.y, box.max.y, H],
        [box.min.z, box.max.z, D],
      ] as const) {
        expect(lo).toBeGreaterThanOrEqual(-size / 2 - 1e-6);
        expect(hi).toBeLessThanOrEqual(size / 2 + 1e-6);
      }
    }
  });

  it('before a run: the solid heaped in the dish on the pan, m on the balance, T on the plate', () => {
    const { rig, named, instanced, reads } = build();
    rig.pose(pose('configured', inputs()), 1 / 60);
    expect(reads('balance-digits')).toBe('  40.00');
    expect(reads('temperature-digits')).toBe(' 20');
    expect(reads('timer-digits')).toBe(' 000'); // 0:00
    expect(named('heap').visible).toBe(true);
    expect(named('heap').scale.x).toBeCloseTo(heapRadius(40 / (PACKING * DENSITY[0])), 12);
    expect(named('heap').position.y).toBeGreaterThan(PAN_Y - H / 2 + 0.01);
    expect(named('dish').position.x).toBeCloseTo(0.27, 12); // on the pan
    expect(named('paper').visible).toBe(false);
    expect(instanced('bed').visible).toBe(false);
    expect(level(named)).toBeCloseTo(BEAKER.base + (WATER_MASS * 1e-6) / INNER_AREA, 12); // 50 mL
    // Room temperature: the plate is off and the bar still.
    expect(named('lamp').material).toBeInstanceOf(THREE.MeshStandardMaterial);
    const turn = named('stir-bar').rotation.y;
    rig.pose(pose('configured', inputs()), 1 / 60);
    expect(named('stir-bar').rotation.y).toBe(turn);
    // KCl, 80 °C, 120 g to 0.001 g: its cap off, the plate warm and lit, the bar turning.
    rig.pose(
      pose(
        'configured',
        inputs({ solute: 2, temperature: 80, soluteMass: 120, balanceResolution: 0.001 }),
      ),
      1 / 60,
    );
    expect(reads('balance-digits')).toBe('120.000');
    expect(reads('temperature-digits')).toBe(' 80');
    expect(named('lamp').material).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(
      (named('plate').material as THREE.MeshStandardMaterial).emissiveIntensity,
    ).toBeGreaterThan(0);
    expect(named('stir-bar').rotation.y).not.toBe(turn);
    const m = new THREE.Matrix4();
    const caps = instanced('caps');
    const capY = (i: number) => (caps.getMatrixAt(i, m), m.elements[13]);
    expect(capY(2)).toBeLessThan(capY(0)); // KCl's cap set down, the others on their jars
    expect(capY(0)).toBe(capY(1));
  });

  it('during a run: the bed from undissolved, the level from dissolved, the pan empty, the timer', () => {
    const { rig, named, instanced, reads } = build();
    // KNO₃ at 20 °C: 40 g in 50 g of water saturates (S ≈ 31.9); 120 g of KCl at 80 °C, the fullest bed.
    for (const [solute, mass, seconds] of [
      [0, 40, 5],
      [0, 40, 29],
      [2, 120, 0.1],
    ] as const) {
      const p = inputs({ solute, soluteMass: mass, temperature: solute ? 80 : 20 });
      const s = sampleAt(p, seconds);
      expect(s.undissolved).toBeGreaterThan(0);
      rig.pose(pose('running', p, s), 1 / 60);
      const rho = DENSITY[solute];
      const bulk = s.undissolved! / (PACKING * rho);
      expect(instanced('bed').visible).toBe(true);
      expect(instanced('bed').count).toBe(grainsOf(bulk));
      const mL = 50 + APPARENT * s.dissolved! + s.undissolved! / rho;
      expect(level(named)).toBeCloseTo(BEAKER.base + (mL * 1e-6) / INNER_AREA, 12);
      expect(named('heap').visible).toBe(false);
      expect(named('dish').position.x).not.toBeCloseTo(0.27, 6); // beside the balance
      expect(reads('balance-digits')).toBe('   0.00');
      const t = Math.floor(s.labTime!);
      const clock = `${Math.floor(t / 60)}${String(t % 60).padStart(2, '0')}`.padStart(4, ' ');
      expect(reads('timer-digits')).toBe(clock);
      rig.pose(pose('stopped', p, s), 1 / 60); // STOP: the bed stays, unweighed
      expect(instanced('bed').count).toBe(grainsOf(bulk));
      expect(reads('balance-digits')).toBe('   0.00');
    }
    // The bed shrinks as the run goes on, and the fullest bed is every grain.
    const p = inputs();
    rig.pose(pose('running', p, sampleAt(p, 1)), 1 / 60);
    const early = instanced('bed').count;
    rig.pose(pose('running', p, sampleAt(p, 10)), 1 / 60);
    expect(instanced('bed').count).toBeLessThan(early);
    expect(grainsOf(120 / (PACKING * DENSITY[2]))).toBe(80);
    expect(grainsOf(0.01)).toBe(1);
    expect(grainsOf(0)).toBe(0);
  });

  it('after a run: the beaker clear, the residue on the paper weighed to d; nothing when all went', () => {
    const { rig, named, instanced, reads } = build();
    for (const [solute, mass, temperature, d] of [
      [0, 40, 20, 0.01], // saturated: residue
      [1, 120, 80, 0.001],
      [0, 10, 20, 0.1], // all dissolved
      [2, 20, 40, 0.001], // just under saturation: all dissolved after ~420 s
    ] as const) {
      const p = inputs({ solute, soluteMass: mass, temperature, balanceResolution: d });
      const s = sampleAt(p, 31);
      rig.pose(pose('completed', p, s), 1 / 60);
      expect(instanced('bed').visible).toBe(false);
      expect(named('paper').visible).toBe(true);
      expect(named('dish').position.x).not.toBeCloseTo(0.27, 6);
      const left = s.undissolved!;
      expect(named('heap').visible).toBe(left > 0);
      if (left > 0) {
        expect(named('heap').scale.x).toBeCloseTo(
          heapRadius(left / (PACKING * DENSITY[solute])),
          12,
        );
        expect(reads('balance-digits').trim()).toBe(
          quantize(left, d).toFixed(String(d).length - 2),
        );
      } else {
        expect(reads('balance-digits').trim()).toBe((0).toFixed(String(d).length - 2));
      }
      // The solution keeps what dissolved; the crystals were filtered off.
      const mL = 50 + APPARENT * s.dissolved!;
      expect(level(named)).toBeCloseTo(BEAKER.base + (mL * 1e-6) / INNER_AREA, 12);
    }
  });

  it('shows the run’s own water mass and dashes for a reading that does not fit', () => {
    const { rig, named, reads } = build();
    const p = inputs({ waterMass: 100 });
    rig.pose(pose('running', p, sampleAt(p, 0.02)), 1 / 60);
    expect(level(named)).toBeGreaterThan(BEAKER.base + 100e-6 / INNER_AREA);
    rig.pose(pose('configured', inputs({ soluteMass: 1000, balanceResolution: 0.001 })), 1 / 60);
    expect(reads('balance-digits')).toBe('------');
  });

  it('shows nothing from a sample of another model', () => {
    const { rig, named, instanced, reads } = build();
    rig.pose(pose('running', {}, { v: 0.5, level: 1 }), 1 / 60);
    expect(instanced('bed').visible).toBe(false);
    expect(named('heap').visible).toBe(false);
    expect(reads('balance-digits')).toBe('      ');
    expect(reads('temperature-digits')).toBe('   ');
    expect(level(named)).toBeCloseTo(BEAKER.base + (WATER_MASS * 1e-6) / INNER_AREA, 12);
  });

  it('culls each readout by a sphere that holds every segment it lights', () => {
    const { rig, instanced } = build();
    const m = new THREE.Matrix4();
    const segment = new THREE.Sphere();
    const p = inputs({ soluteMass: 80, temperature: 80, balanceResolution: 0.001 });
    for (const [status, sample] of [
      ['configured', none],
      ['running', sampleAt(p, 8)],
      ['completed', sampleAt(p, 31)],
    ] as const) {
      rig.pose(pose(status, p, sample), 1 / 60);
      for (const name of ['balance-digits', 'temperature-digits', 'timer-digits']) {
        const mesh = instanced(name);
        expect(mesh.frustumCulled).toBe(true);
        const kept = mesh.boundingSphere!;
        mesh.geometry.computeBoundingSphere();
        let lit = 0;
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, m);
          if (m.determinant() === 0) continue;
          lit++;
          segment.copy(mesh.geometry.boundingSphere!).applyMatrix4(m);
          expect(kept.center.distanceTo(segment.center) + segment.radius).toBeLessThanOrEqual(
            kept.radius + 1e-9,
          );
        }
        expect(lit).toBeGreaterThan(0);
      }
    }
  });

  it('poses by assignment: the same objects, and a readout is rewritten only when it changes', () => {
    const { rig, root, instanced } = build();
    const count = () => {
      let n = 0;
      const materials = new Set<unknown>();
      const geometries = new Set<unknown>();
      root.traverse((o) => {
        n++;
        if (!(o instanceof THREE.Mesh)) return;
        materials.add(o.material);
        geometries.add(o.geometry);
      });
      return { n, materials: materials.size, geometries: geometries.size };
    };
    const p = inputs({ temperature: 60 });
    rig.pose(pose('configured', p), 1 / 60);
    const before = count();
    for (let i = 0; i <= 31; i++) {
      rig.pose(pose(i % 3 ? 'running' : 'completed', p, sampleAt(p, i)), 1 / 60);
    }
    rig.pose(pose('configured', p), 1 / 60);
    // Four materials swap on the lamp, nothing else: the same count of distinct ones.
    expect(count()).toEqual(before);
    const versions = () =>
      ['balance-digits', 'temperature-digits', 'timer-digits', 'caps'].map(
        (n) => instanced(n).instanceMatrix.version,
      );
    const s = sampleAt(p, 10);
    rig.pose(pose('running', p, s), 1 / 60);
    const once = versions();
    rig.pose(pose('running', p, s), 1 / 60);
    expect(versions()).toEqual(once);
  });

  it('frees every geometry, material and instance buffer it made, never the entity material', () => {
    const { frame, rig, root, painted } = build();
    const p = inputs({ temperature: 50 });
    for (const status of ['idle', 'configured', 'running', 'stopped', 'completed'] as const) {
      rig.pose(pose(status, p, status === 'running' ? sampleAt(p, 5) : none), 1 / 60);
    }
    const made = new Set<THREE.EventDispatcher<{ dispose: object }>>();
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        made.add(o.geometry as THREE.BufferGeometry);
        made.add(o.material as THREE.Material);
      }
      if (o instanceof THREE.InstancedMesh) made.add(o);
    });
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
});
