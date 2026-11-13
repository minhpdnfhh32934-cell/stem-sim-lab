import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import osmosisJson from '../../../content/experiments/osmosis.json';
import items from '../../../content/items.json';
import type { BenchPose } from '../../../gameplay/experiment/StationSystem';
import { ItemDefinitionSchema } from '../../../gameplay/item';
import { quantize } from '../../../simulation/measurement';
import { osmosisModel } from '../../../simulation/models/osmosis';
import { LENGTH_PER_GRAM, osmosisRack, SEGMENTS, SOLUTION } from './osmosis-rack';

// The osmosis bench against its item (0.70 × 0.16 × 0.35 m, the rig standing at its base centre),
// posed from samples of the real model: the cylinder on the pan before and after the soak and in
// its tube during it, its size from its mass; the solution's level from its volume; the label,
// balance and timer readouts; all inside the item's box; posing only assigns; freeing everything.

const item = ItemDefinitionSchema.parse(items.find((i) => i.id === 'osmosis-rack'));
const [W, H, D] = item.visual.size;

/** The shipped definition's inputs (initial conditions and dial defaults), with `over` dialled. */
const inputs = (over: Record<string, number> = {}): Record<string, number> => ({
  ...osmosisJson.initialConditions,
  ...Object.fromEntries(osmosisJson.parameters.map((p) => [p.id, p.default])),
  ...over,
});

/** The model's sample `seconds` of run time in (to the end of the soak at most). */
function sampleAt(parameters: Record<string, number>, seconds: number) {
  const state = new Float64Array(osmosisModel.variables.length);
  osmosisModel.init(parameters, state);
  // Once the soak is over a step does nothing.
  for (let i = Math.round(seconds / 0.02); i > 0; i--) osmosisModel.step(state, 0.02, parameters);
  return Object.fromEntries(osmosisModel.variables.map((v, i) => [v, state[i] ?? NaN]));
}
const none = Object.fromEntries(osmosisModel.variables.map((v) => [v, NaN]));
const pose = (
  status: BenchPose['status'],
  parameters: Record<string, number>,
  sample: Record<string, number> = none,
): BenchPose => ({ status, parameters, sample });

function build() {
  const painted = new THREE.MeshStandardMaterial();
  const frame = osmosisRack.frame(item, painted);
  const rig = osmosisRack.rig!(item);
  const root = new THREE.Group();
  root.add(new THREE.Mesh(frame.body, painted), frame.parts, rig.group);
  const named = (name: string) => root.getObjectByName(name) as THREE.Mesh;
  const instanced = (name: string) => root.getObjectByName(name) as THREE.InstancedMesh;
  /** What a readout shows, e.g. "3.00" (blank places as spaces). */
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
  return { frame, rig, root, painted, named, instanced, reads };
}

/** The cylinder's drawn scale: (V/V₀)^⅓, V₀ = m₀/1.08 mL, plus 1 mL per gram of water gained. */
const volumeScale = (m: number, m0: number) => Math.cbrt(1 + (1.08 * (m - m0)) / m0);

/** Sucrose solution's density (g/mL) at C mol/L: the stated fit, 0.998 + 0.129·C. */
const solutionDensity = (c: number) => 0.998 + 0.129 * c;
/** The cylinder's density (g/mL): m over V₀ = m₀/1.08 mL plus 1 mL per gram of water gained. */
const cylinderDensity = (m: number, m0: number) => m / (m0 / 1.08 + (m - m0));

/** The solution's top (m above the base). */
const level = (root: THREE.Object3D) => {
  const s = root.getObjectByName('solution')!;
  return s.position.y + s.scale.y;
};

describe('osmosis rack bench model', () => {
  it('draws the balance case as the entity’s mesh, its parts in a few meshes, inside its box', () => {
    const { frame, rig, root, painted, named } = build();
    expect((root.children[0] as THREE.Mesh).geometry).toBe(frame.body);
    // The largest part takes the focus glow: the balance case, 0.20 m wide at x 0.21.
    frame.body.computeBoundingBox();
    const body = frame.body.boundingBox!.getSize(new THREE.Vector3());
    expect(body.x).toBeCloseTo(0.2, 6); // float32 positions
    expect(body.z).toBeCloseTo(0.25, 6);
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
    // Both transparent, neither writes depth: the solution is drawn before the glass around it.
    for (const liquid of [named('solution'), named('solution-bottom')]) {
      expect((liquid.material as THREE.Material).transparent).toBe(true);
      expect(liquid.renderOrder).toBeLessThan(named('glass').renderOrder);
    }
    // bench.top [0, 0, 0]: the rig stands at the base centre.
    expect(rig.group.position.toArray()).toEqual([0, -H / 2, 0]);
    for (const [m0, c, status, seconds] of [
      [6, 0, 'completed', 60],
      [6, 0, 'running', 60],
      [6, 1, 'running', 60],
      [6, 1, 'running', 1], // floating
      [1, 0.5, 'configured', 0],
    ] as const) {
      const p = inputs({ initialMass: m0, concentration: c });
      rig.pose(pose(status, p, seconds ? sampleAt(p, seconds) : none), 1 / 60);
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root, true);
      expect(box.min.x).toBeGreaterThanOrEqual(-W / 2);
      expect(box.max.x).toBeLessThanOrEqual(W / 2);
      expect(box.min.y).toBeGreaterThanOrEqual(-H / 2 - 1e-9);
      expect(box.max.y).toBeLessThanOrEqual(H / 2);
      expect(box.min.z).toBeGreaterThanOrEqual(-D / 2);
      expect(box.max.z).toBeLessThanOrEqual(D / 2);
    }
  });

  it('before a run: the cut cylinder on the pan, m₀ on the balance, C on the label, 0:00', () => {
    const { rig, root, named, reads } = build();
    rig.pose(pose('configured', inputs()), 1 / 60);
    const cylinder = named('cylinder');
    expect(cylinder.visible).toBe(true);
    expect(cylinder.rotation.z).toBeCloseTo(Math.PI / 2, 12); // lying
    expect(cylinder.scale.y).toBeCloseTo(3 * LENGTH_PER_GRAM, 12); // 35 mm for 3 g
    expect(cylinder.scale.x).toBeCloseTo(1, 12);
    expect(reads('balance-digits')).toBe('  3.00');
    expect(reads('label-digits')).toBe('0.40');
    expect(reads('timer-digits')).toBe('000');
    // 40 mL in a 22.6 mm bore with its round bottom: about 10 cm deep.
    const bore = Math.PI * 0.0113 ** 2;
    const round = (2 / 3) * Math.PI * 0.0113 ** 3;
    expect(level(root)).toBeCloseTo(0.004 + 0.0012 + 0.0113 + (SOLUTION - round) / bore, 9);
    rig.pose(pose('configured', inputs({ balanceResolution: 0.001, concentration: 1 })), 1 / 60);
    expect(reads('balance-digits')).toBe(' 3.000');
    expect(reads('label-digits')).toBe('1.00');
  });

  it('during the soak: the cylinder upright in its tube, its size from its mass, the pan empty', () => {
    const { rig, root, named, reads } = build();
    // 3 g losing water in 0.8 mol/L after 1 h 0.4 min; the largest, 6 g gaining in water for 4 h.
    for (const [m0, c, seconds, clock] of [
      [3, 0.8, 15.1, '100'],
      [6, 0, 61, '400'],
    ] as const) {
      const p = inputs({ concentration: c, initialMass: m0 });
      rig.pose(pose('configured', p), 1 / 60);
      const before = level(root);
      const s = sampleAt(p, seconds);
      rig.pose(pose('running', p, s), 1 / 60);
      const cylinder = named('cylinder');
      const k = volumeScale(s.mass!, m0);
      expect(Math.sign(s.mass! - m0)).toBe(c > 0.25 ? -1 : 1);
      expect(cylinder.rotation.z).toBe(0);
      expect(cylinder.scale.x).toBeCloseTo(k, 12);
      expect(cylinder.scale.y).toBeCloseTo(m0 * LENGTH_PER_GRAM * k, 12);
      const top = cylinder.position.y + cylinder.scale.y / 2;
      expect(cylinder.position.y - cylinder.scale.y / 2).toBeGreaterThan(0.0052); // on the bottom
      expect(top).toBeLessThan(level(root)); // under the solution
      // Only its starting volume raised the level: the water it moved left one and joined the other.
      const rise = m0 / 1.08e6 / (Math.PI * 0.0113 ** 2);
      expect(level(root) - before).toBeCloseTo(rise, 12);
      expect(reads('balance-digits')).toBe('  0.00');
      expect(reads('timer-digits')).toBe(clock);
      expect(cylinderDensity(s.mass!, m0)).toBeGreaterThanOrEqual(solutionDensity(c)); // sinks
      rig.pose(pose('stopped', p, s), 1 / 60); // STOP: it stays in the tube, unweighed
      expect(named('cylinder').rotation.z).toBe(0);
      expect(reads('balance-digits')).toBe('  0.00');
    }
  });

  it('during the soak: lighter than a strong solution, the cylinder floats, ρ/ρ_solution under', () => {
    const { rig, root, named } = build();
    // 3 g in 1 mol/L (1.127 g/mL) after 4 min: still about 1.08 g/mL, so it floats; by 4 h it has
    // lost enough water to be denser than the solution and lies on the bottom.
    const p = inputs({ concentration: 1 });
    rig.pose(pose('configured', p), 1 / 60);
    const before = level(root);
    const s = sampleAt(p, 1);
    const under = cylinderDensity(s.mass!, 3) / solutionDensity(1);
    expect(under).toBeLessThan(1);
    rig.pose(pose('running', p, s), 1 / 60);
    const cylinder = named('cylinder');
    const top = cylinder.position.y + cylinder.scale.y / 2;
    expect(cylinder.rotation.z).toBe(0);
    expect(top - level(root)).toBeCloseTo((1 - under) * cylinder.scale.y, 12); // above the surface
    expect(cylinder.position.y - cylinder.scale.y / 2).toBeGreaterThan(0.0052 + 0.001); // off the bottom
    // It displaces its own weight of solution; the water it gave joined the solution.
    const rise = (s.mass! / solutionDensity(1) - (s.mass! - 3)) * 1e-6;
    expect(level(root) - before).toBeCloseTo(rise / (Math.PI * 0.0113 ** 2), 12);
    const end = sampleAt(p, 61);
    expect(cylinderDensity(end.mass!, 3)).toBeGreaterThan(solutionDensity(1));
    rig.pose(pose('running', p, end), 1 / 60);
    const sunk = named('cylinder');
    expect(sunk.position.y - sunk.scale.y / 2).toBeLessThan(0.0052 + 0.002); // on the bottom
  });

  it('idle shows the set-up as configured; a value the readout cannot hold shows dashes', () => {
    const { rig, named, reads } = build();
    rig.pose(pose('idle', inputs()), 1 / 60);
    expect(named('cylinder').visible).toBe(true);
    expect(named('cylinder').rotation.z).toBeCloseTo(Math.PI / 2, 12); // on the pan
    expect(reads('balance-digits')).toBe('  3.00');
    expect(reads('label-digits')).toBe('0.40');
    expect(reads('timer-digits')).toBe('000');
    // 120 g to 0.001 g needs six places, the balance has five; 10 mol/L needs four, the label three.
    rig.pose(
      pose('configured', inputs({ initialMass: 120, balanceResolution: 0.001, concentration: 10 })),
      1 / 60,
    );
    expect(reads('balance-digits')).toBe('-----');
    expect(reads('label-digits')).toBe('---');
  });

  it('culls each readout by a sphere that holds every segment it lights', () => {
    const { rig, instanced } = build();
    const m = new THREE.Matrix4();
    const segment = new THREE.Sphere();
    // Readings with every digit's segments among them (8s, points, the colon) and the bounds kept.
    const p = inputs({ concentration: 0.88, initialMass: 5.888, balanceResolution: 0.001 });
    for (const [status, sample] of [
      ['configured', none],
      ['running', sampleAt(p, 30)],
      ['completed', sampleAt(p, 61)],
    ] as const) {
      rig.pose(pose(status, p, sample), 1 / 60);
      for (const name of ['balance-digits', 'label-digits', 'timer-digits']) {
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
          const reach = kept.center.distanceTo(segment.center) + segment.radius;
          expect(reach).toBeLessThanOrEqual(kept.radius + 1e-9);
        }
        expect(lit).toBeGreaterThan(0);
      }
    }
  });

  it('after the soak: the cylinder blotted on the pan, read to the balance’s resolution', () => {
    const { rig, root, named, reads } = build();
    for (const [c, d] of [
      [0, 0.01],
      [1, 0.001],
      [0.25, 0.1],
    ] as const) {
      const p = inputs({ concentration: c, balanceResolution: d });
      const s = sampleAt(p, 61);
      rig.pose(pose('completed', p, s), 1 / 60);
      expect(s.labTime).toBe(14400);
      expect(named('cylinder').rotation.z).toBeCloseTo(Math.PI / 2, 12);
      expect(named('cylinder').scale.x).toBeCloseTo(volumeScale(s.mass!, 3), 12);
      const reading = quantize(s.mass!, d).toFixed(String(d).length - 2);
      expect(reads('balance-digits').trim()).toBe(reading);
      expect(reads('timer-digits')).toBe('400'); // 4:00
      // The solution lost (or gained) the water the cylinder took up (or gave).
      const after = level(root);
      rig.pose(pose('configured', p), 1 / 60);
      expect(after - level(root)).toBeCloseTo((-(s.mass! - 3) * 1e-6) / (Math.PI * 0.0113 ** 2), 9);
    }
  });

  it('reads only variables the osmosis model outputs, and shows nothing it lacks', () => {
    for (const v of osmosisRack.reads ?? []) expect(osmosisModel.variables).toContain(v);
    const { rig, named, reads } = build();
    rig.pose(pose('running', {}, { v: 0.5, i: 0.5, level: 0.5 }), 1 / 60);
    expect(named('cylinder').visible).toBe(false);
    expect(reads('balance-digits')).toBe('     ');
    expect(reads('label-digits')).toBe('   ');
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
    const p = inputs();
    rig.pose(pose('configured', p), 1 / 60);
    const before = count();
    for (let i = 0; i <= 60; i++) {
      rig.pose(pose(i % 3 ? 'running' : 'completed', p, sampleAt(p, i)), 1 / 60);
    }
    rig.pose(pose('configured', p), 1 / 60);
    expect(count()).toEqual(before);
    const versions = () =>
      ['balance-digits', 'label-digits', 'timer-digits'].map(
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
    const p = inputs();
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
